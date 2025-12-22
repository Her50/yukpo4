# Script pour appliquer directement la migration d'optimisation des index
# Migration: 20251222_optimize_slow_queries_indexes.sql

$env:DATABASE_URL = "postgresql://yukpo_db_user:88X47ZWBiLkX5WatFcLU4KQ4rgaHYml4@dpg-d2t7ntbuibrs73eh9tvg-a.frankfurt-postgres.render.com/yukpo_db"

Write-Host "🔧 Application de la migration d'optimisation des index..." -ForegroundColor Yellow

# Utiliser sqlx migrate add pour créer la migration si elle n'existe pas déjà
# Puis sqlx migrate run pour l'appliquer
Write-Host "📊 Application via sqlx migrate..." -ForegroundColor Cyan

$result = sqlx migrate run 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Migration appliquée avec succès!" -ForegroundColor Green
    Write-Host $result
} else {
    Write-Host "⚠️ Résultat:" -ForegroundColor Yellow
    Write-Host $result
    # Vérifier si les index existent déjà (c'est OK)
    if ($result -match "already exists" -or $result -match "duplicate") {
        Write-Host "ℹ️ Les index existent déjà, c'est normal." -ForegroundColor Cyan
    }
}

Write-Host "✨ Terminé!" -ForegroundColor Green

