# Test avec nouveau token JWT
Write-Host "Test avec nouveau token JWT" -ForegroundColor Green
Write-Host "==========================" -ForegroundColor Green

# Générer un nouveau token JWT valide
$headers = @{
    "Content-Type" = "application/json"
}

$login_payload = @{
    email = "lelehernandez2007@yahoo.fr"
    password = "test123"
} | ConvertTo-Json

try {
    Write-Host "`n1. Connexion pour obtenir un nouveau token..." -ForegroundColor Cyan
    $login_response = Invoke-RestMethod -Uri "http://localhost:3001/api/auth/login" -Method POST -Headers $headers -Body $login_payload -TimeoutSec 10
    
    $new_token = $login_response.token
    Write-Host "✅ Nouveau token obtenu" -ForegroundColor Green
    
    # Test avec le nouveau token
    $backend_headers = @{
        "Content-Type" = "application/json"
        "Authorization" = "Bearer $new_token"
    }
    
    Write-Host "`n2. Test de l'API de recherche..." -ForegroundColor Cyan
    
    $search_payload = @{
        message = "je cherche un pressing"
        user_id = 1
    } | ConvertTo-Json -Depth 10
    
    try {
        Write-Host "Envoi de la requête de recherche..." -ForegroundColor Yellow
        $response = Invoke-RestMethod -Uri "http://localhost:3001/api/yukpo" -Method POST -Headers $backend_headers -Body $search_payload -TimeoutSec 30
        
        Write-Host "✅ Réponse reçue du backend" -ForegroundColor Green
        Write-Host "Nombre de résultats: $($response.nombre_matchings)" -ForegroundColor Yellow
        Write-Host "Intention: $($response.intention)" -ForegroundColor Gray
        Write-Host "Message: $($response.message)" -ForegroundColor Gray
        
        if ($response.resultats.Count -gt 0) {
            Write-Host "`nRésultats trouvés:" -ForegroundColor Green
            foreach ($resultat in $response.resultats) {
                Write-Host "  - ID: $($resultat.id), Titre: $($resultat.titre)" -ForegroundColor Gray
            }
        } else {
            Write-Host "`n❌ Aucun résultat trouvé" -ForegroundColor Red
        }
        
    } catch {
        Write-Host "❌ Erreur lors de la recherche: $($_.Exception.Message)" -ForegroundColor Red
        if ($_.Exception.Response) {
            $statusCode = $_.Exception.Response.StatusCode.value__
            Write-Host "Code d'erreur: $statusCode" -ForegroundColor Red
        }
    }
    
} catch {
    Write-Host "❌ Erreur lors de la connexion: $($_.Exception.Message)" -ForegroundColor Red
} 