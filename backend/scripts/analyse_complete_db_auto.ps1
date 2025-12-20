# Script d'analyse automatique avec execution des requetes via psql
# Version autonome qui execute toutes les analyses

$DatabaseUrl = "postgresql://user:password@host:port/database"

$resultsDir = "backend/analyses_db"
if (-not (Test-Path $resultsDir)) {
    New-Item -ItemType Directory -Path $resultsDir -Force | Out-Null
}

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$reportFile = "$resultsDir/rapport_analyse_execute_$timestamp.txt"

Write-Host "=== ANALYSE AUTOMATIQUE DE LA BASE DE DONNEES ===" -ForegroundColor Cyan
Write-Host "Rapport: $reportFile" -ForegroundColor Gray
Write-Host ""

# Vérifier psql
try {
    $psqlPath = (Get-Command psql -ErrorAction Stop).Source
    Write-Host "[OK] psql trouve: $psqlPath" -ForegroundColor Green
}
catch {
    Write-Host "[ERREUR] psql non trouve. Installez PostgreSQL." -ForegroundColor Red
    exit 1
}

# Fonction pour executer une requete
function Execute-Query {
    param(
        [string]$Query,
        [string]$Description
    )
    
    Write-Host "[EXEC] $Description..." -ForegroundColor Yellow -NoNewline
    
    $output = @"
`n========================================
$Description
========================================
Requete: $Query
"@
    
    try {
        # Utiliser PGPASSWORD pour eviter les prompts
        $env:PGPASSWORD = "YOUR_PASSWORD"
        
        $result = & $psqlPath -h "your-render-db-host.render.com" -p 5432 -U "yukpo_db_user" -d "yukpo_db" -t -A -c $Query 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            $output += "`n[OK] Resultat:`n$result`n"
            Write-Host " [OK]" -ForegroundColor Green
            return $true
        }
        else {
            $output += "`n[ERREUR] Code: $LASTEXITCODE`n$result`n"
            Write-Host " [ERREUR]" -ForegroundColor Red
            return $false
        }
    }
    catch {
        $output += "`n[EXCEPTION] $($_.Exception.Message)`n"
        Write-Host " [EXCEPTION]" -ForegroundColor Red
        return $false
    }
    finally {
        Add-Content -Path $reportFile -Value $output
    }
}

# Header du rapport
$header = @"
========================================
RAPPORT D'ANALYSE AUTOMATIQUE
Date: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
Base: yukpo_db
Host: your-render-db-host.render.com
========================================

"@
Set-Content -Path $reportFile -Value $header

# Executer les analyses
Write-Host "`nExecution des analyses..." -ForegroundColor Cyan

Execute-Query -Query "SELECT version();" -Description "1. Version PostgreSQL"
Execute-Query -Query "SELECT current_user, current_database();" -Description "1b. Utilisateur et base actuelle"
Execute-Query -Query "SELECT usename, COUNT(*) as count FROM pg_stat_activity WHERE datname = 'yukpo_db' GROUP BY usename ORDER BY count DESC;" -Description "2. Connexions actives par utilisateur"
Execute-Query -Query "SELECT COUNT(*) as total_migrations, SUM(CASE WHEN success THEN 1 ELSE 0 END) as success_count, SUM(CASE WHEN NOT success THEN 1 ELSE 0 END) as failed_count FROM _sqlx_migrations;" -Description "3. Resume des migrations SQLx"
Execute-Query -Query "SELECT version, description, installed_on, success FROM _sqlx_migrations ORDER BY installed_on DESC LIMIT 10;" -Description "4. Dernieres migrations"
Execute-Query -Query "SELECT COUNT(*) as table_count FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';" -Description "5. Nombre de tables"
Execute-Query -Query "SELECT extname, extversion FROM pg_extension ORDER BY extname;" -Description "6. Extensions PostgreSQL"
Execute-Query -Query "SELECT pg_size_pretty(pg_database_size('yukpo_db')) as database_size;" -Description "7. Taille de la base de donnees"
Execute-Query -Query "SELECT COUNT(*) as active_connections FROM pg_stat_activity WHERE datname = 'yukpo_db' AND state = 'active';" -Description "8. Connexions actives (state=active)"
Execute-Query -Query "SELECT COUNT(*) as idle_connections FROM pg_stat_activity WHERE datname = 'yukpo_db' AND state = 'idle';" -Description "9. Connexions inactives (state=idle)"
Execute-Query -Query "SELECT usename, usecreatedb, usesuper FROM pg_user WHERE usename IN ('postgres', 'yukpo_db_user');" -Description "10. Informations utilisateurs"

# Tables critiques
Write-Host "`nVerification des tables critiques..." -ForegroundColor Cyan
$criticalTables = @("users", "services", "products", "deliveries", "orders", "media", "conversations", "chat_messages")
foreach ($table in $criticalTables) {
    Execute-Query -Query "SELECT COUNT(*) as row_count FROM $table;" -Description "Table $table - Nombre de lignes"
}

# Resume final
$summary = @"

========================================
RESUME DE L'ANALYSE
========================================
Date: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
Rapport complet: $reportFile

Analyses executees:
- Version PostgreSQL
- Utilisateur et base de donnees
- Connexions actives
- Migrations SQLx
- Tables et extensions
- Taille de la base
- Tables critiques

Consultez le fichier de rapport pour les details.

"@

Add-Content -Path $reportFile -Value $summary

Write-Host ""
Write-Host "=== ANALYSE TERMINEE ===" -ForegroundColor Green
Write-Host "Rapport: $reportFile" -ForegroundColor Cyan
Write-Host ""
Write-Host "Pour voir le rapport:" -ForegroundColor Yellow
Write-Host "  Get-Content $reportFile" -ForegroundColor Cyan

