#!/bin/bash
# Wrapper qui démarre un serveur HTTP minimal puis Rust

set -e

echo "🚀 [WRAPPER] Démarrage wrapper Cloud Run..."

# Démarrer le serveur HTTP minimal Python en arrière-plan
echo "🚀 [WRAPPER] Démarrage serveur HTTP minimal Python..."
python3 /app/health-server-python.py &
HEALTH_PID=$!
echo "✅ [WRAPPER] Serveur HTTP minimal démarré (PID: $HEALTH_PID)"

# Attendre que le serveur soit prêt
sleep 2
echo "✅ [WRAPPER] Serveur HTTP minimal prêt, démarrage Rust..."

# Maintenant démarrer Rust (il remplacera le serveur Python)
echo "🚀 [WRAPPER] Démarrage application Rust..."
exec /app/yukpomnang_backend

