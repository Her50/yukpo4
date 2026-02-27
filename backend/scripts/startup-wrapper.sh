#!/bin/bash
# ✅ CORRIGÉ 2026-02-27: Wrapper Cloud Run avec Python health server
# Stratégie: Python reste en vie pendant TOUTE l'initialisation Rust.
# Rust tourne en background. Quand Rust est prêt (bind réussi), on tue Python.
# Le wrapper reste le PID 1 et forward les signaux à Rust.

set -o pipefail

echo "🚀 [WRAPPER] Démarrage wrapper Cloud Run..."

# ── Étape 1: Démarrer Python health server ──────────────────────────
echo "🚀 [WRAPPER] Démarrage serveur HTTP minimal Python sur port 8080..."
python3 /app/health-server-python.py &
HEALTH_PID=$!
echo "✅ [WRAPPER] Python health server démarré (PID: $HEALTH_PID)"

# Attendre que Python soit prêt
sleep 1

# ── Étape 2: Vérifications rapides du binaire ───────────────────────
if [ ! -f /app/yukpomnang_backend ]; then
    echo "❌ [WRAPPER] ERREUR: /app/yukpomnang_backend n'existe pas!"
    ls -la /app/ | head -20
    exit 1
fi
if [ ! -x /app/yukpomnang_backend ]; then
    chmod +x /app/yukpomnang_backend 2>/dev/null || true
fi
echo "✅ [WRAPPER] Binaire vérifié"

# ── Étape 3: Nettoyer DATABASE_URL ──────────────────────────────────
echo "🔍 [WRAPPER] Variables critiques:"
echo "   DATABASE_URL: ${DATABASE_URL:+✅ (longueur: ${#DATABASE_URL})}"
echo "   JWT_SECRET: ${JWT_SECRET:+✅ (longueur: ${#JWT_SECRET})}"
echo "   REDIS_URL: ${REDIS_URL:+✅ Présente}"
echo "   MONGODB_URL: ${MONGODB_URL:+✅ Présente}"

if [ -n "$DATABASE_URL" ]; then
    DATABASE_URL=$(echo "$DATABASE_URL" | tr -d '\r\n')
    export DATABASE_URL
fi

# ── Étape 4: Démarrer Rust en background ────────────────────────────
# Python reste sur port 8080 pendant que Rust initialise (DB, Redis, migrations...)
# Rust va essayer de bind port 8080 avec retry logic — il attend que Python libère le port
echo "� [WRAPPER] Démarrage Rust en arrière-plan..."
/app/yukpomnang_backend &
RUST_PID=$!
echo "✅ [WRAPPER] Rust démarré (PID: $RUST_PID)"

# ── Étape 5: Attendre que Rust soit prêt ────────────────────────────
# On poll un fichier signal que Rust crée quand il est prêt à bind
# OU on détecte que Rust a crashé
# Timeout: 500 secondes (laisse le temps aux migrations)
echo "⏳ [WRAPPER] Attente que Rust soit prêt (max 500s)..."
WAIT_COUNT=0
MAX_WAIT=500

while [ $WAIT_COUNT -lt $MAX_WAIT ]; do
    # Vérifier si Rust a crashé
    if ! kill -0 $RUST_PID 2>/dev/null; then
        echo "❌ [WRAPPER] Rust a crashé après ${WAIT_COUNT}s!"
        wait $RUST_PID 2>/dev/null
        RUST_EXIT=$?
        echo "❌ [WRAPPER] Code de sortie Rust: $RUST_EXIT"
        kill $HEALTH_PID 2>/dev/null || true
        exit $RUST_EXIT
    fi

    # Vérifier si Rust a signalé qu'il est prêt (fichier signal)
    if [ -f /tmp/rust_ready ]; then
        echo "✅ [WRAPPER] Rust a signalé qu'il est prêt après ${WAIT_COUNT}s!"
        break
    fi

    # Log de progression toutes les 30 secondes
    if [ $((WAIT_COUNT % 30)) -eq 0 ] && [ $WAIT_COUNT -gt 0 ]; then
        echo "⏳ [WRAPPER] Rust initialise... (${WAIT_COUNT}s/${MAX_WAIT}s)"
    fi

    sleep 1
    WAIT_COUNT=$((WAIT_COUNT + 1))
done

if [ $WAIT_COUNT -ge $MAX_WAIT ]; then
    echo "❌ [WRAPPER] Timeout: Rust n'est pas prêt après ${MAX_WAIT}s"
    kill $RUST_PID 2>/dev/null || true
    kill $HEALTH_PID 2>/dev/null || true
    exit 1
fi

# ── Étape 6: Tuer Python et laisser Rust prendre le port ────────────
echo "🛑 [WRAPPER] Arrêt Python pour libérer port 8080..."
kill $HEALTH_PID 2>/dev/null || true
wait $HEALTH_PID 2>/dev/null || true
sleep 1
echo "✅ [WRAPPER] Python arrêté, Rust va bind port 8080"

# Supprimer le fichier signal pour que Rust sache que Python est mort
rm -f /tmp/rust_ready
touch /tmp/python_stopped

# ── Étape 7: Forward signaux et attendre Rust ───────────────────────
# Le wrapper reste PID 1, forward SIGTERM/SIGINT à Rust
trap "echo '🛑 [WRAPPER] Signal reçu, arrêt Rust...'; kill $RUST_PID 2>/dev/null; wait $RUST_PID; exit" SIGTERM SIGINT

echo "🚀 [WRAPPER] Rust est le processus principal, en attente..."
wait $RUST_PID
RUST_EXIT=$?
echo "🏁 [WRAPPER] Rust terminé avec code: $RUST_EXIT"
exit $RUST_EXIT

