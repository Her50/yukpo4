# Script simplifie pour appliquer la migration delivery_proximity_suggestions
# Usage: .\scripts\apply_migration_simple.ps1

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

Write-Host "Entrez le mot de passe pour ${User}:" -ForegroundColor Yellow
$securePassword = Read-Host -AsSecureString
$BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
$Password = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)

$env:PGPASSWORD = $Password

Write-Host ""
Write-Host "Connexion a Cloud SQL..." -ForegroundColor Yellow
Write-Host "Execution de la migration..." -ForegroundColor Yellow
Write-Host ""

$result = & psql -h $PublicIp -U $User -d $Database -p 5432 -f $sqlFile 2>&1

$result | ForEach-Object { Write-Host $_ }

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "Migration appliquee avec succes!" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "Erreur lors de l'application de la migration" -ForegroundColor Red
    Write-Host "Code de sortie: $LASTEXITCODE" -ForegroundColor Red
}

$env:PGPASSWORD = $null
Remove-Variable -Name Password -ErrorAction SilentlyContinue

