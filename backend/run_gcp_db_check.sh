#!/bin/bash

# Script pour vérifier les tables de conversation et @mention dans PostgreSQL GCP
# Utilisation: ./run_gcp_db_check.sh

echo "🔍 Vérification des tables de conversation et @mention dans PostgreSQL GCP..."
echo "=================================================================="

# Variables
INSTANCE_NAME="yukpo-postgres"
DATABASE_NAME="yukpo_db"
USER_NAME="yukpo_user"

echo "📋 Instance: $INSTANCE_NAME"
echo "📋 Base de données: $DATABASE_NAME"
echo "📋 Utilisateur: $USER_NAME"
echo ""

# Vérifier si gcloud est installé
if ! command -v gcloud &> /dev/null; then
    echo "❌ gcloud n'est pas installé. Veuillez installer Google Cloud SDK."
    exit 1
fi

# Vérifier si on est connecté
echo "🔐 Vérification de l'authentification..."
gcloud auth list --filter=status:ACTIVE --format="value(account)" 2>/dev/null | head -1

if [ $? -ne 0 ]; then
    echo "❌ Vous n'êtes pas connecté à Google Cloud. Exécutez: gcloud auth login"
    exit 1
fi

echo "✅ Authentification OK"
echo ""

# Vérifier si l'instance existe
echo "🔍 Vérification de l'instance Cloud SQL..."
gcloud sql instances list --filter="name=$INSTANCE_NAME" --format="value(name)" 2>/dev/null | grep -q "$INSTANCE_NAME"

if [ $? -ne 0 ]; then
    echo "❌ L'instance $INSTANCE_NAME n'existe pas."
    echo "Instances disponibles:"
    gcloud sql instances list --format="table(name,databaseVersion,region,status)"
    exit 1
fi

echo "✅ Instance $INSTANCE_NAME trouvée"
echo ""

# Vérifier si la base de données existe
echo "🔍 Vérification de la base de données..."
gcloud sql databases list --instance="$INSTANCE_NAME" --format="value(name)" 2>/dev/null | grep -q "$DATABASE_NAME"

if [ $? -ne 0 ]; then
    echo "❌ La base de données $DATABASE_NAME n'existe pas dans l'instance $INSTANCE_NAME."
    echo "Bases de données disponibles:"
    gcloud sql databases list --instance="$INSTANCE_NAME" --format="table(name,charset,collation)"
    exit 1
fi

echo "✅ Base de données $DATABASE_NAME trouvée"
echo ""

# Exécuter les requêtes de vérification
echo "🔍 Exécution des requêtes de vérification..."

# Vérification des tables
echo "📊 1. Vérification des tables de conversation..."
gcloud sql query --instance="$INSTANCE_NAME" --database="$DATABASE_NAME" --user="$USER_NAME" "
SELECT 
    table_name,
    table_type
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
    'conversations', 
    'chat_messages', 
    'conversation_participants', 
    'conversation_tag_history',
    'users'
)
ORDER BY table_name;
"

echo ""

# Vérification des colonnes
echo "📊 2. Vérification des colonnes importantes pour les @mentions..."
gcloud sql query --instance="$INSTANCE_NAME" --database="$DATABASE_NAME" --user="$USER_NAME" "
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name IN (
    'users'
)
AND column_name IN (
    'id', 
    'nom_complet',
    'email',
    'avatar_url',
    'is_provider',
    'role'
)
ORDER BY table_name, column_name;
"

echo ""

# Vérification des utilisateurs
echo "📊 3. Vérification des utilisateurs..."
gcloud sql query --instance="$INSTANCE_NAME" --database="$DATABASE_NAME" --user="$USER_NAME" "
SELECT 
    COUNT(*) as total_users,
    COUNT(CASE WHEN nom_complet IS NOT NULL AND nom_complet != '' THEN 1 END) as users_with_names,
    COUNT(CASE WHEN email IS NOT NULL AND email != '' THEN 1 END) as users_with_email
FROM users;
"

echo ""

# Test de recherche
echo "📊 4. Test de recherche d'utilisateurs (comme l'API)..."
gcloud sql query --instance="$INSTANCE_NAME" --database="$DATABASE_NAME" --user="$USER_NAME" "
SELECT 
    id, 
    nom_complet, 
    email, 
    avatar_url, 
    is_provider, 
    role
FROM users
WHERE (nom_complet ILIKE '%a%' OR email ILIKE '%a%')
  AND id != 1
ORDER BY is_provider DESC, nom_complet ASC
LIMIT 5;
"

echo ""

# Vérification des participants
echo "📊 5. Vérification des participants actifs..."
gcloud sql query --instance="$INSTANCE_NAME" --database="$DATABASE_NAME" --user="$USER_NAME" "
SELECT 
    COUNT(*) as total_participants,
    COUNT(DISTINCT conversation_id) as conversations_with_participants,
    COUNT(DISTINCT user_id) as unique_users_in_conversations
FROM conversation_participants 
WHERE is_active = TRUE;
"

echo ""

echo "✅ Vérification terminée!"
echo ""
echo "📝 Si vous voyez des erreurs ou des données manquantes, voici les actions possibles:"
echo "   - Si les tables n'existent pas: Exécuter les migrations SQL"
echo "   - Si les colonnes manquent: Ajouter les colonnes avec ALTER TABLE"
echo "   - Si aucun utilisateur: Créer des utilisateurs de test"
echo "   - Si la recherche ne retourne rien: Vérifier les données dans la table users"
