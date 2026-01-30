#!/bin/bash
# Script direct pour mettre a jour la task definition ECS avec AWS CLI + jq
# Usage: ./scripts/update-ecs-task-definition-direct.sh

set -euo pipefail

REGION="us-east-1"
PROJECT_NAME="yukpomnang"
ENVIRONMENT="production"
TASK_FAMILY="${PROJECT_NAME}-backend"
CLUSTER_NAME="${PROJECT_NAME}-cluster"
SERVICE_NAME="${PROJECT_NAME}-backend-service"

ACCOUNT_ID=$(aws sts get-caller-identity --region "$REGION" --query 'Account' --output text)

echo "[INFO] Export de la task definition actuelle..."

# Exporter la task definition
aws ecs describe-task-definition \
    --task-definition "$TASK_FAMILY" \
    --region "$REGION" \
    --query 'taskDefinition' \
    --output json > task-def-temp.json

# Ajouter les secrets manquants avec jq
jq --arg account "$ACCOUNT_ID" --arg region "$REGION" --arg project "$PROJECT_NAME" --arg env "$ENVIRONMENT" '
  .containerDefinitions[0].secrets += [
    {
      "name": "ENABLE_AUTO_MIGRATIONS",
      "valueFrom": "arn:aws:ssm:\($region):\($account):parameter/\($project)/\($env)/ENABLE_AUTO_MIGRATIONS"
    },
    {
      "name": "S3_BUCKET",
      "valueFrom": "arn:aws:ssm:\($region):\($account):parameter/\($project)/\($env)/S3_BUCKET"
    },
    {
      "name": "S3_REGION",
      "valueFrom": "arn:aws:ssm:\($region):\($account):parameter/\($project)/\($env)/S3_REGION"
    },
    {
      "name": "UPLOAD_BASE_URL",
      "valueFrom": "arn:aws:ssm:\($region):\($account):parameter/\($project)/\($env)/UPLOAD_BASE_URL"
    }
  ] |
  del(.taskDefinitionArn, .revision, .status, .requiresAttributes, .compatibilities, .registeredAt, .registeredBy)
' task-def-temp.json > task-def-new.json

echo "[INFO] Enregistrement de la nouvelle task definition..."

# Enregistrer
REGISTER_RESULT=$(aws ecs register-task-definition \
    --cli-input-json file://task-def-new.json \
    --region "$REGION" \
    --output json)

NEW_REVISION=$(echo "$REGISTER_RESULT" | jq -r '.taskDefinition.revision')

if [ -z "$NEW_REVISION" ] || [ "$NEW_REVISION" == "null" ]; then
    echo "[ERROR] Echec de l'enregistrement"
    rm -f task-def-temp.json task-def-new.json
    exit 1
fi

echo "[OK] Task definition enregistree (revision: $NEW_REVISION)"

# Mettre a jour le service
echo "[INFO] Mise a jour du service ECS..."

aws ecs update-service \
    --cluster "$CLUSTER_NAME" \
    --service "$SERVICE_NAME" \
    --task-definition "${TASK_FAMILY}:${NEW_REVISION}" \
    --region "$REGION" \
    --force-new-deployment > /dev/null

echo "[OK] Service ECS mis a jour!"
echo "[SUCCESS] Termine! Revision: ${TASK_FAMILY}:${NEW_REVISION}"

# Nettoyer
rm -f task-def-temp.json task-def-new.json




