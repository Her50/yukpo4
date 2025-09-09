# Test complet de la recherche native PostgreSQL
Write-Host "Test complet de la recherche native PostgreSQL" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green

# 1. Démarrer l'application backend
Write-Host "1. Demarrage de l'application backend..." -ForegroundColor Yellow
Start-Process -FilePath "cargo" -ArgumentList "run" -WorkingDirectory "backend" -WindowStyle Minimized

# 2. Attendre le démarrage
Write-Host "2. Attente du demarrage (20 secondes)..." -ForegroundColor Yellow
Start-Sleep -Seconds 20

# 3. Test de connexion
Write-Host "3. Test de connexion..." -ForegroundColor Cyan
try {
    $healthResponse = Invoke-RestMethod -Uri "http://127.0.0.1:3001/healthz" -Method GET -TimeoutSec 10
    Write-Host "   Application accessible: $healthResponse" -ForegroundColor Green
} catch {
    Write-Host "   Application non accessible: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "   Redemarrage de l'application..." -ForegroundColor Yellow
    Start-Process -FilePath "cargo" -ArgumentList "run" -WorkingDirectory "backend" -WindowStyle Minimized
    Start-Sleep -Seconds 15
}

# 4. Test de recherche
Write-Host "4. Test de recherche de salon de coiffure..." -ForegroundColor Cyan
$searchData = @{
    texte = "JE CHERCHE UN SALON DE COIFFURE"
    base64_image = @()
    doc_base64 = @()
    excel_base64 = @()
} | ConvertTo-Json

Write-Host "   Donnees: $searchData" -ForegroundColor Gray

try {
    $searchResponse = Invoke-RestMethod -Uri "http://127.0.0.1:3001/api/ia/auto" -Method POST -Body $searchData -ContentType "application/json" -TimeoutSec 30
    
    Write-Host "   Reponse recue avec succes!" -ForegroundColor Green
    Write-Host "   Intention: $($searchResponse.intention)" -ForegroundColor Cyan
    Write-Host "   Temps: $($searchResponse.processing_time)ms" -ForegroundColor Cyan
    
    if ($searchResponse.resultats) {
        Write-Host "   Resultats: $($searchResponse.resultats | ConvertTo-Json -Depth 3)" -ForegroundColor Yellow
    }
    
    Write-Host "`nVerifiez les logs du backend pour confirmer:" -ForegroundColor Blue
    Write-Host "- [PINECONE][SUSPENDU] Recherche semantique Pinecone temporairement suspendue" -ForegroundColor Gray
    Write-Host "- [RECHERCHE] Utilisation de la recherche native PostgreSQL intelligente" -ForegroundColor Gray
    Write-Host "- [RECHERCHE] Recherche native reussie avec X resultats" -ForegroundColor Gray
    
} catch {
    Write-Host "   Erreur lors de la recherche: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`nTest termine. L'application backend continue de fonctionner." -ForegroundColor Green 