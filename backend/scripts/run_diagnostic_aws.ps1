# Script de diagnostic pour comprendre pourquoi les migrations ne passent pas
# Exécute le script SQL de diagnostic sur AWS RDS

param(
    [string]$DatabaseUrl = $env:DATABASE_URL,
    [string]$AwsRegion = "eu-west-1",
    [string]$SecretName = "yukpomnang/backend/secrets"
)

Write-Host "🔍 Diagnostic des migrations AWS..." -ForegroundColor Cyan

# 1. Récupérer DATABASE_URL
if (-not $DatabaseUrl) {
    Write-Host "📋 DATABASE_URL non fournie, tentative de récupération depuis AWS Secrets Manager..." -ForegroundColor Yellow
    
    try {
        # Vérifier si AWS CLI est installé
        $awsCli = Get-Command aws -ErrorAction SilentlyContinue
        if (-not $awsCli) {
            Write-Host "❌ AWS CLI n'est pas installé. Veuillez installer AWS CLI ou fournir DATABASE_URL manuellement." -ForegroundColor Red
            Write-Host "   Exemple: .\run_diagnostic_aws.ps1 -DatabaseUrl 'postgresql://user:pass@host:5432/db'" -ForegroundColor Yellow
            exit 1
        }
        
        # Récupérer le secret depuis AWS Secrets Manager
        Write-Host "🔐 Récupération du secret depuis AWS Secrets Manager..." -ForegroundColor Cyan
        $secretJson = aws secretsmanager get-secret-value --secret-id $SecretName --region $AwsRegion --query SecretString --output text 2>$null
        
        if ($secretJson) {
            $secrets = $secretJson | ConvertFrom-Json
            $DatabaseUrl = $secrets.DATABASE_URL
            Write-Host "✅ DATABASE_URL récupérée depuis Secrets Manager" -ForegroundColor Green
        } else {
            Write-Host "❌ Impossible de récupérer le secret depuis AWS Secrets Manager" -ForegroundColor Red
            Write-Host "   Veuillez fournir DATABASE_URL manuellement:" -ForegroundColor Yellow
            Write-Host "   .\run_diagnostic_aws.ps1 -DatabaseUrl 'postgresql://user:pass@host:5432/db'" -ForegroundColor Yellow
            exit 1
        }
    } catch {
        Write-Host "❌ Erreur lors de la récupération du secret: $_" -ForegroundColor Red
        Write-Host "   Veuillez fournir DATABASE_URL manuellement:" -ForegroundColor Yellow
        Write-Host "   .\run_diagnostic_aws.ps1 -DatabaseUrl 'postgresql://user:pass@host:5432/db'" -ForegroundColor Yellow
        exit 1
    }
}

if (-not $DatabaseUrl) {
    Write-Host "❌ DATABASE_URL est requise" -ForegroundColor Red
    exit 1
}

# 2. Vérifier si psql est installé
$psql = Get-Command psql -ErrorAction SilentlyContinue
if (-not $psql) {
    Write-Host "❌ psql n'est pas installé. Veuillez installer PostgreSQL client." -ForegroundColor Red
    Write-Host "   Windows: https://www.postgresql.org/download/windows/" -ForegroundColor Yellow
    Write-Host "   Ou utilisez Docker: docker run -it --rm postgres psql \$DatabaseUrl" -ForegroundColor Yellow
    exit 1
}

# 3. Chemin du script SQL
$scriptPath = Join-Path $PSScriptRoot "diagnose_migrations_aws.sql"
if (-not (Test-Path $scriptPath)) {
    Write-Host "❌ Script SQL non trouvé: $scriptPath" -ForegroundColor Red
    exit 1
}

# 4. Exécuter le diagnostic
Write-Host "🚀 Exécution du diagnostic..." -ForegroundColor Cyan
Write-Host "   Database: $($DatabaseUrl -replace ':[^:@]+@', ':****@')" -ForegroundColor Gray
Write-Host ""

try {
    # Exécuter le script SQL
    $output = & psql $DatabaseUrl -f $scriptPath 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "✅ Diagnostic terminé avec succès" -ForegroundColor Green
        Write-Host ""
        Write-Host "📊 Résultats:" -ForegroundColor Cyan
        Write-Host $output
    } else {
        Write-Host ""
        Write-Host "❌ Erreur lors de l'exécution du diagnostic" -ForegroundColor Red
        Write-Host $output
        exit 1
    }
} catch {
    Write-Host "❌ Erreur: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "💡 Analyse des résultats:" -ForegroundColor Cyan
Write-Host "   1. Vérifiez l'état de _sqlx_migrations (version, success, checksum)" -ForegroundColor Yellow
Write-Host "   2. Vérifiez quelles tables existent (✅) et lesquelles manquent (❌)" -ForegroundColor Yellow
Write-Host "   3. Vérifiez les types ENUM nécessaires" -ForegroundColor Yellow
Write-Host "   4. Vérifiez les tables de dépendance intermédiaires" -ForegroundColor Yellow
Write-Host ""
Write-Host "📝 Si des tables manquent, appliquez la migration consolidée:" -ForegroundColor Cyan
Write-Host "   .\apply_missing_tables_migration.ps1 -DatabaseUrl `$DatabaseUrl" -ForegroundColor Yellow

