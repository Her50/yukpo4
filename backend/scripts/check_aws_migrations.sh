#!/bin/bash
# Script pour vérifier l'état des migrations dans AWS via ECS task
# Usage: ./check_aws_migrations.sh

set -e

echo "🔍 Vérification des migrations dans AWS PostgreSQL..."

# Créer le fichier JSON pour la task ECS
cat > /tmp/check_migrations_task.json << 'EOJSON'
{
  "containerOverrides": [{
    "name": "backend",
    "command": [
      "sh", "-c",
      "cat > /tmp/check_migrations.sql << 'EOSQL' && psql \"$DATABASE_URL\" -f /tmp/check_migrations.sql\n-- Vérification migrations AWS\n\\echo '🔍 ÉTAT DES MIGRATIONS DANS AWS'\n\\echo ''\n-- 1. Table _sqlx_migrations\nSELECT CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '_sqlx_migrations') THEN '✅ Table _sqlx_migrations EXISTE' ELSE '❌ Table _sqlx_migrations MANQUANTE' END as status;\n\\echo ''\n-- 2. Nombre total\nSELECT COUNT(*) as total, COUNT(CASE WHEN success = true THEN 1 END) as successful, COUNT(CASE WHEN success = false THEN 1 END) as failed FROM _sqlx_migrations;\n\\echo ''\n-- 3. Dernières 20 migrations\nSELECT version, description, installed_on, CASE WHEN success THEN '✅' ELSE '❌' END as status FROM _sqlx_migrations ORDER BY installed_on DESC LIMIT 20;\n\\echo ''\n-- 4. Migration 0\nSELECT version, description, installed_on, success FROM _sqlx_migrations WHERE version = 0;\n\\echo ''\n-- 5. Migrations échouées\nSELECT version, description, installed_on FROM _sqlx_migrations WHERE success = false ORDER BY installed_on DESC;\n\\echo ''\n-- 6. Tables critiques\nSELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('users', 'services', 'deliveries', 'products', 'media', 'specialized_reservations') ORDER BY table_name;\nEOSQL"
    ]
  }]
}
EOJSON

# Exécuter la task
echo "🚀 Exécution de la task ECS pour vérifier les migrations..."
TASK_ARN=$(aws ecs run-task \
  --region us-east-1 \
  --cluster yukpomnang-cluster \
  --task-definition yukpomnang-backend:3 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-0d1d2b813746c5f87,subnet-0c6ca723d83535ef5],securityGroups=[sg-0f9210abfa33d52d4],assignPublicIp=ENABLED}" \
  --overrides file:///tmp/check_migrations_task.json \
  --query 'tasks[0].taskArn' \
  --output text)

echo "✅ Task lancée: $TASK_ARN"
echo "⏳ Attente de 10 secondes pour que la task démarre..."
sleep 10

echo "📋 Récupération des logs..."
aws logs tail /ecs/yukpomnang-backend --region us-east-1 --since 1m --format short | grep -E "(🔍|✅|❌|version|description|installed_on|success|total|Table|Migration)" | tail -50

echo ""
echo "✅ Vérification terminée. Consultez les logs ci-dessus pour voir l'état des migrations."




