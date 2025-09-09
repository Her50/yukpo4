# =======================
# reset_migration.ps1
# =======================

# Configuration de l'URL de base
$env:DATABASE_URL = "postgres://yukpo_user:Hernandez87@localhost:5432/yukpo_db"
$tableName = "token_packs"
$migrationVersion = 5

Write-Host "🔄 Lancement de la réinitialisation pour la table: $tableName" -ForegroundColor Cyan

# Suppression de la table
Write-Host "🧹 Suppression de la table '$tableName'..."
& psql -d $env:DATABASE_URL -c "DROP TABLE IF EXISTS $tableName CASCADE;"

# Suppression de la migration SQLx en base
Write-Host "🗑 Suppression de la migration version $migrationVersion..."
& psql -d $env:DATABASE_URL -c "DELETE FROM _sqlx_migrations WHERE version = $migrationVersion;"

# Rejeu des migrations
Write-Host "🚀 Rejeu des migrations SQLx..."
sqlx migrate run

Write-Host "✅ Réinitialisation terminée." -ForegroundColor Green
