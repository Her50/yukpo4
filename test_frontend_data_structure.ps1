Write-Host "🔍 Test de la structure des données frontend" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan

# Test de l'API backend directement
Write-Host "`n1️⃣ Test de l'API backend..." -ForegroundColor Yellow

$headers = @{
    "Content-Type" = "application/json"
    "Authorization" = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIiwidXNlcl9pZCI6MSwiaWF0IjoxNzM1Mjg5NjAwLCJleHAiOjE3MzUzNzYwMDB9.test"
}

$payload = @{
    message = "je cherche un pressing"
    user_id = 1
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "http://localhost:3001/api/yukpo" -Method POST -Headers $headers -Body $payload -TimeoutSec 30
    
    Write-Host "✅ Réponse reçue du backend" -ForegroundColor Green
    Write-Host "📊 Structure des données:" -ForegroundColor Yellow
    
    # Afficher la structure
    $response | ConvertTo-Json -Depth 3 | Write-Host
    
    # Vérifier les résultats
    if ($response.resultats) {
        Write-Host "`n🎯 Résultats trouvés: $($response.resultats.Count)" -ForegroundColor Green
        foreach ($resultat in $response.resultats) {
            Write-Host "  - ID: $($resultat.id), Titre: $($resultat.titre)" -ForegroundColor Cyan
        }
    } else {
        Write-Host "`n❌ Aucun champ 'resultats' trouvé" -ForegroundColor Red
        $fields = $response.PSObject.Properties.Name -join ", "
        Write-Host "Champs disponibles: $fields" -ForegroundColor Yellow
    }
    
} catch {
    Write-Host "❌ Erreur lors du test: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n2️⃣ Test de la page frontend..." -ForegroundColor Yellow
Write-Host "Ouvrez http://localhost:3000 et testez la recherche" -ForegroundColor Cyan
Write-Host "Vérifiez la console du navigateur pour voir les données" -ForegroundColor Cyan 