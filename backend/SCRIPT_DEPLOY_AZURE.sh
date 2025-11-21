#!/bin/bash
# 🚀 Script de déploiement Azure pour Yukpomnang
# Usage: ./SCRIPT_DEPLOY_AZURE.sh

set -e  # Arrêter en cas d'erreur

echo "🚀 Déploiement Yukpomnang sur Azure"
echo "===================================="

# Variables (à adapter)
RESOURCE_GROUP="yukpomnang-rg"
LOCATION="westeurope"
ACR_NAME="yukpomnangregistry"
DB_NAME="yukpomnang-db"
DB_ADMIN_USER="yukpo_admin"
DB_ADMIN_PASSWORD=""  # À définir
CONTAINER_NAME="yukpomnang-backend"
IMAGE_NAME="yukpomnang-backend:latest"

# Vérifier que Azure CLI est installé
if ! command -v az &> /dev/null; then
    echo "❌ Azure CLI n'est pas installé"
    echo "Installez-le depuis: https://docs.microsoft.com/fr-fr/cli/azure/install-azure-cli"
    exit 1
fi

# Vérifier que Docker est installé
if ! command -v docker &> /dev/null; then
    echo "❌ Docker n'est pas installé"
    exit 1
fi

# Se connecter à Azure
echo "📋 Connexion à Azure..."
az login

# 1. Créer le resource group
echo "📦 Création du resource group..."
az group create --name $RESOURCE_GROUP --location $LOCATION

# 2. Créer Azure Container Registry
echo "🐳 Création de l'Azure Container Registry..."
az acr create --resource-group $RESOURCE_GROUP \
  --name $ACR_NAME \
  --sku Basic \
  --admin-enabled true

# 3. Créer Azure Database for PostgreSQL
echo "🗄️ Création de la base de données PostgreSQL..."
if [ -z "$DB_ADMIN_PASSWORD" ]; then
    echo "⚠️  Mot de passe DB non défini. Génération d'un mot de passe sécurisé..."
    DB_ADMIN_PASSWORD=$(openssl rand -base64 32)
    echo "🔑 Mot de passe généré: $DB_ADMIN_PASSWORD"
    echo "⚠️  SAUVEGARDEZ CE MOT DE PASSE !"
fi

az postgres flexible-server create \
  --resource-group $RESOURCE_GROUP \
  --name $DB_NAME \
  --location $LOCATION \
  --admin-user $DB_ADMIN_USER \
  --admin-password $DB_ADMIN_PASSWORD \
  --sku-name Standard_B1ms \
  --tier Burstable \
  --version 15 \
  --storage-size 32 \
  --public-access 0.0.0.0

# 4. Installer les extensions PostgreSQL
echo "🔌 Installation des extensions PostgreSQL..."
DB_FQDN="$DB_NAME.postgres.database.azure.com"
psql "postgresql://$DB_ADMIN_USER:$DB_ADMIN_PASSWORD@$DB_FQDN/postgres" <<EOF
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS imgsmlr;
EOF

# 5. Build l'image Docker
echo "🔨 Build de l'image Docker..."
cd backend
docker build -f Dockerfile.cloud -t $IMAGE_NAME .

# 6. Tag et push vers ACR
echo "📤 Push de l'image vers Azure Container Registry..."
ACR_LOGIN_SERVER="$ACR_NAME.azurecr.io"
docker tag $IMAGE_NAME $ACR_LOGIN_SERVER/$IMAGE_NAME

# Login ACR
az acr login --name $ACR_NAME

# Push
docker push $ACR_LOGIN_SERVER/$IMAGE_NAME

# 7. Obtenir les credentials ACR
echo "🔑 Récupération des credentials ACR..."
ACR_USERNAME=$(az acr credential show --name $ACR_NAME --query "username" -o tsv)
ACR_PASSWORD=$(az acr credential show --name $ACR_NAME --query "passwords[0].value" -o tsv)

# 8. Déployer sur Azure Container Instances
echo "🚀 Déploiement sur Azure Container Instances..."
az container create \
  --resource-group $RESOURCE_GROUP \
  --name $CONTAINER_NAME \
  --image $ACR_LOGIN_SERVER/$IMAGE_NAME \
  --cpu 2 \
  --memory 4 \
  --registry-login-server $ACR_LOGIN_SERVER \
  --registry-username $ACR_USERNAME \
  --registry-password $ACR_PASSWORD \
  --environment-variables \
    DATABASE_URL="postgresql://$DB_ADMIN_USER:$DB_ADMIN_PASSWORD@$DB_FQDN/yukpomnang" \
    SQLX_OFFLINE="true" \
    RUST_LOG="info" \
  --ports 3001 \
  --ip-address Public

# 9. Obtenir l'IP publique
echo "🌐 Récupération de l'IP publique..."
PUBLIC_IP=$(az container show --resource-group $RESOURCE_GROUP \
  --name $CONTAINER_NAME \
  --query ipAddress.ip \
  --output tsv)

echo ""
echo "✅ Déploiement terminé !"
echo "========================"
echo "📍 IP Publique: $PUBLIC_IP"
echo "🔗 URL: http://$PUBLIC_IP:3001"
echo "🏥 Health Check: http://$PUBLIC_IP:3001/healthz"
echo ""
echo "📋 Informations importantes:"
echo "   - Resource Group: $RESOURCE_GROUP"
echo "   - Database: $DB_FQDN"
echo "   - Database User: $DB_ADMIN_USER"
echo "   - Database Password: $DB_ADMIN_PASSWORD"
echo ""
echo "⚠️  SAUVEGARDEZ CES INFORMATIONS !"

