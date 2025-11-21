# 🚀 Script de configuration Redis et LiveKit pour Yukpomnang
# Ce script ouvre les dashboards et guide la configuration

Write-Host "🔧 Configuration Redis et LiveKit pour Yukpomnang" -ForegroundColor Cyan
Write-Host "=================================================" -ForegroundColor Yellow
Write-Host ""

# ============================================
# PARTIE 1 : REDIS (Upstash)
# ============================================
Write-Host "🔴 PARTIE 1 : Configuration Redis (Upstash)" -ForegroundColor Red
Write-Host ""

Write-Host "📋 Instructions Redis :" -ForegroundColor Green
Write-Host "1. Dashboard Upstash va s'ouvrir dans votre navigateur" -ForegroundColor White
Write-Host "2. Créez une base Redis (gratuite)" -ForegroundColor White
Write-Host "3. Copiez l'URL Redis (format: redis://default:password@host:port)" -ForegroundColor White
Write-Host ""

$openUpstash = Read-Host "Ouvrir le dashboard Upstash ? (O/N)"
if ($openUpstash -eq "O" -or $openUpstash -eq "o") {
    Start-Process "https://console.upstash.com"
    Write-Host "✅ Dashboard Upstash ouvert" -ForegroundColor Green
}

Write-Host ""
Write-Host "📝 Après avoir créé votre base Redis, collez l'URL ici :" -ForegroundColor Yellow
$redisUrl = Read-Host "URL Redis (ou appuyez sur Entrée pour ignorer)"

if ($redisUrl -and $redisUrl.StartsWith("redis://")) {
    Write-Host "✅ URL Redis valide détectée" -ForegroundColor Green
} else {
    Write-Host "⚠️ URL Redis non fournie ou invalide" -ForegroundColor Yellow
    $redisUrl = ""
}

Write-Host ""
Write-Host ""

# ============================================
# PARTIE 2 : LIVEKIT
# ============================================
Write-Host "🎥 PARTIE 2 : Configuration LiveKit" -ForegroundColor Magenta
Write-Host ""

Write-Host "📋 Instructions LiveKit :" -ForegroundColor Green
Write-Host "1. Dashboard LiveKit Cloud va s'ouvrir dans votre navigateur" -ForegroundColor White
Write-Host "2. Créez un projet (gratuit jusqu'à 10GB/mois)" -ForegroundColor White
Write-Host "3. Créez une clé API avec toutes les permissions" -ForegroundColor White
Write-Host "4. Copiez l'API Key, API Secret, et les URLs" -ForegroundColor White
Write-Host ""

$openLiveKit = Read-Host "Ouvrir le dashboard LiveKit Cloud ? (O/N)"
if ($openLiveKit -eq "O" -or $openLiveKit -eq "o") {
    Start-Process "https://cloud.livekit.io"
    Write-Host "✅ Dashboard LiveKit Cloud ouvert" -ForegroundColor Green
}

Write-Host ""
Write-Host "📝 Remplissez les informations LiveKit :" -ForegroundColor Yellow

$livekitApiUrl = Read-Host "LIVEKIT_API_URL (ex: https://votre-projet.livekit.cloud)"
$livekitWsUrl = Read-Host "LIVEKIT_WS_URL (ex: wss://votre-projet.livekit.cloud)"
$livekitApiKey = Read-Host "LIVEKIT_API_KEY (commence par API...)"
$livekitApiSecret = Read-Host "LIVEKIT_API_SECRET (longue chaîne)"
$livekitHlsUrl = Read-Host "LIVEKIT_HLS_URL (ex: https://votre-projet.livekit.cloud)"

# Validation
$livekitValid = $true
if (-not $livekitApiUrl -or -not $livekitApiUrl.StartsWith("https://")) {
    Write-Host "⚠️ LIVEKIT_API_URL invalide (doit commencer par https://)" -ForegroundColor Yellow
    $livekitValid = $false
}
if (-not $livekitWsUrl -or -not $livekitWsUrl.StartsWith("wss://")) {
    Write-Host "⚠️ LIVEKIT_WS_URL invalide (doit commencer par wss://)" -ForegroundColor Yellow
    $livekitValid = $false
}
if (-not $livekitApiKey -or -not $livekitApiKey.StartsWith("API")) {
    Write-Host "⚠️ LIVEKIT_API_KEY invalide (doit commencer par API)" -ForegroundColor Yellow
    $livekitValid = $false
}
if (-not $livekitApiSecret) {
    Write-Host "⚠️ LIVEKIT_API_SECRET manquant" -ForegroundColor Yellow
    $livekitValid = $false
}

Write-Host ""
Write-Host ""

# ============================================
# GÉNÉRATION DU FICHIER DE CONFIGURATION
# ============================================
Write-Host "📝 Génération du fichier de configuration..." -ForegroundColor Cyan
Write-Host ""

$configContent = @"
# 🔧 Configuration Redis et LiveKit pour Render.com
# Généré le $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
#
# 📋 INSTRUCTIONS :
# 1. Allez sur https://dashboard.render.com
# 2. Sélectionnez votre service "yukpomnang"
# 3. Cliquez sur l'onglet "Environment"
# 4. Ajoutez/modifiez les variables ci-dessous
# 5. Cliquez sur "Save Changes"
# 6. Attendez le redémarrage (2-3 minutes)
#

"@

if ($redisUrl) {
    $configContent += @"
# 🔴 REDIS (Cache)
REDIS_URL=$redisUrl

"@
} else {
    $configContent += @"
# 🔴 REDIS (Cache) - À CONFIGURER
# REDIS_URL=redis://default:password@host.upstash.io:6379

"@
}

if ($livekitValid) {
    $configContent += @"
# 🎥 LIVEKIT (Streaming)
LIVEKIT_API_URL=$livekitApiUrl
LIVEKIT_WS_URL=$livekitWsUrl
LIVEKIT_API_KEY=$livekitApiKey
LIVEKIT_API_SECRET=$livekitApiSecret
LIVEKIT_HLS_URL=$livekitHlsUrl

"@
} else {
    $configContent += @"
# 🎥 LIVEKIT (Streaming) - À CONFIGURER
# LIVEKIT_API_URL=https://votre-projet.livekit.cloud
# LIVEKIT_WS_URL=wss://votre-projet.livekit.cloud
# LIVEKIT_API_KEY=APIxxxxxxxxxxxxx
# LIVEKIT_API_SECRET=votre_secret_ici
# LIVEKIT_HLS_URL=https://votre-projet.livekit.cloud

"@
}

# Sauvegarder le fichier
$configFile = "render-redis-livekit-config.txt"
$configContent | Out-File -FilePath $configFile -Encoding UTF8

# Copier dans le presse-papier
$configContent | Set-Clipboard

Write-Host "✅ Configuration générée !" -ForegroundColor Green
Write-Host "📁 Fichier sauvegardé : $configFile" -ForegroundColor White
Write-Host "📋 Configuration copiée dans le presse-papier" -ForegroundColor White
Write-Host ""

# ============================================
# RÉSUMÉ
# ============================================
Write-Host "📊 RÉSUMÉ DE LA CONFIGURATION :" -ForegroundColor Cyan
Write-Host ""

if ($redisUrl) {
    Write-Host "✅ Redis : Configuré" -ForegroundColor Green
    Write-Host "   URL: $($redisUrl.Substring(0, [Math]::Min(50, $redisUrl.Length)))..." -ForegroundColor Gray
} else {
    Write-Host "⚠️ Redis : Non configuré" -ForegroundColor Yellow
}

if ($livekitValid) {
    Write-Host "✅ LiveKit : Configuré" -ForegroundColor Green
    Write-Host "   API URL: $livekitApiUrl" -ForegroundColor Gray
} else {
    Write-Host "⚠️ LiveKit : Non configuré" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "🎯 PROCHAINES ÉTAPES :" -ForegroundColor Yellow
Write-Host "1. Ouvrez https://dashboard.render.com" -ForegroundColor White
Write-Host "2. Sélectionnez votre service 'yukpomnang'" -ForegroundColor White
Write-Host "3. Allez dans l'onglet 'Environment'" -ForegroundColor White
Write-Host "4. Ajoutez/modifiez les variables (copiées dans le presse-papier)" -ForegroundColor White
Write-Host "5. Cliquez sur 'Save Changes'" -ForegroundColor White
Write-Host "6. Attendez le redémarrage (2-3 minutes)" -ForegroundColor White
Write-Host "7. Vérifiez les logs pour confirmer la connexion" -ForegroundColor White
Write-Host ""

$openRender = Read-Host "Ouvrir le dashboard Render.com maintenant ? (O/N)"
if ($openRender -eq "O" -or $openRender -eq "o") {
    Start-Process "https://dashboard.render.com"
    Write-Host "✅ Dashboard Render.com ouvert" -ForegroundColor Green
}

Write-Host ""
Write-Host "🎉 Configuration terminée !" -ForegroundColor Green
Write-Host ""

