#!/bin/bash
# Script de diagnostic complet pour le cache SQLx sur Ubuntu

echo "=== Diagnostic SQLx complet ==="

cd "$(dirname "$0")"

# 1. Vérifier DATABASE_URL
echo "1. Vérification de DATABASE_URL..."
if [ -z "$DATABASE_URL" ]; then
    echo "❌ DATABASE_URL n'est pas définie"
    echo "Export: export DATABASE_URL=\"postgresql://user:password@host:port/database\""
    exit 1
else
    echo "✅ DATABASE_URL définie"
fi

# 2. Compter les requêtes SQLx dans le code
echo "2. Comptage des requêtes SQLx..."
SQL_QUERY_COUNT=$(grep -r -E "sqlx::query!|sqlx::query_scalar!|sqlx::query_as!" src 2>/dev/null | wc -l || echo 0)
echo "   Requêtes trouvées: $SQL_QUERY_COUNT"

# 3. Vérifier le cache existant
echo "3. Vérification du cache .sqlx..."
if [ -d ".sqlx" ]; then
    CACHE_COUNT=$(find .sqlx -type f 2>/dev/null | wc -l || echo 0)
    echo "   Fichiers dans le cache: $CACHE_COUNT"
    
    if [ $CACHE_COUNT -eq 0 ]; then
        echo "   ⚠️ Cache vide!"
    else
        echo "   ✅ Cache présent"
    fi
else
    echo "   ❌ Répertoire .sqlx non trouvé"
    CACHE_COUNT=0
fi

# 4. Analyser le gap
GAP=$((SQL_QUERY_COUNT - CACHE_COUNT))
echo "4. Analyse du gap: $GAP requêtes sans métadonnées"

if [ $GAP -gt 100 ]; then
    echo "   ❌ Gap trop important! Le cache est probablement incomplet."
    echo "   Action recommandée: Régénérer le cache"
elif [ $GAP -gt 0 ]; then
    echo "   ⚠️ Gap modéré (normal dû à la déduplication SQLx)"
else
    echo "   ✅ Pas de gap significatif"
fi

# 5. Tester la compilation offline
echo "5. Test de compilation en mode offline..."
export SQLX_OFFLINE=true
cargo check --lib --message-format=short 2>&1 | grep -E "error|SQLX_OFFLINE" | head -10

if [ ${PIPESTATUS[0]} -eq 0 ]; then
    echo "   ✅ Compilation réussie en mode offline"
else
    echo "   ❌ Erreurs de compilation en mode offline"
    echo "   Action recommandée: Régénérer le cache avec 'cargo sqlx prepare --workspace'"
fi

echo "=== Fin du diagnostic ==="


