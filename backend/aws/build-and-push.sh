#!/bin/bash

# 🔨 Script pour build et push de l'image Docker vers ECR
# Usage: ./build-and-push.sh [version] [region]
# Exemple: ./build-and-push.sh v1.0.0 us-east-1

set -e

VERSION=${1:-latest}
AWS_REGION=${2:-us-east-1}
AWS_ACCOUNT_ID=${AWS_ACCOUNT_ID:-YOUR_ACCOUNT_ID}
ECR_REPO_NAME="yukpomnang-backend"
ECR_REPO_URI="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPO_NAME}"

echo "🔨 Build et Push de l'image Docker"
echo "===================================="
echo "Version: $VERSION"
echo "Région: $AWS_REGION"
echo "ECR Repository: $ECR_REPO_URI"
echo ""

# Vérifier que Docker est installé
if ! command -v docker &> /dev/null; then
    echo "❌ ERREUR: Docker n'est pas installé"
    exit 1
fi

# Vérifier que AWS CLI est installé
if ! command -v aws &> /dev/null; then
    echo "❌ ERREUR: AWS CLI n'est pas installé"
    exit 1
fi

# Se connecter à ECR
echo "📦 Connexion à Amazon ECR..."
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $ECR_REPO_URI
echo "✅ Connecté à ECR"
echo ""

# Build de l'image Docker
echo "🔨 Build de l'image Docker (Dockerfile.cloud)..."
cd "$(dirname "$0")/.."
docker build -f Dockerfile.cloud -t $ECR_REPO_NAME:$VERSION .
docker tag $ECR_REPO_NAME:$VERSION $ECR_REPO_URI:$VERSION
docker tag $ECR_REPO_NAME:$VERSION $ECR_REPO_URI:latest
echo "✅ Image Docker buildée"
echo ""

# Afficher la taille de l'image
echo "📊 Taille de l'image:"
docker images $ECR_REPO_NAME:$VERSION --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}"
echo ""

# Push vers ECR
echo "📤 Push de l'image vers ECR..."
docker push $ECR_REPO_URI:$VERSION
docker push $ECR_REPO_URI:latest
echo "✅ Image poussée vers ECR"
echo ""

echo "🎉 Build et Push terminés!"
echo "   Image: $ECR_REPO_URI:$VERSION"
echo "   Image: $ECR_REPO_URI:latest"






