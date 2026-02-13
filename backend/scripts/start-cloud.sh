#!/bin/bash

# 🚀 Script de démarrage optimisé pour AWS ECS/Fargate
set -e

echo "🚀 Démarrage de Yukpomnang Backend - AWS Cloud..."

# Vérifier les variables d'environnement critiques
if [ -z "$DATABASE_URL" ]; then
    echo "❌ ERREUR: DATABASE_URL non définie"
    exit 1
fi

# Variables d'environnement avec valeurs par défaut pour AWS
export PORT=${PORT:-8080}
export HOST=${HOST:-0.0.0.0}
export RUST_LOG=${RUST_LOG:-info}
export APP_ENV=${APP_ENV:-production}
export AWS_REGION=${AWS_REGION:-us-east-1}

# Configuration du pool de connexions pour AWS RDS
export DB_POOL_SIZE=${DB_POOL_SIZE:-100}
export DB_POOL_MIN_SIZE=${DB_POOL_MIN_SIZE:-5}  # ✅ Optimisé: Réduit de 20 à 5 pour démarrage plus rapide
export DB_ACQUIRE_TIMEOUT_SECS=${DB_ACQUIRE_TIMEOUT_SECS:-30}

# Vérifier la connectivité à la base de données (AWS RDS)
echo "🔍 Vérification de la connectivité à la base de données AWS RDS..."
MAX_RETRIES=30
RETRY_COUNT=0

# Extraire les informations de connexion de DATABASE_URL
DB_HOST=$(echo $DATABASE_URL | sed -n 's/.*@\([^:]*\):.*/\1/p')
DB_PORT=$(echo $DATABASE_URL | sed -n 's/.*:\([0-9]*\)\/.*/\1/p' || echo "5432")

if [ -z "$DB_HOST" ]; then
    echo "⚠️ Impossible d'extraire DB_HOST de DATABASE_URL, tentative directe..."
    until pg_isready -d "$DATABASE_URL" 2>/dev/null || [ $RETRY_COUNT -ge $MAX_RETRIES ]; do
        RETRY_COUNT=$((RETRY_COUNT + 1))
        echo "⏳ En attente de la base de données AWS RDS... (tentative $RETRY_COUNT/$MAX_RETRIES)"
        sleep 2
    done
else
    until pg_isready -h "$DB_HOST" -p "$DB_PORT" 2>/dev/null || [ $RETRY_COUNT -ge $MAX_RETRIES ]; do
        RETRY_COUNT=$((RETRY_COUNT + 1))
        echo "⏳ En attente de la base de données AWS RDS ($DB_HOST:$DB_PORT)... (tentative $RETRY_COUNT/$MAX_RETRIES)"
        sleep 2
    done
fi

if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
    echo "❌ ERREUR: Impossible de se connecter à la base de données après $MAX_RETRIES tentatives"
    echo "   DB_HOST: ${DB_HOST:-non défini}"
    echo "   DB_PORT: ${DB_PORT:-non défini}"
    echo "   DATABASE_URL: ${DATABASE_URL:0:50}... (tronqué pour sécurité)"
    exit 1
fi

echo "✅ Base de données AWS RDS accessible"

# 🛠️ S'assurer que la base applicative existe
# Si DATABASE_URL pointe vers une DB qui n'existe pas encore, l'app crashe (sqlx).
# On essaie de créer la DB automatiquement en se connectant à la DB "postgres".
# Désactiver set -e temporairement pour cette section (la vérification peut échouer sans être critique)
set +e
DB_NAME=$(echo "$DATABASE_URL" | sed -n 's#.*/\([^/?]*\).*#\1#p')
if [ -n "$DB_NAME" ] && [ "$DB_NAME" != "postgres" ]; then
    echo "🔍 Vérification de l'existence de la base PostgreSQL '$DB_NAME'..."
    ADMIN_DB_URL=$(echo "$DATABASE_URL" | sed -E 's#/(.*)$#/postgres#')
    if command -v psql >/dev/null 2>&1; then
        # ✅ AMÉLIORATION: Tester directement la connexion à la base au lieu de pg_database
        # Cela évite les problèmes de permissions sur les vues système
        echo "   Test de connexion directe à la base '$DB_NAME'..."
        DB_CONNECT_TEST=$(psql "$DATABASE_URL" -c "SELECT 1;" 2>&1)
        DB_CONNECT_SUCCESS=$?
        
        if [ $DB_CONNECT_SUCCESS -eq 0 ]; then
            echo "✅ Base '$DB_NAME' existe et est accessible"
        else
            # Si la connexion échoue, vérifier si c'est une erreur de "base inexistante" ou autre
            if echo "$DB_CONNECT_TEST" | grep -qi "database.*does not exist\|database.*not found\|FATAL.*database"; then
                echo "⚠️ Base '$DB_NAME' inexistante, tentative de création..."
                # Tenter de créer la base via la base 'postgres'
                if psql "$ADMIN_DB_URL" -v ON_ERROR_STOP=1 -c "CREATE DATABASE \"${DB_NAME}\"" >/dev/null 2>&1; then
                    echo "✅ Base '$DB_NAME' créée avec succès"
                else
                    echo "⚠️ WARNING: Impossible de créer la base '$DB_NAME' automatiquement (permissions insuffisantes)"
                    echo "   Sur AWS RDS, l'utilisateur n'a pas les permissions SUPERUSER nécessaires"
                    echo ""
                    echo "   La base devrait être créée automatiquement par Terraform via le paramètre db_name"
                    echo "   Si elle n'existe toujours pas, créez-la manuellement via AWS RDS Query Editor"
                    echo ""
                    echo "   Command SQL: CREATE DATABASE \"${DB_NAME}\";"
                    echo ""
                    echo "   Continuons quand même - l'application tentera de se connecter directement"
                    echo "   Si la base n'existe pas, l'application affichera une erreur de connexion claire"
                fi
            else
                # Autre type d'erreur (permissions, réseau, etc.)
                echo "⚠️ WARNING: Erreur lors de la vérification de la base '$DB_NAME':"
                echo "   $(echo "$DB_CONNECT_TEST" | head -1)"
                echo ""
                echo "   Cela peut être dû à:"
                echo "   - Un problème de permissions"
                echo "   - Un problème de réseau"
                echo "   - La base existe mais l'utilisateur n'a pas les permissions nécessaires"
                echo ""
                echo "   Continuons quand même - l'application tentera de se connecter directement"
                echo "   Si la base n'existe pas, l'application affichera une erreur de connexion claire"
            fi
        fi
    else
        echo "⚠️ WARNING: psql non disponible, impossible de vérifier/créer la base '$DB_NAME'"
        echo "   (postgresql-client doit être installé dans l'image)"
        echo "   Continuons quand même - l'application tentera de se connecter directement"
    fi
fi
# Réactiver set -e pour le reste du script
set -e

# ✅ NOUVEAU 2026-02-13: Logs de débogage AVANT Redis pour capturer les infos même si le script s'arrête après
echo "🔍 Vérification de l'exécutable avant lancement..."
if [ ! -f "./yukpomnang_backend" ]; then
    echo "❌ ERREUR: L'exécutable ./yukpomnang_backend n'existe pas!"
    exit 1
fi

echo "✅ Exécutable trouvé"
echo "   Taille: $(stat -f%z ./yukpomnang_backend 2>/dev/null || stat -c%s ./yukpomnang_backend 2>/dev/null || echo 'inconnue') bytes"
echo "   Permissions: $(ls -l ./yukpomnang_backend | awk '{print $1}')"
echo "   Type: $(file ./yukpomnang_backend 2>/dev/null || echo 'inconnu')"

# Vérifier les dépendances si ldd est disponible
if command -v ldd >/dev/null 2>&1; then
    echo "   Dépendances système:"
    ldd ./yukpomnang_backend 2>&1 | head -10 || echo "      (ldd a échoué ou exécutable statique)"
fi

echo ""

# Vérifier la connectivité Redis (AWS ElastiCache) - optionnel et non-bloquant
# ✅ CRITIQUE: Désactiver set -e temporairement pour éviter que le script s'arrête si Redis échoue
set +e
if [ -n "$REDIS_URL" ]; then
    echo "🔍 Vérification de la connectivité Redis (AWS ElastiCache)..."
    # ✅ OPTIMISÉ: Réduire à 3 tentatives max (6 secondes) pour ne pas bloquer le démarrage
    # Redis est optionnel - l'application peut fonctionner sans cache Redis
    MAX_REDIS_RETRIES=3
    RETRY_COUNT=0
    REDIS_AVAILABLE=false
    
    # Vérifier si redis-cli est disponible
    if command -v redis-cli &> /dev/null; then
        echo "   redis-cli disponible, test de connexion..."
        while [ $RETRY_COUNT -lt $MAX_REDIS_RETRIES ]; do
            # Certains providers (ex: Upstash) peuvent répondre avec un message d'erreur tout en
            # renvoyant un code de sortie inattendu: on valide explicitement "PONG".
            REDIS_PING_OUTPUT=$(timeout 3 redis-cli -u "$REDIS_URL" ping 2>&1 || echo "TIMEOUT_OR_ERROR")
            if [ "$REDIS_PING_OUTPUT" = "PONG" ]; then
                REDIS_AVAILABLE=true
                break
            fi

            RETRY_COUNT=$((RETRY_COUNT + 1))
            echo "⏳ En attente de Redis (AWS ElastiCache)... (tentative $RETRY_COUNT/$MAX_REDIS_RETRIES)"
            sleep 2
        done

        if [ "$REDIS_AVAILABLE" = "true" ]; then
            echo "✅ Redis (AWS ElastiCache) accessible"
        else
            echo "⚠️ WARNING: Redis non accessible après $MAX_REDIS_RETRIES tentatives, l'application continuera sans cache Redis"
        fi
    else
        echo "⚠️ WARNING: redis-cli non disponible dans l'image, vérification Redis ignorée"
        echo "   L'application démarrera et tentera de se connecter à Redis au runtime"
    fi
else
    echo "ℹ️ REDIS_URL non définie, l'application fonctionnera sans cache Redis"
fi
# ✅ CRITIQUE: Réactiver set -e après Redis
set -e
echo "✅ Vérification Redis terminée, continuation du script..."

# Appliquer les migrations si nécessaire (optionnel, peut être géré par AWS ECS task séparée)
if [ "$RUN_MIGRATIONS" = "true" ]; then
    echo "🔄 Application des migrations..."
    if [ -f "./yukpomnang_backend" ]; then
        ./yukpomnang_backend migrate || echo "⚠️ Migrations non disponibles ou déjà appliquées"
    else
        echo "⚠️ Exécutable non trouvé, migrations ignorées"
    fi
else
    echo "ℹ️ Migrations ignorées (RUN_MIGRATIONS != true)"
fi

# Vérifier la configuration GPU (optionnel pour AWS ECS avec instances GPU)
if [ "$GPU_ENABLED" = "true" ]; then
    echo "🎮 GPU activé - Vérification des capacités..."
    if command -v nvidia-smi &> /dev/null; then
        echo "✅ GPU NVIDIA détecté"
        nvidia-smi --query-gpu=name,memory.total,memory.free --format=csv,noheader
    else
        echo "⚠️ GPU activé mais non détecté - Fallback vers CPU (normal sur Fargate standard)"
    fi
else
    echo "⚙️ Mode CPU activé (standard AWS Fargate)"
fi

# Optimiser les paramètres système pour AWS ECS/Fargate
echo "⚡ Optimisation des paramètres système pour AWS..."

# Augmenter les limites de fichiers (si permissions disponibles)
if [ -w /proc/sys/fs/file-max ]; then
    ulimit -n 65536 2>/dev/null || echo "⚠️ Impossible de modifier ulimit (permissions insuffisantes)"
fi

# Afficher les informations système
echo "📊 Informations système:"
echo "   - CPU: $(nproc) cores"
if command -v free >/dev/null 2>&1; then
    echo "   - Mémoire: $(free -h | awk '/^Mem:/ {print $2}')"
elif [ -r /proc/meminfo ]; then
    # Fallback minimal (images slim): afficher la mémoire totale en MiB
    MEM_TOTAL_KB=$(awk '/^MemTotal:/ {print $2}' /proc/meminfo 2>/dev/null)
    if [ -n "$MEM_TOTAL_KB" ]; then
        echo "   - Mémoire: $((MEM_TOTAL_KB / 1024)) MiB"
    else
        echo "   - Mémoire: inconnue"
    fi
else
    echo "   - Mémoire: inconnue"
fi
echo "   - Port: $PORT"
echo "   - Host: $HOST"
echo "   - Environnement: $APP_ENV"
echo "   - Région AWS: $AWS_REGION"

# Vérifier que l'exécutable existe
if [ ! -f "./yukpomnang_backend" ]; then
    echo "❌ ERREUR: Exécutable yukpomnang_backend non trouvé!"
    exit 1
fi

# Rendre l'exécutable... exécutable (au cas où)
chmod +x ./yukpomnang_backend

# Démarrer l'application
echo "🚀 Lancement de l'application backend..."
echo "   Command: ./yukpomnang_backend"
echo "   Port: $PORT"
echo "   Host: $HOST"
echo "   Log Level: $RUST_LOG"
echo "   APP_ENV: $APP_ENV"
echo "   DATABASE_URL: ${DATABASE_URL:0:30}... (présent)"
echo "   REDIS_URL: ${REDIS_URL:+présent}${REDIS_URL:-non défini}"
echo "   JWT_SECRET: ${JWT_SECRET:+présent}${JWT_SECRET:-non défini}"

# Les vérifications ont été déplacées AVANT Redis (voir plus haut)
echo "🚀 Lancement de l'application backend..."
echo "   Commande: ./yukpomnang_backend"
echo "   Les logs [MAIN] devraient apparaître ci-dessous..."
echo ""
echo "🔍 Point de contrôle: Avant lancement de l'exécutable"
echo "   DATABASE_URL: ${DATABASE_URL:0:50}..."
echo "   REDIS_URL: ${REDIS_URL:+présent (${#REDIS_URL} caractères)}${REDIS_URL:-non défini}"
echo "   MONGODB_URL: ${MONGODB_URL:+présent (${#MONGODB_URL} caractères)}${MONGODB_URL:-non défini}"
echo "   JWT_SECRET: ${JWT_SECRET:+présent}${JWT_SECRET:-non défini}"
echo ""

# Utiliser exec pour que le processus principal soit le backend
# Cela permet à AWS ECS de gérer correctement les signaux (SIGTERM, etc.)
# Capturer les erreurs et les logger avant de quitter
set +e
echo "🔍 Point de contrôle: Lancement de ./yukpomnang_backend maintenant..."
./yukpomnang_backend 2>&1
EXIT_CODE=$?
set -e

echo "🔍 Point de contrôle: L'exécutable a quitté avec le code $EXIT_CODE"

if [ $EXIT_CODE -ne 0 ]; then
    echo "❌ ERREUR: L'application backend a quitté avec le code $EXIT_CODE"
    echo "   Vérifiez les logs ci-dessus pour plus de détails"
    exit $EXIT_CODE
fi