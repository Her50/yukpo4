#!/bin/bash

# 🚀 Script de démarrage ULTRA-OPTIMISÉ pour Google Cloud Run
# Version minimale pour démarrage le plus rapide possible
set -e

echo "🚀 Démarrage Yukpomnang Backend - Cloud Run..."

# Variables d'environnement essentielles
export PORT=${PORT:-8080}
export HOST=${HOST:-0.0.0.0}
export RUST_LOG=${RUST_LOG:-info}

# Vérifier DATABASE_URL (critique)
if [ -z "$DATABASE_URL" ]; then
    echo "❌ ERREUR: DATABASE_URL non définie"
    exit 1
fi

# Vérifier l'exécutable
if [ ! -f "./yukpomnang_backend" ]; then
    echo "❌ ERREUR: Exécutable non trouvé!"
    exit 1
fi

chmod +x ./yukpomnang_backend

# Démarrer l'application Rust (le serveur minimal est géré dans Rust)
echo "🚀 Lancement application Rust sur port $PORT..."
exec ./yukpomnang_backend

