# Script pour appliquer les migrations directement via psql avec IP publique

param(
    [string]$ProjectId = "yukpo-project",
    [string]$InstanceName = "yukpo-postgres",
    [string]$DatabaseName = "yukpo_db",
    [string]$User = "yukpo_user",
    [string]$PublicIP = "34.79.199.41"
)

Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host "Application Directe des Migrations via psql" -ForegroundColor Cyan
Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host ""

# Vérifier que psql est disponible
if (-not (Get-Command psql -ErrorAction SilentlyContinue)) {
    Write-Host "ERREUR: psql n'est pas installe!" -ForegroundColor Red
    exit 1
}

# Lire le fichier SQL
$sqlFile = "backend\migrations\20260218_ALL_OPTIMIZATIONS_COMBINED.sql"
if (-not (Test-Path $sqlFile)) {
    Write-Host "ERREUR: Fichier SQL non trouve: $sqlFile" -ForegroundColor Red
    exit 1
}

$sqlContent = Get-Content $sqlFile -Raw
Write-Host "Fichier SQL lu: $sqlFile" -ForegroundColor Green
Write-Host ""

# Demander le mot de passe
$securePassword = Read-Host "Entrez le mot de passe pour l'utilisateur '$User'" -AsSecureString
$password = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
    [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
)

# Créer un fichier temporaire
$tempFile = [System.IO.Path]::GetTempFileName()
$tempFile = $tempFile -replace '\.tmp$', '.sql'
$sqlContent | Out-File -FilePath $tempFile -Encoding UTF8

Write-Host ""
Write-Host "Application des migrations via psql..." -ForegroundColor Yellow
Write-Host "   Host: $PublicIP" -ForegroundColor Gray
Write-Host "   Database: $DatabaseName" -ForegroundColor Gray
Write-Host "   User: $User" -ForegroundColor Gray
Write-Host ""

# Définir PGPASSWORD
$env:PGPASSWORD = $password

# Construire la chaîne de connexion
$connectionString = "host=$PublicIP port=5432 dbname=$DatabaseName user=$User sslmode=require"

# Appliquer la migration
Write-Host "Execution en cours..." -ForegroundColor Cyan
$result = & psql $connectionString -f $tempFile 2>&1

# Nettoyer
$env:PGPASSWORD = $null

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "OK Migrations appliquees avec succes!" -ForegroundColor Green
    Write-Host $result
} else {
    Write-Host ""
    Write-Host "ERREUR lors de l'application des migrations" -ForegroundColor Red
    Write-Host $result
    Write-Host ""
    Write-Host "Fichier SQL conserve: $tempFile" -ForegroundColor Gray
}

Write-Host ""
Write-Host "Fichier temporaire: $tempFile" -ForegroundColor Gray
