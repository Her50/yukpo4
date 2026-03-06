#!/bin/bash

# 🚀 Script de démarrage ULTRA-OPTIMISÉ pour Google Cloud Run
# Version minimale pour démarrage le plus rapide possible
set -e

echo "🚀 Démarrage Yukpomnang Backend - Cloud Run..."

# Variables d'environnement essentielles
export PORT=${PORT:-8080}
export HOST=${HOST:-0.0.0.0}
export RUST_LOG=${RUST_LOG:-info}

# Vérifier DATABASE_URL (peut être un env var ou un secret Cloud Run)
DB_URL=""
if [ -n "$DATABASE_URL" ]; then
  DB_URL="$DATABASE_URL"
elif [ -f "/secrets/database-url/DATABASE_URL" ]; then
  DB_URL=$(cat /secrets/database-url/DATABASE_URL)
elif [ -f "/secrets/database-url/value" ]; then
  DB_URL=$(cat /secrets/database-url/value)
fi

if [ -z "$DB_URL" ]; then
  echo "❌ ERREUR: DATABASE_URL non trouvé (ni env var ni secret)"
  exit 1
fi

export DATABASE_URL="$DB_URL"

# Vérifier l'exécutable
if [ ! -f "./yukpomnang_backend" ]; then
    echo "❌ ERREUR: Exécutable non trouvé!"
    exit 1
fi

chmod +x ./yukpomnang_backend

# Démarrer l'application Rust directement
# Le serveur minimal Rust démarre immédiatement (avant dotenv/logging)
echo "🚀 Lancement application Rust sur port $PORT..."
exec ./yukpomnang_backend

