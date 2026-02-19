# Script pour appliquer la migration delivery_proximity_suggestions
# Usage: .\scripts\apply_migration_final.ps1 -Password "VOTRE_MOT_DE_PASSE"
# OU: $env:DB_PASSWORD="VOTRE_MOT_DE_PASSE"; .\scripts\apply_migration_final.ps1

param(
    [string]$Password = $env:DB_PASSWORD
)

$PublicIp = "34.79.199.41"
$User = "yukpo_user"
$Database = "yukpo_db"
$sqlFile = "scripts\apply_delivery_proximity_migration_simple.sql"

Write-Host "Application de la migration delivery_proximity_suggestions..." -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path $sqlFile)) {
    Write-Host "Erreur: Fichier non trouve: $sqlFile" -ForegroundColor Red
    exit 1
}

if ([string]::IsNullOrWhiteSpace($Password)) {
    Write-Host "Erreur: Mot de passe non fourni" -ForegroundColor Red
    Write-Host "Usage: .\scripts\apply_migration_final.ps1 -Password 'VOTRE_MOT_DE_PASSE'" -ForegroundColor Yellow
    Write-Host "OU: `$env:DB_PASSWORD='VOTRE_MOT_DE_PASSE'; .\scripts\apply_migration_final.ps1" -ForegroundColor Yellow
    exit 1
}

$env:PGPASSWORD = $Password

Write-Host "Connexion a Cloud SQL..." -ForegroundColor Yellow
Write-Host "IP: $PublicIp" -ForegroundColor Gray
Write-Host "Database: $Database" -ForegroundColor Gray
Write-Host "User: ${User}" -ForegroundColor Gray
Write-Host ""
Write-Host "Execution de la migration..." -ForegroundColor Yellow
Write-Host ""

$result = & psql -h $PublicIp -U $User -d $Database -p 5432 -f $sqlFile 2>&1

$result | ForEach-Object { Write-Host $_ }

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "Migration appliquee avec succes!" -ForegroundColor Green
    
    # Verification
    Write-Host ""
    Write-Host "Verification de la table..." -ForegroundColor Cyan
    $checkResult = & psql -h $PublicIp -U $User -d $Database -p 5432 -t -A -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'delivery_proximity_suggestions');" 2>&1
    
    if ($checkResult -match "t|true|1") {
        Write-Host "Table delivery_proximity_suggestions creee avec succes!" -ForegroundColor Green
    } else {
        Write-Host "Resultat verification: $checkResult" -ForegroundColor Yellow
    }
} else {
    Write-Host ""
    Write-Host "Erreur lors de l'application de la migration" -ForegroundColor Red
    Write-Host "Code de sortie: $LASTEXITCODE" -ForegroundColor Red
}

$env:PGPASSWORD = $null


