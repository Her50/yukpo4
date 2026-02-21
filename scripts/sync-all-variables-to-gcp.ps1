# Script complet pour synchroniser TOUTES les variables vers GCP
# Prend les variables fournies et les synchronise dans GCP Cloud Run
# Usage: .\scripts\sync-all-variables-to-gcp.ps1

param(
    [string]$GcpProjectId = "yukpo-project",
    [string]$GcpRegion = "europe-west1",
    [string]$GcpServiceName = "yukpo-backend",
    [switch]$DryRun = $false
)

$ErrorActionPreference = "Continue"

Write-Host "🔄 Synchronisation Complète Variables vers GCP" -ForegroundColor Yellow
Write-Host "=============================================" -ForegroundColor Yellow
Write-Host ""

# Vérifier gcloud
if (-not (Get-Command gcloud -ErrorAction SilentlyContinue)) {
    Write-Host "❌ ERREUR: gcloud CLI n'est pas installé" -ForegroundColor Red
    exit 1
}

# Vérifier l'authentification GCP
Write-Host "🔍 Vérification GCP..." -ForegroundColor Cyan
gcloud config set project $GcpProjectId | Out-Null
$gcpAuth = gcloud auth list --filter=status:ACTIVE --format="value(account)" 2>&1
if (-not $gcpAuth) {
    Write-Host "❌ Erreur d'authentification GCP" -ForegroundColor Red
    exit 1
}
Write-Host "✅ GCP authentifié: $gcpAuth" -ForegroundColor Green
Write-Host ""

# Récupérer le service account
Write-Host "🔍 Récupération du service account..." -ForegroundColor Cyan
$GcpServiceAccount = gcloud run services describe $GcpServiceName `
    --region=$GcpRegion `
    --format="value(spec.template.spec.serviceAccountName)" `
    --project=$GcpProjectId 2>&1

if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrEmpty($GcpServiceAccount)) {
    $GcpServiceAccount = "$GcpProjectId@appspot.gserviceaccount.com"
    Write-Host "⚠️  Utilisation du service account par défaut: $GcpServiceAccount" -ForegroundColor Yellow
} else {
    Write-Host "✅ Service Account: $GcpServiceAccount" -ForegroundColor Green
}
Write-Host ""

# ============================================
# DÉFINITION DES VARIABLES
# ============================================

# Variables sensibles (secrets) - à stocker dans Secret Manager
$secrets = @{
    "DATABASE_URL" = "postgresql://yukpo_db_user:88X47ZWBiLkX5WatFcLU4KQ4rgaHYml4@dpg-d2t7ntbuibrs73eh9tvg-a/yukpo_db"
    "REDIS_URL" = "rediss://default:ASMJAAImcDIxMmNlMGQ2Y2VmODE0NWU3OTA2ZWE2NThmOTIwNWZiZnAyODk2OQ@quiet-crawdad-8969.upstash.io:6379"
    "MONGODB_URL" = "mongodb+srv://yukpomnang:DENQG9aru56Ixaqi@cluster1.arqkgsd.mongodb.net/?retryWrites=true&w=majority&appName=Cluster1"
    "JWT_SECRET" = "0c37c2b6ac75e4fff6c9339c3bdcdd81"
    "OPENAI_API_KEY" = "[REDACTED]"
    "SORA_API_KEY" = "[REDACTED]"
    "GOOGLE_MAPS_API_KEY" = "AIzaSyDFfWEq1Umm06SNTbR-cRhRQ5Sq_taEAWQ"
    "GOOGLE_TRANSLATE_API_KEY" = "AIzaSyDFfWEq1Umm06SNTbR-cRhRQ5Sq_taEAWQ"
    "GOOGLE_CLIENT_ID" = "[REDACTED]"
    "YOUTUBE_CLIENT_ID" = "[REDACTED]"
    "YOUTUBE_CLIENT_SECRET" = "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"
    "PEXELS_API_KEY" = "1ytrq9SUFeMBA68ieIw9rFio3zZCU8ch6355srswcZer6hnJaLPv5Jl8"
    "PIXABAY_API_KEY" = "53555366-49550f2da946ADC1e8e4F5B99"
    "UNSPLASH_ACCESS_KEY" = "iOBl0EgF7Um3QclokoYMV4aH2IkDyOoRuPYswWxrrSM"
    "OPENWEATHERMAP_API_KEY" = "59f12cb0fdcbbaeff46c93e716b66896"
    "AUPHONIC_API_KEY" = "AdxU2ktP7YfxzWd2N5JfMFDketxNRktq"
    "AUPHONIC_USERNAME" = "lelehernandez2007"
    "GEONAMES_USERNAME" = "hernandezlele"
    "SENDGRID_API_KEY" = "your_sendgrid_api_key"
    "TWILIO_ACCOUNT_SID" = "your_account_sid"
    "TWILIO_AUTH_TOKEN" = "your_auth_token"
    "TWILIO_FROM_NUMBER" = "+1234567890"
    "LIVEKIT_API_KEY" = "APIPHE9xDv5RPaP"
    "LIVEKIT_API_SECRET" = "qVRL18gIk8W3Dp8V4Wu23I99t0XbZ5pM66D9i5MTTkE"
    "VIDEO_RENDERER_RPC_TOKEN" = "l-5nF6KwiPasSeCj2h_ixIevCZO2mLijLcJg6KNmP2UxAQGMSLD9RnRrBC_0mGhY"
    "EMBEDDING_API_KEY" = "yukpo_embedding_key_2024"
    "YUKPO_API_KEY" = "yukpo_embedding_key_2024"
    "S3_ACCESS_KEY" = "[REDACTED]"
    "S3_SECRET_KEY" = "[REDACTED]"
}

# Mapping des noms de secrets (nom variable vers nom secret GCP)
$secretMapping = @{
    "DATABASE_URL" = "database-url"
    "REDIS_URL" = "redis-url"
    "MONGODB_URL" = "mongodb-url"
    "JWT_SECRET" = "jwt-secret"
    "OPENAI_API_KEY" = "openai-api-key"
    "SORA_API_KEY" = "sora-api-key"
    "GOOGLE_MAPS_API_KEY" = "google-maps-api-key"
    "GOOGLE_TRANSLATE_API_KEY" = "google-translate-api-key"
    "GOOGLE_CLIENT_ID" = "google-client-id"
    "YOUTUBE_CLIENT_ID" = "youtube-client-id"
    "YOUTUBE_CLIENT_SECRET" = "youtube-client-secret"
    "PEXELS_API_KEY" = "pexels-api-key"
    "PIXABAY_API_KEY" = "pixabay-api-key"
    "UNSPLASH_ACCESS_KEY" = "unsplash-access-key"
    "OPENWEATHERMAP_API_KEY" = "openweathermap-api-key"
    "AUPHONIC_API_KEY" = "auphonic-api-key"
    "AUPHONIC_USERNAME" = "auphonic-username"
    "GEONAMES_USERNAME" = "geonames-username"
    "SENDGRID_API_KEY" = "sendgrid-api-key"
    "TWILIO_ACCOUNT_SID" = "twilio-account-sid"
    "TWILIO_AUTH_TOKEN" = "twilio-auth-token"
    "TWILIO_FROM_NUMBER" = "twilio-from-number"
    "LIVEKIT_API_KEY" = "livekit-api-key"
    "LIVEKIT_API_SECRET" = "livekit-api-secret"
    "VIDEO_RENDERER_RPC_TOKEN" = "video-renderer-rpc-token"
    "EMBEDDING_API_KEY" = "embedding-api-key"
    "YUKPO_API_KEY" = "yukpo-api-key"
    "S3_ACCESS_KEY" = "s3-access-key"
    "S3_SECRET_KEY" = "s3-secret-key"
}

# Variables d'environnement non-sensibles
$envVars = @{
    # Pool DB (corrigé pour éviter saturation)
    "DB_POOL_SIZE" = "10"
    "DB_POOL_MIN_SIZE" = "2"
    "DB_ACQUIRE_TIMEOUT_SECS" = "30"
    "DB_HEALTH_CHECK_INTERVAL_SECS" = "30"
    "DATABASE_TIMEOUT" = "10"
    "DATABASE_READ_REPLICA_URL" = ""
    
    # Configuration Cloud Run
    "CLOUD_RUN" = "true"
    "ENVIRONMENT" = "production"
    "APP_ENV" = "production"
    "HOST" = "0.0.0.0"
    "PORT" = "8080"
    "RUST_LOG" = "info"
    "LOG_FORMAT" = "json"
    "SQLX_OFFLINE" = "true"
    "ENABLE_AUTO_MIGRATIONS" = "true"
    
    # ⭐ CRITIQUE: Phase de lancement
    "LAUNCH_PHASE_START_DATE" = "2026-02-10T00:00:00Z"
    
    # API Configuration
    "API_MAX_PAYLOAD_SIZE" = "10485760"
    "API_RATE_LIMIT_PER_MINUTE" = "100"
    "API_REQUEST_TIMEOUT" = "30"
    "REQUEST_TIMEOUT" = "30"
    "RATE_LIMIT_IP" = "200"
    
    # AI Configuration
    "AI_REQUEST_TIMEOUT_SECONDS" = "120"
    "ENABLE_AI_OPTIMIZATIONS" = "true"
    "EMBEDDING_MAX_RETRIES" = "3"
    "EMBEDDING_TIMEOUT_SECONDS" = "60"
    
    # GPU Configuration
    "GPU_AVAILABLE" = "false"
    "AMD_GPU_AVAILABLE" = "true"
    "GPU_MEMORY_GB" = "16"
    "GPU_TYPE" = "nvidia"
    "CUDA_VISIBLE_DEVICES" = "0,1"
    "NVIDIA_VISIBLE_DEVICES" = "all"
    "GPU_ENABLED" = "true"
    "GPU_ENDPOINT" = "http://yukpo-gpu-workers:8080"
    "GPU_ZONE" = "europe-west1-b"
    "GPU_INSTANCE_NAME" = "yukpo-gpu-worker"
    "GCP_PROJECT_ID" = "yukpo-project"
    "GPU_MONTHLY_BUDGET" = "100.0"
    "GPU_SCALE_UP_THRESHOLD" = "70.0"
    "GPU_SCALE_DOWN_THRESHOLD" = "20.0"
    "GPU_MAX_INSTANCES" = "3"
    "GPU_MIN_INSTANCES" = "0"
    
    # Video/Audio Configuration
    "VIDEO_GENERATION_TIMEOUT_SECONDS" = "600"
    "VIDEO_ANALYSIS_TIMEOUT_SECONDS" = "180"
    "VIDEO_RENDERER_ENABLE_GPU" = "true"
    "VIDEO_RENDERER_MAX_RETRIES" = "2"
    "VIDEO_RENDERER_TIMEOUT_SECS" = "900"
    "VIDEO_RENDERER_PROJECT_ROOT" = "/srv/yukpo/video-renderer"
    "VIDEO_RENDERER_SHARED_VOLUME" = "/srv/yukpo/jobs"
    "VIDEO_RENDERER_RPC_URL" = "http://46.224.14.85:8088/render"
    "AUDIO_SYNC_TIMEOUT_SECONDS" = "180"
    "MAX_VIDEO_SIZE_MB" = "50"
    "MAX_AUDIO_SIZE_MB" = "10"
    "MAX_IMAGE_SIZE_MB" = "10"
    "MAX_DOC_SIZE_MB" = "10"
    "MAX_EXCEL_SIZE_MB" = "5"
    
    # Blender Configuration
    "BLENDER_PATH" = "/usr/local/bin/blender"
    "BLENDER_RENDER_SAMPLES" = "256"
    "BLENDER_USE_GPU" = "false"
    
    # AR Configuration
    "AR_RENDER_OUTPUT_DIR" = "/tmp/ar_renders"
    
    # Color Grading
    "COLOR_GRADING_TIMEOUT_SECONDS" = "120"
    
    # Auphonic Configuration
    "AUPHONIC_BASE_URL" = "https://api.auphonic.com"
    "AUPHONIC_OUTPUT_FORMAT" = "wav"
    "AUPHONIC_POLL_INTERVAL_SECS" = "5"
    "AUPHONIC_PRESET" = "yukpo_preset"
    
    # LiveKit Configuration
    "LIVEKIT_API_URL" = "http://46.224.14.85:7880"
    "LIVEKIT_WS_URL" = "ws://46.224.14.85:7880"
    "LIVEKIT_HLS_URL" = "http://46.224.14.85:8080/live"
    "LIVEKIT_INGRESS_MODE" = "rtmp"
    "LIVEKIT_INGRESS_NAME" = "prod-ingress-1"
    "LIVEKIT_INGRESS_REGION" = "eu-central"
    "LIVEKIT_INGRESS_ROOM" = "live-events"
    "LIVE_FALLBACK_ENABLED" = "true"
    "LIVE_RECORDING_ENABLED" = "true"
    
    # SRS Configuration
    "SRS_HLS_URL" = "https://srs.46.224.14.85.sslip.io/live"
    "SRS_RTMP_URL" = "rtmp://46.224.14.85:1935/live"
    
    # S3/GCS Configuration - GCP (CDN S3 naif GCP: Cloud Storage + Cloud CDN)
    "S3_BUCKET" = "yukpo-project-yukpo-backend-media"
    "S3_REGION" = "europe-west1"
    "S3_ENDPOINT" = "https://storage.googleapis.com"
    "S3_FORCE_PATH_STYLE" = "false"
    "RENDERER_S3_UPLOAD" = "true"
    "UPLOAD_BASE_URL" = "http://34.54.117.97"
    "PUBLIC_BASE_URL" = "http://34.54.117.97"
    "UPLOAD_STORAGE_PATH" = "uploads"
    
    # Email Configuration
    "EMAIL_ENABLED" = "true"
    "EMAIL_PROVIDER" = "sendgrid"
    "SENDGRID_FROM_EMAIL" = "noreply@yukpomnang.com"
    "SENDGRID_FROM_NAME" = "Yukpomnang"
    
    # SMS Configuration
    "SMS_ENABLED" = "true"
    "SMS_PROVIDER" = "twilio"
    
    # Mobile Money (masqués dans les valeurs fournies)
    "MTN_MONEY_ENABLED" = "true"
    "MTN_MONEY_ENVIRONMENT" = "sandbox"
    "ORANGE_MONEY_ENABLED" = "true"
    "ORANGE_MONEY_ENVIRONMENT" = "sandbox"
    
    # KYC
    "KYC_PROVIDER" = "manual"
    
    # JWT
    "JWT_EXPIRATION_HOURS" = "24"
    
    # Search Configuration
    "SEARCH_DEFAULT_LANGUAGE" = "fr"
    "SEARCH_DEFAULT_RADIUS_KM" = "20"
    "SEARCH_MAX_RESULTS" = "50"
    "SEARCH_TITLE_BOOST" = "2.0"
    "SEMANTIC_CACHE_THRESHOLD" = "0.85"
    
    # Cache Configuration
    "CACHE_DEFAULT_TTL" = "3600"
    "CACHE_TTL_SEARCH" = "600"
    
    # Redis Configuration
    "REDIS_CLUSTER_NODES" = ""
    
    # Delivery Configuration
    "DELIVERY_MATCHING_EMPTY_CACHE_TTL_SECS" = "30"
    "DELIVERY_MATCHING_WORKER_BATCH_SIZE" = "50"
    "DELIVERY_MATCHING_WORKER_INTERVAL_SECS" = "30"
    "DELIVERY_MATCHING_WORKER_PARALLEL" = "3"
    "DELIVERY_PENDING_TIMEOUT_MINUTES" = "60"
    "DELIVERY_TIMEOUT_MONITOR_INTERVAL_SECS" = "60"
    "MATCHING_MIN_SCORE_THRESHOLD" = "0.6"
    
    # Order Configuration
    "ORDER_TIMEOUT_MONITOR_INTERVAL_SECS" = "60"
    
    # SLA Configuration
    "SLA_PROMISED_MINUTES" = "30"
    "SLA_THRESHOLD_RATIO" = "1.10"
    "SLA_LOOKBACK_MINUTES" = "60"
    "SLA_MONITOR_INTERVAL_SECONDS" = "300"
    "SLA_ALERT_WEBHOOK" = "[REDACTED]"
    
    # Pipeline Configuration
    "PIPELINE_HEALTH_CHECK_INTERVAL_SECS" = "300"
    "PIPELINE_ALERT_WEBHOOK" = "[REDACTED]"
    
    # Global Promo Configuration
    "GLOBAL_PROMO_SCHEDULER_INTERVAL_SECS" = "30"
    "global_promo_catalog_cache" = "60"
    
    # Staging/Demo
    "ENABLE_STAGING_DEMO_SEED" = "true"
    
    # ML Models
    "ML_MODELS_DIR" = "models"
    
    # Instance
    "INSTANCE_ID" = "backend-1"
    
    # YouTube
    "YOUTUBE_REDIRECT_URI" = "https://yukpomnang.onrender.com/api/social/youtube/callback"
    
    # Yukpo Immo
    "YUKPO_IMMO_COMMISSION_RATE" = "0.05"
}

# ============================================
# FONCTIONS
# ============================================

function Create-GcpSecret {
    param(
        [string]$SecretName,
        [string]$SecretValue,
        [string]$Description = ""
    )
    
    if ($DryRun) {
        Write-Host "  [DRY RUN] Créerait secret: $SecretName" -ForegroundColor Gray
        return $true
    }
    
    $tempFile = [System.IO.Path]::GetTempFileName()
    try {
        [System.IO.File]::WriteAllText($tempFile, $SecretValue, [System.Text.Encoding]::UTF8)
        
        $existing = gcloud secrets describe $SecretName --project=$GcpProjectId 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  ⚠️  Secret existe, ajout nouvelle version..." -ForegroundColor Yellow
            gcloud secrets versions add $SecretName `
                --data-file=$tempFile `
                --project=$GcpProjectId 2>&1 | Out-Null
        } else {
            if ([string]::IsNullOrEmpty($Description)) {
                $Description = "Migré depuis AWS - $SecretName"
            }
            gcloud secrets create $SecretName `
                --data-file=$tempFile `
                --replication-policy="automatic" `
                --project=$GcpProjectId 2>&1 | Out-Null
        }
        
        if ($LASTEXITCODE -eq 0) {
            gcloud secrets add-iam-policy-binding $SecretName `
                --member="serviceAccount:$GcpServiceAccount" `
                --role="roles/secretmanager.secretAccessor" `
                --project=$GcpProjectId 2>&1 | Out-Null
            return $true
        }
    } finally {
        if (Test-Path $tempFile) {
            Remove-Item $tempFile -Force
        }
    }
    return $false
}

# ============================================
# CRÉATION DES SECRETS
# ============================================

Write-Host "🔐 Création/Mise à jour des secrets dans Secret Manager..." -ForegroundColor Cyan
Write-Host ""

$secretsCreated = 0
$secretsUpdated = 0
$secretsFailed = 0

foreach ($varName in $secrets.Keys) {
    $secretName = $secretMapping[$varName]
    $secretValue = $secrets[$varName]
    
    if ([string]::IsNullOrEmpty($secretName)) {
        Write-Host "  ⚠️  Pas de mapping pour $varName, ignoré" -ForegroundColor Yellow
        continue
    }
    
    Write-Host "🔐 $varName vers $secretName..." -ForegroundColor Cyan
    
    # Vérifier si le secret existe
    $existing = gcloud secrets describe $secretName --project=$GcpProjectId 2>&1
    $exists = $LASTEXITCODE -eq 0
    
    if (Create-GcpSecret -SecretName $secretName -SecretValue $secretValue) {
        if ($exists) {
            $secretsUpdated++
            Write-Host "  ✅ Secret mis à jour" -ForegroundColor Green
        } else {
            $secretsCreated++
            Write-Host "  ✅ Secret créé" -ForegroundColor Green
        }
    } else {
        $secretsFailed++
        Write-Host "  ❌ Erreur lors de la création/mise à jour" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "✅ Secrets: $secretsCreated créés, $secretsUpdated mis à jour, $secretsFailed échecs" -ForegroundColor Green
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
    if (-not [string]::IsNullOrEmpty($value)) {
        $envVarsList += "$key=$value"
    }
}

# Ajouter les variables existantes qui ne sont pas dans notre liste
$currentConfig = gcloud run services describe $GcpServiceName `
    --region=$GcpRegion `
    --project=$GcpProjectId `
    --format=json 2>&1 | ConvertFrom-Json

if ($LASTEXITCODE -eq 0 -and $currentConfig.spec.template.spec.containers[0].env) {
    foreach ($envVar in $currentConfig.spec.template.spec.containers[0].env) {
        if ($envVar.value -and -not $envVars.ContainsKey($envVar.name)) {
            $envVarsList += "$($envVar.name)=$($envVar.value)"
        }
    }
}

$envVarsStr = $envVarsList -join ","

# Construire la liste des secrets référencés
$secretsList = @()
foreach ($varName in $secrets.Keys) {
    $secretName = $secretMapping[$varName]
    if (-not [string]::IsNullOrEmpty($secretName)) {
        $secretsList += "$varName=$secretName:latest"
    }
}

# Ajouter les secrets existants qui ne sont pas dans notre liste
if ($currentConfig.spec.template.spec.containers[0].env) {
    foreach ($envVar in $currentConfig.spec.template.spec.containers[0].env) {
        if ($envVar.valueFrom -and $envVar.valueFrom.secretKeyRef) {
            $existingSecretName = $envVar.valueFrom.secretKeyRef.name
            if (-not $secrets.ContainsKey($envVar.name)) {
                $secretsList += "$($envVar.name)=$existingSecretName:latest"
            }
        }
    }
}

$secretsStr = $secretsList -join ","

# Afficher la commande
Write-Host "Commande à exécuter:" -ForegroundColor Yellow
$updateCmd = "gcloud run services update $GcpServiceName " +
    "--region=$GcpRegion " +
    "--project=$GcpProjectId"

if ($envVarsStr) {
    $updateCmd += " --update-env-vars=`"$envVarsStr`""
}

if ($secretsStr) {
    $updateCmd += " --update-secrets=`"$secretsStr`""
}

Write-Host $updateCmd -ForegroundColor Gray
Write-Host ""

if ($DryRun) {
    Write-Host "[DRY RUN] La commande ci-dessus serait exécutée" -ForegroundColor Yellow
} else {
    Write-Host "Exécution..." -ForegroundColor Cyan
    Invoke-Expression $updateCmd
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Cloud Run mis à jour avec succès!" -ForegroundColor Green
    } else {
        Write-Host "❌ Erreur lors de la mise à jour" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "📊 RÉSUMÉ" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

Write-Host "✅ Secrets créés/mis à jour: $($secretsCreated + $secretsUpdated)" -ForegroundColor Green
Write-Host "✅ Variables d'environnement: $($envVars.Count)" -ForegroundColor Green
Write-Host "⭐ LAUNCH_PHASE_START_DATE: $($envVars['LAUNCH_PHASE_START_DATE'])" -ForegroundColor Cyan
Write-Host ""

Write-Host "Prochaines étapes:" -ForegroundColor Yellow
Write-Host "  1. Vérifier les logs Cloud Run"
Write-Host "  2. Tester l'application"
Write-Host "  3. Vérifier que LAUNCH_PHASE_START_DATE est bien chargée"
Write-Host ""

