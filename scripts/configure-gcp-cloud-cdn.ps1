# Script de Configuration Cloud CDN avec Load Balancer pour GCP
# Usage: .\scripts\configure-gcp-cloud-cdn.ps1

param(
    [string]$ProjectId = "yukpo-project",
    [string]$Region = "europe-west1",
    [string]$BucketName = "yukpo-project-yukpo-backend-media",
    [string]$CdnDomain = "cdn.yukpo.app"  # Domaine personnalisé (optionnel)
)

$ErrorActionPreference = "Stop"

Write-Host "Configuration Cloud CDN avec Load Balancer pour GCP" -ForegroundColor Cyan
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host ""

# Mettre a jour le PATH
$env:PATH = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
$gcloudPath = "$env:ProgramFiles\Google\Cloud SDK\google-cloud-sdk\bin"
if (Test-Path $gcloudPath) {
    $env:PATH += ";$gcloudPath"
}

# Configurer le projet
$ErrorActionPreference = "Continue"
gcloud config set project $ProjectId 2>&1 | Where-Object { $_ -notmatch "lacks an 'environment' tag" } | Out-Null
$ErrorActionPreference = "Stop"

Write-Host "Projet configure: $ProjectId" -ForegroundColor Green
Write-Host "Bucket: $BucketName" -ForegroundColor Green
Write-Host "Region: $Region" -ForegroundColor Green
Write-Host ""

# Activer les APIs necessaires
Write-Host "Activation des APIs necessaires..." -ForegroundColor Yellow
$apis = @(
    "compute.googleapis.com",
    "cloudcdn.googleapis.com"
)

foreach ($api in $apis) {
    Write-Host "   Activation de $api..." -ForegroundColor Gray
    $ErrorActionPreference = "Continue"
    gcloud services enable $api --project=$ProjectId 2>&1 | Where-Object { $_ -notmatch "lacks an 'environment' tag" } | Out-Null
    $ErrorActionPreference = "Stop"
}

Write-Host "APIs activees" -ForegroundColor Green
Write-Host ""

# Creer le backend bucket pour Cloud CDN
Write-Host "Creation du backend bucket Cloud CDN..." -ForegroundColor Yellow
$backendBucketName = "$BucketName-cdn-backend"

$ErrorActionPreference = "Continue"
$backendExists = gcloud compute backend-buckets describe $backendBucketName --project=$ProjectId 2>&1 | Select-String -Pattern "name"
$ErrorActionPreference = "Stop"

if (-not $backendExists) {
    gcloud compute backend-buckets create $backendBucketName `
        --gcs-bucket-name=$BucketName `
        --project=$ProjectId
    
    Write-Host "Backend bucket cree: $backendBucketName" -ForegroundColor Green
} else {
    Write-Host "Backend bucket existe deja: $backendBucketName" -ForegroundColor Green
}

Write-Host ""

# Creer une adresse IP globale pour le Load Balancer
Write-Host "Creation de l'adresse IP globale..." -ForegroundColor Yellow
$ipName = "yukpo-cdn-ip"

$ErrorActionPreference = "Continue"
$ipExists = gcloud compute addresses describe $ipName --global --project=$ProjectId 2>&1 | Select-String -Pattern "name"
$ErrorActionPreference = "Stop"

if (-not $ipExists) {
    gcloud compute addresses create $ipName `
        --global `
        --ip-version=IPV4 `
        --project=$ProjectId
    
    Write-Host "Adresse IP globale creee: $ipName" -ForegroundColor Green
    
    # Recuperer l'adresse IP
    Start-Sleep -Seconds 5
    $ipAddress = gcloud compute addresses describe $ipName --global --project=$ProjectId --format="value(address)"
    Write-Host "   Adresse IP: $ipAddress" -ForegroundColor Gray
} else {
    $ipAddress = gcloud compute addresses describe $ipName --global --project=$ProjectId --format="value(address)"
    Write-Host "Adresse IP globale existe deja: $ipName ($ipAddress)" -ForegroundColor Green
}

Write-Host ""

# Creer l'URL map pour le Load Balancer
Write-Host "Creation de l'URL map..." -ForegroundColor Yellow
$urlMapName = "yukpo-cdn-url-map"

$ErrorActionPreference = "Continue"
$urlMapExists = gcloud compute url-maps describe $urlMapName --project=$ProjectId 2>&1 | Select-String -Pattern "name"
$ErrorActionPreference = "Stop"

if (-not $urlMapExists) {
    gcloud compute url-maps create $urlMapName `
        --default-backend-bucket=$backendBucketName `
        --project=$ProjectId
    
    Write-Host "URL map creee: $urlMapName" -ForegroundColor Green
} else {
    Write-Host "URL map existe deja: $urlMapName" -ForegroundColor Green
}

Write-Host ""

# Creer le proxy HTTPS (Load Balancer)
Write-Host "Creation du proxy HTTPS..." -ForegroundColor Yellow
$httpsProxyName = "yukpo-cdn-https-proxy"

$ErrorActionPreference = "Continue"
$httpsProxyExists = gcloud compute target-https-proxies describe $httpsProxyName --project=$ProjectId 2>&1 | Select-String -Pattern "name"
$ErrorActionPreference = "Stop"

# Note: Pour HTTPS, il faut un certificat SSL
# Pour l'instant, on cree un proxy HTTP
Write-Host "   Note: Configuration HTTP pour l'instant (HTTPS necessite un certificat SSL)" -ForegroundColor Yellow

$httpProxyName = "yukpo-cdn-http-proxy"
$ErrorActionPreference = "Continue"
$httpProxyExists = gcloud compute target-http-proxies describe $httpProxyName --project=$ProjectId 2>&1 | Select-String -Pattern "name"
$ErrorActionPreference = "Stop"

if (-not $httpProxyExists) {
    gcloud compute target-http-proxies create $httpProxyName `
        --url-map=$urlMapName `
        --project=$ProjectId
    
    Write-Host "Proxy HTTP cree: $httpProxyName" -ForegroundColor Green
} else {
    Write-Host "Proxy HTTP existe deja: $httpProxyName" -ForegroundColor Green
}

Write-Host ""

# Creer la regle de forwarding
Write-Host "Creation de la regle de forwarding..." -ForegroundColor Yellow
$forwardingRuleName = "yukpo-cdn-forwarding-rule"

$ErrorActionPreference = "Continue"
$forwardingRuleExists = gcloud compute forwarding-rules describe $forwardingRuleName --global --project=$ProjectId 2>&1 | Select-String -Pattern "name"
$ErrorActionPreference = "Stop"

if (-not $forwardingRuleExists) {
    gcloud compute forwarding-rules create $forwardingRuleName `
        --address=$ipName `
        --global `
        --target-http-proxy=$httpProxyName `
        --ports=80 `
        --project=$ProjectId
    
    Write-Host "Regle de forwarding creee: $forwardingRuleName" -ForegroundColor Green
} else {
    Write-Host "Regle de forwarding existe deja: $forwardingRuleName" -ForegroundColor Green
}

Write-Host ""

# Attendre que le Load Balancer soit pret
Write-Host "Attente de la propagation du Load Balancer (cela peut prendre 5-10 minutes)..." -ForegroundColor Yellow
Start-Sleep -Seconds 30

# Recuperer l'URL du Load Balancer
$loadBalancerUrl = "http://$ipAddress"
Write-Host "URL du Load Balancer: $loadBalancerUrl" -ForegroundColor Green
Write-Host ""

# Activer Cloud CDN sur le backend bucket
Write-Host "Activation de Cloud CDN sur le backend bucket..." -ForegroundColor Yellow
gcloud compute backend-buckets update $backendBucketName `
    --enable-cdn `
    --project=$ProjectId 2>&1 | Out-Null

Write-Host "Cloud CDN active sur le backend bucket" -ForegroundColor Green
Write-Host ""

# Resumé
Write-Host ""
Write-Host "Configuration Cloud CDN terminee !" -ForegroundColor Green
Write-Host "====================================" -ForegroundColor Green
Write-Host ""
Write-Host "Informations importantes:" -ForegroundColor Cyan
Write-Host "   Project ID: $ProjectId" -ForegroundColor White
Write-Host "   Bucket: $BucketName" -ForegroundColor White
Write-Host "   Backend Bucket: $backendBucketName" -ForegroundColor White
Write-Host "   Adresse IP: $ipAddress" -ForegroundColor White
Write-Host "   URL Load Balancer: $loadBalancerUrl" -ForegroundColor White
Write-Host ""
Write-Host "URLs CDN:" -ForegroundColor Cyan
Write-Host "   HTTP: $loadBalancerUrl" -ForegroundColor White
Write-Host "   HTTPS: (necessite configuration certificat SSL)" -ForegroundColor Yellow
Write-Host ""
Write-Host "Prochaines etapes:" -ForegroundColor Cyan
Write-Host "   1. Mettre a jour UPLOAD_BASE_URL et PUBLIC_BASE_URL avec: $loadBalancerUrl" -ForegroundColor White
Write-Host "   2. (Optionnel) Configurer un certificat SSL pour HTTPS" -ForegroundColor White
Write-Host "   3. (Optionnel) Configurer un domaine personnalise: $CdnDomain" -ForegroundColor White
Write-Host ""
Write-Host "Note: La propagation du Load Balancer peut prendre 5-10 minutes" -ForegroundColor Yellow
Write-Host ""

