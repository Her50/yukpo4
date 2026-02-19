# Script simplifié pour mettre à jour toutes les variables GCP
# Crée les secrets manquants et met à jour Cloud Run
# Usage: .\scripts\update-gcp-all-variables.ps1

param(
    [string]$GcpProjectId = "yukpo-project",
    [string]$GcpRegion = "europe-west1",
    [string]$GcpServiceName = "yukpo-backend"
)

$ErrorActionPreference = "Continue"

Write-Host "🔄 Mise à jour complète des variables GCP" -ForegroundColor Yellow
Write-Host ""

# Vérifier gcloud
if (-not (Get-Command gcloud -ErrorAction SilentlyContinue)) {
    Write-Host "❌ ERREUR: gcloud CLI n'est pas installé" -ForegroundColor Red
    exit 1
}

gcloud config set project $GcpProjectId | Out-Null

# Récupérer le service account
$GcpServiceAccount = gcloud run services describe $GcpServiceName `
    --region=$GcpRegion `
    --format="value(spec.template.spec.serviceAccountName)" `
    --project=$GcpProjectId 2>&1

if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrEmpty($GcpServiceAccount)) {
    $GcpServiceAccount = "$GcpProjectId@appspot.gserviceaccount.com"
}

Write-Host "✅ Service Account: $GcpServiceAccount" -ForegroundColor Green
Write-Host ""

# Créer les secrets manquants
Write-Host "📤 Création des secrets manquants..." -ForegroundColor Cyan

$secretsToCreate = @{
    "openai-api-key" = "[REDACTED]"
    "auphonic-api-key" = "AdxU2ktP7YfxzWd2N5JfMFDketxNRktq"
    "embedding-api-key" = "yukpo_embedding_key_2024"
    "google-client-id" = "[REDACTED]"
    "google-maps-api-key" = "AIzaSyDFfWEq1Umm06SNTbR-cRhRQ5Sq_taEAWQ"
    "google-translate-api-key" = "AIzaSyDFfWEq1Umm06SNTbR-cRhRQ5Sq_taEAWQ"
    "livekit-api-key" = "APIPHE9xDv5RPaP"
    "livekit-api-secret" = "qVRL18gIk8W3Dp8V4Wu23I99t0XbZ5pM66D9i5MTTkE"
    "pexels-api-key" = "1ytrq9SUFeMBA68ieIw9rFio3zZCU8ch6355srswcZer6hnJaLPv5Jl8"
    "pixabay-api-key" = "53555366-49550f2da946ADC1e8e4F5B99"
    "s3-access-key" = "[REDACTED]"
    "s3-secret-key" = "[REDACTED]"
    "sendgrid-api-key" = "your_sendgrid_api_key"
    "sora-api-key" = "[REDACTED]"
    "twilio-account-sid" = "your_account_sid"
    "twilio-auth-token" = "your_auth_token"
    "twilio-from-number" = "+1234567890"
    "unsplash-access-key" = "iOBl0EgF7Um3QclokoYMV4aH2IkDyOoRuPYswWxrrSM"
    "video-renderer-rpc-token" = "l-5nF6KwiPasSeCj2h_ixIevCZO2mLijLcJg6KNmP2UxAQGMSLD9RnRrBC_0mGhY"
    "youtube-client-id" = "[REDACTED]"
    "youtube-client-secret" = "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"
    "yukpo-api-key" = "yukpo_embedding_key_2024"
}

foreach ($secretName in $secretsToCreate.Keys) {
    $exists = gcloud secrets describe $secretName --project=$GcpProjectId 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  Création secret: $secretName" -ForegroundColor Cyan
        $tempFile = [System.IO.Path]::GetTempFileName()
        try {
            [System.IO.File]::WriteAllText($tempFile, $secretsToCreate[$secretName], [System.Text.Encoding]::UTF8)
            gcloud secrets create $secretName `
                --data-file=$tempFile `
                --replication-policy="automatic" `
                --project=$GcpProjectId 2>&1 | Out-Null
            
            if ($LASTEXITCODE -eq 0) {
                gcloud secrets add-iam-policy-binding $secretName `
                    --member="serviceAccount:$GcpServiceAccount" `
                    --role="roles/secretmanager.secretAccessor" `
                    --project=$GcpProjectId 2>&1 | Out-Null
                Write-Host "    ✅ Créé" -ForegroundColor Green
            }
        } finally {
            if (Test-Path $tempFile) { Remove-Item $tempFile -Force }
        }
    } else {
        Write-Host "  ✅ Secret existe: $secretName" -ForegroundColor Green
    }
}

Write-Host ""

# Construire la commande de mise à jour Cloud Run
Write-Host "📤 Préparation de la mise à jour Cloud Run..." -ForegroundColor Cyan

# Variables d'environnement (toutes en une seule chaîne)
$envVars = @(
    "AI_REQUEST_TIMEOUT_SECONDS=120",
    "AMD_GPU_AVAILABLE=true",
    "API_MAX_PAYLOAD_SIZE=10485760",
    "API_RATE_LIMIT_PER_MINUTE=100",
    "API_REQUEST_TIMEOUT=30",
    "AR_RENDER_OUTPUT_DIR=/tmp/ar_renders",
    "AUDIO_SYNC_TIMEOUT_SECONDS=180",
    "AUPHONIC_BASE_URL=https://api.auphonic.com",
    "AUPHONIC_OUTPUT_FORMAT=wav",
    "AUPHONIC_POLL_INTERVAL_SECS=5",
    "AUPHONIC_PRESET=yukpo_preset",
    "AUPHONIC_USERNAME=lelehernandez2007",
    "BLENDER_PATH=/usr/local/bin/blender",
    "BLENDER_RENDER_SAMPLES=256",
    "BLENDER_USE_GPU=false",
    "CACHE_DEFAULT_TTL=3600",
    "CACHE_TTL_SEARCH=600",
    "COLOR_GRADING_TIMEOUT_SECONDS=120",
    "CUDA_VISIBLE_DEVICES=0,1",
    "DATABASE_READ_REPLICA_URL=",
    "DATABASE_TIMEOUT=10",
    "DB_ACQUIRE_TIMEOUT_SECS=30",
    "DB_HEALTH_CHECK_INTERVAL_SECS=30",
    "DB_POOL_MIN_SIZE=2",
    "DB_POOL_SIZE=10",
    "DELIVERY_MATCHING_EMPTY_CACHE_TTL_SECS=30",
    "DELIVERY_MATCHING_WORKER_BATCH_SIZE=50",
    "DELIVERY_MATCHING_WORKER_INTERVAL_SECS=30",
    "DELIVERY_MATCHING_WORKER_PARALLEL=3",
    "DELIVERY_PENDING_TIMEOUT_MINUTES=60",
    "DELIVERY_TIMEOUT_MONITOR_INTERVAL_SECS=60",
    "EMAIL_ENABLED=true",
    "EMAIL_PROVIDER=sendgrid",
    "EMBEDDING_MAX_RETRIES=3",
    "EMBEDDING_TIMEOUT_SECONDS=60",
    "ENABLE_AI_OPTIMIZATIONS=true",
    "ENABLE_STAGING_DEMO_SEED=true",
    "ENVIRONMENT=production",
    "GEONAMES_USERNAME=hernandezlele",
    "GLOBAL_PROMO_SCHEDULER_INTERVAL_SECS=30",
    "GPU_AVAILABLE=false",
    "GPU_MEMORY_GB=16",
    "GPU_TYPE=nvidia",
    "HOST=0.0.0.0",
    "INSTANCE_ID=backend-1",
    "JWT_EXPIRATION_HOURS=24",
    "KYC_PROVIDER=manual",
    "LIVEKIT_API_URL=http://46.224.14.85:7880",
    "LIVEKIT_HLS_URL=http://46.224.14.85:8080/live",
    "LIVEKIT_INGRESS_MODE=rtmp",
    "LIVEKIT_INGRESS_NAME=prod-ingress-1",
    "LIVEKIT_INGRESS_REGION=eu-central",
    "LIVEKIT_INGRESS_ROOM=live-events",
    "LIVEKIT_WS_URL=ws://46.224.14.85:7880",
    "LIVE_FALLBACK_ENABLED=true",
    "LIVE_RECORDING_ENABLED=true",
    "LOG_FORMAT=json",
    "MATCHING_MIN_SCORE_THRESHOLD=0.6",
    "MAX_AUDIO_SIZE_MB=10",
    "MAX_DOC_SIZE_MB=10",
    "MAX_EXCEL_SIZE_MB=5",
    "MAX_IMAGE_SIZE_MB=10",
    "MAX_VIDEO_SIZE_MB=50",
    "ML_MODELS_DIR=models",
    "MTN_MONEY_ENABLED=true",
    "MTN_MONEY_ENVIRONMENT=sandbox|production",
    "NVIDIA_VISIBLE_DEVICES=all",
    "OPENWEATHERMAP_API_KEY=59f12cb0fdcbbaeff46c93e716b66896",
    "ORANGE_MONEY_ENABLED=true",
    "ORANGE_MONEY_ENVIRONMENT=sandbox|production",
    "ORDER_TIMEOUT_MONITOR_INTERVAL_SECS=60",
    "PIPELINE_ALERT_WEBHOOK=[REDACTED]",
    "PIPELINE_HEALTH_CHECK_INTERVAL_SECS=300",
    "PORT=8080",
    "PUBLIC_BASE_URL=https://cdn.yukpomnang.com",
    "RATE_LIMIT_IP=200",
    "RENDERER_S3_UPLOAD=true",
    "REQUEST_TIMEOUT=30",
    "RUST_LOG=info",
    "S3_BUCKET=yukpomnang-media-prod",
    "S3_ENDPOINT=",
    "S3_FORCE_PATH_STYLE=false",
    "S3_REGION=us-east-1",
    "SEARCH_DEFAULT_LANGUAGE=fr",
    "SEARCH_DEFAULT_RADIUS_KM=20",
    "SEARCH_MAX_RESULTS=50",
    "SEARCH_TITLE_BOOST=2.0",
    "SEMANTIC_CACHE_THRESHOLD=0.85",
    "SENDGRID_FROM_EMAIL=noreply@yukpomnang.com",
    "SENDGRID_FROM_NAME=Yukpomnang",
    "SLA_ALERT_WEBHOOK=[REDACTED]",
    "SLA_LOOKBACK_MINUTES=60",
    "SLA_MONITOR_INTERVAL_SECONDS=300",
    "SLA_PROMISED_MINUTES=30",
    "SLA_THRESHOLD_RATIO=1.10",
    "SMS_ENABLED=true",
    "SMS_PROVIDER=twilio",
    "SQLX_OFFLINE=true",
    "SRS_HLS_URL=https://srs.46.224.14.85.sslip.io/live",
    "SRS_RTMP_URL=rtmp://46.224.14.85:1935/live",
    "UPLOAD_BASE_URL=https://cdn.yukpomnang.com",
    "UPLOAD_STORAGE_PATH=/var/data/uploads",
    "VIDEO_ANALYSIS_TIMEOUT_SECONDS=180",
    "VIDEO_GENERATION_TIMEOUT_SECONDS=600",
    "VIDEO_RENDERER_ENABLE_GPU=true",
    "VIDEO_RENDERER_MAX_RETRIES=2",
    "VIDEO_RENDERER_PROJECT_ROOT=/srv/yukpo/video-renderer",
    "VIDEO_RENDERER_RPC_URL=http://46.224.14.85:8088/render",
    "VIDEO_RENDERER_SHARED_VOLUME=/srv/yukpo/jobs",
    "VIDEO_RENDERER_TIMEOUT_SECS=900",
    "YOUTUBE_REDIRECT_URI=https://yukpomnang.onrender.com/api/social/youtube/callback",
    "YUKPO_IMMO_COMMISSION_RATE=0.05",
    "global_promo_catalog_cache=60",
    "LAUNCH_PHASE_START_DATE=2026-02-10T00:00:00Z",
    "CLOUD_RUN=true",
    "APP_ENV=production",
    "ENABLE_AUTO_MIGRATIONS=true"
)

$envVarsStr = $envVars -join ","

# Secrets référencés
$secretsRefs = @(
    "DATABASE_URL=database-url:latest",
    "REDIS_URL=redis-url:latest",
    "JWT_SECRET=jwt-secret:latest",
    "MONGODB_URL=mongodb-url:latest",
    "OPENAI_API_KEY=openai-api-key:latest",
    "AUPHONIC_API_KEY=auphonic-api-key:latest",
    "EMBEDDING_API_KEY=embedding-api-key:latest",
    "GOOGLE_CLIENT_ID=google-client-id:latest",
    "GOOGLE_MAPS_API_KEY=google-maps-api-key:latest",
    "GOOGLE_TRANSLATE_API_KEY=google-translate-api-key:latest",
    "LIVEKIT_API_KEY=livekit-api-key:latest",
    "LIVEKIT_API_SECRET=livekit-api-secret:latest",
    "PEXELS_API_KEY=pexels-api-key:latest",
    "PIXABAY_API_KEY=pixabay-api-key:latest",
    "S3_ACCESS_KEY=s3-access-key:latest",
    "S3_SECRET_KEY=s3-secret-key:latest",
    "SENDGRID_API_KEY=sendgrid-api-key:latest",
    "SORA_API_KEY=sora-api-key:latest",
    "TWILIO_ACCOUNT_SID=twilio-account-sid:latest",
    "TWILIO_AUTH_TOKEN=twilio-auth-token:latest",
    "TWILIO_FROM_NUMBER=twilio-from-number:latest",
    "UNSPLASH_ACCESS_KEY=unsplash-access-key:latest",
    "VIDEO_RENDERER_RPC_TOKEN=video-renderer-rpc-token:latest",
    "YOUTUBE_CLIENT_ID=youtube-client-id:latest",
    "YOUTUBE_CLIENT_SECRET=youtube-client-secret:latest",
    "YUKPO_API_KEY=yukpo-api-key:latest"
)

$secretsStr = $secretsRefs -join ","

# Mettre à jour Cloud Run
Write-Host "📤 Mise à jour Cloud Run..." -ForegroundColor Cyan
Write-Host ""

$updateCmd = "gcloud run services update $GcpServiceName " +
    "--region=$GcpRegion " +
    "--project=$GcpProjectId " +
    "--update-env-vars=`"$envVarsStr`" " +
    "--update-secrets=`"$secretsStr`""

Write-Host "Exécution de la commande..." -ForegroundColor Yellow
Invoke-Expression $updateCmd

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ Cloud Run mis à jour avec succès!" -ForegroundColor Green
    Write-Host ""
    Write-Host "⭐ LAUNCH_PHASE_START_DATE configurée: 2026-02-10T00:00:00Z" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Prochaines étapes:" -ForegroundColor Yellow
    Write-Host "  1. Vérifier les logs Cloud Run"
    Write-Host "  2. Vérifier que LAUNCH_PHASE_START_DATE est bien chargée"
    Write-Host "  3. Tester l'application"
} else {
    Write-Host ""
    Write-Host "❌ Erreur lors de la mise à jour" -ForegroundColor Red
}

Write-Host ""


