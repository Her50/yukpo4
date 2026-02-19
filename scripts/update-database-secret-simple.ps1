# Script Simplifié de Mise à Jour DATABASE_URL
# Date: 2026-02-18

$PROJECT = "yukpo-project"
$INSTANCE = "yukpo-postgres"
$DB_USER = "yukpo_user"
$DB_NAME = "yukpo_db"
$SOCKET_PATH = "/cloudsql/yukpo-project:europe-west1:yukpo-postgres"
$SECRET_NAME = "database-url"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Mise a Jour DATABASE_URL" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Vérifier la configuration
Write-Host "[1/6] Verification de la configuration..." -ForegroundColor Yellow
$currentProject = gcloud config get-value project 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "Erreur: gcloud nest pas configure" -ForegroundColor Red
    exit 1
}
Write-Host "Projet: $currentProject" -ForegroundColor Green
Write-Host ""

# 2. Générer un nouveau mot de passe
Write-Host "[2/6] Generation dun nouveau mot de passe..." -ForegroundColor Yellow
$chars = @()
$chars += 48..57
$chars += 65..90
$chars += 97..122
$chars += 35, 36, 37, 61, 64, 95

$NEW_PASSWORD = -join ($chars | Get-Random -Count 32 | ForEach-Object { [char]$_ })
Write-Host "Mot de passe genere (32 caracteres)" -ForegroundColor Green
Write-Host ""

# 3. Réinitialiser le mot de passe dans Cloud SQL
Write-Host "[3/6] Reinitialisation du mot de passe dans Cloud SQL..." -ForegroundColor Yellow
gcloud sql users set-password $DB_USER --instance=$INSTANCE --password=$NEW_PASSWORD --project=$PROJECT 2>&1 | Out-Null

if ($LASTEXITCODE -ne 0) {
    Write-Host "Erreur lors de la reinitialisation" -ForegroundColor Red
    exit 1
}
Write-Host "Mot de passe reinitialise" -ForegroundColor Green
Write-Host ""

# 4. URL-encoder le mot de passe
Write-Host "[4/6] Encodage URL du mot de passe..." -ForegroundColor Yellow
Add-Type -AssemblyName System.Web
$PASSWORD_ENCODED = [System.Web.HttpUtility]::UrlEncode($NEW_PASSWORD)
Write-Host "Mot de passe encode" -ForegroundColor Green
Write-Host ""

# 5. Construire DATABASE_URL
Write-Host "[5/6] Construction de DATABASE_URL..." -ForegroundColor Yellow
$DATABASE_URL = "postgresql://${DB_USER}:${PASSWORD_ENCODED}@/${DB_NAME}?host=${SOCKET_PATH}"
Write-Host "DATABASE_URL construite" -ForegroundColor Green
Write-Host "Format: postgresql://${DB_USER}:***@/${DB_NAME}?host=${SOCKET_PATH}" -ForegroundColor Gray
Write-Host ""

# 6. Mettre à jour le secret
Write-Host "[6/6] Mise a jour du secret dans Secret Manager..." -ForegroundColor Yellow
$tempFile = [System.IO.Path]::GetTempFileName()
$DATABASE_URL | Out-File -FilePath $tempFile -Encoding UTF8 -NoNewline

$result = gcloud secrets versions add $SECRET_NAME --data-file=$tempFile --project=$PROJECT 2>&1

Remove-Item $tempFile -Force

if ($LASTEXITCODE -eq 0) {
    Write-Host "Secret mis a jour avec succes" -ForegroundColor Green
    if ($result -match 'version (\d+)') {
        $version = $matches[1]
        Write-Host "Version: $version" -ForegroundColor Gray
    }
}
else {
    Write-Host "Erreur lors de la mise a jour du secret" -ForegroundColor Red
    Write-Host "DATABASE_URL a mettre a jour manuellement:" -ForegroundColor Yellow
    Write-Host $DATABASE_URL -ForegroundColor Cyan
    exit 1
}
Write-Host ""

# Résumé
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Mise a jour terminee avec succes!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Informations:" -ForegroundColor Yellow
Write-Host "  - Base de donnees: $DB_NAME" -ForegroundColor White
Write-Host "  - Socket Unix: $SOCKET_PATH" -ForegroundColor White
Write-Host "  - Secret: $SECRET_NAME (version latest)" -ForegroundColor White
Write-Host ""
Write-Host "Prochaines etapes:" -ForegroundColor Yellow
Write-Host "1. Redeployer le service Cloud Run" -ForegroundColor White
Write-Host "2. Verifier les logs" -ForegroundColor White
Write-Host ""
Write-Host "Commande pour redeployer:" -ForegroundColor Yellow
Write-Host "  gcloud run services update yukpo-backend --region=europe-west1 --project=$PROJECT" -ForegroundColor Gray
Write-Host ""

