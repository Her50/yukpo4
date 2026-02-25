# Script complet pour synchroniser TOUTES les variables vers GCP
# Prend les variables fournies et les synchronise avec GCP Cloud Run
# Usage: .\scripts\sync-all-variables-to-gcp-complete.ps1

param(
    [string]$GcpProjectId = "yukpo-project",
    [string]$GcpRegion = "europe-west1",
    [string]$GcpServiceName = "yukpo-backend",
    [switch]$DryRun = $false
)

$ErrorActionPreference = "Continue"

Write-Host "🔄 Synchronisation Complète Variables → GCP" -ForegroundColor Yellow
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
# TOUTES LES VARIABLES FOURNIES
# ============================================

$allVariables = @{
    # Variables d'environnement (non-sensibles)
    "AI_REQUEST_TIMEOUT_SECONDS" = "120"
    "AMD_GPU_AVAILABLE" = "true"
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
    "DATABASE_TIMEOUT" = "10"
    "DB_ACQUIRE_TIMEOUT_SECS" = "30"
    "DB_HEALTH_CHECK_INTERVAL_SECS" = "30"
    "DB_POOL_MIN_SIZE" = "2"
    "DB_POOL_SIZE" = "10"
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
    "ENVIRONMENT" = "production"
    "GEONAMES_USERNAME" = "hernandezlele"
    "GLOBAL_PROMO_SCHEDULER_INTERVAL_SECS" = "30"
    "GPU_AVAILABLE" = "false"
    "GPU_MEMORY_GB" = "16"
    "GPU_TYPE" = "nvidia"
    "HOST" = "0.0.0.0"
    "INSTANCE_ID" = "backend-1"
    "JWT_EXPIRATION_HOURS" = "24"
    "KYC_PROVIDER" = "manual"
    # ✅ MIGRÉ vers GCP: IP sera mise à jour par deploy-livekit-gcp.ps1
    "LIVEKIT_API_URL" = "http://LIVEKIT_GCE_IP:7880"
    "LIVEKIT_HLS_URL" = "http://LIVEKIT_GCE_IP:8080/live"
    "LIVEKIT_INGRESS_MODE" = "rtmp"
    "LIVEKIT_INGRESS_NAME" = "prod-ingress-1"
    "LIVEKIT_INGRESS_REGION" = "europe-west1"
    "LIVEKIT_INGRESS_ROOM" = "live-events"
    "LIVEKIT_WS_URL" = "ws://LIVEKIT_GCE_IP:7880"
    "LIVE_FALLBACK_ENABLED" = "true"
    "LIVE_RECORDING_ENABLED" = "true"
    "LOG_FORMAT" = "json"
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
    "PORT" = "8080"
    "PUBLIC_BASE_URL" = "https://cdn.yukpomnang.com"
    "RATE_LIMIT_IP" = "200"
    "RENDERER_S3_UPLOAD" = "true"
    "REQUEST_TIMEOUT" = "30"
    "RUST_LOG" = "info"
    "S3_BUCKET" = "yukpomnang-media-prod"
    "S3_ENDPOINT" = ""
    "S3_FORCE_PATH_STYLE" = "false"
    "S3_REGION" = "us-east-1"
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
    "SQLX_OFFLINE" = "true"
    "SRS_HLS_URL" = "http://LIVEKIT_GCE_IP:8080/live"
    "SRS_RTMP_URL" = "rtmp://LIVEKIT_GCE_IP:1935/live"
    "UPLOAD_BASE_URL" = "https://cdn.yukpomnang.com"
    "UPLOAD_STORAGE_PATH" = "/var/data/uploads"
    "VIDEO_ANALYSIS_TIMEOUT_SECONDS" = "180"
    "VIDEO_GENERATION_TIMEOUT_SECONDS" = "600"
    "VIDEO_RENDERER_ENABLE_GPU" = "true"
    "VIDEO_RENDERER_MAX_RETRIES" = "2"
    "VIDEO_RENDERER_PROJECT_ROOT" = "/srv/yukpo/video-renderer"
    "VIDEO_RENDERER_RPC_URL" = "http://34.140.79.59:8080/render"
    "VIDEO_RENDERER_SHARED_VOLUME" = "/srv/yukpo/jobs"
    "VIDEO_RENDERER_TIMEOUT_SECS" = "900"
    "YOUTUBE_REDIRECT_URI" = "https://yukpomnang.onrender.com/api/social/youtube/callback"
    "YUKPO_IMMO_COMMISSION_RATE" = "0.05"
    "global_promo_catalog_cache" = "60"
    "LAUNCH_PHASE_START_DATE" = "2026-02-10T00:00:00Z"
    "CLOUD_RUN" = "true"
    "APP_ENV" = "production"
    "ENABLE_AUTO_MIGRATIONS" = "true"
}

# Secrets (sensibles - à créer dans Secret Manager)
$secrets = @{
    "DATABASE_URL" = "postgresql://yukpo_db_user:88X47ZWBiLkX5WatFcLU4KQ4rgaHYml4@dpg-d2t7ntbuibrs73eh9tvg-a/yukpo_db"
    "REDIS_URL" = "rediss://default:ASMJAAImcDIxMmNlMGQ2Y2VmODE0NWU3OTA2ZWE2NThmOTIwNWZiZnAyODk2OQ@quiet-crawdad-8969.upstash.io:6379"
    "JWT_SECRET" = "0c37c2b6ac75e4fff6c9339c3bdcdd81"
    "MONGODB_URL" = "mongodb+srv://yukpomnang:DENQG9aru56Ixaqi@cluster1.arqkgsd.mongodb.net/?retryWrites=true&w=majority&appName=Cluster1"
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
    "S3_ACCESS_KEY" = "[REDACTED]"
    "S3_SECRET_KEY" = "[REDACTED]"
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

# Mapping des secrets vers les noms GCP Secret Manager
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
# FONCTIONS
# ============================================

function Get-GcpSecret {
    param([string]$SecretName)
    
    $result = gcloud secrets describe $SecretName --project=$GcpProjectId 2>&1
    if ($LASTEXITCODE -eq 0) {
        return $true
    }
    return $false
}

function Get-GcpEnvVar {
    param([string]$VarName)
    
    $serviceConfig = gcloud run services describe $GcpServiceName `
        --region=$GcpRegion `
        --project=$GcpProjectId `
        --format=json 2>&1 | ConvertFrom-Json
    
    if ($LASTEXITCODE -ne 0) {
        return $null
    }
    
    foreach ($envVar in $serviceConfig.spec.template.spec.containers[0].env) {
        if ($envVar.name -eq $VarName) {
            return $envVar.value
        }
    }
    return $null
}

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
# VÉRIFICATION ET CRÉATION
# ============================================

Write-Host "📥 Vérification des secrets dans GCP..." -ForegroundColor Cyan
Write-Host ""

$missingSecrets = @()
$secretsToCreate = @{}

foreach ($secretName in $secrets.Keys) {
    $gcpSecretName = $secretMapping[$secretName]
    Write-Host "🔍 Vérification secret: $secretName → $gcpSecretName" -ForegroundColor Cyan
    
    if (Get-GcpSecret -SecretName $gcpSecretName) {
        Write-Host "  ✅ Secret '$gcpSecretName' existe" -ForegroundColor Green
    } else {
        Write-Host "  ❌ Secret '$gcpSecretName' MANQUANT" -ForegroundColor Red
        $missingSecrets += $gcpSecretName
        $secretsToCreate[$gcpSecretName] = @{
            OriginalName = $secretName
            Value = $secrets[$secretName]
        }
    }
}

Write-Host ""
Write-Host "📥 Vérification des variables d'environnement dans GCP..." -ForegroundColor Cyan
Write-Host ""

$missingVars = @()
$varsToUpdate = @{}

# Vérifier LAUNCH_PHASE_START_DATE en premier (critique)
Write-Host "⭐ Vérification LAUNCH_PHASE_START_DATE (CRITIQUE)..." -ForegroundColor Yellow
$launchPhaseValue = Get-GcpEnvVar -VarName "LAUNCH_PHASE_START_DATE"
if ($launchPhaseValue) {
    Write-Host "  ✅ LAUNCH_PHASE_START_DATE existe: $launchPhaseValue" -ForegroundColor Green
    if ($launchPhaseValue -ne $allVariables["LAUNCH_PHASE_START_DATE"]) {
        Write-Host "  ⚠️  Valeur différente, sera mise à jour" -ForegroundColor Yellow
        $varsToUpdate["LAUNCH_PHASE_START_DATE"] = $allVariables["LAUNCH_PHASE_START_DATE"]
    }
} else {
    Write-Host "  ❌ LAUNCH_PHASE_START_DATE MANQUANTE (CRITIQUE!)" -ForegroundColor Red
    $missingVars += "LAUNCH_PHASE_START_DATE"
    $varsToUpdate["LAUNCH_PHASE_START_DATE"] = $allVariables["LAUNCH_PHASE_START_DATE"]
}
Write-Host ""

foreach ($varName in $allVariables.Keys) {
    if ($varName -eq "LAUNCH_PHASE_START_DATE") { continue }  # Déjà vérifié
    
    $currentValue = Get-GcpEnvVar -VarName $varName
    if ($currentValue) {
        if ($currentValue -ne $allVariables[$varName]) {
            Write-Host "  ⚠️  Variable '$varName' existe mais valeur différente" -ForegroundColor Yellow
            $varsToUpdate[$varName] = $allVariables[$varName]
        }
    } else {
        Write-Host "  ❌ Variable '$varName' MANQUANTE" -ForegroundColor Red
        $missingVars += $varName
        $varsToUpdate[$varName] = $allVariables[$varName]
    }
}

Write-Host ""

# ============================================
# CRÉATION DES SECRETS
# ============================================

if ($missingSecrets.Count -gt 0) {
    Write-Host "📤 Création des secrets manquants..." -ForegroundColor Cyan
    Write-Host ""
    
    foreach ($gcpSecretName in $missingSecrets) {
        $secret = $secretsToCreate[$gcpSecretName]
        Write-Host "🔐 Création secret: $gcpSecretName" -ForegroundColor Cyan
        if (Create-GcpSecret -SecretName $gcpSecretName -SecretValue $secret.Value) {
            Write-Host "  ✅ Secret créé" -ForegroundColor Green
        } else {
            Write-Host "  ❌ Erreur lors de la création" -ForegroundColor Red
        }
    }
    Write-Host ""
}

# ============================================
# MISE À JOUR CLOUD RUN
# ============================================

if ($missingVars.Count -gt 0 -or $varsToUpdate.Count -gt 0 -or $missingSecrets.Count -gt 0) {
    Write-Host "📤 Mise à jour Cloud Run..." -ForegroundColor Cyan
    Write-Host ""
    
    # Construire la liste des variables d'environnement
    $envVarsList = @()
    foreach ($key in $allVariables.Keys) {
        if ($varsToUpdate.ContainsKey($key)) {
            $envVarsList += "$key=$($varsToUpdate[$key])"
        } elseif (-not $missingVars.Contains($key)) {
            # Garder les variables existantes
            $currentValue = Get-GcpEnvVar -VarName $key
            if ($currentValue) {
                $envVarsList += "$key=$currentValue"
            } else {
                $envVarsList += "$key=$($allVariables[$key])"
            }
        } else {
            $envVarsList += "$key=$($allVariables[$key])"
        }
    }
    $envVarsStr = $envVarsList -join ","
    
    # Construire la liste des secrets
    $secretsList = @()
    foreach ($secretName in $secrets.Keys) {
        $gcpSecretName = $secretMapping[$secretName]
        $secretsList += "$secretName=$gcpSecretName:latest"
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
    
    if (-not $DryRun) {
        Write-Host "Exécution..." -ForegroundColor Cyan
        Invoke-Expression $updateCmd
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Cloud Run mis à jour avec succès!" -ForegroundColor Green
        } else {
            Write-Host "❌ Erreur lors de la mise à jour" -ForegroundColor Red
        }
    } else {
        Write-Host "[DRY RUN] Commande non exécutée" -ForegroundColor Gray
    }
} else {
    Write-Host "✅ Toutes les variables sont déjà configurées!" -ForegroundColor Green
}

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "📊 RÉSUMÉ" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "✅ Secrets vérifiés: $($secrets.Count)" -ForegroundColor Green
Write-Host "✅ Variables vérifiées: $($allVariables.Count)" -ForegroundColor Green
Write-Host "⭐ LAUNCH_PHASE_START_DATE: $($allVariables['LAUNCH_PHASE_START_DATE'])" -ForegroundColor Cyan
Write-Host ""
Write-Host "Prochaines étapes:" -ForegroundColor Yellow
Write-Host "  1. Vérifier les logs Cloud Run"
Write-Host "  2. Vérifier que LAUNCH_PHASE_START_DATE est bien chargée"
Write-Host "  3. Tester l application"
Write-Host ""

