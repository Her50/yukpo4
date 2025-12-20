# Script d'analyse complète et autonome de la base de données Render
# Exécute toutes les vérifications automatiquement

param(
    [string]$DatabaseUrl = $env:DATABASE_URL
)

# Si DATABASE_URL n'est pas fournie, utiliser celle fournie par l'utilisateur
if (-not $DatabaseUrl) {
    $DatabaseUrl = "postgresql://user:password@host:port/database"
    Write-Host "Utilisation de l'URL par défaut" -ForegroundColor Gray
}

$env:DATABASE_URL = $DatabaseUrl

# Créer le dossier de résultats
$resultsDir = "backend/analyses_db"
if (-not (Test-Path $resultsDir)) {
    New-Item -ItemType Directory -Path $resultsDir -Force | Out-Null
}

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$reportFile = "$resultsDir/rapport_analyse_$timestamp.txt"

Write-Host "=== ANALYSE COMPLÈTE DE LA BASE DE DONNÉES ===" -ForegroundColor Cyan
Write-Host "Rapport: $reportFile" -ForegroundColor Gray
Write-Host ""

# Fonction pour exécuter une requête et logger le résultat
function Execute-Query {
    param(
        [string]$Query,
        [string]$Description,
        [string]$OutputFile
    )
    
    Write-Host "[ANALYSE] $Description..." -ForegroundColor Yellow
    
    $output = @"
`n========================================
$Description
========================================
"@
    
    try {
        $result = psql $DatabaseUrl -c $Query 2>&1
        if ($LASTEXITCODE -eq 0) {
            $output += "`n[OK] Succes:`n$result`n"
            Write-Host "  [OK] Succes" -ForegroundColor Green
        }
        else {
            $output += "`n[ERREUR] Erreur (code $LASTEXITCODE):`n$result`n"
            Write-Host "  [ERREUR] Erreur" -ForegroundColor Red
        }
    }
    catch {
        $output += "`n[ERREUR] Exception: $($_.Exception.Message)`n"
        Write-Host "  [ERREUR] Exception" -ForegroundColor Red
    }
    
    Add-Content -Path $OutputFile -Value $output
    return $result
}

# Démarrer le rapport
$header = @"
========================================
RAPPORT D'ANALYSE DE LA BASE DE DONNÉES
Date: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
Base: yukpo_db
Host: your-render-db-host.render.com
========================================

"@
Set-Content -Path $reportFile -Value $header

# 1. Test de connexion et version
Execute-Query -Query "SELECT version();" -Description "1. Version PostgreSQL" -OutputFile $reportFile
Execute-Query -Query "SELECT current_user, current_database(), current_setting('server_version');" -Description "1b. Informations de connexion" -OutputFile $reportFile

# 2. Connexions actives
Execute-Query -Query "SELECT usename, datname, state, COUNT(*) as count, MAX(state_change) as last_change FROM pg_stat_activity WHERE datname = 'yukpo_db' GROUP BY usename, datname, state ORDER BY count DESC;" -Description "2. Connexions actives par utilisateur et état" -OutputFile $reportFile

# 3. Toutes les connexions détaillées
Execute-Query -Query "SELECT pid, usename, application_name, state, query_start, state_change, NOW() - query_start as duration, LEFT(query, 80) as query_preview FROM pg_stat_activity WHERE datname = 'yukpo_db' ORDER BY query_start DESC LIMIT 20;" -Description "3. Détails des connexions actives" -OutputFile $reportFile

# 4. Migrations appliquées
Execute-Query -Query "SELECT version, description, installed_on, success, execution_time FROM _sqlx_migrations ORDER BY installed_on DESC LIMIT 20;" -Description "4. Migrations SQLx appliquées" -OutputFile $reportFile

# 5. Migrations en échec
Execute-Query -Query "SELECT version, description, installed_on, execution_time FROM _sqlx_migrations WHERE success = false ORDER BY installed_on DESC;" -Description "5. Migrations en échec" -OutputFile $reportFile

# 6. Liste des tables
Execute-Query -Query "SELECT table_name, table_type FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;" -Description "6. Liste de toutes les tables" -OutputFile $reportFile

# 7. Statistiques des tables (taille et nombre de lignes)
Execute-Query -Query "SELECT schemaname, tablename, n_live_tup as row_count, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as total_size, pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) as table_size FROM pg_stat_user_tables ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC LIMIT 30;" -Description "7. Statistiques des tables (taille et lignes)" -OutputFile $reportFile

# 8. Extensions PostgreSQL
Execute-Query -Query "SELECT extname, extversion, extrelocatable FROM pg_extension ORDER BY extname;" -Description "8. Extensions PostgreSQL installées" -OutputFile $reportFile

# 9. Permissions de yukpo_db_user
Execute-Query -Query "SELECT table_schema, table_name, privilege_type FROM information_schema.role_table_grants WHERE grantee = 'yukpo_db_user' ORDER BY table_name, privilege_type LIMIT 50;" -Description "9. Permissions de yukpo_db_user sur les tables" -OutputFile $reportFile

# 10. Taille de la base de données
Execute-Query -Query "SELECT pg_size_pretty(pg_database_size('yukpo_db')) as database_size, pg_size_pretty(pg_database_size(current_database())) as current_db_size;" -Description "10. Taille de la base de données" -OutputFile $reportFile

# 11. Transactions longues
Execute-Query -Query "SELECT pid, usename, datname, state, query_start, state_change, NOW() - query_start as duration, LEFT(query, 100) as query_preview FROM pg_stat_activity WHERE datname = 'yukpo_db' AND state != 'idle' AND NOW() - query_start > interval '5 seconds' ORDER BY duration DESC;" -Description "11. Transactions longues (>5 secondes)" -OutputFile $reportFile

# 12. Locks actifs
Execute-Query -Query "SELECT locktype, relation::regclass as table_name, mode, granted, pid FROM pg_locks WHERE relation IS NOT NULL ORDER BY granted, pid LIMIT 30;" -Description "12. Locks actifs sur les tables" -OutputFile $reportFile

# 13. Index manquants potentiels
Execute-Query -Query "SELECT schemaname, tablename, attname, n_distinct, correlation FROM pg_stats WHERE schemaname = 'public' AND n_distinct > 100 AND correlation < 0.1 ORDER BY n_distinct DESC LIMIT 20;" -Description "13. Colonnes avec faible corrélation (index potentiels)" -OutputFile $reportFile

# 14. Utilisateurs de la base de données
Execute-Query -Query "SELECT usename, usecreatedb, usesuper, valuntil FROM pg_user WHERE usename IN ('postgres', 'yukpo_db_user') ORDER BY usename;" -Description "14. Informations sur les utilisateurs" -OutputFile $reportFile

# 15. Configuration PostgreSQL
Execute-Query -Query "SELECT name, setting, unit, source FROM pg_settings WHERE name IN ('max_connections', 'shared_buffers', 'effective_cache_size', 'maintenance_work_mem', 'work_mem', 'max_worker_processes') ORDER BY name;" -Description "15. Configuration PostgreSQL importante" -OutputFile $reportFile

# 16. Vérification des tables critiques
$criticalTables = @("users", "services", "products", "deliveries", "orders", "media", "conversations", "chat_messages")
foreach ($table in $criticalTables) {
    Execute-Query -Query "SELECT COUNT(*) as row_count FROM $table;" -Description "16.$($criticalTables.IndexOf($table) + 1). Nombre de lignes dans $table" -OutputFile $reportFile
}

# 17. Vérification des contraintes de clés étrangères
Execute-Query -Query "SELECT tc.table_name, kcu.column_name, ccu.table_name AS foreign_table_name, ccu.column_name AS foreign_column_name, tc.constraint_name FROM information_schema.table_constraints AS tc JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name JOIN information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = tc.constraint_name WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public' ORDER BY tc.table_name LIMIT 30;" -Description "17. Contraintes de clés étrangères" -OutputFile $reportFile

# 18. Vérification des index
Execute-Query -Query "SELECT schemaname, tablename, indexname, indexdef FROM pg_indexes WHERE schemaname = 'public' ORDER BY tablename, indexname LIMIT 50;" -Description "18. Index créés" -OutputFile $reportFile

# Résumé final
$summary = @"

========================================
RÉSUMÉ DE L'ANALYSE
========================================
Date: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
Rapport complet: $reportFile

Vérifications effectuées:
- Version PostgreSQL et informations de connexion
- Connexions actives et leurs états
- Migrations appliquées et en échec
- Liste et statistiques des tables
- Extensions installées
- Permissions de l'utilisateur
- Taille de la base de données
- Transactions longues
- Locks actifs
- Index et contraintes
- Tables critiques

Consultez le fichier de rapport pour les détails complets.

"@

Add-Content -Path $reportFile -Value $summary

Write-Host ""
Write-Host "=== ANALYSE TERMINÉE ===" -ForegroundColor Green
Write-Host "Rapport complet: $reportFile" -ForegroundColor Cyan
Write-Host ""

# Afficher un résumé rapide
Write-Host "Résumé rapide:" -ForegroundColor Yellow
$quickSummary = psql $DatabaseUrl -t -c "SELECT 'Utilisateur: ' || current_user || ' | Base: ' || current_database() || ' | Taille: ' || pg_size_pretty(pg_database_size(current_database()));" 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host $quickSummary.Trim() -ForegroundColor Green
}

Write-Host ""
Write-Host "Pour voir le rapport complet:" -ForegroundColor Yellow
Write-Host "  Get-Content $reportFile" -ForegroundColor Cyan

