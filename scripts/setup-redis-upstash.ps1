# Script de Configuration Redis Upstash
# Date: 2026-02-19
# Objectif: Configurer Redis Upstash pour remplacer Memorystore

$PROJECT = "yukpo-project"
$SECRET_REDIS = "redis-url"
$SERVICE = "yukpo-backend"
$REGION = "europe-west1"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Configuration Redis Upstash" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Ce script va configurer Redis Upstash pour remplacer Memorystore." -ForegroundColor Yellow
Write-Host ""
Write-Host "Prérequis:" -ForegroundColor Cyan
Write-Host "1. Avoir un compte Upstash (gratuit) : https://console.upstash.com" -ForegroundColor White
Write-Host "2. Avoir créé une base Redis dans Upstash" -ForegroundColor White
Write-Host "3. Avoir récupéré l'URL de connexion (format: rediss://default:PASSWORD@ENDPOINT.upstash.io:6379/0)" -ForegroundColor White
Write-Host ""

$continue = Read-Host "Continuer? (O/N)"
if ($continue -ne "O" -and $continue -ne "o") {
    Write-Host "Annulé." -ForegroundColor Yellow
    exit 0
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Étape 1: Récupération de l'URL Redis Upstash" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Instructions:" -ForegroundColor Yellow
Write-Host "1. Aller sur https://console.upstash.com" -ForegroundColor White
Write-Host "2. Sélectionner votre projet" -ForegroundColor White
Write-Host "3. Aller dans 'Redis' → Sélectionner votre base" -ForegroundColor White
Write-Host "4. Cliquer sur 'Connection String'" -ForegroundColor White
Write-Host "5. Copier l'URL (format: rediss://default:PASSWORD@ENDPOINT.upstash.io:6379/0)" -ForegroundColor White
Write-Host ""

$REDIS_URL = Read-Host "Coller l'URL Redis Upstash ici"

if ([string]::IsNullOrWhiteSpace($REDIS_URL)) {
    Write-Host "❌ URL Redis vide!" -ForegroundColor Red
    exit 1
}

# Valider le format
if (-not ($REDIS_URL -match "^rediss://.*@.*\.upstash\.io:6379/\d+$")) {
    Write-Host "⚠️ Format d'URL suspect détecté" -ForegroundColor Yellow
    Write-Host "Format attendu: rediss://default:PASSWORD@ENDPOINT.upstash.io:6379/0" -ForegroundColor Gray
    Write-Host "URL fournie: $($REDIS_URL.Substring(0, [Math]::Min(50, $REDIS_URL.Length)))..." -ForegroundColor Gray
    
    $continue = Read-Host "Continuer quand même? (O/N)"
    if ($continue -ne "O" -and $continue -ne "o") {
        Write-Host "Annulé." -ForegroundColor Yellow
        exit 0
    }
}

Write-Host "✅ URL Redis validée" -ForegroundColor Green
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Étape 2: Mise à jour du secret GCP" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Mise à jour du secret '$SECRET_REDIS'..." -ForegroundColor Yellow

try {
    $tempFile = [System.IO.Path]::GetTempFileName()
    $REDIS_URL | Out-File -FilePath $tempFile -Encoding UTF8 -NoNewline
    
    $result = gcloud secrets versions add $SECRET_REDIS `
        --data-file=$tempFile `
        --project=$PROJECT 2>&1
    
    Remove-Item $tempFile -Force
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Secret REDIS_URL mis à jour" -ForegroundColor Green
        if ($result -match 'version (\d+)') {
            Write-Host "   Version: $($matches[1])" -ForegroundColor Gray
        }
    }
    else {
        Write-Host "❌ Erreur lors de la mise à jour du secret" -ForegroundColor Red
        Write-Host "Erreur: $result" -ForegroundColor Red
        exit 1
    }
}
catch {
    Write-Host "❌ Erreur: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Étape 3: Redéploiement Cloud Run" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Redéploiement du service Cloud Run..." -ForegroundColor Yellow

try {
    $result = gcloud run services update $SERVICE `
        --region=$REGION `
        --project=$PROJECT `
        --update-env-vars="REDIS_UPDATED=$(Get-Date -Format 'yyyy-MM-dd-HHmmss')" 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Service Cloud Run redéployé" -ForegroundColor Green
        Write-Host "   Les nouveaux secrets seront chargés au prochain démarrage" -ForegroundColor Gray
    }
    else {
        Write-Host "⚠️ Erreur lors du redéploiement" -ForegroundColor Yellow
        Write-Host "Erreur: $result" -ForegroundColor Yellow
    }
}
catch {
    Write-Host "⚠️ Erreur: $_" -ForegroundColor Yellow
}

Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "✅ Configuration terminée!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Prochaines étapes:" -ForegroundColor Yellow
Write-Host "1. Attendre 1-2 minutes pour que Cloud Run redémarre" -ForegroundColor White
Write-Host "2. Vérifier les logs pour confirmer la connexion Redis:" -ForegroundColor White
Write-Host "   gcloud logging read ""resource.type=cloud_run_revision AND resource.labels.service_name=$SERVICE"" --limit=30 --project=$PROJECT --freshness=5m" -ForegroundColor Cyan
Write-Host "3. Tester l'application" -ForegroundColor White
Write-Host ""

Write-Host "Vérifications attendues dans les logs:" -ForegroundColor Yellow
Write-Host "  ✅ Plus d'erreurs 'Redis connection failed'" -ForegroundColor Green
Write-Host "  ✅ Connexion Redis établie avec succès" -ForegroundColor Green
Write-Host "  ✅ Services Redis démarrant correctement" -ForegroundColor Green
Write-Host ""

Write-Host "Note: Le backend convertit automatiquement redis:// en rediss:// pour Upstash." -ForegroundColor Gray
Write-Host ""

