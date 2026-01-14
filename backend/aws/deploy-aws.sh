#!/bin/bash

# 🚀 Script de déploiement AWS ECS/Fargate pour Yukpomnang Backend
# Usage: ./deploy-aws.sh [environment] [version]
# Exemple: ./deploy-aws.sh production v1.0.0

set -e

ENVIRONMENT=${1:-production}
VERSION=${2:-latest}
AWS_REGION=${AWS_REGION:-us-east-1}
AWS_ACCOUNT_ID=${AWS_ACCOUNT_ID:-YOUR_ACCOUNT_ID}
ECR_REPO_NAME="yukpomnang-backend"
ECR_REPO_URI="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPO_NAME}"
CLUSTER_NAME="yukpomnang-cluster"
SERVICE_NAME="yukpomnang-backend-service"
TASK_FAMILY="yukpomnang-backend"

echo "🚀 Déploiement Yukpomnang Backend sur AWS ECS/Fargate"
echo "=================================================="
echo "Environnement: $ENVIRONMENT"
echo "Version: $VERSION"
echo "Région AWS: $AWS_REGION"
echo "ECR Repository: $ECR_REPO_URI"
echo ""

# Vérifier que AWS CLI est installé
if ! command -v aws &> /dev/null; then
    echo "❌ ERREUR: AWS CLI n'est pas installé"
    echo "   Installez-le avec: pip install awscli"
    exit 1
fi

# Vérifier les credentials AWS
echo "🔐 Vérification des credentials AWS..."
if ! aws sts get-caller-identity &> /dev/null; then
    echo "❌ ERREUR: Credentials AWS non configurés"
    echo "   Configurez avec: aws configure"
    exit 1
fi
echo "✅ Credentials AWS valides"
echo ""

# Se connecter à ECR
echo "📦 Connexion à Amazon ECR..."
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $ECR_REPO_URI
echo "✅ Connecté à ECR"
echo ""

# Build de l'image Docker
echo "🔨 Build de l'image Docker..."
cd "$(dirname "$0")/.."
docker build -f Dockerfile.cloud -t $ECR_REPO_NAME:$VERSION .
docker tag $ECR_REPO_NAME:$VERSION $ECR_REPO_URI:$VERSION
docker tag $ECR_REPO_NAME:$VERSION $ECR_REPO_URI:latest
echo "✅ Image Docker buildée"
echo ""

# Push vers ECR
echo "📤 Push de l'image vers ECR..."
docker push $ECR_REPO_URI:$VERSION
docker push $ECR_REPO_URI:latest
echo "✅ Image poussée vers ECR"
echo ""

# Mettre à jour la task definition
echo "📝 Mise à jour de la task definition..."
TASK_DEF=$(aws ecs describe-task-definition --task-definition $TASK_FAMILY --region $AWS_REGION --query 'taskDefinition' --output json)
NEW_TASK_DEF=$(echo $TASK_DEF | jq --arg IMAGE "$ECR_REPO_URI:$VERSION" '.containerDefinitions[0].image = $IMAGE | del(.taskDefinitionArn) | del(.revision) | del(.status) | del(.requiresAttributes) | del(.compatibilities) | del(.registeredAt) | del(.registeredBy)')
NEW_TASK_DEF_ARN=$(aws ecs register-task-definition --region $AWS_REGION --cli-input-json "$NEW_TASK_DEF" --query 'taskDefinition.taskDefinitionArn' --output text)
echo "✅ Nouvelle task definition créée: $NEW_TASK_DEF_ARN"
echo ""

# Mettre à jour le service ECS
echo "🔄 Mise à jour du service ECS..."
aws ecs update-service \
    --cluster $CLUSTER_NAME \
    --service $SERVICE_NAME \
    --task-definition $NEW_TASK_DEF_ARN \
    --region $AWS_REGION \
    --force-new-deployment \
    --query 'service.serviceName' \
    --output text
echo "✅ Service ECS mis à jour"
echo ""

# Attendre que le déploiement soit terminé
echo "⏳ Attente de la stabilisation du déploiement..."
aws ecs wait services-stable \
    --cluster $CLUSTER_NAME \
    --services $SERVICE_NAME \
    --region $AWS_REGION
echo "✅ Déploiement terminé avec succès!"
echo ""

# Afficher les informations du service
echo "📊 Informations du service:"
aws ecs describe-services \
    --cluster $CLUSTER_NAME \
    --services $SERVICE_NAME \
    --region $AWS_REGION \
    --query 'services[0].{ServiceName:serviceName,Status:status,DesiredCount:desiredCount,RunningCount:runningCount}' \
    --output table

echo ""
echo "🎉 Déploiement terminé!"
echo "   Service: $SERVICE_NAME"
echo "   Cluster: $CLUSTER_NAME"
echo "   Version: $VERSION"
echo "   Image: $ECR_REPO_URI:$VERSION"

