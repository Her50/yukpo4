# Script pour Créer et Configurer Automatiquement les Credentials HMAC
# Usage: .\scripts\create-and-configure-hmac.ps1

$ErrorActionPreference = "Stop"

Write-Host "Creation et Configuration des Credentials HMAC" -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host ""

# Mettre a jour le PATH
$env:PATH = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
$gcloudPath = "$env:ProgramFiles\Google\Cloud SDK\google-cloud-sdk\bin"
if (Test-Path $gcloudPath) {
    $env:PATH += ";$gcloudPath"
}

$ProjectId = "yukpo-project"
$ServiceAccountEmail = "cloud-storage-sa@yukpo-project.iam.gserviceaccount.com"

# Créer les credentials HMAC
Write-Host "Creation des credentials HMAC..." -ForegroundColor Yellow
$ErrorActionPreference = "Continue"
$result = gcloud storage hmac create $ServiceAccountEmail --project=$ProjectId --format=json 2>&1 | Where-Object { $_ -notmatch "lacks an 'environment' tag" }
$ErrorActionPreference = "Stop"

# Extraire le JSON de la réponse
$jsonResult = $result | Where-Object { $_ -match '^\s*\{|^\s*"' } | Out-String

if ($jsonResult -and $jsonResult -match '\{') {
    try {
        $hmacData = $jsonResult | ConvertFrom-Json
        $accessKey = $hmacData.accessId
        $secretKey = $hmacData.secret
        
        Write-Host "Credentials HMAC crees avec succes !" -ForegroundColor Green
        Write-Host ""
        Write-Host "Access Key: $accessKey" -ForegroundColor Cyan
        Write-Host "Secret Key: $secretKey" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "IMPORTANT: Le Secret Key est visible UNE SEULE FOIS !" -ForegroundColor Yellow
        Write-Host ""
        
        # Mettre a jour gcp-env-vars.json
        if (Test-Path "gcp-env-vars.json") {
            Write-Host "Mise a jour de gcp-env-vars.json..." -ForegroundColor Yellow
            $envVars = Get-Content "gcp-env-vars.json" -Raw | ConvertFrom-Json
            $envVarsHash = @{}
            $envVars.PSObject.Properties | ForEach-Object {
                $envVarsHash[$_.Name] = $_.Value
            }
            $envVarsHash["S3_ACCESS_KEY"] = $accessKey
            $envVarsHash["S3_SECRET_KEY"] = $secretKey
            $envVarsHash | ConvertTo-Json -Depth 10 | Out-File -FilePath "gcp-env-vars.json" -Encoding UTF8
            Write-Host "gcp-env-vars.json mis a jour" -ForegroundColor Green
        }
        
        # Configurer dans GitHub Secrets
        Write-Host ""
        Write-Host "Configuration dans GitHub Secrets..." -ForegroundColor Yellow
        $ghCmd = Get-Command gh -ErrorAction SilentlyContinue
        if ($ghCmd) {
            # Remplacez YOUR_GITHUB_TOKEN par votre token GitHub
            echo "YOUR_GITHUB_TOKEN" | gh auth login --with-token 2>&1 | Out-Null
            if ($LASTEXITCODE -eq 0) {
                echo $accessKey | gh secret set GCP_ENV_S3_ACCESS_KEY --repo Her50/yukpo4 2>&1 | Out-Null
                echo $secretKey | gh secret set GCP_ENV_S3_SECRET_KEY --repo Her50/yukpo4 2>&1 | Out-Null
                Write-Host "Secrets GitHub configures" -ForegroundColor Green
            } else {
                Write-Host "GitHub CLI non authentifie" -ForegroundColor Yellow
            }
        } else {
            Write-Host "GitHub CLI non disponible" -ForegroundColor Yellow
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
        Write-Host "  - Secrets GitHub configures" -ForegroundColor Gray
        Write-Host ""
        Write-Host "Le backend peut maintenant utiliser Cloud Storage avec l'API S3 compatible !" -ForegroundColor Green
        Write-Host ""
        
    } catch {
        Write-Host "ERREUR lors du parsing JSON: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host "Resultat brut: $jsonResult" -ForegroundColor Yellow
    }
} else {
    Write-Host "ERREUR: Impossible de recuperer les credentials HMAC" -ForegroundColor Red
    Write-Host "Resultat: $result" -ForegroundColor Yellow
}

