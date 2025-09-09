# Test direct de la recherche native PostgreSQL
Write-Host "Test de la recherche native PostgreSQL" -ForegroundColor Green
Write-Host "=====================================" -ForegroundColor Green

# Attendre que l'application démarre
Write-Host "Attente du demarrage de l'application..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

# Test de connexion
try {
    Write-Host "Test de connexion a l'application..." -ForegroundColor Cyan
    $response = Invoke-RestMethod -Uri "http://127.0.0.1:3001/healthz" -Method GET
    Write-Host "Application accessible: $response" -ForegroundColor Green
} catch {
    Write-Host "Application non accessible: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Test de recherche
Write-Host "`nTest de recherche de salon de coiffure..." -ForegroundColor Cyan
$searchData = @{
    texte = "JE CHERCHE UN SALON DE COIFFURE"
    base64_image = @()
    doc_base64 = @()
    excel_base64 = @()
} | ConvertTo-Json

Write-Host "Donnees de recherche: $searchData" -ForegroundColor Gray

try {
    $searchResponse = Invoke-RestMethod -Uri "http://127.0.0.1:3001/api/ia/auto" -Method POST -Body $searchData -ContentType "application/json"
    
    Write-Host "`nReponse de recherche recue!" -ForegroundColor Green
    Write-Host "Intention: $($searchResponse.intention)" -ForegroundColor Cyan
    Write-Host "Temps: $($searchResponse.processing_time)ms" -ForegroundColor Cyan
    
    if ($searchResponse.resultats) {
        Write-Host "Resultats: $($searchResponse.resultats | ConvertTo-Json -Depth 3)" -ForegroundColor Yellow
    }
    
    Write-Host "`nVerifiez les logs du backend pour voir:" -ForegroundColor Blue
    Write-Host "- [PINECONE][SUSPENDU] Recherche semantique Pinecone temporairement suspendue" -ForegroundColor Gray
    Write-Host "- [RECHERCHE] Utilisation de la recherche native PostgreSQL intelligente" -ForegroundColor Gray
    Write-Host "- [RECHERCHE] Recherche native reussie avec X resultats" -ForegroundColor Gray
    
} catch {
    Write-Host "Erreur lors de la recherche: $($_.Exception.Message)" -ForegroundColor Red
} 