#!/bin/bash
# Script Bash pour mettre à jour la task definition ECS avec ENABLE_AUTO_MIGRATIONS + S3
# Usage: ./scripts/update-ecs-task-definition-s3-migrations.sh

set -euo pipefail

# Configuration
REGION="us-east-1"
PROJECT_NAME="yukpomnang"
ENVIRONMENT="production"
TASK_FAMILY="${PROJECT_NAME}-backend"
CLUSTER_NAME="${PROJECT_NAME}-cluster"
SERVICE_NAME="${PROJECT_NAME}-backend-service"

echo "🔍 Récupération de la task definition actuelle..."

# Récupérer la task definition actuelle
CURRENT_TASK_DEF=$(aws ecs describe-task-definition \
    --task-definition "$TASK_FAMILY" \
    --region "$REGION" \
    --query 'taskDefinition' \
    --output json)

if [ -z "$CURRENT_TASK_DEF" ]; then
    echo "❌ Impossible de récupérer la task definition '$TASK_FAMILY'"
    exit 1
fi

REVISION=$(echo "$CURRENT_TASK_DEF" | jq -r '.revision')
echo "✅ Task definition récupérée (revision: $REVISION)"

# Récupérer l'ARN du secret Secrets Manager
echo "🔍 Récupération de l'ARN du secret Secrets Manager..."
SECRET_ARN=$(aws secretsmanager describe-secret \
    --secret-id "${PROJECT_NAME}/backend/secrets" \
    --region "$REGION" \
    --query 'ARN' \
    --output text)

if [ -z "$SECRET_ARN" ]; then
    echo "❌ Impossible de récupérer le secret Secrets Manager"
    exit 1
fi

echo "✅ Secret ARN: $SECRET_ARN"

# Récupérer l'account ID
ACCOUNT_ID=$(aws sts get-caller-identity --region "$REGION" --query 'Account' --output text)

# Sauvegarder la task definition dans un fichier temporaire
TEMP_FILE=$(mktemp)
echo "$CURRENT_TASK_DEF" > "$TEMP_FILE"

# Extraire la définition du conteneur
CONTAINER_DEF=$(echo "$CURRENT_TASK_DEF" | jq '.containerDefinitions[0]')

# Vérifier et ajouter ENABLE_AUTO_MIGRATIONS
HAS_ENABLE_AUTO_MIGRATIONS=$(echo "$CONTAINER_DEF" | jq '.secrets[]? | select(.name == "ENABLE_AUTO_MIGRATIONS")')
if [ -z "$HAS_ENABLE_AUTO_MIGRATIONS" ]; then
    echo "➕ Ajout de ENABLE_AUTO_MIGRATIONS aux secrets..."
    CONTAINER_DEF=$(echo "$CONTAINER_DEF" | jq --arg arn "${SECRET_ARN}:ENABLE_AUTO_MIGRATIONS::" \
        '.secrets += [{"name": "ENABLE_AUTO_MIGRATIONS", "valueFrom": $arn}]')
else
    echo "ℹ️  ENABLE_AUTO_MIGRATIONS existe déjà"
fi

# Ajouter les paramètres S3 depuis SSM Parameter Store
S3_PARAMS=(
    "S3_BUCKET:/${PROJECT_NAME}/${ENVIRONMENT}/S3_BUCKET"
    "S3_REGION:/${PROJECT_NAME}/${ENVIRONMENT}/S3_REGION"
    "S3_ACCESS_KEY:/${PROJECT_NAME}/${ENVIRONMENT}/S3_ACCESS_KEY"
    "S3_SECRET_KEY:/${PROJECT_NAME}/${ENVIRONMENT}/S3_SECRET_KEY"
    "UPLOAD_BASE_URL:/${PROJECT_NAME}/${ENVIRONMENT}/UPLOAD_BASE_URL"
)

for PARAM_SPEC in "${S3_PARAMS[@]}"; do
    PARAM_NAME="${PARAM_SPEC%%:*}"
    PARAM_PATH="${PARAM_SPEC#*:}"
    
    HAS_PARAM=$(echo "$CONTAINER_DEF" | jq --arg name "$PARAM_NAME" '.secrets[]? | select(.name == $name)')
    if [ -z "$HAS_PARAM" ]; then
        echo "➕ Ajout de $PARAM_NAME depuis SSM..."
        PARAM_ARN="arn:aws:ssm:${REGION}:${ACCOUNT_ID}:parameter${PARAM_PATH}"
        CONTAINER_DEF=$(echo "$CONTAINER_DEF" | jq --arg name "$PARAM_NAME" --arg arn "$PARAM_ARN" \
            '.secrets += [{"name": $name, "valueFrom": $arn}]')
    else
        echo "ℹ️  $PARAM_NAME existe déjà"
    fi
done

# Reconstruire la task definition complète
NEW_TASK_DEF=$(echo "$CURRENT_TASK_DEF" | jq --argjson container "$CONTAINER_DEF" \
    '.containerDefinitions = [$container] | del(.taskDefinitionArn) | del(.revision) | del(.status) | del(.requiresAttributes) | del(.compatibilities) | del(.registeredAt) | del(.registeredBy)')

# Sauvegarder dans un fichier temporaire
NEW_TASK_DEF_FILE=$(mktemp)
echo "$NEW_TASK_DEF" > "$NEW_TASK_DEF_FILE"

echo "📝 Nouvelle task definition sauvegardée dans: $NEW_TASK_DEF_FILE"
echo "🚀 Enregistrement de la nouvelle task definition..."

# Enregistrer la nouvelle task definition
REGISTER_RESULT=$(aws ecs register-task-definition \
    --cli-input-json "file://$NEW_TASK_DEF_FILE" \
    --region "$REGION" \
    --output json)

NEW_REVISION=$(echo "$REGISTER_RESULT" | jq -r '.taskDefinition.revision')

if [ -z "$NEW_REVISION" ] || [ "$NEW_REVISION" == "null" ]; then
    echo "❌ Échec de l'enregistrement de la task definition"
    rm -f "$TEMP_FILE" "$NEW_TASK_DEF_FILE"
    exit 1
fi

echo "✅ Nouvelle task definition enregistrée (revision: $NEW_REVISION)"

# Mettre à jour le service ECS
echo "🔄 Mise à jour du service ECS..."

UPDATE_RESULT=$(aws ecs update-service \
    --cluster "$CLUSTER_NAME" \
    --service "$SERVICE_NAME" \
    --task-definition "${TASK_FAMILY}:${NEW_REVISION}" \
    --region "$REGION" \
    --force-new-deployment \
    --output json)

if [ -z "$UPDATE_RESULT" ]; then
    echo "❌ Échec de la mise à jour du service"
    rm -f "$TEMP_FILE" "$NEW_TASK_DEF_FILE"
    exit 1
fi

echo "✅ Service ECS mis à jour avec succès!"
echo "📊 Nouvelle task definition: ${TASK_FAMILY}:${NEW_REVISION}"
echo "⏳ Le déploiement est en cours. Vérifiez les logs CloudWatch pour suivre le démarrage."

# Nettoyer
rm -f "$TEMP_FILE" "$NEW_TASK_DEF_FILE"

echo ""
echo "🎉 Terminé! Les nouvelles variables d'environnement seront disponibles après le redémarrage des conteneurs."
echo ""
echo "Variables ajoutées:"
echo "  - ENABLE_AUTO_MIGRATIONS (depuis Secrets Manager)"
echo "  - S3_BUCKET (depuis SSM Parameter Store)"
echo "  - S3_REGION (depuis SSM Parameter Store)"
echo "  - S3_ACCESS_KEY (depuis SSM Parameter Store)"
echo "  - S3_SECRET_KEY (depuis SSM Parameter Store)"
echo "  - UPLOAD_BASE_URL (depuis SSM Parameter Store)"




