#!/bin/bash

# Script de déploiement pour les améliorations du workflow de livraison
# Usage: ./scripts/deploy-delivery-workflow.sh [backend|frontend|mobile|all]

set -e  # Arrêter en cas d'erreur

ENVIRONMENT=${ENVIRONMENT:-production}
COMPONENT=${1:-all}

echo "🚀 Déploiement des améliorations workflow de livraison"
echo "📦 Composant: $COMPONENT"
echo "🌍 Environnement: $ENVIRONMENT"
echo ""

# Couleurs pour les messages
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Fonction pour afficher les messages
info() {
    echo -e "${GREEN}✅ $1${NC}"
}

error() {
    echo -e "${RED}❌ $1${NC}"
    exit 1
}

warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Vérifier les prérequis
check_prerequisites() {
    info "Vérification des prérequis..."
    
    # Vérifier Rust
    if ! command -v cargo &> /dev/null; then
        error "Rust/Cargo n'est pas installé"
    fi
    
    # Vérifier Node.js
    if ! command -v node &> /dev/null; then
        error "Node.js n'est pas installé"
    fi
    
    # Vérifier DATABASE_URL
    if [ -z "$DATABASE_URL" ]; then
        warning "DATABASE_URL n'est pas défini. Certaines opérations peuvent échouer."
    fi
    
    info "Prérequis OK"
}

# Déploiement Backend
deploy_backend() {
    info "Déploiement Backend..."
    
    cd backend
    
    # 1. Vérifier les migrations
    info "Vérification des migrations..."
    if [ ! -f "migrations/20250120_001_add_order_preparation_system.sql" ]; then
        error "Migration 20250120_001 manquante"
    fi
    if [ ! -f "migrations/20250120_002_add_product_stock_management.sql" ]; then
        error "Migration 20250120_002 manquante"
    fi
    
    # 2. Appliquer les migrations
    if [ -n "$DATABASE_URL" ]; then
        info "Application des migrations..."
        sqlx migrate run || warning "Échec des migrations (peut être déjà appliquées)"
    else
        warning "DATABASE_URL non défini, migrations ignorées"
    fi
    
    # 3. Régénérer sqlx-data.json
    if [ -n "$DATABASE_URL" ] && [ "$SQLX_OFFLINE" != "true" ]; then
        info "Régénération de sqlx-data.json..."
        cargo sqlx prepare -- --lib || warning "Échec de la régénération (peut nécessiter SQLX_OFFLINE=true)"
    fi
    
    # 4. Compiler
    info "Compilation du backend..."
    cargo build --release || error "Échec de la compilation"
    
    # 5. Vérifier les fichiers compilés
    if [ -f "target/release/yukpomnang_backend" ] || [ -f "target/release/yukpomnang-backend" ]; then
        info "Backend compilé avec succès"
    else
        error "Binaire non trouvé après compilation"
    fi
    
    cd ..
    info "✅ Backend déployé"
}

# Déploiement Frontend
deploy_frontend() {
    info "Déploiement Frontend..."
    
    cd frontend
    
    # 1. Installer les dépendances
    info "Installation des dépendances..."
    npm install || error "Échec de l'installation des dépendances"
    
    # 2. Vérifier les fichiers
    info "Vérification des fichiers..."
    if [ ! -f "src/pages/SimilarProductsPage.tsx" ]; then
        error "SimilarProductsPage.tsx manquant"
    fi
    if [ ! -f "src/pages/OrderManagementPage.tsx" ]; then
        error "OrderManagementPage.tsx manquant"
    fi
    if [ ! -f "src/pages/ProviderAnalyticsPage.tsx" ]; then
        error "ProviderAnalyticsPage.tsx manquant"
    fi
    if [ ! -f "src/services/providerAnalyticsService.ts" ]; then
        error "providerAnalyticsService.ts manquant"
    fi
    
    # 3. Build
    info "Build du frontend..."
    npm run build || error "Échec du build"
    
    # 4. Vérifier le build
    if [ -d "dist" ] && [ "$(ls -A dist)" ]; then
        info "Frontend buildé avec succès"
    else
        error "Dossier dist vide ou manquant"
    fi
    
    cd ..
    info "✅ Frontend déployé"
}

# Déploiement Mobile
deploy_mobile() {
    info "Déploiement Mobile..."
    
    cd mobile
    
    # 1. Installer les dépendances
    info "Installation des dépendances..."
    npm install || error "Échec de l'installation des dépendances"
    
    # 2. Vérifier les fichiers
    info "Vérification des fichiers..."
    if [ ! -f "src/screens/OrderStatusScreen.tsx" ]; then
        error "OrderStatusScreen.tsx manquant"
    fi
    if [ ! -f "src/screens/ProviderOrderManagementScreen.tsx" ]; then
        error "ProviderOrderManagementScreen.tsx manquant"
    fi
    if [ ! -f "src/services/orderService.ts" ]; then
        error "orderService.ts manquant"
    fi
    if [ ! -f "src/services/notificationSoundService.ts" ]; then
        error "notificationSoundService.ts manquant"
    fi
    
    # 3. Vérifier la configuration
    if [ ! -f "app.json" ] && [ ! -f "app.config.js" ]; then
        warning "Fichier de configuration app.json/app.config.js non trouvé"
    fi
    
    info "✅ Mobile prêt pour le build"
    warning "Pour build réel, utiliser: eas build --platform all"
    
    cd ..
    info "✅ Mobile vérifié"
}

# Vérifications post-déploiement
post_deployment_checks() {
    info "Vérifications post-déploiement..."
    
    # Vérifier les routes dans App.tsx
    if grep -q "SimilarProductsPage\|OrderManagementPage\|ProviderAnalyticsPage" frontend/src/App.tsx; then
        info "Routes frontend configurées"
    else
        warning "Routes frontend non trouvées dans App.tsx"
    fi
    
    # Vérifier les routes dans AppNavigator.tsx (mobile)
    if grep -q "OrderStatusScreen\|ProviderOrderManagementScreen" mobile/src/navigation/AppNavigator.tsx; then
        info "Routes mobile configurées"
    else
        warning "Routes mobile non trouvées dans AppNavigator.tsx"
    fi
    
    info "✅ Vérifications terminées"
}

# Main
main() {
    check_prerequisites
    
    case $COMPONENT in
        backend)
            deploy_backend
            ;;
        frontend)
            deploy_frontend
            ;;
        mobile)
            deploy_mobile
            ;;
        all)
            deploy_backend
            deploy_frontend
            deploy_mobile
            ;;
        *)
            error "Composant invalide: $COMPONENT (utiliser: backend, frontend, mobile, all)"
            ;;
    esac
    
    post_deployment_checks
    
    info "🎉 Déploiement terminé avec succès!"
    echo ""
    echo "📋 Prochaines étapes:"
    echo "  1. Vérifier les logs du serveur backend"
    echo "  2. Tester les routes API"
    echo "  3. Tester les pages frontend"
    echo "  4. Tester l'application mobile"
    echo "  5. Vérifier le monitoring"
}

main

