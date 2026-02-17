#!/bin/bash
# Wrapper qui démarre un serveur HTTP minimal puis Rust

set -e

echo "🚀 [WRAPPER] Démarrage wrapper Cloud Run..."

# Démarrer le serveur HTTP minimal Python en arrière-plan
echo "🚀 [WRAPPER] Démarrage serveur HTTP minimal Python..."
python3 /app/health-server-python.py &
HEALTH_PID=$!
echo "✅ [WRAPPER] Serveur HTTP minimal démarré (PID: $HEALTH_PID)"

# Attendre que le serveur soit prêt et que Cloud Run le détecte
sleep 5
echo "✅ [WRAPPER] Serveur HTTP minimal prêt, Cloud Run devrait le détecter..."

# Attendre que Cloud Run détecte le serveur Python (startup probe)
echo "⏳ [WRAPPER] Attente que Cloud Run détecte le serveur Python (5 secondes)..."
sleep 5

# Maintenant tuer le serveur Python pour libérer le port AVANT de démarrer Rust
echo "🛑 [WRAPPER] Arrêt du serveur Python pour libérer le port..."
kill $HEALTH_PID 2>/dev/null || true
sleep 2
echo "✅ [WRAPPER] Port libéré, démarrage de Rust..."

# Maintenant démarrer Rust (qui va pouvoir bind sur le port libre)
echo "🚀 [WRAPPER] Démarrage application Rust..."
exec /app/yukpomnang_backend

# Attendre Rust (processus principal)
wait $RUST_PID
EXIT_CODE=$?

if [ $EXIT_CODE -ne 0 ]; then
    echo "❌ [WRAPPER] Application Rust a quitté avec le code $EXIT_CODE"
    exit $EXIT_CODE
fi

