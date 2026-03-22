# Script PowerShell pour vérifier les tables de conversation et @mention dans PostgreSQL GCP
# Utilisation: .\run_gcp_db_check.ps1

Write-Host "🔍 Vérification des tables de conversation et @mention dans PostgreSQL GCP..." -ForegroundColor Cyan
Write-Host "==================================================================" -ForegroundColor Cyan

# Variables
$InstanceName = "yukpo-postgres"
$DatabaseName = "yukpo_db"
$UserName = "yukpo_user"

Write-Host "📋 Instance: $InstanceName" -ForegroundColor Yellow
Write-Host "📋 Base de données: $DatabaseName" -ForegroundColor Yellow
Write-Host "📋 Utilisateur: $UserName" -ForegroundColor Yellow
Write-Host ""

# Vérifier si gcloud est installé
try {
    $gcloudVersion = gcloud version --format="value(version)" 2>$null
    Write-Host "✅ gcloud trouvé (version: $gcloudVersion)" -ForegroundColor Green
} catch {
    Write-Host "❌ gcloud n'est pas installé. Veuillez installer Google Cloud SDK." -ForegroundColor Red
    exit 1
}

# Vérifier si on est connecté
Write-Host "🔐 Vérification de l'authentification..." -ForegroundColor Blue
try {
    $account = gcloud auth list --filter=status:ACTIVE --format="value(account)" 2>$null | Select-Object -First 1
    if ($account) {
        Write-Host "✅ Connecté en tant que: $account" -ForegroundColor Green
    } else {
        Write-Host "❌ Vous n'êtes pas connecté à Google Cloud. Exécutez: gcloud auth login" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "❌ Erreur lors de la vérification de l'authentification." -ForegroundColor Red
    exit 1
}

Write-Host ""

# Vérifier si l'instance existe
Write-Host "🔍 Vérification de l'instance Cloud SQL..." -ForegroundColor Blue
try {
    $instance = gcloud sql instances list --filter="name=$InstanceName" --format="value(name)" 2>$null
    if ($instance -eq $InstanceName) {
        Write-Host "✅ Instance $InstanceName trouvée" -ForegroundColor Green
    } else {
        Write-Host "❌ L'instance $InstanceName n'existe pas." -ForegroundColor Red
        Write-Host "Instances disponibles:" -ForegroundColor Yellow
        gcloud sql instances list --format="table(name,databaseVersion,region,status)"
        exit 1
    }
} catch {
    Write-Host "❌ Erreur lors de la vérification de l'instance." -ForegroundColor Red
    exit 1
}

Write-Host ""

# Vérifier si la base de données existe
Write-Host "🔍 Vérification de la base de données..." -ForegroundColor Blue
try {
    $database = gcloud sql databases list --instance="$InstanceName" --format="value(name)" 2>$null
    if ($database -contains $DatabaseName) {
        Write-Host "✅ Base de données $DatabaseName trouvée" -ForegroundColor Green
    } else {
        Write-Host "❌ La base de données $DatabaseName n'existe pas dans l'instance $InstanceName." -ForegroundColor Red
        Write-Host "Bases de données disponibles:" -ForegroundColor Yellow
        gcloud sql databases list --instance="$InstanceName" --format="table(name,charset,collation)"
        exit 1
    }
} catch {
    Write-Host "❌ Erreur lors de la vérification de la base de données." -ForegroundColor Red
    exit 1
}

Write-Host ""

# Exécuter les requêtes de vérification
Write-Host "🔍 Exécution des requêtes de vérification..." -ForegroundColor Blue

# Vérification des tables
Write-Host "📊 1. Vérification des tables de conversation..." -ForegroundColor Magenta
try {
    $query1 = @"
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
"@
    gcloud sql query --instance="$InstanceName" --database="$DatabaseName" --user="$UserName" $query1
} catch {
    Write-Host "❌ Erreur lors de la vérification des tables: $_" -ForegroundColor Red
}

Write-Host ""

# Vérification des colonnes
Write-Host "📊 2. Vérification des colonnes importantes pour les @mentions..." -ForegroundColor Magenta
try {
    $query2 = @"
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
"@
    gcloud sql query --instance="$InstanceName" --database="$DatabaseName" --user="$UserName" $query2
} catch {
    Write-Host "❌ Erreur lors de la vérification des colonnes: $_" -ForegroundColor Red
}

Write-Host ""

# Vérification des utilisateurs
Write-Host "📊 3. Vérification des utilisateurs..." -ForegroundColor Magenta
try {
    $query3 = @"
SELECT 
    COUNT(*) as total_users,
    COUNT(CASE WHEN nom_complet IS NOT NULL AND nom_complet != '' THEN 1 END) as users_with_names,
    COUNT(CASE WHEN email IS NOT NULL AND email != '' THEN 1 END) as users_with_email
FROM users;
"@
    gcloud sql query --instance="$InstanceName" --database="$DatabaseName" --user="$UserName" $query3
} catch {
    Write-Host "❌ Erreur lors de la vérification des utilisateurs: $_" -ForegroundColor Red
}

Write-Host ""

# Test de recherche
Write-Host "📊 4. Test de recherche d'utilisateurs (comme l'API)..." -ForegroundColor Magenta
try {
    $query4 = @"
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
"@
    gcloud sql query --instance="$InstanceName" --database="$DatabaseName" --user="$UserName" $query4
} catch {
    Write-Host "❌ Erreur lors du test de recherche: $_" -ForegroundColor Red
}

Write-Host ""

# Vérification des participants
Write-Host "📊 5. Vérification des participants actifs..." -ForegroundColor Magenta
try {
    $query5 = @"
SELECT 
    COUNT(*) as total_participants,
    COUNT(DISTINCT conversation_id) as conversations_with_participants,
    COUNT(DISTINCT user_id) as unique_users_in_conversations
FROM conversation_participants 
WHERE is_active = TRUE;
"@
    gcloud sql query --instance="$InstanceName" --database="$DatabaseName" --user="$UserName" $query5
} catch {
    Write-Host "❌ Erreur lors de la vérification des participants: $_" -ForegroundColor Red
}

Write-Host ""

Write-Host "✅ Vérification terminée!" -ForegroundColor Green
Write-Host ""
Write-Host "📝 Si vous voyez des erreurs ou des données manquantes, voici les actions possibles:" -ForegroundColor Yellow
Write-Host "   - Si les tables n'existent pas: Exécuter les migrations SQL" -ForegroundColor White
Write-Host "   - Si les colonnes manquent: Ajouter les colonnes avec ALTER TABLE" -ForegroundColor White
Write-Host "   - Si aucun utilisateur: Créer des utilisateurs de test" -ForegroundColor White
Write-Host "   - Si la recherche ne retourne rien: Vérifier les données dans la table users" -ForegroundColor White
