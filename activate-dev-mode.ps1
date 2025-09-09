# Script pour activer le mode développeur Yukpo
Write-Host "🚀 Activation du mode développeur Yukpo..." -ForegroundColor Green

# URL du frontend (ajustez si nécessaire)
$frontendUrl = "http://localhost:5173"

# Ouvrir le navigateur
Write-Host "📱 Ouverture du navigateur sur $frontendUrl" -ForegroundColor Yellow
Start-Process $frontendUrl

Write-Host ""
Write-Host "🔧 Instructions pour activer le mode développeur :" -ForegroundColor Cyan
Write-Host "1. Appuyez sur F12 pour ouvrir la console du navigateur" -ForegroundColor White
Write-Host "2. Dans la console, tapez : localStorage.setItem('__DEV_FAKE_USER__', 'true');" -ForegroundColor White
Write-Host "3. Appuyez sur Entrée" -ForegroundColor White
Write-Host "4. Puis tapez : window.location.reload();" -ForegroundColor White
Write-Host "5. Appuyez sur Entrée" -ForegroundColor White
Write-Host ""
Write-Host "✅ Vous devriez maintenant être connecté en mode développeur !" -ForegroundColor Green
Write-Host ""
Write-Host "💡 Pour vérifier : localStorage.getItem('__DEV_FAKE_USER__');" -ForegroundColor Gray 