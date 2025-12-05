#!/bin/bash
# ✅ NOUVEAU 2025-12-02: Script pour initialiser Redis cluster
# Usage: ./scripts/setup_redis_cluster.sh

set -e

echo "🚀 Configuration Redis Cluster pour scaling horizontal..."

# Variables
REDIS_PASSWORD=${REDIS_PASSWORD:-changeme}
REDIS_NODES="redis-master-1:6379 redis-master-2:6379 redis-master-3:6379 redis-replica-1:6379 redis-replica-2:6379 redis-replica-3:6379"

echo "📋 Nœuds Redis: $REDIS_NODES"

# Attendre que tous les nœuds soient prêts
echo "⏳ Attente que tous les nœuds Redis soient prêts..."
sleep 15

# Initialiser le cluster
echo "🔧 Initialisation du cluster Redis..."
redis-cli --cluster create $REDIS_NODES \
  --cluster-replicas 1 \
  -a "$REDIS_PASSWORD" \
  --cluster-yes

echo "✅ Cluster Redis initialisé avec succès!"
echo "📊 Vérification du cluster..."
redis-cli -h redis-master-1 -p 6379 -a "$REDIS_PASSWORD" cluster nodes

echo "🎉 Configuration terminée!"
echo "💡 Configurez REDIS_CLUSTER_NODES dans votre application:"
echo "   redis://redis-master-1:6379,redis://redis-master-2:6379,redis://redis-master-3:6379"

