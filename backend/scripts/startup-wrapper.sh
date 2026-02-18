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

# ✅ CORRIGÉ 2026-02-18: Attendre que Cloud Run détecte le serveur Python
# Le startup probe a initialDelaySeconds=60, donc on attend au moins 60s
# pour que Cloud Run commence les health checks et valide le probe
echo "⏳ [WRAPPER] Attente que Cloud Run détecte le serveur Python (70 secondes pour startup probe)..."
sleep 70
echo "✅ [WRAPPER] Cloud Run devrait avoir validé le startup probe, démarrage de Rust en arrière-plan..."

# ✅ CRITIQUE: Démarrer Rust en arrière-plan SANS tuer Python
# Python continue de répondre aux health checks pendant que Rust s'initialise
# Une fois Rust prêt, il prendra le relais (le wrapper Python sera tué par Rust ou restera en vie)
echo "🚀 [WRAPPER] Démarrage de Rust en arrière-plan (Python continue de répondre)..."

# Vérifier que le port est bien libre
echo "🔍 [WRAPPER] Vérification que le port 8080 est libre..."
if command -v lsof >/dev/null 2>&1; then
    if lsof -i :8080 >/dev/null 2>&1; then
        echo "⚠️ [WRAPPER] ATTENTION: Le port 8080 est encore occupé!"
        lsof -i :8080 || true
        # ✅ CORRIGÉ: Augmenter l'attente supplémentaire de 3s à 5s
        echo "⏳ [WRAPPER] Attente supplémentaire (5 secondes)..."
        sleep 5
    else
        echo "✅ [WRAPPER] Port 8080 est libre (vérifié avec lsof)"
    fi
else
    echo "⚠️ [WRAPPER] lsof non disponible, on suppose que le port est libre"
fi

# Maintenant démarrer Rust (qui va pouvoir bind sur le port libre)
# ✅ CRITIQUE 2026-02-17: Ajouter des logs détaillés pour diagnostiquer où le wrapper s'arrête
echo "🔍 [WRAPPER] Étape 1: Vérification existence du binaire Rust..."
if [ ! -f /app/yukpomnang_backend ]; then
    echo "❌ [WRAPPER] ERREUR: Le binaire /app/yukpomnang_backend n'existe pas!"
    echo "📂 [WRAPPER] Contenu de /app/:"
    ls -la /app/ | head -20
    exit 1
fi
echo "✅ [WRAPPER] Binaire trouvé: /app/yukpomnang_backend"

echo "🔍 [WRAPPER] Étape 2: Vérification exécutabilité du binaire..."
if [ ! -x /app/yukpomnang_backend ]; then
    echo "⚠️ [WRAPPER] Le binaire n'est pas exécutable, tentative de correction..."
    chmod +x /app/yukpomnang_backend
    if [ ! -x /app/yukpomnang_backend ]; then
        echo "❌ [WRAPPER] ERREUR: Impossible de rendre le binaire exécutable!"
        exit 1
    fi
fi
echo "✅ [WRAPPER] Binaire est exécutable"

# Vérifier le format de DATABASE_URL (sans afficher le contenu complet)
echo "🔍 [WRAPPER] Variables d'environnement critiques:"
echo "   DATABASE_URL: ${DATABASE_URL:+✅ Présente (longueur: ${#DATABASE_URL})}"
if [ -n "$DATABASE_URL" ]; then
    # Vérifier s'il y a des retours à la ligne
    HAS_CR=false
    HAS_LF=false
    if echo "$DATABASE_URL" | grep -q $'\r'; then
        echo "   ⚠️ [WRAPPER] ATTENTION: DATABASE_URL contient des retours à la ligne (\\r)!"
        HAS_CR=true
    fi
    if echo "$DATABASE_URL" | grep -q $'\n'; then
        echo "   ⚠️ [WRAPPER] ATTENTION: DATABASE_URL contient des retours à la ligne (\\n)!"
        HAS_LF=true
    fi
    
    # ✅ CRITIQUE 2026-02-17: Nettoyer DATABASE_URL des retours à la ligne
    # Les retours à la ligne cassent le parsing de l'URL dans Rust et causent "empty host"
    if [ "$HAS_CR" = true ] || [ "$HAS_LF" = true ]; then
        ORIGINAL_LEN=${#DATABASE_URL}
        DATABASE_URL=$(echo "$DATABASE_URL" | tr -d '\r\n' | tr -d '\n' | tr -d '\r')
        export DATABASE_URL
        echo "   ✅ [WRAPPER] DATABASE_URL nettoyée (${ORIGINAL_LEN} -> ${#DATABASE_URL} caractères)"
    fi
    
    # Afficher les premiers et derniers caractères pour debug
    echo "   🔍 [WRAPPER] DATABASE_URL commence par: ${DATABASE_URL:0:50}..."
    echo "   🔍 [WRAPPER] DATABASE_URL se termine par: ...${DATABASE_URL: -50}"
fi
echo "   JWT_SECRET: ${JWT_SECRET:+✅ Présente (longueur: ${#JWT_SECRET})}"
echo "   REDIS_URL: ${REDIS_URL:+✅ Présente}"
echo "   MONGODB_URL: ${MONGODB_URL:+✅ Présente}"

# Tester que le binaire peut s'exécuter (test basique)
echo "🔍 [WRAPPER] Étape 3: Test d'exécution du binaire (version)..."
echo "🔍 [WRAPPER] Exécution de: /app/yukpomnang_backend --version"
VERSION_OUTPUT=$(/app/yukpomnang_backend --version 2>&1)
VERSION_EXIT_CODE=$?

if [ $VERSION_EXIT_CODE -eq 0 ]; then
    echo "✅ [WRAPPER] Binaire peut s'exécuter (test --version réussi)"
    echo "🔍 [WRAPPER] Sortie de --version: $VERSION_OUTPUT"
else
    echo "⚠️ [WRAPPER] Binaire ne peut pas s'exécuter (code: $VERSION_EXIT_CODE)"
    echo "🔍 [WRAPPER] Sortie de --version (erreur): $VERSION_OUTPUT"
    echo "🔍 [WRAPPER] Informations système:"
    uname -a
    echo "🔍 [WRAPPER] Dépendances du binaire:"
    ldd /app/yukpomnang_backend 2>&1 | head -10 || echo "ldd non disponible"
    echo "❌ [WRAPPER] ERREUR: Le binaire Rust ne peut pas s'exécuter!"
    exit 1
fi

echo "✅ [WRAPPER] Étape 3 terminée avec succès"
echo "🔍 [WRAPPER] Passage à l'Étape 4..."

echo "🚀 [WRAPPER] Étape 4: Démarrage application Rust..."
echo "🔍 [WRAPPER] Toutes les erreurs seront capturées ci-dessous..."

# ✅ CRITIQUE 2026-02-17: Ajouter des vérifications finales avant exec
echo "🔍 [WRAPPER] Étape 4.1: Vérification finale avant exec..."
echo "   - Chemin binaire: /app/yukpomnang_backend"
echo "   - Existence: $([ -f /app/yukpomnang_backend ] && echo '✅ OUI' || echo '❌ NON')"
echo "   - Exécutable: $([ -x /app/yukpomnang_backend ] && echo '✅ OUI' || echo '❌ NON')"
echo "   - Taille: $(ls -lh /app/yukpomnang_backend 2>/dev/null | awk '{print $5}' || echo 'inconnue')"
echo "   - Type: $(file /app/yukpomnang_backend 2>/dev/null || echo 'file non disponible')"

# Test final d'exécution avec affichage des erreurs
echo "🔍 [WRAPPER] Étape 4.2: Test final d'exécution (--version)..."
FINAL_VERSION_OUTPUT=$(/app/yukpomnang_backend --version 2>&1)
FINAL_VERSION_EXIT=$?

if [ $FINAL_VERSION_EXIT -eq 0 ]; then
    echo "✅ [WRAPPER] Test --version réussi"
    echo "🔍 [WRAPPER] Sortie: $FINAL_VERSION_OUTPUT"
    echo "✅ [WRAPPER] Tous les tests passés, démarrage de l'application..."
else
    echo "❌ [WRAPPER] ERREUR: Test --version a échoué avec le code $FINAL_VERSION_EXIT"
    echo "🔍 [WRAPPER] Sortie (erreur): $FINAL_VERSION_OUTPUT"
    echo "🔍 [WRAPPER] Tentative d'exécution directe pour voir l'erreur:"
    /app/yukpomnang_backend 2>&1 || true
    echo "❌ [WRAPPER] Impossible de démarrer l'application Rust"
    exit 1
fi

# ✅ CORRIGÉ 2026-02-18: Stratégie simplifiée - Garder Python en vie plus longtemps
# Le startup probe a initialDelaySeconds=90, donc on attend 90s pour que Cloud Run valide
# Ensuite on démarre Rust qui va essayer de bind (avec retry logic dans main.rs)
echo "⏳ [WRAPPER] Attente que Cloud Run valide le startup probe (90 secondes)..."
sleep 90
echo "✅ [WRAPPER] Cloud Run devrait avoir validé le startup probe"

# Maintenant tuer Python et démarrer Rust
echo "🛑 [WRAPPER] Arrêt du serveur Python pour libérer le port..."
kill $HEALTH_PID 2>/dev/null || true
wait $HEALTH_PID 2>/dev/null || true
echo "⏳ [WRAPPER] Attente libération du port (5 secondes)..."
sleep 5
echo "✅ [WRAPPER] Port libéré, démarrage de Rust..."

# ✅ CRITIQUE: Utiliser exec pour que Rust devienne le processus principal (PID 1)
# Cloud Run nécessite que le processus principal reste actif
echo "🚀 [WRAPPER] Démarrage de Rust (remplace le wrapper)..."
exec /app/yukpomnang_backend 2>&1

