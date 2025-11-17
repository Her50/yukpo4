#!/bin/bash
# Script pour régénérer le cache SQLx complet sur Ubuntu
# Usage: ./fix-sqlx-cache-ubuntu.sh

set -e

echo "🔧 Fix SQLx Cache - Ubuntu"
echo "=========================="
echo ""

# Vérifier qu'on est dans le bon répertoire
if [ ! -f "Cargo.toml" ]; then
    echo "❌ Erreur: Cargo.toml non trouvé. Exécutez ce script depuis le dossier backend/"
    exit 1
fi

# Variables
DATABASE_URL="${DATABASE_URL:-postgresql://yukpo_db_user:88X47ZWBiLkX5WatFcLU4KQ4rgaHYml4@dpg-d2t7ntbuibrs73eh9tvg-a.frankfurt-postgres.render.com/yukpo_db}"
CACHE_DIR=".sqlx"

echo "📊 État actuel du cache..."
if [ -d "$CACHE_DIR" ]; then
    CURRENT_COUNT=$(find "$CACHE_DIR" -type f | wc -l)
    echo "   Cache actuel: $CURRENT_COUNT fichiers"
else
    echo "   Cache non trouvé"
fi

# Compter les requêtes SQLx dans le code
echo ""
echo "📊 Comptage des requêtes SQLx dans le code..."
QUERY_COUNT=$(grep -r "sqlx::query!" src/ 2>/dev/null | wc -l)
QUERY_SCALAR_COUNT=$(grep -r "sqlx::query_scalar!" src/ 2>/dev/null | wc -l)
QUERY_AS_COUNT=$(grep -r "sqlx::query_as!" src/ 2>/dev/null | wc -l)
TOTAL_QUERIES=$((QUERY_COUNT + QUERY_SCALAR_COUNT + QUERY_AS_COUNT))

echo "   - sqlx::query!: $QUERY_COUNT"
echo "   - sqlx::query_scalar!: $QUERY_SCALAR_COUNT"
echo "   - sqlx::query_as!: $QUERY_AS_COUNT"
echo "   - Total: $TOTAL_QUERIES"

echo ""
echo "🔄 Régénération du cache SQLx avec TOUTES les options..."
echo "   DATABASE_URL: ${DATABASE_URL:0:50}..."

# Sauvegarder l'ancien cache si il existe
if [ -d "$CACHE_DIR" ]; then
    BACKUP_DIR="${CACHE_DIR}.backup.$(date +%Y%m%d_%H%M%S)"
    echo "   Sauvegarde de l'ancien cache dans: $BACKUP_DIR"
    cp -r "$CACHE_DIR" "$BACKUP_DIR"
fi

# Exporter les variables d'environnement
export DATABASE_URL
export SQLX_OFFLINE=false

# Régénérer le cache avec TOUTES les options possibles
echo ""
echo "📦 Génération du cache avec --workspace..."
cargo sqlx prepare --workspace || {
    echo "⚠️  --workspace échoué, essai avec --all..."
    cargo sqlx prepare --all || {
        echo "⚠️  --all échoué, essai avec --lib..."
        cargo sqlx prepare -- --lib
    }
}

# Vérifier le résultat
echo ""
echo "✅ Vérification du cache généré..."
if [ -d "$CACHE_DIR" ]; then
    NEW_COUNT=$(find "$CACHE_DIR" -type f | wc -l)
    echo "   Nouveau cache: $NEW_COUNT fichiers"
    
    GAP=$((TOTAL_QUERIES - NEW_COUNT))
    if [ $GAP -gt 0 ]; then
        echo "   ⚠️  Gap: $GAP fichiers"
        echo ""
        echo "🔍 Analyse du gap..."
        echo "   Le gap peut être dû à:"
        echo "   1. Requêtes dupliquées (même SQL = même hash)"
        echo "   2. Requêtes dans des fichiers non compilés (tests, backups)"
        echo "   3. Requêtes dans des features conditionnelles"
        
        # Chercher les fichiers de backup
        BACKUP_FILES=$(find src/ -name "*_backup.rs" 2>/dev/null | wc -l)
        if [ $BACKUP_FILES -gt 0 ]; then
            echo ""
            echo "   📁 Fichiers de backup trouvés: $BACKUP_FILES"
            echo "      Ces fichiers peuvent contenir des requêtes non compilées"
            find src/ -name "*_backup.rs" 2>/dev/null | head -5
        fi
    else
        echo "   ✅ Pas de gap détecté!"
    fi
else
    echo "   ❌ Le cache n'a pas été généré!"
    exit 1
fi

# Tester la compilation en mode offline
echo ""
echo "🧪 Test de compilation en mode offline..."
export SQLX_OFFLINE=true
if cargo check --lib 2>&1 | grep -q "error.*DATABASE_URL\|error.*sqlx prepare"; then
    echo "   ❌ Erreurs SQLx détectées lors de la compilation"
    echo "   → Le cache est incomplet"
    exit 1
else
    echo "   ✅ Compilation réussie en mode offline"
fi

echo ""
echo "✅ Cache SQLx régénéré avec succès!"
echo "   Fichiers: $NEW_COUNT"
echo ""
echo "📝 Prochaines étapes:"
echo "   1. Committez le cache: git add .sqlx && git commit -m 'Update SQLx cache'"
echo "   2. Rebuild Docker: docker build -f Dockerfile -t yukpo-backend:latest ."
echo ""


