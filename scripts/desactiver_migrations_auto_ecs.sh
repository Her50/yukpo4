#!/bin/bash
# =====================================================
# Script pour Désactiver les Migrations Automatiques dans ECS
# Date: 2026-02-14
# =====================================================

set -e

# Configuration
CLUSTER_NAME="yukpo-cluster"
SERVICE_NAME="yukpo-backend-service"
REGION="eu-west-1"

# Couleurs
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}🔧 Désactivation des Migrations Automatiques${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# 1. Récupérer la task definition actuelle
echo -e "${YELLOW}📋 Récupération de la task definition actuelle...${NC}"
TASK_DEF=$(aws ecs describe-services \
  --cluster "$CLUSTER_NAME" \
  --services "$SERVICE_NAME" \
  --region "$REGION" \
  --query 'services[0].taskDefinition' \
  --output text 2>/dev/null)

if [ -z "$TASK_DEF" ]; then
    echo -e "${RED}❌ Impossible de récupérer la task definition${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Task Definition actuelle: $TASK_DEF${NC}"
echo ""

# 2. Récupérer la définition complète
echo -e "${YELLOW}📥 Téléchargement de la définition complète...${NC}"
aws ecs describe-task-definition \
  --task-definition "$TASK_DEF" \
  --region "$REGION" \
  --query 'taskDefinition' > /tmp/task-def-original.json

if [ ! -f /tmp/task-def-original.json ]; then
    echo -e "${RED}❌ Échec du téléchargement${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Définition récupérée${NC}"
echo ""

# 3. Vérifier si ENABLE_AUTO_MIGRATIONS existe déjà
echo -e "${YELLOW}🔍 Vérification des variables d'environnement...${NC}"
if grep -q "ENABLE_AUTO_MIGRATIONS" /tmp/task-def-original.json; then
    echo -e "${YELLOW}⚠️  ENABLE_AUTO_MIGRATIONS existe déjà, mise à jour...${NC}"
else
    echo -e "${GREEN}ℹ️  ENABLE_AUTO_MIGRATIONS n'existe pas, ajout...${NC}"
fi

# 4. Modifier avec Python (plus fiable que jq)
echo -e "${YELLOW}🔧 Modification de la task definition...${NC}"
python3 << 'PYTHON_SCRIPT'
import json
import sys

try:
    # Lire la task definition
    with open('/tmp/task-def-original.json', 'r') as f:
        task_def = json.load(f)
    
    # S'assurer que containerDefinitions existe
    if not task_def.get('containerDefinitions') or len(task_def['containerDefinitions']) == 0:
        print("❌ Aucun conteneur trouvé dans la task definition")
        sys.exit(1)
    
    container = task_def['containerDefinitions'][0]
    
    # Initialiser environment si n'existe pas
    if 'environment' not in container:
        container['environment'] = []
    
    # Vérifier si ENABLE_AUTO_MIGRATIONS existe
    env_vars = container['environment']
    found = False
    
    for i, env in enumerate(env_vars):
        if env.get('name') == 'ENABLE_AUTO_MIGRATIONS':
            env['value'] = 'false'
            found = True
            print("✅ Variable ENABLE_AUTO_MIGRATIONS mise à jour à 'false'")
            break
    
    if not found:
        env_vars.append({'name': 'ENABLE_AUTO_MIGRATIONS', 'value': 'false'})
        print("✅ Variable ENABLE_AUTO_MIGRATIONS ajoutée avec valeur 'false'")
    
    # Supprimer les champs non modifiables
    for field in ['taskDefinitionArn', 'revision', 'status', 'requiresAttributes', 'compatibilities', 'registeredAt', 'registeredBy']:
        task_def.pop(field, None)
    
    # Sauvegarder
    with open('/tmp/task-def-final.json', 'w') as f:
        json.dump(task_def, f, indent=2)
    
    print("✅ Task Definition modifiée avec succès")
    
except Exception as e:
    print(f"❌ Erreur: {e}")
    sys.exit(1)
PYTHON_SCRIPT

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Échec de la modification${NC}"
    exit 1
fi

echo ""

# 5. Enregistrer la nouvelle task definition
echo -e "${YELLOW}📝 Enregistrement de la nouvelle task definition...${NC}"
NEW_TASK_DEF=$(aws ecs register-task-definition \
  --cli-input-json file:///tmp/task-def-final.json \
  --region "$REGION" \
  --query 'taskDefinition.taskDefinitionArn' \
  --output text 2>/dev/null)

if [ -z "$NEW_TASK_DEF" ]; then
    echo -e "${RED}❌ Échec de l'enregistrement${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Nouvelle Task Definition créée: $NEW_TASK_DEF${NC}"
echo ""

# 6. Mettre à jour le service ECS
echo -e "${YELLOW}🔄 Mise à jour du service ECS...${NC}"
aws ecs update-service \
  --cluster "$CLUSTER_NAME" \
  --service "$SERVICE_NAME" \
  --task-definition "$NEW_TASK_DEF" \
  --region "$REGION" \
  --force-new-deployment > /dev/null 2>&1

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Service ECS mis à jour avec succès${NC}"
    echo -e "${YELLOW}🔄 Le service va redémarrer avec la nouvelle configuration${NC}"
    echo ""
    echo -e "${BLUE}📊 Vérification du statut du service...${NC}"
    echo "   Attendez quelques secondes, puis vérifiez :"
    echo "   aws ecs describe-services --cluster $CLUSTER_NAME --services $SERVICE_NAME --region $REGION"
else
    echo -e "${RED}❌ Échec de la mise à jour du service${NC}"
    exit 1
fi

# Nettoyage
rm -f /tmp/task-def-original.json /tmp/task-def-final.json

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✅ Migration automatique désactivée !${NC}"
echo -e "${GREEN}========================================${NC}"



