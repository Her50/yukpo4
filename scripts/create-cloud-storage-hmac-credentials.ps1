# Script pour Créer Automatiquement les Credentials HMAC Cloud Storage
# Usage: .\scripts\create-cloud-storage-hmac-credentials.ps1

param(
    [string]$ProjectId = "yukpo-project",
    [string]$ServiceAccountEmail = "cloud-storage-sa@yukpo-project.iam.gserviceaccount.com"
)

$ErrorActionPreference = "Stop"

Write-Host "Creation Automatique des Credentials HMAC Cloud Storage" -ForegroundColor Cyan
Write-Host "=========================================================" -ForegroundColor Cyan
Write-Host ""

# Mettre a jour le PATH
$env:PATH = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
$gcloudPath = "$env:ProgramFiles\Google\Cloud SDK\google-cloud-sdk\bin"
if (Test-Path $gcloudPath) {
    $env:PATH += ";$gcloudPath"
}

# Configurer le projet
gcloud config set project $ProjectId 2>&1 | Out-Null

Write-Host "Projet configure: $ProjectId" -ForegroundColor Green
Write-Host "Service Account: $ServiceAccountEmail" -ForegroundColor Green
Write-Host ""

# Verifier que le service account existe
Write-Host "Verification du Service Account..." -ForegroundColor Yellow
$ErrorActionPreference = "Continue"
$saExists = gcloud iam service-accounts describe $ServiceAccountEmail --project=$ProjectId 2>&1 | Select-String -Pattern "email"
$ErrorActionPreference = "Stop"

if (-not $saExists) {
    Write-Host "ERREUR: Service Account non trouve: $ServiceAccountEmail" -ForegroundColor Red
    Write-Host "Creation du Service Account..." -ForegroundColor Yellow
    
    $saName = $ServiceAccountEmail.Split("@")[0]
    gcloud iam service-accounts create $saName `
        --display-name="Cloud Storage Service Account" `
        --project=$ProjectId
    
    # Assigner les permissions
    gcloud projects add-iam-policy-binding $ProjectId `
        --member="serviceAccount:$ServiceAccountEmail" `
        --role="roles/storage.objectAdmin" `
        --project=$ProjectId 2>&1 | Out-Null
    
    Write-Host "Service Account cree: $ServiceAccountEmail" -ForegroundColor Green
} else {
    Write-Host "Service Account existe: $ServiceAccountEmail" -ForegroundColor Green
}

Write-Host ""

# Obtenir un access token pour l'API REST
Write-Host "Obtention d'un access token..." -ForegroundColor Yellow
$accessToken = gcloud auth print-access-token --project=$ProjectId

if (-not $accessToken) {
    Write-Host "ERREUR: Impossible d'obtenir un access token" -ForegroundColor Red
    Write-Host "Assurez-vous d'etre authentifie: gcloud auth login" -ForegroundColor Yellow
    exit 1
}

Write-Host "Access token obtenu" -ForegroundColor Green
Write-Host ""

# Extraire le nom du service account (sans @project.iam.gserviceaccount.com)
$saName = $ServiceAccountEmail.Split("@")[0]

# Utiliser l'API REST Storage pour creer les credentials HMAC
Write-Host "Creation des credentials HMAC via l'API REST..." -ForegroundColor Yellow

$apiUrl = "https://storage.googleapis.com/storage/v1/projects/$ProjectId/hmacKeys"
$headers = @{
    "Authorization" = "Bearer $accessToken"
    "Content-Type" = "application/json"
}

$body = @{
    serviceAccountEmail = $ServiceAccountEmail
} | ConvertTo-Json

try {
    Write-Host "   Envoi de la requete a l'API..." -ForegroundColor Gray
    $response = Invoke-RestMethod -Uri $apiUrl -Method POST -Headers $headers -Body $body -ErrorAction Stop
    
    $accessKey = $response.accessId
    $secretKey = $response.secret
    
    Write-Host "Credentials HMAC crees avec succes !" -ForegroundColor Green
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "CREDENTIALS HMAC CLOUD STORAGE" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Access Key: $accessKey" -ForegroundColor Green
    Write-Host "Secret Key: $secretKey" -ForegroundColor Green
    Write-Host ""
    Write-Host "⚠️ IMPORTANT: Le Secret Key est visible UNE SEULE FOIS !" -ForegroundColor Yellow
    Write-Host "   Sauvegardez-le immediatement." -ForegroundColor Yellow
    Write-Host ""
    
    # Mettre a jour gcp-env-vars.json si existe
    $envVarsFile = "gcp-env-vars.json"
    if (Test-Path $envVarsFile) {
        Write-Host "Mise a jour de $envVarsFile..." -ForegroundColor Yellow
        $envVars = Get-Content $envVarsFile -Raw | ConvertFrom-Json
        
        # Convertir en hashtable pour modification
        $envVarsHash = @{}
        $envVars.PSObject.Properties | ForEach-Object {
            $envVarsHash[$_.Name] = $_.Value
        }
        
        $envVarsHash["S3_ACCESS_KEY"] = $accessKey
        $envVarsHash["S3_SECRET_KEY"] = $secretKey
        
        # Reconvertir en JSON et sauvegarder
        $envVarsHash | ConvertTo-Json -Depth 10 | Out-File -FilePath $envVarsFile -Encoding UTF8
        Write-Host "   $envVarsFile mis a jour" -ForegroundColor Green
    }
    
    # Configurer automatiquement dans GitHub Secrets si GitHub CLI est disponible
    $ghCmd = Get-Command gh -ErrorAction SilentlyContinue
    if ($ghCmd) {
        Write-Host ""
        Write-Host "Configuration automatique dans GitHub Secrets..." -ForegroundColor Yellow
        
        # Verifier l'authentification GitHub
        $ErrorActionPreference = "Continue"
        $ghAuth = gh auth status 2>&1
        $ErrorActionPreference = "Stop"
        
        if ($LASTEXITCODE -ne 0) {
            Write-Host "   GitHub CLI non authentifie" -ForegroundColor Yellow
            Write-Host "   Authentifiez-vous avec: gh auth login" -ForegroundColor Yellow
            Write-Host "   Puis configurez manuellement:" -ForegroundColor Yellow
            Write-Host "     gh secret set GCP_ENV_S3_ACCESS_KEY --body `"$accessKey`" --repo Her50/yukpo4" -ForegroundColor Gray
            Write-Host "     gh secret set GCP_ENV_S3_SECRET_KEY --body `"$secretKey`" --repo Her50/yukpo4" -ForegroundColor Gray
        } else {
            Write-Host "   Configuration de GCP_ENV_S3_ACCESS_KEY..." -ForegroundColor Gray
            echo $accessKey | gh secret set GCP_ENV_S3_ACCESS_KEY --repo Her50/yukpo4 2>&1 | Out-Null
            
            Write-Host "   Configuration de GCP_ENV_S3_SECRET_KEY..." -ForegroundColor Gray
            echo $secretKey | gh secret set GCP_ENV_S3_SECRET_KEY --repo Her50/yukpo4 2>&1 | Out-Null
            
            Write-Host "   Secrets GitHub configures avec succes !" -ForegroundColor Green
        }
    } else {
        Write-Host ""
        Write-Host "GitHub CLI non disponible" -ForegroundColor Yellow
        Write-Host "Configurez manuellement dans GitHub Secrets:" -ForegroundColor Yellow
        Write-Host "   GCP_ENV_S3_ACCESS_KEY = $accessKey" -ForegroundColor Gray
        Write-Host "   GCP_ENV_S3_SECRET_KEY = $secretKey" -ForegroundColor Gray
    }
    
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "CONFIGURATION TERMINEE !" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Les credentials HMAC sont maintenant configures:" -ForegroundColor White
    Write-Host "  - Access Key: $accessKey" -ForegroundColor Gray
    Write-Host "  - Secret Key: $secretKey" -ForegroundColor Gray
    Write-Host "  - Variables mises a jour dans gcp-env-vars.json" -ForegroundColor Gray
    if ($ghCmd -and $LASTEXITCODE -eq 0) {
        Write-Host "  - Secrets GitHub configures automatiquement" -ForegroundColor Gray
    }
    Write-Host ""
    Write-Host "Le backend peut maintenant utiliser Cloud Storage avec l'API S3 compatible !" -ForegroundColor Green
    Write-Host ""
    
} catch {
    Write-Host "ERREUR lors de la creation des credentials HMAC" -ForegroundColor Red
    Write-Host "Message: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "Si l'erreur indique que l'API n'est pas disponible, utilisez la console web:" -ForegroundColor Yellow
    Write-Host "  1. Allez sur: https://console.cloud.google.com/storage/settings" -ForegroundColor White
    Write-Host "  2. Onglet 'Interoperability'" -ForegroundColor White
    Write-Host "  3. Cliquez sur 'Create a key for a service account'" -ForegroundColor White
    Write-Host "  4. Selectionnez: $ServiceAccountEmail" -ForegroundColor White
    Write-Host ""
    exit 1
}

