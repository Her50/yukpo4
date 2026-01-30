#!/bin/bash
# Script pour exécuter les corrections SQL via ECS Task
# Usage: ./execute_fix_via_ecs.sh

set -e

REGION="us-east-1"
CLUSTER="yukpomnang-cluster"
TASK_DEFINITION="yukpomnang-backend:3"
SUBNETS="subnet-0d1d2b813746c5f87,subnet-0c6ca723d83535ef5"
SECURITY_GROUPS="sg-0f9210abfa33d52d4"

# Lire le script SQL
SCRIPT_FILE="fix_critical.sql"
if [ ! -f "$SCRIPT_FILE" ]; then
    echo "❌ Fichier $SCRIPT_FILE non trouvé"
    exit 1
fi

# Encoder le script en base64 (sans retours à la ligne)
SCRIPT_B64=$(cat "$SCRIPT_FILE" | base64 -w 0)

# Créer le JSON avec jq
OVERRIDES_JSON=$(jq -n \
    --arg cmd "echo '$SCRIPT_B64' | base64 -d | psql \"\$DATABASE_URL\"" \
    '{
        containerOverrides: [{
            name: "backend",
            command: ["sh", "-c", $cmd]
        }]
    }')

# Exécuter la task
echo "🚀 Exécution de la task ECS..."
TASK_ARN=$(aws ecs run-task \
    --region "$REGION" \
    --cluster "$CLUSTER" \
    --task-definition "$TASK_DEFINITION" \
    --launch-type FARGATE \
    --network-configuration "awsvpcConfiguration={subnets=[$SUBNETS],securityGroups=[$SECURITY_GROUPS],assignPublicIp=ENABLED}" \
    --overrides "$OVERRIDES_JSON" \
    --query 'tasks[0].taskArn' \
    --output text)

echo "✅ Task créée: $TASK_ARN"
echo "📋 Vérifiez les logs avec:"
echo "   aws logs tail /ecs/yukpomnang-backend --region $REGION --follow"


