#!/bin/bash
# Script de diagnostic SQLx pour Ubuntu
# Usage: ./diagnose-sqlx-ubuntu.sh

set -e

echo "🔍 DIAGNOSTIC SQLx - Ubuntu"
echo "============================"
echo ""

cd /opt/yukpo/backend || {
    echo "❌ Erreur: /opt/yukpo/backend n'existe pas"
    exit 1
}

# 1. Vérifier que le cache existe
echo "1️⃣  Vérification du cache SQLx..."
if [ -d ".sqlx" ]; then
    CACHE_COUNT=$(find .sqlx -type f | wc -l)
    echo "   ✅ Cache trouvé: $CACHE_COUNT fichiers"
    
    if [ $CACHE_COUNT -lt 200 ]; then
        echo "   ⚠️  ATTENTION: Cache semble incomplet (< 200 fichiers)"
    fi
else
    echo "   ❌ Cache non trouvé!"
    echo "   → Solution: Exécutez ./fix-sqlx-complete-ubuntu.sh"
    exit 1
fi

# 2. Compter les requêtes dans le code
echo ""
echo "2️⃣  Comptage des requêtes SQLx..."
QUERY_COUNT=$(grep -r "sqlx::query!" src/ 2>/dev/null | wc -l || echo 0)
QUERY_SCALAR_COUNT=$(grep -r "sqlx::query_scalar!" src/ 2>/dev/null | wc -l || echo 0)
QUERY_AS_COUNT=$(grep -r "sqlx::query_as!" src/ 2>/dev/null | wc -l || echo 0)
TOTAL=$((QUERY_COUNT + QUERY_SCALAR_COUNT + QUERY_AS_COUNT))

echo "   - sqlx::query!: $QUERY_COUNT"
echo "   - sqlx::query_scalar!: $QUERY_SCALAR_COUNT"
echo "   - sqlx::query_as!: $QUERY_AS_COUNT"
echo "   - Total: $TOTAL"

GAP=$((TOTAL - CACHE_COUNT))
echo "   - Gap: $GAP"

# 3. Test de compilation offline
echo ""
echo "3️⃣  Test de compilation en mode offline..."
export SQLX_OFFLINE=true
COMPILE_OUTPUT=$(cargo check --lib 2>&1 || true)

SQLX_ERRORS=$(echo "$COMPILE_OUTPUT" | grep -c "error.*DATABASE_URL\|error.*sqlx prepare" || echo 0)

if [ $SQLX_ERRORS -gt 0 ]; then
    echo "   ❌ ERREUR: $SQLX_ERRORS erreurs SQLx détectées!"
    echo ""
    echo "   Premières erreurs:"
    echo "$COMPILE_OUTPUT" | grep -E "error.*sqlx|error.*DATABASE_URL" | head -5
    echo ""
    echo "   → Solution: Exécutez ./fix-sqlx-complete-ubuntu.sh"
    exit 1
else
    echo "   ✅ Compilation réussie (0 erreur SQLx)"
fi

# 4. Vérifier que le cache est dans Git
echo ""
echo "4️⃣  Vérification Git..."
cd /opt/yukpo
GIT_FILES=$(git ls-files backend/.sqlx 2>/dev/null | wc -l || echo 0)

if [ $GIT_FILES -eq 0 ]; then
    echo "   ❌ ERREUR: Le cache n'est PAS dans Git!"
    echo "   → Docker ne pourra pas le copier"
    echo ""
    echo "   Solution:"
    echo "   git add backend/.sqlx"
    echo "   git commit -m 'Add SQLx cache'"
    exit 1
else
    echo "   ✅ Cache dans Git: $GIT_FILES fichiers"
fi

# 5. Vérifier .gitignore
echo ""
echo "5️⃣  Vérification .gitignore..."
if grep -q "^\.sqlx" .gitignore 2>/dev/null; then
    echo "   ❌ ERREUR: .sqlx est dans .gitignore!"
    echo "   → Retirez-le de .gitignore"
    exit 1
else
    echo "   ✅ .sqlx n'est pas dans .gitignore"
fi

# 6. Vérifier le Dockerfile
echo ""
echo "6️⃣  Vérification Dockerfile..."
cd backend

# Vérifier COPY .sqlx
if grep -q "COPY .sqlx" Dockerfile; then
    echo "   ✅ Dockerfile copie .sqlx"
    
    # Vérifier l'ordre (doit être avant COPY src)
    SQLX_LINE=$(grep -n "COPY .sqlx" Dockerfile | cut -d: -f1)
    SRC_LINE=$(grep -n "COPY src" Dockerfile | cut -d: -f1)
    
    if [ "$SQLX_LINE" -lt "$SRC_LINE" ]; then
        echo "   ✅ .sqlx est copié AVANT src (ligne $SQLX_LINE < $SRC_LINE)"
    else
        echo "   ⚠️  ATTENTION: .sqlx devrait être copié AVANT src"
    fi
else
    echo "   ❌ ERREUR: Dockerfile ne copie pas .sqlx"
    exit 1
fi

# Vérifier SQLX_OFFLINE
if grep -q "ENV SQLX_OFFLINE=true" Dockerfile; then
    ENV_LINE=$(grep -n "ENV SQLX_OFFLINE=true" Dockerfile | cut -d: -f1)
    BUILD_LINE=$(grep -n "RUN cargo build" Dockerfile | cut -d: -f1)
    
    if [ "$ENV_LINE" -lt "$BUILD_LINE" ]; then
        echo "   ✅ SQLX_OFFLINE=true est défini AVANT le build (ligne $ENV_LINE < $BUILD_LINE)"
    else
        echo "   ⚠️  ATTENTION: SQLX_OFFLINE=true devrait être défini AVANT le build"
    fi
else
    echo "   ❌ ERREUR: Dockerfile ne définit pas SQLX_OFFLINE=true"
    exit 1
fi

# Résumé final
echo ""
echo "✅ DIAGNOSTIC TERMINÉ"
echo "====================="
echo "Cache SQLx: $CACHE_COUNT fichiers"
echo "Requêtes SQLx: $TOTAL"
echo "Compilation offline: ✅ OK"
echo "Cache dans Git: ✅ OK"
echo "Dockerfile: ✅ OK"
echo ""
echo "✅ Tous les prérequis sont remplis!"
echo "   → Vous pouvez maintenant builder Docker:"
echo "   docker build -f Dockerfile -t yukpo-backend:latest ."
echo ""


