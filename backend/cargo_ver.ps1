# cargo_ver.ps1 — Script compatible PowerShell standard

Clear-Host
Write-Host "`n=== VERIFICATION ET LANCEMENT DU BACKEND YUKPOMNANG ===" -ForegroundColor Cyan

# 0. Arrêt si un processus tourne déjà
$proc = Get-Process yukpomnang_backend -ErrorAction SilentlyContinue
if ($proc) {
    Write-Host "`n[INFO] Un ancien processus 'yukpomnang_backend' est actif. Tentative d'arret..." -ForegroundColor Yellow
    Stop-Process -Name yukpomnang_backend -Force
    Start-Sleep -Milliseconds 500
    Write-Host "[OK] Processus arrete." -ForegroundColor Green
}

# 1. cargo check
Write-Host "`n[1/3] Lancement de 'cargo check'..." -ForegroundColor Cyan
$cargoCheck = cargo check 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "[OK] cargo check termine avec succes." -ForegroundColor Green
} else {
    Write-Host "[ERREUR] cargo check a echoue :`n$cargoCheck" -ForegroundColor Red
    exit 1
}

# 2. cargo build
Write-Host "`n[2/3] Compilation avec 'cargo build'..." -ForegroundColor Cyan
try {
    Remove-Item ".\target\debug\yukpomnang_backend.exe" -ErrorAction SilentlyContinue
} catch {}
$cargoBuild = cargo build 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "[OK] Compilation reussie." -ForegroundColor Green
} else {
    Write-Host "[ERREUR] Echec de la compilation :`n$cargoBuild" -ForegroundColor Red
    exit 1
}

# 3. cargo run
Write-Host "`n[3/3] Lancement de 'cargo run'..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "cargo run" -NoNewWindow

# Affiche les endpoints disponibles
Start-Sleep -Seconds 2
Write-Host "`n=== Endpoints disponibles ===" -ForegroundColor Magenta
Write-Host "   POST   http://localhost:3000/register"
Write-Host "   POST   http://localhost:3000/login"
Write-Host "   POST   http://localhost:3000/services"
Write-Host "   GET    http://localhost:3000/services"
Write-Host "   GET    http://localhost:3000/healthz"

Write-Host "`n[OK] Serveur Yukpomnang actif." -ForegroundColor Green
