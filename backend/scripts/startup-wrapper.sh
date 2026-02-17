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
# Attendre que le processus Python se termine complètement
wait $HEALTH_PID 2>/dev/null || true
# Attendre un peu plus pour que le port soit vraiment libéré par le système
sleep 3
echo "✅ [WRAPPER] Port libéré, démarrage de Rust..."

# Vérifier que le port est vraiment libre avant de démarrer Rust
echo "🔍 [WRAPPER] Vérification que le port 8080 est libre..."
for i in {1..5}; do
    if ! lsof -i :8080 >/dev/null 2>&1 && ! netstat -tuln 2>/dev/null | grep -q ":8080 "; then
        echo "✅ [WRAPPER] Port 8080 est libre (vérification $i)"
        break
    else
        echo "⏳ [WRAPPER] Port 8080 encore occupé, attente... (vérification $i)"
        sleep 1
    fi
done

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

