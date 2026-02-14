# Script pour exécuter le script SQL de correction des colonnes manquantes
# Usage: .\execute_fix_missing_columns.ps1

param(
    [string]$DatabaseUrl = $env:DATABASE_URL,
    [string]$SqlFile = "scripts\fix_missing_columns.sql"
)

Write-Host "🔧 Exécution du script de correction des colonnes manquantes..." -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Vérifier que le fichier SQL existe
if (-not (Test-Path $SqlFile)) {
    Write-Host "❌ ERREUR: Fichier SQL introuvable: $SqlFile" -ForegroundColor Red
    exit 1
}

# Vérifier que DATABASE_URL est définie
if ([string]::IsNullOrEmpty($DatabaseUrl)) {
    Write-Host "❌ ERREUR: DATABASE_URL non définie" -ForegroundColor Red
    Write-Host "   Définissez-la avec:" -ForegroundColor Yellow
    Write-Host "   `$env:DATABASE_URL = 'postgresql://user:pass@host:5432/dbname'" -ForegroundColor Gray
    Write-Host "   OU:" -ForegroundColor Yellow
    Write-Host "   .\execute_fix_missing_columns.ps1 -DatabaseUrl 'postgresql://user:pass@host:5432/dbname'" -ForegroundColor Gray
    exit 1
}

# Vérifier que psql est disponible
$psqlPath = Get-Command psql -ErrorAction SilentlyContinue
if (-not $psqlPath) {
    Write-Host "❌ ERREUR: psql n'est pas installé ou n'est pas dans le PATH" -ForegroundColor Red
    Write-Host "   Installez PostgreSQL client pour Windows" -ForegroundColor Yellow
    Write-Host "   Téléchargement: https://www.postgresql.org/download/windows/" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "   Alternative: Utilisez AWS RDS Query Editor" -ForegroundColor Yellow
    Write-Host "   1. Ouvrez AWS Console: https://console.aws.amazon.com/rds/" -ForegroundColor White
    Write-Host "   2. Sélectionnez votre instance RDS" -ForegroundColor White
    Write-Host "   3. Cliquez sur 'Query Editor' ou 'Query Editor v2'" -ForegroundColor White
    Write-Host "   4. Copiez-collez le contenu de $SqlFile" -ForegroundColor White
    exit 1
}

Write-Host "📊 Informations de connexion:" -ForegroundColor Yellow
# Extraire les composants de DATABASE_URL pour affichage (sans le mot de passe)
$dbUrlParts = $DatabaseUrl -replace '^postgresql://', '' -split '@'
if ($dbUrlParts.Length -eq 2) {
    $userPass = $dbUrlParts[0] -split ':'
    $hostDb = $dbUrlParts[1]
    if ($userPass.Length -ge 1) {
        Write-Host "   User: $($userPass[0])" -ForegroundColor Gray
    }
    Write-Host "   Host: $hostDb" -ForegroundColor Gray
}
Write-Host ""

# Vérifier la connectivité
Write-Host "🔍 Vérification de la connectivité..." -ForegroundColor Yellow
$testResult = psql $DatabaseUrl -c "SELECT version();" 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ ERREUR: Impossible de se connecter à la base de données" -ForegroundColor Red
    Write-Host "   Vérifiez vos identifiants et que l'instance est accessible" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "   Détails:" -ForegroundColor Yellow
    Write-Host $testResult -ForegroundColor Gray
    exit 1
}
Write-Host "✅ Connexion réussie" -ForegroundColor Green
Write-Host ""

# Exécuter le script SQL
Write-Host "🛠️  Exécution du script SQL..." -ForegroundColor Yellow
Write-Host "   Fichier: $SqlFile" -ForegroundColor Gray
Write-Host ""

$sqlContent = Get-Content $SqlFile -Raw
$result = psql $DatabaseUrl -c $sqlContent 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Script SQL exécuté avec succès" -ForegroundColor Green
    Write-Host ""
    Write-Host "📋 Résultats:" -ForegroundColor Cyan
    Write-Host $result -ForegroundColor Gray
} else {
    Write-Host "⚠️  Le script SQL a généré des warnings ou erreurs" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "📋 Sortie:" -ForegroundColor Cyan
    Write-Host $result -ForegroundColor Gray
    Write-Host ""
    Write-Host "💡 Note: Certaines erreurs peuvent être normales si les colonnes existent déjà" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "✅ Correction terminée" -ForegroundColor Green

