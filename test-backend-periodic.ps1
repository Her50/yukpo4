# Script pour tester périodiquement la connectivité backend
Write-Host "🔍 Test de connectivité backend Yukpomnang" -ForegroundColor Yellow
Write-Host "⏰ Démarrage des tests périodiques..." -ForegroundColor Cyan

$backendUrl = "https://yukpomnang.onrender.com"
$maxAttempts = 10
$attempt = 1

while ($attempt -le $maxAttempts) {
    Write-Host "`n🔄 Tentative $attempt/$maxAttempts - $(Get-Date -Format 'HH:mm:ss')" -ForegroundColor White
    
    try {
        # Test de la route racine
        $response = Invoke-WebRequest -Uri "$backendUrl/" -Method GET -TimeoutSec 10 -ErrorAction Stop
        
        if ($response.StatusCode -eq 200) {
            Write-Host "✅ Backend accessible! Status: $($response.StatusCode)" -ForegroundColor Green
            Write-Host "📄 Réponse: $($response.Content)" -ForegroundColor Gray
            
            # Test de l'API health
            try {
                $healthResponse = Invoke-WebRequest -Uri "$backendUrl/api/health" -Method GET -TimeoutSec 5 -ErrorAction Stop
                if ($healthResponse.StatusCode -eq 200) {
                    Write-Host "✅ API Health accessible!" -ForegroundColor Green
                    Write-Host "📄 Réponse: $($healthResponse.Content)" -ForegroundColor Gray
                }
            }
            catch {
                Write-Host "⚠️ API Health non accessible: $($_.Exception.Message)" -ForegroundColor Yellow
            }
            
            Write-Host "`n🎉 Tests réussis! Le backend est opérationnel." -ForegroundColor Green
            break
        }
    }
    catch {
        Write-Host "❌ Erreur: $($_.Exception.Message)" -ForegroundColor Red
        
        if ($attempt -eq $maxAttempts) {
            Write-Host "`n💥 Tous les tests ont échoué après $maxAttempts tentatives." -ForegroundColor Red
            Write-Host "🔧 Vérifiez les logs de déploiement sur Render." -ForegroundColor Yellow
        }
        else {
            Write-Host "⏳ Attente de 30 secondes avant la prochaine tentative..." -ForegroundColor Yellow
            Start-Sleep -Seconds 30
        }
    }
    
    $attempt++
}

Write-Host "`n🏁 Test terminé." -ForegroundColor Cyan
