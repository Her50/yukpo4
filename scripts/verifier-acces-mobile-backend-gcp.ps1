# Script pour vérifier que l'application mobile accède correctement au backend GCP
# Date: 2026-02-15

param(
    [string]$ProjectId = "yukpo-project",
    [string]$Region = "europe-west1",
    [string]$ServiceName = "yukpo-backend"
)

Write-Host "Verification Acces Mobile Backend GCP" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
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

# Etape 1: Recuperer l'URL du backend GCP
Write-Host "[ETAPE 1/4] Recuperation URL backend GCP..." -ForegroundColor Yellow

$backendUrl = gcloud run services describe $ServiceName --region=$Region --format="get(status.url)" --project=$ProjectId 2>&1

if ($LASTEXITCODE -eq 0 -and $backendUrl) {
    Write-Host "   [OK] URL backend GCP: $backendUrl" -ForegroundColor Green
} else {
    Write-Host "   [ERREUR] Impossible de recuperer l'URL" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Etape 2: Tester la connectivite
Write-Host "[ETAPE 2/4] Test de connectivite..." -ForegroundColor Yellow

try {
    $response = Invoke-WebRequest -Uri "$backendUrl/health" -UseBasicParsing -TimeoutSec 10
    if ($response.StatusCode -eq 200) {
        Write-Host "   [OK] Backend accessible - Status: $($response.StatusCode)" -ForegroundColor Green
        Write-Host "   [OK] Response: $($response.Content)" -ForegroundColor Green
    } else {
        Write-Host "   [ATTENTION] Status code: $($response.StatusCode)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   [ERREUR] Impossible de se connecter au backend" -ForegroundColor Red
    Write-Host "   [ERREUR] $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# Etape 3: Verifier la configuration mobile
Write-Host "[ETAPE 3/4] Verification configuration mobile..." -ForegroundColor Yellow

$easJsonPath = "mobile\eas.json"
if (Test-Path $easJsonPath) {
    Write-Host "   [OK] Fichier eas.json trouve" -ForegroundColor Green
    
    $easContent = Get-Content $easJsonPath -Raw
    $apiUrlInEas = $easContent | Select-String -Pattern "EXPO_PUBLIC_API_URL.*https://([^\"]+)" | ForEach-Object { $_.Matches.Groups[1].Value }
    
    if ($apiUrlInEas) {
        Write-Host "   [OK] URL API dans eas.json: $apiUrlInEas" -ForegroundColor Green
        
        if ($apiUrlInEas -ne $backendUrl) {
            Write-Host "   [ATTENTION] URL dans eas.json ne correspond pas a l'URL Cloud Run" -ForegroundColor Yellow
            Write-Host "   [ATTENTION] eas.json: $apiUrlInEas" -ForegroundColor Yellow
            Write-Host "   [ATTENTION] Cloud Run: $backendUrl" -ForegroundColor Yellow
            Write-Host ""
            Write-Host "   [ACTION] Mettre a jour eas.json avec:" -ForegroundColor Cyan
            Write-Host "   EXPO_PUBLIC_API_URL: $backendUrl" -ForegroundColor White
        } else {
            Write-Host "   [OK] URL correspond a l'URL Cloud Run" -ForegroundColor Green
        }
    } else {
        Write-Host "   [ATTENTION] EXPO_PUBLIC_API_URL non trouve dans eas.json" -ForegroundColor Yellow
    }
} else {
    Write-Host "   [ATTENTION] Fichier eas.json non trouve" -ForegroundColor Yellow
}

Write-Host ""

# Etape 4: Verifier les CORS/allowed origins
Write-Host "[ETAPE 4/4] Verification CORS/allowed origins..." -ForegroundColor Yellow

$cloudRunEnv = gcloud run services describe $ServiceName --region=$Region --format="yaml(spec.template.spec.containers[0].env)" --project=$ProjectId 2>&1

$allowedOrigins = $cloudRunEnv | Select-String -Pattern "ALLOWED_ORIGINS" -Context 0,1

if ($allowedOrigins) {
    Write-Host "   [OK] ALLOWED_ORIGINS trouve" -ForegroundColor Green
    Write-Host "   $allowedOrigins" -ForegroundColor White
    
    # Verifier si les origines mobiles sont autorisees
    if ($allowedOrigins -match "expo|localhost|127.0.0.1") {
        Write-Host "   [OK] Origines mobiles autorisees" -ForegroundColor Green
    } else {
        Write-Host "   [ATTENTION] Verifier que les origines mobiles sont autorisees" -ForegroundColor Yellow
        Write-Host "   [INFO] Les apps mobiles Expo utilisent des origines specifiques" -ForegroundColor Cyan
    }
} else {
    Write-Host "   [ATTENTION] ALLOWED_ORIGINS non trouve" -ForegroundColor Yellow
    Write-Host "   [INFO] Cloud Run peut bloquer les requetes depuis mobile" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "[OK] Verification terminee!" -ForegroundColor Green
Write-Host ""
Write-Host "Resume:" -ForegroundColor Cyan
Write-Host "   URL backend GCP: $backendUrl" -ForegroundColor White
Write-Host "   Connectivite: Testee" -ForegroundColor White
Write-Host "   Configuration mobile: Verifiee" -ForegroundColor White
Write-Host "   CORS: Verifie" -ForegroundColor White
Write-Host ""
