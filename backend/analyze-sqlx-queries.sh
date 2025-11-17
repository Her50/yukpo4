#!/bin/bash
# Script pour analyser les requêtes SQLx et identifier les doublons
# Usage: ./analyze-sqlx-queries.sh

set -e

echo "🔍 Analyse des requêtes SQLx"
echo "============================"
echo ""

cd "$(dirname "$0")"

# 1. Compter les requêtes par type
echo "1️⃣  Comptage des requêtes SQLx..."
QUERY_COUNT=$(grep -r "sqlx::query!" src/ 2>/dev/null | wc -l || echo 0)
QUERY_SCALAR_COUNT=$(grep -r "sqlx::query_scalar!" src/ 2>/dev/null | wc -l || echo 0)
QUERY_AS_COUNT=$(grep -r "sqlx::query_as!" src/ 2>/dev/null | wc -l || echo 0)
TOTAL=$((QUERY_COUNT + QUERY_SCALAR_COUNT + QUERY_AS_COUNT))

echo "   - sqlx::query!: $QUERY_COUNT"
echo "   - sqlx::query_scalar!: $QUERY_SCALAR_COUNT"
echo "   - sqlx::query_as!: $QUERY_AS_COUNT"
echo "   - Total: $TOTAL"
echo ""

# 2. Extraire toutes les requêtes SQL avec leur emplacement
echo "2️⃣  Extraction des requêtes SQL..."
TEMP_FILE=$(mktemp)
trap "rm -f $TEMP_FILE" EXIT

# Extraire les requêtes SQL avec leur contexte
grep -rn "sqlx::query!" src/ 2>/dev/null | while IFS=: read -r file line rest; do
    # Extraire la requête SQL de la ligne suivante
    sql=$(sed -n "${line}p" "$file" 2>/dev/null | sed 's/.*sqlx::query!//' | sed "s/['\"].*//" || echo "")
    if [ -n "$sql" ]; then
        echo "$file:$line|$sql" >> "$TEMP_FILE"
    fi
done

# 3. Identifier les requêtes SQL similaires/dupliquées
echo "3️⃣  Identification des requêtes dupliquées..."
echo ""

# Grouper par requête SQL simplifiée (sans espaces multiples, sans commentaires)
DUPLICATES=$(sort "$TEMP_FILE" | cut -d'|' -f2 | tr -s ' ' | sort | uniq -d | wc -l || echo 0)

if [ "$DUPLICATES" -gt 0 ]; then
    echo "   ⚠️  $DUPLICATES requêtes SQL potentiellement dupliquées trouvées"
    echo ""
    echo "   Requêtes dupliquées (premiers exemples):"
    sort "$TEMP_FILE" | cut -d'|' -f2 | tr -s ' ' | sort | uniq -d | head -5
else
    echo "   ✅ Aucune requête SQL dupliquée évidente"
fi

echo ""

# 4. Vérifier le cache SQLx
echo "4️⃣  Vérification du cache SQLx..."
if [ -d ".sqlx" ]; then
    CACHE_COUNT=$(find .sqlx -type f -name "*.json" 2>/dev/null | wc -l || echo 0)
    echo "   ✅ Cache trouvé: $CACHE_COUNT fichiers JSON"
    
    GAP=$((TOTAL - CACHE_COUNT))
    if [ $GAP -gt 0 ]; then
        echo "   ⚠️  Gap: $GAP requêtes en plus dans le code"
        echo "   → Le cache est INCOMPLET!"
    elif [ $GAP -lt 0 ]; then
        echo "   ℹ️  Le cache contient plus de fichiers que de requêtes (normal: requêtes dupliquées)"
    else
        echo "   ✅ Cache complet (selon le comptage)"
    fi
else
    echo "   ❌ Cache non trouvé!"
    echo "   → Le cache n'existe pas!"
fi

echo ""

# 5. Vérifier si le cache est dans Git
echo "5️⃣  Vérification Git..."
if [ -d "../.git" ]; then
    GIT_FILES=$(git ls-files .sqlx 2>/dev/null | wc -l || echo 0)
    if [ $GIT_FILES -eq 0 ]; then
        echo "   ❌ Le cache .sqlx n'est PAS dans Git!"
        echo "   → Docker ne pourra pas le copier!"
        echo ""
        echo "   Solution:"
        echo "   git add .sqlx"
        echo "   git commit -m 'Add SQLx cache'"
    else
        echo "   ✅ Cache dans Git: $GIT_FILES fichiers"
    fi
else
    echo "   ⚠️  Pas un repo Git (ou parent directory)"
fi

echo ""
echo "✅ Analyse terminée"
echo ""
echo "💡 Recommandations:"
if [ "$DUPLICATES" -gt 0 ]; then
    echo "   - Factoriser les requêtes dupliquées pour améliorer la maintenabilité"
fi
if [ ! -d ".sqlx" ] || [ $GAP -gt 0 ]; then
    echo "   - Régénérer le cache SQLx: ./fix-sqlx-complete-ubuntu.sh"
fi
if [ -d "../.git" ] && [ "$GIT_FILES" -eq 0 ]; then
    echo "   - Ajouter le cache dans Git pour que Docker puisse le copier"
fi


