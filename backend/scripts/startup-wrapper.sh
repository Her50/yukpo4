#!/bin/bash
# Wrapper qui démarre un serveur HTTP minimal puis Rust

# Ne pas utiliser set -e car on veut capturer toutes les erreurs
# set -e
set -o pipefail  # Capturer les erreurs dans les pipes

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

# Vérifier que le port est bien libre
if lsof -i :8080 >/dev/null 2>&1; then
    echo "⚠️ [WRAPPER] ATTENTION: Le port 8080 est encore occupé!"
    lsof -i :8080 || true
    echo "⏳ [WRAPPER] Attente supplémentaire (3 secondes)..."
    sleep 3
else
    echo "✅ [WRAPPER] Port 8080 est libre"
fi

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

# Vérifier le format de DATABASE_URL (sans afficher le contenu complet)
echo "🔍 [WRAPPER] Variables d'environnement critiques:"
echo "   DATABASE_URL: ${DATABASE_URL:+✅ Présente (longueur: ${#DATABASE_URL})}"
if [ -n "$DATABASE_URL" ]; then
    # Vérifier s'il y a des retours à la ligne
    if echo "$DATABASE_URL" | grep -q $'\r'; then
        echo "   ⚠️ [WRAPPER] ATTENTION: DATABASE_URL contient des retours à la ligne (\\r)!"
    fi
    if echo "$DATABASE_URL" | grep -q $'\n'; then
        echo "   ⚠️ [WRAPPER] ATTENTION: DATABASE_URL contient des retours à la ligne (\\n)!"
    fi
    # Afficher les premiers et derniers caractères pour debug
    echo "   🔍 [WRAPPER] DATABASE_URL commence par: ${DATABASE_URL:0:50}..."
    echo "   🔍 [WRAPPER] DATABASE_URL se termine par: ...${DATABASE_URL: -50}"
fi
echo "   JWT_SECRET: ${JWT_SECRET:+✅ Présente (longueur: ${#JWT_SECRET})}"
echo "   REDIS_URL: ${REDIS_URL:+✅ Présente}"
echo "   MONGODB_URL: ${MONGODB_URL:+✅ Présente}"

# Tester que le binaire peut s'exécuter (test basique)
echo "🔍 [WRAPPER] Test d'exécution du binaire (version)..."
if /app/yukpomnang_backend --version 2>&1; then
    echo "✅ [WRAPPER] Binaire peut s'exécuter"
else
    echo "⚠️ [WRAPPER] Binaire ne peut pas s'exécuter (code: $?)"
    echo "🔍 [WRAPPER] Informations système:"
    uname -a
    ldd /app/yukpomnang_backend 2>&1 | head -10 || echo "ldd non disponible"
fi

echo "🚀 [WRAPPER] Démarrage application Rust..."
echo "🔍 [WRAPPER] Toutes les erreurs seront capturées ci-dessous..."

# Utiliser exec pour que Rust devienne le processus principal (PID 1)
# Rediriger stderr vers stdout pour capturer toutes les erreurs
# Ne pas utiliser exec immédiatement pour pouvoir capturer les erreurs de démarrage
/app/yukpomnang_backend 2>&1
EXIT_CODE=$?

if [ $EXIT_CODE -ne 0 ]; then
    echo "❌ [WRAPPER] Application Rust a quitté avec le code: $EXIT_CODE"
    echo "🔍 [WRAPPER] Dernières erreurs capturées ci-dessus"
    exit $EXIT_CODE
fi

