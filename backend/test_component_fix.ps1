# Test du composant corrigé
Write-Host "🧪 Test du composant ResultatBesoin corrigé..." -ForegroundColor Cyan

$backendUrl = "http://localhost:3001"
$token = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOjEsInJvbGUiOiJ1c2VyIiwiZW1haWwiOiJsZWxlaGVybmFuZGV6MjAwN0B5YWhvby5mciIsInRva2Vuc19iYWxhbmNlIjo5OTk5OTMwNjQyNywiaWF0IjoxNzU2NTAwNzI5LCJleHAiOjE3NTY1ODcxMjl9.BhhEqeVm_SfPk24N8_s84byPlB_2N0PLhi-50gntx60"

# Services à tester (ceux qui fonctionnent)
$serviceIds = @(531974, 153, 27)

Write-Host "`n📊 Test des services fonctionnels:" -ForegroundColor Yellow

foreach ($serviceId in $serviceIds) {
    Write-Host "`n🔍 Test du service $serviceId..." -ForegroundColor Gray
    
    try {
        $headers = @{
            "Authorization" = "Bearer $token"
        }
        
        $response = Invoke-WebRequest -Uri "$backendUrl/api/services/$serviceId" -Method GET -Headers $headers
        
        if ($response.StatusCode -eq 200) {
            $service = $response.Content | ConvertFrom-Json
            Write-Host "✅ SUCCESS: Service $serviceId" -ForegroundColor Green
            
            # Afficher la structure des données
            Write-Host "   Structure des données:" -ForegroundColor White
            Write-Host "   - ID: $($service.id)" -ForegroundColor White
            Write-Host "   - Actif: $($service.is_active)" -ForegroundColor White
            Write-Host "   - User ID: $($service.user_id)" -ForegroundColor White
            
            # Afficher les données du service
            if ($service.data) {
                Write-Host "   - Titre: $($service.data.titre_service.valeur)" -ForegroundColor White
                Write-Host "   - Description: $($service.data.description.valeur)" -ForegroundColor White
                Write-Host "   - Catégorie: $($service.data.category.valeur)" -ForegroundColor White
            }
        } else {
            Write-Host "❌ ERROR: $($response.StatusCode)" -ForegroundColor Red
        }
        
    } catch {
        Write-Host "❌ EXCEPTION: $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host "`n🎯 Résumé:" -ForegroundColor Cyan
Write-Host "Si vous voyez les données des services ci-dessus, le composant devrait maintenant fonctionner !" -ForegroundColor Green
Write-Host "Testez votre application et vérifiez que la page ResultatBesoin s'affiche correctement." -ForegroundColor Yellow 