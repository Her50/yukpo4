#!/bin/bash
# ✅ CORRIGÉ 2026-02-28: Wrapper Cloud Run ultra-simplifié
# Rust gère son propre health server minimal (bind port 8080 immédiatement)
# Plus besoin de Python. Le wrapper ne fait que préparer l'env et exec Rust.

set -o pipefail

echo "🚀 [WRAPPER] Démarrage wrapper Cloud Run..."

# ── Vérifier binaire ─────────────────────────────────────────────────
if [ ! -f /app/yukpomnang_backend ]; then
    echo "❌ [WRAPPER] /app/yukpomnang_backend n'existe pas!"
    ls -la /app/ | head -20
    exit 1
fi
if [ ! -x /app/yukpomnang_backend ]; then
    chmod +x /app/yukpomnang_backend 2>/dev/null || true
fi

# ── Nettoyer DATABASE_URL ────────────────────────────────────────────
if [ -n "$DATABASE_URL" ]; then
    DATABASE_URL=$(echo "$DATABASE_URL" | tr -d '\r\n')
    export DATABASE_URL
fi

echo "🔍 [WRAPPER] Env: DATABASE_URL=${DATABASE_URL:+OK(${#DATABASE_URL}c)} JWT=${JWT_SECRET:+OK} REDIS=${REDIS_URL:+OK}"
echo "🔍 [WRAPPER] Binaire: $(ls -lh /app/yukpomnang_backend 2>&1)"
echo "🔍 [WRAPPER] PORT=$PORT HOST=$HOST"

# ── Diagnostic libs ────────────────────────────────────────────────
echo "🔍 [WRAPPER] ldd (toutes les libs):"
ldd /app/yukpomnang_backend 2>&1 || true
echo "🔍 [WRAPPER] GLIBC: $(ldd --version 2>&1 | head -1 || true)"

# ── Pre-flight: vérifier que le binaire CHARGE correctement ────────
echo "🔍 [WRAPPER] Pre-flight: /app/yukpomnang_backend --version"
VERSION_OUTPUT=$(/app/yukpomnang_backend --version 2>&1)
VERSION_RC=$?
if [ $VERSION_RC -ne 0 ]; then
    echo "❌ [WRAPPER] ERREUR CRITIQUE: le binaire ne peut pas se charger (exit code $VERSION_RC)"
    echo "❌ [WRAPPER] Output: $VERSION_OUTPUT"
    echo "❌ [WRAPPER] Cela indique probablement une lib manquante ou incompatibilité GLIBC."
    echo "❌ [WRAPPER] file: $(file /app/yukpomnang_backend 2>&1)"
    exit 1
fi
echo "✅ [WRAPPER] Pre-flight OK: $VERSION_OUTPUT"

# ── Lancer Rust immédiatement ────────────────────────────────────────
# Rust bind port 8080 avec un health handler dès le démarrage,
# AVANT l'init DB/Redis/migrations. La startup probe est satisfaite immédiatement.
echo "🚀 [WRAPPER] exec /app/yukpomnang_backend"
exec /app/yukpomnang_backend 2>&1

