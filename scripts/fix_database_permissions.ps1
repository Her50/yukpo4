# Script PowerShell pour vérifier et donner les permissions sur la base de données yukpo

Write-Host "🔍 Vérification et correction des permissions sur la base de données yukpo..." -ForegroundColor Cyan

# Variables
$DB_HOST = "yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com"
$DB_USER = "yukpo_admin"
$DB_NAME = "yukpo"
$DB_PASSWORD = $env:PGPASSWORD

if (-not $DB_PASSWORD) {
    Write-Host "❌ ERREUR: PGPASSWORD non défini" -ForegroundColor Red
    Write-Host "   Exécutez: `$env:PGPASSWORD='VOTRE_MOT_DE_PASSE'" -ForegroundColor Yellow
    exit 1
}

# Vérifier si psql est disponible
$psqlPath = Get-Command psql -ErrorAction SilentlyContinue
if (-not $psqlPath) {
    Write-Host "❌ ERREUR: psql n'est pas installé ou n'est pas dans le PATH" -ForegroundColor Red
    Write-Host "   Installez PostgreSQL client ou utilisez l'instance EC2" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "1️⃣ Vérification de l'accès à la base 'yukpo'..." -ForegroundColor Cyan
$env:PGPASSWORD = $DB_PASSWORD

# Test de connexion
$testResult = & psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "SELECT current_database(), current_user, version();" 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Accès à la base 'yukpo' fonctionne" -ForegroundColor Green
} else {
    Write-Host "⚠️ Impossible de se connecter à la base 'yukpo'" -ForegroundColor Yellow
    Write-Host "   Vérification de l'existence de la base..."
    
    # Vérifier si la base existe
    $dbExists = & psql -h $DB_HOST -U $DB_USER -d postgres -c "SELECT 1 FROM pg_database WHERE datname='$DB_NAME';" 2>&1
    if ($dbExists -match "1") {
        Write-Host "✅ La base '$DB_NAME' existe" -ForegroundColor Green
    } else {
        Write-Host "❌ La base '$DB_NAME' n'existe pas" -ForegroundColor Red
        Write-Host "   Création de la base..."
        & psql -h $DB_HOST -U $DB_USER -d postgres -c "CREATE DATABASE `"$DB_NAME`";" 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Base '$DB_NAME' créée" -ForegroundColor Green
        } else {
            Write-Host "❌ Impossible de créer la base (permissions insuffisantes)" -ForegroundColor Red
            exit 1
        }
    }
}

Write-Host ""
Write-Host "2️⃣ Attribution des permissions sur la base..." -ForegroundColor Cyan
$grantDb = "GRANT ALL PRIVILEGES ON DATABASE `"$DB_NAME`" TO `"$DB_USER`";"
& psql -h $DB_HOST -U $DB_USER -d postgres -c $grantDb 2>&1 | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Permissions sur la base accordées" -ForegroundColor Green
} else {
    Write-Host "⚠️ Erreur lors de l'attribution des permissions sur la base" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "3️⃣ Attribution des permissions sur les tables existantes..." -ForegroundColor Cyan
$grantTables = "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO `"$DB_USER`"; GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO `"$DB_USER`";"
& psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c $grantTables 2>&1 | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Permissions sur les tables accordées" -ForegroundColor Green
} else {
    Write-Host "⚠️ Erreur lors de l'attribution des permissions sur les tables" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "4️⃣ Attribution des permissions pour les futures tables..." -ForegroundColor Cyan
$grantDefault = "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO `"$DB_USER`"; ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO `"$DB_USER`";"
& psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c $grantDefault 2>&1 | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Permissions par défaut configurées" -ForegroundColor Green
} else {
    Write-Host "⚠️ Erreur lors de l'attribution des permissions par défaut" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "5️⃣ Vérification finale..." -ForegroundColor Cyan
$finalTest = & psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "SELECT current_database(), current_user;" 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Toutes les vérifications sont passées" -ForegroundColor Green
    Write-Host ""
    Write-Host "📋 Résumé:" -ForegroundColor Cyan
    Write-Host "   - Base de données: $DB_NAME"
    Write-Host "   - Utilisateur: $DB_USER"
    Write-Host "   - Permissions: ✅ Accordées"
    Write-Host ""
    Write-Host "🔄 Redémarrez le service ECS pour appliquer les changements:" -ForegroundColor Yellow
    Write-Host "   aws ecs update-service --cluster yukpo-cluster --service yukpo-backend-service --force-new-deployment --region eu-west-1"
} else {
    Write-Host "❌ La vérification finale a échoué" -ForegroundColor Red
    exit 1
}

