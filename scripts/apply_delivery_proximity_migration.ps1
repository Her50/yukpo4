# Script pour appliquer la migration delivery_proximity_suggestions sur Cloud SQL
# Usage: .\scripts\apply_delivery_proximity_migration.ps1

Write-Host "🔄 Application de la migration delivery_proximity_suggestions..." -ForegroundColor Cyan

# Vérifier que gcloud est installé
if (-not (Get-Command gcloud -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Erreur: gcloud CLI n'est pas installé ou pas dans le PATH" -ForegroundColor Red
    exit 1
}

# Configuration Cloud SQL
$PROJECT_ID = "yukpo-project"
$REGION = "europe-west1"
$INSTANCE_NAME = "yukpo-postgres"
$DATABASE_NAME = "yukpo_db"
$USER_NAME = "yukpo_user"

Write-Host "📋 Configuration:" -ForegroundColor Yellow
Write-Host "   Project: $PROJECT_ID"
Write-Host "   Instance: $INSTANCE_NAME"
Write-Host "   Database: $DATABASE_NAME"
Write-Host "   Region: $REGION"
Write-Host ""

# Chemin vers la migration
$MIGRATION_FILE = "backend\migrations\20260216_create_delivery_proximity_suggestions_table.sql"

if (-not (Test-Path $MIGRATION_FILE)) {
    Write-Host "❌ Erreur: Fichier de migration non trouvé: $MIGRATION_FILE" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Fichier de migration trouvé: $MIGRATION_FILE" -ForegroundColor Green
Write-Host ""

# Option 1: Utiliser gcloud sql connect (nécessite Cloud SQL Proxy ou connexion directe)
Write-Host "🔧 Méthode 1: Application via gcloud sql execute..." -ForegroundColor Cyan

# Lire le contenu de la migration
$migrationContent = Get-Content $MIGRATION_FILE -Raw

# Échapper les caractères spéciaux pour PowerShell
$migrationContent = $migrationContent -replace "'", "''"
$migrationContent = $migrationContent -replace "`n", " "

Write-Host "📝 Exécution de la migration..." -ForegroundColor Yellow

# Exécuter la migration via gcloud sql execute
try {
    $result = gcloud sql execute-sql $INSTANCE_NAME `
        --database=$DATABASE_NAME `
        --project=$PROJECT_ID `
        --sql="$migrationContent" `
        2>&1

    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Migration appliquée avec succès!" -ForegroundColor Green
    } else {
        Write-Host "❌ Erreur lors de l'application de la migration:" -ForegroundColor Red
        Write-Host $result
        exit 1
    }
} catch {
    Write-Host "❌ Erreur: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "💡 Alternative: Utilisez la console Cloud SQL pour exécuter le fichier SQL manuellement" -ForegroundColor Yellow
    Write-Host "   Fichier: $MIGRATION_FILE" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "✅ Migration terminée!" -ForegroundColor Green


