#!/bin/bash
# Script pour corriger le DATABASE_URL dans AWS SSM Parameter Store
# Usage: ./fix_database_url_aws.sh [RDS_ENDPOINT] [DB_USER] [DB_PASSWORD] [DB_NAME]

set -e

# Couleurs pour les messages
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🔧 Script de Correction DATABASE_URL pour AWS${NC}"
echo ""

# Paramètres
RDS_ENDPOINT="${1:-}"
DB_USER="${2:-yukpo_db_user}"
DB_PASSWORD="${3:-}"
DB_NAME="${4:-yukpo_db}"
REGION="${5:-us-east-1}"
PARAMETER_NAME="/yukpomnang/production/DATABASE_URL"

# Vérifier que AWS CLI est installé
if ! command -v aws &> /dev/null; then
    echo -e "${RED}❌ AWS CLI n'est pas installé${NC}"
    echo "Installez-le depuis: https://aws.amazon.com/cli/"
    exit 1
fi

# Vérifier que les credentials AWS sont configurés
if ! aws sts get-caller-identity &> /dev/null; then
    echo -e "${RED}❌ AWS credentials non configurées${NC}"
    echo "Configurez-les avec: aws configure"
    exit 1
fi

# Si RDS_ENDPOINT n'est pas fourni, essayer de le trouver automatiquement
if [ -z "$RDS_ENDPOINT" ]; then
    echo -e "${YELLOW}⚠️  Endpoint RDS non fourni, tentative de détection automatique...${NC}"
    
    # Lister les bases de données RDS
    RDS_DBS=$(aws rds describe-db-instances \
        --region "$REGION" \
        --query 'DBInstances[?Engine==`postgres`].[DBInstanceIdentifier,Endpoint.Address]' \
        --output text)
    
    if [ -z "$RDS_DBS" ]; then
        echo -e "${RED}❌ Aucune base de données PostgreSQL trouvée dans RDS${NC}"
        echo ""
        echo "Trouvez manuellement l'endpoint RDS:"
        echo "1. Console AWS → RDS → Databases"
        echo "2. Sélectionnez votre base de données PostgreSQL"
        echo "3. Copiez l'endpoint (ex: yukpomnang-db.xxxxx.us-east-1.rds.amazonaws.com)"
        echo ""
        echo "Usage: $0 <RDS_ENDPOINT> [DB_USER] [DB_PASSWORD] [DB_NAME]"
        exit 1
    fi
    
    echo -e "${GREEN}✅ Bases de données PostgreSQL trouvées:${NC}"
    echo "$RDS_DBS" | while read -r db_id endpoint; do
        echo "  - $db_id: $endpoint"
    done
    
    # Prendre le premier endpoint
    RDS_ENDPOINT=$(echo "$RDS_DBS" | head -n 1 | awk '{print $2}')
    echo ""
    echo -e "${YELLOW}⚠️  Utilisation du premier endpoint trouvé: $RDS_ENDPOINT${NC}"
    echo "   Si ce n'est pas le bon, spécifiez-le manuellement:"
    echo "   $0 $RDS_ENDPOINT [DB_USER] [DB_PASSWORD] [DB_NAME]"
    echo ""
fi

# Demander le mot de passe si non fourni
if [ -z "$DB_PASSWORD" ]; then
    echo -e "${YELLOW}⚠️  Mot de passe non fourni${NC}"
    read -sp "Entrez le mot de passe de la base de données: " DB_PASSWORD
    echo ""
fi

# Construire le DATABASE_URL
# Format: postgresql://user:password@host:port/database?sslmode=require
DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@${RDS_ENDPOINT}:5432/${DB_NAME}?sslmode=require"

echo -e "${GREEN}✅ DATABASE_URL construit:${NC}"
echo "   postgresql://${DB_USER}:***@${RDS_ENDPOINT}:5432/${DB_NAME}?sslmode=require"
echo ""

# Vérifier que le paramètre existe
echo -e "${YELLOW}🔍 Vérification du paramètre SSM...${NC}"
if aws ssm get-parameter --name "$PARAMETER_NAME" --region "$REGION" &> /dev/null; then
    echo -e "${GREEN}✅ Paramètre trouvé: $PARAMETER_NAME${NC}"
    
    # Afficher l'ancienne valeur (masquée)
    OLD_VALUE=$(aws ssm get-parameter \
        --name "$PARAMETER_NAME" \
        --region "$REGION" \
        --with-decryption \
        --query 'Parameter.Value' \
        --output text)
    
    OLD_ENDPOINT=$(echo "$OLD_VALUE" | sed -n 's/.*@\([^:]*\):.*/\1/p')
    echo -e "${YELLOW}   Ancienne valeur: postgresql://***@${OLD_ENDPOINT}:***/***${NC}"
else
    echo -e "${YELLOW}⚠️  Paramètre non trouvé, création...${NC}"
fi

echo ""
read -p "Voulez-vous mettre à jour le paramètre SSM? (y/N): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}⚠️  Opération annulée${NC}"
    exit 0
fi

# Mettre à jour le paramètre SSM
echo -e "${YELLOW}🔄 Mise à jour du paramètre SSM...${NC}"
aws ssm put-parameter \
    --name "$PARAMETER_NAME" \
    --value "$DATABASE_URL" \
    --type "SecureString" \
    --region "$REGION" \
    --overwrite

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Paramètre SSM mis à jour avec succès!${NC}"
    echo ""
    echo -e "${YELLOW}⚠️  IMPORTANT: Redéployez le service ECS pour que les changements prennent effet${NC}"
    echo ""
    echo "Pour redéployer:"
    echo "1. Console AWS → ECS → Clusters → yukpomnang-cluster"
    echo "2. Services → yukpomnang-backend-service"
    echo "3. Update → Force new deployment"
    echo ""
    echo "Ou via AWS CLI:"
    echo "aws ecs update-service --cluster yukpomnang-cluster --service yukpomnang-backend-service --force-new-deployment --region $REGION"
else
    echo -e "${RED}❌ Erreur lors de la mise à jour du paramètre SSM${NC}"
    exit 1
fi

