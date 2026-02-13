#!/bin/bash
# Script pour exécuter fix_database_permissions.sh via SSM sur l'instance EC2

INSTANCE_ID="i-0b9ad404f8d738d04"
REGION="eu-west-1"
DB_PASSWORD="PYvHBVetTuWIKNkXgqJcFiU48D39SLwd"

echo "📤 Envoi du script de correction des permissions à l'instance EC2..."

# Créer le script inline
SCRIPT=$(cat <<'EOF'
export PGPASSWORD='PYvHBVetTuWIKNkXgqJcFiU48D39SLwd'
DB_HOST="yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com"
DB_USER="yukpo_admin"
DB_NAME="yukpo"

echo "🔍 Vérification et correction des permissions..."

# 1. Vérifier l'accès
echo "1️⃣ Vérification de l'accès..."
if psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -c "SELECT current_database(), current_user;" >/dev/null 2>&1; then
    echo "✅ Accès OK"
else
    echo "⚠️ Problème d'accès, attribution des permissions..."
fi

# 2. Donner les permissions sur la base
echo "2️⃣ Attribution des permissions sur la base..."
psql -h "$DB_HOST" -U "$DB_USER" -d postgres -c "GRANT ALL PRIVILEGES ON DATABASE \"$DB_NAME\" TO \"$DB_USER\";" 2>&1

# 3. Donner les permissions sur les tables
echo "3️⃣ Attribution des permissions sur les tables..."
psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -c "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO \"$DB_USER\";" 2>&1
psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -c "GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO \"$DB_USER\";" 2>&1

# 4. Permissions par défaut
echo "4️⃣ Attribution des permissions par défaut..."
psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO \"$DB_USER\";" 2>&1
psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO \"$DB_USER\";" 2>&1

# 5. Vérification finale
echo "5️⃣ Vérification finale..."
if psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -c "SELECT current_database(), current_user;" 2>&1; then
    echo "✅ Toutes les permissions sont configurées correctement"
else
    echo "❌ Erreur lors de la vérification finale"
    exit 1
fi
EOF
)

# Exécuter via SSM
COMMAND_ID=$(aws ssm send-command \
    --instance-ids "$INSTANCE_ID" \
    --document-name "AWS-RunShellScript" \
    --parameters "commands=[$SCRIPT]" \
    --region "$REGION" \
    --query 'Command.CommandId' \
    --output text)

echo "✅ Commande envoyée (ID: $COMMAND_ID)"
echo "⏳ Attente du résultat (10 secondes)..."
sleep 10

# Récupérer le résultat
aws ssm get-command-invocation \
    --command-id "$COMMAND_ID" \
    --instance-id "$INSTANCE_ID" \
    --region "$REGION" \
    --query '[Status, StandardOutputContent, StandardErrorContent]' \
    --output text

