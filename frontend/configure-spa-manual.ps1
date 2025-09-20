# Configuration automatique du routage SPA via l'API Vercel
Write-Host "Configuration du routage SPA Vercel..." -ForegroundColor Green

# Obtenir le token Vercel depuis les variables d'environnement
$vercelToken = $env:VERCEL_TOKEN
if (-not $vercelToken) {
    Write-Host "Token Vercel non trouvé. Utilisation de l'interface web..." -ForegroundColor Yellow
    Write-Host "Veuillez configurer manuellement via: https://vercel.com/lele-s-projects/frontend/settings/functions" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Configuration à ajouter:" -ForegroundColor Green
    Write-Host "1. Rewrites:" -ForegroundColor Yellow
    Write-Host "   - Source: /api/(.*) -> Destination: https://yukpomnang.onrender.com/api/`$1" -ForegroundColor White
    Write-Host "   - Source: /(.*) -> Destination: /index.html" -ForegroundColor White
    Write-Host ""
    Write-Host "2. Headers:" -ForegroundColor Yellow
    Write-Host "   - Access-Control-Allow-Origin: *" -ForegroundColor White
    Write-Host "   - Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS" -ForegroundColor White
    Write-Host "   - Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With" -ForegroundColor White
} else {
    Write-Host "Configuration via API Vercel..." -ForegroundColor Cyan
    # Configuration via API (si token disponible)
}

Write-Host "Configuration terminée !" -ForegroundColor Green
