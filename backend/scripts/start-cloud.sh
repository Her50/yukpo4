#!/bin/bash

# 🚀 Script de démarrage optimisé pour Cloud Run / AWS ECS
# ✅ CORRIGÉ 2026-03-23: Cloud Run fast-path — exec le binaire immédiatement, pas de checks inutiles.
# Le binaire fait lui-même le bind TCP synchrone dans main() avant tokio ; chaque seconde
# perdue ici repousse le moment où le port 8080 est en écoute et risque de faire échouer la sonde.

# ────────────────────────────────────────────────────────────
# Cloud Run fast-path : on n'a besoin QUE de lancer le binaire.
# ────────────────────────────────────────────────────────────
if [ "$CLOUD_RUN" = "true" ]; then
    export PORT=${PORT:-8080}
    export HOST=${HOST:-0.0.0.0}
    chmod +x ./yukpomnang_backend 2>/dev/null || true
    echo "🚀 Cloud Run: exec ./yukpomnang_backend (PID 1)"
    exec ./yukpomnang_backend
    # exec remplace le shell — si on arrive ici, exec a échoué
    echo "❌ exec a échoué!"
    exit 1
fi

# ────────────────────────────────────────────────────────────
# Chemin classique (AWS / local) — conservé tel quel
# ────────────────────────────────────────────────────────────
set -e

if [ -n "$AWS_REGION" ] || [ -n "$ECS_CONTAINER_METADATA_URI" ]; then
    echo "🚀 Démarrage de Yukpomnang Backend - AWS Cloud..."
else
    echo "🚀 Démarrage de Yukpomnang Backend..."
fi

if [ -z "$DATABASE_URL" ]; then
    echo "❌ ERREUR: DATABASE_URL non définie"
    exit 1
fi

export PORT=${PORT:-8080}
export HOST=${HOST:-0.0.0.0}
export RUST_LOG=${RUST_LOG:-info}
export APP_ENV=${APP_ENV:-production}
export AWS_REGION=${AWS_REGION:-eu-west-1}
export DB_POOL_SIZE=${DB_POOL_SIZE:-100}
export DB_POOL_MIN_SIZE=${DB_POOL_MIN_SIZE:-5}
export DB_ACQUIRE_TIMEOUT_SECS=${DB_ACQUIRE_TIMEOUT_SECS:-30}

# Vérifier la connectivité DB (AWS / local)
if [ -n "$AWS_REGION" ] || [ -n "$ECS_CONTAINER_METADATA_URI" ]; then
    echo "🔍 Vérification de la connectivité à la base de données AWS RDS..."
    MAX_RETRIES=30
    RETRY_COUNT=0
    DB_HOST=$(echo $DATABASE_URL | sed -n 's/.*@\([^:]*\):.*/\1/p')
    DB_PORT=$(echo $DATABASE_URL | sed -n 's/.*:\([0-9]*\)\/.*/\1/p' || echo "5432")

    if [ -n "$DB_HOST" ]; then
        until pg_isready -h "$DB_HOST" -p "$DB_PORT" 2>/dev/null || [ $RETRY_COUNT -ge $MAX_RETRIES ]; do
            RETRY_COUNT=$((RETRY_COUNT + 1))
            echo "⏳ En attente de la base de données ($DB_HOST:$DB_PORT)... (tentative $RETRY_COUNT/$MAX_RETRIES)"
            sleep 2
        done
        if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
            echo "❌ ERREUR: Impossible de se connecter à la base de données après $MAX_RETRIES tentatives"
            exit 1
        fi
        echo "✅ Base de données AWS RDS accessible"
    fi
else
    if echo "$DATABASE_URL" | grep -q "/cloudsql/"; then
        echo "✅ Format Cloud SQL Unix socket détecté - Vérification DB sautée"
    else
        MAX_RETRIES=30
        RETRY_COUNT=0
        DB_HOST=$(echo $DATABASE_URL | sed -n 's/.*@\([^:]*\):.*/\1/p')
        DB_PORT=$(echo $DATABASE_URL | sed -n 's/.*:\([0-9]*\)\/.*/\1/p' || echo "5432")
        if [ -n "$DB_HOST" ]; then
            until pg_isready -h "$DB_HOST" -p "$DB_PORT" 2>/dev/null || [ $RETRY_COUNT -ge $MAX_RETRIES ]; do
                RETRY_COUNT=$((RETRY_COUNT + 1))
                echo "⏳ En attente de la base de données ($DB_HOST:$DB_PORT)... (tentative $RETRY_COUNT/$MAX_RETRIES)"
                sleep 2
            done
            if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
                echo "❌ ERREUR: Impossible de se connecter à la base de données après $MAX_RETRIES tentatives"
                exit 1
            fi
            echo "✅ Base de données accessible"
        fi
    fi
fi

# Vérifier l'exécutable
if [ ! -f "./yukpomnang_backend" ]; then
    echo "❌ ERREUR: L'exécutable ./yukpomnang_backend n'existe pas!"
    exit 1
fi
chmod +x ./yukpomnang_backend

# Redis check (optionnel, non-bloquant)
set +e
if [ -n "$REDIS_URL" ] && command -v redis-cli &> /dev/null; then
    REDIS_PING_OUTPUT=$(timeout 3 redis-cli -u "$REDIS_URL" ping 2>&1 || echo "TIMEOUT_OR_ERROR")
    if [ "$REDIS_PING_OUTPUT" = "PONG" ]; then
        echo "✅ Redis accessible"
    else
        echo "⚠️ Redis non accessible (optionnel)"
    fi
fi
set -e

echo "🚀 Lancement: exec ./yukpomnang_backend"
echo "   Port: $PORT | Host: $HOST | Log: $RUST_LOG | Env: $APP_ENV"
exec ./yukpomnang_backend