# Script FINAL pour synchroniser et adapter TOUTES les variables pour GCP
# Adapte automatiquement : Cloud SQL, Memorystore, GPU, GCS, CDN, WebSocket
# Usage: .\scripts\sync-variables-gcp-complete-final.ps1

param(
    [string]$GcpProjectId = "yukpo-project",
    [string]$GcpRegion = "europe-west1",
    [string]$GcpServiceName = "yukpo-backend",
    [string]$DatabasePassword = "",  # À fournir si nécessaire
    [string]$GcsBucket = "yukpo-project-yukpo-backend-media"  # Bucket GCS
)

$ErrorActionPreference = "Continue"

Write-Host "🔄 Synchronisation COMPLÈTE Variables → GCP (Adaptées)" -ForegroundColor Yellow
Write-Host "=====================================================" -ForegroundColor Yellow
Write-Host ""

# Vérifier gcloud
if (-not (Get-Command gcloud -ErrorAction SilentlyContinue)) {
    Write-Host "❌ ERREUR: gcloud CLI n'est pas installé" -ForegroundColor Red
    exit 1
}

gcloud config set project $GcpProjectId | Out-Null

# Récupérer les informations GCP
Write-Host "🔍 Récupération des informations GCP..." -ForegroundColor Cyan

# Cloud SQL
$cloudSqlConnection = "yukpo-project:europe-west1:yukpo-postgres"
Write-Host "  ✅ Cloud SQL: $cloudSqlConnection" -ForegroundColor Green

# Redis Memorystore
$redisHost = "10.128.102.19"
$redisPort = "6379"
Write-Host "  ✅ Redis Memorystore: ${redisHost}:${redisPort}" -ForegroundColor Green

# CDN GCP
$cdnUrl = "http://34.54.117.97"
Write-Host "  ✅ Cloud CDN: $cdnUrl" -ForegroundColor Green

# Service Account
$GcpServiceAccount = gcloud run services describe $GcpServiceName `
    --region=$GcpRegion `
    --format="value(spec.template.spec.serviceAccountName)" `
    --project=$GcpProjectId 2>&1

if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrEmpty($GcpServiceAccount)) {
    $GcpServiceAccount = "$GcpProjectId@appspot.gserviceaccount.com"
}

Write-Host "  ✅ Service Account: $GcpServiceAccount" -ForegroundColor Green
Write-Host ""

# ============================================
# VARIABLES ADAPTÉES POUR GCP
# ============================================

# Variables d'environnement (adaptées pour GCP)
$envVars = @{
    # ⭐ CRITIQUE: Pool DB réduit pour éviter saturation
    "DB_POOL_SIZE" = "10"
    "DB_POOL_MIN_SIZE" = "2"
    "DB_ACQUIRE_TIMEOUT_SECS" = "30"
    "DB_HEALTH_CHECK_INTERVAL_SECS" = "30"
    "DATABASE_TIMEOUT" = "10"
    
    # ⭐ CRITIQUE: Variable période de lancement
    "LAUNCH_PHASE_START_DATE" = "2026-02-10T00:00:00Z"
    
    # Configuration GCP
    "CLOUD_RUN" = "true"
    "ENVIRONMENT" = "production"
    "APP_ENV" = "production"
    "HOST" = "0.0.0.0"
    "PORT" = "8080"
    "RUST_LOG" = "info"
    "LOG_FORMAT" = "json"
    "SQLX_OFFLINE" = "true"
    "ENABLE_AUTO_MIGRATIONS" = "true"
    
    # ⭐ GPU GCP (scaling automatique)
    "GPU_ENABLED" = "true"
    "GPU_ENDPOINT" = "http://yukpo-gpu-workers:8080"
    "GPU_ZONE" = "europe-west1-b"
    "GPU_INSTANCE_NAME" = "yukpo-gpu-worker"
    "GCP_PROJECT_ID" = $GcpProjectId
    "GPU_MONTHLY_BUDGET" = "100.0"
    "GPU_SCALE_UP_THRESHOLD" = "70.0"
    "GPU_SCALE_DOWN_THRESHOLD" = "20.0"
    "GPU_SCALE_DOWN_COOLDOWN" = "300"
    "GPU_REQUEST_TIMEOUT" = "60"
    "GPU_MAX_INSTANCES" = "3"
    "GPU_MIN_INSTANCES" = "0"
    "GPU_AVAILABLE" = "false"  # Pas de GPU local dans Cloud Run
    
    # ⭐ CDN GCP (Cloud CDN)
    "UPLOAD_BASE_URL" = $cdnUrl
    "PUBLIC_BASE_URL" = $cdnUrl
    
    # ⭐ GCS (remplace S3)
    "S3_BUCKET" = $GcsBucket
    "S3_REGION" = $GcpRegion
    "S3_ENDPOINT" = "https://storage.googleapis.com"
    "S3_FORCE_PATH_STYLE" = "false"
    "RENDERER_S3_UPLOAD" = "true"
    
    # Autres variables (conservées)
    "AI_REQUEST_TIMEOUT_SECONDS" = "120"
    "AMD_GPU_AVAILABLE" = "false"
    "API_MAX_PAYLOAD_SIZE" = "10485760"
    "API_RATE_LIMIT_PER_MINUTE" = "100"
    "API_REQUEST_TIMEOUT" = "30"
    "AR_RENDER_OUTPUT_DIR" = "/tmp/ar_renders"
    "AUDIO_SYNC_TIMEOUT_SECONDS" = "180"
    "AUPHONIC_BASE_URL" = "https://api.auphonic.com"
    "AUPHONIC_OUTPUT_FORMAT" = "wav"
    "AUPHONIC_POLL_INTERVAL_SECS" = "5"
    "AUPHONIC_PRESET" = "yukpo_preset"
    "AUPHONIC_USERNAME" = "lelehernandez2007"
    "BLENDER_PATH" = "/usr/local/bin/blender"
    "BLENDER_RENDER_SAMPLES" = "256"
    "BLENDER_USE_GPU" = "false"
    "CACHE_DEFAULT_TTL" = "3600"
    "CACHE_TTL_SEARCH" = "600"
    "COLOR_GRADING_TIMEOUT_SECONDS" = "120"
    "CUDA_VISIBLE_DEVICES" = "0,1"
    "DATABASE_READ_REPLICA_URL" = ""
    "DELIVERY_MATCHING_EMPTY_CACHE_TTL_SECS" = "30"
    "DELIVERY_MATCHING_WORKER_BATCH_SIZE" = "50"
    "DELIVERY_MATCHING_WORKER_INTERVAL_SECS" = "30"
    "DELIVERY_MATCHING_WORKER_PARALLEL" = "3"
    "DELIVERY_PENDING_TIMEOUT_MINUTES" = "60"
    "DELIVERY_TIMEOUT_MONITOR_INTERVAL_SECS" = "60"
    "EMAIL_ENABLED" = "true"
    "EMAIL_PROVIDER" = "sendgrid"
    "EMBEDDING_MAX_RETRIES" = "3"
    "EMBEDDING_TIMEOUT_SECONDS" = "60"
    "ENABLE_AI_OPTIMIZATIONS" = "true"
    "ENABLE_STAGING_DEMO_SEED" = "true"
    "GEONAMES_USERNAME" = "hernandezlele"
    "GLOBAL_PROMO_SCHEDULER_INTERVAL_SECS" = "30"
    "GPU_MEMORY_GB" = "16"
    "GPU_TYPE" = "nvidia"
    "INSTANCE_ID" = "backend-1"
    "JWT_EXPIRATION_HOURS" = "24"
    "KYC_PROVIDER" = "manual"
    "LIVEKIT_API_URL" = "http://46.224.14.85:7880"
    "LIVEKIT_HLS_URL" = "http://46.224.14.85:8080/live"
    "LIVEKIT_INGRESS_MODE" = "rtmp"
    "LIVEKIT_INGRESS_NAME" = "prod-ingress-1"
    "LIVEKIT_INGRESS_REGION" = "eu-central"
    "LIVEKIT_INGRESS_ROOM" = "live-events"
    "LIVEKIT_WS_URL" = "ws://46.224.14.85:7880"
    "LIVE_FALLBACK_ENABLED" = "true"
    "LIVE_RECORDING_ENABLED" = "true"
    "MATCHING_MIN_SCORE_THRESHOLD" = "0.6"
    "MAX_AUDIO_SIZE_MB" = "10"
    "MAX_DOC_SIZE_MB" = "10"
    "MAX_EXCEL_SIZE_MB" = "5"
    "MAX_IMAGE_SIZE_MB" = "10"
    "MAX_VIDEO_SIZE_MB" = "50"
    "ML_MODELS_DIR" = "models"
    "MTN_MONEY_ENABLED" = "true"
    "MTN_MONEY_ENVIRONMENT" = "sandbox|production"
    "NVIDIA_VISIBLE_DEVICES" = "all"
    "OPENWEATHERMAP_API_KEY" = "59f12cb0fdcbbaeff46c93e716b66896"
    "ORANGE_MONEY_ENABLED" = "true"
    "ORANGE_MONEY_ENVIRONMENT" = "sandbox|production"
    "ORDER_TIMEOUT_MONITOR_INTERVAL_SECS" = "60"
    "PIPELINE_ALERT_WEBHOOK" = "[REDACTED]"
    "PIPELINE_HEALTH_CHECK_INTERVAL_SECS" = "300"
    "PUBLIC_BASE_URL" = $cdnUrl
    "RATE_LIMIT_IP" = "200"
    "REQUEST_TIMEOUT" = "30"
    "SEARCH_DEFAULT_LANGUAGE" = "fr"
    "SEARCH_DEFAULT_RADIUS_KM" = "20"
    "SEARCH_MAX_RESULTS" = "50"
    "SEARCH_TITLE_BOOST" = "2.0"
    "SEMANTIC_CACHE_THRESHOLD" = "0.85"
    "SENDGRID_FROM_EMAIL" = "noreply@yukpomnang.com"
    "SENDGRID_FROM_NAME" = "Yukpomnang"
    "SLA_ALERT_WEBHOOK" = "[REDACTED]"
    "SLA_LOOKBACK_MINUTES" = "60"
    "SLA_MONITOR_INTERVAL_SECONDS" = "300"
    "SLA_PROMISED_MINUTES" = "30"
    "SLA_THRESHOLD_RATIO" = "1.10"
    "SMS_ENABLED" = "true"
    "SMS_PROVIDER" = "twilio"
    "SRS_HLS_URL" = "https://srs.46.224.14.85.sslip.io/live"
    "SRS_RTMP_URL" = "rtmp://46.224.14.85:1935/live"
    "UPLOAD_STORAGE_PATH" = "/var/data/uploads"
    "VIDEO_ANALYSIS_TIMEOUT_SECONDS" = "180"
    "VIDEO_GENERATION_TIMEOUT_SECONDS" = "600"
    "VIDEO_RENDERER_ENABLE_GPU" = "true"
    "VIDEO_RENDERER_MAX_RETRIES" = "2"
    "VIDEO_RENDERER_PROJECT_ROOT" = "/srv/yukpo/video-renderer"
    "VIDEO_RENDERER_RPC_URL" = "http://46.224.14.85:8088/render"
    "VIDEO_RENDERER_SHARED_VOLUME" = "/srv/yukpo/jobs"
    "VIDEO_RENDERER_TIMEOUT_SECS" = "900"
    "YOUTUBE_REDIRECT_URI" = "https://yukpomnang.onrender.com/api/social/youtube/callback"
    "YUKPO_IMMO_COMMISSION_RATE" = "0.05"
    "global_promo_catalog_cache" = "60"
}

# Secrets (adaptés pour GCP)
$secrets = @{
    # ⭐ DATABASE_URL: Format Cloud SQL Unix socket
    "DATABASE_URL" = "postgresql://yukpo_user:${DatabasePassword}@/yukpo_db?host=/cloudsql/${cloudSqlConnection}"
    
    # ⭐ REDIS_URL: Format Memorystore
    "REDIS_URL" = "redis://${redisHost}:${redisPort}/0"
    
    # Autres secrets (conservés)
    "JWT_SECRET" = "0c37c2b6ac75e4fff6c9339c3bdcdd81"
    "MONGODB_URL" = "mongodb+srv://yukpomnang:DENQG9aru56Ixaqi@cluster1.arqkgsd.mongodb.net/?retryWrites=true`&w=majority`&appName=Cluster1"
    "OPENAI_API_KEY" = "[REDACTED]"
    "AUPHONIC_API_KEY" = "AdxU2ktP7YfxzWd2N5JfMFDketxNRktq"
    "EMBEDDING_API_KEY" = "yukpo_embedding_key_2024"
    "GOOGLE_CLIENT_ID" = "[REDACTED]"
    "GOOGLE_MAPS_API_KEY" = "AIzaSyDFfWEq1Umm06SNTbR-cRhRQ5Sq_taEAWQ"
    "GOOGLE_TRANSLATE_API_KEY" = "AIzaSyDFfWEq1Umm06SNTbR-cRhRQ5Sq_taEAWQ"
    "LIVEKIT_API_KEY" = "APIPHE9xDv5RPaP"
    "LIVEKIT_API_SECRET" = "qVRL18gIk8W3Dp8V4Wu23I99t0XbZ5pM66D9i5MTTkE"
    "PEXELS_API_KEY" = "1ytrq9SUFeMBA68ieIw9rFio3zZCU8ch6355srswcZer6hnJaLPv5Jl8"
    "PIXABAY_API_KEY" = "53555366-49550f2da946ADC1e8e4F5B99"
    "S3_ACCESS_KEY" = "[REDACTED]"  # ⚠️ À remplacer par Service Account GCS
    "S3_SECRET_KEY" = "[REDACTED]"  # ⚠️ À remplacer par Service Account GCS
    "SENDGRID_API_KEY" = "your_sendgrid_api_key"
    "SORA_API_KEY" = "[REDACTED]"
    "TWILIO_ACCOUNT_SID" = "your_account_sid"
    "TWILIO_AUTH_TOKEN" = "your_auth_token"
    "TWILIO_FROM_NUMBER" = "+1234567890"
    "UNSPLASH_ACCESS_KEY" = "iOBl0EgF7Um3QclokoYMV4aH2IkDyOoRuPYswWxrrSM"
    "VIDEO_RENDERER_RPC_TOKEN" = "l-5nF6KwiPasSeCj2h_ixIevCZO2mLijLcJg6KNmP2UxAQGMSLD9RnRrBC_0mGhY"
    "YOUTUBE_CLIENT_ID" = "[REDACTED]"
    "YOUTUBE_CLIENT_SECRET" = "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"
    "YUKPO_API_KEY" = "yukpo_embedding_key_2024"
}

# Mapping secrets
$secretMapping = @{
    "DATABASE_URL" = "database-url"
    "REDIS_URL" = "redis-url"
    "JWT_SECRET" = "jwt-secret"
    "MONGODB_URL" = "mongodb-url"
    "OPENAI_API_KEY" = "openai-api-key"
    "AUPHONIC_API_KEY" = "auphonic-api-key"
    "EMBEDDING_API_KEY" = "embedding-api-key"
    "GOOGLE_CLIENT_ID" = "google-client-id"
    "GOOGLE_MAPS_API_KEY" = "google-maps-api-key"
    "GOOGLE_TRANSLATE_API_KEY" = "google-translate-api-key"
    "LIVEKIT_API_KEY" = "livekit-api-key"
    "LIVEKIT_API_SECRET" = "livekit-api-secret"
    "PEXELS_API_KEY" = "pexels-api-key"
    "PIXABAY_API_KEY" = "pixabay-api-key"
    "S3_ACCESS_KEY" = "s3-access-key"
    "S3_SECRET_KEY" = "s3-secret-key"
    "SENDGRID_API_KEY" = "sendgrid-api-key"
    "SORA_API_KEY" = "sora-api-key"
    "TWILIO_ACCOUNT_SID" = "twilio-account-sid"
    "TWILIO_AUTH_TOKEN" = "twilio-auth-token"
    "TWILIO_FROM_NUMBER" = "twilio-from-number"
    "UNSPLASH_ACCESS_KEY" = "unsplash-access-key"
    "VIDEO_RENDERER_RPC_TOKEN" = "video-renderer-rpc-token"
    "YOUTUBE_CLIENT_ID" = "youtube-client-id"
    "YOUTUBE_CLIENT_SECRET" = "youtube-client-secret"
    "YUKPO_API_KEY" = "yukpo-api-key"
}

# ============================================
# CRÉATION DES SECRETS
# ============================================

Write-Host "📤 Création/Mise à jour des secrets..." -ForegroundColor Cyan
Write-Host ""

foreach ($secretName in $secrets.Keys) {
    $gcpSecretName = $secretMapping[$secretName]
    $secretValue = $secrets[$secretName]
    
    # Récupérer le mot de passe DB depuis le secret existant si non fourni
    if ($secretName -eq "DATABASE_URL" -and [string]::IsNullOrEmpty($DatabasePassword)) {
        $existingDbSecret = gcloud secrets versions access latest --secret="database-url" --project=$GcpProjectId 2>&1
        if ($LASTEXITCODE -eq 0 -and $existingDbSecret) {
            # Extraire le mot de passe de l'URL existante
            if ($existingDbSecret -match "postgresql://[^:]+:([^@]+)@") {
                $DatabasePassword = $matches[1]
                $secrets["DATABASE_URL"] = "postgresql://yukpo_user:${DatabasePassword}@/yukpo_db?host=/cloudsql/${cloudSqlConnection}"
                $secretValue = $secrets["DATABASE_URL"]
            }
        }
    }
    
    $exists = gcloud secrets describe $gcpSecretName --project=$GcpProjectId 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✅ Secret existe: $gcpSecretName" -ForegroundColor Green
        # Mettre à jour si nécessaire
        $tempFile = [System.IO.Path]::GetTempFileName()
        try {
            [System.IO.File]::WriteAllText($tempFile, $secretValue, [System.Text.Encoding]::UTF8)
            gcloud secrets versions add $gcpSecretName --data-file=$tempFile --project=$GcpProjectId 2>&1 | Out-Null
            if ($LASTEXITCODE -eq 0) {
                Write-Host "    ✅ Version mise à jour" -ForegroundColor Green
            }
        } finally {
            if (Test-Path $tempFile) { Remove-Item $tempFile -Force }
        }
    } else {
        Write-Host "  Création secret: $gcpSecretName" -ForegroundColor Cyan
        $tempFile = [System.IO.Path]::GetTempFileName()
        try {
            [System.IO.File]::WriteAllText($tempFile, $secretValue, [System.Text.Encoding]::UTF8)
            gcloud secrets create $gcpSecretName `
                --data-file=$tempFile `
                --replication-policy="automatic" `
                --project=$GcpProjectId 2>&1 | Out-Null
            
            if ($LASTEXITCODE -eq 0) {
                gcloud secrets add-iam-policy-binding $gcpSecretName `
                    --member="serviceAccount:$GcpServiceAccount" `
                    --role="roles/secretmanager.secretAccessor" `
                    --project=$GcpProjectId 2>&1 | Out-Null
                Write-Host "    ✅ Créé" -ForegroundColor Green
            }
        } finally {
            if (Test-Path $tempFile) { Remove-Item $tempFile -Force }
        }
    }
}

Write-Host ""

# ============================================
# MISE À JOUR CLOUD RUN
# ============================================

Write-Host "📤 Mise à jour Cloud Run avec toutes les variables..." -ForegroundColor Cyan
Write-Host ""

# Construire la liste des variables d'environnement
$envVarsList = @()
foreach ($key in $envVars.Keys) {
    $value = $envVars[$key]
    $envVarsList += "${key}=${value}"
}
$envVarsStr = $envVarsList -join ","

# Construire la liste des secrets
$secretsList = @()
foreach ($secretName in $secrets.Keys) {
    $gcpSecretName = $secretMapping[$secretName]
    $secretsList += "${secretName}=${gcpSecretName}:latest"
}
$secretsStr = $secretsList -join ","

# Mettre à jour Cloud Run
Write-Host "Exécution de la commande de mise à jour..." -ForegroundColor Yellow
$updateCmd = "gcloud run services update $GcpServiceName " +
    "--region=$GcpRegion " +
    "--project=$GcpProjectId " +
    "--update-env-vars=`"$envVarsStr`" " +
    "--update-secrets=`"$secretsStr`""

Invoke-Expression $updateCmd

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ Cloud Run mis à jour avec succès!" -ForegroundColor Green
    Write-Host ""
    Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
    Write-Host "📊 RÉSUMÉ DES ADAPTATIONS GCP" -ForegroundColor Cyan
    Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "✅ DATABASE_URL: Format Cloud SQL Unix socket" -ForegroundColor Green
    Write-Host "   postgresql://yukpo_user:***@/yukpo_db?host=/cloudsql/$cloudSqlConnection" -ForegroundColor Gray
    Write-Host ""
    Write-Host "✅ REDIS_URL: Format Memorystore" -ForegroundColor Green
    Write-Host "   redis://${redisHost}:${redisPort}/0" -ForegroundColor Gray
    Write-Host ""
    Write-Host "✅ GPU: Système GCP avec scaling automatique" -ForegroundColor Green
    Write-Host "   GPU_ENABLED=true, GPU_ENDPOINT=http://yukpo-gpu-workers:8080" -ForegroundColor Gray
    Write-Host ""
    Write-Host "✅ CDN: Cloud CDN GCP" -ForegroundColor Green
    Write-Host "   UPLOAD_BASE_URL=$cdnUrl" -ForegroundColor Gray
    Write-Host "   PUBLIC_BASE_URL=$cdnUrl" -ForegroundColor Gray
    Write-Host ""
    Write-Host "✅ GCS: Cloud Storage (remplace S3)" -ForegroundColor Green
    Write-Host "   S3_BUCKET=$GcsBucket" -ForegroundColor Gray
    Write-Host "   S3_ENDPOINT=https://storage.googleapis.com" -ForegroundColor Gray
    Write-Host ""
    Write-Host "⭐ LAUNCH_PHASE_START_DATE: 2026-02-10T00:00:00Z" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Prochaines étapes:" -ForegroundColor Yellow
    Write-Host "  1. Vérifier les logs Cloud Run"
    Write-Host "  2. Vérifier que toutes les variables sont chargées"
    Write-Host "  3. Tester les connexions (DB, Redis, GPU)"
    Write-Host "  4. Tester le CDN"
} else {
    Write-Host ""
    Write-Host "❌ Erreur lors de la mise à jour" -ForegroundColor Red
}

Write-Host ""

