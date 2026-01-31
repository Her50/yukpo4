# Script PowerShell pour mettre a jour toutes les variables d'environnement dans AWS SSM Parameter Store
# Usage: .\update_all_env_variables_aws.ps1

param(
    [string]$Region = "us-east-1",
    [string]$ParameterPrefix = "/yukpomnang/production",
    [string]$DbPassword = "",
    [string]$RdsEndpoint = "yukpomnang-db.cy3e2i84qr8y.us-east-1.rds.amazonaws.com",
    [string]$DbUser = "yukpo_db_user",
    [string]$DbName = "postgres",
    [int]$RdsPort = 5432
)

Write-Host "Script de Mise a Jour Complete des Variables d'Environnement AWS" -ForegroundColor Green
Write-Host ""

# Verifier que AWS CLI est installe
if (-not (Get-Command aws -ErrorAction SilentlyContinue)) {
    Write-Host "AWS CLI n'est pas installe" -ForegroundColor Red
    exit 1
}

# Verifier les credentials AWS
try {
    $null = aws sts get-caller-identity 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "AWS credentials non configurees"
    }
} catch {
    Write-Host "AWS credentials non configurees" -ForegroundColor Red
    exit 1
}

# 1. Utiliser les parametres fournis ou les valeurs par defaut
Write-Host "Configuration de la base de donnees PostgreSQL RDS..." -ForegroundColor Yellow
Write-Host "   Endpoint: $RdsEndpoint" -ForegroundColor Cyan
Write-Host "   Port: $RdsPort" -ForegroundColor Cyan
Write-Host "   User: $DbUser" -ForegroundColor Cyan
Write-Host "   Database: $DbName" -ForegroundColor Cyan
Write-Host ""

# Demander le mot de passe si non fourni
if ([string]::IsNullOrEmpty($DbPassword)) {
    Write-Host "Mot de passe de la base de donnees requis" -ForegroundColor Yellow
    Write-Host "Note: Le mot de passe ne sera pas affiche a l'ecran pour des raisons de securite" -ForegroundColor Gray
    $securePassword = Read-Host "Entrez le mot de passe de la base de donnees" -AsSecureString
    $BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
    $DbPassword = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)
    Write-Host ""
}

# Construire le DATABASE_URL
$databaseUrl = "postgresql://${DbUser}:${DbPassword}@${RdsEndpoint}:${RdsPort}/${DbName}?sslmode=require"

Write-Host ""
Write-Host "Mise a jour des variables d'environnement..." -ForegroundColor Yellow
Write-Host ""

# Fonction pour creer/mettre a jour un parametre SSM
function Update-SSMParameter {
    param(
        [string]$Name,
        [string]$Value,
        [string]$Type = "String",
        [string]$Description = ""
    )
    
    $fullName = "$ParameterPrefix/$Name"
    
    try {
        $existing = aws ssm get-parameter --name $fullName --region $Region 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "   Mise a jour: $Name" -ForegroundColor Cyan
        } else {
            Write-Host "   Creation: $Name" -ForegroundColor Green
        }
        
        if ($Description) {
            aws ssm put-parameter `
                --name $fullName `
                --value $Value `
                --type $Type `
                --region $Region `
                --description $Description `
                --overwrite | Out-Null
        } else {
            aws ssm put-parameter `
                --name $fullName `
                --value $Value `
                --type $Type `
                --region $Region `
                --overwrite | Out-Null
        }
        
        if ($LASTEXITCODE -eq 0) {
            return $true
        } else {
            Write-Host "      Erreur" -ForegroundColor Red
            return $false
        }
    } catch {
        Write-Host "      Erreur: $_" -ForegroundColor Red
        return $false
    }
}

# 2. Variables CRITIQUES - Base de donnees
Write-Host "Variables CRITIQUES - Base de donnees" -ForegroundColor Magenta
Update-SSMParameter -Name "DATABASE_URL" -Value $databaseUrl -Type "SecureString" -Description "URL de connexion PostgreSQL AWS RDS"
Update-SSMParameter -Name "ENABLE_AUTO_MIGRATIONS" -Value "true" -Description "Active les migrations automatiques au demarrage"
Update-SSMParameter -Name "DATABASE_TIMEOUT" -Value "10" -Description "Timeout de connexion base de donnees (secondes)"
Update-SSMParameter -Name "DB_ACQUIRE_TIMEOUT_SECS" -Value "15" -Description "Timeout d'acquisition de connexion (secondes)"
Update-SSMParameter -Name "DB_HEALTH_CHECK_INTERVAL_SECS" -Value "30" -Description "Intervalle de verification sante DB (secondes)"
Update-SSMParameter -Name "DB_POOL_MIN_SIZE" -Value "10" -Description "Taille minimale du pool de connexions"
Update-SSMParameter -Name "DB_POOL_SIZE" -Value "100" -Description "Taille maximale du pool de connexions"
Update-SSMParameter -Name "SQLX_OFFLINE" -Value "true" -Description "Mode offline pour SQLx"
Write-Host ""

# 3. Variables GPU (toutes activees comme dans Render)
Write-Host "Variables GPU" -ForegroundColor Magenta
Update-SSMParameter -Name "GPU_AVAILABLE" -Value "true" -Description "GPU disponible dans l'environnement"
Update-SSMParameter -Name "GPU_MEMORY_GB" -Value "16" -Description "Memoire GPU disponible (GB)"
Update-SSMParameter -Name "GPU_TYPE" -Value "nvidia" -Description "Type de GPU"
Update-SSMParameter -Name "CUDA_VISIBLE_DEVICES" -Value "0,1" -Description "Devices CUDA visibles"
Update-SSMParameter -Name "NVIDIA_VISIBLE_DEVICES" -Value "all" -Description "Devices NVIDIA visibles"
Update-SSMParameter -Name "VIDEO_RENDERER_ENABLE_GPU" -Value "true" -Description "Activer GPU pour le rendu video"
Update-SSMParameter -Name "BLENDER_USE_GPU" -Value "false" -Description "Utiliser GPU pour Blender"
Write-Host ""

# 4. Variables de Configuration Application
Write-Host "Variables de Configuration Application" -ForegroundColor Magenta
Update-SSMParameter -Name "ENVIRONMENT" -Value "production" -Description "Environnement d'execution"
Update-SSMParameter -Name "RUST_LOG" -Value "debug" -Description "Niveau de log Rust (debug pour diagnostic)"
Update-SSMParameter -Name "LOG_FORMAT" -Value "json" -Description "Format des logs"
Update-SSMParameter -Name "INSTANCE_ID" -Value "backend-1" -Description "ID de l'instance backend"
Write-Host ""

# 5. Variables de Configuration API
Write-Host "Variables de Configuration API" -ForegroundColor Magenta
Update-SSMParameter -Name "API_MAX_PAYLOAD_SIZE" -Value "10485760" -Description "Taille maximale du payload API (bytes)"
Update-SSMParameter -Name "API_RATE_LIMIT_PER_MINUTE" -Value "100" -Description "Limite de taux API par minute"
Update-SSMParameter -Name "API_REQUEST_TIMEOUT" -Value "30" -Description "Timeout des requetes API (secondes)"
Update-SSMParameter -Name "REQUEST_TIMEOUT" -Value "30" -Description "Timeout general des requetes (secondes)"
Update-SSMParameter -Name "RATE_LIMIT_IP" -Value "200" -Description "Limite de taux par IP"
Write-Host ""

# 6. Variables de Configuration Cache
Write-Host "Variables de Configuration Cache" -ForegroundColor Magenta
Update-SSMParameter -Name "CACHE_DEFAULT_TTL" -Value "3600" -Description "TTL par defaut du cache (secondes)"
Update-SSMParameter -Name "CACHE_TTL_SEARCH" -Value "600" -Description "TTL du cache de recherche (secondes)"
Update-SSMParameter -Name "SEMANTIC_CACHE_THRESHOLD" -Value "0.85" -Description "Seuil de similarite pour le cache semantique"
Write-Host ""

# 7. Variables de Configuration Recherche
Write-Host "Variables de Configuration Recherche" -ForegroundColor Magenta
Update-SSMParameter -Name "SEARCH_DEFAULT_LANGUAGE" -Value "fr" -Description "Langue par defaut pour la recherche"
Update-SSMParameter -Name "SEARCH_DEFAULT_RADIUS_KM" -Value "20" -Description "Rayon de recherche par defaut (km)"
Update-SSMParameter -Name "SEARCH_MAX_RESULTS" -Value "50" -Description "Nombre maximum de resultats de recherche"
Update-SSMParameter -Name "SEARCH_TITLE_BOOST" -Value "2.0" -Description "Boost du titre dans la recherche"
Write-Host ""

# 8. Variables de Configuration Timeouts
Write-Host "Variables de Configuration Timeouts" -ForegroundColor Magenta
Update-SSMParameter -Name "AI_REQUEST_TIMEOUT_SECONDS" -Value "120" -Description "Timeout des requetes IA (secondes)"
Update-SSMParameter -Name "AUDIO_SYNC_TIMEOUT_SECONDS" -Value "180" -Description "Timeout de synchronisation audio (secondes)"
Update-SSMParameter -Name "COLOR_GRADING_TIMEOUT_SECONDS" -Value "120" -Description "Timeout du color grading (secondes)"
Update-SSMParameter -Name "EMBEDDING_TIMEOUT_SECONDS" -Value "60" -Description "Timeout des embeddings (secondes)"
Update-SSMParameter -Name "VIDEO_ANALYSIS_TIMEOUT_SECONDS" -Value "180" -Description "Timeout de l'analyse video (secondes)"
Update-SSMParameter -Name "VIDEO_GENERATION_TIMEOUT_SECONDS" -Value "600" -Description "Timeout de generation video (secondes)"
Update-SSMParameter -Name "VIDEO_RENDERER_TIMEOUT_SECS" -Value "900" -Description "Timeout du rendu video (secondes)"
Write-Host ""

# 9. Variables de Configuration Email/SMS
Write-Host "Variables de Configuration Email/SMS" -ForegroundColor Magenta
Update-SSMParameter -Name "EMAIL_ENABLED" -Value "true" -Description "Activer l'envoi d'emails"
Update-SSMParameter -Name "EMAIL_PROVIDER" -Value "sendgrid" -Description "Fournisseur d'email"
Update-SSMParameter -Name "SMS_ENABLED" -Value "true" -Description "Activer l'envoi de SMS"
Update-SSMParameter -Name "SMS_PROVIDER" -Value "twilio" -Description "Fournisseur de SMS"
Update-SSMParameter -Name "SENDGRID_FROM_EMAIL" -Value "noreply@yukpomnang.com" -Description "Email expediteur SendGrid"
Update-SSMParameter -Name "SENDGRID_FROM_NAME" -Value "Yukpomnang" -Description "Nom expediteur SendGrid"
Write-Host ""

# 10. Variables de Configuration Video Renderer
Write-Host "Variables de Configuration Video Renderer" -ForegroundColor Magenta
Update-SSMParameter -Name "VIDEO_RENDERER_PROJECT_ROOT" -Value "/srv/yukpo/video-renderer" -Description "Racine du projet video renderer"
Update-SSMParameter -Name "VIDEO_RENDERER_SHARED_VOLUME" -Value "/srv/yukpo/jobs" -Description "Volume partage pour les jobs"
Update-SSMParameter -Name "VIDEO_RENDERER_RPC_URL" -Value "http://46.224.14.85:8088/render" -Description "URL RPC du video renderer"
Update-SSMParameter -Name "VIDEO_RENDERER_MAX_RETRIES" -Value "2" -Description "Nombre maximum de tentatives de rendu"
Update-SSMParameter -Name "RENDERER_S3_UPLOAD" -Value "true" -Description "Uploader les rendus vers S3"
Write-Host ""

# 11. Variables de Configuration LiveKit
Write-Host "Variables de Configuration LiveKit" -ForegroundColor Magenta
Update-SSMParameter -Name "LIVEKIT_API_URL" -Value "http://46.224.14.85:7880" -Description "URL API LiveKit"
Update-SSMParameter -Name "LIVEKIT_WS_URL" -Value "ws://46.224.14.85:7880" -Description "URL WebSocket LiveKit"
Update-SSMParameter -Name "LIVEKIT_HLS_URL" -Value "http://46.224.14.85:8080/live" -Description "URL HLS LiveKit"
Update-SSMParameter -Name "LIVEKIT_INGRESS_MODE" -Value "rtmp" -Description "Mode ingress LiveKit"
Update-SSMParameter -Name "LIVEKIT_INGRESS_NAME" -Value "prod-ingress-1" -Description "Nom ingress LiveKit"
Update-SSMParameter -Name "LIVEKIT_INGRESS_REGION" -Value "eu-central" -Description "Region ingress LiveKit"
Update-SSMParameter -Name "LIVEKIT_INGRESS_ROOM" -Value "live-events" -Description "Salle ingress LiveKit"
Update-SSMParameter -Name "LIVE_FALLBACK_ENABLED" -Value "true" -Description "Activer fallback LiveKit"
Update-SSMParameter -Name "LIVE_RECORDING_ENABLED" -Value "true" -Description "Activer enregistrement LiveKit"
Write-Host ""

# 12. Variables de Configuration Autres Services
Write-Host "Variables de Configuration Autres Services" -ForegroundColor Magenta
Update-SSMParameter -Name "PUBLIC_BASE_URL" -Value "https://cdn.yukpomnang.com" -Description "URL publique de base"
Update-SSMParameter -Name "UPLOAD_STORAGE_PATH" -Value "/var/data/uploads" -Description "Chemin de stockage des uploads"
Update-SSMParameter -Name "ML_MODELS_DIR" -Value "models" -Description "Repertoire des modeles ML"
Update-SSMParameter -Name "ENABLE_AI_OPTIMIZATIONS" -Value "true" -Description "Activer optimisations IA"
Update-SSMParameter -Name "ENABLE_STAGING_DEMO_SEED" -Value "true" -Description "Activer seed demo staging"
Write-Host ""

# 13. Variables S3
Write-Host "Variables S3" -ForegroundColor Magenta
Update-SSMParameter -Name "S3_ENDPOINT" -Value "" -Description "Endpoint S3 (vide pour AWS par defaut)"
Update-SSMParameter -Name "S3_FORCE_PATH_STYLE" -Value "false" -Description "Forcer style path pour S3"
Write-Host ""

Write-Host ""
Write-Host "Mise a jour terminee!" -ForegroundColor Green
Write-Host ""
Write-Host "IMPORTANT: Redeployez le service ECS pour que les changements prennent effet" -ForegroundColor Yellow
Write-Host ""
Write-Host "Pour redeployer via AWS CLI:" -ForegroundColor Cyan
Write-Host "aws ecs update-service --cluster yukpomnang-cluster --service yukpomnang-backend-service --force-new-deployment --region $Region"
Write-Host ""
Write-Host "Ou via Console AWS:" -ForegroundColor Cyan
Write-Host "1. ECS -> Clusters -> yukpomnang-cluster"
Write-Host "2. Services -> yukpomnang-backend-service"
Write-Host "3. Update -> Force new deployment"
Write-Host ""
