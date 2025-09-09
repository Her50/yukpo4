#!/bin/bash
# scripts/rollback_optimisations.sh
# Rollback d'urgence des optimisations IA

set -e

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

BACKUP_DIR=${1:-"latest"}
BACKEND_DIR="backend"

echo -e "${RED}🚨 ROLLBACK D'URGENCE - OPTIMISATIONS IA${NC}"
echo -e "${RED}======================================${NC}"

log() {
    echo -e "${GREEN}[$(date +'%H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%H:%M:%S')] ⚠️  $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%H:%M:%S')] ❌ $1${NC}"
}

# ÉTAPE 1: Arrêt d'urgence du serveur
log "ÉTAPE 1: Arrêt du serveur"
pkill -f yukpomnang_backend || true
sleep 2
log "✅ Serveur arrêté"

# ÉTAPE 2: Désactivation immédiate des optimisations
log "ÉTAPE 2: Désactivation des optimisations"
cd "$BACKEND_DIR"

if [ -f ".env" ]; then
    # Désactiver les optimisations
    sed -i 's/ENABLE_AI_OPTIMIZATIONS=true/ENABLE_AI_OPTIMIZATIONS=false/' .env
    export ENABLE_AI_OPTIMIZATIONS=false
    log "✅ Optimisations désactivées dans .env"
else
    error ".env non trouvé"
fi

# ÉTAPE 3: Restauration des backups si spécifié
if [ "$BACKUP_DIR" != "latest" ] && [ -d "../$BACKUP_DIR" ]; then
    log "ÉTAPE 3: Restauration des backups depuis $BACKUP_DIR"
    
    cp "../$BACKUP_DIR/.env.backup" ".env" 2>/dev/null && log "✅ .env restauré" || warn "Backup .env non trouvé"
    cp "../$BACKUP_DIR/Cargo.toml.backup" "Cargo.toml" 2>/dev/null && log "✅ Cargo.toml restauré" || warn "Backup Cargo.toml non trouvé"
    cp "../$BACKUP_DIR/state.rs.backup" "src/state.rs" 2>/dev/null && log "✅ state.rs restauré" || warn "Backup state.rs non trouvé"
else
    log "ÉTAPE 3: Pas de restauration de backup (mode désactivation simple)"
fi

# ÉTAPE 4: Compilation de sécurité
log "ÉTAPE 4: Compilation de sécurité"
export ENABLE_AI_OPTIMIZATIONS=false

if cargo build --release; then
    log "✅ Compilation de sécurité réussie"
else
    error "❌ Compilation de sécurité échouée"
    
    # Rollback plus agressif
    warn "Tentative de rollback agressif..."
    
    # Supprimer les nouveaux modules des imports
    if [ -f "src/services/mod.rs" ]; then
        sed -i '/semantic_cache_pro/d' src/services/mod.rs
        sed -i '/prompt_optimizer_pro/d' src/services/mod.rs
        sed -i '/orchestration_ia_optimized/d' src/services/mod.rs
        log "Modules d'optimisation supprimés"
    fi
    
    # Nouvelle tentative de compilation
    if cargo build --release; then
        log "✅ Compilation de rollback agressif réussie"
    else
        error "❌ Rollback agressif échoué - intervention manuelle requise"
        exit 1
    fi
fi

# ÉTAPE 5: Test de fonctionnement
log "ÉTAPE 5: Test de fonctionnement"

# Démarrer le serveur pour test
cargo run --release &
SERVER_PID=$!
sleep 5

# Test de santé
if curl -f http://localhost:3001/health > /dev/null 2>&1; then
    log "✅ Serveur fonctionnel après rollback"
    STATUS="SUCCESS"
else
    error "❌ Serveur non fonctionnel après rollback"
    STATUS="FAILED"
fi

# Arrêter le serveur de test
kill $SERVER_PID 2>/dev/null || true

cd ..

# ÉTAPE 6: Rapport de rollback
log "ÉTAPE 6: Génération du rapport"

REPORT_FILE="rollback_report_$(date +%Y%m%d_%H%M%S).txt"
cat > "$REPORT_FILE" << EOF
🚨 RAPPORT DE ROLLBACK OPTIMISATIONS IA YUKPO
============================================

Date: $(date)
Statut: $STATUS
Backup utilisé: $BACKUP_DIR

🔄 Actions effectuées:
- Arrêt du serveur Yukpo
- Désactivation ENABLE_AI_OPTIMIZATIONS=false
- Restauration des backups (si spécifié)
- Compilation de sécurité
- Test de fonctionnement

📊 Résultat:
- Optimisations: DÉSACTIVÉES
- Mode: Compatibilité (orchestration classique)
- Performance: Baseline (pré-optimisation)

🔧 État actuel:
- Cache sémantique: Inactif
- Optimiseur prompts: Inactif
- Orchestration: Classique

⚠️  Instructions:
1. Le système fonctionne en mode baseline
2. Les optimisations sont complètement désactivées
3. Performances revenues au niveau d'avant optimisation

🔄 Pour réactiver les optimisations:
1. Vérifier les logs d'erreur
2. Corriger les problèmes identifiés
3. Relancer ./scripts/deploy_optimisations_progressives.sh

✅ Rollback terminé
EOF

if [ "$STATUS" = "SUCCESS" ]; then
    echo ""
    echo -e "${GREEN}✅ ROLLBACK TERMINÉ AVEC SUCCÈS${NC}"
    echo -e "${BLUE}Votre application Yukpo fonctionne en mode baseline:${NC}"
    echo -e "${YELLOW}  • Optimisations: DÉSACTIVÉES${NC}"
    echo -e "${YELLOW}  • Performance: Niveau d'origine${NC}"
    echo -e "${YELLOW}  • Stabilité: Maximum${NC}"
    echo ""
    echo -e "${BLUE}Rapport: $REPORT_FILE${NC}"
    echo -e "${GREEN}🛡️  Système stable et opérationnel${NC}"
else
    echo ""
    echo -e "${RED}❌ ROLLBACK AVEC PROBLÈMES${NC}"
    echo -e "${RED}Intervention manuelle requise${NC}"
    echo -e "${YELLOW}Consultez le rapport: $REPORT_FILE${NC}"
    exit 1
fi 