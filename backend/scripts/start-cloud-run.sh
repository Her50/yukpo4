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
    echo "🚀 [STARTUP] Démarrage serveur HTTP minimal Python pour health check..."
    
    # Lancer le serveur minimal Python en arrière-plan (plus fiable que shell)
    python3 /app/health-server-python.py &
    HEALTH_PID=$!
    echo "✅ [STARTUP] Serveur HTTP minimal Python démarré (PID: $HEALTH_PID) sur port $PORT"
    
    # Attendre que le serveur soit prêt
    sleep 2
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
# ⚠️ Ne pas utiliser exec pour garder le serveur minimal en vie
echo "🚀 Lancement application Rust sur port $PORT..."
./yukpomnang_backend

