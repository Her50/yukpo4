#!/bin/bash
# Script pour vérifier et donner les permissions sur la base de données yukpo

set -e

echo "🔍 Vérification et correction des permissions sur la base de données yukpo..."

# Variables (à adapter selon votre configuration)
DB_HOST="yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com"
DB_USER="yukpo_admin"
DB_NAME="yukpo"

# Le mot de passe doit être fourni via variable d'environnement
if [ -z "$PGPASSWORD" ]; then
    echo "❌ ERREUR: PGPASSWORD non défini"
    echo "   Exécutez: export PGPASSWORD='VOTRE_MOT_DE_PASSE'"
    exit 1
fi

echo ""
echo "1️⃣ Vérification de l'accès à la base 'yukpo'..."
if psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -c "SELECT current_database(), current_user, version();" >/dev/null 2>&1; then
    echo "✅ Accès à la base 'yukpo' fonctionne"
else
    echo "⚠️ Impossible de se connecter à la base 'yukpo'"
    echo "   Vérification de l'existence de la base..."
    
    # Vérifier si la base existe
    if psql -h "$DB_HOST" -U "$DB_USER" -d postgres -c "SELECT 1 FROM pg_database WHERE datname='$DB_NAME';" | grep -q "1"; then
        echo "✅ La base '$DB_NAME' existe"
    else
        echo "❌ La base '$DB_NAME' n'existe pas"
        echo "   Création de la base..."
        psql -h "$DB_HOST" -U "$DB_USER" -d postgres -c "CREATE DATABASE \"$DB_NAME\";" || {
            echo "❌ Impossible de créer la base (permissions insuffisantes)"
            exit 1
        }
        echo "✅ Base '$DB_NAME' créée"
    fi
fi

echo ""
echo "2️⃣ Attribution des permissions sur la base..."
psql -h "$DB_HOST" -U "$DB_USER" -d postgres <<EOF
GRANT ALL PRIVILEGES ON DATABASE "$DB_NAME" TO "$DB_USER";
EOF
echo "✅ Permissions sur la base accordées"

echo ""
echo "3️⃣ Attribution des permissions sur les tables existantes..."
psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" <<EOF
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO "$DB_USER";
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO "$DB_USER";
EOF
echo "✅ Permissions sur les tables accordées"

echo ""
echo "4️⃣ Attribution des permissions pour les futures tables..."
psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" <<EOF
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO "$DB_USER";
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO "$DB_USER";
EOF
echo "✅ Permissions par défaut configurées"

echo ""
echo "5️⃣ Vérification finale..."
if psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -c "SELECT current_database(), current_user;" >/dev/null 2>&1; then
    echo "✅ Toutes les vérifications sont passées"
    echo ""
    echo "📋 Résumé:"
    echo "   - Base de données: $DB_NAME"
    echo "   - Utilisateur: $DB_USER"
    echo "   - Permissions: ✅ Accordées"
    echo ""
    echo "🔄 Redémarrez le service ECS pour appliquer les changements:"
    echo "   aws ecs update-service --cluster yukpo-cluster --service yukpo-backend-service --force-new-deployment --region eu-west-1"
else
    echo "❌ La vérification finale a échoué"
    exit 1
fi

