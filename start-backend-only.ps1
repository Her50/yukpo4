# Script pour demarrer uniquement le backend Rust
Write-Host "Demarrage du backend Rust..." -ForegroundColor Green

# Aller dans le dossier backend
Set-Location backend

Write-Host "Compilation et demarrage sur le port 8001..." -ForegroundColor Yellow
cargo run 