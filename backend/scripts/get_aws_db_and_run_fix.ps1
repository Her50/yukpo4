# Script pour recuperer DATABASE_URL depuis AWS et executer les scripts de diagnostic/correction
# Date: 2026-01-30

param(
    [switch]$AutoConfirm,
    [string]$SecretName = "yukpomnang/backend/secrets",
    [string]$Region = "us-east-1"
)

Write-Host "Recuperation de DATABASE_URL depuis AWS Secrets Manager" -ForegroundColor Cyan
Write-Host ""

# Verifier que AWS CLI est installe
$awsCli = Get-Command aws -ErrorAction SilentlyContinue
if (-not $awsCli) {
    Write-Host "ERREUR: AWS CLI n'est pas installe" -ForegroundColor Red
    Write-Host "   Installez AWS CLI depuis: https://aws.amazon.com/cli/" -ForegroundColor Yellow
    exit 1
}

Write-Host "AWS CLI trouve: $($awsCli.Source)" -ForegroundColor Green
Write-Host ""

# Recuperer le secret depuis AWS Secrets Manager
Write-Host "Recuperation du secret: $SecretName" -ForegroundColor Yellow
Write-Host "Region: $Region" -ForegroundColor Gray
Write-Host ""

try {
    $secretJson = aws secretsmanager get-secret-value --secret-id $SecretName --region $Region --query SecretString --output text 2>&1
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERREUR lors de la recuperation du secret:" -ForegroundColor Red
        Write-Host $secretJson -ForegroundColor Red
        Write-Host ""
        Write-Host "Verifications:" -ForegroundColor Yellow
        Write-Host "  1. AWS CLI est configure (aws configure)" -ForegroundColor Gray
        Write-Host "  2. Vous avez les permissions pour acceder au secret" -ForegroundColor Gray
        Write-Host "  3. Le nom du secret est correct: $SecretName" -ForegroundColor Gray
        Write-Host "  4. La region est correcte: $Region" -ForegroundColor Gray
        exit 1
    }
    
    # Parser le JSON pour extraire DATABASE_URL
    $secret = $secretJson | ConvertFrom-Json
    
    if (-not $secret.DATABASE_URL) {
        Write-Host "ERREUR: DATABASE_URL non trouvee dans le secret" -ForegroundColor Red
        Write-Host "   Le secret contient: $($secret.PSObject.Properties.Name -join ', ')" -ForegroundColor Yellow
        exit 1
    }
    
    $env:DATABASE_URL = $secret.DATABASE_URL
    
    Write-Host "DATABASE_URL recuperee avec succes" -ForegroundColor Green
    Write-Host "   Host: $($env:DATABASE_URL -replace 'postgresql://[^:]+:[^@]+@([^:/]+).*', '$1')" -ForegroundColor Gray
    Write-Host ""
    
} catch {
    Write-Host "ERREUR lors du parsing du secret:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}

# Verifier que le script run_diagnostic_fix.ps1 existe
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$diagnosticScript = Join-Path $scriptDir "run_diagnostic_fix.ps1"

if (-not (Test-Path $diagnosticScript)) {
    Write-Host "ERREUR: Script run_diagnostic_fix.ps1 non trouve: $diagnosticScript" -ForegroundColor Red
    exit 1
}

# Executer le script avec Rust
Write-Host "Execution des scripts de diagnostic et correction..." -ForegroundColor Cyan
Write-Host ""

$params = @("-UseRust")
if ($AutoConfirm) {
    $params += "-AutoConfirm"
}

& $diagnosticScript @params

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "Processus termine avec succes" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "Processus termine avec des erreurs (code: $LASTEXITCODE)" -ForegroundColor Red
    exit $LASTEXITCODE
}






