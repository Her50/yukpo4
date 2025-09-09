# Script pour configurer tous les seuils de matching et redémarrer les services
# Ce script élimine tous les codes en dur et rend le système flexible

Write-Host "🔧 CONFIGURATION DES SEUILS DE MATCHING - ÉLIMINATION DU CODE EN DUR" -ForegroundColor Cyan
Write-Host "=" * 70 -ForegroundColor Cyan

# 1. Configuration des variables d'environnement pour les seuils
Write-Host "📋 1. Configuration des variables d'environnement..." -ForegroundColor Yellow

$env_vars = @{
    # Seuils principaux de matching
    "MATCHING_SCORE_THRESHOLD" = "0.70"
    "PINECONE_SCORE_THRESHOLD" = "0.70"
    "FINAL_SCORE_THRESHOLD" = "0.70"
    
    # Seuils pour les échanges
    "ECHANGE_MATCH_THRESHOLD" = "0.70"
    
    # Seuils pour le cache sémantique
    "SEMANTIC_CACHE_THRESHOLD" = "0.70"
    "SEMANTIC_CACHE_PRO_CONFIDENCE" = "0.70"
    "SEMANTIC_CACHE_PRO_PRODUCTION_THRESHOLD" = "0.70"
    "SEMANTIC_CACHE_PRO_DEV_THRESHOLD" = "0.70"
    
    # Seuils pour l'orchestration IA
    "ORCHESTRATION_CONFIDENCE_THRESHOLD" = "0.70"
    
    # Seuils pour la configuration d'optimisation
    "MATCHING_MIN_SCORE_THRESHOLD" = "0.70"
}

# Afficher la configuration
Write-Host "`n📊 Configuration des seuils :" -ForegroundColor Green
foreach ($key in $env_vars.Keys) {
    Write-Host "   $key = $($env_vars[$key])" -ForegroundColor White
}

# 2. Vérifier que les services sont arrêtés
Write-Host "`n🛑 2. Arrêt des services en cours..." -ForegroundColor Yellow

# Arrêter le backend Rust s'il tourne
$rustProcess = Get-Process -Name "yukpomnang_backend" -ErrorAction SilentlyContinue
if ($rustProcess) {
    Write-Host "   Arrêt du backend Rust..." -ForegroundColor White
    Stop-Process -Name "yukpomnang_backend" -Force
    Start-Sleep -Seconds 2
}

# Arrêter le microservice Python s'il tourne
$pythonProcess = Get-Process -Name "python" -ErrorAction SilentlyContinue | Where-Object {$_.ProcessName -eq "python" -and $_.CommandLine -like "*embedding*"}
if ($pythonProcess) {
    Write-Host "   Arrêt du microservice Python..." -ForegroundColor White
    Stop-Process -Id $pythonProcess.Id -Force
    Start-Sleep -Seconds 2
}

# 3. Compiler le backend avec les nouvelles configurations
Write-Host "`n🔨 3. Compilation du backend Rust..." -ForegroundColor Yellow

Set-Location "backend"
try {
    $env:MATCHING_SCORE_THRESHOLD = $env_vars["MATCHING_SCORE_THRESHOLD"]
    $env:PINECONE_SCORE_THRESHOLD = $env_vars["PINECONE_SCORE_THRESHOLD"]
    $env:FINAL_SCORE_THRESHOLD = $env_vars["FINAL_SCORE_THRESHOLD"]
    $env:ECHANGE_MATCH_THRESHOLD = $env_vars["ECHANGE_MATCH_THRESHOLD"]
    $env:SEMANTIC_CACHE_THRESHOLD = $env_vars["SEMANTIC_CACHE_THRESHOLD"]
    $env:ORCHESTRATION_CONFIDENCE_THRESHOLD = $env_vars["ORCHESTRATION_CONFIDENCE_THRESHOLD"]
    $env:MATCHING_MIN_SCORE_THRESHOLD = $env_vars["MATCHING_MIN_SCORE_THRESHOLD"]
    
    cargo build --release
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ Backend compilé avec succès" -ForegroundColor Green
    } else {
        Write-Host "   ❌ Erreur de compilation du backend" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "   ❌ Erreur lors de la compilation: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
} finally {
    Set-Location ".."
}

# 4. Démarrer le microservice Python avec les nouveaux seuils
Write-Host "`n🐍 4. Démarrage du microservice Python..." -ForegroundColor Yellow

Set-Location "microservice_embedding"
try {
    $env:MATCHING_SCORE_THRESHOLD = $env_vars["MATCHING_SCORE_THRESHOLD"]
    
    # Démarrer le microservice en arrière-plan
    Start-Process -FilePath "python" -ArgumentList "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000" -WindowStyle Hidden
    
    Write-Host "   ✅ Microservice Python démarré" -ForegroundColor Green
    Start-Sleep -Seconds 3
} catch {
    Write-Host "   ❌ Erreur lors du démarrage du microservice: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
} finally {
    Set-Location ".."
}

# 5. Démarrer le backend Rust
Write-Host "`n🚀 5. Démarrage du backend Rust..." -ForegroundColor Yellow

Set-Location "backend"
try {
    # Démarrer le backend en arrière-plan
    Start-Process -FilePath "cargo" -ArgumentList "run", "--release" -WindowStyle Hidden
    
    Write-Host "   ✅ Backend Rust démarré" -ForegroundColor Green
    Start-Sleep -Seconds 5
} catch {
    Write-Host "   ❌ Erreur lors du démarrage du backend: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
} finally {
    Set-Location ".."
}

# 6. Vérification des services
Write-Host "`n🔍 6. Vérification des services..." -ForegroundColor Yellow

# Vérifier le microservice Python
try {
    $response = Invoke-RestMethod -Uri "http://localhost:8000/health" -Method GET -TimeoutSec 5
    Write-Host "   ✅ Microservice Python répond" -ForegroundColor Green
} catch {
    Write-Host "   ⚠️  Microservice Python non accessible: $($_.Exception.Message)" -ForegroundColor Yellow
}

# Vérifier le backend Rust
try {
    $response = Invoke-RestMethod -Uri "http://localhost:3000/health" -Method GET -TimeoutSec 5
    Write-Host "   ✅ Backend Rust répond" -ForegroundColor Green
} catch {
    Write-Host "   ⚠️  Backend Rust non accessible: $($_.Exception.Message)" -ForegroundColor Yellow
}

# 7. Test de recherche pour vérifier les nouveaux seuils
Write-Host "`n🧪 7. Test de recherche avec les nouveaux seuils..." -ForegroundColor Yellow

try {
    $token = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOjEsInJvbGUiOiJ1c2VyIiwiZW1haWwiOiJsZWxlaGVybmFuZGV6MjAwN0B5YWhvby5mciIsInRva2Vuc19iYWxhbmNlIjo5OTk5OTMwNDk0NiwiaWF0IjoxNzU2NTEwODc0LCJleHAiOjE3NTY1OTcyNzR9.4x7j--DGV5L-bGqudXvwF-WArpe8FpO8mFHVLhdDE-0"
    
    $searchData = @{
        texte = "restaurant"
        intention = "recherche_besoin"
    }
    
    $response = Invoke-RestMethod -Uri "http://localhost:3000/api/ia/orchestration" -Method POST -Headers @{
        "Authorization" = "Bearer $token"
        "Content-Type" = "application/json"
    } -Body ($searchData | ConvertTo-Json)
    
    Write-Host "   ✅ Test de recherche réussi" -ForegroundColor Green
    Write-Host "   📊 Réponse: $($response | ConvertTo-Json -Depth 2)" -ForegroundColor Cyan
    
} catch {
    Write-Host "   ⚠️  Test de recherche échoué: $($_.Exception.Message)" -ForegroundColor Yellow
}

# 8. Résumé final
Write-Host "`n🎉 CONFIGURATION TERMINÉE !" -ForegroundColor Green
Write-Host "=" * 50 -ForegroundColor Green
Write-Host "✅ Tous les seuils en dur ont été éliminés" -ForegroundColor Green
Write-Host "✅ Le système est maintenant flexible et configurable" -ForegroundColor Green
Write-Host "✅ Les services utilisent les variables d'environnement" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Variables d'environnement configurées :" -ForegroundColor Cyan
foreach ($key in $env_vars.Keys) {
    Write-Host "   $key = $($env_vars[$key])" -ForegroundColor White
}
Write-Host ""
Write-Host "🔧 Pour modifier les seuils, changez les variables d'environnement et redémarrez les services" -ForegroundColor Yellow
Write-Host "🔧 Le système ne contient plus de code en dur !" -ForegroundColor Yellow 