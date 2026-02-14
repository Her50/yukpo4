# Script pour vérifier toutes les variables d'environnement du backend dans AWS
# Vérifie Secrets Manager et SSM Parameter Store

$ErrorActionPreference = "Stop"

Write-Host "[VERIFICATION] Verification des variables d'environnement AWS..." -ForegroundColor Cyan
Write-Host ""

# Variables attendues
$expectedSecrets = @(
    "DATABASE_URL",
    "REDIS_URL",
    "JWT_SECRET",
    "MONGODB_URL",
    "RUST_LOG",
    "PORT",
    "HOST",
    "APP_ENV",
    "ENABLE_AUTO_MIGRATIONS"
)

$expectedSSMParams = @(
    "S3_BUCKET",
    "S3_REGION",
    "S3_ACCESS_KEY",
    "S3_SECRET_KEY",
    "UPLOAD_BASE_URL",
    "LAUNCH_PHASE_START_DATE"
)

$projectName = "yukpo"
$environment = "production"
$region = "eu-west-1"

# 1. Vérifier Secrets Manager
Write-Host "[1] Verification Secrets Manager..." -ForegroundColor Yellow
Write-Host ""

$secretName = "$projectName/backend/secrets"
try {
    $secret = aws secretsmanager get-secret-value --secret-id $secretName --region $region --query 'SecretString' --output text 2>&1
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERREUR] Secret '$secretName' introuvable ou inaccessible" -ForegroundColor Red
        Write-Host "   Erreur: $secret" -ForegroundColor Red
    } else {
        $secretJson = $secret | ConvertFrom-Json
        
        Write-Host "[OK] Secret '$secretName' trouve" -ForegroundColor Green
        Write-Host ""
        Write-Host "Variables dans Secrets Manager:" -ForegroundColor Cyan
        
        $missingSecrets = @()
        foreach ($var in $expectedSecrets) {
            if ($secretJson.PSObject.Properties.Name -contains $var) {
                $value = $secretJson.$var
                if ($var -eq "JWT_SECRET" -or $var -eq "DATABASE_URL" -or $var -eq "REDIS_URL" -or $var -eq "MONGODB_URL") {
                    $displayValue = $value.Substring(0, [Math]::Min(20, $value.Length)) + "..."
                    Write-Host "  [OK] $var = $displayValue" -ForegroundColor Green
                } else {
                    Write-Host "  [OK] $var = $value" -ForegroundColor Green
                }
            } else {
                Write-Host "  [MANQUANT] $var = MANQUANT" -ForegroundColor Red
                $missingSecrets += $var
            }
        }
        
        if ($missingSecrets.Count -gt 0) {
            Write-Host ""
            Write-Host "[ATTENTION] Variables manquantes dans Secrets Manager:" -ForegroundColor Yellow
            foreach ($var in $missingSecrets) {
                Write-Host "  - $var" -ForegroundColor Yellow
            }
        }
    }
} catch {
    Write-Host "[ERREUR] Erreur lors de la recuperation du secret: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host ""

# 2. Vérifier SSM Parameter Store
Write-Host "[2] Verification SSM Parameter Store..." -ForegroundColor Yellow
Write-Host ""

$missingSSMParams = @()
foreach ($param in $expectedSSMParams) {
    $paramPath = "/$projectName/$environment/$param"
    try {
        $value = aws ssm get-parameter --name $paramPath --region $region --query 'Parameter.Value' --output text --with-decryption 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            if ($param -like "*KEY*" -or $param -like "*SECRET*") {
                $displayValue = $value.Substring(0, [Math]::Min(10, $value.Length)) + "..."
                Write-Host "  [OK] $param = $displayValue" -ForegroundColor Green
            } else {
                Write-Host "  [OK] $param = $value" -ForegroundColor Green
            }
        } else {
            Write-Host "  [MANQUANT] $param = MANQUANT ($paramPath)" -ForegroundColor Red
            $missingSSMParams += $param
        }
    } catch {
        Write-Host "  [ERREUR] $param = ERREUR: $_" -ForegroundColor Red
        $missingSSMParams += $param
    }
}

if ($missingSSMParams.Count -gt 0) {
    Write-Host ""
    Write-Host "[ATTENTION] Variables manquantes dans SSM Parameter Store:" -ForegroundColor Yellow
    foreach ($var in $missingSSMParams) {
        Write-Host "  - $var" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host ""

# 3. Résumé
Write-Host "[RESUME] Resume:" -ForegroundColor Cyan
Write-Host ""

$totalExpected = $expectedSecrets.Count + $expectedSSMParams.Count
$totalMissing = $missingSecrets.Count + $missingSSMParams.Count
$totalFound = $totalExpected - $totalMissing

Write-Host "  Variables attendues: $totalExpected" -ForegroundColor White
Write-Host "  Variables trouvées: $totalFound" -ForegroundColor Green
Write-Host "  Variables manquantes: $totalMissing" -ForegroundColor $(if ($totalMissing -eq 0) { "Green" } else { "Red" })

if ($totalMissing -eq 0) {
    Write-Host ""
    Write-Host "Toutes les variables d'environnement sont presentes !" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "Certaines variables sont manquantes. Veuillez les ajouter." -ForegroundColor Yellow
}

