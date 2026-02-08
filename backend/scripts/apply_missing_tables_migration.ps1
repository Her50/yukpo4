# Script pour appliquer la migration consolidée des tables manquantes
# Applique backend/migrations/20260129_create_missing_tables_aws.sql

param(
    [string]$DatabaseUrl = $env:DATABASE_URL,
    [string]$AwsRegion = "eu-west-1",
    [string]$SecretName = "yukpomnang/backend/secrets"
)

Write-Host "🚀 Application de la migration consolidée pour créer les tables manquantes..." -ForegroundColor Cyan

# 1. Récupérer DATABASE_URL (même logique que run_diagnostic_aws.ps1)
if (-not $DatabaseUrl) {
    Write-Host "📋 DATABASE_URL non fournie, tentative de récupération depuis AWS Secrets Manager..." -ForegroundColor Yellow
    
    try {
        $awsCli = Get-Command aws -ErrorAction SilentlyContinue
        if (-not $awsCli) {
            Write-Host "❌ AWS CLI n'est pas installé. Veuillez fournir DATABASE_URL manuellement." -ForegroundColor Red
            exit 1
        }
        
        $secretJson = aws secretsmanager get-secret-value --secret-id $SecretName --region $AwsRegion --query SecretString --output text 2>$null
        if ($secretJson) {
            $secrets = $secretJson | ConvertFrom-Json
            $DatabaseUrl = $secrets.DATABASE_URL
            Write-Host "✅ DATABASE_URL récupérée depuis Secrets Manager" -ForegroundColor Green
        } else {
            Write-Host "❌ Impossible de récupérer le secret. Veuillez fournir DATABASE_URL manuellement." -ForegroundColor Red
            exit 1
        }
    } catch {
        Write-Host "❌ Erreur: $_" -ForegroundColor Red
        exit 1
    }
}

if (-not $DatabaseUrl) {
    Write-Host "❌ DATABASE_URL est requise" -ForegroundColor Red
    exit 1
}

# 2. Vérifier psql
$psql = Get-Command psql -ErrorAction SilentlyContinue
if (-not $psql) {
    Write-Host "❌ psql n'est pas installé." -ForegroundColor Red
    exit 1
}

# 3. Chemin de la migration
$migrationPath = Join-Path (Split-Path $PSScriptRoot -Parent) "migrations\20260129_create_missing_tables_aws.sql"
if (-not (Test-Path $migrationPath)) {
    Write-Host "❌ Migration non trouvée: $migrationPath" -ForegroundColor Red
    exit 1
}

# 4. Confirmation
Write-Host ""
Write-Host "⚠️  ATTENTION: Cette migration va créer les tables manquantes dans la base de données." -ForegroundColor Yellow
Write-Host "   Database: $($DatabaseUrl -replace ':[^:@]+@', ':****@')" -ForegroundColor Gray
Write-Host ""
$confirm = Read-Host "   Continuer? (O/N)"
if ($confirm -ne "O" -and $confirm -ne "o" -and $confirm -ne "Y" -and $confirm -ne "y") {
    Write-Host "❌ Opération annulée" -ForegroundColor Yellow
    exit 0
}

# 5. Appliquer la migration
Write-Host ""
Write-Host "🚀 Application de la migration..." -ForegroundColor Cyan

try {
    $output = & psql $DatabaseUrl -f $migrationPath 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "✅ Migration appliquée avec succès" -ForegroundColor Green
        Write-Host ""
        Write-Host "📊 Sortie:" -ForegroundColor Cyan
        Write-Host $output
        Write-Host ""
        Write-Host "💡 Vérifiez maintenant que les tables ont été créées:" -ForegroundColor Cyan
        Write-Host "   .\run_diagnostic_aws.ps1 -DatabaseUrl `$DatabaseUrl" -ForegroundColor Yellow
    } else {
        Write-Host ""
        Write-Host "❌ Erreur lors de l'application de la migration" -ForegroundColor Red
        Write-Host $output
        exit 1
    }
} catch {
    Write-Host "❌ Erreur: $_" -ForegroundColor Red
    exit 1
}







