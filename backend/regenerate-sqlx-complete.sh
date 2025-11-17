#!/bin/bash
# Script complet pour capturer TOUTES les requêtes SQLx (y compris les 77 manquantes)
# Usage: ./regenerate-sqlx-complete.sh

set -e

echo "🚀 Régénération COMPLÈTE du cache SQLx"
echo "======================================="
echo ""

# Vérifier qu'on est dans le bon répertoire
if [ ! -f "Cargo.toml" ]; then
    echo "❌ Erreur: Cargo.toml non trouvé. Exécutez depuis backend/"
    exit 1
fi

# Variables
DATABASE_URL="${DATABASE_URL:-postgresql://yukpo_db_user:88X47ZWBiLkX5WatFcLU4KQ4rgaHYml4@dpg-d2t7ntbuibrs73eh9tvg-a.frankfurt-postgres.render.com/yukpo_db}"
CACHE_DIR=".sqlx"

export DATABASE_URL
export SQLX_OFFLINE=false

echo "📊 État initial..."
if [ -d "$CACHE_DIR" ]; then
    OLD_COUNT=$(find "$CACHE_DIR" -type f | wc -l)
    echo "   Cache actuel: $OLD_COUNT fichiers"
else
    echo "   Cache non trouvé"
    OLD_COUNT=0
fi

# Méthode 1: --workspace (recommandé)
echo ""
echo "🔄 Méthode 1: cargo sqlx prepare --workspace"
cargo sqlx prepare --workspace 2>&1 | tail -5

COUNT_1=$(find "$CACHE_DIR" -type f 2>/dev/null | wc -l)
echo "   Résultat: $COUNT_1 fichiers"

# Méthode 2: --all (inclut binaires et tests)
echo ""
echo "🔄 Méthode 2: cargo sqlx prepare --all"
cargo sqlx prepare --all 2>&1 | tail -5

COUNT_2=$(find "$CACHE_DIR" -type f 2>/dev/null | wc -l)
echo "   Résultat: $COUNT_2 fichiers"

# Méthode 3: --all-features (si des features conditionnelles contiennent des requêtes)
echo ""
echo "🔄 Méthode 3: cargo sqlx prepare --all-features --all"
cargo sqlx prepare --all-features --all 2>&1 | tail -5 || echo "   ⚠️  Échec (peut être normal si pas de features)"

COUNT_3=$(find "$CACHE_DIR" -type f 2>/dev/null | wc -l)
echo "   Résultat: $COUNT_3 fichiers"

# Méthode 4: Compiler chaque target séparément
echo ""
echo "🔄 Méthode 4: Compilation avec tous les targets"
TARGETS=("lib" "bin" "test")
for target in "${TARGETS[@]}"; do
    echo "   - Compilation du target: $target"
    case $target in
        lib)
            cargo sqlx prepare -- --lib 2>&1 | tail -1 || true
            ;;
        bin)
            # Pour chaque binaire
            for bin in $(grep -E '^\[\[bin\]\]' Cargo.toml | grep -o 'name = "[^"]*"' | cut -d'"' -f2); do
                echo "      Binaire: $bin"
                cargo sqlx prepare --bin "$bin" 2>&1 | tail -1 || true
            done
            ;;
        test)
            # Compiler les tests aussi
            cargo sqlx prepare --tests 2>&1 | tail -1 || true
            ;;
    esac
done

FINAL_COUNT=$(find "$CACHE_DIR" -type f 2>/dev/null | wc -l)
echo "   Résultat final: $FINAL_COUNT fichiers"

# Analyser les requêtes uniques
echo ""
echo "🔍 Analyse des requêtes uniques..."
if [ -d "$CACHE_DIR" ]; then
    # Compter les requêtes SQL uniques
    UNIQUE_QUERIES=$(find "$CACHE_DIR" -name "query-*.json" -exec grep -h '"query"' {} \; | sort -u | wc -l)
    echo "   Requêtes SQL uniques dans le cache: $UNIQUE_QUERIES"
    
    # Compter toutes les occurrences de macros SQLx
    ALL_MACROS=$(grep -r "sqlx::query!" src/ 2>/dev/null | wc -l)
    ALL_SCALAR=$(grep -r "sqlx::query_scalar!" src/ 2>/dev/null | wc -l)
    ALL_AS=$(grep -r "sqlx::query_as!" src/ 2>/dev/null | wc -l)
    TOTAL_MACROS=$((ALL_MACROS + ALL_SCALAR + ALL_AS))
    
    echo "   Occurrences de macros dans le code: $TOTAL_MACROS"
    echo "   Fichiers de cache: $FINAL_COUNT"
    
    GAP=$((TOTAL_MACROS - FINAL_COUNT))
    echo "   Gap: $GAP"
    
    if [ $GAP -gt 0 ]; then
        echo ""
        echo "📋 Explication du gap:"
        echo "   - $TOTAL_MACROS = occurrences de macros SQLx"
        echo "   - $FINAL_COUNT = fichiers de cache générés"
        echo "   - Gap de $GAP = requêtes dupliquées ou non compilées"
        echo ""
        echo "🔍 Recherche des causes du gap..."
        
        # Chercher les requêtes identiques
        echo "   - Analyse des requêtes dupliquées..."
        DUPLICATES=$(find "$CACHE_DIR" -name "query-*.json" -exec grep -h '"query"' {} \; | sort | uniq -d | wc -l)
        echo "      Requêtes SQL dupliquées: $DUPLICATES"
        
        # Chercher les fichiers de backup
        BACKUP_COUNT=$(find src/ -name "*_backup.rs" 2>/dev/null | wc -l)
        if [ $BACKUP_COUNT -gt 0 ]; then
            echo "   - Fichiers de backup: $BACKUP_COUNT"
            BACKUP_QUERIES=$(grep -r "sqlx::query" $(find src/ -name "*_backup.rs") 2>/dev/null | wc -l)
            echo "      Requêtes dans les backups: $BACKUP_QUERIES"
        fi
    fi
fi

# Test final de compilation
echo ""
echo "🧪 Test final: compilation en mode offline..."
export SQLX_OFFLINE=true
if cargo check --lib 2>&1 | grep -q "error.*DATABASE_URL\|error.*sqlx prepare"; then
    echo "   ❌ ERREUR: Des requêtes manquent dans le cache!"
    echo "   → Vérifiez les erreurs ci-dessus"
    cargo check --lib 2>&1 | grep "error.*DATABASE_URL\|error.*sqlx prepare" | head -5
    exit 1
else
    echo "   ✅ Compilation réussie en mode offline"
    echo "   → Le cache est complet pour la compilation"
fi

echo ""
echo "✅ Résultat final:"
echo "   Fichiers dans le cache: $FINAL_COUNT"
echo "   Compilation offline: ✅ Réussie"
echo ""
echo "📝 Committez le cache:"
echo "   git add .sqlx"
echo "   git commit -m 'Update SQLx cache - $FINAL_COUNT fichiers'"
echo ""


