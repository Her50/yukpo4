# Script PowerShell de debug forcé pour Yukpomnang Mobile

Write-Host "🔧 NETTOYAGE COMPLET..." -ForegroundColor Yellow

# Tuer tous les processus Metro/Expo
Write-Host "Arrêt des processus existants..."
Get-Process -Name "*expo*" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Get-Process -Name "*node*" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like "*metro*" } | Stop-Process -Force -ErrorAction SilentlyContinue
Get-Process -Name "*node*" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like "*expo*" } | Stop-Process -Force -ErrorAction SilentlyContinue

# Nettoyer le cache
Write-Host "Nettoyage du cache..."
if (Test-Path "node_modules\.cache") { Remove-Item -Recurse -Force "node_modules\.cache" }
if (Test-Path ".expo") { Remove-Item -Recurse -Force ".expo" }
if (Test-Path "$env:TEMP\react-*") { Remove-Item -Recurse -Force "$env:TEMP\react-*" }
if (Test-Path "$env:TEMP\metro-*") { Remove-Item -Recurse -Force "$env:TEMP\metro-*" }
if (Test-Path "$env:TEMP\haste-*") { Remove-Item -Recurse -Force "$env:TEMP\haste-*" }

Write-Host "✅ Nettoyage terminé" -ForegroundColor Green
Write-Host ""
Write-Host "🚀 DÉMARRAGE EN MODE DEBUG FORCÉ..." -ForegroundColor Cyan
Write-Host ""

# Configurer les variables d'environnement de debug
$env:EXPO_DEBUG = "true"
$env:DEBUG = "expo:*"
$env:REACT_DEBUGGER = "unset"

# Démarrer avec toutes les options de debug
npx expo start --clear --dev-client --port 8081

Write-Host ""
Write-Host "📱 Options de debug :" -ForegroundColor Magenta
Write-Host "  - Appuyez sur 'd' pour ouvrir les outils de développement"
Write-Host "  - Appuyez sur 'j' pour ouvrir le debugger"
Write-Host "  - Appuyez sur 'r' pour recharger"
Write-Host "  - Appuyez sur 'm' pour basculer le menu"

