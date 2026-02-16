#!/bin/bash

# 🚀 Script de démarrage ULTRA-OPTIMISÉ pour Google Cloud Run
# Version minimale pour démarrage le plus rapide possible
set -e

echo "🚀 Démarrage Yukpomnang Backend - Cloud Run..."

# Variables d'environnement essentielles
export PORT=${PORT:-8080}
export HOST=${HOST:-0.0.0.0}
export RUST_LOG=${RUST_LOG:-info}

# ✅ CRITIQUE: Démarrer un serveur HTTP minimal IMMÉDIATEMENT pour health check
if [ "$CLOUD_RUN" = "true" ]; then
    echo "🚀 [STARTUP] Démarrage serveur HTTP minimal pour health check..."
    
    # Lancer le serveur minimal en arrière-plan
    /app/health-server-simple.sh &
    HEALTH_PID=$!
    echo "✅ [STARTUP] Serveur HTTP minimal démarré (PID: $HEALTH_PID) sur port $PORT"
    
    # Attendre que le serveur soit prêt
    sleep 1
    echo "✅ [STARTUP] Serveur HTTP minimal prêt pour health checks"
fi

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

# Démarrer l'application Rust (elle remplacera le serveur minimal)
echo "🚀 Lancement application Rust sur port $PORT..."
exec ./yukpomnang_backend

