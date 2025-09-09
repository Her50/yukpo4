# Script pour demarrer manuellement le backend
Write-Host "Demarrage manuel du backend Rust..." -ForegroundColor Green

# Aller dans le dossier backend
Set-Location backend

# Verifier que Cargo.toml existe
if (-not (Test-Path "Cargo.toml")) {
    Write-Host "Erreur: Cargo.toml non trouve dans le dossier backend" -ForegroundColor Red
    exit 1
}

Write-Host "Compilation et demarrage du backend..." -ForegroundColor Yellow
Write-Host "Cela peut prendre quelques minutes lors de la premiere compilation..." -ForegroundColor Yellow

# Demarrer le backend
cargo run 