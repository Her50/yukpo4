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
# Attendre que le port soit vraiment libéré par le système
echo "⏳ [WRAPPER] Attente libération du port (5 secondes)..."
sleep 5
echo "✅ [WRAPPER] Port libéré, démarrage de Rust..."

# Maintenant démarrer Rust (qui va pouvoir bind sur le port libre)
# Vérifier que le binaire existe et est exécutable
echo "🔍 [WRAPPER] Vérification du binaire Rust..."
if [ ! -f /app/yukpomnang_backend ]; then
    echo "❌ [WRAPPER] ERREUR: Le binaire /app/yukpomnang_backend n'existe pas!"
    ls -la /app/ | head -20
    exit 1
fi

if [ ! -x /app/yukpomnang_backend ]; then
    echo "⚠️ [WRAPPER] Le binaire n'est pas exécutable, tentative de correction..."
    chmod +x /app/yukpomnang_backend
fi

echo "✅ [WRAPPER] Binaire trouvé et exécutable"
echo "🚀 [WRAPPER] Démarrage application Rust..."
echo "🔍 [WRAPPER] Variables d'environnement critiques:"
echo "   DATABASE_URL: ${DATABASE_URL:+✅ Présente (longueur: ${#DATABASE_URL})}"
echo "   JWT_SECRET: ${JWT_SECRET:+✅ Présente (longueur: ${#JWT_SECRET})}"
echo "   REDIS_URL: ${REDIS_URL:+✅ Présente}"
echo "   MONGODB_URL: ${MONGODB_URL:+✅ Présente}"

# Utiliser exec pour que Rust devienne le processus principal (PID 1)
# Rediriger stderr vers stdout pour capturer toutes les erreurs
exec /app/yukpomnang_backend 2>&1

