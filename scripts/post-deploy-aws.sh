#!/bin/bash

# 🔧 Script de post-déploiement AWS
# Vérifie et crée la base de données si nécessaire après Terraform

set -e

echo "🔧 Post-déploiement AWS - Vérification de la base de données..."
echo "=========================================="

# Vérifier que Terraform a été appliqué
if [ ! -f "infra/aws/terraform.tfstate" ] && [ ! -f "infra/aws/terraform.tfstate.backup" ]; then
    echo "⚠️ WARNING: Terraform state not found"
    echo "   Run 'terraform apply' first in infra/aws/"
    exit 1
fi

# Récupérer les informations depuis Terraform
cd infra/aws

# Extraire les informations de RDS depuis Terraform output
RDS_ENDPOINT=$(terraform output -raw rds_endpoint 2>/dev/null || echo "")
RDS_USERNAME=$(terraform output -raw rds_username 2>/dev/null || echo "")
RDS_PASSWORD=$(terraform output -raw rds_password 2>/dev/null || echo "")
RDS_DB_NAME=$(terraform output -raw rds_database_name 2>/dev/null || echo "")

# Si les outputs ne sont pas disponibles, essayer depuis terraform.tfvars
if [ -z "$RDS_ENDPOINT" ]; then
    echo "📋 Récupération des informations depuis terraform.tfvars..."
    if [ -f "terraform.tfvars" ]; then
        RDS_DB_NAME=$(grep -E '^\s*rds_database_name\s*=' terraform.tfvars | sed -E 's/.*=\s*"([^"]+)".*/\1/' || echo "yukpo")
        RDS_USERNAME=$(grep -E '^\s*rds_username\s*=' terraform.tfvars | sed -E 's/.*=\s*"([^"]+)".*/\1/' || echo "yukpo_admin")
    fi
    
    # Récupérer l'endpoint depuis AWS
    if command -v aws &> /dev/null; then
        AWS_REGION=$(grep -E '^\s*aws_region\s*=' terraform.tfvars | sed -E 's/.*=\s*"([^"]+)".*/\1/' || echo "eu-west-1")
        PROJECT_NAME=$(grep -E '^\s*project_name\s*=' terraform.tfvars | sed -E 's/.*=\s*"([^"]+)".*/\1/' || echo "yukpo")
        RDS_ENDPOINT=$(aws rds describe-db-instances \
            --db-instance-identifier "${PROJECT_NAME}-db" \
            --region "$AWS_REGION" \
            --query 'DBInstances[0].Endpoint.Address' \
            --output text 2>/dev/null || echo "")
    fi
fi

if [ -z "$RDS_ENDPOINT" ] || [ -z "$RDS_DB_NAME" ]; then
    echo "❌ ERREUR: Impossible de récupérer les informations RDS"
    echo "   Vérifiez que Terraform a été appliqué et que RDS existe"
    exit 1
fi

echo "📊 Informations RDS:"
echo "   Endpoint: $RDS_ENDPOINT"
echo "   Database: $RDS_DB_NAME"
echo "   Username: $RDS_USERNAME"
echo ""

# Vérifier que psql est disponible
if ! command -v psql &> /dev/null; then
    echo "❌ ERREUR: psql n'est pas installé"
    echo "   Installez-le avec: sudo yum install postgresql15 -y"
    exit 1
fi

# Demander le mot de passe si non fourni
if [ -z "$RDS_PASSWORD" ]; then
    echo "🔐 Mot de passe RDS requis"
    read -sp "Entrez le mot de passe pour $RDS_USERNAME: " RDS_PASSWORD
    echo ""
fi

# Construire l'URL de connexion
ADMIN_DB_URL="postgresql://${RDS_USERNAME}:${RDS_PASSWORD}@${RDS_ENDPOINT}/postgres"

# Vérifier la connectivité
echo "🔍 Vérification de la connectivité..."
if ! PGPASSWORD="$RDS_PASSWORD" psql "$ADMIN_DB_URL" -c "SELECT version();" >/dev/null 2>&1; then
    echo "❌ ERREUR: Impossible de se connecter à RDS"
    echo "   Vérifiez vos identifiants et que l'instance RDS est accessible"
    exit 1
fi
echo "✅ Connexion réussie"

# Vérifier si la base existe
echo "🔍 Vérification de l'existence de la base '$RDS_DB_NAME'..."
DB_EXISTS=$(PGPASSWORD="$RDS_PASSWORD" psql "$ADMIN_DB_URL" -tAc "SELECT 1 FROM pg_database WHERE datname='${RDS_DB_NAME}'" 2>/dev/null | tr -d '[:space:]' || echo "0")

if [ "$DB_EXISTS" = "1" ]; then
    echo "✅ La base '$RDS_DB_NAME' existe déjà"
    echo "   Aucune action nécessaire"
    exit 0
fi

# Créer la base de données
echo "🛠️  Création de la base '$RDS_DB_NAME'..."
if PGPASSWORD="$RDS_PASSWORD" psql "$ADMIN_DB_URL" -v ON_ERROR_STOP=1 -c "CREATE DATABASE \"${RDS_DB_NAME}\";" 2>&1; then
    echo "✅ Base '$RDS_DB_NAME' créée avec succès"
else
    echo "❌ ERREUR: Impossible de créer la base '$RDS_DB_NAME'"
    echo "   Vérifiez que l'utilisateur '$RDS_USERNAME' a les permissions nécessaires"
    echo "   Note: Sur AWS RDS, seul le superuser peut créer des bases de données"
    echo ""
    echo "📋 SOLUTION: Créez la base manuellement via AWS RDS Query Editor"
    echo "   1. AWS Console → RDS → ${PROJECT_NAME}-db"
    echo "   2. Ouvrez Query Editor"
    echo "   3. Exécutez: CREATE DATABASE \"${RDS_DB_NAME}\";"
    exit 1
fi

# Vérifier que la base a bien été créée
echo "🔍 Vérification finale..."
if PGPASSWORD="$RDS_PASSWORD" psql "$ADMIN_DB_URL" -tAc "SELECT 1 FROM pg_database WHERE datname='${RDS_DB_NAME}'" 2>/dev/null | grep -q "1"; then
    echo "✅ Base '$RDS_DB_NAME' vérifiée et prête à l'emploi"
    echo ""
    echo "📝 Prochaines étapes:"
    echo "   1. Vérifiez que DATABASE_URL pointe vers la base '$RDS_DB_NAME'"
    echo "   2. Redémarrez le service ECS pour appliquer les migrations"
    echo "   3. Les migrations s'appliqueront automatiquement si ENABLE_AUTO_MIGRATIONS=true"
else
    echo "⚠️  WARNING: La base semble avoir été créée mais la vérification a échoué"
    echo "   Vérifiez manuellement avec: psql \"$ADMIN_DB_URL\" -c \"\\l\""
fi

