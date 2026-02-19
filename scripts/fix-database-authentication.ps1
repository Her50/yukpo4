# Script de Correction : Authentification PostgreSQL Cloud SQL
# Date: 2026-02-18
# Problème: password authentication failed for user "yukpo_user"

$PROJECT = "yukpo-project"
$INSTANCE = "yukpo-postgres"
$DB_USER = "yukpo_user"
$DB_NAME = "yukpo_postgres"  # Base principale recommandée
$SOCKET_PATH = "/cloudsql/yukpo-project:europe-west1:yukpo-postgres"
$SECRET_NAME = "database-url"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Correction Authentification PostgreSQL" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Vérifier que gcloud est configuré
Write-Host "[1/6] Vérification de la configuration gcloud..." -ForegroundColor Yellow
$currentProject = gcloud config get-value project 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Erreur: gcloud n'est pas configuré" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Projet actuel: $currentProject" -ForegroundColor Green
Write-Host ""

# 2. Demander confirmation avant de réinitialiser le mot de passe
Write-Host "[2/6] ATTENTION: Ce script va réinitialiser le mot de passe de l'utilisateur $DB_USER" -ForegroundColor Yellow
Write-Host "Cela va nécessiter de mettre à jour DATABASE_URL dans Secret Manager." -ForegroundColor Yellow
$confirm = Read-Host "Continuer? (O/N)"
if ($confirm -ne "O" -and $confirm -ne "o") {
    Write-Host "❌ Opération annulée" -ForegroundColor Red
    exit 0
}
Write-Host ""

# 3. Générer un nouveau mot de passe sécurisé
Write-Host "[3/6] Génération d'un nouveau mot de passe sécurisé..." -ForegroundColor Yellow
# Mot de passe avec caractères alphanumériques et quelques caractères spéciaux
$chars = @()
$chars += 48..57  # Chiffres
$chars += 65..90  # Majuscules
$chars += 97..122 # Minuscules
$chars += 35, 36, 37, 61, 64, 95  # # $ % = @ _

$NEW_PASSWORD = -join ($chars | Get-Random -Count 32 | ForEach-Object {[char]$_})
Write-Host "✅ Mot de passe généré (32 caractères)" -ForegroundColor Green
Write-Host ""

# 4. Réinitialiser le mot de passe dans Cloud SQL
Write-Host "[4/6] Réinitialisation du mot de passe dans Cloud SQL..." -ForegroundColor Yellow
try {
    gcloud sql users set-password $DB_USER `
        --instance=$INSTANCE `
        --password=$NEW_PASSWORD `
        --project=$PROJECT 2>&1 | Out-Null
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Mot de passe réinitialisé dans Cloud SQL" -ForegroundColor Green
    } else {
        Write-Host "❌ Erreur lors de la réinitialisation du mot de passe" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "❌ Erreur: $_" -ForegroundColor Red
    exit 1
}
Write-Host ""

# 5. URL-encoder le mot de passe
Write-Host "[5/6] Encodage URL du mot de passe..." -ForegroundColor Yellow
Add-Type -AssemblyName System.Web
$PASSWORD_ENCODED = [System.Web.HttpUtility]::UrlEncode($NEW_PASSWORD)
Write-Host "✅ Mot de passe encodé" -ForegroundColor Green
Write-Host ""

# 6. Construire DATABASE_URL avec le format Unix socket
Write-Host "[6/6] Construction de DATABASE_URL..." -ForegroundColor Yellow
$DATABASE_URL = "postgresql://${DB_USER}:${PASSWORD_ENCODED}@/${DB_NAME}?host=${SOCKET_PATH}"
Write-Host "Format DATABASE_URL:" -ForegroundColor Cyan
Write-Host "  postgresql://${DB_USER}:***@/${DB_NAME}?host=${SOCKET_PATH}" -ForegroundColor Gray
Write-Host ""

# 7. Mettre à jour le secret dans Secret Manager
Write-Host "[7/7] Mise à jour du secret '$SECRET_NAME' dans Secret Manager..." -ForegroundColor Yellow
try {
    # Créer un fichier temporaire avec DATABASE_URL
    $tempFile = [System.IO.Path]::GetTempFileName()
    $DATABASE_URL | Out-File -FilePath $tempFile -Encoding UTF8 -NoNewline
    
    # Ajouter une nouvelle version du secret
    gcloud secrets versions add $SECRET_NAME `
        --data-file=$tempFile `
        --project=$PROJECT 2>&1 | Out-Null
    
    # Supprimer le fichier temporaire
    Remove-Item $tempFile -Force
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Secret mis à jour dans Secret Manager" -ForegroundColor Green
    } else {
        Write-Host "❌ Erreur lors de la mise à jour du secret" -ForegroundColor Red
        Write-Host "DATABASE_URL à mettre à jour manuellement:" -ForegroundColor Yellow
        Write-Host $DATABASE_URL -ForegroundColor Cyan
        exit 1
    }
} catch {
    Write-Host "❌ Erreur: $_" -ForegroundColor Red
    Write-Host "DATABASE_URL à mettre à jour manuellement:" -ForegroundColor Yellow
    Write-Host $DATABASE_URL -ForegroundColor Cyan
    exit 1
}
Write-Host ""

# Résumé
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "✅ Correction terminée avec succès!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Prochaines étapes:" -ForegroundColor Yellow
Write-Host "1. Redéployer le service Cloud Run pour charger le nouveau secret" -ForegroundColor White
Write-Host "2. Vérifier les logs pour confirmer la connexion réussie" -ForegroundColor White
Write-Host "3. Tester l'application" -ForegroundColor White
Write-Host ""
Write-Host "Commandes utiles:" -ForegroundColor Yellow
Write-Host "  # Redéployer (si nécessaire)" -ForegroundColor Gray
Write-Host "  gcloud run services update yukpo-backend --region=europe-west1 --project=$PROJECT" -ForegroundColor Gray
Write-Host ""
Write-Host "  # Vérifier les logs" -ForegroundColor Gray
Write-Host "  gcloud logging read 'resource.type=cloud_run_revision AND resource.labels.service_name=yukpo-backend' --limit=50 --project=$PROJECT" -ForegroundColor Gray
Write-Host ""


