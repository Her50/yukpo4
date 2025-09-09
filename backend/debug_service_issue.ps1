# Script de diagnostic pour identifier le problème des services
# Teste directement l'API backend pour voir ce qui se passe

Write-Host "🔍 Diagnostic du problème des services..." -ForegroundColor Cyan

$backendUrl = "http://localhost:3001"
$token = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOjEsInJvbGUiOiJ1c2VyIiwiZW1haWwiOiJsZWxlaGVybmFuZGV6MjAwN0B5YWhvby5mciIsInRva2Vuc19iYWxhbmNlIjo5OTk5OTMwNjgyMiwiaWF0IjoxNzU2NTAwMDM5LCJleHAiOjE3NTY1ODY0Mzl9.YowAEhZu2ugad3IRTmBhe_50WJJG53GeI1rUVapWhfY"

# Services à tester
$serviceIds = @(531974, 862419, 20977, 518829, 939282, 742692, 27)

Write-Host "`n📊 Test des services individuels:" -ForegroundColor Yellow

foreach ($serviceId in $serviceIds) {
    Write-Host "`n🔍 Test du service $serviceId..." -ForegroundColor Gray
    
    try {
        $headers = @{
            "Authorization" = "Bearer $token"
            "Content-Type" = "application/json"
        }
        
        $response = Invoke-RestMethod -Uri "$backendUrl/api/services/$serviceId" -Method GET -Headers $headers -ErrorAction SilentlyContinue
        
        if ($response) {
            Write-Host "✅ Service $serviceId: SUCCÈS" -ForegroundColor Green
            Write-Host "   ID: $($response.id)" -ForegroundColor White
            Write-Host "   Actif: $($response.is_active)" -ForegroundColor White
            Write-Host "   User ID: $($response.user_id)" -ForegroundColor White
            
            # Vérifier la structure des données
            if ($response.data) {
                Write-Host "   Données JSON présentes: OUI" -ForegroundColor Green
                Write-Host "   Type de données: $($response.data.GetType().Name)" -ForegroundColor White
                
                # Essayer d'extraire le titre
                if ($response.data.titre_service) {
                    Write-Host "   Titre: $($response.data.titre_service)" -ForegroundColor Green
                } elseif ($response.data.titre) {
                    Write-Host "   Titre: $($response.data.titre)" -ForegroundColor Green
                } else {
                    Write-Host "   Titre: NON TROUVÉ" -ForegroundColor Red
                    Write-Host "   Clés disponibles: $($response.data.PSObject.Properties.Name -join ', ')" -ForegroundColor Yellow
                }
            } else {
                Write-Host "   Données JSON: MANQUANTES" -ForegroundColor Red
            }
        }
    }
    catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        $errorMessage = $_.Exception.Message
        
        Write-Host "❌ Service $serviceId: ERREUR $statusCode" -ForegroundColor Red
        Write-Host "   Message: $errorMessage" -ForegroundColor White
        
        if ($statusCode -eq 404) {
            Write-Host "   → Service non trouvé ou inactif" -ForegroundColor Yellow
        } elseif ($statusCode -eq 500) {
            Write-Host "   → Erreur interne du serveur" -ForegroundColor Red
        }
    }
}

Write-Host "`n📈 Résumé du diagnostic:" -ForegroundColor Cyan
Write-Host "   Si vous voyez des erreurs 500, c'est un problème de structure de données" -ForegroundColor White
Write-Host "   Si vous voyez des erreurs 404, les services n'existent pas en base" -ForegroundColor White
Write-Host "   Si vous voyez des succès mais pas de titre, c'est un problème de format JSON" -ForegroundColor White 