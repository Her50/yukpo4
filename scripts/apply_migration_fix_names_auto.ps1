# Script pour appliquer automatiquement la migration de correction des noms dupliques
# Ce script genere un mot de passe temporaire, l'applique, puis execute la migration
# Usage: .\scripts\apply_migration_fix_names_auto.ps1

$instanceName = "yukpo-postgres"
$user = "yukpo_user"
$databaseName = "yukpo_db"
$projectId = "yukpo-project"
$publicIp = "34.79.199.41"
$sqlFile = "backend\migrations\20260216_fix_duplicate_full_names.sql"

Write-Host "Application automatique de la migration de correction des noms dupliques..." -ForegroundColor Cyan
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
gcloud config set project $projectId 2>&1 | Out-Null
Write-Host "OK Projet configure: $projectId" -ForegroundColor Green
Write-Host ""

# Verifier que le fichier SQL existe
if (-not (Test-Path $sqlFile)) {
    Write-Host "ERREUR: Fichier de migration introuvable: $sqlFile" -ForegroundColor Red
    exit 1
}

Write-Host "Fichier de migration: $sqlFile" -ForegroundColor Gray
Write-Host ""

# Generer un mot de passe temporaire securise
$tempPassword = -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 16 | ForEach-Object {[char]$_})
Write-Host "Generation d'un mot de passe temporaire..." -ForegroundColor Yellow

# Definir le nouveau mot de passe
Write-Host "Definition du mot de passe temporaire sur Cloud SQL..." -ForegroundColor Yellow
$result = gcloud sql users set-password $user --instance=$instanceName --password=$tempPassword --project=$projectId 2>&1

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERREUR lors de la definition du mot de passe: $result" -ForegroundColor Red
    exit 1
}

Write-Host "OK Mot de passe temporaire defini avec succes" -ForegroundColor Green
Write-Host ""

# Attendre quelques secondes pour que le changement soit pris en compte
Write-Host "Attente de la prise en compte du changement de mot de passe..." -ForegroundColor Gray
Start-Sleep -Seconds 5

# Verifier que psql est disponible
if (-not (Get-Command psql -ErrorAction SilentlyContinue)) {
    Write-Host "ERREUR: psql n'est pas installe" -ForegroundColor Red
    Write-Host "Le mot de passe a ete change. Vous pouvez maintenant utiliser:" -ForegroundColor Yellow
    Write-Host "  psql -h $publicIp -U $user -d $databaseName -p 5432 -f $sqlFile" -ForegroundColor White
    Write-Host "  Mot de passe: $tempPassword" -ForegroundColor White
    exit 1
}

# Definir PGPASSWORD
$env:PGPASSWORD = $tempPassword

Write-Host "Connexion a Cloud SQL et execution de la migration..." -ForegroundColor Yellow
Write-Host ""

# Executer la migration
Write-Host "Application de la migration..." -ForegroundColor Cyan
$output = & psql -h $publicIp -U $user -d $databaseName -p 5432 --set=sslmode=require -f $sqlFile 2>&1

$exitCode = $LASTEXITCODE

# Afficher la sortie
Write-Host ""
Write-Host "Sortie de la migration:" -ForegroundColor Cyan
Write-Host $output

# Nettoyer le mot de passe de la memoire
$env:PGPASSWORD = $null

if ($exitCode -eq 0) {
    Write-Host ""
    Write-Host "OK Migration appliquee avec succes!" -ForegroundColor Green
    Write-Host ""
    Write-Host "La migration a:" -ForegroundColor Cyan
    Write-Host "  - Cree les fonctions SQL de normalisation" -ForegroundColor White
    Write-Host "  - Corrige les noms dupliques existants" -ForegroundColor White
    Write-Host "  - Cree un trigger pour normaliser automatiquement" -ForegroundColor White
    Write-Host "  - Cree un index pour ameliorer les performances" -ForegroundColor White
    Write-Host ""
    Write-Host "Le mot de passe temporaire a ete utilise et nettoye de la memoire." -ForegroundColor Gray
    Write-Host "Vous pouvez reinitialiser le mot de passe si necessaire." -ForegroundColor Gray
} else {
    Write-Host ""
    Write-Host "ERREUR: La migration a echoue (code: $exitCode)" -ForegroundColor Red
    Write-Host ""
    Write-Host "Le mot de passe temporaire etait: $tempPassword" -ForegroundColor Yellow
    Write-Host "Vous pouvez reessayer manuellement avec:" -ForegroundColor Yellow
    Write-Host "  psql -h $publicIp -U $user -d $databaseName -p 5432 --set=sslmode=require -f $sqlFile" -ForegroundColor White
    exit 1
}


