# Script pour créer une instance Memorystore Redis sur GCP
# Date: 2026-02-15
# Objectif: Créer Redis natif GCP (Memorystore) et configurer Cloud Run

param(
    [string]$ProjectId = "yukpo-project",
    [string]$Region = "europe-west1",
    [string]$InstanceName = "yukpo-redis",
    [string]$Tier = "BASIC",
    [string]$MemorySizeGb = "1",
    [string]$Version = "redis_7_0"
)

Write-Host "Creation Instance Memorystore Redis (GCP)" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# Verifier que gcloud est installe
$gcloudPath = "C:\Program Files (x86)\Google\Cloud SDK\google-cloud-sdk\bin"
if (Test-Path "$gcloudPath\gcloud.cmd") {
    $env:Path += ";$gcloudPath"
    Write-Host "[OK] gcloud ajoute au PATH" -ForegroundColor Green
} else {
    Write-Host "[ERREUR] gcloud non trouve" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Configuration:" -ForegroundColor Cyan
Write-Host "   Projet GCP: $ProjectId"
Write-Host "   Region: $Region"
Write-Host "   Instance Redis: $InstanceName"
Write-Host "   Tier: $Tier"
Write-Host "   Memoire: ${MemorySizeGb}GB"
Write-Host "   Version: $Version"
Write-Host ""

# Etape 1: Activer l'API Memorystore Redis
Write-Host "[ETAPE 1/4] Activation API Memorystore Redis..." -ForegroundColor Yellow

gcloud services enable redis.googleapis.com --project=$ProjectId 2>&1 | Out-Null

if ($LASTEXITCODE -eq 0) {
    Write-Host "   [OK] API Memorystore Redis activee" -ForegroundColor Green
} else {
    Write-Host "   [ATTENTION] API peut-etre deja activee ou erreur" -ForegroundColor Yellow
}

Write-Host ""

# Etape 2: Verifier si l'instance existe deja
Write-Host "[ETAPE 2/4] Verification instance existante..." -ForegroundColor Yellow

$existingInstance = gcloud redis instances describe $InstanceName --region=$Region --project=$ProjectId 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "   [OK] Instance Redis existe deja: $InstanceName" -ForegroundColor Green
    
    $redisHost = gcloud redis instances describe $InstanceName --region=$Region --format="get(host)" --project=$ProjectId 2>&1
    $redisPort = gcloud redis instances describe $InstanceName --region=$Region --format="get(port)" --project=$ProjectId 2>&1
    
    if ($redisHost -and $redisPort) {
        Write-Host "   [OK] Host: $redisHost" -ForegroundColor Green
        Write-Host "   [OK] Port: $redisPort" -ForegroundColor Green
        Write-Host ""
        Write-Host "   Format REDIS_URL: redis://$redisHost`:$redisPort/0" -ForegroundColor Cyan
    }
} else {
    Write-Host "   [INFO] Instance Redis n'existe pas, creation..." -ForegroundColor Yellow
    Write-Host ""
    
    # Etape 3: Creer l'instance Memorystore Redis
    Write-Host "[ETAPE 3/4] Creation instance Memorystore Redis..." -ForegroundColor Yellow
    Write-Host "   [INFO] Cela peut prendre 5-10 minutes..." -ForegroundColor Cyan
    
    gcloud redis instances create $InstanceName `
        --size=$MemorySizeGb `
        --tier=$Tier `
        --region=$Region `
        --redis-version=$Version `
        --project=$ProjectId 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   [OK] Instance Redis creee: $InstanceName" -ForegroundColor Green
        Write-Host "   [INFO] Attente 2 minutes pour que l'instance soit prete..." -ForegroundColor Yellow
        Start-Sleep -Seconds 120
    } else {
        Write-Host "   [ERREUR] Impossible de creer l'instance Redis" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""

# Etape 4: Recuperer les informations de connexion
Write-Host "[ETAPE 4/4] Recuperation informations connexion Redis..." -ForegroundColor Yellow

$redisHost = gcloud redis instances describe $InstanceName --region=$Region --format="get(host)" --project=$ProjectId 2>&1
$redisPort = gcloud redis instances describe $InstanceName --region=$Region --format="get(port)" --project=$ProjectId 2>&1

if ($LASTEXITCODE -eq 0 -and $redisHost -and $redisPort) {
    Write-Host "   [OK] Host: $redisHost" -ForegroundColor Green
    Write-Host "   [OK] Port: $redisPort" -ForegroundColor Green
    
    $redisUrl = "redis://${redisHost}:${redisPort}/0"
    Write-Host ""
    Write-Host "   Format REDIS_URL: $redisUrl" -ForegroundColor Cyan
} else {
    Write-Host "   [ERREUR] Impossible de recuperer les informations" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "[OK] Configuration Redis terminee!" -ForegroundColor Green
Write-Host ""
Write-Host "Informations importantes:" -ForegroundColor Cyan
Write-Host "   Instance: $InstanceName" -ForegroundColor White
Write-Host "   Host: $redisHost" -ForegroundColor White
Write-Host "   Port: $redisPort" -ForegroundColor White
Write-Host "   REDIS_URL: $redisUrl" -ForegroundColor White
Write-Host ""
Write-Host "Prochaines etapes:" -ForegroundColor Yellow
Write-Host "   1. Mettre a jour le secret GitHub REDIS_URL avec: $redisUrl" -ForegroundColor White
Write-Host "   2. OU mettre a jour Cloud Run directement:" -ForegroundColor White
Write-Host "      gcloud run services update yukpo-backend --region=$Region --update-env-vars='REDIS_URL=$redisUrl' --project=$ProjectId" -ForegroundColor Cyan
Write-Host "   3. Verifier les logs Cloud Run pour confirmer la connexion Redis" -ForegroundColor White
Write-Host ""

