# Script PowerShell pour régénérer le cache SQLx complet

Write-Host "=== Régénération du Cache SQLx Complet ===" -ForegroundColor Cyan

# Aller dans le répertoire backend
Set-Location "C:\Users\23767\yukpomnang2\backend"

# Configurer DATABASE_URL
$env:DATABASE_URL = "postgresql://yukpo_db_user:88X47ZWBiLkX5WatFcLU4KQ4rgaHYml4@dpg-d2t7ntbuibrs73eh9tvg-a.frankfurt-postgres.render.com/yukpo_db"
$env:SQLX_OFFLINE = "false"

Write-Host "DATABASE_URL configuré" -ForegroundColor Green

# Compter les requêtes sqlx::query!() dans le code
$queryCount = (Select-String -Path "src\**\*.rs" -Pattern "sqlx::query!" -Recurse | Measure-Object).Count
Write-Host "Requêtes sqlx::query!() trouvées dans le code: $queryCount" -ForegroundColor Yellow

# Compter les fichiers actuels dans le cache
if (Test-Path ".sqlx") {
    $currentCount = (Get-ChildItem -Path .sqlx -Recurse -File | Measure-Object).Count
    Write-Host "Fichiers actuels dans le cache: $currentCount" -ForegroundColor Yellow
    Write-Host "Manquants: $($queryCount - $currentCount) fichiers" -ForegroundColor Red
}
else {
    Write-Host "Aucun cache trouvé" -ForegroundColor Red
}

Write-Host ""
Write-Host "Génération du cache..." -ForegroundColor Cyan

# Régénérer le cache
cargo sqlx prepare --workspace

# Compter les nouveaux fichiers
if (Test-Path ".sqlx") {
    $newCount = (Get-ChildItem -Path .sqlx -Recurse -File | Measure-Object).Count
    Write-Host ""
    Write-Host "Fichiers générés: $newCount" -ForegroundColor Green
    
    if ($newCount -ge $queryCount) {
        Write-Host "✅ Cache complet généré!" -ForegroundColor Green
    }
    else {
        Write-Host "⚠️ Cache incomplet: $($queryCount - $newCount) requêtes manquantes" -ForegroundColor Yellow
    }
}
else {
    Write-Host "❌ Erreur: Aucun cache généré" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "=== Prochaines étapes ===" -ForegroundColor Cyan
Write-Host "1. git add backend/.sqlx/" -ForegroundColor White
Write-Host "2. git commit -m 'chore: regenerate complete sqlx cache'" -ForegroundColor White
Write-Host "3. git push" -ForegroundColor White

