# Script pour générer gcp-env-vars.json avec toutes les variables adaptées pour GCP
# Usage: .\scripts\generate-gcp-env-vars.ps1

param(
    [string]$ProjectId = "yukpo-project",
    [string]$Region = "europe-west1",
    [string]$CdnUrl = "http://34.54.117.97",
    [string]$DatabaseUrl = "postgresql://yukpo_admin:***@34.79.29.219:5432/yukpo_db?sslmode=require"
)

Write-Host "Generation du fichier gcp-env-vars.json..." -ForegroundColor Yellow

# Variables de base adaptées pour GCP
$envVars = @{
    # Database
    DATABASE_URL = $DatabaseUrl
    DATABASE_READ_REPLICA_URL = $DatabaseUrl
    DATABASE_TIMEOUT = "30"
    DB_POOL_SIZE = "10"
    DB_POOL_MIN_SIZE = "5"
    DB_ACQUIRE_TIMEOUT_SECS = "30"
    DB_HEALTH_CHECK_INTERVAL_SECS = "60"
    
    # Storage/CDN
    S3_BUCKET = "$ProjectId-yukpo-backend-media"
    S3_REGION = $Region
    S3_ACCESS_KEY = "cloud-storage-sa@${ProjectId}.iam.gserviceaccount.com"
    S3_SECRET_KEY = "[A_CONFIGURER_AVEC_CLE_SERVICE_ACCOUNT]"
    S3_ENDPOINT = "https://storage.googleapis.com"
    S3_FORCE_PATH_STYLE = "false"
    UPLOAD_BASE_URL = $CdnUrl
    PUBLIC_BASE_URL = $CdnUrl
    UPLOAD_STORAGE_PATH = "uploads"
    
    # Application
    ENVIRONMENT = "production"
    APP_ENV = "production"
    PORT = "8080"
    HOST = "0.0.0.0"
    RUST_LOG = "info"
    LOG_FORMAT = "json"
    ALLOWED_ORIGINS = "https://api.yukpo.com,https://yukpo.com"
    APP_BASE_URL = "https://api.yukpo.com"
    
    # Migrations
    ENABLE_AUTO_MIGRATIONS = "true"
    SQLX_OFFLINE = "true"
    
    # Launch Phase
    LAUNCH_PHASE_START_DATE = "2026-02-12T15:52:30Z"
    FREE_PRODUCT_CREATION_PERIOD_MONTHS = "3"
    
    # JWT
    JWT_SECRET = "[A_RECUPERER_DEPUIS_AWS]"
    JWT_EXPIRATION_HOURS = "24"
    
    # Redis (à adapter vers Cloud Memorystore)
    REDIS_URL = "[A_ADAPTER_VERS_CLOUD_MEMORYSTORE]"
    REDIS_CLUSTER_NODES = ""
    
    # API Configuration
    API_MAX_PAYLOAD_SIZE = "10485760"
    API_RATE_LIMIT_PER_MINUTE = "100"
    API_REQUEST_TIMEOUT = "30"
    REQUEST_TIMEOUT = "30"
    
    # Cache
    CACHE_DEFAULT_TTL = "3600"
    CACHE_TTL_SEARCH = "1800"
    SEMANTIC_CACHE_THRESHOLD = "0.85"
    
    # Search
    SEARCH_MAX_RESULTS = "50"
    SEARCH_DEFAULT_RADIUS_KM = "10"
    SEARCH_DEFAULT_LANGUAGE = "fr"
    SEARCH_TITLE_BOOST = "2.0"
    
    # Email
    EMAIL_ENABLED = "true"
    EMAIL_PROVIDER = "sendgrid"
    SENDGRID_API_KEY = "[A_RECUPERER_DEPUIS_AWS]"
    SENDGRID_FROM_EMAIL = "noreply@yukpo.com"
    SENDGRID_FROM_NAME = "Yukpo"
    
    # SMS
    SMS_ENABLED = "true"
    SMS_PROVIDER = "twilio"
    TWILIO_ACCOUNT_SID = "[A_RECUPERER_DEPUIS_AWS]"
    TWILIO_AUTH_TOKEN = "[A_RECUPERER_DEPUIS_AWS]"
    TWILIO_FROM_NUMBER = "[A_RECUPERER_DEPUIS_AWS]"
    
    # Payment
    MTN_MONEY_ENABLED = "true"
    MTN_MONEY_API_KEY = "[A_RECUPERER_DEPUIS_AWS]"
    MTN_MONEY_API_SECRET = "[A_RECUPERER_DEPUIS_AWS]"
    MTN_MONEY_MERCHANT_ID = "[A_RECUPERER_DEPUIS_AWS]"
    MTN_MONEY_ENVIRONMENT = "production"
    
    ORANGE_MONEY_ENABLED = "true"
    ORANGE_MONEY_API_KEY = "[A_RECUPERER_DEPUIS_AWS]"
    ORANGE_MONEY_API_SECRET = "[A_RECUPERER_DEPUIS_AWS]"
    ORANGE_MONEY_MERCHANT_ID = "[A_RECUPERER_DEPUIS_AWS]"
    ORANGE_MONEY_ENVIRONMENT = "production"
    
    # AI/ML
    OPENAI_API_KEY = "[A_RECUPERER_DEPUIS_AWS]"
    EMBEDDING_API_KEY = "[A_RECUPERER_DEPUIS_AWS]"
    EMBEDDING_TIMEOUT_SECONDS = "30"
    EMBEDDING_MAX_RETRIES = "3"
    AI_REQUEST_TIMEOUT_SECONDS = "60"
    ENABLE_AI_OPTIMIZATIONS = "true"
    
    # Video
    VIDEO_GENERATION_TIMEOUT_SECONDS = "300"
    VIDEO_RENDERER_RPC_URL = "[A_RECUPERER_DEPUIS_AWS]"
    VIDEO_RENDERER_RPC_TOKEN = "[A_RECUPERER_DEPUIS_AWS]"
    VIDEO_RENDERER_TIMEOUT_SECS = "600"
    VIDEO_RENDERER_MAX_RETRIES = "3"
    VIDEO_RENDERER_ENABLE_GPU = "true"
    VIDEO_RENDERER_PROJECT_ROOT = "/app"
    VIDEO_RENDERER_SHARED_VOLUME = "/shared"
    VIDEO_ANALYSIS_TIMEOUT_SECONDS = "60"
    
    # Audio
    AUDIO_SYNC_TIMEOUT_SECONDS = "30"
    AUPHONIC_API_KEY = "[A_RECUPERER_DEPUIS_AWS]"
    AUPHONIC_USERNAME = "[A_RECUPERER_DEPUIS_AWS]"
    AUPHONIC_PRESET = "default"
    AUPHONIC_OUTPUT_FORMAT = "mp3"
    AUPHONIC_BASE_URL = "https://auphonic.com"
    AUPHONIC_POLL_INTERVAL_SECS = "5"
    
    # Media
    MAX_IMAGE_SIZE_MB = "10"
    MAX_VIDEO_SIZE_MB = "500"
    MAX_AUDIO_SIZE_MB = "50"
    MAX_DOC_SIZE_MB = "20"
    MAX_EXCEL_SIZE_MB = "10"
    
    # Live Streaming
    LIVEKIT_API_KEY = "[A_RECUPERER_DEPUIS_AWS]"
    LIVEKIT_API_SECRET = "[A_RECUPERER_DEPUIS_AWS]"
    LIVEKIT_API_URL = "[A_RECUPERER_DEPUIS_AWS]"
    LIVEKIT_WS_URL = "[A_RECUPERER_DEPUIS_AWS]"
    LIVEKIT_HLS_URL = "[A_RECUPERER_DEPUIS_AWS]"
    LIVEKIT_INGRESS_MODE = "rtmp"
    LIVEKIT_INGRESS_NAME = "yukpo-ingress"
    LIVEKIT_INGRESS_REGION = $Region
    LIVEKIT_INGRESS_ROOM = "yukpo-room"
    LIVE_RECORDING_ENABLED = "true"
    LIVE_FALLBACK_ENABLED = "true"
    
    # SRS
    SRS_RTMP_URL = "[A_RECUPERER_DEPUIS_AWS]"
    SRS_HLS_URL = "[A_RECUPERER_DEPUIS_AWS]"
    
    # Delivery
    DELIVERY_MATCHING_WORKER_INTERVAL_SECS = "60"
    DELIVERY_MATCHING_WORKER_PARALLEL = "4"
    DELIVERY_MATCHING_WORKER_BATCH_SIZE = "10"
    DELIVERY_MATCHING_EMPTY_CACHE_TTL_SECS = "300"
    DELIVERY_PENDING_TIMEOUT_MINUTES = "30"
    DELIVERY_TIMEOUT_MONITOR_INTERVAL_SECS = "60"
    MATCHING_MIN_SCORE_THRESHOLD = "0.7"
    
    # SLA
    SLA_PROMISED_MINUTES = "30"
    SLA_MONITOR_INTERVAL_SECONDS = "60"
    SLA_LOOKBACK_MINUTES = "60"
    SLA_THRESHOLD_RATIO = "0.9"
    SLA_ALERT_WEBHOOK = "[A_RECUPERER_DEPUIS_AWS]"
    
    # Pipeline
    PIPELINE_HEALTH_CHECK_INTERVAL_SECS = "30"
    PIPELINE_ALERT_WEBHOOK = "[A_RECUPERER_DEPUIS_AWS]"
    
    # Order
    ORDER_TIMEOUT_MONITOR_INTERVAL_SECS = "60"
    
    # GPU
    GPU_AVAILABLE = "true"
    GPU_TYPE = "nvidia"
    GPU_MEMORY_GB = "8"
    NVIDIA_VISIBLE_DEVICES = "0"
    CUDA_VISIBLE_DEVICES = "0"
    AMD_GPU_AVAILABLE = "false"
    
    # Blender
    BLENDER_PATH = "/usr/bin/blender"
    BLENDER_USE_GPU = "true"
    BLENDER_RENDER_SAMPLES = "128"
    
    # ML Models
    ML_MODELS_DIR = "/app/models"
    
    # Other APIs
    GOOGLE_MAPS_API_KEY = "[A_RECUPERER_DEPUIS_AWS]"
    GOOGLE_TRANSLATE_API_KEY = "[A_RECUPERER_DEPUIS_AWS]"
    GOOGLE_CLIENT_ID = "[A_RECUPERER_DEPUIS_AWS]"
    GOOGLE_REDIRECT_URI = "[A_RECUPERER_DEPUIS_AWS]"
    YOUTUBE_CLIENT_ID = "[A_RECUPERER_DEPUIS_AWS]"
    YOUTUBE_CLIENT_SECRET = "[A_RECUPERER_DEPUIS_AWS]"
    YOUTUBE_REDIRECT_URI = "[A_RECUPERER_DEPUIS_AWS]"
    PIXABAY_API_KEY = "[A_RECUPERER_DEPUIS_AWS]"
    PEXELS_API_KEY = "[A_RECUPERER_DEPUIS_AWS]"
    UNSPLASH_ACCESS_KEY = "[A_RECUPERER_DEPUIS_AWS]"
    SORA_API_KEY = "[A_RECUPERER_DEPUIS_AWS]"
    OPENWEATHERMAP_API_KEY = "[A_RECUPERER_DEPUIS_AWS]"
    GEONAMES_USERNAME = "[A_RECUPERER_DEPUIS_AWS]"
    KYC_PROVIDER = "[A_RECUPERER_DEPUIS_AWS]"
    
    # Other
    INSTANCE_ID = "yukpo-gcp-1"
    RATE_LIMIT_IP = "100"
    GLOBAL_PROMO_SCHEDULER_INTERVAL_SECS = "3600"
    RENDERER_S3_UPLOAD = "true"
    AR_RENDER_OUTPUT_DIR = "/app/renders"
    COLOR_GRADING_TIMEOUT_SECONDS = "300"
    YUKPO_API_KEY = "[A_RECUPERER_DEPUIS_AWS]"
    YUKPO_IMMO_COMMISSION_RATE = "0.05"
    ENABLE_STAGING_DEMO_SEED = "false"
    global_promo_catalog_cache = "true"
}

# Sauvegarder dans gcp-env-vars.json
$envVars | ConvertTo-Json -Depth 10 | Out-File -FilePath "gcp-env-vars.json" -Encoding UTF8

Write-Host "Fichier gcp-env-vars.json genere avec $($envVars.Count) variables" -ForegroundColor Green
Write-Host ""
Write-Host "ATTENTION: Certaines variables contiennent [A_RECUPERER_DEPUIS_AWS]" -ForegroundColor Yellow
Write-Host "Relancez migrate-to-gcp-complete.ps1 pour recuperer toutes les valeurs depuis AWS" -ForegroundColor Yellow
Write-Host ""

