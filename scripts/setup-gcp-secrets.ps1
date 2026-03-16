# =============================================================================
# Script PowerShell: Configuration COMPLETE des secrets GCP Secret Manager
# Usage: .\scripts\setup-gcp-secrets.ps1 [-SkipExisting] [-OnlyMissing]
# =============================================================================

param(
    [string]$ProjectId = "yukpo-project",
    [string]$Region = "europe-west1",
    [string]$ServiceAccountEmail = "",
    [switch]$SkipExisting,
    [switch]$OnlyMissing
)

$ErrorActionPreference = "Continue"

# =============================================================================
# Liste COMPLETE des secrets requis pour la production
# =============================================================================
$REQUIRED_SECRETS = @(
    @{ Name = "jwt-secret";              EnvVar = "JWT_SECRET";              Desc = "JWT authentication secret" },
    @{ Name = "database-url";            EnvVar = "DATABASE_URL";            Desc = "PostgreSQL connection URL (Cloud SQL)" },
    @{ Name = "redis-url";               EnvVar = "REDIS_URL";              Desc = "Redis connection URL (Memorystore)" },
    @{ Name = "mongodb-url";             EnvVar = "MONGODB_URL";            Desc = "MongoDB connection URL" },
    @{ Name = "openai-api-key";          EnvVar = "OPENAI_API_KEY";         Desc = "OpenAI API key (GPT, embeddings)" },
    @{ Name = "sora-api-key";            EnvVar = "SORA_API_KEY";           Desc = "OpenAI Sora video generation API key" },
    @{ Name = "s3-access-key";           EnvVar = "S3_ACCESS_KEY";          Desc = "GCS/S3 access key" },
    @{ Name = "s3-secret-key";           EnvVar = "S3_SECRET_KEY";          Desc = "GCS/S3 secret key" },
    @{ Name = "livekit-api-key";         EnvVar = "LIVEKIT_API_KEY";        Desc = "LiveKit API key" },
    @{ Name = "livekit-api-secret";      EnvVar = "LIVEKIT_API_SECRET";     Desc = "LiveKit API secret" },
    @{ Name = "google-maps-api-key";     EnvVar = "GOOGLE_MAPS_API_KEY";    Desc = "Google Maps server API key (Places, Geocoding)" },
    @{ Name = "openweathermap-api-key";  EnvVar = "OPENWEATHERMAP_API_KEY"; Desc = "OpenWeatherMap API key (meteo)" },
    @{ Name = "cinetpay-api-key";        EnvVar = "CINETPAY_API_KEY";       Desc = "CinetPay payment API key" },
    @{ Name = "cinetpay-site-id";        EnvVar = "CINETPAY_SITE_ID";       Desc = "CinetPay site ID" },
    @{ Name = "cinetpay-secret-key";     EnvVar = "CINETPAY_SECRET_KEY";    Desc = "CinetPay secret key (webhook verification)" },
    @{ Name = "notchpay-public-key";     EnvVar = "NOTCHPAY_PUBLIC_KEY";    Desc = "NotchPay public key" },
    @{ Name = "notchpay-secret-key";     EnvVar = "NOTCHPAY_SECRET_KEY";    Desc = "NotchPay secret key" }
)

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  YUKPO - Configuration des secrets GCP Secret Manager" -ForegroundColor Cyan
Write-Host "  Projet: $ProjectId | Region: $Region" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# --- Verification gcloud ---
if (-not (Get-Command gcloud -ErrorAction SilentlyContinue)) {
    Write-Host "[ERREUR] gcloud CLI n'est pas installe" -ForegroundColor Red
    Write-Host "  Installez-le depuis: https://cloud.google.com/sdk/docs/install" -ForegroundColor Yellow
    exit 1
}

$authAccount = gcloud auth list --filter=status:ACTIVE --format="value(account)" 2>&1
if (-not $authAccount) {
    Write-Host "[!] Vous n'etes pas authentifie. Lancement de gcloud auth login..." -ForegroundColor Yellow
    gcloud auth login
    $authAccount = gcloud auth list --filter=status:ACTIVE --format="value(account)" 2>&1
}
Write-Host "[OK] Authentifie: $authAccount" -ForegroundColor Green

gcloud config set project $ProjectId 2>$null

# --- Service Account ---
if ([string]::IsNullOrEmpty($ServiceAccountEmail)) {
    $ServiceAccountEmail = gcloud run services describe yukpo-backend `
        --region=$Region `
        --format="value(spec.template.spec.serviceAccountName)" `
        --project=$ProjectId 2>&1
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrEmpty($ServiceAccountEmail)) {
        $ServiceAccountEmail = "376093909298-compute@developer.gserviceaccount.com"
    }
}
Write-Host "[OK] Service Account: $ServiceAccountEmail" -ForegroundColor Green
Write-Host ""

# =============================================================================
# Phase 1: Audit des secrets existants
# =============================================================================
Write-Host "--- Phase 1: Audit des secrets existants ---" -ForegroundColor Yellow

$existingSecrets = @()
$missingSecrets = @()

foreach ($secret in $REQUIRED_SECRETS) {
    $check = gcloud secrets describe $secret.Name --project=$ProjectId 2>&1
    if ($LASTEXITCODE -eq 0) {
        $existingSecrets += $secret
        Write-Host "  [EXISTS] $($secret.Name) ($($secret.Desc))" -ForegroundColor Green
    } else {
        $missingSecrets += $secret
        Write-Host "  [MISSING] $($secret.Name) ($($secret.Desc))" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "Resultat: $($existingSecrets.Count) existants, $($missingSecrets.Count) manquants" -ForegroundColor Cyan
Write-Host ""

if ($missingSecrets.Count -eq 0) {
    Write-Host "[OK] Tous les secrets sont deja configures!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Pour mettre a jour un secret existant:" -ForegroundColor Yellow
    Write-Host '  echo "NEW_VALUE" | gcloud secrets versions add SECRET_NAME --data-file=- --project=yukpo-project' -ForegroundColor White
    Write-Host ""
    exit 0
}

# =============================================================================
# Phase 2: Creation des secrets manquants
# =============================================================================
Write-Host "--- Phase 2: Creation des secrets manquants ---" -ForegroundColor Yellow
Write-Host ""

$secretsToCreate = if ($OnlyMissing) { $missingSecrets } else { $REQUIRED_SECRETS }

foreach ($secret in $secretsToCreate) {
    $isExisting = $existingSecrets | Where-Object { $_.Name -eq $secret.Name }
    
    if ($isExisting -and $SkipExisting) {
        Write-Host "  [SKIP] $($secret.Name) (existe deja)" -ForegroundColor Yellow
        continue
    }
    
    if ($isExisting) {
        $update = Read-Host "  $($secret.Name) existe deja. Mettre a jour? (o/N)"
        if ($update -ne "o" -and $update -ne "O") {
            Write-Host "  [SKIP] $($secret.Name)" -ForegroundColor Yellow
            continue
        }
    }
    
    Write-Host ""
    Write-Host "  Secret: $($secret.Name)" -ForegroundColor Cyan
    Write-Host "  Env var: $($secret.EnvVar)" -ForegroundColor Cyan
    Write-Host "  Description: $($secret.Desc)" -ForegroundColor Cyan
    
    $value = Read-Host "  Entrez la valeur (ou Entree pour ignorer)"
    
    if ([string]::IsNullOrEmpty($value)) {
        Write-Host "  [SKIP] $($secret.Name) (valeur vide)" -ForegroundColor Yellow
        continue
    }
    
    $tempFile = [System.IO.Path]::GetTempFileName()
    try {
        [System.IO.File]::WriteAllText($tempFile, $value, (New-Object System.Text.UTF8Encoding $false))
        
        if ($isExisting) {
            gcloud secrets versions add $secret.Name `
                --data-file=$tempFile `
                --project=$ProjectId 2>&1 | Out-Null
        } else {
            gcloud secrets create $secret.Name `
                --data-file=$tempFile `
                --replication-policy="automatic" `
                --project=$ProjectId 2>&1 | Out-Null
        }
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  [OK] Secret $($secret.Name) cree/mis a jour" -ForegroundColor Green
            
            # Accorder l'acces au service account
            gcloud secrets add-iam-policy-binding $secret.Name `
                --member="serviceAccount:$ServiceAccountEmail" `
                --role="roles/secretmanager.secretAccessor" `
                --project=$ProjectId 2>&1 | Out-Null
            
            if ($LASTEXITCODE -eq 0) {
                Write-Host "  [OK] Permissions accordees" -ForegroundColor Green
            }
        } else {
            Write-Host "  [ERREUR] Echec pour $($secret.Name)" -ForegroundColor Red
        }
    } finally {
        if (Test-Path $tempFile) { Remove-Item $tempFile -Force }
    }
}

# =============================================================================
# Phase 3: Verification finale
# =============================================================================
Write-Host ""
Write-Host "--- Phase 3: Verification finale ---" -ForegroundColor Yellow

$stillMissing = @()
foreach ($secret in $REQUIRED_SECRETS) {
    $check = gcloud secrets describe $secret.Name --project=$ProjectId 2>&1
    if ($LASTEXITCODE -ne 0) {
        $stillMissing += $secret
    }
}

if ($stillMissing.Count -eq 0) {
    Write-Host "[OK] Tous les $($REQUIRED_SECRETS.Count) secrets sont configures!" -ForegroundColor Green
} else {
    Write-Host "[!] $($stillMissing.Count) secret(s) encore manquant(s):" -ForegroundColor Yellow
    foreach ($s in $stillMissing) {
        Write-Host "  - $($s.Name) ($($s.EnvVar))" -ForegroundColor Red
    }
}

# =============================================================================
# Phase 4: Instructions LiveKit
# =============================================================================
Write-Host ""
Write-Host "--- Configuration LiveKit ---" -ForegroundColor Yellow
Write-Host "Le serveur LiveKit tourne sur: yukpo-livekit-server (GCE)" -ForegroundColor Cyan
Write-Host ""
Write-Host "Pour obtenir l'IP publique du serveur LiveKit:" -ForegroundColor White
Write-Host '  gcloud compute instances describe yukpo-livekit-server --zone=europe-west1-b --format="value(networkInterfaces[0].accessConfigs[0].natIP)"' -ForegroundColor Gray
Write-Host ""
Write-Host "Puis mettre a jour les env vars Cloud Run:" -ForegroundColor White
Write-Host '  gcloud run services update yukpo-backend --region=europe-west1 \' -ForegroundColor Gray
Write-Host '    --update-env-vars="LIVEKIT_API_URL=http://<IP>:7880,LIVEKIT_WS_URL=ws://<IP>:7880"' -ForegroundColor Gray
Write-Host ""

# =============================================================================
# Resume
# =============================================================================
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  RESUME - Secrets geres par gcp-deploy.yml --update-secrets" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
foreach ($s in $REQUIRED_SECRETS) {
    $status = if ($stillMissing | Where-Object { $_.Name -eq $s.Name }) { "[MISSING]" } else { "[OK]" }
    $color = if ($status -eq "[OK]") { "Green" } else { "Red" }
    Write-Host ("  {0,-10} {1,-30} -> {2}" -f $status, $s.Name, $s.EnvVar) -ForegroundColor $color
}
Write-Host ""
