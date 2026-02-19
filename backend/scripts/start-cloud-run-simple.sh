#!/bin/bash
# 🚀 Script de démarrage SIMPLIFIÉ pour Google Cloud Run
# Le serveur minimal Python démarre en premier plan, Rust en arrière-plan

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

# ✅ CRITIQUE: Démarrer Rust en arrière-plan d'abord
echo "🚀 [STARTUP] Démarrage application Rust en arrière-plan..."
./yukpomnang_backend &
RUST_PID=$!
echo "✅ [STARTUP] Application Rust démarrée (PID: $RUST_PID)"

# Attendre un peu pour que Rust démarre son serveur minimal
sleep 3

# Maintenant, le serveur Rust devrait être prêt et répondre aux health checks
# On attend que Rust se termine (ou qu'il crash)
wait $RUST_PID
EXIT_CODE=$?

if [ $EXIT_CODE -ne 0 ]; then
    echo "❌ [STARTUP] Application Rust a quitté avec le code $EXIT_CODE"
    exit $EXIT_CODE
fi


