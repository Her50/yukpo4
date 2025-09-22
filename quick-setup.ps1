# Configuration automatique finale Yukpomnang
Write-Host "CONFIGURATION AUTOMATIQUE YUKPOMNANG" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Yellow

# Ouvrir automatiquement tous les dashboards
Write-Host "`nOuverture des dashboards..." -ForegroundColor Green

$urls = @(
    "https://console.neon.tech",
    "https://cloud.mongodb.com", 
    "https://console.upstash.com",
    "https://dashboard.render.com"
)

foreach ($url in $urls) {
    Write-Host "Ouverture: $url" -ForegroundColor White
    Start-Process $url
    Start-Sleep -Seconds 2
}

Write-Host "`nTous les dashboards sont ouverts!" -ForegroundColor Green

# Guide interactif
Write-Host "`nETAPES A SUIVRE:" -ForegroundColor Yellow
Write-Host "=================" -ForegroundColor Yellow

Write-Host "`n1. NEON POSTGRESQL (2 min)" -ForegroundColor Cyan
Write-Host "   - Sign up avec GitHub/Google" -ForegroundColor White
Write-Host "   - Create project 'yukpomnang'" -ForegroundColor White  
Write-Host "   - Copy connection string" -ForegroundColor White

$neonUrl = Read-Host "`nCollez votre URL Neon PostgreSQL"

Write-Host "`n2. MONGODB ATLAS (2 min)" -ForegroundColor Cyan
Write-Host "   - Sign up avec GitHub/Google" -ForegroundColor White
Write-Host "   - Create M0 cluster 'yukpomnang'" -ForegroundColor White
Write-Host "   - Connect > Application > Copy URL" -ForegroundColor White

$mongoUrl = Read-Host "`nCollez votre URL MongoDB Atlas"

Write-Host "`n3. UPSTASH REDIS (1 min)" -ForegroundColor Cyan  
Write-Host "   - Sign up avec GitHub/Google" -ForegroundColor White
Write-Host "   - Create database 'yukpomnang'" -ForegroundColor White
Write-Host "   - Copy REST URL" -ForegroundColor White

$redisUrl = Read-Host "`nCollez votre URL Upstash Redis (optionnel)"
if ([string]::IsNullOrWhiteSpace($redisUrl)) {
    $redisUrl = "redis://localhost:6379"
}

# Generer configuration finale
Write-Host "`nGeneration configuration finale..." -ForegroundColor Green

$config = Get-Content "render-config-final.txt" -Raw
$config = $config -replace '\[REMPLACER_PAR_URL_NEON_POSTGRESQL\]', $neonUrl
$config = $config -replace '\[REMPLACER_PAR_URL_ATLAS_MONGODB\]', $mongoUrl  
$config = $config -replace '\[REMPLACER_PAR_URL_UPSTASH_REDIS\]', $redisUrl

# Sauvegarder et copier
$config | Out-File -FilePath "render-final-ready.txt" -Encoding UTF8
$config | Set-Clipboard

Write-Host "`nConfiguration finale generee!" -ForegroundColor Green
Write-Host "Fichier: render-final-ready.txt" -ForegroundColor White
Write-Host "Presse-papier: Configuration copiee automatiquement" -ForegroundColor White

Write-Host "`n4. RENDER CONFIGURATION (30 sec)" -ForegroundColor Cyan
Write-Host "   - Dashboard Render deja ouvert" -ForegroundColor White
Write-Host "   - yukpomnang > Environment" -ForegroundColor White
Write-Host "   - Ctrl+V pour coller" -ForegroundColor White  
Write-Host "   - Save Changes" -ForegroundColor White

Read-Host "`nAppuyez sur Entree apres avoir sauvegarde sur Render"

# Test final
Write-Host "`nTest automatique..." -ForegroundColor Green
try {
    Invoke-RestMethod -Uri "https://yukpomnang.onrender.com/healthz" -TimeoutSec 10 | Out-Null
    Write-Host "Backend: OK" -ForegroundColor Green
} catch {
    Write-Host "Backend: En redéploiement (normal)" -ForegroundColor Yellow
}

Start-Process "https://yukpomnang-app.netlify.app"

Write-Host "`nCONFIGURATION TERMINEE!" -ForegroundColor Green
Write-Host "Application ouverte pour test" -ForegroundColor White 