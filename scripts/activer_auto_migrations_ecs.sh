#!/bin/bash
# Script pour activer temporairement les auto-migrations dans ECS
# Usage: ./activer_auto_migrations_ecs.sh

set -e

CLUSTER="yukpo-cluster"
SERVICE="yukpo-backend-service"
REGION="eu-west-1"

echo "🔧 Activation des auto-migrations dans ECS..."
echo "Cluster: $CLUSTER"
echo "Service: $SERVICE"
echo "Region: $REGION"
echo ""

# 1. Récupérer la task definition actuelle
echo "📋 Récupération de la task definition actuelle..."
TASK_DEF=$(aws ecs describe-services \
  --cluster "$CLUSTER" \
  --services "$SERVICE" \
  --region "$REGION" \
  --query 'services[0].taskDefinition' \
  --output text)

echo "✅ Task Definition actuelle: $TASK_DEF"
echo ""

# 2. Récupérer la définition complète
echo "📥 Téléchargement de la définition complète..."
aws ecs describe-task-definition \
  --task-definition "$TASK_DEF" \
  --region "$REGION" \
  --query 'taskDefinition' > /tmp/task-def-current.json

# 3. Vérifier si jq est installé
if ! command -v jq &> /dev/null; then
    echo "❌ Erreur: jq n'est pas installé. Installation..."
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        sudo apt-get update && sudo apt-get install -y jq
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        brew install jq
    else
        echo "❌ Veuillez installer jq manuellement"
        exit 1
    fi
fi

# 4. Modifier la task definition pour ajouter ENABLE_AUTO_MIGRATIONS=true
echo "✏️ Modification de la task definition..."
jq '.containerDefinitions[0].environment = (.containerDefinitions[0].environment // [] | map(select(.name != "ENABLE_AUTO_MIGRATIONS")) + [{"name": "ENABLE_AUTO_MIGRATIONS", "value": "true"}])' /tmp/task-def-current.json > /tmp/task-def-updated.json

# 5. Supprimer les champs non modifiables
echo "🧹 Nettoyage des champs non modifiables..."
jq 'del(.taskDefinitionArn, .revision, .status, .requiresAttributes, .compatibilities, .registeredAt, .registeredBy)' /tmp/task-def-updated.json > /tmp/task-def-final.json

# 6. Enregistrer la nouvelle task definition
echo "📝 Enregistrement de la nouvelle task definition..."
NEW_TASK_DEF=$(aws ecs register-task-definition \
  --cli-input-json file:///tmp/task-def-final.json \
  --region "$REGION" \
  --query 'taskDefinition.taskDefinitionArn' \
  --output text)

echo "✅ Nouvelle Task Definition: $NEW_TASK_DEF"
echo ""

# 7. Mettre à jour le service
echo "🚀 Mise à jour du service..."
aws ecs update-service \
  --cluster "$CLUSTER" \
  --service "$SERVICE" \
  --task-definition "$NEW_TASK_DEF" \
  --region "$REGION" \
  --force-new-deployment

echo ""
echo "✅ Service mis à jour, déploiement en cours..."
echo ""
echo "📊 Surveiller le déploiement avec:"
echo "   aws ecs describe-services --cluster $CLUSTER --services $SERVICE --region $REGION --query 'services[0].deployments[*].[status,desiredCount,runningCount]' --output table"
echo ""
echo "⚠️ IMPORTANT: N'oubliez pas de désactiver les auto-migrations après les tests !"

