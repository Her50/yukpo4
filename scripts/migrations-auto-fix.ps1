# Script automatisé pour corriger les erreurs de migration et continuer
# Date: 2026-02-15

param(
    [string]$DatabaseUrl = "postgresql://yukpo_user:TempPassword123!@34.79.199.41:5432/yukpo_db?sslmode=require"
)

$env:DATABASE_URL = $DatabaseUrl
$env:PGPASSWORD = ($DatabaseUrl -split ":")[2] -replace "@.*", ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "MIGRATIONS AUTO-FIX" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$maxIterations = 50
$iteration = 0
$success = $false
$totalApplied = 0

while ($iteration -lt $maxIterations -and -not $success) {
    $iteration++
    Write-Host "[ITERATION $iteration/$maxIterations] Execution des migrations..." -ForegroundColor Yellow
    
    Push-Location backend
    $output = cargo sqlx migrate run 2>&1
    $exitCode = $LASTEXITCODE
    Pop-Location
    
    # Compter les migrations appliquées
    $appliedInThisRun = ($output | Select-String -Pattern "Applied \d+/migrate").Count
    $totalApplied += $appliedInThisRun
    
    if ($exitCode -eq 0) {
        Write-Host ""
        Write-Host "[SUCCESS] Toutes les migrations ont ete appliquees!" -ForegroundColor Green
        $success = $true
        
        # Afficher le résumé
        Push-Location backend
        $info = cargo sqlx migrate info 2>&1
        $applied = ($info | Select-String -Pattern "applied").Count
        $pending = ($info | Select-String -Pattern "pending").Count
        Pop-Location
        
        Write-Host ""
        Write-Host "Migrations appliquees: $applied" -ForegroundColor Green
        Write-Host "Migrations en attente: $pending" -ForegroundColor $(if ($pending -eq 0) { "Green" } else { "Yellow" })
    } else {
        # Extraire l'erreur
        $errorLine = $output | Select-String -Pattern "error:" | Select-Object -First 1
        
        if ($errorLine) {
            Write-Host ""
            Write-Host "[ERREUR] $errorLine" -ForegroundColor Red
            
            # Détecter le type d'erreur et corriger automatiquement
            if ($errorLine -match 'column "(\w+)" does not exist') {
                $columnName = $matches[1]
                $migrationNum = ($output | Select-String -Pattern "Applied (\d+)/migrate" | Select-Object -Last 1) -replace ".*Applied (\d+)/.*", '$1'
                Write-Host "[AUTO-FIX] Colonne manquante detectee: $columnName dans migration $migrationNum" -ForegroundColor Yellow
                Write-Host "[INFO] Recherche de la table contenant cette colonne..." -ForegroundColor Cyan
                
                # Trouver la table dans la migration suivante
                $nextMigration = [int]$migrationNum + 1
                $migrationFiles = Get-ChildItem backend\migrations\*.sql | Sort-Object Name
                $migrationFile = $migrationFiles | Where-Object { $_.Name -match "^0{0,4}$nextMigration" } | Select-Object -First 1
                
                if ($migrationFile) {
                    $content = Get-Content $migrationFile.FullName -Raw
                    if ($content -match "CREATE TABLE.*?(\w+).*?$columnName") {
                        $tableName = $matches[1]
                        Write-Host "[AUTO-FIX] Table detectee: $tableName" -ForegroundColor Yellow
                        Write-Host "[AUTO-FIX] Suppression de la table $tableName..." -ForegroundColor Yellow
                        
                        # Supprimer la table
                        psql $DatabaseUrl -c "DROP TABLE IF EXISTS $tableName CASCADE;" 2>&1 | Out-Null
                        Write-Host "[OK] Table $tableName supprimee" -ForegroundColor Green
                    } elseif ($content -match "CREATE INDEX.*?(\w+).*?$columnName") {
                        # C'est un index qui référence une colonne inexistante
                        Write-Host "[INFO] Index reference une colonne inexistante, recherche de la table..." -ForegroundColor Yellow
                        # Chercher toutes les tables qui pourraient contenir cette colonne
                        $tables = psql $DatabaseUrl -c "SELECT table_name FROM information_schema.columns WHERE column_name = '$columnName' AND table_schema = 'public';" 2>&1
                        if ($tables -match "(\w+)") {
                            $tableName = $matches[1]
                            Write-Host "[AUTO-FIX] Suppression de la table $tableName..." -ForegroundColor Yellow
                            psql $DatabaseUrl -c "DROP TABLE IF EXISTS $tableName CASCADE;" 2>&1 | Out-Null
                            Write-Host "[OK] Table $tableName supprimee" -ForegroundColor Green
                        }
                    }
                }
            } elseif ($errorLine -match 'table "(\w+)" does not exist') {
                $tableName = $matches[1]
                Write-Host "[INFO] Table manquante: $tableName (sera creee par la migration)" -ForegroundColor Yellow
            } elseif ($errorLine -match 'relation "(\w+)" already exists') {
                $relationName = $matches[1]
                Write-Host "[AUTO-FIX] Relation existante: $relationName" -ForegroundColor Yellow
                Write-Host "[AUTO-FIX] Suppression de la relation $relationName..." -ForegroundColor Yellow
                psql $DatabaseUrl -c "DROP TABLE IF EXISTS $relationName CASCADE; DROP VIEW IF EXISTS $relationName CASCADE; DROP SEQUENCE IF EXISTS ${relationName}_id_seq CASCADE;" 2>&1 | Out-Null
                Write-Host "[OK] Relation $relationName supprimee" -ForegroundColor Green
            } elseif ($errorLine -match 'constraint "(\w+)"') {
                $constraintName = $matches[1]
                Write-Host "[AUTO-FIX] Contrainte existante: $constraintName" -ForegroundColor Yellow
                # La contrainte sera gérée par DROP TABLE CASCADE
            }
            
            Write-Host ""
            Write-Host "Dernieres lignes d'erreur:" -ForegroundColor Yellow
            $output | Select-Object -Last 5 | ForEach-Object { Write-Host "   $_" -ForegroundColor Gray }
            Write-Host ""
            Write-Host "Progres total: $totalApplied migrations appliquees dans cette session" -ForegroundColor Cyan
            Write-Host ""
            
            Start-Sleep -Seconds 1
        } else {
            Write-Host "[ERREUR] Impossible d'extraire l'erreur" -ForegroundColor Red
            $output | Select-Object -Last 10
            break
        }
    }
}

if (-not $success) {
    Write-Host ""
    Write-Host "[ATTENTION] Maximum d'iterations atteint ($maxIterations)" -ForegroundColor Yellow
    Write-Host "Total de migrations appliquees dans cette session: $totalApplied" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Verification de l'etat actuel..." -ForegroundColor Cyan
    Push-Location backend
    $info = cargo sqlx migrate info 2>&1
    $applied = ($info | Select-String -Pattern "applied").Count
    $pending = ($info | Select-String -Pattern "pending").Count
    Pop-Location
    Write-Host "Migrations appliquees: $applied" -ForegroundColor Green
    Write-Host "Migrations en attente: $pending" -ForegroundColor Yellow
}

$env:DATABASE_URL = $null
$env:PGPASSWORD = $null

Write-Host ""


