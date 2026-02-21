# Verifier et appliquer les variables CDN S3 GCP sur Cloud Run
# - Verifie les secrets HMAC (s3-access-key, s3-secret-key)
# - Verifie les variables d'environnement S3/CDN sur le service
# - Applique les valeurs GCP si manquantes
# Usage: .\scripts\verifier-et-appliquer-cdn-s3-gcp.ps1 [-Apply]

param(
    [string]$GcpProjectId = "yukpo-project",
    [string]$GcpRegion = "europe-west1",
    [string]$GcpServiceName = "yukpo-backend",
    [switch]$Apply = $false
)

$ErrorActionPreference = "Continue"

# Valeurs GCP attendues (CDN S3 naif GCP)
$ExpectedEnvVars = @{
    "UPLOAD_BASE_URL"    = "http://34.54.117.97"
    "PUBLIC_BASE_URL"    = "http://34.54.117.97"
    "S3_BUCKET"          = "yukpo-project-yukpo-backend-media"
    "S3_REGION"          = "europe-west1"
    "S3_ENDPOINT"        = "https://storage.googleapis.com"
    "S3_FORCE_PATH_STYLE" = "false"
}

Write-Host ""
Write-Host "=== Verification CDN S3 GCP ===" -ForegroundColor Cyan
Write-Host "Projet: $GcpProjectId | Service: $GcpServiceName | Region: $GcpRegion" -ForegroundColor Gray
Write-Host ""

# --- 1. Secrets HMAC GCS ---
Write-Host "1. Secrets HMAC GCS (s3-access-key, s3-secret-key)" -ForegroundColor Yellow
$secretOk = $true
foreach ($secretName in @("s3-access-key", "s3-secret-key")) {
    $out = gcloud secrets describe $secretName --project=$GcpProjectId --format="value(name)" 2>&1
    if ($LASTEXITCODE -eq 0 -and $out) {
        $versions = gcloud secrets versions list $secretName --project=$GcpProjectId --format="value(name)" --limit=1 2>&1
        if ($versions) {
            Write-Host "   OK $secretName existe (version(s) presente(s))" -ForegroundColor Green
        } else {
            Write-Host "   ATTENTION $secretName existe mais aucune version" -ForegroundColor Red
            $secretOk = $false
        }
    } else {
        Write-Host "   ERREUR $secretName absent ou inaccessible" -ForegroundColor Red
        $secretOk = $false
    }
}
Write-Host ""

# --- 2. Variables d'environnement Cloud Run ---
Write-Host "2. Variables d'environnement Cloud Run (S3/CDN)" -ForegroundColor Yellow
$jsonPath = Join-Path $PSScriptRoot "..\cloud-run-describe.json"
# Recuperer la config a jour
$describeOut = gcloud run services describe $GcpServiceName --region=$GcpRegion --project=$GcpProjectId --format="json" 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "   ERREUR impossible de decrire le service" -ForegroundColor Red
    exit 1
}
$spec = $describeOut | ConvertFrom-Json
$envList = @()
$envVars = @{}
foreach ($e in $spec.spec.template.spec.containers[0].env) {
    $name = $e.name
    if ($e.value) {
        $envVars[$name] = $e.value
    } elseif ($e.valueFrom.secretKeyRef) {
        $envVars[$name] = "[secret:" + $e.valueFrom.secretKeyRef.name + "]"
    }
}

$missing = @()
$wrong = @()
foreach ($key in $ExpectedEnvVars.Keys) {
    $expected = $ExpectedEnvVars[$key]
    if (-not $envVars.ContainsKey($key)) {
        $missing += $key
    } elseif ($envVars[$key] -ne $expected) {
        $wrong += "$key (actuel: $($envVars[$key]), attendu: $expected)"
    }
}

if ($missing.Count -eq 0 -and $wrong.Count -eq 0) {
    Write-Host "   OK Toutes les variables S3/CDN sont presentes et correctes" -ForegroundColor Green
    foreach ($key in $ExpectedEnvVars.Keys) {
        Write-Host "      $key = $($envVars[$key])" -ForegroundColor Gray
    }
} else {
    if ($missing.Count -gt 0) {
        Write-Host "   MANQUANT: $($missing -join ', ')" -ForegroundColor Red
    }
    if ($wrong.Count -gt 0) {
        Write-Host "   VALEUR INCORRECTE:" -ForegroundColor Red
        foreach ($w in $wrong) { Write-Host "      $w" -ForegroundColor Red }
    }
}

# --- 3. Application des variables si demande ---
$needApply = ($missing.Count -gt 0) -or ($wrong.Count -gt 0)
if ($needApply -and $Apply) {
    Write-Host ""
    Write-Host "3. Application des variables GCP sur Cloud Run..." -ForegroundColor Yellow
    $setVars = ($ExpectedEnvVars.GetEnumerator() | ForEach-Object { "$($_.Key)=$($_.Value)" }) -join ","
    $cmd = "gcloud run services update $GcpServiceName --region=$GcpRegion --project=$GcpProjectId --update-env-vars=`"$setVars`""
    Write-Host "   Commande: $cmd" -ForegroundColor Gray
    Invoke-Expression $cmd
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   OK Variables mises a jour." -ForegroundColor Green
    } else {
        Write-Host "   ERREUR lors de la mise a jour." -ForegroundColor Red
    }
} elseif ($needApply) {
    Write-Host ""
    Write-Host "3. Pour appliquer les variables GCP, relancer avec -Apply" -ForegroundColor Cyan
    Write-Host "   .\scripts\verifier-et-appliquer-cdn-s3-gcp.ps1 -Apply" -ForegroundColor White
}

# --- 4. Resume ---
Write-Host ""
Write-Host "=== Resume ===" -ForegroundColor Cyan
if ($secretOk -and -not $needApply) {
    Write-Host "Secrets HMAC et variables CDN S3 GCP sont OK." -ForegroundColor Green
} elseif ($secretOk -and $needApply -and $Apply) {
    Write-Host "Variables appliquees. Verifier les logs backend (MediaStorage) au prochain demarrage." -ForegroundColor Green
} elseif (-not $secretOk) {
    Write-Host "Corriger les secrets HMAC (create-cloud-storage-hmac-credentials.ps1 puis Secret Manager)." -ForegroundColor Yellow
} else {
    Write-Host "Variables S3/CDN manquantes ou incorrectes. Relancer avec -Apply pour les appliquer." -ForegroundColor Yellow
}
Write-Host ""
