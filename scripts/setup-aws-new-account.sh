#!/bin/bash
# 🚀 Script de configuration automatique AWS pour nouveau compte
# Optimisé pour l'Afrique (région Cape Town)
# Usage: ./scripts/setup-aws-new-account.sh

set -e  # Arrêter en cas d'erreur

echo "=========================================="
echo "🚀 Configuration Automatique AWS"
echo "   Nouveau compte - Optimisé pour Afrique"
echo "=========================================="
echo ""

# Couleurs pour les messages
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Variables de configuration
AWS_REGION="${AWS_REGION:-af-south-1}"  # Cape Town pour l'Afrique
PROJECT_NAME="yukpomnang"
ENVIRONMENT="production"
TERRAFORM_DIR="infra/aws"

# Vérifier les prérequis
echo "📋 Vérification des prérequis..."
command -v aws >/dev/null 2>&1 || { echo -e "${RED}❌ AWS CLI non installé${NC}"; exit 1; }
command -v terraform >/dev/null 2>&1 || { echo -e "${RED}❌ Terraform non installé${NC}"; exit 1; }
echo -e "${GREEN}✅ Prérequis OK${NC}"
echo ""

# Demander les credentials AWS
echo "🔐 Configuration des credentials AWS"
echo "-----------------------------------"
read -p "AWS Access Key ID: " AWS_ACCESS_KEY_ID
read -sp "AWS Secret Access Key: " AWS_SECRET_ACCESS_KEY
echo ""
read -p "AWS Account ID: " AWS_ACCOUNT_ID
echo ""

# Configurer AWS CLI
echo "⚙️ Configuration AWS CLI..."
aws configure set aws_access_key_id "$AWS_ACCESS_KEY_ID"
aws configure set aws_secret_access_key "$AWS_SECRET_ACCESS_KEY"
aws configure set region "$AWS_REGION"
aws configure set output json

# Vérifier la connexion
echo "🔍 Vérification de la connexion AWS..."
if aws sts get-caller-identity > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Connexion AWS réussie${NC}"
    aws sts get-caller-identity
else
    echo -e "${RED}❌ Erreur de connexion AWS${NC}"
    exit 1
fi
echo ""

# Créer le fichier terraform.tfvars
echo "📝 Création de terraform.tfvars..."
cat > "$TERRAFORM_DIR/terraform.tfvars" <<EOF
# Configuration AWS - Nouveau compte
# Généré automatiquement le $(date)

# AWS Configuration
aws_region  = "$AWS_REGION"
project_name = "$PROJECT_NAME"
environment  = "$ENVIRONMENT"

# Network Configuration
vpc_cidr          = "10.0.0.0/16"
enable_nat_gateway = true

# RDS Configuration (PostgreSQL avec pgvector)
rds_instance_class      = "db.t3.medium"
rds_engine_version      = "15.4"
rds_allocated_storage   = 20
rds_max_allocated_storage = 100
rds_database_name        = "yukpomnang"
rds_username            = "yukpo_admin"
rds_password            = "$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)"
rds_backup_retention    = 7

# ElastiCache Configuration (Redis)
redis_engine_version = "7.0"
redis_node_type      = "cache.t3.small"
redis_num_nodes      = 1

# ECS Configuration (optimisé pour Afrique)
ecs_cpu          = 1024  # 1 vCPU
ecs_memory       = 2048  # 2 GB
ecs_desired_count = 2
ecs_min_count    = 2
ecs_max_count    = 10

# Application Configuration
jwt_secret      = "$(openssl rand -base64 64 | tr -d "=+/" | cut -c1-64)"
rust_log_level  = "info"
health_check_path = "/health"

# Monitoring
enable_container_insights = true
log_retention_days        = 7
EOF

echo -e "${GREEN}✅ terraform.tfvars créé${NC}"
echo ""

# Initialiser Terraform
echo "🔧 Initialisation Terraform..."
cd "$TERRAFORM_DIR"
terraform init
echo ""

# Plan Terraform
echo "📋 Plan d'infrastructure Terraform..."
terraform plan -out=tfplan
echo ""

# Demander confirmation
read -p "🚀 Créer l'infrastructure AWS ? (yes/no): " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
    echo "❌ Annulé"
    exit 0
fi

# Appliquer Terraform
echo "🚀 Création de l'infrastructure AWS..."
terraform apply tfplan
echo ""

# Récupérer les outputs
echo "📊 Récupération des informations de l'infrastructure..."
RDS_ENDPOINT=$(terraform output -raw rds_endpoint)
REDIS_ENDPOINT=$(terraform output -raw redis_endpoint)
ALB_DNS=$(terraform output -raw alb_dns_name)
CLUSTER_NAME=$(terraform output -raw ecs_cluster_name)
SERVICE_NAME=$(terraform output -raw ecs_service_name)
ECR_REPO_URI=$(terraform output -raw ecr_repo_uri)

# Construire DATABASE_URL
DB_PASSWORD=$(terraform output -raw rds_password)
DATABASE_URL="postgresql://yukpo_admin:${DB_PASSWORD}@${RDS_ENDPOINT}:5432/yukpomnang?sslmode=require"

echo ""
echo "=========================================="
echo "✅ Infrastructure AWS créée avec succès!"
echo "=========================================="
echo ""
echo "📋 Informations importantes:"
echo "  • Région: $AWS_REGION (Cape Town - optimisé pour Afrique)"
echo "  • RDS Endpoint: $RDS_ENDPOINT"
echo "  • Redis Endpoint: $REDIS_ENDPOINT"
echo "  • ALB DNS: $ALB_DNS"
echo "  • ECS Cluster: $CLUSTER_NAME"
echo "  • ECS Service: $SERVICE_NAME"
echo "  • ECR Repo: $ECR_REPO_URI"
echo ""

# Stocker DATABASE_URL dans SSM
echo "🔐 Stockage de DATABASE_URL dans AWS SSM..."
SSM_PATH="/yukpomnang/production/DATABASE_URL"
aws ssm put-parameter \
    --name "$SSM_PATH" \
    --value "$DATABASE_URL" \
    --type "SecureString" \
    --overwrite \
    --region "$AWS_REGION" > /dev/null

echo -e "${GREEN}✅ DATABASE_URL stocké dans SSM: $SSM_PATH${NC}"
echo ""

# Créer le fichier de configuration pour GitHub Actions
echo "📝 Création du fichier de configuration GitHub Actions..."
cat > ".github/aws-config.env" <<EOF
# Configuration AWS - Nouveau compte
# Généré automatiquement le $(date)
# ⚠️ NE PAS COMMITER CE FICHIER (déjà dans .gitignore)

AWS_REGION=$AWS_REGION
AWS_ACCOUNT_ID=$AWS_ACCOUNT_ID
ECR_REPO_NAME=yukpomnang-backend
ECR_REPO_URI=$ECR_REPO_URI
SSM_DATABASE_URL_PATH=$SSM_PATH
ECS_CLUSTER_NAME=$CLUSTER_NAME
ECS_SERVICE_NAME=$SERVICE_NAME
ALB_DNS_NAME=$ALB_DNS
EOF

echo -e "${GREEN}✅ Configuration GitHub Actions créée${NC}"
echo ""

# Instructions finales
echo "=========================================="
echo "📋 Prochaines étapes"
echo "=========================================="
echo ""
echo "1. Ajouter les secrets GitHub:"
echo "   • AWS_ACCESS_KEY_ID: $AWS_ACCESS_KEY_ID"
echo "   • AWS_SECRET_ACCESS_KEY: [votre secret key]"
echo ""
echo "2. Mettre à jour .github/workflows/docker-build-optimized.yml:"
echo "   • AWS_REGION: $AWS_REGION"
echo "   • AWS_ACCOUNT_ID: $AWS_ACCOUNT_ID"
echo "   • ECR_REPO_URI: $ECR_REPO_URI"
echo ""
echo "3. Configurer CloudFront CDN (optionnel pour Afrique):"
echo "   • Créer une distribution CloudFront pointant vers $ALB_DNS"
echo "   • Configurer les points de présence en Afrique"
echo ""
echo "4. Tester le déploiement:"
echo "   • Push sur main/master déclenchera le workflow"
echo "   • Les migrations s'exécuteront automatiquement"
echo ""
echo -e "${GREEN}✅ Configuration terminée!${NC}"
echo ""

