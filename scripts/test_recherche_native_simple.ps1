# Test de la recherche native PostgreSQL
# Test simple pour vérifier que la recherche fonctionne

Write-Host "Test de la recherche native PostgreSQL" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green

# Test de recherche simple
$testData = @{
    texte = "JE CHERCHE UN SALON DE COIFFURE"
    base64_image = @()
    doc_base64 = @()
    excel_base64 = @()
} | ConvertTo-Json

Write-Host "Envoi de la requete de recherche..." -ForegroundColor Yellow
Write-Host "Donnees: $testData" -ForegroundColor Gray

try {
    $response = Invoke-RestMethod -Uri "http://127.0.0.1:3001/api/ia/auto" -Method POST -Body $testData -ContentType "application/json"
    
    Write-Host "Reponse recue avec succes!" -ForegroundColor Green
    Write-Host "Intention detectee: $($response.intention)" -ForegroundColor Cyan
    Write-Host "Temps de traitement: $($response.processing_time)ms" -ForegroundColor Cyan
    
    if ($response.resultats -and $response.resultats.detail -eq "Not Found") {
        Write-Host "Aucun service trouve - Verification de la recherche native..." -ForegroundColor Yellow
        
        # Vérifier les logs pour voir si la recherche native fonctionne
        Write-Host "Verifiez les logs du backend pour voir les messages de recherche native" -ForegroundColor Blue
        Write-Host "   Recherchez: [RECHERCHE] Utilisation de la recherche native PostgreSQL intelligente" -ForegroundColor Gray
    }
    
} catch {
    Write-Host "Erreur lors de la requete: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`nInstructions pour verifier:" -ForegroundColor Blue
Write-Host "1. Verifiez que l'application backend fonctionne sur http://127.0.0.1:3001" -ForegroundColor Gray
Write-Host "2. Regardez les logs du backend pour voir les messages de recherche native" -ForegroundColor Gray
Write-Host "3. Verifiez que la base de donnees PostgreSQL est accessible" -ForegroundColor Gray
Write-Host "4. Verifiez que les index de recherche sont crees" -ForegroundColor Gray 