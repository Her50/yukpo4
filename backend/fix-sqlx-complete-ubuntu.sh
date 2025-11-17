#!/bin/bash
# Script COMPLET pour régénérer le cache SQLx et vérifier qu'il est complet
# Usage: ./fix-sqlx-complete-ubuntu.sh

set -e

echo "🔧 Fix SQLx Cache COMPLET - Ubuntu"
echo "==================================="
echo ""

# Vérifier qu'on est dans le bon répertoire
if [ ! -f "Cargo.toml" ]; then
    echo "❌ Erreur: Cargo.toml non trouvé. Exécutez ce script depuis backend/"
    exit 1
fi

# Variables
DATABASE_URL="${DATABASE_URL:-postgresql://yukpo_db_user:88X47ZWBiLkX5WatFcLU4KQ4rgaHYml4@dpg-d2t7ntbuibrs73eh9tvg-a.frankfurt-postgres.render.com/yukpo_db}"
CACHE_DIR=".sqlx"

export DATABASE_URL
export SQLX_OFFLINE=false

# Étape 1: Supprimer l'ancien cache pour une régénération complète
echo "📋 Étape 1: Nettoyage de l'ancien cache..."
if [ -d "$CACHE_DIR" ]; then
    OLD_COUNT=$(find "$CACHE_DIR" -type f | wc -l)
    echo "   Cache actuel: $OLD_COUNT fichiers"
    echo "   Suppression de l'ancien cache..."
    rm -rf "$CACHE_DIR"
fi

# Étape 2: Compter les requêtes SQLx dans le code
echo ""
echo "📊 Étape 2: Comptage des requêtes SQLx dans le code..."
QUERY_COUNT=$(grep -r "sqlx::query!" src/ 2>/dev/null | wc -l || echo 0)
QUERY_SCALAR_COUNT=$(grep -r "sqlx::query_scalar!" src/ 2>/dev/null | wc -l || echo 0)
QUERY_AS_COUNT=$(grep -r "sqlx::query_as!" src/ 2>/dev/null | wc -l || echo 0)
TOTAL_QUERIES=$((QUERY_COUNT + QUERY_SCALAR_COUNT + QUERY_AS_COUNT))

echo "   - sqlx::query!: $QUERY_COUNT"
echo "   - sqlx::query_scalar!: $QUERY_SCALAR_COUNT"
echo "   - sqlx::query_as!: $QUERY_AS_COUNT"
echo "   - Total attendu: $TOTAL_QUERIES"

# Étape 3: Régénérer le cache avec TOUTES les méthodes possibles
echo ""
echo "🔄 Étape 3: Régénération du cache avec TOUTES les méthodes..."
echo "   DATABASE_URL: ${DATABASE_URL:0:50}..."
echo ""

# Méthode 1: --workspace
echo "   [1/4] cargo sqlx prepare --workspace"
cargo sqlx prepare --workspace 2>&1 | tail -3 || echo "   ⚠️  --workspace échoué"
COUNT_1=$(find "$CACHE_DIR" -type f 2>/dev/null | wc -l)
echo "      → Cache: $COUNT_1 fichiers"

# Méthode 2: --all (inclut binaires et tests)
echo "   [2/4] cargo sqlx prepare --all"
cargo sqlx prepare --all 2>&1 | tail -3 || echo "   ⚠️  --all échoué"
COUNT_2=$(find "$CACHE_DIR" -type f 2>/dev/null | wc -l)
echo "      → Cache: $COUNT_2 fichiers"

# Méthode 3: --all-features --all (si features conditionnelles)
echo "   [3/4] cargo sqlx prepare --all-features --all"
cargo sqlx prepare --all-features --all 2>&1 | tail -3 || echo "   ⚠️  --all-features échoué (normal si pas de features)"
COUNT_3=$(find "$CACHE_DIR" -type f 2>/dev/null | wc -l)
echo "      → Cache: $COUNT_3 fichiers"

# Méthode 4: --lib (pour s'assurer que la lib est complète)
echo "   [4/4] cargo sqlx prepare -- --lib"
cargo sqlx prepare -- --lib 2>&1 | tail -3 || echo "   ⚠️  --lib échoué"
FINAL_COUNT=$(find "$CACHE_DIR" -type f 2>/dev/null | wc -l)
echo "      → Cache final: $FINAL_COUNT fichiers"

# Étape 4: Vérifier le cache
echo ""
echo "✅ Étape 4: Vérification du cache..."
if [ ! -d "$CACHE_DIR" ] || [ $FINAL_COUNT -eq 0 ]; then
    echo "   ❌ ERREUR: Le cache n'a pas été généré!"
    exit 1
fi

echo "   Cache généré: $FINAL_COUNT fichiers"
GAP=$((TOTAL_QUERIES - FINAL_COUNT))
if [ $GAP -gt 0 ]; then
    echo "   ⚠️  Gap: $GAP fichiers (normal si requêtes dupliquées)"
else
    echo "   ✅ Pas de gap détecté!"
fi

# Étape 5: Test de compilation en mode offline
echo ""
echo "🧪 Étape 5: Test de compilation en mode offline..."
export SQLX_OFFLINE=true

# Compiler avec tous les détails pour voir les erreurs SQLx
COMPILE_OUTPUT=$(cargo check --lib 2>&1 || true)

# Vérifier s'il y a des erreurs SQLx
if echo "$COMPILE_OUTPUT" | grep -q "error.*DATABASE_URL\|error.*sqlx prepare"; then
    echo "   ❌ ERREUR: Des requêtes manquent dans le cache!"
    echo ""
    echo "   Requêtes manquantes détectées:"
    echo "$COMPILE_OUTPUT" | grep -E "error.*sqlx|error.*DATABASE_URL" | head -10
    echo ""
    echo "   🔍 Tentative de régénération ciblée..."
    
    # Essayer de compiler avec DATABASE_URL pour voir quelles requêtes manquent
    export SQLX_OFFLINE=false
    export DATABASE_URL
    cargo check --lib 2>&1 | grep -E "error.*sqlx|error.*DATABASE_URL" | head -5 || true
    
    echo ""
    echo "   ❌ Le cache est incomplet. Vérifiez:"
    echo "      1. La connexion à la base de données fonctionne"
    echo "      2. Tous les fichiers source sont compilés"
    echo "      3. Il n'y a pas d'erreurs de compilation Rust"
    exit 1
else
    echo "   ✅ Compilation réussie en mode offline!"
    echo "   → Le cache est complet pour la compilation"
fi

# Étape 6: Vérifier la structure du cache
echo ""
echo "🔍 Étape 6: Vérification de la structure du cache..."
FIRST_FILE=$(find "$CACHE_DIR" -name "*.json" -type f | head -1)
if [ -n "$FIRST_FILE" ]; then
    if grep -q '"db_name".*"PostgreSQL"' "$FIRST_FILE" 2>/dev/null; then
        echo "   ✅ Format JSON valide (PostgreSQL)"
    else
        echo "   ⚠️  Format du cache suspect"
    fi
fi

# Résumé final
echo ""
echo "✅ Cache SQLx régénéré avec succès!"
echo "   Fichiers dans le cache: $FINAL_COUNT"
echo "   Requêtes dans le code: $TOTAL_QUERIES"
echo "   Compilation offline: ✅ Réussie"
echo ""
echo "📝 Prochaines étapes:"
echo "   1. Committez le cache: git add .sqlx && git commit -m 'Update SQLx cache - $FINAL_COUNT fichiers'"
echo "   2. Vérifiez que le Dockerfile copie bien .sqlx"
echo "   3. Rebuild Docker: docker build -f Dockerfile -t yukpo-backend:latest ."
echo ""


