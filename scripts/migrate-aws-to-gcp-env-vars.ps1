# Script PowerShell pour migrer toutes les variables d'environnement AWS vers GCP
# Usage: .\scripts\migrate-aws-to-gcp-env-vars.ps1

param(
    [string]$AwsRegion = "eu-west-1",
    [string]$AwsProfile = "default",
    [string]$AwsProjectName = "yukpo",
    [string]$AwsEnvironment = "production",
    [string]$GcpProjectId = "yukpo-project",
    [string]$GcpRegion = "europe-west1",
    [string]$GcpServiceAccount = "",
    [switch]$DryRun = $false
)

Write-Host "🔄 Migration Variables AWS → GCP" -ForegroundColor Yellow
Write-Host "=================================" -ForegroundColor Yellow
Write-Host ""

# Vérifier que AWS CLI est installé
if (-not (Get-Command aws -ErrorAction SilentlyContinue)) {
    Write-Host "❌ ERREUR: AWS CLI n'est pas installé" -ForegroundColor Red
    Write-Host "   Installez-le depuis: https://aws.amazon.com/cli/" -ForegroundColor Yellow
    exit 1
}

# Vérifier que gcloud est installé
if (-not (Get-Command gcloud -ErrorAction SilentlyContinue)) {
    Write-Host "❌ ERREUR: gcloud CLI n'est pas installé" -ForegroundColor Red
    Write-Host "   Installez-le depuis: https://cloud.google.com/sdk/docs/install" -ForegroundColor Yellow
    exit 1
}

# Vérifier l'authentification AWS
Write-Host "🔍 Vérification de l'authentification AWS..." -ForegroundColor Cyan
$awsIdentity = aws sts get-caller-identity --profile $AwsProfile --region $AwsRegion 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️  Erreur d'authentification AWS. Vérifiez votre profil: $AwsProfile" -ForegroundColor Yellow
    exit 1
}
Write-Host "✅ AWS authentifié" -ForegroundColor Green
Write-Host ""

# Vérifier l'authentification GCP
Write-Host "🔍 Vérification de l'authentification GCP..." -ForegroundColor Cyan
gcloud config set project $GcpProjectId | Out-Null
$gcpAuth = gcloud auth list --filter=status:ACTIVE --format="value(account)" 2>&1
if (-not $gcpAuth) {
    Write-Host "⚠️  Vous n'êtes pas authentifié GCP. Exécution de gcloud auth login..." -ForegroundColor Yellow
    gcloud auth login
}
Write-Host "✅ GCP authentifié: $gcpAuth" -ForegroundColor Green
Write-Host ""

# Récupérer le service account GCP si non fourni
if ([string]::IsNullOrEmpty($GcpServiceAccount)) {
    Write-Host "🔍 Récupération du service account Cloud Run..." -ForegroundColor Cyan
    $GcpServiceAccount = gcloud run services describe yukpo-backend `
        --region=$GcpRegion `
        --format="value(spec.template.spec.serviceAccountName)" `
        --project=$GcpProjectId 2>&1
    
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrEmpty($GcpServiceAccount)) {
        Write-Host "⚠️  Service account non trouvé, utilisation du compte par défaut" -ForegroundColor Yellow
        $GcpServiceAccount = "$GcpProjectId@appspot.gserviceaccount.com"
    }
}

Write-Host "✅ Service Account GCP: $GcpServiceAccount" -ForegroundColor Green
Write-Host ""

# Fonction pour récupérer une valeur depuis AWS SSM Parameter Store
function Get-AwsSsmParameter {
    param([string]$ParameterName)
    
    $fullPath = "/$AwsProjectName/$AwsEnvironment/$ParameterName"
    $result = aws ssm get-parameter `
        --name $fullPath `
        --with-decryption `
        --profile $AwsProfile `
        --region $AwsRegion `
        --query "Parameter.Value" `
        --output text 2>&1
    
    if ($LASTEXITCODE -eq 0 -and $result -and $result -ne "None") {
        return $result
    }
    return $null
}

# Fonction pour récupérer une valeur depuis AWS Secrets Manager
function Get-AwsSecret {
    param([string]$SecretName, [string]$SecretKey)
    
    $secretArn = "arn:aws:secretsmanager:$AwsRegion`:*:secret:$AwsProjectName/backend/secrets-*"
    $secrets = aws secretsmanager list-secrets `
        --profile $AwsProfile `
        --region $AwsRegion `
        --query "SecretList[?contains(ARN, '$AwsProjectName/backend')].ARN" `
        --output text 2>&1
    
    if ($LASTEXITCODE -ne 0) {
        return $null
    }
    
    foreach ($arn in $secrets) {
        $secretValue = aws secretsmanager get-secret-value `
            --secret-id $arn `
            --profile $AwsProfile `
            --region $AwsRegion `
            --query "SecretString" `
            --output text 2>&1
        
        if ($LASTEXITCODE -eq 0 -and $secretValue) {
            try {
                $json = $secretValue | ConvertFrom-Json
                if ($json.PSObject.Properties.Name -contains $SecretKey) {
                    return $json.$SecretKey
                }
            } catch {
                # Si ce n'est pas du JSON, retourner la valeur brute
                if ($SecretKey -eq $SecretName) {
                    return $secretValue
                }
            }
        }
    }
    return $null
}

# Fonction pour créer un secret dans GCP Secret Manager
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
    
    # Vérifier si le secret existe déjà
    $existing = gcloud secrets describe $SecretName --project=$GcpProjectId 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ⚠️  Secret $SecretName existe déjà, ajout d'une nouvelle version..." -ForegroundColor Yellow
        echo -n $SecretValue | gcloud secrets versions add $SecretName `
            --data-file=- `
            --project=$GcpProjectId 2>&1 | Out-Null
    } else {
        # Créer le secret
        if ([string]::IsNullOrEmpty($Description)) {
            $Description = "Migré depuis AWS - $SecretName"
        }
        echo -n $SecretValue | gcloud secrets create $SecretName `
            --data-file=- `
            --replication-policy="automatic" `
            --project=$GcpProjectId 2>&1 | Out-Null
        
        if ($LASTEXITCODE -ne 0) {
            Write-Host "  ❌ Erreur lors de la création du secret $SecretName" -ForegroundColor Red
            return $false
        }
    }
    
    # Donner accès au service account
    gcloud secrets add-iam-policy-binding $SecretName `
        --member="serviceAccount:$GcpServiceAccount" `
        --role="roles/secretmanager.secretAccessor" `
        --project=$GcpProjectId 2>&1 | Out-Null
    
    Write-Host "  ✅ Secret $SecretName créé/mis à jour" -ForegroundColor Green
    return $true
}

# Dictionnaire de mapping AWS → GCP
$mapping = @{
    # Secrets Manager → GCP Secret Manager
    "DATABASE_URL" = @{
        Source = "SecretsManager"
        SourceKey = "DATABASE_URL"
        Target = "database-url"
        Adapt = {
            param($value)
            # Adapter l'URL PostgreSQL pour GCP Cloud SQL
            # Format AWS: postgresql://user:pass@rds-endpoint:5432/db
            # Format GCP: postgresql://user:pass@/db?host=/cloudsql/project:region:instance
            # Pour l'instant, on garde la valeur mais on note qu'elle doit être adaptée
            Write-Host "    ⚠️  NOTE: DATABASE_URL doit être adaptée pour GCP Cloud SQL" -ForegroundColor Yellow
            return $value
        }
    }
    "REDIS_URL" = @{
        Source = "SecretsManager"
        SourceKey = "REDIS_URL"
        Target = "redis-url"
        Adapt = {
            param($value)
            # Adapter l'URL Redis pour GCP Cloud Memorystore
            # Format AWS: redis://elasticache-endpoint:6379
            # Format GCP: redis://memorystore-endpoint:6379
            Write-Host "    ⚠️  NOTE: REDIS_URL doit être adaptée pour GCP Cloud Memorystore" -ForegroundColor Yellow
            return $value
        }
    }
    "JWT_SECRET" = @{
        Source = "SecretsManager"
        SourceKey = "JWT_SECRET"
        Target = "jwt-secret"
        Adapt = { param($value) return $value }
    }
    "MONGODB_URL" = @{
        Source = "SecretsManager"
        SourceKey = "MONGODB_URL"
        Target = "mongodb-url"
        Adapt = { param($value) return $value }
    }
    "ENABLE_AUTO_MIGRATIONS" = @{
        Source = "SecretsManager"
        SourceKey = "ENABLE_AUTO_MIGRATIONS"
        Target = "enable-auto-migrations"
        Adapt = { param($value) return $value }
    }
    
    # SSM Parameter Store → GCP Secret Manager (secrets) ou Variables (non-secrets)
    "S3_BUCKET" = @{
        Source = "SSM"
        SourceKey = "S3_BUCKET"
        Target = "gcs-bucket"  # GCS = Google Cloud Storage
        Adapt = {
            param($value)
            # S3 → GCS: Le nom du bucket peut être différent
            Write-Host "    ⚠️  NOTE: S3_BUCKET doit être adapté pour GCS bucket name" -ForegroundColor Yellow
            return $value
        }
    }
    "S3_REGION" = @{
        Source = "SSM"
        SourceKey = "S3_REGION"
        Target = "gcs-region"
        Adapt = {
            param($value)
            # Adapter la région AWS → GCP
            $regionMap = @{
                "eu-west-1" = "europe-west1"
                "us-east-1" = "us-east1"
                "us-west-1" = "us-west1"
            }
            if ($regionMap.ContainsKey($value)) {
                return $regionMap[$value]
            }
            return $value
        }
    }
    "S3_ACCESS_KEY" = @{
        Source = "SSM"
        SourceKey = "S3_ACCESS_KEY"
        Target = "gcs-access-key"
        Adapt = {
            param($value)
            # GCS utilise des service account keys, pas des access keys
            Write-Host "    ⚠️  NOTE: S3_ACCESS_KEY doit être remplacé par GCS service account JSON" -ForegroundColor Yellow
            return $value
        }
    }
    "S3_SECRET_KEY" = @{
        Source = "SSM"
        SourceKey = "S3_SECRET_KEY"
        Target = "gcs-secret-key"
        Adapt = {
            param($value)
            # GCS utilise des service account keys, pas des secret keys
            Write-Host "    ⚠️  NOTE: S3_SECRET_KEY doit être remplacé par GCS service account JSON" -ForegroundColor Yellow
            return $value
        }
    }
    "UPLOAD_BASE_URL" = @{
        Source = "SSM"
        SourceKey = "UPLOAD_BASE_URL"
        Target = "upload-base-url"
        Adapt = {
            param($value)
            # Adapter l'URL pour GCS
            # Format AWS: https://s3.eu-west-1.amazonaws.com/bucket
            # Format GCP: https://storage.googleapis.com/bucket
            $value = $value -replace "s3\.([^.]+)\.amazonaws\.com", "storage.googleapis.com"
            return $value
        }
    }
    "LAUNCH_PHASE_START_DATE" = @{
        Source = "SSM"
        SourceKey = "LAUNCH_PHASE_START_DATE"
        Target = "launch-phase-start-date"
        Adapt = { param($value) return $value }
    }
}

# Variables d'environnement directes (non-secrets)
$envVars = @{
    "APP_ENV" = "production"
    "RUST_LOG" = "info"
    "HOST" = "0.0.0.0"
    "CLOUD_RUN" = "true"
    "SQLX_OFFLINE" = "true"
    "ENABLE_AUTO_MIGRATIONS" = "true"
    "APP_ENV" = "production"
}

# Variables GPU GCP (à vérifier si déjà configurées)
$gpuVars = @{
    "GPU_ENABLED" = "true"
    "GPU_ENDPOINT" = "http://yukpo-gpu-workers:8080"
    "GPU_ZONE" = "europe-west1-b"
    "GPU_INSTANCE_NAME" = "yukpo-gpu-worker"
    "GCP_PROJECT_ID" = $GcpProjectId
    "GPU_MONTHLY_BUDGET" = "100.0"
    "GPU_SCALE_UP_THRESHOLD" = "70.0"
    "GPU_SCALE_DOWN_THRESHOLD" = "20.0"
    "GPU_MAX_INSTANCES" = "3"
    "GPU_MIN_INSTANCES" = "0"
}

Write-Host "📥 Récupération des variables depuis AWS..." -ForegroundColor Cyan
Write-Host ""

$secretsToCreate = @{}
$envVarsToSet = $envVars.Clone()

# Récupérer les secrets depuis AWS
foreach ($key in $mapping.Keys) {
    $config = $mapping[$key]
    Write-Host "🔍 Récupération: $key" -ForegroundColor Cyan
    
    $value = $null
    if ($config.Source -eq "SecretsManager") {
        $value = Get-AwsSecret -SecretName $key -SecretKey $config.SourceKey
    } elseif ($config.Source -eq "SSM") {
        $value = Get-AwsSsmParameter -ParameterName $config.SourceKey
    }
    
    if ($value) {
        # Adapter la valeur
        $adaptedValue = & $config.Adapt $value
        $secretsToCreate[$config.Target] = @{
            Name = $key
            Value = $adaptedValue
        }
        Write-Host "  ✅ Valeur récupérée" -ForegroundColor Green
    } else {
        Write-Host "  ⚠️  Variable non trouvée dans AWS" -ForegroundColor Yellow
    }
    Write-Host ""
}

# Créer les secrets dans GCP
Write-Host "📤 Création des secrets dans GCP Secret Manager..." -ForegroundColor Cyan
Write-Host ""

foreach ($secretName in $secretsToCreate.Keys) {
    $secret = $secretsToCreate[$secretName]
    Write-Host "🔐 Création secret: $secretName ($($secret.Name))" -ForegroundColor Cyan
    Create-GcpSecret -SecretName $secretName -SecretValue $secret.Value | Out-Null
    Write-Host ""
}

# Ajouter les variables GPU
Write-Host "🎮 Ajout des variables GPU..." -ForegroundColor Cyan
foreach ($key in $gpuVars.Keys) {
    $envVarsToSet[$key] = $gpuVars[$key]
    Write-Host "  ✅ $key = $($gpuVars[$key])" -ForegroundColor Green
}
Write-Host ""

# Générer le fichier de configuration pour Cloud Run
Write-Host "📝 Génération du fichier de configuration Cloud Run..." -ForegroundColor Cyan

$envVarsJson = @{}
foreach ($key in $envVarsToSet.Keys) {
    $envVarsJson[$key] = $envVarsToSet[$key]
}

$secretsMapping = @{}
foreach ($secretName in $secretsToCreate.Keys) {
    $originalName = $secretsToCreate[$secretName].Name
    $secretsMapping[$originalName] = "$secretName:latest"
}

$output = @{
    envVars = $envVarsJson
    secrets = $secretsMapping
    gcpConfig = @{
        projectId = $GcpProjectId
        region = $GcpRegion
        serviceAccount = $GcpServiceAccount
    }
}

$outputFile = "gcp-env-config.json"
$output | ConvertTo-Json -Depth 10 | Out-File -FilePath $outputFile -Encoding UTF8

Write-Host "✅ Configuration sauvegardée dans: $outputFile" -ForegroundColor Green
Write-Host ""

# Afficher les commandes pour mettre à jour Cloud Run
Write-Host "📋 Commandes pour mettre à jour Cloud Run:" -ForegroundColor Yellow
Write-Host ""

$envVarsStr = ($envVarsJson.Keys | ForEach-Object { "$_=$($envVarsJson[$_])" }) -join ","
$secretsStr = ($secretsMapping.Keys | ForEach-Object { "$_=$($secretsMapping[$_]):latest" }) -join ","

Write-Host "gcloud run services update yukpo-backend \"
Write-Host "  --region=$GcpRegion \"
Write-Host "  --update-env-vars=`"$envVarsStr`" \"
Write-Host "  --update-secrets=`"$secretsStr`" \"
Write-Host "  --project=$GcpProjectId"
Write-Host ""

Write-Host "✅ Migration terminée!" -ForegroundColor Green
Write-Host ""
Write-Host "⚠️  IMPORTANT: Vérifiez et adaptez les valeurs suivantes:" -ForegroundColor Yellow
Write-Host "  - DATABASE_URL: Doit pointer vers GCP Cloud SQL" -ForegroundColor Yellow
Write-Host "  - REDIS_URL: Doit pointer vers GCP Cloud Memorystore" -ForegroundColor Yellow
Write-Host "  - S3_*: Doit être adapté pour GCS (Google Cloud Storage)" -ForegroundColor Yellow
Write-Host ""

