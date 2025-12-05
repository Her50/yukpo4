# ✅ Script PowerShell pour appliquer les migrations sur Render
# Usage: .\scripts\apply_migrations_render.ps1

$ErrorActionPreference = "Stop"

Write-Host "🚀 Application des migrations sur Render..." -ForegroundColor Cyan

# Variables d'environnement Render
$env:DATABASE_URL = "postgresql://yukpo_db_user:88X47ZWBiLkX5WatFcLU4KQ4rgaHYml4@dpg-d2t7ntbuibrs73eh9tvg-a.frankfurt-postgres.render.com/yukpo_db"
$env:SQLX_OFFLINE = "false"

# Aller dans le dossier backend
Set-Location backend

# Vérifier que sqlx-cli est installé
if (-not (Get-Command sqlx -ErrorAction SilentlyContinue)) {
    Write-Host "📦 Installation de sqlx-cli..." -ForegroundColor Yellow
    cargo install sqlx-cli --features postgres
}

# Appliquer les migrations
Write-Host "📊 Application des migrations..." -ForegroundColor Cyan
sqlx migrate run

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Migrations appliquées avec succès!" -ForegroundColor Green
}
else {
    Write-Host "❌ Erreur lors de l'application des migrations" -ForegroundColor Red
    exit 1
}

# Vérifier les tables créées
Write-Host "🔍 Vérification des tables créées..." -ForegroundColor Cyan
sqlx migrate info

Write-Host "✅ Vérification terminée!" -ForegroundColor Green

