#!/bin/bash
# ✅ NOUVEAU 2025-12-02: Script pour configurer PostgreSQL read replica
# Usage: ./scripts/setup_postgresql_replica.sh

set -e

echo "🚀 Configuration PostgreSQL Read Replica pour scaling horizontal..."

# Variables
MASTER_HOST=${MASTER_HOST:-localhost}
MASTER_PORT=${MASTER_PORT:-5432}
MASTER_DB=${MASTER_DB:-yukpo_db}
MASTER_USER=${MASTER_USER:-postgres}
REPLICA_HOST=${REPLICA_HOST:-localhost}
REPLICA_PORT=${REPLICA_PORT:-5433}
REPLICA_DB=${REPLICA_DB:-yukpo_db}
REPLICA_USER=${REPLICA_USER:-postgres}

echo "📋 Configuration:"
echo "   Master: $MASTER_USER@$MASTER_HOST:$MASTER_PORT/$MASTER_DB"
echo "   Replica: $REPLICA_USER@$REPLICA_HOST:$REPLICA_PORT/$REPLICA_DB"

# Sur le master: Configurer streaming replication
echo "🔧 Configuration du master PostgreSQL..."
psql -h $MASTER_HOST -p $MASTER_PORT -U $MASTER_USER -d $MASTER_DB <<EOF
-- Créer un utilisateur de réplication
CREATE USER replicator WITH REPLICATION PASSWORD 'replicator_password';

-- Configurer pg_hba.conf (à faire manuellement ou via configuration)
-- host replication replicator 0.0.0.0/0 md5

-- Configurer postgresql.conf
-- wal_level = replica
-- max_wal_senders = 3
-- max_replication_slots = 3
EOF

echo "✅ Master configuré!"
echo "⚠️  Note: Vous devez aussi configurer postgresql.conf et pg_hba.conf sur le master"

# Sur le replica: Initialiser depuis le master
echo "🔧 Configuration du replica PostgreSQL..."
pg_basebackup -h $MASTER_HOST -p $MASTER_PORT -U replicator -D /var/lib/postgresql/data -Fp -Xs -P -R

echo "✅ Replica configuré!"
echo "💡 Configurez DATABASE_READ_REPLICA_URL dans votre application:"
echo "   postgresql://$REPLICA_USER@$REPLICA_HOST:$REPLICA_PORT/$REPLICA_DB"

