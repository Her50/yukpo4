# 🔧 Script de Configuration des Variables d'Environnement AWS
# Transfère et configure toutes les variables depuis Render vers AWS SSM Parameter Store

param(
    [string]$Region = "eu-west-1",
    [string]$Path = "/yukpo/production"
)

Write-Host "🔧 Configuration des Variables d'Environnement AWS" -ForegroundColor Cyan
Write-Host "Région: $Region" -ForegroundColor Yellow
Write-Host "Chemin SSM: $Path" -ForegroundColor Yellow
Write-Host ""

# Fonction pour créer/mettre à jour un paramètre SSM
function Set-SSMParameter {
    param(
        [string]$Name,
        [string]$Value,
        [string]$Type = "String"
    )
    
    $fullName = "$Path/$Name"
    
    try {
        $escapedValue = $Value -replace '"', '\"'
        aws ssm put-parameter --name $fullName --value $escapedValue --type $Type --region $Region --overwrite | Out-Null
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "   ✅ $Name" -ForegroundColor Green
            return $true
        } else {
            Write-Host "   ❌ $Name (erreur)" -ForegroundColor Red
            return $false
        }
    } catch {
        Write-Host "   ❌ $Name : $_" -ForegroundColor Red
        return $false
    }
}

# ⚠️ ATTENTION : Ces valeurs doivent être récupérées depuis Terraform outputs
# Exécutez d'abord : terraform output -json > terraform-outputs.json
Write-Host "📋 Étape 1: Récupération des valeurs AWS depuis Terraform..." -ForegroundColor Cyan

# Récupérer les outputs Terraform
$terraformOutputs = @{}
try {
    $outputs = terraform -chdir=infra/aws output -json 2>$null | ConvertFrom-Json
    if ($outputs) {
        $terraformOutputs.database_url = $outputs.database_url.value
        $terraformOutputs.redis_url = $outputs.redis_url.value
        $terraformOutputs.rds_endpoint = $outputs.rds_endpoint.value
        $terraformOutputs.redis_endpoint = $outputs.redis_endpoint.value
        Write-Host "   ✅ Outputs Terraform récupérés" -ForegroundColor Green
    }
} catch {
    Write-Host "   ⚠️  Impossible de récupérer les outputs Terraform" -ForegroundColor Yellow
    Write-Host "   Utilisez les valeurs manuelles ci-dessous" -ForegroundColor Yellow
}

# Si les outputs ne sont pas disponibles, essayer de recuperer depuis AWS directement
if (-not $terraformOutputs.database_url) {
    Write-Host "   Tentative de recuperation RDS depuis AWS..." -ForegroundColor Yellow
    try {
        # Recuperer l'endpoint RDS
        $rdsQuery = 'DBInstances[?DBInstanceIdentifier==`yukpo-rds`].Endpoint.Address'
        $rds_endpoint = aws rds describe-db-instances --region $Region --query $rdsQuery --output text 2>$null
        
        if ($rds_endpoint) {
            # Lire les valeurs depuis terraform.tfvars (methode simple)
            $tfvarsContent = Get-Content infra/aws/terraform.tfvars -Raw
            if ($tfvarsContent -match 'rds_username\s*=\s*"([^"]+)"') {
                $rds_username = $matches[1]
            }
            if ($tfvarsContent -match 'rds_password\s*=\s*"([^"]+)"') {
                $rds_password = $matches[1]
            }
            if ($tfvarsContent -match 'rds_database_name\s*=\s*"([^"]+)"') {
                $rds_database_name = $matches[1]
            }
            
            if ($rds_username -and $rds_password -and $rds_database_name -and $rds_endpoint) {
                $terraformOutputs.database_url = "postgresql://${rds_username}:${rds_password}@${rds_endpoint}/${rds_database_name}"
                Write-Host "   DATABASE_URL construit depuis AWS" -ForegroundColor Green
            }
        }
    } catch {
        Write-Host "   Avertissement: Impossible de recuperer automatiquement DATABASE_URL" -ForegroundColor Yellow
        Write-Host "   Vous devrez le configurer manuellement" -ForegroundColor Yellow
    }
}

if (-not $terraformOutputs.redis_url) {
    # Récupérer l'endpoint Redis depuis AWS
    try {
        $query = "ReplicationGroups[0].NodeGroups[0].PrimaryEndpoint.Address"
        $redis_endpoint = aws elasticache describe-replication-groups --region $Region --replication-group-id "yukpo-redis" --query $query --output text
        
        if ($redis_endpoint) {
            $terraformOutputs.redis_url = "redis://${redis_endpoint}:6379"
        }
    } catch {
        Write-Host "   ⚠️  Impossible de récupérer l'endpoint Redis" -ForegroundColor Yellow
    }
}

Write-Host ""

# 📋 Étape 2: Configuration des Variables AWS (à mettre à jour)
Write-Host "📋 Étape 2: Configuration des Variables AWS..." -ForegroundColor Cyan

# DATABASE_URL - Nouvelle URL RDS AWS
if ($terraformOutputs.database_url) {
    Set-SSMParameter -Name "DATABASE_URL" -Value $terraformOutputs.database_url -Type "SecureString"
} else {
    Write-Host "   ⚠️  DATABASE_URL non configuré (à faire manuellement)" -ForegroundColor Yellow
}

# REDIS_URL - Nouvelle URL ElastiCache AWS
if ($terraformOutputs.redis_url) {
    Set-SSMParameter -Name "REDIS_URL" -Value $terraformOutputs.redis_url -Type "SecureString"
} else {
    Write-Host "   ⚠️  REDIS_URL non configuré (à faire manuellement)" -ForegroundColor Yellow
}

# S3 Configuration - Nouvelles valeurs AWS S3
$s3_bucket = "yukpo-backend-media"
$s3_region = $Region
# Récupérer les credentials S3 depuis l'utilisateur IAM créé
# Ces valeurs doivent être récupérées depuis AWS IAM ou configurées manuellement
$s3_access_key = ""  # À récupérer depuis AWS IAM user yukpo-s3-media
$s3_secret_key = ""  # À récupérer depuis AWS IAM user yukpo-s3-media

Set-SSMParameter -Name "S3_BUCKET" -Value $s3_bucket
Set-SSMParameter -Name "S3_REGION" -Value $s3_region
Set-SSMParameter -Name "S3_ENDPOINT" -Value ""  # Vide pour AWS S3 standard
Set-SSMParameter -Name "S3_FORCE_PATH_STYLE" -Value "false"

if ($s3_access_key -and $s3_secret_key) {
    Set-SSMParameter -Name "S3_ACCESS_KEY" -Value $s3_access_key -Type "SecureString"
    Set-SSMParameter -Name "S3_SECRET_KEY" -Value $s3_secret_key -Type "SecureString"
} else {
    Write-Host "   ⚠️  S3_ACCESS_KEY et S3_SECRET_KEY non configurés (à faire manuellement)" -ForegroundColor Yellow
}

# UPLOAD_BASE_URL - Nouvelle URL S3 AWS
$upload_base_url = "https://${s3_bucket}.s3.${s3_region}.amazonaws.com"
Set-SSMParameter -Name "UPLOAD_BASE_URL" -Value $upload_base_url

Write-Host ""

# 📋 Étape 3: Configuration des Variables GPU (DÉSACTIVÉES - Fargate ne supporte pas GPU)
Write-Host "📋 Étape 3: Configuration GPU (DÉSACTIVÉES pour AWS ECS Fargate)..." -ForegroundColor Cyan

Set-SSMParameter -Name "GPU_AVAILABLE" -Value "false"
Set-SSMParameter -Name "AMD_GPU_AVAILABLE" -Value "false"
Set-SSMParameter -Name "BLENDER_USE_GPU" -Value "false"
Set-SSMParameter -Name "VIDEO_RENDERER_ENABLE_GPU" -Value "false"
Set-SSMParameter -Name "CUDA_VISIBLE_DEVICES" -Value ""
Set-SSMParameter -Name "NVIDIA_VISIBLE_DEVICES" -Value ""

Write-Host "   Info: GPU desactive car AWS ECS Fargate ne supporte pas GPU" -ForegroundColor Yellow
Write-Host "   Info: Pour utiliser GPU, migrez vers EC2 avec instances GPU" -ForegroundColor Yellow

Write-Host ""

# 📋 Étape 4: Variables depuis Render (à transférer telles quelles)
Write-Host "📋 Étape 4: Transfert des Variables depuis Render..." -ForegroundColor Cyan

# Variables de configuration générale
Set-SSMParameter -Name "ENVIRONMENT" -Value "production"
Set-SSMParameter -Name "RUST_LOG" -Value "debug"
Set-SSMParameter -Name "LOG_FORMAT" -Value "json"
Set-SSMParameter -Name "HOST" -Value "0.0.0.0"
Set-SSMParameter -Name "PORT" -Value "3001"
Set-SSMParameter -Name "INSTANCE_ID" -Value "backend-aws-1"

# Variables API
Set-SSMParameter -Name "API_MAX_PAYLOAD_SIZE" -Value "10485760"
Set-SSMParameter -Name "API_RATE_LIMIT_PER_MINUTE" -Value "100"
Set-SSMParameter -Name "API_REQUEST_TIMEOUT" -Value "30"
Set-SSMParameter -Name "REQUEST_TIMEOUT" -Value "30"
Set-SSMParameter -Name "RATE_LIMIT_IP" -Value "200"

# Variables Base de données
Set-SSMParameter -Name "DATABASE_TIMEOUT" -Value "10"
Set-SSMParameter -Name "DATABASE_READ_REPLICA_URL" -Value ""
Set-SSMParameter -Name "DB_ACQUIRE_TIMEOUT_SECS" -Value "15"
Set-SSMParameter -Name "DB_HEALTH_CHECK_INTERVAL_SECS" -Value "30"
Set-SSMParameter -Name "DB_POOL_MIN_SIZE" -Value "10"
Set-SSMParameter -Name "DB_POOL_SIZE" -Value "100"

# Variables Redis
Set-SSMParameter -Name "REDIS_CLUSTER_NODES" -Value ""
Set-SSMParameter -Name "CACHE_DEFAULT_TTL" -Value "3600"
Set-SSMParameter -Name "CACHE_TTL_SEARCH" -Value "600"

# Variables JWT
Set-SSMParameter -Name "JWT_SECRET" -Value "0c37c2b6ac75e4fff6c9339c3bdcdd81" -Type "SecureString"
Set-SSMParameter -Name "JWT_EXPIRATION_HOURS" -Value "24"

# Variables MongoDB (externe)
$mongodb_url = 'mongodb+srv://yukpomnang:DENQG9aru56Ixaqi@cluster1.arqkgsd.mongodb.net/?retryWrites=true&w=majority&appName=Cluster1'
Set-SSMParameter -Name "MONGODB_URL" -Value $mongodb_url -Type "SecureString"

# Variables IA
Set-SSMParameter -Name "OPENAI_API_KEY" -Value "YOUR_OPENAI_API_KEY_HERE" -Type "SecureString"
Set-SSMParameter -Name "SORA_API_KEY" -Value "YOUR_SORA_API_KEY_HERE" -Type "SecureString"
Set-SSMParameter -Name "AI_REQUEST_TIMEOUT_SECONDS" -Value "120"
Set-SSMParameter -Name "ENABLE_AI_OPTIMIZATIONS" -Value "true"
Set-SSMParameter -Name "EMBEDDING_API_KEY" -Value "yukpo_embedding_key_2024" -Type "SecureString"
Set-SSMParameter -Name "EMBEDDING_MAX_RETRIES" -Value "3"
Set-SSMParameter -Name "EMBEDDING_TIMEOUT_SECONDS" -Value "60"

# Variables Google
Set-SSMParameter -Name "GOOGLE_CLIENT_ID" -Value "YOUR_GOOGLE_CLIENT_ID_HERE"
Set-SSMParameter -Name "GOOGLE_MAPS_API_KEY" -Value "AIzaSyDFfWEq1Umm06SNTbR-cRhRQ5Sq_taEAWQ" -Type "SecureString"
Set-SSMParameter -Name "GOOGLE_TRANSLATE_API_KEY" -Value "AIzaSyDFfWEq1Umm06SNTbR-cRhRQ5Sq_taEAWQ" -Type "SecureString"

# Variables YouTube
Set-SSMParameter -Name "YOUTUBE_CLIENT_ID" -Value "YOUR_YOUTUBE_CLIENT_ID_HERE"
Set-SSMParameter -Name "YOUTUBE_CLIENT_SECRET" -Value "YOUR_YOUTUBE_CLIENT_SECRET_HERE" -Type "SecureString"
Set-SSMParameter -Name "YOUTUBE_REDIRECT_URI" -Value "https://yukpomnang.onrender.com/api/social/youtube/callback"

# Variables Email (SendGrid)
Set-SSMParameter -Name "EMAIL_ENABLED" -Value "true"
Set-SSMParameter -Name "EMAIL_PROVIDER" -Value "sendgrid"
Set-SSMParameter -Name "SENDGRID_API_KEY" -Value "your_sendgrid_api_key" -Type "SecureString"
Set-SSMParameter -Name "SENDGRID_FROM_EMAIL" -Value "noreply@yukpomnang.com"
Set-SSMParameter -Name "SENDGRID_FROM_NAME" -Value "Yukpomnang"

# Variables SMS (Twilio)
Set-SSMParameter -Name "SMS_ENABLED" -Value "true"
Set-SSMParameter -Name "SMS_PROVIDER" -Value "twilio"
Set-SSMParameter -Name "TWILIO_ACCOUNT_SID" -Value "your_account_sid" -Type "SecureString"
Set-SSMParameter -Name "TWILIO_AUTH_TOKEN" -Value "your_auth_token" -Type "SecureString"
Set-SSMParameter -Name "TWILIO_FROM_NUMBER" -Value "+1234567890"

# Variables LiveKit
Set-SSMParameter -Name "LIVEKIT_API_KEY" -Value "APIPHE9xDv5RPaP" -Type "SecureString"
Set-SSMParameter -Name "LIVEKIT_API_SECRET" -Value "qVRL18gIk8W3Dp8V4Wu23I99t0XbZ5pM66D9i5MTTkE" -Type "SecureString"
Set-SSMParameter -Name "LIVEKIT_API_URL" -Value "http://46.224.14.85:7880"
Set-SSMParameter -Name "LIVEKIT_WS_URL" -Value "ws://46.224.14.85:7880"
Set-SSMParameter -Name "LIVEKIT_HLS_URL" -Value "http://46.224.14.85:8080/live"
Set-SSMParameter -Name "LIVEKIT_INGRESS_MODE" -Value "rtmp"
Set-SSMParameter -Name "LIVEKIT_INGRESS_NAME" -Value "prod-ingress-1"
Set-SSMParameter -Name "LIVEKIT_INGRESS_REGION" -Value "eu-central"
Set-SSMParameter -Name "LIVEKIT_INGRESS_ROOM" -Value "live-events"
Set-SSMParameter -Name "LIVE_FALLBACK_ENABLED" -Value "true"
Set-SSMParameter -Name "LIVE_RECORDING_ENABLED" -Value "true"

# Variables SRS
Set-SSMParameter -Name "SRS_HLS_URL" -Value "https://srs.46.224.14.85.sslip.io/live"
Set-SSMParameter -Name "SRS_RTMP_URL" -Value "rtmp://46.224.14.85:1935/live"

# Variables AUPHONIC
Set-SSMParameter -Name "AUPHONIC_API_KEY" -Value "AdxU2ktP7YfxzWd2N5JfMFDketxNRktq" -Type "SecureString"
Set-SSMParameter -Name "AUPHONIC_BASE_URL" -Value "https://api.auphonic.com"
Set-SSMParameter -Name "AUPHONIC_OUTPUT_FORMAT" -Value "wav"
Set-SSMParameter -Name "AUPHONIC_POLL_INTERVAL_SECS" -Value "5"
Set-SSMParameter -Name "AUPHONIC_PRESET" -Value "yukpo_preset"
Set-SSMParameter -Name "AUPHONIC_USERNAME" -Value "lelehernandez2007"

# Variables Blender (sans GPU)
Set-SSMParameter -Name "BLENDER_PATH" -Value "/usr/local/bin/blender"
Set-SSMParameter -Name "BLENDER_RENDER_SAMPLES" -Value "256"

# Variables Vidéo
Set-SSMParameter -Name "VIDEO_RENDERER_PROJECT_ROOT" -Value "/srv/yukpo/video-renderer"
Set-SSMParameter -Name "VIDEO_RENDERER_RPC_URL" -Value "http://46.224.14.85:8088/render"
Set-SSMParameter -Name "VIDEO_RENDERER_RPC_TOKEN" -Value "l-5nF6KwiPasSeCj2h_ixIevCZO2mLijLcJg6KNmP2UxAQGMSLD9RnRrBC_0mGhY" -Type "SecureString"
Set-SSMParameter -Name "VIDEO_RENDERER_SHARED_VOLUME" -Value "/srv/yukpo/jobs"
Set-SSMParameter -Name "VIDEO_RENDERER_TIMEOUT_SECS" -Value "900"
Set-SSMParameter -Name "VIDEO_RENDERER_MAX_RETRIES" -Value "2"
Set-SSMParameter -Name "VIDEO_GENERATION_TIMEOUT_SECONDS" -Value "600"
Set-SSMParameter -Name "VIDEO_ANALYSIS_TIMEOUT_SECONDS" -Value "180"
Set-SSMParameter -Name "AR_RENDER_OUTPUT_DIR" -Value "/tmp/ar_renders"
Set-SSMParameter -Name "RENDERER_S3_UPLOAD" -Value "true"
Set-SSMParameter -Name "AUDIO_SYNC_TIMEOUT_SECONDS" -Value "180"
Set-SSMParameter -Name "COLOR_GRADING_TIMEOUT_SECONDS" -Value "120"

# Variables Upload/Storage
Set-SSMParameter -Name "UPLOAD_STORAGE_PATH" -Value "/var/data/uploads"
Set-SSMParameter -Name "PUBLIC_BASE_URL" -Value "https://cdn.yukpomnang.com"
Set-SSMParameter -Name "MAX_IMAGE_SIZE_MB" -Value "10"
Set-SSMParameter -Name "MAX_VIDEO_SIZE_MB" -Value "50"
Set-SSMParameter -Name "MAX_AUDIO_SIZE_MB" -Value "10"
Set-SSMParameter -Name "MAX_DOC_SIZE_MB" -Value "10"
Set-SSMParameter -Name "MAX_EXCEL_SIZE_MB" -Value "5"

# Variables Recherche
Set-SSMParameter -Name "SEARCH_DEFAULT_LANGUAGE" -Value "fr"
Set-SSMParameter -Name "SEARCH_DEFAULT_RADIUS_KM" -Value "20"
Set-SSMParameter -Name "SEARCH_MAX_RESULTS" -Value "50"
Set-SSMParameter -Name "SEARCH_TITLE_BOOST" -Value "2.0"
Set-SSMParameter -Name "SEMANTIC_CACHE_THRESHOLD" -Value "0.85"
Set-SSMParameter -Name "MATCHING_MIN_SCORE_THRESHOLD" -Value "0.6"

# Variables Livraison
Set-SSMParameter -Name "DELIVERY_MATCHING_WORKER_INTERVAL_SECS" -Value "30"
Set-SSMParameter -Name "DELIVERY_MATCHING_WORKER_BATCH_SIZE" -Value "50"
Set-SSMParameter -Name "DELIVERY_MATCHING_WORKER_PARALLEL" -Value "3"
Set-SSMParameter -Name "DELIVERY_MATCHING_EMPTY_CACHE_TTL_SECS" -Value "30"
Set-SSMParameter -Name "DELIVERY_PENDING_TIMEOUT_MINUTES" -Value "60"
Set-SSMParameter -Name "DELIVERY_TIMEOUT_MONITOR_INTERVAL_SECS" -Value "60"

# Variables Commandes
Set-SSMParameter -Name "ORDER_TIMEOUT_MONITOR_INTERVAL_SECS" -Value "60"

# Variables Paiement Mobile Money
Set-SSMParameter -Name "MTN_MONEY_ENABLED" -Value "true"
Set-SSMParameter -Name "MTN_MONEY_ENVIRONMENT" -Value "sandbox|production"
Set-SSMParameter -Name "MTN_MONEY_API_KEY" -Value "..." -Type "SecureString"
Set-SSMParameter -Name "MTN_MONEY_API_SECRET" -Value "..." -Type "SecureString"
Set-SSMParameter -Name "MTN_MONEY_MERCHANT_ID" -Value "..." -Type "SecureString"

Set-SSMParameter -Name "ORANGE_MONEY_ENABLED" -Value "true"
Set-SSMParameter -Name "ORANGE_MONEY_ENVIRONMENT" -Value "sandbox|production"
Set-SSMParameter -Name "ORANGE_MONEY_API_KEY" -Value "..." -Type "SecureString"
Set-SSMParameter -Name "ORANGE_MONEY_API_SECRET" -Value "..." -Type "SecureString"
Set-SSMParameter -Name "ORANGE_MONEY_MERCHANT_ID" -Value "..." -Type "SecureString"

# Variables KYC
Set-SSMParameter -Name "KYC_PROVIDER" -Value "manual"

# Variables API Externes
Set-SSMParameter -Name "PEXELS_API_KEY" -Value "1ytrq9SUFeMBA68ieIw9rFio3zZCU8ch6355srswcZer6hnJaLPv5Jl8" -Type "SecureString"
Set-SSMParameter -Name "PIXABAY_API_KEY" -Value "53555366-49550f2da946ADC1e8e4F5B99" -Type "SecureString"
Set-SSMParameter -Name "UNSPLASH_ACCESS_KEY" -Value "iOBl0EgF7Um3QclokoYMV4aH2IkDyOoRuPYswWxrrSM" -Type "SecureString"
Set-SSMParameter -Name "OPENWEATHERMAP_API_KEY" -Value "59f12cb0fdcbbaeff46c93e716b66896" -Type "SecureString"
Set-SSMParameter -Name "GEONAMES_USERNAME" -Value "hernandezlele"

# Variables Application
Set-SSMParameter -Name "YUKPO_API_KEY" -Value "yukpo_embedding_key_2024" -Type "SecureString"
Set-SSMParameter -Name "YUKPO_IMMO_COMMISSION_RATE" -Value "0.05"
Set-SSMParameter -Name "ENABLE_STAGING_DEMO_SEED" -Value "true"
Set-SSMParameter -Name "SQLX_OFFLINE" -Value "true"

# Variables Monitoring/Webhooks
Set-SSMParameter -Name "PIPELINE_ALERT_WEBHOOK" -Value "YOUR_SLACK_WEBHOOK_URL_HERE" -Type "SecureString"
Set-SSMParameter -Name "PIPELINE_HEALTH_CHECK_INTERVAL_SECS" -Value "300"
Set-SSMParameter -Name "SLA_ALERT_WEBHOOK" -Value "YOUR_SLACK_WEBHOOK_URL_HERE" -Type "SecureString"
Set-SSMParameter -Name "SLA_MONITOR_INTERVAL_SECONDS" -Value "300"
Set-SSMParameter -Name "SLA_LOOKBACK_MINUTES" -Value "60"
Set-SSMParameter -Name "SLA_PROMISED_MINUTES" -Value "30"
Set-SSMParameter -Name "SLA_THRESHOLD_RATIO" -Value "1.10"

# Variables Globales
Set-SSMParameter -Name "GLOBAL_PROMO_SCHEDULER_INTERVAL_SECS" -Value "30"
Set-SSMParameter -Name "global_promo_catalog_cache" -Value "60"

# Variables ML
Set-SSMParameter -Name "ML_MODELS_DIR" -Value "models"

# Variables GPU Memory (même si GPU désactivé)
Set-SSMParameter -Name "GPU_MEMORY_GB" -Value "16"
Set-SSMParameter -Name "GPU_TYPE" -Value "nvidia"

Write-Host ""

# 📋 Étape 5: Variable LAUNCH_PHASE_START_DATE (NOUVELLE)
Write-Host "📋 Étape 5: Configuration Phase de Lancement..." -ForegroundColor Cyan

# Date de début de la phase de lancement (aujourd'hui par défaut)
$launch_start_date = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
Set-SSMParameter -Name "LAUNCH_PHASE_START_DATE" -Value $launch_start_date
Write-Host "   ✅ LAUNCH_PHASE_START_DATE: $launch_start_date" -ForegroundColor Green
Write-Host "   Info: Phase de lancement: 90 jours de creation gratuite" -ForegroundColor Yellow

Write-Host ""

# ✅ Résumé
Write-Host "✅ Configuration terminée !" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Variables configurées dans AWS SSM Parameter Store:" -ForegroundColor Cyan
Write-Host "   Chemin: $Path" -ForegroundColor Yellow
Write-Host "   Région: $Region" -ForegroundColor Yellow
Write-Host ""
Write-Host "⚠️  Actions manuelles requises:" -ForegroundColor Yellow
Write-Host "   1. Configurer S3_ACCESS_KEY et S3_SECRET_KEY depuis IAM user yukpo-s3-media" -ForegroundColor Yellow
Write-Host "   2. Vérifier DATABASE_URL et REDIS_URL si non récupérés automatiquement" -ForegroundColor Yellow
Write-Host "   3. Mettre à jour SENDGRID_API_KEY, TWILIO_* avec les vraies valeurs" -ForegroundColor Yellow
Write-Host "   4. Configurer les variables Mobile Money (MTN_MONEY_*, ORANGE_MONEY_*)" -ForegroundColor Yellow
Write-Host ""
Write-Host "🔍 Vérification:" -ForegroundColor Cyan
$verifyCmd = "aws ssm get-parameters-by-path --path $Path --region $Region --recursive --query Parameters[*].Name --output table"
Write-Host "   $verifyCmd" -ForegroundColor Gray

