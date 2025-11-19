# Script PowerShell de deploiement des metriques Grafana/Prometheus/AlertManager sur Hetzner
# Usage: .\scripts\deploy-hetzner-monitoring.ps1

$ErrorActionPreference = "Stop"

Write-Host "Deploiement des metriques sur Hetzner..." -ForegroundColor Green

# Configuration
$HETZNER_HOST = "46.224.14.85"
$HETZNER_USER = "root"
$HETZNER_DIR = "/opt/yukpo"
$LOCAL_MONITORING_DIR = "backend\monitoring"

# Verifier que les fichiers existent localement
Write-Host "`n[INFO] Verification des fichiers locaux..." -ForegroundColor Cyan

$requiredFiles = @(
    "$LOCAL_MONITORING_DIR\alertmanager.yml",
    "$LOCAL_MONITORING_DIR\prometheus_alerts.yml",
    "$LOCAL_MONITORING_DIR\prometheus.yml"
)

foreach ($file in $requiredFiles) {
    if (-not (Test-Path $file)) {
        Write-Host "[ERROR] Fichier $file introuvable" -ForegroundColor Red
        exit 1
    }
}

if (-not (Test-Path "$LOCAL_MONITORING_DIR\grafana")) {
    Write-Host "[ERROR] Repertoire $LOCAL_MONITORING_DIR\grafana introuvable" -ForegroundColor Red
    exit 1
}

Write-Host "[OK] Tous les fichiers sont presents" -ForegroundColor Green

# Verifier la connexion SSH
Write-Host "`n[INFO] Verification de la connexion SSH..." -ForegroundColor Cyan
try {
    $testConnection = ssh -o ConnectTimeout=5 "$HETZNER_USER@$HETZNER_HOST" "echo 'Connexion OK'" 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "Connexion echouee"
    }
    Write-Host "[OK] Connexion SSH etablie" -ForegroundColor Green
}
catch {
    Write-Host "[ERROR] Impossible de se connecter a $HETZNER_HOST" -ForegroundColor Red
    Write-Host "Assurez-vous que SSH est configure et que vous avez acces au serveur" -ForegroundColor Yellow
    exit 1
}

# Creer les repertoires sur Hetzner
Write-Host "`n[INFO] Creation des repertoires sur Hetzner..." -ForegroundColor Cyan
ssh "$HETZNER_USER@$HETZNER_HOST" @"
    mkdir -p /opt/yukpo/backend/monitoring/grafana/dashboards
    mkdir -p /opt/yukpo/backend/monitoring/grafana/datasources
    echo "Repertoires crees"
"@

# Copier les fichiers de configuration
Write-Host "`n[INFO] Copie des fichiers de configuration..." -ForegroundColor Cyan

# AlertManager
Write-Host "  - Copie alertmanager.yml..." -ForegroundColor Gray
scp "$LOCAL_MONITORING_DIR\alertmanager.yml" "${HETZNER_USER}@${HETZNER_HOST}:${HETZNER_DIR}/backend/monitoring/"

# Prometheus
Write-Host "  - Copie prometheus.yml..." -ForegroundColor Gray
scp "$LOCAL_MONITORING_DIR\prometheus.yml" "${HETZNER_USER}@${HETZNER_HOST}:${HETZNER_DIR}/backend/monitoring/"
Write-Host "  - Copie prometheus_alerts.yml..." -ForegroundColor Gray
scp "$LOCAL_MONITORING_DIR\prometheus_alerts.yml" "${HETZNER_USER}@${HETZNER_HOST}:${HETZNER_DIR}/backend/monitoring/"

# Grafana
Write-Host "  - Copie dashboards Grafana..." -ForegroundColor Gray
scp -r "$LOCAL_MONITORING_DIR\grafana\*" "${HETZNER_USER}@${HETZNER_HOST}:${HETZNER_DIR}/backend/monitoring/grafana/"

Write-Host "[OK] Fichiers copies" -ForegroundColor Green

# Verifier si Docker Compose est disponible
Write-Host "`n[INFO] Verification de Docker Compose..." -ForegroundColor Cyan
$dockerCheck = ssh "$HETZNER_USER@$HETZNER_HOST" "command -v docker-compose > /dev/null 2>&1 || command -v docker > /dev/null 2>&1; echo `$?"
if ($dockerCheck -ne "0") {
    Write-Host "[ERROR] Docker Compose n'est pas installe sur le serveur" -ForegroundColor Red
    exit 1
}

# Verifier si le fichier docker-compose existe
Write-Host "`n[INFO] Verification de docker-compose.cloud.yml..." -ForegroundColor Cyan
$composeExists = ssh "$HETZNER_USER@$HETZNER_HOST" "test -f $HETZNER_DIR/backend/docker-compose.cloud.yml; echo `$?"
if ($composeExists -ne "0") {
    Write-Host "[WARN] docker-compose.cloud.yml n'existe pas, copie depuis local..." -ForegroundColor Yellow
    scp "backend\docker-compose.cloud.yml" "${HETZNER_USER}@${HETZNER_HOST}:${HETZNER_DIR}/backend/"
}

# Demander la variable SLACK_WEBHOOK_URL
Write-Host "`n[WARN] Configuration de SLACK_WEBHOOK_URL requise" -ForegroundColor Yellow
$slackWebhook = Read-Host "Entrez l'URL du webhook Slack (ou appuyez sur Entree pour ignorer)"

if ($slackWebhook) {
    Write-Host "[INFO] Configuration de la variable d'environnement SLACK_WEBHOOK_URL..." -ForegroundColor Cyan
    ssh "$HETZNER_USER@$HETZNER_HOST" @"
        # Ajouter ou mettre a jour la variable dans .env
        if [ -f $HETZNER_DIR/backend/.env ]; then
            # Supprimer l'ancienne ligne si elle existe
            sed -i '/^SLACK_WEBHOOK_URL=/d' $HETZNER_DIR/backend/.env
        fi
        echo "SLACK_WEBHOOK_URL=$slackWebhook" >> $HETZNER_DIR/backend/.env
        echo "Variable d'environnement ajoutee"
"@
}
else {
    Write-Host "[WARN] SLACK_WEBHOOK_URL non configure. Vous devrez le configurer manuellement." -ForegroundColor Yellow
}

# Redemarrer les services
Write-Host "`n[INFO] Redemarrage des services de monitoring..." -ForegroundColor Cyan
ssh "$HETZNER_USER@$HETZNER_HOST" @"
    cd /opt/yukpo/backend
    
    # Verifier si les conteneurs existent
    if docker ps -a | grep -q 'prometheus\|alertmanager\|grafana'; then
        echo 'Redemarrage des conteneurs existants...'
        
        # Arreter les conteneurs
        docker-compose -f docker-compose.cloud.yml stop prometheus alertmanager grafana 2>/dev/null || true
        
        # Redemarrer les conteneurs
        docker-compose -f docker-compose.cloud.yml up -d prometheus alertmanager grafana
        
        echo 'Services redemarres'
    else
        echo 'Les conteneurs n existent pas encore. Lancez:'
        echo '   cd /opt/yukpo/backend'
        echo '   docker-compose -f docker-compose.cloud.yml up -d prometheus alertmanager grafana'
    fi
"@

# Verifier le statut
Write-Host "`n[INFO] Verification du statut des services..." -ForegroundColor Cyan
ssh "$HETZNER_USER@$HETZNER_HOST" @"
    echo ''
    echo 'Statut des conteneurs:'
    docker ps --filter 'name=prometheus|alertmanager|grafana' --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
    
    echo ''
    echo 'Verification des logs (dernieres 5 lignes):'
    echo '--- Prometheus ---'
    docker logs prometheus 2>&1 | tail -5 || echo 'Conteneur non trouve'
    echo ''
    echo '--- AlertManager ---'
    docker logs alertmanager 2>&1 | tail -5 || echo 'Conteneur non trouve'
    echo ''
    echo '--- Grafana ---'
    docker logs grafana 2>&1 | tail -5 || echo 'Conteneur non trouve'
"@

Write-Host "`n[OK] Deploiement termine!" -ForegroundColor Green
Write-Host ""
Write-Host "URLs d'acces:" -ForegroundColor Cyan
Write-Host "   Prometheus:  http://$HETZNER_HOST:9090"
Write-Host "   AlertManager: http://$HETZNER_HOST:9093"
Write-Host "   Grafana:     http://$HETZNER_HOST:3000 (admin/admin)"
Write-Host ""
Write-Host "Pour verifier que tout fonctionne:" -ForegroundColor Cyan
Write-Host "   1. Acceder a Prometheus: http://$HETZNER_HOST:9090/targets"
Write-Host "   2. Verifier que yukpo-backend est UP"
Write-Host "   3. Acceder a Grafana et verifier le dashboard Metriques UX"
Write-Host "   4. Tester une alerte pour verifier Slack"
Write-Host ""
