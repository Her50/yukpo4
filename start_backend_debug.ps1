# Script de démarrage du backend avec debug
Write-Host "🚀 Démarrage du backend avec debug..." -ForegroundColor Green

# Aller dans le dossier backend
Set-Location backend

# Définir les variables d'environnement pour le debug
$env:RUST_LOG = "debug"
$env:RUST_BACKTRACE = "1"

Write-Host "🔧 Variables d'environnement définies:" -ForegroundColor Yellow
Write-Host "  RUST_LOG: $env:RUST_LOG" -ForegroundColor Cyan
Write-Host "  RUST_BACKTRACE: $env:RUST_BACKTRACE" -ForegroundColor Cyan

Write-Host "📦 Compilation et démarrage avec cargo..." -ForegroundColor Yellow
Write-Host "💡 Appuyez sur Ctrl+C pour arrêter le backend" -ForegroundColor Red

# Démarrer le backend avec debug
cargo run --features image_search 