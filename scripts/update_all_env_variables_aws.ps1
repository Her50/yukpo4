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
    Write-Host "✅ AWS credentials verifiees" -ForegroundColor Green
} catch {
    Write-Host "AWS credentials non configurees" -ForegroundColor Red
    exit 1
}

# Verifier la connectivite AWS SSM
Write-Host "Verification de la connectivite AWS SSM..." -ForegroundColor Yellow
try {
    $testResult = aws ssm describe-parameters --region $Region --max-items 1 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "⚠️  Avertissement: Impossible de se connecter a AWS SSM" -ForegroundColor Yellow
        Write-Host "   Verifiez votre connexion internet et vos credentials AWS" -ForegroundColor Yellow
        Write-Host "   Le script continuera mais certaines operations peuvent echouer" -ForegroundColor Yellow
    } else {
        Write-Host "✅ Connectivite AWS SSM verifiee" -ForegroundColor Green
    }
} catch {
    Write-Host "⚠️  Avertissement: Erreur lors de la verification de connectivite" -ForegroundColor Yellow
}
Write-Host ""

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
    Write-Host ""
    Write-Host "Usage: .\update_all_env_variables_aws.ps1 -DbPassword 'VOTRE_MOT_DE_PASSE'" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Ou definir la variable d'environnement:" -ForegroundColor Cyan
    Write-Host '  $env:DB_PASSWORD = "VOTRE_MOT_DE_PASSE"' -ForegroundColor Cyan
    Write-Host '  .\update_all_env_variables_aws.ps1' -ForegroundColor Cyan
    Write-Host ""
    
    # Essayer de recuperer depuis la variable d'environnement
    if (-not [string]::IsNullOrEmpty($env:DB_PASSWORD)) {
        $DbPassword = $env:DB_PASSWORD
        Write-Host "Mot de passe recupere depuis la variable d'environnement DB_PASSWORD" -ForegroundColor Green
        Write-Host ""
    } else {
        Write-Host "ERREUR: Mot de passe non fourni" -ForegroundColor Red
        Write-Host "Fournissez le mot de passe avec -DbPassword ou definissez DB_PASSWORD" -ForegroundColor Red
        exit 1
    }
}

# Construire le DATABASE_URL
$databaseUrl = "postgresql://${DbUser}:${DbPassword}@${RdsEndpoint}:${RdsPort}/${DbName}?sslmode=require"

Write-Host ""
Write-Host "Mise a jour des variables d'environnement..." -ForegroundColor Yellow
Write-Host ""

# Liste pour suivre les echecs
$script:failedParameters = @()

# Fonction pour creer/mettre a jour un parametre SSM avec retry
function Update-SSMParameter {
    param(
        [string]$Name,
        [string]$Value,
        [string]$Type = "String",
        [string]$Description = "",
        [int]$MaxRetries = 3,
        [int]$RetryDelaySeconds = 2
    )
    
    $fullName = "$ParameterPrefix/$Name"
    
    # Verifier si le parametre existe (sans retry pour cette operation)
    try {
        $existing = aws ssm get-parameter --name $fullName --region $Region 2>&1 | Out-Null
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "   Mise a jour: $Name" -ForegroundColor Cyan
        } else {
            Write-Host "   Creation: $Name" -ForegroundColor Green
        }
    } catch {
        Write-Host "   Creation: $Name" -ForegroundColor Green
    }
    
    # Construire la commande AWS CLI
    # Note: AWS SSM Parameter Store ne permet pas les valeurs vides (longueur minimale = 1)
    # Si une valeur vide est fournie, utiliser "(default)" comme valeur par défaut
    $actualValue = if ([string]::IsNullOrEmpty($Value)) { "(default)" } else { $Value }
    
    $awsArgs = @(
        "ssm", "put-parameter",
        "--name", $fullName,
        "--value", $actualValue,
        "--type", $Type,
        "--region", $Region,
        "--overwrite"
    )
    
    if ($Description) {
        $awsArgs += "--description"
        $awsArgs += $Description
    }
    
    # Retry avec backoff exponentiel
    $attempt = 0
    $delay = $RetryDelaySeconds
    
    while ($attempt -lt $MaxRetries) {
        $attempt++
        try {
            $result = & aws $awsArgs 2>&1
            
            if ($LASTEXITCODE -eq 0) {
                return $true
            } else {
                $errorMessage = $result -join " "
                
                # Si c'est une erreur de connectivite, retry
                if ($errorMessage -match "Could not connect|timeout|network|connection") {
                    if ($attempt -lt $MaxRetries) {
                        Write-Host "      Tentative $attempt/$MaxRetries echouee, nouvelle tentative dans $delay secondes..." -ForegroundColor Yellow
                        Start-Sleep -Seconds $delay
                        $delay = $delay * 2  # Backoff exponentiel
                        continue
                    } else {
                        # Derniere tentative echouee
                        Write-Host "      Erreur: $errorMessage" -ForegroundColor Red
                        $script:failedParameters += @{ Name = $Name; Error = $errorMessage }
                        return $false
                    }
                }
                
                # Autres erreurs (permissions, etc.) - ne pas retry
                Write-Host "      Erreur: $errorMessage" -ForegroundColor Red
                $script:failedParameters += @{ Name = $Name; Error = $errorMessage }
                return $false
            }
        } catch {
            if ($attempt -lt $MaxRetries) {
                Write-Host "      Tentative $attempt/$MaxRetries echouee, nouvelle tentative dans $delay secondes..." -ForegroundColor Yellow
                Start-Sleep -Seconds $delay
                $delay = $delay * 2
                continue
            } else {
                Write-Host "      Erreur: $_" -ForegroundColor Red
                $script:failedParameters += @{ Name = $Name; Error = $_.ToString() }
                return $false
            }
        }
    }
    
    $script:failedParameters += @{ Name = $Name; Error = "Echec apres $MaxRetries tentatives" }
    return $false
}

# Fonction helper pour mettre a jour avec delai
function Update-SSMParameterWithDelay {
    param(
        [string]$Name,
        [string]$Value,
        [string]$Type = "String",
        [string]$Description = "",
        [int]$DelayMs = 200
    )
    
    $result = Update-SSMParameter -Name $Name -Value $Value -Type $Type -Description $Description
    if ($DelayMs -gt 0) {
        Start-Sleep -Milliseconds $DelayMs
    }
    return $result
}

# 2. Variables CRITIQUES - Base de donnees
Write-Host "Variables CRITIQUES - Base de donnees" -ForegroundColor Magenta
Update-SSMParameterWithDelay -Name "DATABASE_URL" -Value $databaseUrl -Type "SecureString" -Description "URL de connexion PostgreSQL AWS RDS"
Update-SSMParameterWithDelay -Name "ENABLE_AUTO_MIGRATIONS" -Value "true" -Description "Active les migrations automatiques au demarrage"
Update-SSMParameterWithDelay -Name "DATABASE_TIMEOUT" -Value "10" -Description "Timeout de connexion base de donnees (secondes)"
Update-SSMParameterWithDelay -Name "DB_ACQUIRE_TIMEOUT_SECS" -Value "15" -Description "Timeout d'acquisition de connexion (secondes)"
Update-SSMParameterWithDelay -Name "DB_HEALTH_CHECK_INTERVAL_SECS" -Value "30" -Description "Intervalle de verification sante DB (secondes)"
Update-SSMParameterWithDelay -Name "DB_POOL_MIN_SIZE" -Value "10" -Description "Taille minimale du pool de connexions"
Update-SSMParameterWithDelay -Name "DB_POOL_SIZE" -Value "100" -Description "Taille maximale du pool de connexions"
Update-SSMParameterWithDelay -Name "SQLX_OFFLINE" -Value "true" -Description "Mode offline pour SQLx"
Write-Host ""

# 3. Variables GPU (toutes activees comme dans Render)
Write-Host "Variables GPU" -ForegroundColor Magenta
Update-SSMParameterWithDelay -Name "AMD_GPU_AVAILABLE" -Value "false" -Description "GPU AMD disponible (false car on utilise NVIDIA)"
Update-SSMParameterWithDelay -Name "GPU_AVAILABLE" -Value "true" -Description "GPU disponible dans l'environnement"
Update-SSMParameterWithDelay -Name "GPU_MEMORY_GB" -Value "16" -Description "Memoire GPU disponible (GB)"
Update-SSMParameterWithDelay -Name "GPU_TYPE" -Value "nvidia" -Description "Type de GPU"
Update-SSMParameterWithDelay -Name "CUDA_VISIBLE_DEVICES" -Value "0,1" -Description "Devices CUDA visibles"
Update-SSMParameterWithDelay -Name "NVIDIA_VISIBLE_DEVICES" -Value "all" -Description "Devices NVIDIA visibles"
Update-SSMParameterWithDelay -Name "VIDEO_RENDERER_ENABLE_GPU" -Value "true" -Description "Activer GPU pour le rendu video"
Update-SSMParameterWithDelay -Name "BLENDER_USE_GPU" -Value "false" -Description "Utiliser GPU pour Blender"
Write-Host ""

# 4. Variables de Configuration Application
Write-Host "Variables de Configuration Application" -ForegroundColor Magenta
Update-SSMParameterWithDelay -Name "ENVIRONMENT" -Value "production" -Description "Environnement d'execution"
Update-SSMParameterWithDelay -Name "RUST_LOG" -Value "debug" -Description "Niveau de log Rust (debug pour diagnostic)"
Update-SSMParameterWithDelay -Name "LOG_FORMAT" -Value "json" -Description "Format des logs"
Update-SSMParameterWithDelay -Name "INSTANCE_ID" -Value "backend-1" -Description "ID de l'instance backend"
Write-Host ""

# 5. Variables de Configuration API
Write-Host "Variables de Configuration API" -ForegroundColor Magenta
Update-SSMParameterWithDelay -Name "API_MAX_PAYLOAD_SIZE" -Value "10485760" -Description "Taille maximale du payload API (bytes)"
Update-SSMParameterWithDelay -Name "API_RATE_LIMIT_PER_MINUTE" -Value "100" -Description "Limite de taux API par minute"
Update-SSMParameterWithDelay -Name "API_REQUEST_TIMEOUT" -Value "30" -Description "Timeout des requetes API (secondes)"
Update-SSMParameterWithDelay -Name "REQUEST_TIMEOUT" -Value "30" -Description "Timeout general des requetes (secondes)"
Update-SSMParameterWithDelay -Name "RATE_LIMIT_IP" -Value "200" -Description "Limite de taux par IP"
Write-Host ""

# 6. Variables de Configuration Cache
Write-Host "Variables de Configuration Cache" -ForegroundColor Magenta
Update-SSMParameterWithDelay -Name "CACHE_DEFAULT_TTL" -Value "3600" -Description "TTL par defaut du cache (secondes)"
Update-SSMParameterWithDelay -Name "CACHE_TTL_SEARCH" -Value "600" -Description "TTL du cache de recherche (secondes)"
Update-SSMParameterWithDelay -Name "SEMANTIC_CACHE_THRESHOLD" -Value "0.85" -Description "Seuil de similarite pour le cache semantique"
Write-Host ""

# 7. Variables de Configuration Recherche
Write-Host "Variables de Configuration Recherche" -ForegroundColor Magenta
Update-SSMParameterWithDelay -Name "SEARCH_DEFAULT_LANGUAGE" -Value "fr" -Description "Langue par defaut pour la recherche"
Update-SSMParameterWithDelay -Name "SEARCH_DEFAULT_RADIUS_KM" -Value "20" -Description "Rayon de recherche par defaut (km)"
Update-SSMParameterWithDelay -Name "SEARCH_MAX_RESULTS" -Value "50" -Description "Nombre maximum de resultats de recherche"
Update-SSMParameterWithDelay -Name "SEARCH_TITLE_BOOST" -Value "2.0" -Description "Boost du titre dans la recherche"
Write-Host ""

# 8. Variables de Configuration Timeouts
Write-Host "Variables de Configuration Timeouts" -ForegroundColor Magenta
Update-SSMParameterWithDelay -Name "AI_REQUEST_TIMEOUT_SECONDS" -Value "120" -Description "Timeout des requetes IA (secondes)"
Update-SSMParameterWithDelay -Name "AUDIO_SYNC_TIMEOUT_SECONDS" -Value "180" -Description "Timeout de synchronisation audio (secondes)"
Update-SSMParameterWithDelay -Name "COLOR_GRADING_TIMEOUT_SECONDS" -Value "120" -Description "Timeout du color grading (secondes)"
Update-SSMParameterWithDelay -Name "EMBEDDING_TIMEOUT_SECONDS" -Value "60" -Description "Timeout des embeddings (secondes)"
Update-SSMParameterWithDelay -Name "VIDEO_ANALYSIS_TIMEOUT_SECONDS" -Value "180" -Description "Timeout de l'analyse video (secondes)"
Update-SSMParameterWithDelay -Name "VIDEO_GENERATION_TIMEOUT_SECONDS" -Value "600" -Description "Timeout de generation video (secondes)"
Update-SSMParameterWithDelay -Name "VIDEO_RENDERER_TIMEOUT_SECS" -Value "900" -Description "Timeout du rendu video (secondes)"
Write-Host ""

# 9. Variables de Configuration Email/SMS
Write-Host "Variables de Configuration Email/SMS" -ForegroundColor Magenta
Update-SSMParameterWithDelay -Name "EMAIL_ENABLED" -Value "true" -Description "Activer l'envoi d'emails"
Update-SSMParameterWithDelay -Name "EMAIL_PROVIDER" -Value "sendgrid" -Description "Fournisseur d'email"
Update-SSMParameterWithDelay -Name "SMS_ENABLED" -Value "true" -Description "Activer l'envoi de SMS"
Update-SSMParameterWithDelay -Name "SMS_PROVIDER" -Value "twilio" -Description "Fournisseur de SMS"
Update-SSMParameterWithDelay -Name "SENDGRID_FROM_EMAIL" -Value "noreply@yukpomnang.com" -Description "Email expediteur SendGrid"
Update-SSMParameterWithDelay -Name "SENDGRID_FROM_NAME" -Value "Yukpomnang" -Description "Nom expediteur SendGrid"
Write-Host ""

# 10. Variables de Configuration Video Renderer
Write-Host "Variables de Configuration Video Renderer" -ForegroundColor Magenta
Update-SSMParameterWithDelay -Name "VIDEO_RENDERER_PROJECT_ROOT" -Value "/srv/yukpo/video-renderer" -Description "Racine du projet video renderer"
Update-SSMParameterWithDelay -Name "VIDEO_RENDERER_SHARED_VOLUME" -Value "/srv/yukpo/jobs" -Description "Volume partage pour les jobs"
Update-SSMParameterWithDelay -Name "VIDEO_RENDERER_RPC_URL" -Value "http://46.224.14.85:8088/render" -Description "URL RPC du video renderer"
Update-SSMParameterWithDelay -Name "VIDEO_RENDERER_MAX_RETRIES" -Value "2" -Description "Nombre maximum de tentatives de rendu"
Update-SSMParameterWithDelay -Name "RENDERER_S3_UPLOAD" -Value "true" -Description "Uploader les rendus vers S3"
Write-Host ""

# 11. Variables de Configuration LiveKit
Write-Host "Variables de Configuration LiveKit" -ForegroundColor Magenta
Update-SSMParameterWithDelay -Name "LIVEKIT_API_URL" -Value "http://46.224.14.85:7880" -Description "URL API LiveKit"
Update-SSMParameterWithDelay -Name "LIVEKIT_WS_URL" -Value "ws://46.224.14.85:7880" -Description "URL WebSocket LiveKit"
Update-SSMParameterWithDelay -Name "LIVEKIT_HLS_URL" -Value "http://46.224.14.85:8080/live" -Description "URL HLS LiveKit"
Update-SSMParameterWithDelay -Name "LIVEKIT_INGRESS_MODE" -Value "rtmp" -Description "Mode ingress LiveKit"
Update-SSMParameterWithDelay -Name "LIVEKIT_INGRESS_NAME" -Value "prod-ingress-1" -Description "Nom ingress LiveKit"
Update-SSMParameterWithDelay -Name "LIVEKIT_INGRESS_REGION" -Value "eu-central" -Description "Region ingress LiveKit"
Update-SSMParameterWithDelay -Name "LIVEKIT_INGRESS_ROOM" -Value "live-events" -Description "Salle ingress LiveKit"
Update-SSMParameterWithDelay -Name "LIVE_FALLBACK_ENABLED" -Value "true" -Description "Activer fallback LiveKit"
Update-SSMParameterWithDelay -Name "LIVE_RECORDING_ENABLED" -Value "true" -Description "Activer enregistrement LiveKit"
Write-Host ""

# 12. Variables de Configuration Autres Services
Write-Host "Variables de Configuration Autres Services" -ForegroundColor Magenta
Update-SSMParameterWithDelay -Name "PUBLIC_BASE_URL" -Value "https://cdn.yukpomnang.com" -Description "URL publique de base"
Update-SSMParameterWithDelay -Name "UPLOAD_STORAGE_PATH" -Value "/var/data/uploads" -Description "Chemin de stockage des uploads"
Update-SSMParameterWithDelay -Name "ML_MODELS_DIR" -Value "models" -Description "Repertoire des modeles ML"
Update-SSMParameterWithDelay -Name "ENABLE_AI_OPTIMIZATIONS" -Value "true" -Description "Activer optimisations IA"
Update-SSMParameterWithDelay -Name "ENABLE_STAGING_DEMO_SEED" -Value "true" -Description "Activer seed demo staging"
Write-Host ""

# 13. Variables S3
Write-Host "Variables S3" -ForegroundColor Magenta
# S3_ENDPOINT: AWS SSM ne permet pas les valeurs vides, utiliser "(default)" pour utiliser l'endpoint AWS par défaut
# L'application doit interpréter "(default)" comme une valeur vide pour utiliser l'endpoint AWS standard
Update-SSMParameterWithDelay -Name "S3_ENDPOINT" -Value "(default)" -Description "Endpoint S3 ((default) pour utiliser endpoint AWS standard, vide = endpoint AWS par defaut)"
Update-SSMParameterWithDelay -Name "S3_FORCE_PATH_STYLE" -Value "false" -Description "Forcer style path pour S3"
Write-Host ""

Write-Host ""
Write-Host "Mise a jour terminee!" -ForegroundColor Green
Write-Host ""

# Afficher le resume des echecs
if ($script:failedParameters.Count -gt 0) {
    Write-Host "⚠️  ATTENTION: $($script:failedParameters.Count) variable(s) n'ont pas pu etre mises a jour:" -ForegroundColor Yellow
    Write-Host ""
    foreach ($failed in $script:failedParameters) {
        Write-Host "   - $($failed.Name): $($failed.Error)" -ForegroundColor Red
    }
    Write-Host ""
    Write-Host "Pour reessayer uniquement les variables en echec, vous pouvez:" -ForegroundColor Cyan
    Write-Host "1. Verifier votre connexion internet" -ForegroundColor Cyan
    Write-Host "2. Verifier vos credentials AWS (aws sts get-caller-identity)" -ForegroundColor Cyan
    Write-Host "3. Verifier les permissions IAM pour SSM Parameter Store" -ForegroundColor Cyan
    Write-Host "4. Relancer le script complet" -ForegroundColor Cyan
    Write-Host ""
} else {
    Write-Host "✅ Toutes les variables ont ete mises a jour avec succes!" -ForegroundColor Green
    Write-Host ""
}

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
