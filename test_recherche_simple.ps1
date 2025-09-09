# Test simple de la fonction de recherche restaurée du 17 juillet

Write-Host "🧪 TEST DE LA FONCTION DE RECHERCHE RESTAURÉE DU 17 JUILLET" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green

# Attendre que le backend démarre
Write-Host "⏳ Attente du démarrage du backend..." -ForegroundColor Yellow
Start-Sleep -Seconds 15

# Test de recherche via l'API backend
Write-Host "`n1️⃣ TEST DE RECHERCHE VIA L'API BACKEND" -ForegroundColor Cyan
Write-Host "----------------------------------------" -ForegroundColor Cyan

$searchPayload = @{
    message = "je cherche une librairie"
    user_id = 1
} | ConvertTo-Json

Write-Host "🔍 Envoi de la requête: $searchPayload" -ForegroundColor Yellow

try {
    $response = Invoke-WebRequest -Uri "http://localhost:3001/api/ia/auto" -Method POST -Body $searchPayload -ContentType "application/json" -TimeoutSec 30
    
    Write-Host "📥 Réponse reçue:" -ForegroundColor Green
    Write-Host "   - Status: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "   - Headers: $($response.Headers)" -ForegroundColor Green
    
    if ($response.StatusCode -eq 200) {
        $result = $response.Content | ConvertFrom-Json
        Write-Host "✅ Réponse JSON reçue du backend" -ForegroundColor Green
        
        # Analyser la réponse
        Write-Host "`n📋 ANALYSE DE LA RÉPONSE:" -ForegroundColor Cyan
        Write-Host "   - Message: $($result.message)" -ForegroundColor White
        Write-Host "   - Intention: $($result.intention)" -ForegroundColor White
        Write-Host "   - Nombre de résultats: $($result.nombre_matchings)" -ForegroundColor White
        
        # Analyser les résultats
        $resultats = $result.resultats
        if ($resultats) {
            Write-Host "`n🔍 ANALYSE DES RÉSULTATS:" -ForegroundColor Cyan
            for ($i = 0; $i -lt $resultats.Count; $i++) {
                $service = $resultats[$i]
                Write-Host "`n   Service $($i+1):" -ForegroundColor Yellow
                Write-Host "     - ID: $($service.service_id)" -ForegroundColor White
                Write-Host "     - Score: $($service.score)" -ForegroundColor White
                Write-Host "     - GPS: $($service.gps)" -ForegroundColor White
                
                # Analyser les données
                $data = $service.data
                Write-Host "     - Données brutes: $($data | ConvertTo-Json -Depth 3)" -ForegroundColor White
                
                # Vérifier si les données contiennent des champs origine_champs
                $hasOrigineChamps = $false
                if ($data.PSObject.Properties.Name -contains "origine_champs") {
                    $hasOrigineChamps = $true
                    Write-Host "       ⚠️ CHAMP 'origine_champs' DÉTECTÉ: $($data.origine_champs)" -ForegroundColor Red
                }
                
                if (-not $hasOrigineChamps) {
                    Write-Host "       ✅ AUCUN CHAMP 'origine_champs' DÉTECTÉ - Données propres" -ForegroundColor Green
                }
            }
        } else {
            Write-Host "❌ Aucun résultat trouvé" -ForegroundColor Red
        }
    } else {
        Write-Host "❌ Erreur backend: $($response.StatusCode)" -ForegroundColor Red
        Write-Host "   Réponse: $($response.Content)" -ForegroundColor Red
    }
    
} catch {
    Write-Host "❌ Erreur lors du test: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "   Détails: $($_.Exception)" -ForegroundColor Red
}

Write-Host "`n============================================================" -ForegroundColor Green
Write-Host "🎯 RÉSULTAT ATTENDU:" -ForegroundColor Yellow
Write-Host "   - Le backend doit retourner les vraies données des services" -ForegroundColor White
Write-Host "   - Pas de champs 'origine_champs' dans les données" -ForegroundColor White
Write-Host "   - Les données doivent correspondre aux services trouvés" -ForegroundColor White
Write-Host "   - La fonction de recherche du 17 juillet doit fonctionner" -ForegroundColor White
Write-Host "============================================================" -ForegroundColor Green 