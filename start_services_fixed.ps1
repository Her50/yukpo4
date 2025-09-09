Write-Host "🚀 Démarrage des services avec correction du timing" -ForegroundColor Cyan
Write-Host "=================================================" -ForegroundColor Cyan

# Configuration des variables d'environnement
Write-Host "`n1️⃣ Configuration des variables d'environnement..." -ForegroundColor Yellow
$env:YUKPO_API_KEY = "yukpo_embedding_key_2024"
$env:EMBEDDING_API_URL = "http://localhost:8000"
Write-Host "✅ Variables d'environnement configurées" -ForegroundColor Green

# Arrêter les processus existants
Write-Host "`n2️⃣ Arrêt des processus existants..." -ForegroundColor Yellow
Get-Process -Name "python" -ErrorAction SilentlyContinue | Where-Object { $_.ProcessName -eq "python" } | Stop-Process -Force
Get-Process -Name "yukpomnang_backend" -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 2
Write-Host "✅ Processus arrêtés" -ForegroundColor Green

# Démarrage du microservice
Write-Host "`n3️⃣ Démarrage du microservice (port 8000)..." -ForegroundColor Yellow
cd microservice_embedding
Start-Process -FilePath "python" -ArgumentList "main.py" -WindowStyle Hidden -PassThru
$microserviceProcess = $_
cd ..
Write-Host "✅ Microservice démarré (PID: $($microserviceProcess.Id))" -ForegroundColor Green

# Attendre que le microservice soit prêt
Write-Host "`n4️⃣ Attente que le microservice soit prêt..." -ForegroundColor Yellow
$maxAttempts = 30
$attempt = 0
$microserviceReady = $false

while ($attempt -lt $maxAttempts -and -not $microserviceReady) {
    $attempt++
    Write-Host "  Tentative $attempt/$maxAttempts..." -ForegroundColor Gray
    
    try {
        $response = Invoke-RestMethod -Uri "http://localhost:8000/health" -Method GET -TimeoutSec 5 -ErrorAction Stop
        $microserviceReady = $true
        Write-Host "✅ Microservice prêt !" -ForegroundColor Green
    } catch {
        Write-Host "  ⏳ Microservice pas encore prêt, attente..." -ForegroundColor Yellow
        Start-Sleep -Seconds 2
    }
}

if (-not $microserviceReady) {
    Write-Host "❌ Le microservice n'est pas prêt après $maxAttempts tentatives" -ForegroundColor Red
    exit 1
}

# Test de communication avec le microservice
Write-Host "`n5️⃣ Test de communication avec le microservice..." -ForegroundColor Yellow
$headers = @{
    "Content-Type" = "application/json"
    "x-api-key" = "yukpo_embedding_key_2024"
}

$testPayload = @{
    query = "test"
    type_donnee = "texte"
    top_k = 1
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "http://localhost:8000/search_embedding_pinecone" -Method POST -Headers $headers -Body $testPayload -TimeoutSec 10
    Write-Host "✅ Communication avec le microservice OK" -ForegroundColor Green
    Write-Host "  Résultats trouvés: $($response.results.Count)" -ForegroundColor Gray
} catch {
    Write-Host "❌ Erreur de communication avec le microservice: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Démarrage du backend
Write-Host "`n6️⃣ Démarrage du backend (port 3001)..." -ForegroundColor Yellow
cd backend
Start-Process -FilePath "cargo" -ArgumentList "run" -WindowStyle Hidden -PassThru
$backendProcess = $_
cd ..
Write-Host "✅ Backend démarré (PID: $($backendProcess.Id))" -ForegroundColor Green

# Attendre que le backend soit prêt
Write-Host "`n7️⃣ Attente que le backend soit prêt..." -ForegroundColor Yellow
$maxAttempts = 30
$attempt = 0
$backendReady = $false

while ($attempt -lt $maxAttempts -and -not $backendReady) {
    $attempt++
    Write-Host "  Tentative $attempt/$maxAttempts..." -ForegroundColor Gray
    
    try {
        $response = Invoke-RestMethod -Uri "http://localhost:3001/healthz" -Method GET -TimeoutSec 5 -ErrorAction Stop
        $backendReady = $true
        Write-Host "✅ Backend prêt !" -ForegroundColor Green
    } catch {
        Write-Host "  ⏳ Backend pas encore prêt, attente..." -ForegroundColor Yellow
        Start-Sleep -Seconds 2
    }
}

if (-not $backendReady) {
    Write-Host "❌ Le backend n'est pas prêt après $maxAttempts tentatives" -ForegroundColor Red
    exit 1
}

# Test final de recherche
Write-Host "`n8️⃣ Test final de recherche..." -ForegroundColor Yellow
$searchHeaders = @{
    "Content-Type" = "application/json"
    "Authorization" = "Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIiwiZXhwIjoxNzM1NzI4MDAwfQ.Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8"
}

$searchPayload = @{
    message = "je cherche un pressing"
    user_id = 1
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "http://localhost:3001/api/yukpo" -Method POST -Headers $searchHeaders -Body $searchPayload -TimeoutSec 30
    Write-Host "✅ Recherche fonctionne !" -ForegroundColor Green
    Write-Host "  Nombre de résultats: $($response.nombre_matchings)" -ForegroundColor Yellow
    Write-Host "  Message: $($response.message)" -ForegroundColor Gray
} catch {
    Write-Host "❌ Erreur lors de la recherche: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n🎉 Services démarrés avec succès !" -ForegroundColor Green
Write-Host "Microservice: http://localhost:8000" -ForegroundColor Cyan
Write-Host "Backend: http://localhost:3001" -ForegroundColor Cyan 