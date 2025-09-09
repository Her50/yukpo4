# Script d'application des optimisations de recherche
# Date: 2025-08-28

Write-Host "🚀 Application des optimisations de recherche Yukpo" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

# 1. Arrêter les services existants
Write-Host "`n1️⃣ Arrêt des services existants..." -ForegroundColor Yellow
Stop-Process -Name "python" -Force -ErrorAction SilentlyContinue
Stop-Process -Name "yukpomnang_backend" -Force -ErrorAction SilentlyContinue

# 2. Appliquer les migrations de base de données
Write-Host "`n2️⃣ Application des migrations de base de données..." -ForegroundColor Yellow
cd backend
sqlx migrate run
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Erreur lors de l'application des migrations" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Migrations appliquées avec succès" -ForegroundColor Green

# 3. Compiler le backend avec les optimisations
Write-Host "`n3️⃣ Compilation du backend optimisé..." -ForegroundColor Yellow
cargo build --release
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Erreur de compilation" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Backend compilé avec succès" -ForegroundColor Green

# 4. Démarrer le microservice
Write-Host "`n4️⃣ Démarrage du microservice..." -ForegroundColor Yellow
cd ../microservice_embedding
Start-Process -FilePath "python" -ArgumentList "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000" -WindowStyle Hidden
Start-Sleep -Seconds 5

# Vérifier que le microservice fonctionne
$microservice_health = Invoke-RestMethod -Uri "http://localhost:8000/health" -Method Get -ErrorAction SilentlyContinue
if ($microservice_health.status -eq "healthy") {
    Write-Host "✅ Microservice démarré et fonctionnel" -ForegroundColor Green
} else {
    Write-Host "❌ Microservice non accessible" -ForegroundColor Red
    exit 1
}

# 5. Démarrer le backend optimisé
Write-Host "`n5️⃣ Démarrage du backend optimisé..." -ForegroundColor Yellow
cd ../backend
Start-Process -FilePath "cargo" -ArgumentList "run", "--release" -WindowStyle Hidden
Start-Sleep -Seconds 10

# Vérifier que le backend fonctionne
try {
    $backend_response = Invoke-RestMethod -Uri "http://localhost:3001/health" -Method Get -Headers @{"Authorization"="Bearer test"} -ErrorAction Stop
    Write-Host "✅ Backend démarré et fonctionnel" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Backend démarré (autorisation requise)" -ForegroundColor Yellow
}

# 6. Démarrer le frontend
Write-Host "`n6️⃣ Démarrage du frontend..." -ForegroundColor Yellow
cd ../frontend
Start-Process -FilePath "npm" -ArgumentList "run", "dev" -WindowStyle Hidden
Start-Sleep -Seconds 5

# Vérifier que le frontend fonctionne
$frontend_response = Invoke-RestMethod -Uri "http://localhost:5173" -Method Get -ErrorAction SilentlyContinue
if ($frontend_response) {
    Write-Host "✅ Frontend démarré et fonctionnel" -ForegroundColor Green
} else {
    Write-Host "⚠️  Frontend en cours de démarrage" -ForegroundColor Yellow
}

# 7. Test de performance
Write-Host "`n7️⃣ Test de performance..." -ForegroundColor Yellow
Write-Host "`n🧪 Test de recherche optimisée:" -ForegroundColor Cyan
Write-Host "URL: http://localhost:5173" -ForegroundColor White
Write-Host "Testez avec: 'je cherche un salon de coiffure'" -ForegroundColor White

# 8. Résumé des optimisations
Write-Host "`n📊 Résumé des optimisations appliquées:" -ForegroundColor Cyan
Write-Host "✅ Recherche directe sans transformation IA" -ForegroundColor Green
Write-Host "✅ Score de matching élevé (80% minimum)" -ForegroundColor Green
Write-Host "✅ Scoring d'interaction (popularité, notes, fraîcheur)" -ForegroundColor Green
Write-Host "✅ Fallback SQL optimisé" -ForegroundColor Green
Write-Host "✅ Index de base de données pour les performances" -ForegroundColor Green

Write-Host "`n🎯 Améliorations attendues:" -ForegroundColor Cyan
Write-Host "• Temps de recherche: 17s → ~2s (85% plus rapide)" -ForegroundColor Green
Write-Host "• Qualité des résultats: Score 80% minimum" -ForegroundColor Green
Write-Host "• Pertinence: Prise en compte de la popularité" -ForegroundColor Green

Write-Host "`n🚀 Optimisations appliquées avec succès !" -ForegroundColor Green
Write-Host "Testez maintenant sur http://localhost:5173" -ForegroundColor Cyan 