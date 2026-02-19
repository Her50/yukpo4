# Script pour appliquer automatiquement la migration delivery_proximity_suggestions
# Ce script genere un mot de passe temporaire, l'applique, puis execute la migration
# Usage: .\scripts\apply_migration_auto_complete.ps1

$instanceName = "yukpo-postgres"
$user = "yukpo_user"
$databaseName = "yukpo_db"
$projectId = "yukpo-project"
$publicIp = "34.79.199.41"
$sqlFile = "scripts\apply_delivery_proximity_migration_simple.sql"

Write-Host "Application automatique de la migration delivery_proximity_suggestions..." -ForegroundColor Cyan
Write-Host ""

# Generer un mot de passe temporaire securise
$tempPassword = -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 16 | ForEach-Object {[char]$_})
Write-Host "Generation d'un mot de passe temporaire..." -ForegroundColor Yellow

# Definir le nouveau mot de passe
Write-Host "Definition du mot de passe temporaire sur Cloud SQL..." -ForegroundColor Yellow
$result = gcloud sql users set-password $user --instance=$instanceName --password=$tempPassword --project=$projectId 2>&1

if ($LASTEXITCODE -ne 0) {
    Write-Host "Erreur lors de la definition du mot de passe: $result" -ForegroundColor Red
    exit 1
}

Write-Host "Mot de passe temporaire defini avec succes" -ForegroundColor Green
Write-Host ""

# Attendre quelques secondes pour que le changement soit pris en compte
Start-Sleep -Seconds 3

# Verifier que psql est disponible
if (-not (Get-Command psql -ErrorAction SilentlyContinue)) {
    Write-Host "Erreur: psql n'est pas installe" -ForegroundColor Red
    Write-Host "Le mot de passe a ete change. Vous pouvez maintenant utiliser:" -ForegroundColor Yellow
    Write-Host "  .\scripts\apply_migration_final.ps1 -Password '$tempPassword'" -ForegroundColor White
    exit 1
}

# Definir PGPASSWORD
$env:PGPASSWORD = $tempPassword

Write-Host "Connexion a Cloud SQL et execution de la migration..." -ForegroundColor Yellow
Write-Host ""

# Executer la migration
$output = & psql -h $publicIp -U $user -d $databaseName -p 5432 -f $sqlFile 2>&1

$output | ForEach-Object { Write-Host $_ }

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "Migration appliquee avec succes!" -ForegroundColor Green
    
    # Verification
    Write-Host ""
    Write-Host "Verification de la table..." -ForegroundColor Cyan
    $checkResult = & psql -h $publicIp -U $user -d $databaseName -p 5432 -t -A -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'delivery_proximity_suggestions');" 2>&1
    
    if ($checkResult -match "t|true|1") {
        Write-Host "Table delivery_proximity_suggestions creee avec succes!" -ForegroundColor Green
    }
} else {
    Write-Host ""
    Write-Host "Erreur lors de l'application de la migration (code: $LASTEXITCODE)" -ForegroundColor Red
}

# Nettoyer
$env:PGPASSWORD = $null

Write-Host ""
Write-Host "Note: Le mot de passe temporaire a ete defini. Pensez a le changer si necessaire." -ForegroundColor Yellow
Write-Host "Pour changer le mot de passe:" -ForegroundColor Cyan
Write-Host "  gcloud sql users set-password $user --instance=$instanceName --password=NOUVEAU_MOT_DE_PASSE --project=$projectId" -ForegroundColor White


