#!/bin/bash

# 🚀 Script de démarrage pour l'architecture cloud massive
set -e

echo "🚀 Démarrage de YukpoMnang Cloud Architecture..."

# Vérifier les variables d'environnement critiques
if [ -z "$DATABASE_URL" ]; then
    echo "❌ ERREUR: DATABASE_URL non définie"
    exit 1
fi

if [ -z "$REDIS_URL" ]; then
    echo "❌ ERREUR: REDIS_URL non définie"
    exit 1
fi

# Vérifier la connectivité à la base de données
echo "🔍 Vérification de la connectivité à la base de données..."
until pg_isready -h $(echo $DATABASE_URL | sed 's/.*@\([^:]*\).*/\1/') -p 5432; do
    echo "⏳ En attente de la base de données..."
    sleep 2
done
echo "✅ Base de données accessible"

# Vérifier la connectivité Redis
echo "🔍 Vérification de la connectivité Redis..."
until redis-cli -u $REDIS_URL ping; do
    echo "⏳ En attente de Redis..."
    sleep 2
done
echo "✅ Redis accessible"

# Appliquer les migrations si nécessaire
echo "🔄 Application des migrations..."
./yukpomnang_backend migrate

# Vérifier la configuration GPU
if [ "$GPU_ENABLED" = "true" ]; then
    echo "🎮 GPU activé - Vérification des capacités..."
    if command -v nvidia-smi &> /dev/null; then
        echo "✅ GPU NVIDIA détecté"
        nvidia-smi --query-gpu=name,memory.total,memory.free --format=csv
    else
        echo "⚠️ GPU activé mais non détecté - Fallback vers CPU"
    fi
else
    echo "⚙️ Mode CPU activé"
fi

# Optimiser les paramètres système pour les performances
echo "⚡ Optimisation des paramètres système..."

# Augmenter les limites de fichiers
ulimit -n 65536

# Optimiser les paramètres réseau
echo "net.core.somaxconn = 65535" >> /etc/sysctl.conf
echo "net.ipv4.tcp_max_syn_backlog = 65535" >> /etc/sysctl.conf
echo "net.core.netdev_max_backlog = 5000" >> /etc/sysctl.conf

# Démarrer l'application avec les optimisations
echo "🚀 Lancement de l'application..."
exec ./yukpomnang_backend \
    --host 0.0.0.0 \
    --port 8080 \
    --workers $(nproc) \
    --max-connections 10000 \
    --keep-alive 30 \
    --timeout 60 