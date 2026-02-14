# Script de Migration Complete vers Google Cloud Platform (GCP) - 100% Automatique
# Usage: .\scripts\migrate-to-gcp-complete.ps1

param(
    [string]$ProjectId = "yukpo-project",
    [string]$ProjectName = "Yukpo Project",
    [string]$Region = "europe-west1",
    [string]$DbInstanceName = "yukpo-db",
    [string]$DbName = "yukpo_db",
    [string]$DbUser = "yukpo_admin",
    [string]$ServiceName = "yukpo-backend",
    [string]$DockerImage = "gcr.io/yukpo-project/yukpo-backend",
    [string]$GitHubRepo = "Her50/yukpo4",
    [string]$AwsCluster = "yukpo-cluster",
    [string]$AwsService = "yukpo-backend-service",
    [string]$AwsRegion = "eu-west-1"
)

$ErrorActionPreference = "Stop"

Write-Host "Migration Complete vers Google Cloud Platform (GCP) - 100% Automatique" -ForegroundColor Cyan
Write-Host "=======================================================================" -ForegroundColor Cyan
Write-Host ""

# Mettre a jour le PATH
$env:PATH = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

# Verifier Google Cloud CLI
Write-Host "Verification de Google Cloud CLI..." -ForegroundColor Yellow
$gcloudCmd = Get-Command gcloud -ErrorAction SilentlyContinue
if (-not $gcloudCmd) {
    Write-Host "Google Cloud CLI non trouve. Installation..." -ForegroundColor Yellow
    winget install Google.CloudSDK --silent
    Start-Sleep -Seconds 10
    $env:PATH = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
    
    # Ajouter gcloud au PATH
    $gcloudPath = "$env:ProgramFiles\Google\Cloud SDK\google-cloud-sdk\bin"
    if (Test-Path $gcloudPath) {
        $env:PATH += ";$gcloudPath"
    }
}

$gcloudCmd = Get-Command gcloud -ErrorAction SilentlyContinue
if (-not $gcloudCmd) {
    Write-Host "ERREUR: Google Cloud CLI non trouve apres installation" -ForegroundColor Red
    Write-Host "Installez manuellement depuis: https://cloud.google.com/sdk/docs/install" -ForegroundColor Yellow
    exit 1
}

Write-Host "Google Cloud CLI trouve" -ForegroundColor Green
Write-Host ""

# Connexion GCP
Write-Host "Connexion a Google Cloud Platform..." -ForegroundColor Yellow
try {
    $currentAccount = gcloud auth list --format="value(account)" 2>&1 | Select-String -Pattern "@" | Select-Object -First 1
    if (-not $currentAccount -or $currentAccount -match "ERROR") {
        throw "Not logged in"
    }
    Write-Host "Deja connecte: $currentAccount" -ForegroundColor Gray
} catch {
    Write-Host "Non connecte a GCP. Connexion..." -ForegroundColor Yellow
    Write-Host "Un navigateur va s'ouvrir pour vous connecter..." -ForegroundColor Cyan
    gcloud auth login
    Start-Sleep -Seconds 3
}

Write-Host "Connecte a GCP" -ForegroundColor Green
Write-Host ""

# Creer ou utiliser le projet
Write-Host "Configuration du projet GCP..." -ForegroundColor Yellow
try {
    $projectExists = gcloud projects describe $ProjectId --format="value(projectId)" 2>&1
    if ($LASTEXITCODE -ne 0 -or $projectExists -match "ERROR" -or $projectExists -match "does not have permission") {
        Write-Host "Creation du projet..." -ForegroundColor Gray
        gcloud projects create $ProjectId --name="$ProjectName"
        Start-Sleep -Seconds 3
    }
} catch {
    Write-Host "Creation du projet..." -ForegroundColor Gray
    gcloud projects create $ProjectId --name="$ProjectName"
    Start-Sleep -Seconds 3
}

$ErrorActionPreference = "Continue"
gcloud config set project $ProjectId 2>&1 | Where-Object { $_ -notmatch "lacks an 'environment' tag" } | Out-Null
$ErrorActionPreference = "Stop"
Write-Host "Projet configure: $ProjectId" -ForegroundColor Green
Write-Host ""

# Lier le compte de facturation au projet
Write-Host "Liaison du compte de facturation au projet..." -ForegroundColor Yellow
$billingAccount = gcloud billing accounts list --format="value(name)" --filter="open=true" 2>&1 | Select-Object -First 1
if ($billingAccount -and -not ($billingAccount -match "ERROR")) {
    $billingAccountId = $billingAccount -replace ".*/", ""
    Write-Host "   Compte de facturation trouve: $billingAccountId" -ForegroundColor Gray
    $currentBilling = gcloud billing projects describe $ProjectId --format="value(billingAccountName)" 2>&1
    if ($LASTEXITCODE -ne 0 -or $currentBilling -match "ERROR" -or -not $currentBilling) {
        Write-Host "   Liaison du compte de facturation..." -ForegroundColor Gray
        gcloud billing projects link $ProjectId --billing-account=$billingAccountId
        Start-Sleep -Seconds 3
        Write-Host "   Compte de facturation lie" -ForegroundColor Green
    } else {
        Write-Host "   Compte de facturation deja lie" -ForegroundColor Green
    }
} else {
    Write-Host "   ATTENTION: Aucun compte de facturation ouvert trouve" -ForegroundColor Yellow
    Write-Host "   Veuillez lier manuellement le compte de facturation au projet" -ForegroundColor Yellow
    Write-Host "   Lien: https://console.cloud.google.com/billing/linkedaccount?project=$ProjectId" -ForegroundColor Cyan
}

Write-Host ""

# Activer les APIs necessaires
Write-Host "Activation des APIs GCP..." -ForegroundColor Yellow
$apis = @(
    "sqladmin.googleapis.com",
    "run.googleapis.com",
    "containerregistry.googleapis.com",
    "cloudbuild.googleapis.com",
    "compute.googleapis.com",
    "storage-api.googleapis.com",
    "storage-component.googleapis.com",
    "cloudcdn.googleapis.com"
)

foreach ($api in $apis) {
    Write-Host "   Activation de $api..." -ForegroundColor Gray
    $ErrorActionPreference = "Continue"
    gcloud services enable $api --project=$ProjectId 2>&1 | Where-Object { $_ -notmatch "lacks an 'environment' tag" } | Out-Null
    $ErrorActionPreference = "Stop"
}

Write-Host "APIs activees" -ForegroundColor Green
Write-Host ""

# Recuperer TOUTES les variables d'environnement depuis AWS
Write-Host "Recuperation COMPLETE des variables d'environnement depuis AWS..." -ForegroundColor Yellow
Write-Host "   (Recuperation depuis ECS, Secrets Manager, SSM Parameter Store...)" -ForegroundColor Gray
$envVars = @{}
$envCount = 0

$awsCmd = Get-Command aws -ErrorAction SilentlyContinue
if ($awsCmd) {
    try {
        Write-Host "   Recherche de la Task Definition ECS..." -ForegroundColor Gray
        $taskDefArn = aws ecs describe-services `
            --cluster $AwsCluster `
            --services $AwsService `
            --region $AwsRegion `
            --query 'services[0].taskDefinition' `
            --output text 2>$null

        if ($taskDefArn) {
            Write-Host "   Task Definition trouvee: $taskDefArn" -ForegroundColor Gray
            $taskDef = aws ecs describe-task-definition `
                --task-definition $taskDefArn `
                --region $AwsRegion `
                --output json | ConvertFrom-Json

            $containerDef = $taskDef.taskDefinition.containerDefinitions[0]
            
            # Variables directes depuis Task Definition
            if ($containerDef.environment) {
                Write-Host "   Recuperation des variables directes..." -ForegroundColor Gray
                foreach ($env in $containerDef.environment) {
                    $envVars[$env.name] = $env.value
                    $envCount++
                    Write-Host "      [$envCount] $($env.name)" -ForegroundColor DarkGray
                }
            }

            # Variables depuis Secrets Manager
            if ($containerDef.secrets) {
                Write-Host "   Recuperation des variables depuis Secrets Manager..." -ForegroundColor Gray
                foreach ($secret in $containerDef.secrets) {
                    $secretName = $secret.name
                    $secretValueFrom = $secret.valueFrom
                    
                    # Secrets Manager
                    if ($secretValueFrom -like "*secretsmanager*") {
                        $secretArn = $secretValueFrom -replace "arn:aws:secretsmanager:.*:secret:", ""
                        $secretArn = $secretArn -replace "/.*", ""
                        try {
                            Write-Host "      Recuperation depuis Secrets Manager: $secretArn..." -ForegroundColor DarkGray
                            $secretValue = aws secretsmanager get-secret-value `
                                --secret-id $secretArn `
                                --region $AwsRegion `
                                --query 'SecretString' `
                                --output text 2>$null
                            
                            if ($secretValue) {
                                # Si c'est du JSON, parser
                                try {
                                    $secretJson = $secretValue | ConvertFrom-Json
                                    foreach ($key in $secretJson.PSObject.Properties.Name) {
                                        $envVars[$key] = $secretJson.$key
                                        $envCount++
                                        Write-Host "         [$envCount] $key (depuis JSON)" -ForegroundColor DarkGray
                                    }
                                } catch {
                                    # Si ce n'est pas du JSON, utiliser directement
                                    $envVars[$secretName] = $secretValue
                                    $envCount++
                                    Write-Host "         [$envCount] $secretName" -ForegroundColor DarkGray
                                }
                            }
                        } catch {
                            Write-Host "      ATTENTION: Impossible de recuperer $secretName depuis Secrets Manager" -ForegroundColor Yellow
                        }
                    }
                    
                    # SSM Parameter Store
                    if ($secretValueFrom -like "*ssm*") {
                        $paramName = $secretValueFrom -replace "arn:aws:ssm:.*:parameter:", ""
                        try {
                            Write-Host "      Recuperation depuis SSM: $paramName..." -ForegroundColor DarkGray
                            $paramValue = aws ssm get-parameter `
                                --name $paramName `
                                --region $AwsRegion `
                                --with-decryption `
                                --query 'Parameter.Value' `
                                --output text 2>$null
                            if ($paramValue) {
                                $envVars[$secretName] = $paramValue
                                $envCount++
                                Write-Host "         [$envCount] $secretName" -ForegroundColor DarkGray
                            }
                        } catch {
                            Write-Host "      ATTENTION: Impossible de recuperer $secretName depuis SSM" -ForegroundColor Yellow
                        }
                    }
                }
            }
        } else {
            Write-Host "   ATTENTION: Task Definition non trouvee" -ForegroundColor Yellow
        }
        
        # Essayer de recuperer depuis SSM Parameter Store directement (tous les parametres)
        Write-Host "   Recherche de parametres SSM supplementaires..." -ForegroundColor Gray
        try {
            $ssmParams = aws ssm describe-parameters `
                --region $AwsRegion `
                --query 'Parameters[?starts_with(Name, `/yukpo`) || starts_with(Name, `/yukpomnang`) || starts_with(Name, `/yukpo4`)].Name' `
                --output json 2>$null | ConvertFrom-Json
            
            if ($ssmParams -and $ssmParams.Count -gt 0) {
                Write-Host "   $($ssmParams.Count) parametres SSM trouves" -ForegroundColor Gray
                foreach ($paramName in $ssmParams) {
                    $envKey = $paramName -replace "^/.*/", "" -replace "-", "_" -replace "/", "_"
                    if (-not $envVars.ContainsKey($envKey)) {
                        try {
                            $paramValue = aws ssm get-parameter `
                                --name $paramName `
                                --region $AwsRegion `
                                --with-decryption `
                                --query 'Parameter.Value' `
                                --output text 2>$null
                            if ($paramValue) {
                                $envVars[$envKey] = $paramValue
                                $envCount++
                                Write-Host "      [$envCount] $envKey (depuis SSM: $paramName)" -ForegroundColor DarkGray
                            }
                        } catch {
                            # Ignorer les erreurs
                        }
                    }
                }
            }
        } catch {
            Write-Host "   ATTENTION: Impossible de lister les parametres SSM" -ForegroundColor Yellow
        }
        
    } catch {
        Write-Host "   ERREUR: Impossible de recuperer depuis AWS: $_" -ForegroundColor Red
    }
} else {
    Write-Host "   ATTENTION: AWS CLI non trouve - Variables non recuperees depuis AWS" -ForegroundColor Yellow
}

Write-Host "   Total variables recuperees: $envCount" -ForegroundColor Green
if ($envCount -gt 0) {
    Write-Host "   Liste des variables recuperees:" -ForegroundColor Gray
    $envVars.Keys | Sort-Object | ForEach-Object {
        Write-Host "      - $_" -ForegroundColor DarkGray
    }
}
Write-Host ""

# Adapter les variables AWS vers GCP
Write-Host "Adaptation des variables AWS vers GCP..." -ForegroundColor Yellow

# Obtenir l'IP de Cloud SQL
$ErrorActionPreference = "Continue"
$dbIp = gcloud sql instances describe $DbInstanceName --format="value(ipAddresses[0].ipAddress)" --project=$ProjectId 2>&1 | Select-String -Pattern "^\d+\.\d+\.\d+\.\d+$"
$ErrorActionPreference = "Stop"

# Adapter DATABASE_URL (PostgreSQL)
if ($envVars.ContainsKey("DATABASE_URL")) {
    Write-Host "   Adaptation de DATABASE_URL..." -ForegroundColor Gray
    $oldDbUrl = $envVars["DATABASE_URL"]
    # Extraire les infos de l'ancienne URL si possible
    if ($oldDbUrl -match "postgresql://([^:]+):([^@]+)@([^:]+):(\d+)/([^?]+)") {
        $oldUser = $matches[1]
        $oldPass = $matches[2]
        $oldHost = $matches[3]
        $oldPort = $matches[4]
        $oldDb = $matches[5]
    }
    # Utiliser les nouvelles credentials GCP
    $newDbUrl = "postgresql://${DbUser}:$DbUserPassword@${dbIp}:5432/${DbName}?sslmode=require"
    $envVars["DATABASE_URL"] = $newDbUrl
    Write-Host "      DATABASE_URL adapte vers Cloud SQL" -ForegroundColor DarkGray
} else {
    # Creer DATABASE_URL si absent
    $newDbUrl = "postgresql://${DbUser}:$DbUserPassword@${dbIp}:5432/${DbName}?sslmode=require"
    $envVars["DATABASE_URL"] = $newDbUrl
    Write-Host "   DATABASE_URL cree pour Cloud SQL" -ForegroundColor Gray
}

# Adapter REDIS_URL (vers Cloud Memorystore ou Redis GCP)
if ($envVars.ContainsKey("REDIS_URL")) {
    Write-Host "   Adaptation de REDIS_URL..." -ForegroundColor Gray
    $oldRedisUrl = $envVars["REDIS_URL"]
    # Extraire les infos de l'ancienne URL
    if ($oldRedisUrl -match "redis://([^:]+):(\d+)") {
        $oldRedisHost = $matches[1]
        $oldRedisPort = $matches[2]
    }
    # Pour l'instant, garder l'URL mais noter qu'il faut creer Cloud Memorystore
    Write-Host "      REDIS_URL: A adapter vers Cloud Memorystore (gardee temporairement)" -ForegroundColor Yellow
    Write-Host "      Note: Creer Cloud Memorystore Redis et mettre a jour cette variable" -ForegroundColor Yellow
    # TODO: Creer Cloud Memorystore Redis automatiquement
}

# Adapter S3 URLs vers Cloud Storage
if ($envVars.ContainsKey("S3_BUCKET")) {
    Write-Host "   Adaptation de S3_BUCKET vers Cloud Storage..." -ForegroundColor Gray
    $oldBucket = $envVars["S3_BUCKET"]
    $newBucket = "$ProjectId-$oldBucket"
    $envVars["S3_BUCKET"] = $newBucket
    Write-Host "      S3_BUCKET adapte: $newBucket" -ForegroundColor DarkGray
}

if ($envVars.ContainsKey("S3_REGION")) {
    Write-Host "   Adaptation de S3_REGION..." -ForegroundColor Gray
    $envVars["S3_REGION"] = $Region
    Write-Host "      S3_REGION adapte: $Region" -ForegroundColor DarkGray
}

# Adapter S3_ACCESS_KEY et S3_SECRET_KEY (vers Cloud Storage)
if ($envVars.ContainsKey("S3_ACCESS_KEY")) {
    Write-Host "   Adaptation de S3_ACCESS_KEY..." -ForegroundColor Gray
    Write-Host "      S3_ACCESS_KEY: A configurer avec credentials Cloud Storage" -ForegroundColor Yellow
    # Les credentials Cloud Storage sont differents, a configurer manuellement
}

if ($envVars.ContainsKey("S3_SECRET_KEY")) {
    Write-Host "   Adaptation de S3_SECRET_KEY..." -ForegroundColor Gray
    Write-Host "      S3_SECRET_KEY: A configurer avec credentials Cloud Storage" -ForegroundColor Yellow
    # Les credentials Cloud Storage sont differents, a configurer manuellement
}

# Adapter UPLOAD_BASE_URL vers Cloud CDN (si Cloud CDN est configuré)
if ($envVars.ContainsKey("UPLOAD_BASE_URL")) {
    Write-Host "   Adaptation de UPLOAD_BASE_URL..." -ForegroundColor Gray
    $oldUploadUrl = $envVars["UPLOAD_BASE_URL"]
    # Si c'est une URL CDN (CloudFront, Cloudflare), la conserver
    if ($oldUploadUrl -match "cdn\.|cloudfront\.|cloudflare") {
        Write-Host "      UPLOAD_BASE_URL est deja une URL CDN, conservee: $oldUploadUrl" -ForegroundColor DarkGray
    } else {
        # Adapter vers Cloud Storage URL (sera mis a jour avec Cloud CDN apres creation)
        $bucketName = if ($envVars.ContainsKey("S3_BUCKET")) { $envVars["S3_BUCKET"] } else { "$ProjectId-media" }
        $newUploadUrl = "https://storage.googleapis.com/$bucketName"
        $envVars["UPLOAD_BASE_URL"] = $newUploadUrl
        Write-Host "      UPLOAD_BASE_URL adapte vers Cloud Storage: $newUploadUrl" -ForegroundColor DarkGray
        Write-Host "      Note: Mettre a jour avec URL Cloud CDN apres creation" -ForegroundColor Yellow
    }
}

# Adapter PUBLIC_BASE_URL vers Cloud CDN
if ($envVars.ContainsKey("PUBLIC_BASE_URL")) {
    Write-Host "   Adaptation de PUBLIC_BASE_URL..." -ForegroundColor Gray
    $oldPublicUrl = $envVars["PUBLIC_BASE_URL"]
    # Si c'est une URL CDN, la conserver
    if ($oldPublicUrl -match "cdn\.|cloudfront\.|cloudflare") {
        Write-Host "      PUBLIC_BASE_URL est deja une URL CDN, conservee: $oldPublicUrl" -ForegroundColor DarkGray
    } else {
        # Adapter vers Cloud Storage URL (sera mis a jour avec Cloud CDN apres creation)
        $bucketName = if ($envVars.ContainsKey("S3_BUCKET")) { $envVars["S3_BUCKET"] } else { "$ProjectId-media" }
        $newPublicUrl = "https://storage.googleapis.com/$bucketName"
        $envVars["PUBLIC_BASE_URL"] = $newPublicUrl
        Write-Host "      PUBLIC_BASE_URL adapte vers Cloud Storage: $newPublicUrl" -ForegroundColor DarkGray
        Write-Host "      Note: Mettre a jour avec URL Cloud CDN apres creation" -ForegroundColor Yellow
    }
} else {
    # Creer PUBLIC_BASE_URL si absent
    $bucketName = if ($envVars.ContainsKey("S3_BUCKET")) { $envVars["S3_BUCKET"] } else { "$ProjectId-media" }
    $newPublicUrl = "https://storage.googleapis.com/$bucketName"
    $envVars["PUBLIC_BASE_URL"] = $newPublicUrl
    Write-Host "   PUBLIC_BASE_URL cree pour Cloud Storage: $newPublicUrl" -ForegroundColor Gray
}

# Adapter WebSocket/WebRTC URLs
if ($envVars.ContainsKey("WEBSOCKET_URL")) {
    Write-Host "   Adaptation de WEBSOCKET_URL..." -ForegroundColor Gray
    $oldWsUrl = $envVars["WEBSOCKET_URL"]
    # Adapter vers Cloud Run URL (sera mis a jour apres deploiement)
    $envVars["WEBSOCKET_URL"] = "wss://$ServiceName-$ProjectId.a.run.app/ws"
    Write-Host "      WEBSOCKET_URL adapte vers Cloud Run" -ForegroundColor DarkGray
}

if ($envVars.ContainsKey("WEBRTC_URL")) {
    Write-Host "   Adaptation de WEBRTC_URL..." -ForegroundColor Gray
    $oldWebRtcUrl = $envVars["WEBRTC_URL"]
    # Adapter vers Cloud Run URL
    $envVars["WEBRTC_URL"] = "https://$ServiceName-$ProjectId.a.run.app/webrtc"
    Write-Host "      WEBRTC_URL adapte vers Cloud Run" -ForegroundColor DarkGray
}

# Adapter API URLs
if ($envVars.ContainsKey("API_URL")) {
    Write-Host "   Adaptation de API_URL..." -ForegroundColor Gray
    $envVars["API_URL"] = "https://$ServiceName-$ProjectId.a.run.app"
    Write-Host "      API_URL adapte vers Cloud Run" -ForegroundColor DarkGray
}

# Variables essentielles par defaut
if (-not $envVars.ContainsKey("ENABLE_AUTO_MIGRATIONS")) {
    $envVars["ENABLE_AUTO_MIGRATIONS"] = "true"
}
if (-not $envVars.ContainsKey("SQLX_OFFLINE")) {
    $envVars["SQLX_OFFLINE"] = "true"
}
if (-not $envVars.ContainsKey("RUST_LOG")) {
    $envVars["RUST_LOG"] = "info"
}
if (-not $envVars.ContainsKey("ENVIRONMENT")) {
    $envVars["ENVIRONMENT"] = "production"
}
if (-not $envVars.ContainsKey("ALLOWED_ORIGINS")) {
    $envVars["ALLOWED_ORIGINS"] = "https://api.yukpo.com,https://yukpo.com"
}

# Verifier la variable de periode gratuite (3 mois)
if (-not $envVars.ContainsKey("FREE_PRODUCT_CREATION_PERIOD_MONTHS")) {
    $envVars["FREE_PRODUCT_CREATION_PERIOD_MONTHS"] = "3"
    Write-Host "   Variable FREE_PRODUCT_CREATION_PERIOD_MONTHS ajoutee: 3" -ForegroundColor Gray
} else {
    Write-Host "   Variable FREE_PRODUCT_CREATION_PERIOD_MONTHS trouvee: $($envVars['FREE_PRODUCT_CREATION_PERIOD_MONTHS'])" -ForegroundColor Gray
}

# Chercher d'autres variables de periode gratuite
$freePeriodVars = @("FREE_PERIOD_MONTHS", "GRATUIT_PERIOD_MONTHS", "LAUNCH_PHASE_MONTHS", "TRIAL_PERIOD_MONTHS", "LAUNCH_PHASE_START_DATE")
foreach ($varName in $freePeriodVars) {
    if ($envVars.ContainsKey($varName)) {
        Write-Host "   Variable de periode gratuite trouvee: $varName = $($envVars[$varName])" -ForegroundColor Gray
    }
}

# Verifier LAUNCH_PHASE_START_DATE (variable importante pour la periode gratuite)
if ($envVars.ContainsKey("LAUNCH_PHASE_START_DATE")) {
    Write-Host "   LAUNCH_PHASE_START_DATE recuperee: $($envVars['LAUNCH_PHASE_START_DATE'])" -ForegroundColor Green
} else {
    # Si non trouvee, utiliser la date actuelle
    $launchStartDate = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
    $envVars["LAUNCH_PHASE_START_DATE"] = $launchStartDate
    Write-Host "   LAUNCH_PHASE_START_DATE ajoutee avec date actuelle: $launchStartDate" -ForegroundColor Gray
}

# Mettre a jour JWT_SECRET si genere
if (-not $envVars.ContainsKey("JWT_SECRET") -or [string]::IsNullOrEmpty($envVars["JWT_SECRET"])) {
    $envVars["JWT_SECRET"] = $JwtSecret
}

Write-Host "   Variables adaptees pour GCP" -ForegroundColor Green
Write-Host ""

# Generer les mots de passe
Write-Host "Generation automatique des secrets..." -ForegroundColor Yellow
$DbRootPassword = -join ((48..57) + (65..90) + (97..122) + (33..47) | Get-Random -Count 32 | ForEach-Object {[char]$_})
$DbUserPassword = -join ((48..57) + (65..90) + (97..122) + (33..47) | Get-Random -Count 32 | ForEach-Object {[char]$_})
$JwtSecret = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 64 | ForEach-Object {[char]$_})
Write-Host "Secrets generes automatiquement" -ForegroundColor Green
Write-Host ""

# Creer Cloud SQL (PostgreSQL)
Write-Host "Creation de Cloud SQL (PostgreSQL)..." -ForegroundColor Yellow
Write-Host "   (Cela peut prendre 5-10 minutes...)" -ForegroundColor Gray

$ErrorActionPreference = "Continue"
$dbExists = gcloud sql instances describe $DbInstanceName --format="value(name)" 2>&1 | Select-String -Pattern "^yukpo-db$"
$ErrorActionPreference = "Stop"

if (-not $dbExists) {
    gcloud sql instances create $DbInstanceName `
        --database-version=POSTGRES_15 `
        --tier=db-f1-micro `
        --region=$Region `
        --root-password=$DbRootPassword `
        --storage-type=SSD `
        --storage-size=20GB `
        --backup-start-time=03:00 `
        --enable-bin-log `
        --project=$ProjectId
    
    Write-Host "Instance Cloud SQL creee" -ForegroundColor Green
} else {
    Write-Host "Instance Cloud SQL existe deja" -ForegroundColor Green
}

# Creer la base de donnees
Write-Host "Creation de la base de donnees..." -ForegroundColor Yellow
$ErrorActionPreference = "Continue"
$dbDatabaseExists = gcloud sql databases describe $DbName --instance=$DbInstanceName --format="value(name)" 2>&1 | Select-String -Pattern "^$DbName$"
$ErrorActionPreference = "Stop"

if (-not $dbDatabaseExists) {
    gcloud sql databases create $DbName --instance=$DbInstanceName --project=$ProjectId
    Write-Host "Base de donnees creee: $DbName" -ForegroundColor Green
} else {
    Write-Host "Base de donnees existe deja: $DbName" -ForegroundColor Green
}

# Creer l'utilisateur
Write-Host "Creation de l'utilisateur de base de donnees..." -ForegroundColor Yellow
$ErrorActionPreference = "Continue"
$dbUserExists = gcloud sql users list --instance=$DbInstanceName --format="value(name)" 2>&1 | Select-String -Pattern "^$DbUser$"
$ErrorActionPreference = "Stop"

if (-not $dbUserExists) {
    gcloud sql users create $DbUser `
        --instance=$DbInstanceName `
        --password=$DbUserPassword `
        --project=$ProjectId
    Write-Host "Utilisateur cree: $DbUser" -ForegroundColor Green
} else {
    Write-Host "Utilisateur existe deja: $DbUser" -ForegroundColor Green
}

Write-Host "Base de donnees configuree" -ForegroundColor Green
Write-Host ""

# Obtenir l'IP publique de l'instance
Write-Host "Recuperation de l'adresse IP de l'instance..." -ForegroundColor Yellow
$dbIp = gcloud sql instances describe $DbInstanceName --format="value(ipAddresses[0].ipAddress)" --project=$ProjectId
$DatabaseUrl = "postgresql://${DbUser}:$DbUserPassword@${dbIp}:5432/${DbName}?sslmode=require"

Write-Host "Adresse IP: $dbIp" -ForegroundColor Green
Write-Host ""

# Creer Service Account pour GitHub Actions
Write-Host "Configuration du Service Account pour GitHub Actions..." -ForegroundColor Yellow
$saName = "github-actions"
$saEmail = "${saName}@${ProjectId}.iam.gserviceaccount.com"

$ErrorActionPreference = "Continue"
$saExists = gcloud iam service-accounts describe $saEmail --project=$ProjectId 2>&1 | Select-String -Pattern "email"
$ErrorActionPreference = "Stop"

if (-not $saExists) {
    gcloud iam service-accounts create $saName `
        --display-name="GitHub Actions" `
        --project=$ProjectId
    
    # Assigner les permissions
    gcloud projects add-iam-policy-binding $ProjectId `
        --member="serviceAccount:$saEmail" `
        --role="roles/run.admin"
    
    gcloud projects add-iam-policy-binding $ProjectId `
        --member="serviceAccount:$saEmail" `
        --role="roles/storage.admin"
    
    gcloud projects add-iam-policy-binding $ProjectId `
        --member="serviceAccount:$saEmail" `
        --role="roles/cloudsql.client"
    
    gcloud projects add-iam-policy-binding $ProjectId `
        --member="serviceAccount:$saEmail" `
        --role="roles/cloudbuild.builds.builder"
    
    gcloud projects add-iam-policy-binding $ProjectId `
        --member="serviceAccount:$saEmail" `
        --role="roles/storage.objectAdmin"
}

# Creer la clé JSON
Write-Host "Generation de la clé Service Account..." -ForegroundColor Yellow
$keyFile = "gcp-sa-key.json"
if (Test-Path $keyFile) {
    Remove-Item $keyFile -Force
}

gcloud iam service-accounts keys create $keyFile `
    --iam-account=$saEmail `
    --project=$ProjectId

$saKeyContent = Get-Content $keyFile -Raw

Write-Host "Service Account configure: $saEmail" -ForegroundColor Green
Write-Host ""

# Configurer les secrets GitHub
Write-Host "Configuration des secrets GitHub..." -ForegroundColor Yellow
$ghCmd = Get-Command gh -ErrorAction SilentlyContinue
if ($ghCmd) {
    $ghAuth = gh auth status 2>$null
    if ($LASTEXITCODE -ne 0) {
        gh auth login
    }
    
    # Secrets GCP de base
    Write-Host "   Configuration des secrets GCP de base..." -ForegroundColor Gray
    gh secret set GCP_SA_KEY --body $saKeyContent --repo $GitHubRepo 2>$null
    gh secret set GCP_DATABASE_URL --body $DatabaseUrl --repo $GitHubRepo 2>$null
    gh secret set GCP_PROJECT_ID --body $ProjectId --repo $GitHubRepo 2>$null
    
    # Configurer TOUTES les variables d'environnement comme secrets GitHub
    Write-Host "   Configuration de toutes les variables d'environnement ($($envVars.Count) variables)..." -ForegroundColor Gray
    $secretCount = 0
    foreach ($key in $envVars.Keys) {
        $value = $envVars[$key]
        $secretName = "GCP_ENV_$key"
        try {
            gh secret set $secretName --body $value --repo $GitHubRepo 2>$null
            $secretCount++
            if ($secretCount % 10 -eq 0) {
                Write-Host "      [$secretCount/$($envVars.Count)] variables configurees..." -ForegroundColor DarkGray
            }
        } catch {
            Write-Host "      ATTENTION: Impossible de configurer $secretName" -ForegroundColor Yellow
        }
    }
    
    Write-Host "   $secretCount secrets GitHub configures" -ForegroundColor Green
    Write-Host "Secrets GitHub configures automatiquement" -ForegroundColor Green
} else {
    Write-Host "GitHub CLI non disponible - Secrets a configurer manuellement" -ForegroundColor Yellow
    Write-Host "   GCP_SA_KEY: (contenu de $keyFile)" -ForegroundColor Gray
    Write-Host "   GCP_DATABASE_URL: $DatabaseUrl" -ForegroundColor Gray
    Write-Host "   GCP_PROJECT_ID: $ProjectId" -ForegroundColor Gray
    Write-Host "   Toutes les variables d'environnement sont dans: $envVarsFile" -ForegroundColor Gray
    Write-Host "   Configurez-les manuellement dans GitHub Secrets avec le prefixe GCP_ENV_" -ForegroundColor Yellow
}

# Nettoyer la clé locale
if (Test-Path $keyFile) {
    Remove-Item $keyFile -Force
}

Write-Host ""

# Creer Cloud Storage Bucket (si S3_BUCKET existe)
$bucketName = $null
if ($envVars.ContainsKey("S3_BUCKET")) {
    $bucketName = $envVars["S3_BUCKET"]
} else {
    $bucketName = "$ProjectId-media"
    $envVars["S3_BUCKET"] = $bucketName
    Write-Host "   S3_BUCKET cree: $bucketName" -ForegroundColor Gray
}

Write-Host "Creation du bucket Cloud Storage..." -ForegroundColor Yellow
$ErrorActionPreference = "Continue"
$bucketExists = gcloud storage buckets describe gs://$bucketName --project=$ProjectId 2>&1 | Select-String -Pattern "name"
$ErrorActionPreference = "Stop"

if (-not $bucketExists) {
    gcloud storage buckets create gs://$bucketName `
        --location=$Region `
        --uniform-bucket-level-access `
        --project=$ProjectId
    Write-Host "Bucket Cloud Storage cree: $bucketName" -ForegroundColor Green
    
    # Desactiver public access prevention pour permettre l'acces public en lecture
    Write-Host "   Desactivation de public access prevention..." -ForegroundColor Gray
    gcloud storage buckets update gs://$bucketName `
        --public-access-prevention=inherited `
        --project=$ProjectId 2>&1 | Out-Null
    
    # Configurer les permissions pour le Service Account
    Write-Host "   Configuration des permissions du bucket..." -ForegroundColor Gray
    gcloud storage buckets add-iam-policy-binding gs://$bucketName `
        --member="serviceAccount:$saEmail" `
        --role="roles/storage.objectAdmin" `
        --project=$ProjectId 2>&1 | Out-Null
    
    # Permettre l'acces public en lecture (pour CDN)
    Write-Host "   Configuration de l'acces public en lecture..." -ForegroundColor Gray
    gcloud storage buckets add-iam-policy-binding gs://$bucketName `
        --member="allUsers" `
        --role="roles/storage.objectViewer" `
        --project=$ProjectId 2>&1 | Out-Null
    
    Write-Host "   Permissions configurees" -ForegroundColor Green
} else {
    Write-Host "Bucket Cloud Storage existe deja: $bucketName" -ForegroundColor Green
}

# Creer Service Account pour Cloud Storage (si necessaire)
Write-Host "Configuration du Service Account pour Cloud Storage..." -ForegroundColor Yellow
$storageSaName = "cloud-storage-sa"
$storageSaEmail = "${storageSaName}@${ProjectId}.iam.gserviceaccount.com"

$ErrorActionPreference = "Continue"
$storageSaExists = gcloud iam service-accounts describe $storageSaEmail --project=$ProjectId 2>&1 | Select-String -Pattern "email"
$ErrorActionPreference = "Stop"

if (-not $storageSaExists) {
    gcloud iam service-accounts create $storageSaName `
        --display-name="Cloud Storage Service Account" `
        --project=$ProjectId
    
    # Assigner les permissions
    gcloud projects add-iam-policy-binding $ProjectId `
        --member="serviceAccount:$storageSaEmail" `
        --role="roles/storage.objectAdmin" `
        2>&1 | Out-Null
    
    Write-Host "Service Account Cloud Storage cree: $storageSaEmail" -ForegroundColor Green
    
    # Creer une clé JSON pour Cloud Storage (pour compatibilité S3)
    Write-Host "   Generation de la clé Service Account pour Cloud Storage..." -ForegroundColor Gray
    $storageKeyFile = "gcp-storage-sa-key.json"
    if (Test-Path $storageKeyFile) {
        Remove-Item $storageKeyFile -Force
    }
    
    gcloud iam service-accounts keys create $storageKeyFile `
        --iam-account=$storageSaEmail `
        --project=$ProjectId 2>&1 | Out-Null
    
    # Extraire les credentials pour S3_ACCESS_KEY et S3_SECRET_KEY
    $storageKeyContent = Get-Content $storageKeyFile -Raw | ConvertFrom-Json
    $envVars["S3_ACCESS_KEY"] = $storageKeyContent.client_email
    $envVars["S3_SECRET_KEY"] = $storageKeyContent.private_key
    
    Write-Host "   Credentials Cloud Storage configures (S3_ACCESS_KEY/S3_SECRET_KEY)" -ForegroundColor Green
    
    # Nettoyer la clé locale
    if (Test-Path $storageKeyFile) {
        Remove-Item $storageKeyFile -Force
    }
} else {
    Write-Host "Service Account Cloud Storage existe deja: $storageSaEmail" -ForegroundColor Green
}

# Configurer Cloud CDN (si disponible)
Write-Host "Configuration de Cloud CDN..." -ForegroundColor Yellow
$ErrorActionPreference = "Continue"
$cdnBackendExists = gcloud compute backend-buckets describe $bucketName-cdn-backend --project=$ProjectId 2>&1 | Select-String -Pattern "name"
$ErrorActionPreference = "Stop"

if (-not $cdnBackendExists) {
    Write-Host "   Creation du backend bucket pour Cloud CDN..." -ForegroundColor Gray
    gcloud compute backend-buckets create $bucketName-cdn-backend `
        --gcs-bucket-name=$bucketName `
        --project=$ProjectId 2>&1 | Out-Null
    
    Write-Host "   Backend bucket Cloud CDN cree: $bucketName-cdn-backend" -ForegroundColor Green
    
    # Creer une distribution Cloud CDN
    Write-Host "   Creation de la distribution Cloud CDN..." -ForegroundColor Gray
    $cdnName = "$bucketName-cdn"
    
    # Note: Cloud CDN nécessite un Load Balancer, ce qui est plus complexe
    # Pour l'instant, on utilise directement Cloud Storage avec URL publique
    Write-Host "   Note: Cloud CDN complet necessite un Load Balancer" -ForegroundColor Yellow
    Write-Host "   Pour l'instant, utilisation directe de Cloud Storage" -ForegroundColor Yellow
    
    # Mettre a jour UPLOAD_BASE_URL et PUBLIC_BASE_URL avec l'URL Cloud Storage
    $cloudStorageUrl = "https://storage.googleapis.com/$bucketName"
    if (-not ($envVars["UPLOAD_BASE_URL"] -match "cdn\.|cloudfront\.|cloudflare")) {
        $envVars["UPLOAD_BASE_URL"] = $cloudStorageUrl
        Write-Host "   UPLOAD_BASE_URL mis a jour: $cloudStorageUrl" -ForegroundColor Gray
    }
    if (-not ($envVars["PUBLIC_BASE_URL"] -match "cdn\.|cloudfront\.|cloudflare")) {
        $envVars["PUBLIC_BASE_URL"] = $cloudStorageUrl
        Write-Host "   PUBLIC_BASE_URL mis a jour: $cloudStorageUrl" -ForegroundColor Gray
    }
} else {
    Write-Host "Backend bucket Cloud CDN existe deja" -ForegroundColor Green
}

Write-Host ""

# Preparer les variables d'environnement pour Cloud Run
Write-Host "Preparation des variables d'environnement pour Cloud Run..." -ForegroundColor Yellow
$envVarsString = @()
foreach ($key in $envVars.Keys) {
    $value = $envVars[$key]
    # Echapper les caracteres speciaux
    $escapedValue = $value -replace '"', '\"' -replace '$', '\$' -replace '`', '\`'
    $envVarsString += "$key=`"$escapedValue`""
}

$envVarsForCloudRun = $envVarsString -join ","

Write-Host "   $($envVars.Count) variables preparees pour Cloud Run" -ForegroundColor Green
Write-Host ""

# Sauvegarder les variables dans un fichier pour reference
$envVarsFile = "gcp-env-vars.json"
$envVars | ConvertTo-Json -Depth 10 | Out-File -FilePath $envVarsFile -Encoding UTF8
Write-Host "Variables sauvegardees dans: $envVarsFile" -ForegroundColor Gray
Write-Host ""

# Resumé
Write-Host ""
Write-Host "Migration terminee avec succes !" -ForegroundColor Green
Write-Host "====================================" -ForegroundColor Green
Write-Host ""
Write-Host "Informations importantes:" -ForegroundColor Cyan
Write-Host "   Project ID: $ProjectId" -ForegroundColor White
Write-Host "   Region: $Region" -ForegroundColor White
Write-Host "   Database Instance: $DbInstanceName" -ForegroundColor White
Write-Host "   Database Name: $DbName" -ForegroundColor White
Write-Host "   Database User: $DbUser" -ForegroundColor White
Write-Host "   Database IP: $dbIp" -ForegroundColor White
Write-Host "   Service Account: $saEmail" -ForegroundColor White
Write-Host ""
Write-Host "Secrets generes (SAUVEGARDEZ CES INFORMATIONS):" -ForegroundColor Yellow
Write-Host "   Database Root Password: $DbRootPassword" -ForegroundColor Red
Write-Host "   Database User Password: $DbUserPassword" -ForegroundColor Red
Write-Host "   JWT_SECRET: $JwtSecret" -ForegroundColor Red
Write-Host ""
Write-Host "IMPORTANT: Sauvegardez ces secrets dans un endroit sur !" -ForegroundColor Red
Write-Host ""
Write-Host "Variables d'environnement recuperees:" -ForegroundColor Cyan
Write-Host "   Total: $($envVars.Count) variables" -ForegroundColor White
Write-Host "   Fichier de reference: $envVarsFile" -ForegroundColor White
Write-Host ""
Write-Host "Prochaines etapes:" -ForegroundColor Cyan
Write-Host "   1. Configurer GitHub Actions workflow (deja cree)" -ForegroundColor White
Write-Host "   2. Les variables d'environnement seront configurees automatiquement dans Cloud Run" -ForegroundColor White
Write-Host "   3. Push vers GitHub pour declencher le build et le deploiement" -ForegroundColor White
Write-Host "   4. Les migrations seront executees automatiquement (ENABLE_AUTO_MIGRATIONS=true)" -ForegroundColor White
Write-Host ""

Write-Host "Script termine !" -ForegroundColor Green

