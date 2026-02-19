# Script complet pour synchroniser toutes les variables AWS vers GCP
# Récupère depuis AWS (SSM + Secrets Manager), vérifie dans GCP, et crée/mette à jour
# Usage: .\scripts\sync-aws-to-gcp-variables.ps1

param(
    [string]$AwsRegion = "eu-west-1",
    [string]$AwsProfile = "default",
    [string]$AwsProjectName = "yukpo",
    [string]$AwsEnvironment = "production",
    [string]$GcpProjectId = "yukpo-project",
    [string]$GcpRegion = "europe-west1",
    [string]$GcpServiceName = "yukpo-backend",
    [switch]$DryRun = $false,
    [switch]$FixPoolSize = $true
)

$ErrorActionPreference = "Continue"

Write-Host "🔄 Synchronisation Variables AWS → GCP" -ForegroundColor Yellow
Write-Host "=========================================" -ForegroundColor Yellow
Write-Host ""

# Vérifier les prérequis
if (-not (Get-Command aws -ErrorAction SilentlyContinue)) {
    Write-Host "❌ ERREUR: AWS CLI n'est pas installé" -ForegroundColor Red
    exit 1
}

if (-not (Get-Command gcloud -ErrorAction SilentlyContinue)) {
    Write-Host "❌ ERREUR: gcloud CLI n'est pas installé" -ForegroundColor Red
    exit 1
}

# Vérifier l'authentification AWS
Write-Host "🔍 Vérification AWS..." -ForegroundColor Cyan
$awsIdentity = aws sts get-caller-identity --profile $AwsProfile --region $AwsRegion 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Erreur d'authentification AWS" -ForegroundColor Red
    exit 1
}
Write-Host "✅ AWS authentifié" -ForegroundColor Green

# Vérifier l'authentification GCP
Write-Host "🔍 Vérification GCP..." -ForegroundColor Cyan
gcloud config set project $GcpProjectId | Out-Null
$gcpAuth = gcloud auth list --filter=status:ACTIVE --format="value(account)" 2>&1
if (-not $gcpAuth) {
    Write-Host "⚠️  Authentification GCP requise" -ForegroundColor Yellow
    gcloud auth login
}
Write-Host "✅ GCP authentifié: $gcpAuth" -ForegroundColor Green
Write-Host ""

# Récupérer le service account Cloud Run
Write-Host "🔍 Récupération du service account Cloud Run..." -ForegroundColor Cyan
$GcpServiceAccount = gcloud run services describe $GcpServiceName `
    --region=$GcpRegion `
    --format="value(spec.template.spec.serviceAccountName)" `
    --project=$GcpProjectId 2>&1

if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrEmpty($GcpServiceAccount)) {
    Write-Host "⚠️  Service account non trouvé, utilisation du compte par défaut" -ForegroundColor Yellow
    $GcpServiceAccount = "$GcpProjectId@appspot.gserviceaccount.com"
}
Write-Host "✅ Service Account: $GcpServiceAccount" -ForegroundColor Green
Write-Host ""

# ============================================
# FONCTIONS
# ============================================

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
        return $result.Trim()
    }
    return $null
}

function Get-AwsSecret {
    param([string]$SecretName, [string]$SecretKey)
    
    try {
        $allSecrets = aws secretsmanager list-secrets `
            --profile $AwsProfile `
            --region $AwsRegion `
            --output json 2>&1 | ConvertFrom-Json
        
        if ($LASTEXITCODE -ne 0) {
            return $null
        }
        
        foreach ($secret in $allSecrets.SecretList) {
            if ($secret.ARN -like "*$AwsProjectName/backend*" -or $secret.Name -like "*$AwsProjectName*") {
                $secretValue = aws secretsmanager get-secret-value `
                    --secret-id $secret.ARN `
                    --profile $AwsProfile `
                    --region $AwsRegion `
                    --query "SecretString" `
                    --output text 2>&1
                
                if ($LASTEXITCODE -eq 0 -and $secretValue) {
                    try {
                        $json = $secretValue | ConvertFrom-Json
                        if ($json.PSObject.Properties.Name -contains $SecretKey) {
                            return $json.$SecretKey.Trim()
                        }
                    } catch {
                        if ($SecretKey -eq $SecretName) {
                            return $secretValue.Trim()
                        }
                    }
                }
            }
        }
    } catch {
        Write-Host "  ⚠️  Erreur: $_" -ForegroundColor Yellow
    }
    return $null
}

function Get-GcpSecret {
    param([string]$SecretName)
    
    $result = gcloud secrets describe $SecretName --project=$GcpProjectId 2>&1
    if ($LASTEXITCODE -eq 0) {
        $value = gcloud secrets versions access latest --secret=$SecretName --project=$GcpProjectId 2>&1
        if ($LASTEXITCODE -eq 0) {
            return $value.Trim()
        }
    }
    return $null
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
# MAPPING AWS → GCP
# ============================================

$mapping = @{
    # Secrets Manager → GCP Secret Manager
    "DATABASE_URL" = @{
        Source = "SecretsManager"
        SourceKey = "DATABASE_URL"
        Target = "database-url"
        IsSecret = $true
        Adapt = { param($v) return $v }  # Garder tel quel (doit être adapté manuellement pour Cloud SQL)
    }
    "REDIS_URL" = @{
        Source = "SecretsManager"
        SourceKey = "REDIS_URL"
        Target = "redis-url"
        IsSecret = $true
        Adapt = { param($v) return $v }  # Garder tel quel (doit être adapté manuellement pour Memorystore)
    }
    "JWT_SECRET" = @{
        Source = "SecretsManager"
        SourceKey = "JWT_SECRET"
        Target = "jwt-secret"
        IsSecret = $true
        Adapt = { param($v) return $v }
    }
    "MONGODB_URL" = @{
        Source = "SecretsManager"
        SourceKey = "MONGODB_URL"
        Target = "mongodb-url"
        IsSecret = $true
        Adapt = { param($v) return $v }
    }
    "OPENAI_API_KEY" = @{
        Source = "SecretsManager"
        SourceKey = "OPENAI_API_KEY"
        Target = "openai-api-key"
        IsSecret = $true
        Adapt = { param($v) return $v }
    }
    "MISTRAL_API_KEY" = @{
        Source = "SecretsManager"
        SourceKey = "MISTRAL_API_KEY"
        Target = "mistral-api-key"
        IsSecret = $true
        Adapt = { param($v) return $v }
    }
    "GEMINI_API_KEY" = @{
        Source = "SecretsManager"
        SourceKey = "GEMINI_API_KEY"
        Target = "gemini-api-key"
        IsSecret = $true
        Adapt = { param($v) return $v }
    }
    "ANTHROPIC_API_KEY" = @{
        Source = "SecretsManager"
        SourceKey = "ANTHROPIC_API_KEY"
        Target = "anthropic-api-key"
        IsSecret = $true
        Adapt = { param($v) return $v }
    }
    
    # SSM Parameter Store → GCP Variables ou Secrets
    "S3_BUCKET" = @{
        Source = "SSM"
        SourceKey = "S3_BUCKET"
        Target = "S3_BUCKET"  # Variable d'environnement (non-secret)
        IsSecret = $false
        Adapt = { param($v) return $v }  # Adapter manuellement pour GCS
    }
    "S3_REGION" = @{
        Source = "SSM"
        SourceKey = "S3_REGION"
        Target = "S3_REGION"
        IsSecret = $false
        Adapt = {
            param($v)
            $regionMap = @{
                "eu-west-1" = "europe-west1"
                "us-east-1" = "us-east1"
                "us-west-1" = "us-west1"
            }
            if ($regionMap.ContainsKey($v)) {
                return $regionMap[$v]
            }
            return $v
        }
    }
    "UPLOAD_BASE_URL" = @{
        Source = "SSM"
        SourceKey = "UPLOAD_BASE_URL"
        Target = "UPLOAD_BASE_URL"
        IsSecret = $false
        Adapt = {
            param($v)
            # Adapter S3 → GCS
            $v = $v -replace "s3\.([^.]+)\.amazonaws\.com", "storage.googleapis.com"
            return $v
        }
    }
    "LAUNCH_PHASE_START_DATE" = @{
        Source = "SSM"
        SourceKey = "LAUNCH_PHASE_START_DATE"
        Target = "LAUNCH_PHASE_START_DATE"
        IsSecret = $false
        Adapt = { param($v) return $v }
    }
}

# Variables d'environnement fixes pour GCP
$gcpFixedVars = @{
    "CLOUD_RUN" = "true"
    "ENVIRONMENT" = "production"
    "APP_ENV" = "production"
    "HOST" = "0.0.0.0"
    "PORT" = "8080"
    "RUST_LOG" = "info"
    "LOG_FORMAT" = "json"
    "SQLX_OFFLINE" = "true"
    "ENABLE_AUTO_MIGRATIONS" = "true"
}

# Variables critiques à corriger (pool DB)
if ($FixPoolSize) {
    $gcpFixedVars["DB_POOL_SIZE"] = "10"
    $gcpFixedVars["DB_POOL_MIN_SIZE"] = "2"
    $gcpFixedVars["DB_ACQUIRE_TIMEOUT_SECS"] = "30"
}

# ============================================
# RÉCUPÉRATION DEPUIS AWS
# ============================================

Write-Host "📥 Récupération des variables depuis AWS..." -ForegroundColor Cyan
Write-Host ""

$awsVars = @{}
$secretsToCreate = @{}
$envVarsToSet = $gcpFixedVars.Clone()

foreach ($key in $mapping.Keys) {
    $config = $mapping[$key]
    Write-Host "🔍 $key..." -ForegroundColor Cyan
    
    $value = $null
    if ($config.Source -eq "SecretsManager") {
        $value = Get-AwsSecret -SecretName $key -SecretKey $config.SourceKey
    } elseif ($config.Source -eq "SSM") {
        $value = Get-AwsSsmParameter -ParameterName $config.SourceKey
    }
    
    if ($value) {
        $adaptedValue = & $config.Adapt $value
        $awsVars[$key] = $adaptedValue
        
        if ($config.IsSecret) {
            $secretsToCreate[$config.Target] = @{
                Name = $key
                Value = $adaptedValue
            }
            Write-Host "  ✅ Récupéré (secret)" -ForegroundColor Green
        } else {
            $envVarsToSet[$config.Target] = $adaptedValue
            Write-Host "  ✅ Récupéré (variable)" -ForegroundColor Green
        }
    } else {
        Write-Host "  ⚠️  Non trouvé dans AWS" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "✅ $($awsVars.Count) variables récupérées depuis AWS" -ForegroundColor Green
Write-Host ""

# ============================================
# VÉRIFICATION DANS GCP
# ============================================

Write-Host "🔍 Vérification dans GCP..." -ForegroundColor Cyan
Write-Host ""

$missingSecrets = @()
$missingVars = @()
$existingSecrets = @()
$existingVars = @{}

# Vérifier les secrets
foreach ($secretName in $secretsToCreate.Keys) {
    $gcpValue = Get-GcpSecret -SecretName $secretName
    if ($gcpValue) {
        $existingSecrets[$secretName] = $gcpValue
        Write-Host "  ✅ Secret '$secretName' existe dans GCP" -ForegroundColor Green
    } else {
        $missingSecrets += $secretName
        Write-Host "  ❌ Secret '$secretName' MANQUANT dans GCP" -ForegroundColor Red
    }
}

# Vérifier les variables d'environnement
foreach ($varName in $envVarsToSet.Keys) {
    $gcpValue = Get-GcpEnvVar -VarName $varName
    if ($gcpValue) {
        $existingVars[$varName] = $gcpValue
        if ($gcpValue -ne $envVarsToSet[$varName]) {
            Write-Host "  ⚠️  Variable '$varName' existe mais valeur différente" -ForegroundColor Yellow
            Write-Host "     GCP: $gcpValue" -ForegroundColor Gray
            Write-Host "     AWS: $($envVarsToSet[$varName])" -ForegroundColor Gray
        } else {
            Write-Host "  ✅ Variable '$varName' existe et correspond" -ForegroundColor Green
        }
    } else {
        $missingVars += $varName
        Write-Host "  ❌ Variable '$varName' MANQUANTE dans GCP" -ForegroundColor Red
    }
}

Write-Host ""

# ============================================
# CRÉATION/MISE À JOUR
# ============================================

if ($missingSecrets.Count -gt 0 -or $missingVars.Count -gt 0) {
    Write-Host "📤 Création/Mise à jour dans GCP..." -ForegroundColor Cyan
    Write-Host ""
    
    # Créer les secrets manquants
    foreach ($secretName in $missingSecrets) {
        $secret = $secretsToCreate[$secretName]
        Write-Host "🔐 Création secret: $secretName" -ForegroundColor Cyan
        if (Create-GcpSecret -SecretName $secretName -SecretValue $secret.Value) {
            Write-Host "  ✅ Secret créé" -ForegroundColor Green
        } else {
            Write-Host "  ❌ Erreur lors de la création" -ForegroundColor Red
        }
    }
    
    # Préparer la commande pour mettre à jour Cloud Run
    if (-not $DryRun) {
        Write-Host ""
        Write-Host "📋 Mise à jour Cloud Run..." -ForegroundColor Cyan
        
        # Construire la liste des variables d'environnement
        $envVarsList = @()
        foreach ($key in $envVarsToSet.Keys) {
            $envVarsList += "$key=$($envVarsToSet[$key])"
        }
        $envVarsStr = $envVarsList -join ","
        
        # Construire la liste des secrets
        $secretsList = @()
        foreach ($secretName in $secretsToCreate.Keys) {
            $originalName = $secretsToCreate[$secretName].Name
            $secretsList += "$originalName=$secretName:latest"
        }
        $secretsStr = $secretsList -join ","
        
        # Mettre à jour Cloud Run
        $updateCmd = "gcloud run services update $GcpServiceName " +
            "--region=$GcpRegion " +
            "--project=$GcpProjectId"
        
        if ($envVarsStr) {
            $updateCmd += " --update-env-vars=`"$envVarsStr`""
        }
        
        if ($secretsStr) {
            $updateCmd += " --update-secrets=`"$secretsStr`""
        }
        
        Write-Host "Exécution: $updateCmd" -ForegroundColor Yellow
        Invoke-Expression $updateCmd
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Cloud Run mis à jour" -ForegroundColor Green
        } else {
            Write-Host "❌ Erreur lors de la mise à jour" -ForegroundColor Red
        }
    }
} else {
    Write-Host "✅ Toutes les variables sont présentes dans GCP" -ForegroundColor Green
}

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "📊 RÉSUMÉ" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "Variables récupérées depuis AWS: $($awsVars.Count)" -ForegroundColor White
Write-Host "Secrets à créer/mettre à jour: $($missingSecrets.Count)" -ForegroundColor $(if ($missingSecrets.Count -eq 0) { "Green" } else { "Yellow" })
Write-Host "Variables à créer/mettre à jour: $($missingVars.Count)" -ForegroundColor $(if ($missingVars.Count -eq 0) { "Green" } else { "Yellow" })
Write-Host ""

if ($missingSecrets.Count -eq 0 -and $missingVars.Count -eq 0) {
    Write-Host "✅ Synchronisation complète!" -ForegroundColor Green
} else {
    Write-Host "⚠️  Actions requises:" -ForegroundColor Yellow
    if ($missingSecrets.Count -gt 0) {
        Write-Host "  - Créer $($missingSecrets.Count) secret(s) manquant(s)" -ForegroundColor Yellow
    }
    if ($missingVars.Count -gt 0) {
        Write-Host "  - Ajouter $($missingVars.Count) variable(s) manquante(s)" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "⚠️  IMPORTANT: Vérifiez et adaptez manuellement:" -ForegroundColor Yellow
Write-Host "  - DATABASE_URL: Doit pointer vers GCP Cloud SQL" -ForegroundColor Yellow
Write-Host "  - REDIS_URL: Doit pointer vers GCP Cloud Memorystore" -ForegroundColor Yellow
Write-Host "  - S3_*: Doit être adapté pour GCS (Google Cloud Storage)" -ForegroundColor Yellow
Write-Host ""


