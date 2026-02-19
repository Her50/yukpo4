# Script pour corriger le mot de passe de la base de donnees dans Cloud Run
# Ce script definit un nouveau mot de passe et met a jour Cloud Run automatiquement

param(
    [string]$ProjectId = "yukpo-project",
    [string]$InstanceName = "yukpo-postgres",
    [string]$DatabaseName = "yukpo_db",
    [string]$User = "yukpo_user",
    [string]$Region = "europe-west1",
    [string]$ServiceName = "yukpo-backend"
)

Write-Host "Correction du mot de passe de la base de donnees dans Cloud Run" -ForegroundColor Yellow
Write-Host ""

# Verifier que gcloud est disponible
if (-not (Get-Command gcloud -ErrorAction SilentlyContinue)) {
    Write-Host "ERREUR: gcloud CLI n'est pas installe" -ForegroundColor Red
    exit 1
}

# Verifier l'authentification
$account = gcloud config get-value account 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERREUR: Non authentifie avec gcloud" -ForegroundColor Red
    Write-Host "Executez: gcloud auth login" -ForegroundColor Yellow
    exit 1
}

Write-Host "OK Authentifie en tant que: $account" -ForegroundColor Green
gcloud config set project $ProjectId 2>&1 | Out-Null
Write-Host "OK Projet configure: $projectId" -ForegroundColor Green
Write-Host ""

# Generer un nouveau mot de passe securise
Write-Host "Generation d'un nouveau mot de passe securise..." -ForegroundColor Cyan
$newPassword = -join ((65..90) + (97..122) + (48..57) + (33..47) | Get-Random -Count 20 | ForEach-Object {[char]$_})
Write-Host "Nouveau mot de passe genere (20 caracteres)" -ForegroundColor Gray
Write-Host ""

# Definir le nouveau mot de passe sur Cloud SQL
Write-Host "Definition du nouveau mot de passe sur Cloud SQL..." -ForegroundColor Yellow
$result = gcloud sql users set-password $User --instance=$InstanceName --password=$newPassword --project=$ProjectId 2>&1

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERREUR lors de la definition du mot de passe: $result" -ForegroundColor Red
    exit 1
}

Write-Host "OK Mot de passe defini sur Cloud SQL" -ForegroundColor Green
Write-Host ""

# Attendre que le changement soit pris en compte
Write-Host "Attente de la prise en compte du changement..." -ForegroundColor Gray
Start-Sleep -Seconds 5

# Construire la nouvelle DATABASE_URL
$connectionName = "$ProjectId`:$Region`:$InstanceName"
$newDatabaseUrl = "postgresql://${User}:${newPassword}@/${DatabaseName}?host=/cloudsql/${connectionName}"

Write-Host "Mise a jour de DATABASE_URL dans Cloud Run..." -ForegroundColor Yellow
Write-Host "Connection name: $connectionName" -ForegroundColor Gray

# Mettre a jour Cloud Run
$updateResult = gcloud run services update $ServiceName `
    --region=$Region `
    --update-env-vars="DATABASE_URL=$newDatabaseUrl" `
    --project=$ProjectId 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "OK Cloud Run mis a jour avec succes!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Le service Cloud Run va redemarrer automatiquement avec le nouveau mot de passe." -ForegroundColor Cyan
    Write-Host "Attendez quelques secondes puis testez la connexion depuis l'application mobile." -ForegroundColor Cyan
    Write-Host ""
    Write-Host "IMPORTANT: Sauvegardez le nouveau mot de passe:" -ForegroundColor Yellow
    Write-Host "  $newPassword" -ForegroundColor White
    Write-Host ""
    Write-Host "Mettez a jour aussi le secret GitHub GCP_DATABASE_URL avec:" -ForegroundColor Yellow
    Write-Host "  $newDatabaseUrl" -ForegroundColor White
} else {
    Write-Host ""
    Write-Host "ERREUR lors de la mise a jour de Cloud Run: $updateResult" -ForegroundColor Red
    Write-Host ""
    Write-Host "Le mot de passe a ete change sur Cloud SQL." -ForegroundColor Yellow
    Write-Host "Vous pouvez mettre a jour manuellement Cloud Run avec:" -ForegroundColor Yellow
    Write-Host "  gcloud run services update $ServiceName --region=$Region --update-env-vars=`"DATABASE_URL=$newDatabaseUrl`" --project=$ProjectId" -ForegroundColor White
    Write-Host ""
    Write-Host "Nouveau mot de passe: $newPassword" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "OK Correction terminee!" -ForegroundColor Green


