#!/bin/bash
# Script pour rebuild et push l'image Docker corrigée

set -e

echo "========================================"
echo "  REBUILD IMAGE DOCKER CORRIGÉE"
echo "========================================"
echo ""

# Variables
REGION="eu-west-1"
ECR_REPO="108964700972.dkr.ecr.${REGION}.amazonaws.com/yukpo-backend"
IMAGE_TAG="latest"
FIXED_TAG="fixed-$(date +%Y%m%d-%H%M%S)"
DOCKERFILE="backend/Dockerfile.cloud.fixed"

# Vérifier que le Dockerfile existe
if [ ! -f "$DOCKERFILE" ]; then
    echo "❌ ERREUR: Dockerfile corrigé non trouvé: $DOCKERFILE"
    exit 1
fi

echo "✅ Dockerfile trouvé: $DOCKERFILE"
echo ""

# Login à ECR
echo "🔐 Login à AWS ECR..."
aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin $ECR_REPO

# Build l'image avec architecture explicitement spécifiée
echo ""
echo "🔨 Build de l'image Docker..."
docker build \
    --platform linux/amd64 \
    --file $DOCKERFILE \
    --tag ${ECR_REPO}:${IMAGE_TAG} \
    --tag ${ECR_REPO}:${FIXED_TAG} \
    --progress=plain \
    backend/

# Vérifier que l'image a été créée
if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Build réussi!"
    echo ""
    echo "📊 Informations sur l'image:"
    docker images ${ECR_REPO}:${IMAGE_TAG} --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}\t{{.CreatedAt}}"
    echo ""
    
    # Vérifier l'architecture de l'exécutable dans l'image
    echo "🔍 Vérification de l'exécutable dans l'image..."
    docker run --rm ${ECR_REPO}:${IMAGE_TAG} file /app/yukpomnang_backend
    docker run --rm ${ECR_REPO}:${IMAGE_TAG} ldd /app/yukpomnang_backend 2>&1 | head -10 || echo "⚠️ ldd non disponible ou exécutable statique"
    echo ""
    
    # Push vers ECR
    echo "📤 Push vers ECR..."
    docker push ${ECR_REPO}:${IMAGE_TAG}
    docker push ${ECR_REPO}:${FIXED_TAG}
    
    if [ $? -eq 0 ]; then
        echo ""
        echo "✅ Image poussée avec succès vers ECR!"
        echo ""
        echo "🚀 Prochaines étapes:"
        echo "   1. Redémarrer le service ECS:"
        echo "      aws ecs update-service --cluster yukpo-cluster --service yukpo-backend-service --force-new-deployment --region $REGION"
        echo ""
        echo "   2. Vérifier les logs après redémarrage:"
        echo "      aws logs tail /ecs/yukpo-backend --follow --region $REGION"
        echo ""
        echo "   3. Vérifier l'état du service:"
        echo "      aws ecs describe-services --cluster yukpo-cluster --services yukpo-backend-service --region $REGION"
    fi
else
    echo ""
    echo "❌ ERREUR: Build échoué"
    exit 1
fi

