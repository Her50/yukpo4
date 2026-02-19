# Script Simplifié de Correction DATABASE_URL
# Date: 2026-02-19

$PROJECT = "yukpo-project"
$INSTANCE = "yukpo-postgres"
$DB_USER = "yukpo_user"
$DB_NAME = "yukpo_db"
$SOCKET_PATH = "/cloudsql/yukpo-project:europe-west1:yukpo-postgres"
$SECRET_NAME = "database-url"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Correction DATABASE_URL" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Générer un nouveau mot de passe
Write-Host "[1/5] Génération du mot de passe..." -ForegroundColor Yellow
$chars = @()
$chars += 48..57
$chars += 65..90
$chars += 97..122
$chars += 35, 36, 37, 61, 64, 95

$NEW_PASSWORD = -join ($chars | Get-Random -Count 32 | ForEach-Object { [char]$_ })
Write-Host "✅ Mot de passe généré" -ForegroundColor Green
Write-Host ""

# 2. Réinitialiser dans Cloud SQL
Write-Host "[2/5] Réinitialisation dans Cloud SQL..." -ForegroundColor Yellow
gcloud sql users set-password $DB_USER --instance=$INSTANCE --password=$NEW_PASSWORD --project=$PROJECT 2>&1 | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Mot de passe réinitialisé" -ForegroundColor Green
} else {
    Write-Host "❌ Erreur lors de la réinitialisation" -ForegroundColor Red
    exit 1
}
Write-Host ""

# 3. URL-encoder le mot de passe
Write-Host "[3/5] Encodage URL..." -ForegroundColor Yellow
Add-Type -AssemblyName System.Web
$PASSWORD_ENCODED = [System.Web.HttpUtility]::UrlEncode($NEW_PASSWORD)
Write-Host "✅ Mot de passe encodé" -ForegroundColor Green
Write-Host ""

# 4. Construire DATABASE_URL
Write-Host "[4/5] Construction DATABASE_URL..." -ForegroundColor Yellow
$DATABASE_URL = "postgresql://${DB_USER}:${PASSWORD_ENCODED}@/${DB_NAME}?host=${SOCKET_PATH}"
Write-Host "✅ DATABASE_URL construite" -ForegroundColor Green
Write-Host "   Format: postgresql://${DB_USER}:***@/${DB_NAME}?host=${SOCKET_PATH}" -ForegroundColor Gray
Write-Host ""

# 5. Mettre à jour le secret
Write-Host "[5/5] Mise à jour du secret..." -ForegroundColor Yellow
$tempFile = [System.IO.Path]::GetTempFileName()
$DATABASE_URL | Out-File -FilePath $tempFile -Encoding UTF8 -NoNewline

$result = gcloud secrets versions add $SECRET_NAME --data-file=$tempFile --project=$PROJECT 2>&1
Remove-Item $tempFile -Force

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Secret mis à jour" -ForegroundColor Green
    if ($result -match 'version (\d+)') {
        Write-Host "   Version: $($matches[1])" -ForegroundColor Gray
    }
} else {
    Write-Host "❌ Erreur lors de la mise à jour" -ForegroundColor Red
    Write-Host "DATABASE_URL à mettre à jour manuellement:" -ForegroundColor Yellow
    Write-Host $DATABASE_URL -ForegroundColor Cyan
    exit 1
}
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "✅ Correction terminée!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Prochaine étape: Redéployer Cloud Run" -ForegroundColor Yellow
Write-Host "  gcloud run services update yukpo-backend --region=europe-west1 --project=$PROJECT" -ForegroundColor Gray
Write-Host ""

