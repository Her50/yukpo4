# Script PowerShell pour exécuter fix_missing_tables_aws.py localement
# Usage: .\scripts\run-fix-missing-tables-local.ps1

$ErrorActionPreference = "Stop"

# Configuration
$REGION = "us-east-1"
$PROJECT_NAME = "yukpomnang"
$ENVIRONMENT = "production"
$SSM_DATABASE_URL_PATH = "/${PROJECT_NAME}/${ENVIRONMENT}/DATABASE_URL"

Write-Host ("=" * 80) -ForegroundColor Cyan
Write-Host "🔧 Exécution du script de création des tables manquantes" -ForegroundColor Cyan
Write-Host ("=" * 80)
Write-Host ""

# Vérifier que Python est installé
try {
    $pythonVersion = python --version 2>&1
    Write-Host "✅ Python trouvé: $pythonVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Python non trouvé. Veuillez installer Python 3.11 ou supérieur" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Vérifier que AWS CLI est configuré
try {
    $accountId = aws sts get-caller-identity --region $REGION --query 'Account' --output text
    Write-Host "✅ AWS CLI configuré (Account: $accountId)" -ForegroundColor Green
} catch {
    Write-Host "❌ Erreur: AWS CLI non configuré ou non authentifié" -ForegroundColor Red
    Write-Host "   Exécutez: aws configure" -ForegroundColor Yellow
    exit 1
}

Write-Host ""

# Vérifier que les dépendances Python sont installées
Write-Host "🔍 Vérification des dépendances Python..." -ForegroundColor Cyan
$requirementsFile = Join-Path $PSScriptRoot "..\scripts\requirements.txt"
if (Test-Path $requirementsFile) {
    Write-Host "📦 Installation des dépendances depuis requirements.txt..." -ForegroundColor Cyan
    pip install -q -r $requirementsFile
    Write-Host "✅ Dépendances installées" -ForegroundColor Green
} else {
    Write-Host "⚠️ requirements.txt non trouvé, installation manuelle..." -ForegroundColor Yellow
    pip install -q boto3 psycopg2-binary
    Write-Host "✅ Dépendances installées" -ForegroundColor Green
}

Write-Host ""

# Vérifier que le script existe
$scriptPath = Join-Path $PSScriptRoot "..\scripts\fix_missing_tables_aws.py"
if (-not (Test-Path $scriptPath)) {
    Write-Host "❌ Script non trouvé: $scriptPath" -ForegroundColor Red
    exit 1
}

Write-Host "📄 Script trouvé: $scriptPath" -ForegroundColor Green
Write-Host ""

# Définir les variables d'environnement
$env:SSM_DATABASE_URL_PATH = $SSM_DATABASE_URL_PATH
$env:AWS_REGION = $REGION

Write-Host "🔧 Configuration:" -ForegroundColor Cyan
Write-Host "  SSM_DATABASE_URL_PATH: $SSM_DATABASE_URL_PATH" -ForegroundColor Gray
Write-Host "  AWS_REGION: $REGION" -ForegroundColor Gray
Write-Host ""

# Exécuter le script
Write-Host "🚀 Exécution du script..." -ForegroundColor Cyan
Write-Host ""

try {
    python $scriptPath
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host ("=" * 80)
        Write-Host "✅ Script exécuté avec succès" -ForegroundColor Green
        Write-Host ("=" * 80)
    } else {
        Write-Host ""
        Write-Host ("=" * 80)
        Write-Host "⚠️ Script terminé avec des erreurs (code: $LASTEXITCODE)" -ForegroundColor Yellow
        Write-Host ("=" * 80)
        exit $LASTEXITCODE
    }
} catch {
    Write-Host ""
    Write-Host "❌ Erreur lors de l'exécution: $_" -ForegroundColor Red
    exit 1
}

