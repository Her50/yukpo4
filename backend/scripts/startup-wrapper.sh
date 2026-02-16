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

# Maintenant démarrer Rust en arrière-plan
echo "🚀 [WRAPPER] Démarrage application Rust en arrière-plan..."
/app/yukpomnang_backend &
RUST_PID=$!
echo "✅ [WRAPPER] Application Rust démarrée (PID: $RUST_PID)"

# Attendre que Rust démarre son serveur minimal (qui va échouer à bind car port occupé)
# Mais Rust va attendre et réessayer
sleep 10

# Maintenant tuer le serveur Python pour libérer le port
echo "🛑 [WRAPPER] Arrêt du serveur Python pour libérer le port..."
kill $HEALTH_PID 2>/dev/null || true
sleep 1

# Attendre que Rust prenne le relais
echo "✅ [WRAPPER] Port libéré, Rust devrait prendre le relais..."

# Attendre Rust (processus principal)
wait $RUST_PID
EXIT_CODE=$?

if [ $EXIT_CODE -ne 0 ]; then
    echo "❌ [WRAPPER] Application Rust a quitté avec le code $EXIT_CODE"
    exit $EXIT_CODE
fi

