# Script d'analyse simplifiée sans psql (utilise des requêtes SQLx ou curl)
# Version alternative si psql n'est pas disponible

$DatabaseUrl = "postgresql://user:password@host:port/database"

$resultsDir = "backend/analyses_db"
if (-not (Test-Path $resultsDir)) {
    New-Item -ItemType Directory -Path $resultsDir -Force | Out-Null
}

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$reportFile = "$resultsDir/rapport_analyse_$timestamp.txt"

Write-Host "=== ANALYSE COMPLETE DE LA BASE DE DONNEES ===" -ForegroundColor Cyan
Write-Host "Rapport: $reportFile" -ForegroundColor Gray
Write-Host ""

# Vérifier si psql est disponible
$psqlAvailable = $false
try {
    $psqlCheck = Get-Command psql -ErrorAction Stop
    $psqlAvailable = $true
    Write-Host "[INFO] psql trouve: $($psqlCheck.Source)" -ForegroundColor Green
}
catch {
    Write-Host "[INFO] psql non trouve - utilisation de requetes SQL directes" -ForegroundColor Yellow
    Write-Host "[INFO] Vous pouvez executer ces requetes manuellement via:" -ForegroundColor Yellow
    Write-Host "      1. Interface Render PostgreSQL" -ForegroundColor Cyan
    Write-Host "      2. Client PostgreSQL (pgAdmin, DBeaver, etc.)" -ForegroundColor Cyan
    Write-Host "      3. Installer psql: https://www.postgresql.org/download/" -ForegroundColor Cyan
}

# Créer le rapport avec les requêtes SQL
$header = @"
========================================
RAPPORT D'ANALYSE DE LA BASE DE DONNEES
Date: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
Base: yukpo_db
Host: your-render-db-host.render.com
URL: postgresql://yukpo_db_user:***@your-render-db-host.render.com/yukpo_db
========================================

"@
Set-Content -Path $reportFile -Value $header

# Liste des requêtes SQL à exécuter
$queries = @{
    "1. Version PostgreSQL"                = "SELECT version();"
    "1b. Informations de connexion"        = "SELECT current_user, current_database(), current_setting('server_version');"
    "2. Connexions actives"                = "SELECT usename, datname, state, COUNT(*) as count FROM pg_stat_activity WHERE datname = 'yukpo_db' GROUP BY usename, datname, state ORDER BY count DESC;"
    "3. Details des connexions"            = "SELECT pid, usename, application_name, state, query_start, NOW() - query_start as duration, LEFT(query, 80) as query_preview FROM pg_stat_activity WHERE datname = 'yukpo_db' ORDER BY query_start DESC LIMIT 20;"
    "4. Migrations SQLx"                   = "SELECT version, description, installed_on, success, execution_time FROM _sqlx_migrations ORDER BY installed_on DESC LIMIT 20;"
    "5. Migrations en echec"               = "SELECT version, description, installed_on, execution_time FROM _sqlx_migrations WHERE success = false ORDER BY installed_on DESC;"
    "6. Liste des tables"                  = "SELECT table_name, table_type FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;"
    "7. Statistiques des tables"           = "SELECT schemaname, tablename, n_live_tup as row_count, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as total_size FROM pg_stat_user_tables ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC LIMIT 30;"
    "8. Extensions PostgreSQL"             = "SELECT extname, extversion FROM pg_extension ORDER BY extname;"
    "9. Permissions yukpo_db_user"         = "SELECT table_schema, table_name, privilege_type FROM information_schema.role_table_grants WHERE grantee = 'yukpo_db_user' ORDER BY table_name, privilege_type LIMIT 50;"
    "10. Taille de la base"                = "SELECT pg_size_pretty(pg_database_size('yukpo_db')) as database_size;"
    "11. Transactions longues"             = "SELECT pid, usename, state, NOW() - query_start as duration, LEFT(query, 100) as query_preview FROM pg_stat_activity WHERE datname = 'yukpo_db' AND state != 'idle' AND NOW() - query_start > interval '5 seconds' ORDER BY duration DESC;"
    "12. Locks actifs"                     = "SELECT locktype, relation::regclass as table_name, mode, granted, pid FROM pg_locks WHERE relation IS NOT NULL ORDER BY granted, pid LIMIT 30;"
    "13. Colonnes avec faible correlation" = "SELECT schemaname, tablename, attname, n_distinct, correlation FROM pg_stats WHERE schemaname = 'public' AND n_distinct > 100 AND correlation < 0.1 ORDER BY n_distinct DESC LIMIT 20;"
    "14. Informations utilisateurs"        = "SELECT usename, usecreatedb, usesuper, valuntil FROM pg_user WHERE usename IN ('postgres', 'yukpo_db_user') ORDER BY usename;"
    "15. Configuration PostgreSQL"         = "SELECT name, setting, unit, source FROM pg_settings WHERE name IN ('max_connections', 'shared_buffers', 'effective_cache_size', 'maintenance_work_mem', 'work_mem') ORDER BY name;"
}

# Ajouter les requêtes au rapport
Add-Content -Path $reportFile -Value "`n========================================`nREQUETES SQL A EXECUTER`n========================================`n"

foreach ($queryName in $queries.Keys) {
    $query = $queries[$queryName]
    $section = @"

--- $queryName ---
$query

"@
    Add-Content -Path $reportFile -Value $section
    Write-Host "[REQUETE] $queryName" -ForegroundColor Yellow
}

# Ajouter les requêtes pour les tables critiques
$criticalTables = @("users", "services", "products", "deliveries", "orders", "media", "conversations", "chat_messages")
Add-Content -Path $reportFile -Value "`n--- Tables critiques ---`n"
foreach ($table in $criticalTables) {
    $query = "SELECT COUNT(*) as row_count FROM $table;"
    Add-Content -Path $reportFile -Value "`n-- Nombre de lignes dans $table`n$query`n"
    Write-Host "[REQUETE] Nombre de lignes dans $table" -ForegroundColor Yellow
}

# Instructions pour exécution
$instructions = @"

========================================
INSTRUCTIONS POUR EXECUTER LES REQUETES
========================================

Option 1: Via psql (si installe)
---------------------------------
psql "$DatabaseUrl" -c "SELECT version();"

Option 2: Via Interface Render
---------------------------------
1. Allez sur https://dashboard.render.com
2. Selectionnez votre base de donnees PostgreSQL
3. Cliquez sur "Connect" ou "Query"
4. Copiez-collez les requetes ci-dessus

Option 3: Via Client PostgreSQL
---------------------------------
Utilisez pgAdmin, DBeaver, ou tout autre client PostgreSQL
avec les informations de connexion:
- Host: your-render-db-host.render.com
- Port: 5432
- Database: yukpo_db
- Username: yukpo_db_user
- Password: [votre mot de passe]

Option 4: Via Script Rust/SQLx
---------------------------------
Vous pouvez executer ces requetes depuis votre application Rust
en utilisant sqlx::query!() ou sqlx::query_as!()

========================================
RESUME DES VERIFICATIONS
========================================

Verifications a effectuer:
1. Version PostgreSQL et informations de connexion
2. Connexions actives et leurs etats
3. Migrations appliquees et en echec
4. Liste et statistiques des tables
5. Extensions installees
6. Permissions de l'utilisateur
7. Taille de la base de donnees
8. Transactions longues
9. Locks actifs
10. Index et contraintes
11. Tables critiques

"@

Add-Content -Path $reportFile -Value $instructions

Write-Host ""
Write-Host "=== RAPPORT GENERE ===" -ForegroundColor Green
Write-Host "Fichier: $reportFile" -ForegroundColor Cyan
Write-Host ""
Write-Host "Le rapport contient toutes les requetes SQL a executer." -ForegroundColor Yellow
Write-Host "Vous pouvez les executer via:" -ForegroundColor Yellow
Write-Host "  - Interface Render PostgreSQL" -ForegroundColor Cyan
Write-Host "  - Client PostgreSQL (pgAdmin, DBeaver)" -ForegroundColor Cyan
Write-Host "  - psql (si installe)" -ForegroundColor Cyan
Write-Host ""
Write-Host "Pour voir le rapport:" -ForegroundColor Yellow
Write-Host "  Get-Content $reportFile" -ForegroundColor Cyan

