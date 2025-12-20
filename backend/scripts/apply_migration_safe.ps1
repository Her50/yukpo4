# Script PowerShell pour appliquer la migration de manière sécurisée
# Vérifie les index existants avant d'appliquer

$ErrorActionPreference = "Stop"

# Variables de connexion
$DB_HOST = if ($env:DB_HOST) { $env:DB_HOST } else { "your-render-db-host.render.com" }
$DB_NAME = if ($env:DB_NAME) { $env:DB_NAME } else { "yukpo_db" }
$DB_USER = if ($env:DB_USER) { $env:DB_USER } else { "yukpo_db_user" }
$DB_PASSWORD = if ($env:DB_PASSWORD) { $env:DB_PASSWORD } else { "YOUR_PASSWORD" }

$env:PGPASSWORD = $DB_PASSWORD

Write-Host "🔍 Vérification des index existants sur la table services..." -ForegroundColor Cyan

Write-Host "`n📊 Liste des index existants sur 'services':" -ForegroundColor Yellow
$query = @"
SELECT 
    indexname,
    CASE 
        WHEN indexdef LIKE '%to_tsvector%' THEN 'tsvector'
        WHEN indexdef LIKE '%trgm%' THEN 'trigram'
        WHEN indexdef LIKE '%GIN%' THEN 'GIN'
        ELSE 'autre'
    END as type_index
FROM pg_indexes
WHERE tablename = 'services'
ORDER BY indexname;
"@

psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c $query

Write-Host "`n✅ Application de la migration (vérifie existence avant création)..." -ForegroundColor Green
$migrationPath = Join-Path $PSScriptRoot "..\migrations\20251129_001_optimize_search_tsvector_performance.sql"
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -f $migrationPath

Write-Host "`n✅ Migration appliquée avec succès !" -ForegroundColor Green
Write-Host "📊 Vérification des nouveaux index créés:" -ForegroundColor Yellow

$verifyQuery = @"
SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'services'
AND indexname LIKE '%tsvector%'
ORDER BY indexname;
"@

psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c $verifyQuery

Remove-Item Env:\PGPASSWORD

Write-Host "`n✅ Terminé !" -ForegroundColor Green

