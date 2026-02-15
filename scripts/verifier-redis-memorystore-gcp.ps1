# Script pour vérifier que REDIS_URL pointe bien vers Memorystore Redis GCP
# Date: 2026-02-15

param(
    [string]$ProjectId = "yukpo-project",
    [string]$Region = "europe-west1",
    [string]$ServiceName = "yukpo-backend",
    [string]$RedisInstanceName = "yukpo-redis"
)

Write-Host "Verification REDIS_URL Memorystore GCP" -ForegroundColor Cyan
Write-Host "=======================================" -ForegroundColor Cyan
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

# Etape 1: Recuperer les informations de l'instance Memorystore Redis
Write-Host "[ETAPE 1/3] Recuperation informations Memorystore Redis..." -ForegroundColor Yellow

$redisHost = gcloud redis instances describe $RedisInstanceName --region=$Region --format="get(host)" --project=$ProjectId 2>&1
$redisPort = gcloud redis instances describe $RedisInstanceName --region=$Region --format="get(port)" --project=$ProjectId 2>&1

if ($LASTEXITCODE -eq 0 -and $redisHost -and $redisPort) {
    Write-Host "   [OK] Instance Redis: $RedisInstanceName" -ForegroundColor Green
    Write-Host "   [OK] Host: $redisHost" -ForegroundColor Green
    Write-Host "   [OK] Port: $redisPort" -ForegroundColor Green
    
    $expectedRedisUrl = "redis://${redisHost}:${redisPort}/0"
    Write-Host ""
    Write-Host "   REDIS_URL attendue: $expectedRedisUrl" -ForegroundColor Cyan
} else {
    Write-Host "   [ERREUR] Impossible de recuperer les informations Redis" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Etape 2: Verifier REDIS_URL dans Cloud Run
Write-Host "[ETAPE 2/3] Verification REDIS_URL dans Cloud Run..." -ForegroundColor Yellow

$cloudRunEnv = gcloud run services describe $ServiceName --region=$Region --format="yaml(spec.template.spec.containers[0].env)" --project=$ProjectId 2>&1

if ($LASTEXITCODE -eq 0) {
    $redisUrlLine = $cloudRunEnv | Select-String -Pattern "REDIS_URL" -Context 0,1
    
    if ($redisUrlLine) {
        $actualRedisUrl = ($redisUrlLine -split "value: ")[1].Trim()
        Write-Host "   [OK] REDIS_URL trouvee dans Cloud Run" -ForegroundColor Green
        Write-Host "   [OK] Valeur: $actualRedisUrl" -ForegroundColor Green
        
        if ($actualRedisUrl -eq $expectedRedisUrl) {
            Write-Host ""
            Write-Host "   [OK] REDIS_URL pointe bien vers Memorystore Redis GCP!" -ForegroundColor Green
        } else {
            Write-Host ""
            Write-Host "   [ERREUR] REDIS_URL ne correspond pas!" -ForegroundColor Red
            Write-Host "   Attendu: $expectedRedisUrl" -ForegroundColor Yellow
            Write-Host "   Actuel:  $actualRedisUrl" -ForegroundColor Yellow
            Write-Host ""
            Write-Host "   Correction necessaire:" -ForegroundColor Cyan
            Write-Host "   gcloud run services update $ServiceName --region=$Region --update-env-vars='REDIS_URL=$expectedRedisUrl' --project=$ProjectId" -ForegroundColor White
            exit 1
        }
    } else {
        Write-Host "   [ERREUR] REDIS_URL non trouvee dans Cloud Run" -ForegroundColor Red
        Write-Host ""
        Write-Host "   Ajout necessaire:" -ForegroundColor Cyan
        Write-Host "   gcloud run services update $ServiceName --region=$Region --update-env-vars='REDIS_URL=$expectedRedisUrl' --project=$ProjectId" -ForegroundColor White
        exit 1
    }
} else {
    Write-Host "   [ERREUR] Impossible de recuperer la configuration Cloud Run" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Etape 3: Verifier le VPC Connector (necessaire pour acceder a l'IP privee)
Write-Host "[ETAPE 3/3] Verification VPC Connector..." -ForegroundColor Yellow

$vpcConnector = gcloud run services describe $ServiceName --region=$Region --format="get(spec.template.spec.vpcAccess.connector)" --project=$ProjectId 2>&1

if ($LASTEXITCODE -eq 0 -and $vpcConnector) {
    Write-Host "   [OK] VPC Connector configure: $vpcConnector" -ForegroundColor Green
    
    $connectorState = gcloud compute networks vpc-access connectors describe ($vpcConnector -split "/")[-1] --region=$Region --format="get(state)" --project=$ProjectId 2>&1
    
    if ($connectorState -eq "READY") {
        Write-Host "   [OK] VPC Connector etat: READY" -ForegroundColor Green
    } else {
        Write-Host "   [ATTENTION] VPC Connector etat: $connectorState" -ForegroundColor Yellow
    }
} else {
    Write-Host "   [ATTENTION] VPC Connector non configure" -ForegroundColor Yellow
    Write-Host "   [INFO] VPC Connector necessaire pour acceder a l'IP privee Redis" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "[OK] Verification terminee avec succes!" -ForegroundColor Green
Write-Host ""
Write-Host "Resume:" -ForegroundColor Cyan
Write-Host "   Instance Redis: $RedisInstanceName" -ForegroundColor White
Write-Host "   Host: $redisHost" -ForegroundColor White
Write-Host "   Port: $redisPort" -ForegroundColor White
Write-Host "   REDIS_URL: $expectedRedisUrl" -ForegroundColor White
Write-Host "   Cloud Run: Configure correctement" -ForegroundColor White
Write-Host ""

