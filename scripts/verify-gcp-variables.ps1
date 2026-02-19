# Script de vérification des variables d'environnement GCP Cloud Run
# Usage: .\scripts\verify-gcp-variables.ps1

param(
    [string]$ProjectId = "yukpo-project",
    [string]$Region = "europe-west1",
    [string]$ServiceName = "yukpo-backend"
)

Write-Host "🔍 Vérification des variables d'environnement GCP Cloud Run..." -ForegroundColor Yellow
Write-Host ""

# Vérifier que gcloud est installé
if (-not (Get-Command gcloud -ErrorAction SilentlyContinue)) {
    Write-Host "❌ gcloud CLI n'est pas installé" -ForegroundColor Red
    exit 1
}

# Variables critiques à vérifier
$requiredEnvVars = @(
    "DB_POOL_SIZE",
    "DB_POOL_MIN_SIZE",
    "DB_ACQUIRE_TIMEOUT_SECS",
    "CLOUD_RUN",
    "ENVIRONMENT",
    "OPENAI_API_KEY"
)

$requiredSecrets = @(
    "openai-api-key",
    "jwt-secret",
    "database-url"
)

$optionalSecrets = @(
    "mistral-api-key",
    "gemini-api-key",
    "anthropic-api-key"
)

Write-Host "📋 Vérification des secrets dans Secret Manager..." -ForegroundColor Cyan

# Vérifier les secrets requis
$missingSecrets = @()
foreach ($secret in $requiredSecrets) {
    $secretExists = gcloud secrets describe $secret --project=$ProjectId 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✅ Secret '$secret' existe" -ForegroundColor Green
    } else {
        Write-Host "  ❌ Secret '$secret' MANQUANT" -ForegroundColor Red
        $missingSecrets += $secret
    }
}

# Vérifier les secrets optionnels
Write-Host ""
Write-Host "📋 Vérification des secrets optionnels..." -ForegroundColor Cyan
foreach ($secret in $optionalSecrets) {
    $secretExists = gcloud secrets describe $secret --project=$ProjectId 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✅ Secret '$secret' existe" -ForegroundColor Green
    } else {
        Write-Host "  ⚠️  Secret '$secret' non configuré (optionnel)" -ForegroundColor Yellow
    }
}

# Récupérer la configuration Cloud Run
Write-Host ""
Write-Host "📋 Vérification de la configuration Cloud Run..." -ForegroundColor Cyan

$serviceConfig = gcloud run services describe $ServiceName --region=$Region --project=$ProjectId --format=json 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ❌ Impossible de récupérer la configuration du service" -ForegroundColor Red
    Write-Host "  Erreur: $serviceConfig" -ForegroundColor Red
    exit 1
}

$serviceJson = $serviceConfig | ConvertFrom-Json

# Vérifier les variables d'environnement
Write-Host ""
Write-Host "📋 Variables d'environnement configurées:" -ForegroundColor Cyan
$envVars = $serviceJson.spec.template.spec.containers[0].env
$configuredVars = @{}
foreach ($envVar in $envVars) {
    if ($envVar.name) {
        $configuredVars[$envVar.name] = $true
        Write-Host "  ✅ $($envVar.name)" -ForegroundColor Green
    }
}

# Vérifier les secrets référencés
Write-Host ""
Write-Host "📋 Secrets référencés:" -ForegroundColor Cyan
$envFrom = $serviceJson.spec.template.spec.containers[0].envFrom
if ($envFrom) {
    foreach ($secretRef in $envFrom) {
        if ($secretRef.secretRef) {
            $secretName = $secretRef.secretRef.name
            Write-Host "  ✅ Secret référencé: $secretName" -ForegroundColor Green
        }
    }
} else {
    Write-Host "  ⚠️  Aucun secret référencé via envFrom" -ForegroundColor Yellow
}

# Vérifier les variables critiques
Write-Host ""
Write-Host "📋 Vérification des variables critiques..." -ForegroundColor Cyan
$missingVars = @()
foreach ($var in $requiredEnvVars) {
    if ($configuredVars.ContainsKey($var)) {
        Write-Host "  ✅ $var est configurée" -ForegroundColor Green
    } else {
        Write-Host "  ❌ $var MANQUANTE" -ForegroundColor Red
        $missingVars += $var
    }
}

# Résumé
Write-Host ""
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "📊 RÉSUMÉ" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan

if ($missingSecrets.Count -eq 0 -and $missingVars.Count -eq 0) {
    Write-Host "✅ Toutes les variables critiques sont configurées!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Prochaines étapes:" -ForegroundColor Yellow
    Write-Host "  1. Vérifier les logs Cloud Run pour confirmer le chargement"
    Write-Host "  2. Tester les appels IA"
    Write-Host "  3. Vérifier que le pool DB n'est plus saturé"
} else {
    Write-Host "❌ Variables manquantes détectées:" -ForegroundColor Red
    Write-Host ""
    if ($missingSecrets.Count -gt 0) {
        Write-Host "  Secrets manquants:" -ForegroundColor Red
        foreach ($secret in $missingSecrets) {
            Write-Host "    - $secret" -ForegroundColor Red
        }
        Write-Host ""
        Write-Host "  Pour créer un secret:" -ForegroundColor Yellow
        Write-Host "    echo -n 'votre-valeur' | gcloud secrets create $secret --project=$ProjectId --data-file=-" -ForegroundColor Gray
    }
    if ($missingVars.Count -gt 0) {
        Write-Host "  Variables d'environnement manquantes:" -ForegroundColor Red
        foreach ($var in $missingVars) {
            Write-Host "    - $var" -ForegroundColor Red
        }
        Write-Host ""
        Write-Host "  Pour ajouter une variable:" -ForegroundColor Yellow
        Write-Host "    gcloud run services update $ServiceName --region=$Region --project=$ProjectId --update-env-vars='$var=valeur'" -ForegroundColor Gray
    }
    Write-Host ""
    Write-Host "Consultez GUIDE_CONFIGURATION_VARIABLES_GCP.md pour plus de détails" -ForegroundColor Yellow
}

Write-Host ""


