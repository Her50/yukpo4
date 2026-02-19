# Script de Correction Redis et Redéploiement Cloud Run
# Date: 2026-02-19

$PROJECT = "yukpo-project"
$SERVICE = "yukpo-backend"
$REGION = "europe-west1"
$SECRET_REDIS = "redis-url"
$REDIS_URL = "redis://10.128.102.19:6379/0"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Correction Redis et Redéploiement" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Vérifier le secret REDIS_URL
Write-Host "[1/4] Vérification du secret REDIS_URL..." -ForegroundColor Yellow
$tempFile = [System.IO.Path]::GetTempFileName()
gcloud secrets versions access latest --secret=$SECRET_REDIS --project=$PROJECT --out-file=$tempFile 2>&1 | Out-Null

if ($LASTEXITCODE -eq 0 -and (Test-Path $tempFile)) {
    $currentRedisUrl = (Get-Content -Path $tempFile -Raw -Encoding UTF8).Trim()
    Remove-Item $tempFile -Force
    
    Write-Host "✅ Secret actuel: $currentRedisUrl" -ForegroundColor Green
    
    if ($currentRedisUrl -ne $REDIS_URL) {
        Write-Host "⚠️ URL Redis différente, mise à jour nécessaire" -ForegroundColor Yellow
        Write-Host "[2/4] Mise à jour du secret REDIS_URL..." -ForegroundColor Yellow
        
        $tempFile2 = [System.IO.Path]::GetTempFileName()
        $REDIS_URL | Out-File -FilePath $tempFile2 -Encoding UTF8 -NoNewline
        
        gcloud secrets versions add $SECRET_REDIS --data-file=$tempFile2 --project=$PROJECT 2>&1 | Out-Null
        Remove-Item $tempFile2 -Force
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Secret REDIS_URL mis à jour" -ForegroundColor Green
        } else {
            Write-Host "⚠️ Erreur lors de la mise à jour (peut être ignorée)" -ForegroundColor Yellow
        }
    } else {
        Write-Host "✅ Secret REDIS_URL correct" -ForegroundColor Green
    }
} else {
    Write-Host "⚠️ Secret REDIS_URL non trouvé, création..." -ForegroundColor Yellow
    $tempFile2 = [System.IO.Path]::GetTempFileName()
    $REDIS_URL | Out-File -FilePath $tempFile2 -Encoding UTF8 -NoNewline
    
    gcloud secrets versions add $SECRET_REDIS --data-file=$tempFile2 --project=$PROJECT 2>&1 | Out-Null
    Remove-Item $tempFile2 -Force
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Secret REDIS_URL créé" -ForegroundColor Green
    } else {
        Write-Host "⚠️ Erreur lors de la création (peut être ignorée)" -ForegroundColor Yellow
    }
}
Write-Host ""

# 2. Vérifier le VPC Connector
Write-Host "[3/4] Vérification du VPC Connector..." -ForegroundColor Yellow
$connector = gcloud compute networks vpc-access connectors list --region=$REGION --project=$PROJECT --format="value(name)" 2>&1
if ($connector -match "yukpo-connector") {
    Write-Host "✅ VPC Connector configuré: yukpo-connector" -ForegroundColor Green
} else {
    Write-Host "⚠️ VPC Connector non trouvé" -ForegroundColor Yellow
}
Write-Host ""

# 3. Redéployer Cloud Run
Write-Host "[4/4] Redéploiement de Cloud Run..." -ForegroundColor Yellow
Write-Host "   (Cela va charger les nouveaux secrets DATABASE_URL et REDIS_URL)" -ForegroundColor Gray
Write-Host ""

gcloud run services update $SERVICE --region=$REGION --project=$PROJECT 2>&1 | Out-Null

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Cloud Run redéployé avec succès" -ForegroundColor Green
    Write-Host ""
    Write-Host "Le service va redémarrer et charger les nouveaux secrets." -ForegroundColor Cyan
    Write-Host "Attendez 1-2 minutes puis vérifiez les logs." -ForegroundColor Cyan
} else {
    Write-Host "❌ Erreur lors du redéploiement" -ForegroundColor Red
    exit 1
}
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "✅ Correction terminée!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Vérifier les logs:" -ForegroundColor Yellow
Write-Host "  gcloud logging read ""resource.type=cloud_run_revision AND resource.labels.service_name=$SERVICE"" --limit=20 --project=$PROJECT --freshness=5m" -ForegroundColor Gray
Write-Host ""

