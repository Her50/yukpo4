# Script pour vérifier et corriger les variables GCP sans AWS
# Usage: .\scripts\sync-gcp-variables-check-only.ps1

param(
    [string]$GcpProjectId = "yukpo-project",
    [string]$GcpRegion = "europe-west1",
    [string]$GcpServiceName = "yukpo-backend",
    [switch]$FixPoolSize = $true
)

$ErrorActionPreference = "Continue"

Write-Host "🔍 Vérification et Correction Variables GCP" -ForegroundColor Yellow
Write-Host "===========================================" -ForegroundColor Yellow
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

# Variables critiques requises
$requiredVars = @{
    "DB_POOL_SIZE" = "10"
    "DB_POOL_MIN_SIZE" = "2"
    "DB_ACQUIRE_TIMEOUT_SECS" = "30"
    "CLOUD_RUN" = "true"
    "ENVIRONMENT" = "production"
    "APP_ENV" = "production"
    "HOST" = "0.0.0.0"
    "PORT" = "8080"
    "RUST_LOG" = "info"
    "SQLX_OFFLINE" = "true"
    "ENABLE_AUTO_MIGRATIONS" = "true"
}

$requiredSecrets = @(
    "database-url",
    "jwt-secret",
    "redis-url",
    "mongodb-url",
    "openai-api-key"
)

# Récupérer la configuration actuelle
Write-Host "📥 Récupération de la configuration Cloud Run..." -ForegroundColor Cyan
$serviceConfig = gcloud run services describe $GcpServiceName `
    --region=$GcpRegion `
    --project=$GcpProjectId `
    --format=json 2>&1 | ConvertFrom-Json

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Erreur lors de la récupération de la configuration" -ForegroundColor Red
    exit 1
}

# Analyser les variables actuelles
$currentEnvVars = @{}
$currentSecrets = @{}

if ($serviceConfig.spec.template.spec.containers[0].env) {
    foreach ($envVar in $serviceConfig.spec.template.spec.containers[0].env) {
        if ($envVar.value) {
            $currentEnvVars[$envVar.name] = $envVar.value
        } elseif ($envVar.valueFrom) {
            if ($envVar.valueFrom.secretKeyRef) {
                $currentSecrets[$envVar.name] = $envVar.valueFrom.secretKeyRef.name
            }
        }
    }
}

# Vérifier les secrets dans Secret Manager
Write-Host "🔍 Vérification des secrets dans Secret Manager..." -ForegroundColor Cyan
$existingSecrets = @()
$missingSecrets = @()

foreach ($secretName in $requiredSecrets) {
    $result = gcloud secrets describe $secretName --project=$GcpProjectId 2>&1
    if ($LASTEXITCODE -eq 0) {
        $existingSecrets += $secretName
        Write-Host "  ✅ Secret '$secretName' existe" -ForegroundColor Green
    } else {
        $missingSecrets += $secretName
        Write-Host "  ❌ Secret '$secretName' MANQUANT" -ForegroundColor Red
    }
}

Write-Host ""

# Vérifier les variables d'environnement
Write-Host "🔍 Vérification des variables d'environnement..." -ForegroundColor Cyan
$missingVars = @()
$varsToUpdate = @{}

foreach ($varName in $requiredVars.Keys) {
    if ($currentEnvVars.ContainsKey($varName)) {
        $currentValue = $currentEnvVars[$varName]
        $requiredValue = $requiredVars[$varName]
        
        if ($currentValue -ne $requiredValue) {
            Write-Host "  ⚠️  Variable '$varName' existe mais valeur différente" -ForegroundColor Yellow
            Write-Host "     Actuel: $currentValue" -ForegroundColor Gray
            Write-Host "     Requis: $requiredValue" -ForegroundColor Gray
            $varsToUpdate[$varName] = $requiredValue
        } else {
            Write-Host "  ✅ Variable '$varName' = $currentValue" -ForegroundColor Green
        }
    } else {
        Write-Host "  ❌ Variable '$varName' MANQUANTE" -ForegroundColor Red
        $missingVars += $varName
        $varsToUpdate[$varName] = $requiredVars[$varName]
    }
}

Write-Host ""

# Vérifier les secrets référencés
Write-Host "🔍 Vérification des secrets référencés..." -ForegroundColor Cyan
$secretsToAdd = @{}

foreach ($secretName in $requiredSecrets) {
    $varName = $secretName.ToUpper().Replace("-", "_")
    if ($secretName -eq "database-url") { $varName = "DATABASE_URL" }
    if ($secretName -eq "jwt-secret") { $varName = "JWT_SECRET" }
    if ($secretName -eq "redis-url") { $varName = "REDIS_URL" }
    if ($secretName -eq "mongodb-url") { $varName = "MONGODB_URL" }
    if ($secretName -eq "openai-api-key") { $varName = "OPENAI_API_KEY" }
    
    if (-not $currentSecrets.ContainsKey($varName)) {
        Write-Host "  ❌ Secret '$secretName' non référencé comme '$varName'" -ForegroundColor Red
        $secretsToAdd[$varName] = "$secretName:latest"
    } else {
        Write-Host "  ✅ Secret '$secretName' référencé comme '$varName'" -ForegroundColor Green
    }
}

Write-Host ""

# Résumé
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "📊 RÉSUMÉ" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

$needsUpdate = $false

if ($missingSecrets.Count -gt 0) {
    Write-Host "❌ Secrets manquants: $($missingSecrets.Count)" -ForegroundColor Red
    foreach ($secret in $missingSecrets) {
        Write-Host "   - $secret" -ForegroundColor Red
    }
    $needsUpdate = $true
    Write-Host ""
}

if ($missingVars.Count -gt 0 -or $varsToUpdate.Count -gt 0) {
    Write-Host "⚠️  Variables à mettre à jour: $($varsToUpdate.Count)" -ForegroundColor Yellow
    foreach ($var in $varsToUpdate.Keys) {
        Write-Host "   - $var = $($varsToUpdate[$var])" -ForegroundColor Yellow
    }
    $needsUpdate = $true
    Write-Host ""
}

if ($secretsToAdd.Count -gt 0) {
    Write-Host "⚠️  Secrets à référencer: $($secretsToAdd.Count)" -ForegroundColor Yellow
    foreach ($var in $secretsToAdd.Keys) {
        Write-Host "   - $var → $($secretsToAdd[$var])" -ForegroundColor Yellow
    }
    $needsUpdate = $true
    Write-Host ""
}

if (-not $needsUpdate) {
    Write-Host "✅ Toutes les variables sont correctement configurées!" -ForegroundColor Green
    Write-Host ""
    exit 0
}

# Proposer la mise à jour
Write-Host "📤 Mise à jour de Cloud Run..." -ForegroundColor Cyan
Write-Host ""

# Construire la commande de mise à jour
$envVarsList = @()
foreach ($key in $varsToUpdate.Keys) {
    $envVarsList += "$key=$($varsToUpdate[$key])"
}

# Ajouter les variables existantes qui ne changent pas
foreach ($key in $currentEnvVars.Keys) {
    if (-not $varsToUpdate.ContainsKey($key) -and $requiredVars.ContainsKey($key)) {
        $envVarsList += "$key=$($currentEnvVars[$key])"
    }
}

$envVarsStr = $envVarsList -join ","

# Construire la liste des secrets
$secretsList = @()
foreach ($var in $secretsToAdd.Keys) {
    $secretsList += "$var=$($secretsToAdd[$var])"
}

# Ajouter les secrets existants
foreach ($var in $currentSecrets.Keys) {
    if (-not $secretsToAdd.ContainsKey($var)) {
        $secretName = $currentSecrets[$var]
        $secretsList += "$var=$secretName:latest"
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

# Demander confirmation
$confirmation = Read-Host "Voulez-vous exécuter cette commande? (O/N)"
if ($confirmation -eq "O" -or $confirmation -eq "o" -or $confirmation -eq "Y" -or $confirmation -eq "y") {
    Write-Host "Exécution..." -ForegroundColor Cyan
    Invoke-Expression $updateCmd
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Cloud Run mis à jour avec succès!" -ForegroundColor Green
    } else {
        Write-Host "❌ Erreur lors de la mise à jour" -ForegroundColor Red
    }
} else {
    Write-Host "⚠️  Mise à jour annulée" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Vous pouvez exécuter la commande manuellement plus tard." -ForegroundColor Gray
}

Write-Host ""


