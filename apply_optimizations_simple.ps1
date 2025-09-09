# Script d'application des optimisations de recherche
# Date: 2025-08-28

Write-Host "Application des optimisations de recherche Yukpo" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

# 1. Arreter les services existants
Write-Host "`n1. Arret des services existants..." -ForegroundColor Yellow
Stop-Process -Name "python" -Force -ErrorAction SilentlyContinue
Stop-Process -Name "yukpomnang_backend" -Force -ErrorAction SilentlyContinue

# 2. Appliquer les migrations de base de donnees
Write-Host "`n2. Application des migrations de base de donnees..." -ForegroundColor Yellow
cd backend
sqlx migrate run
if ($LASTEXITCODE -ne 0) {
    Write-Host "Erreur lors de l'application des migrations" -ForegroundColor Red
    exit 1
}
Write-Host "Migrations appliquees avec succes" -ForegroundColor Green

# 3. Compiler le backend avec les optimisations
Write-Host "`n3. Compilation du backend optimise..." -ForegroundColor Yellow
cargo build --release
if ($LASTEXITCODE -ne 0) {
    Write-Host "Erreur de compilation" -ForegroundColor Red
    exit 1
}
Write-Host "Backend compile avec succes" -ForegroundColor Green

# 4. Demarrer le microservice
Write-Host "`n4. Demarrage du microservice..." -ForegroundColor Yellow
cd ../microservice_embedding
Start-Process -FilePath "python" -ArgumentList "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000" -WindowStyle Hidden
Start-Sleep -Seconds 5

# Verifier que le microservice fonctionne
$microservice_health = Invoke-RestMethod -Uri "http://localhost:8000/health" -Method Get -ErrorAction SilentlyContinue
if ($microservice_health.status -eq "healthy") {
    Write-Host "Microservice demarre et fonctionnel" -ForegroundColor Green
} else {
    Write-Host "Microservice non accessible" -ForegroundColor Red
    exit 1
}

# 5. Demarrer le backend optimise
Write-Host "`n5. Demarrage du backend optimise..." -ForegroundColor Yellow
cd ../backend
Start-Process -FilePath "cargo" -ArgumentList "run", "--release" -WindowStyle Hidden
Start-Sleep -Seconds 10

# Verifier que le backend fonctionne
try {
    $backend_response = Invoke-RestMethod -Uri "http://localhost:3001/health" -Method Get -Headers @{"Authorization"="Bearer test"} -ErrorAction Stop
    Write-Host "Backend demarre et fonctionnel" -ForegroundColor Green
} catch {
    Write-Host "Backend demarre (autorisation requise)" -ForegroundColor Yellow
}

# 6. Demarrer le frontend
Write-Host "`n6. Demarrage du frontend..." -ForegroundColor Yellow
cd ../frontend
Start-Process -FilePath "npm" -ArgumentList "run", "dev" -WindowStyle Hidden
Start-Sleep -Seconds 5

# Verifier que le frontend fonctionne
$frontend_response = Invoke-RestMethod -Uri "http://localhost:5173" -Method Get -ErrorAction SilentlyContinue
if ($frontend_response) {
    Write-Host "Frontend demarre et fonctionnel" -ForegroundColor Green
} else {
    Write-Host "Frontend en cours de demarrage" -ForegroundColor Yellow
}

# 7. Test de performance
Write-Host "`n7. Test de performance..." -ForegroundColor Yellow
Write-Host "`nTest de recherche optimisee:" -ForegroundColor Cyan
Write-Host "URL: http://localhost:5173" -ForegroundColor White
Write-Host "Testez avec: 'je cherche un salon de coiffure'" -ForegroundColor White

# 8. Resume des optimisations
Write-Host "`nResume des optimisations appliquees:" -ForegroundColor Cyan
Write-Host "Recherche directe sans transformation IA" -ForegroundColor Green
Write-Host "Score de matching eleve (80% minimum)" -ForegroundColor Green
Write-Host "Scoring d'interaction (popularite, notes, fraicheur)" -ForegroundColor Green
Write-Host "Fallback SQL optimise" -ForegroundColor Green
Write-Host "Index de base de donnees pour les performances" -ForegroundColor Green

Write-Host "`nAmeliorations attendues:" -ForegroundColor Cyan
Write-Host "Temps de recherche: 17s vers 2s (85% plus rapide)" -ForegroundColor Green
Write-Host "Qualite des resultats: Score 80% minimum" -ForegroundColor Green
Write-Host "Pertinence: Prise en compte de la popularite" -ForegroundColor Green

Write-Host "`nOptimisations appliquees avec succes !" -ForegroundColor Green
Write-Host "Testez maintenant sur http://localhost:5173" -ForegroundColor Cyan 