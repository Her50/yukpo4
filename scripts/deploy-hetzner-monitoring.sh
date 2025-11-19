#!/bin/bash

# Script de déploiement des métriques Grafana/Prometheus/AlertManager sur Hetzner
# Usage: ./scripts/deploy-hetzner-monitoring.sh

set -e

echo "🚀 Déploiement des métriques sur Hetzner..."

# Configuration
HETZNER_HOST="46.224.14.85"
HETZNER_USER="root"
HETZNER_DIR="/opt/yukpo"
LOCAL_MONITORING_DIR="backend/monitoring"

# Couleurs pour les messages
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Fonction pour afficher les messages
info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
    exit 1
}

# Vérifier que les fichiers existent localement
info "Vérification des fichiers locaux..."
if [ ! -f "$LOCAL_MONITORING_DIR/alertmanager.yml" ]; then
    error "Fichier $LOCAL_MONITORING_DIR/alertmanager.yml introuvable"
fi

if [ ! -f "$LOCAL_MONITORING_DIR/prometheus_alerts.yml" ]; then
    error "Fichier $LOCAL_MONITORING_DIR/prometheus_alerts.yml introuvable"
fi

if [ ! -f "$LOCAL_MONITORING_DIR/prometheus.yml" ]; then
    error "Fichier $LOCAL_MONITORING_DIR/prometheus.yml introuvable"
fi

if [ ! -d "$LOCAL_MONITORING_DIR/grafana" ]; then
    error "Répertoire $LOCAL_MONITORING_DIR/grafana introuvable"
fi

info "✅ Tous les fichiers sont présents"

# Vérifier la connexion SSH
info "Vérification de la connexion SSH..."
if ! ssh -o ConnectTimeout=5 "$HETZNER_USER@$HETZNER_HOST" "echo 'Connexion OK'" > /dev/null 2>&1; then
    error "Impossible de se connecter à $HETZNER_HOST"
fi

info "✅ Connexion SSH établie"

# Créer les répertoires sur Hetzner
info "Création des répertoires sur Hetzner..."
ssh "$HETZNER_USER@$HETZNER_HOST" << 'EOF'
    mkdir -p /opt/yukpo/backend/monitoring/grafana/dashboards
    mkdir -p /opt/yukpo/backend/monitoring/grafana/datasources
    echo "✅ Répertoires créés"
EOF

# Copier les fichiers de configuration
info "Copie des fichiers de configuration..."

# AlertManager
scp "$LOCAL_MONITORING_DIR/alertmanager.yml" "$HETZNER_USER@$HETZNER_HOST:$HETZNER_DIR/backend/monitoring/"

# Prometheus
scp "$LOCAL_MONITORING_DIR/prometheus.yml" "$HETZNER_USER@$HETZNER_HOST:$HETZNER_DIR/backend/monitoring/"
scp "$LOCAL_MONITORING_DIR/prometheus_alerts.yml" "$HETZNER_USER@$HETZNER_HOST:$HETZNER_DIR/backend/monitoring/"

# Grafana
scp -r "$LOCAL_MONITORING_DIR/grafana/dashboards" "$HETZNER_USER@$HETZNER_HOST:$HETZNER_DIR/backend/monitoring/grafana/"
scp -r "$LOCAL_MONITORING_DIR/grafana/datasources" "$HETZNER_USER@$HETZNER_HOST:$HETZNER_DIR/backend/monitoring/grafana/"

info "✅ Fichiers copiés"

# Vérifier si Docker Compose est disponible
info "Vérification de Docker Compose..."
if ! ssh "$HETZNER_USER@$HETZNER_HOST" "command -v docker-compose > /dev/null 2>&1 || command -v docker > /dev/null 2>&1"; then
    error "Docker Compose n'est pas installé sur le serveur"
fi

# Vérifier si le fichier docker-compose existe
info "Vérification de docker-compose.cloud.yml..."
if ! ssh "$HETZNER_USER@$HETZNER_HOST" "test -f $HETZNER_DIR/backend/docker-compose.cloud.yml"; then
    warn "docker-compose.cloud.yml n'existe pas, copie depuis local..."
    scp "backend/docker-compose.cloud.yml" "$HETZNER_USER@$HETZNER_HOST:$HETZNER_DIR/backend/"
fi

# Demander la variable SLACK_WEBHOOK_URL
echo ""
warn "⚠️  Configuration de SLACK_WEBHOOK_URL requise"
read -p "Entrez l'URL du webhook Slack (ou appuyez sur Entrée pour ignorer): " SLACK_WEBHOOK_URL

if [ -n "$SLACK_WEBHOOK_URL" ]; then
    info "Configuration de la variable d'environnement SLACK_WEBHOOK_URL..."
    ssh "$HETZNER_USER@$HETZNER_HOST" << EOF
        echo "SLACK_WEBHOOK_URL=$SLACK_WEBHOOK_URL" >> $HETZNER_DIR/backend/.env
        echo "✅ Variable d'environnement ajoutée"
EOF
else
    warn "SLACK_WEBHOOK_URL non configuré. Vous devrez le configurer manuellement."
fi

# Redémarrer les services
info "Redémarrage des services de monitoring..."
ssh "$HETZNER_USER@$HETZNER_HOST" << 'EOF'
    cd /opt/yukpo/backend
    
    # Vérifier si les conteneurs existent
    if docker ps -a | grep -q "prometheus\|alertmanager\|grafana"; then
        echo "🔄 Redémarrage des conteneurs existants..."
        
        # Arrêter les conteneurs
        docker-compose -f docker-compose.cloud.yml stop prometheus alertmanager grafana 2>/dev/null || true
        
        # Redémarrer les conteneurs
        docker-compose -f docker-compose.cloud.yml up -d prometheus alertmanager grafana
        
        echo "✅ Services redémarrés"
    else
        echo "⚠️  Les conteneurs n'existent pas encore. Lancez:"
        echo "   cd /opt/yukpo/backend"
        echo "   docker-compose -f docker-compose.cloud.yml up -d prometheus alertmanager grafana"
    fi
EOF

# Vérifier le statut
info "Vérification du statut des services..."
ssh "$HETZNER_USER@$HETZNER_HOST" << 'EOF'
    echo ""
    echo "📊 Statut des conteneurs:"
    docker ps --filter "name=prometheus\|alertmanager\|grafana" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
    
    echo ""
    echo "🔍 Vérification des logs (dernières 10 lignes):"
    echo "--- Prometheus ---"
    docker logs prometheus 2>&1 | tail -5 || echo "Conteneur non trouvé"
    echo ""
    echo "--- AlertManager ---"
    docker logs alertmanager 2>&1 | tail -5 || echo "Conteneur non trouvé"
    echo ""
    echo "--- Grafana ---"
    docker logs grafana 2>&1 | tail -5 || echo "Conteneur non trouvé"
EOF

echo ""
info "✅ Déploiement terminé!"
echo ""
echo "📋 URLs d'accès:"
echo "   Prometheus:  http://$HETZNER_HOST:9090"
echo "   AlertManager: http://$HETZNER_HOST:9093"
echo "   Grafana:     http://$HETZNER_HOST:3000 (admin/admin)"
echo ""
echo "🔍 Pour vérifier que tout fonctionne:"
echo "   1. Accéder à Prometheus: http://$HETZNER_HOST:9090/targets"
echo "   2. Vérifier que 'yukpo-backend' est UP"
echo "   3. Accéder à Grafana et vérifier le dashboard 'Métriques UX'"
echo "   4. Tester une alerte pour vérifier Slack"
echo ""

