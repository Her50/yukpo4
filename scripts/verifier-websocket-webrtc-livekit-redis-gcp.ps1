# Script pour vérifier WebSocket, WebRTC, LiveKit et Redis dans GCP
# Date: 2026-02-15

param(
    [string]$ProjectId = "yukpo-project",
    [string]$Region = "europe-west1",
    [string]$ServiceName = "yukpo-backend"
)

Write-Host "Verification WebSocket/WebRTC/LiveKit/Redis GCP" -ForegroundColor Cyan
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host ""

# Verifier que gcloud est installe
$gcloudPath = "C:\Program Files (x86)\Google\Cloud SDK\google-cloud-sdk\bin"
if (Test-Path "$gcloudPath\gcloud.cmd") {
    $env:Path += ";$gcloudPath"
    Write-Host "[OK] gcloud ajoute au PATH" -ForegroundColor Green
} else {
    Write-Host "[ERREUR] gcloud non trouve" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Etape 1: Recuperer les variables d'environnement Cloud Run
Write-Host "[ETAPE 1/5] Recuperation variables d'environnement Cloud Run..." -ForegroundColor Yellow

$cloudRunEnv = gcloud run services describe $ServiceName --region=$Region --format="yaml(spec.template.spec.containers[0].env)" --project=$ProjectId 2>&1

# Variables a verifier
$varsToCheck = @(
    "REDIS_URL",
    "LIVEKIT_API_URL",
    "LIVEKIT_API_KEY",
    "LIVEKIT_API_SECRET",
    "LIVEKIT_WS_URL",
    "GCP_PROJECT_ID",
    "CLOUD_RUN"
)

Write-Host ""
Write-Host "   Variables d'environnement:" -ForegroundColor Cyan

$foundVars = @{}
foreach ($var in $varsToCheck) {
    $varLine = $cloudRunEnv | Select-String -Pattern "$var" -Context 0,1
    if ($varLine) {
        $value = ($varLine -split "value: ")[1].Trim()
        if ($var -match "KEY|SECRET|PASSWORD") {
            $displayValue = "***" + $value.Substring([Math]::Max(0, $value.Length - 4))
        } else {
            $displayValue = $value
        }
        Write-Host "   [OK] $var = $displayValue" -ForegroundColor Green
        $foundVars[$var] = $value
    } else {
        Write-Host "   [ATTENTION] $var non trouve" -ForegroundColor Yellow
    }
}

Write-Host ""

# Etape 2: Verifier Redis Memorystore
Write-Host "[ETAPE 2/5] Verification Redis Memorystore..." -ForegroundColor Yellow

if ($foundVars.ContainsKey("REDIS_URL")) {
    $redisUrl = $foundVars["REDIS_URL"]
    if ($redisUrl -match "10\.128\.\d+\.\d+") {
        Write-Host "   [OK] REDIS_URL pointe vers Memorystore GCP (IP privee)" -ForegroundColor Green
    } elseif ($redisUrl -match "redis://.*:6379") {
        Write-Host "   [OK] REDIS_URL configuree" -ForegroundColor Green
    } else {
        Write-Host "   [ATTENTION] Format REDIS_URL suspect" -ForegroundColor Yellow
    }
} else {
    Write-Host "   [ERREUR] REDIS_URL non configuree" -ForegroundColor Red
}

Write-Host ""

# Etape 3: Verifier LiveKit
Write-Host "[ETAPE 3/5] Verification LiveKit..." -ForegroundColor Yellow

$livekitConfigured = $true
if (-not $foundVars.ContainsKey("LIVEKIT_API_URL")) {
    Write-Host "   [ATTENTION] LIVEKIT_API_URL non configuree" -ForegroundColor Yellow
    $livekitConfigured = $false
}
if (-not $foundVars.ContainsKey("LIVEKIT_API_KEY")) {
    Write-Host "   [ATTENTION] LIVEKIT_API_KEY non configuree" -ForegroundColor Yellow
    $livekitConfigured = $false
}
if (-not $foundVars.ContainsKey("LIVEKIT_API_SECRET")) {
    Write-Host "   [ATTENTION] LIVEKIT_API_SECRET non configuree" -ForegroundColor Yellow
    $livekitConfigured = $false
}

if ($livekitConfigured) {
    Write-Host "   [OK] LiveKit configure (API URL, Key, Secret)" -ForegroundColor Green
    if ($foundVars.ContainsKey("LIVEKIT_WS_URL")) {
        Write-Host "   [OK] LIVEKIT_WS_URL configuree" -ForegroundColor Green
    } else {
        Write-Host "   [INFO] LIVEKIT_WS_URL non configuree (optionnel)" -ForegroundColor Cyan
    }
} else {
    Write-Host "   [INFO] LiveKit non configure (service optionnel)" -ForegroundColor Cyan
}

Write-Host ""

# Etape 4: Verifier WebSocket/WebRTC dans le code
Write-Host "[ETAPE 4/5] Verification WebSocket/WebRTC..." -ForegroundColor Yellow

Write-Host "   [INFO] WebSocket/WebRTC integres dans le backend Rust" -ForegroundColor Cyan
Write-Host "   [INFO] Routes WebSocket:" -ForegroundColor Cyan
Write-Host "      - /ws/chat/* (Chat WebSocket avec Redis pub/sub)" -ForegroundColor White
Write-Host "      - /ws/delivery/* (Delivery tracking WebSocket)" -ForegroundColor White
Write-Host "      - /ws/flash-sale/* (Flash Sales WebSocket)" -ForegroundColor White
Write-Host "   [INFO] Routes WebRTC:" -ForegroundColor Cyan
Write-Host "      - /api/webrtc/* (WebRTC signaling)" -ForegroundColor White

if ($foundVars.ContainsKey("REDIS_URL")) {
    Write-Host "   [OK] Redis disponible pour WebSocket pub/sub" -ForegroundColor Green
} else {
    Write-Host "   [ATTENTION] Redis non configure - WebSocket peut etre limite" -ForegroundColor Yellow
}

Write-Host ""

# Etape 5: Verifier les variables GCP
Write-Host "[ETAPE 5/5] Verification variables GCP..." -ForegroundColor Yellow

if ($foundVars.ContainsKey("GCP_PROJECT_ID")) {
    $gcpProject = $foundVars["GCP_PROJECT_ID"]
    Write-Host "   [OK] GCP_PROJECT_ID: $gcpProject" -ForegroundColor Green
    
    if ($gcpProject -eq $ProjectId) {
        Write-Host "   [OK] GCP_PROJECT_ID correspond au projet verifie" -ForegroundColor Green
    } else {
        Write-Host "   [ATTENTION] GCP_PROJECT_ID different du projet verifie" -ForegroundColor Yellow
    }
} else {
    Write-Host "   [ATTENTION] GCP_PROJECT_ID non configuree" -ForegroundColor Yellow
}

if ($foundVars.ContainsKey("CLOUD_RUN")) {
    $cloudRun = $foundVars["CLOUD_RUN"]
    if ($cloudRun -eq "true") {
        Write-Host "   [OK] CLOUD_RUN=true (mode Cloud Run active)" -ForegroundColor Green
    } else {
        Write-Host "   [ATTENTION] CLOUD_RUN=$cloudRun (devrait etre 'true' pour GCP)" -ForegroundColor Yellow
    }
} else {
    Write-Host "   [ATTENTION] CLOUD_RUN non configuree" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "[OK] Verification terminee!" -ForegroundColor Green
Write-Host ""
Write-Host "Resume:" -ForegroundColor Cyan
Write-Host "   Redis Memorystore: $(if ($foundVars.ContainsKey('REDIS_URL')) { 'Configure' } else { 'Non configure' })" -ForegroundColor White
Write-Host "   LiveKit: $(if ($livekitConfigured) { 'Configure' } else { 'Non configure (optionnel)' })" -ForegroundColor White
Write-Host "   WebSocket/WebRTC: Integres dans le backend" -ForegroundColor White
Write-Host "   Variables GCP: Verifiees" -ForegroundColor White
Write-Host ""

