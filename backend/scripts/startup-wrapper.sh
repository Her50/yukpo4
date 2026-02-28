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

# ── Lancer Rust immédiatement ────────────────────────────────────────
# Rust bind port 8080 avec un health handler dès le démarrage,
# AVANT l'init DB/Redis/migrations. La startup probe est satisfaite immédiatement.
echo "🚀 [WRAPPER] exec /app/yukpomnang_backend"
exec /app/yukpomnang_backend 2>&1

