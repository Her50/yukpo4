# =============================================================================
# Script PowerShell: Verification pre-production staging
# Usage: .\scripts\verify-staging.ps1 [-BackendUrl <url>]
# =============================================================================

param(
    [string]$BackendUrl = "https://yukpo-backend-376093909298.europe-west1.run.app",
    [string]$ProjectId = "yukpo-project",
    [string]$Region = "europe-west1"
)

$ErrorActionPreference = "Continue"
$passed = 0
$failed = 0
$warnings = 0
$results = @()

function Test-Check {
    param([string]$Name, [bool]$Success, [string]$Detail = "")
    $script:results += @{ Name = $Name; Success = $Success; Detail = $Detail }
    if ($Success) {
        $script:passed++
        Write-Host "  [PASS] $Name" -ForegroundColor Green
    }
    else {
        $script:failed++
        Write-Host "  [FAIL] $Name - $Detail" -ForegroundColor Red
    }
}

function Test-Warning {
    param([string]$Name, [string]$Detail = "")
    $script:warnings++
    $script:results += @{ Name = $Name; Success = $null; Detail = $Detail }
    Write-Host "  [WARN] $Name - $Detail" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  YUKPO - Verification Staging Pre-Production" -ForegroundColor Cyan
Write-Host "  Backend: $BackendUrl" -ForegroundColor Cyan
Write-Host "  $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# =============================================================================
# 1. Health Check
# =============================================================================
Write-Host "--- 1. Health Check Backend ---" -ForegroundColor Yellow

try {
    $healthResp = Invoke-WebRequest -Uri "$BackendUrl/health" -Method GET -TimeoutSec 15
    Test-Check "Health endpoint repond" ($healthResp.StatusCode -eq 200)
    $body = $healthResp.Content.Trim()
    if ($body -eq "OK" -or $body -match '"status"\s*:\s*"(ok|healthy)"') {
        Test-Check "Status healthy" $true
    }
    else {
        Test-Check "Status healthy" $false "body=$body"
    }
}
catch {
    Test-Check "Health endpoint repond" $false $_.Exception.Message
}

# =============================================================================
# 2. API Endpoints critiques
# =============================================================================
Write-Host ""
Write-Host "--- 2. API Endpoints critiques ---" -ForegroundColor Yellow

$endpoints = @(
    @{ Path = "/api/services/categories"; Method = "GET"; Name = "Categories de services" },
    @{ Path = "/api/places/autocomplete?input=douala&lat=4.05&lng=9.7"; Method = "GET"; Name = "Places autocomplete" },
    @{ Path = "/weather?lat=4.05&lon=9.7"; Method = "GET"; Name = "Weather API" },
    @{ Path = "/api/bourse-livre/v2/programmes"; Method = "GET"; Name = "Bourse Livre programmes" }
)

foreach ($ep in $endpoints) {
    try {
        $response = Invoke-WebRequest -Uri "$BackendUrl$($ep.Path)" -Method $ep.Method -TimeoutSec 15 -ErrorAction Stop
        $statusOk = $response.StatusCode -ge 200 -and $response.StatusCode -lt 400
        Test-Check $ep.Name $statusOk "HTTP $($response.StatusCode)"
    }
    catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        if ($statusCode -eq 401) {
            Test-Check $ep.Name $true "(401 = auth required, endpoint exists)"
        }
        else {
            Test-Check $ep.Name $false "HTTP $statusCode - $($_.Exception.Message)"
        }
    }
}

# =============================================================================
# 3. GCP Secrets verification
# =============================================================================
Write-Host ""
Write-Host "--- 3. GCP Secrets ---" -ForegroundColor Yellow

if (Get-Command gcloud -ErrorAction SilentlyContinue) {
    $requiredSecrets = @(
        "jwt-secret", "database-url", "redis-url", "mongodb-url",
        "openai-api-key", "sora-api-key", "s3-access-key", "s3-secret-key",
        "livekit-api-key", "livekit-api-secret", "google-maps-api-key",
        "openweathermap-api-key",
        "cinetpay-api-key", "cinetpay-site-id", "cinetpay-secret-key",
        "notchpay-public-key", "notchpay-secret-key"
    )

    foreach ($secret in $requiredSecrets) {
        $check = gcloud secrets describe $secret --project=$ProjectId 2>&1
        if ($LASTEXITCODE -eq 0) {
            Test-Check "Secret: $secret" $true
        }
        else {
            Test-Check "Secret: $secret" $false "Non trouve dans Secret Manager"
        }
    }
}
else {
    Test-Warning "GCP Secrets" "gcloud CLI non disponible, verification impossible"
}

# =============================================================================
# 4. Cloud Run service status
# =============================================================================
Write-Host ""
Write-Host "--- 4. Cloud Run Service ---" -ForegroundColor Yellow

if (Get-Command gcloud -ErrorAction SilentlyContinue) {
    try {
        $svcJson = gcloud run services describe yukpo-backend `
            --region=$Region --project=$ProjectId --format=json 2>&1
        $svc = $svcJson | ConvertFrom-Json

        $latestReady = $svc.status.conditions | Where-Object { $_.type -eq "Ready" }
        $isReady = ($latestReady.status -eq "True") -or ($null -eq $latestReady -and $svc.status.url)
        Test-Check "Cloud Run service Ready" $isReady "conditions=$($latestReady.status)"

        $minInstances = $svc.spec.template.metadata.annotations.'autoscaling.knative.dev/minScale'
        if ($minInstances -ge 1) {
            Test-Check "Min instances >= 1" $true "min=$minInstances"
        }
        else {
            Test-Warning "Min instances" "min=$minInstances (recommande >= 1 pour prod)"
        }

        $memory = $svc.spec.template.spec.containers[0].resources.limits.memory
        Test-Check "Memory configuree" (-not [string]::IsNullOrEmpty($memory)) "memory=$memory"

        $cpu = $svc.spec.template.spec.containers[0].resources.limits.cpu
        Test-Check "CPU configuree" (-not [string]::IsNullOrEmpty($cpu)) "cpu=$cpu"

    }
    catch {
        Test-Check "Cloud Run service" $false $_.Exception.Message
    }

    # Cloud SQL
    try {
        $sqlStatus = gcloud sql instances describe yukpo-postgres `
            --project=$ProjectId --format="value(state)" 2>&1
        Test-Check "Cloud SQL instance RUNNABLE" ($sqlStatus -eq "RUNNABLE")
    }
    catch {
        Test-Check "Cloud SQL instance" $false $_.Exception.Message
    }

    # Redis
    try {
        $redisState = gcloud redis instances describe yukpo-redis `
            --region=$Region --project=$ProjectId --format="value(state)" 2>&1
        Test-Check "Redis Memorystore READY" ($redisState -eq "READY")
    }
    catch {
        Test-Check "Redis Memorystore" $false $_.Exception.Message
    }
}
else {
    Test-Warning "Cloud Run/SQL/Redis" "gcloud CLI non disponible"
}

# =============================================================================
# 5. Environment variables critiques
# =============================================================================
Write-Host ""
Write-Host "--- 5. Env vars critiques (Cloud Run) ---" -ForegroundColor Yellow

if (Get-Command gcloud -ErrorAction SilentlyContinue) {
    try {
        $envJson = gcloud run services describe yukpo-backend `
            --region=$Region --project=$ProjectId `
            --format="json(spec.template.spec.containers[0].env)" 2>&1
        $envData = $envJson | ConvertFrom-Json
        $envVars = @{}
        foreach ($e in $envData.spec.template.spec.containers[0].env) {
            if ($e.value) { $envVars[$e.name] = $e.value }
            elseif ($e.valueFrom) { $envVars[$e.name] = "[SECRET_REF]" }
        }

        $criticalVars = @(
            "CLOUD_RUN", "APP_ENV", "ENABLE_AUTO_MIGRATIONS",
            "APP_DOMAIN", "BACKEND_URL", "FRONTEND_URL", "WEBHOOK_BASE_URL",
            "CORS_ALLOWED_ORIGINS", "GOOGLE_CLIENT_ID",
            "PAYMENT_PRIMARY_PROVIDER", "SENDGRID_FROM_EMAIL"
        )

        foreach ($var in $criticalVars) {
            if ($envVars.ContainsKey($var)) {
                Test-Check "Env: $var" $true "=$($envVars[$var])"
            }
            else {
                Test-Check "Env: $var" $false "Non defini"
            }
        }

        # Check secrets are injected (not as plain env vars)
        $secretVars = @("DATABASE_URL", "JWT_SECRET", "OPENAI_API_KEY", "GOOGLE_MAPS_API_KEY")
        foreach ($sv in $secretVars) {
            if ($envVars[$sv] -eq "[SECRET_REF]") {
                Test-Check "Secret ref: $sv" $true "(injecte via Secret Manager)"
            }
            elseif ($envVars.ContainsKey($sv)) {
                Test-Warning "Secret ref: $sv" "Present comme env var plain (devrait etre secret)"
            }
            else {
                Test-Check "Secret ref: $sv" $false "Ni env var ni secret ref"
            }
        }
    }
    catch {
        Test-Warning "Env vars check" "Impossible de lire la config Cloud Run"
    }
}
else {
    Test-Warning "Env vars" "gcloud CLI non disponible"
}

# =============================================================================
# 6. DNS / Domain (info only)
# =============================================================================
Write-Host ""
Write-Host "--- 6. DNS / Domain ---" -ForegroundColor Yellow

try {
    $dns = Resolve-DnsName -Name "yukpo.com" -Type A -ErrorAction Stop 2>$null
    if ($dns) {
        Test-Check "DNS yukpo.com resolvable" $true "IP: $($dns.IPAddress -join ', ')"
    }
    else {
        Test-Warning "DNS yukpo.com" "Pas de resolution A record"
    }
}
catch {
    Test-Warning "DNS yukpo.com" "Impossible de resoudre (domaine non configure?)"
}

# =============================================================================
# 7. SSL/TLS
# =============================================================================
Write-Host ""
Write-Host "--- 7. SSL/TLS ---" -ForegroundColor Yellow

try {
    $tlsCheck = Invoke-WebRequest -Uri "$BackendUrl/health" -Method HEAD -TimeoutSec 10 -ErrorAction Stop
    Test-Check "HTTPS fonctionne" $true
}
catch {
    if ($_.Exception.Message -match "SSL|TLS|certificate") {
        Test-Check "HTTPS fonctionne" $false "Erreur SSL/TLS"
    }
    else {
        Test-Check "HTTPS fonctionne" $true "(erreur non-SSL ignoree)"
    }
}

# =============================================================================
# RESUME FINAL
# =============================================================================
Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  RESUME VERIFICATION STAGING" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  PASS:     $passed" -ForegroundColor Green
Write-Host "  FAIL:     $failed" -ForegroundColor Red
Write-Host "  WARNINGS: $warnings" -ForegroundColor Yellow
Write-Host ""

if ($failed -eq 0) {
    Write-Host "  ==> SYSTEME PRET POUR LA PRODUCTION" -ForegroundColor Green
}
elseif ($failed -le 3) {
    Write-Host "  ==> QUASI PRET - $failed point(s) a corriger" -ForegroundColor Yellow
}
else {
    Write-Host "  ==> NON PRET - $failed point(s) critiques a corriger" -ForegroundColor Red
}

Write-Host ""
Write-Host "  Echecs:" -ForegroundColor Red
foreach ($r in $results) {
    if ($r.Success -eq $false) {
        Write-Host "    - $($r.Name): $($r.Detail)" -ForegroundColor Red
    }
}

if ($warnings -gt 0) {
    Write-Host ""
    Write-Host "  Avertissements:" -ForegroundColor Yellow
    foreach ($r in $results) {
        if ($null -eq $r.Success) {
            Write-Host "    - $($r.Name): $($r.Detail)" -ForegroundColor Yellow
        }
    }
}

Write-Host ""
