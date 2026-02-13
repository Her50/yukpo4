#!/bin/bash

# 🔄 Script de Transfert des Variables d'Environnement
# Ancien Compte AWS → Nouveau Compte AWS

set -e

# Configuration
OLD_REGION="${OLD_REGION:-us-east-1}"
NEW_REGION="${NEW_REGION:-eu-west-1}"
OLD_PROFILE="${OLD_PROFILE:-ancien-compte}"
NEW_PROFILE="${NEW_PROFILE:-default}"
OLD_PATH="${OLD_PATH:-/yukpomnang/production}"
NEW_PATH="${NEW_PATH:-/yukpo/production}"
OLD_SECRET_NAME="${OLD_SECRET_NAME:-yukpomnang/backend/secrets}"
NEW_SECRET_NAME="${NEW_SECRET_NAME:-yukpo/backend/secrets}"

echo "🔄 Début du transfert des variables..."
echo "Ancien compte: $OLD_PROFILE ($OLD_REGION)"
echo "Nouveau compte: $NEW_PROFILE ($NEW_REGION)"
echo ""

# Vérifier que jq est installé
if ! command -v jq &> /dev/null; then
    echo "❌ jq n'est pas installé. Installez-le avec: apt-get install jq"
    exit 1
fi

# 1. Transférer SSM Parameter Store
echo "📋 Étape 1: Transfert SSM Parameter Store..."
TEMP_FILE=$(mktemp)

aws ssm get-parameters-by-path \
  --path "$OLD_PATH" \
  --region "$OLD_REGION" \
  --profile "$OLD_PROFILE" \
  --recursive \
  --with-decryption \
  --query 'Parameters[*]' \
  --output json > "$TEMP_FILE" 2>/dev/null || {
    echo "⚠️  Impossible de récupérer les paramètres SSM de l'ancien compte"
    echo "   Vérifiez vos credentials et la région"
    rm "$TEMP_FILE"
    exit 1
}

PARAM_COUNT=$(jq '. | length' "$TEMP_FILE")
echo "   ✅ $PARAM_COUNT paramètre(s) trouvé(s)"

if [ "$PARAM_COUNT" -gt 0 ]; then
    jq -r '.[] | "\(.Name | sub("'$OLD_PATH'"; "'$NEW_PATH'"))|\(.Type)|\(.Value)"' "$TEMP_FILE" | while IFS='|' read -r name type value; do
        # Échapper les caractères spéciaux dans la valeur
        value_escaped=$(echo "$value" | sed 's/"/\\"/g')
        
        echo "   📝 Transfert: $name"
        aws ssm put-parameter \
          --name "$name" \
          --value "$value_escaped" \
          --type "$type" \
          --region "$NEW_REGION" \
          --profile "$NEW_PROFILE" \
          --overwrite > /dev/null 2>&1 || {
            echo "   ⚠️  Erreur lors du transfert de $name"
          }
    done
fi

rm "$TEMP_FILE"
echo "   ✅ SSM Parameter Store transféré"
echo ""

# 2. Transférer Secrets Manager
echo "📋 Étape 2: Transfert Secrets Manager..."
SECRET_VALUE=$(aws secretsmanager get-secret-value \
  --secret-id "$OLD_SECRET_NAME" \
  --region "$OLD_REGION" \
  --profile "$OLD_PROFILE" \
  --query 'SecretString' \
  --output text 2>/dev/null) || {
    echo "   ⚠️  Impossible de récupérer le secret de l'ancien compte"
    echo "   Le secret sera créé avec les valeurs par défaut"
    SECRET_VALUE="{}"
}

if [ -n "$SECRET_VALUE" ] && [ "$SECRET_VALUE" != "None" ]; then
    echo "   ✅ Secret récupéré de l'ancien compte"
    
    # Le secret existe déjà dans le nouveau compte (créé par Terraform)
    # On met juste à jour la version
    aws secretsmanager put-secret-value \
      --secret-id "$NEW_SECRET_NAME" \
      --secret-string "$SECRET_VALUE" \
      --region "$NEW_REGION" \
      --profile "$NEW_PROFILE" > /dev/null 2>&1 || {
        echo "   ⚠️  Erreur lors de la mise à jour du secret"
      }
    echo "   ✅ Secret transféré"
else
    echo "   ⚠️  Aucun secret trouvé dans l'ancien compte"
fi

echo ""
echo "✅ Transfert terminé !"
echo ""
echo "📋 Vérification des variables transférées:"
aws ssm get-parameters-by-path \
  --path "$NEW_PATH" \
  --region "$NEW_REGION" \
  --profile "$NEW_PROFILE" \
  --recursive \
  --query 'Parameters[*].Name' \
  --output table

