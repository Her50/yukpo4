# Script PowerShell pour créer les fichiers .env
# Yukpomnang - Configuration automatique

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "CRÉATION DES FICHIERS .env" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# ============================================
# MOBILE .env
# ============================================

$mobileEnvContent = @"
# ============================================
# MOBILE - Configuration Yukpomnang (Expo)
# ============================================

# URL API Backend
EXPO_PUBLIC_API_BASE_URL=https://yukpomnang.onrender.com

# URL WebSocket (NOUVEAU - pour chat temps réel)
EXPO_PUBLIC_WS_URL=wss://yukpomnang.onrender.com

# Environnement
EXPO_PUBLIC_ENVIRONMENT=production

# URL de partage (NOUVEAU - pour partage de services)
# Si vous avez un domaine personnalisé, changez cette valeur
# Sinon, utilisez l'URL Render qui fonctionne
EXPO_PUBLIC_SHARE_URL=https://yukpomnang.onrender.com
"@

if (Test-Path "mobile\.env") {
    Write-Host "⚠️  mobile\.env existe déjà" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Contenu actuel:" -ForegroundColor Yellow
    Get-Content "mobile\.env" | ForEach-Object { Write-Host "  $_" -ForegroundColor Gray }
    Write-Host ""
    Write-Host "AJOUTEZ CES LIGNES À LA MAIN dans mobile\.env:" -ForegroundColor Cyan
    Write-Host "  EXPO_PUBLIC_WS_URL=wss://yukpomnang.onrender.com" -ForegroundColor Green
    Write-Host "  EXPO_PUBLIC_SHARE_URL=https://yukpomnang.onrender.com" -ForegroundColor Green
    Write-Host ""
}
else {
    $mobileEnvContent | Out-File -FilePath "mobile\.env" -Encoding UTF8 -NoNewline
    Write-Host "✅ mobile\.env créé avec succès!" -ForegroundColor Green
    Write-Host ""
}

# ============================================
# FRONTEND .env
# ============================================

$frontendEnvContent = @"
# ============================================
# FRONTEND - Configuration Yukpomnang (Vite)
# ============================================

# URL API Backend
VITE_API_BASE_URL=https://yukpomnang.onrender.com

# URL WebSocket (NOUVEAU - pour notifications/chat temps réel)
VITE_WS_BASE_URL=wss://yukpomnang.onrender.com

# Environnement
VITE_ENVIRONMENT=production

# URL publique (NOUVEAU - pour liens publics)
# Si vous avez un domaine personnalisé, changez cette valeur
# Sinon, utilisez l'URL Render qui fonctionne
VITE_PUBLIC_URL=https://yukpomnang.onrender.com
"@

if (Test-Path "frontend\.env") {
    Write-Host "⚠️  frontend\.env existe déjà" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Contenu actuel:" -ForegroundColor Yellow
    Get-Content "frontend\.env" | ForEach-Object { Write-Host "  $_" -ForegroundColor Gray }
    Write-Host ""
    Write-Host "AJOUTEZ CES LIGNES À LA MAIN dans frontend\.env:" -ForegroundColor Cyan
    Write-Host "  VITE_WS_BASE_URL=wss://yukpomnang.onrender.com" -ForegroundColor Green
    Write-Host "  VITE_PUBLIC_URL=https://yukpomnang.onrender.com" -ForegroundColor Green
    Write-Host ""
}
else {
    $frontendEnvContent | Out-File -FilePath "frontend\.env" -Encoding UTF8 -NoNewline
    Write-Host "✅ frontend\.env créé avec succès!" -ForegroundColor Green
    Write-Host ""
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "✅ TERMINÉ!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "PROCHAINES ÉTAPES:" -ForegroundColor Yellow
Write-Host "1. Vérifiez les fichiers .env créés" -ForegroundColor White
Write-Host "2. Redémarrez l'application mobile (npm run dev)" -ForegroundColor White
Write-Host "3. Rebuilder le frontend (npm run build)" -ForegroundColor White
Write-Host ""

