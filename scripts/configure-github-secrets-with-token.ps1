# Script de Configuration des Secrets GitHub avec Token
# Usage: .\scripts\configure-github-secrets-with-token.ps1 -GitHubToken "votre_token"

param(
    [Parameter(Mandatory=$true)]
    [string]$GitHubToken,
    [string]$GitHubRepo = "Her50/yukpo4",
    [string]$ProjectId = "yukpo-project",
    [string]$EnvVarsFile = "gcp-env-vars.json"
)

$ErrorActionPreference = "Stop"

Write-Host "Configuration des Secrets GitHub avec Token" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Mettre a jour le PATH
$env:PATH = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

# Verifier GitHub CLI
$ghCmd = Get-Command gh -ErrorAction SilentlyContinue
if (-not $ghCmd) {
    Write-Host "ERREUR: GitHub CLI (gh) non trouve" -ForegroundColor Red
    exit 1
}

# Authentifier avec le token
Write-Host "Authentification avec le token..." -ForegroundColor Yellow
echo $GitHubToken | gh auth login --with-token 2>&1 | Out-Null

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERREUR: Authentification echouee. Verifiez votre token." -ForegroundColor Red
    exit 1
}

Write-Host "Authentifie avec succes" -ForegroundColor Green
Write-Host ""

# Lire les variables d'environnement
if (-not (Test-Path $EnvVarsFile)) {
    Write-Host "ERREUR: Fichier $EnvVarsFile non trouve" -ForegroundColor Red
    exit 1
}

Write-Host "Lecture des variables depuis $EnvVarsFile..." -ForegroundColor Yellow
$envVars = Get-Content $EnvVarsFile -Raw | ConvertFrom-Json
Write-Host "   $($envVars.PSObject.Properties.Count) variables trouvees" -ForegroundColor Green
Write-Host ""

# Lire la clé Service Account
$saKeyFile = "gcp-sa-key.json"
if (-not (Test-Path $saKeyFile)) {
    Write-Host "ATTENTION: Fichier $saKeyFile non trouve" -ForegroundColor Yellow
    $saKeyContent = $null
} else {
    $saKeyContent = Get-Content $saKeyFile -Raw
    Write-Host "Cle Service Account trouvee: $saKeyFile" -ForegroundColor Green
}

Write-Host ""

# Configurer les secrets de base
Write-Host "Configuration des secrets GCP de base..." -ForegroundColor Yellow

if ($saKeyContent) {
    Write-Host "   Configuration de GCP_SA_KEY..." -ForegroundColor Gray
    $tempFile = [System.IO.Path]::GetTempFileName()
    $saKeyContent | Out-File -FilePath $tempFile -Encoding UTF8 -NoNewline
    Get-Content $tempFile | gh secret set GCP_SA_KEY --repo $GitHubRepo 2>&1 | Out-Null
    Remove-Item $tempFile -Force
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   GCP_SA_KEY configure" -ForegroundColor Green
    } else {
        Write-Host "   ERREUR: Impossible de configurer GCP_SA_KEY" -ForegroundColor Red
    }
}

$databaseUrl = $envVars.DATABASE_URL
if ($databaseUrl) {
    Write-Host "   Configuration de GCP_DATABASE_URL..." -ForegroundColor Gray
    echo $databaseUrl | gh secret set GCP_DATABASE_URL --repo $GitHubRepo 2>&1 | Out-Null
    Write-Host "   GCP_DATABASE_URL configure" -ForegroundColor Green
}

Write-Host "   Configuration de GCP_PROJECT_ID..." -ForegroundColor Gray
echo $ProjectId | gh secret set GCP_PROJECT_ID --repo $GitHubRepo 2>&1 | Out-Null
Write-Host "   GCP_PROJECT_ID configure" -ForegroundColor Green

Write-Host "   Configuration de GCP_REGION..." -ForegroundColor Gray
echo "europe-west1" | gh secret set GCP_REGION --repo $GitHubRepo 2>&1 | Out-Null
Write-Host "   GCP_REGION configure" -ForegroundColor Green

$serviceAccountEmail = "github-actions@${ProjectId}.iam.gserviceaccount.com"
Write-Host "   Configuration de GCP_SERVICE_ACCOUNT_EMAIL..." -ForegroundColor Gray
echo $serviceAccountEmail | gh secret set GCP_SERVICE_ACCOUNT_EMAIL --repo $GitHubRepo 2>&1 | Out-Null
Write-Host "   GCP_SERVICE_ACCOUNT_EMAIL configure" -ForegroundColor Green

$dbInstanceConnectionName = "${ProjectId}:europe-west1:yukpo-db"
Write-Host "   Configuration de GCP_DB_INSTANCE_CONNECTION_NAME..." -ForegroundColor Gray
echo $dbInstanceConnectionName | gh secret set GCP_DB_INSTANCE_CONNECTION_NAME --repo $GitHubRepo 2>&1 | Out-Null
Write-Host "   GCP_DB_INSTANCE_CONNECTION_NAME configure" -ForegroundColor Green

Write-Host ""
Write-Host "Secrets de base configures" -ForegroundColor Green
Write-Host ""

# Configurer toutes les variables d'environnement
Write-Host "Configuration de toutes les variables d'environnement..." -ForegroundColor Yellow
Write-Host "   (Cela peut prendre plusieurs minutes...)" -ForegroundColor Gray
Write-Host ""

$secretCount = 0
$errorCount = 0
$totalVars = ($envVars.PSObject.Properties | Measure-Object).Count

foreach ($prop in $envVars.PSObject.Properties) {
    $key = $prop.Name
    $value = $prop.Value
    
    if ($null -eq $value -or $value -eq "" -or $value -match "\[A_.*\]") {
        continue
    }
    
    $valueString = if ($value -is [string]) { $value } else { $value | ConvertTo-Json -Compress }
    $secretName = "GCP_ENV_$key"
    
    try {
        echo $valueString | gh secret set $secretName --repo $GitHubRepo 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) {
            $secretCount++
            
            if ($secretCount % 10 -eq 0) {
                Write-Host "   [$secretCount/$totalVars] variables configurees..." -ForegroundColor DarkGray
            }
        } else {
            $errorCount++
        }
    } catch {
        $errorCount++
    }
}

Write-Host ""
Write-Host "Configuration terminee !" -ForegroundColor Green
Write-Host "=========================" -ForegroundColor Green
Write-Host ""
Write-Host "Resume:" -ForegroundColor Cyan
Write-Host "   Secrets de base configures: 6" -ForegroundColor White
Write-Host "   Variables d'environnement configurees: $secretCount" -ForegroundColor White
if ($errorCount -gt 0) {
    Write-Host "   Erreurs: $errorCount" -ForegroundColor Yellow
}
Write-Host ""
Write-Host "Total secrets GitHub: $($secretCount + 6)" -ForegroundColor Green
Write-Host ""

