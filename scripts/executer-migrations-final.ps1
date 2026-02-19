# Script final pour exécuter toutes les migrations avec correction automatique
# Date: 2026-02-15

param(
    [string]$DatabaseUrl = "postgresql://yukpo_user:TempPassword123!@34.79.199.41:5432/yukpo_db?sslmode=require"
)

$env:DATABASE_URL = $DatabaseUrl
$env:PGPASSWORD = ($DatabaseUrl -split ":")[2] -replace "@.*", ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "EXECUTION FINALE DES MIGRATIONS" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Étape 1: Renommer les migrations en conflit
Write-Host "[ETAPE 1/3] Renommage des migrations en conflit..." -ForegroundColor Yellow
& ".\scripts\renommer-migrations-conflits.ps1"
Write-Host ""

# Étape 2: Exécuter les migrations avec correction automatique
Write-Host "[ETAPE 2/3] Execution des migrations avec correction automatique..." -ForegroundColor Yellow
Write-Host ""

$maxIterations = 100
$iteration = 0
$success = $false
$totalApplied = 0
$lastError = ""

while ($iteration -lt $maxIterations -and -not $success) {
    $iteration++
    
    if ($iteration -gt 1) {
        Write-Host "[ITERATION $iteration/$maxIterations] Nouvelle tentative..." -ForegroundColor Yellow
        Start-Sleep -Seconds 2
    }
    
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
            $currentError = $errorLine.ToString()
            
            # Si c'est la même erreur qu'avant, on a un problème récurrent
            if ($currentError -eq $lastError -and $iteration -gt 3) {
                Write-Host ""
                Write-Host "[ATTENTION] Meme erreur repetee: $currentError" -ForegroundColor Yellow
                Write-Host "[INFO] Correction manuelle requise" -ForegroundColor Yellow
                break
            }
            
            $lastError = $currentError
            Write-Host ""
            Write-Host "[ERREUR] $currentError" -ForegroundColor Red
            
            # Détecter le type d'erreur et corriger automatiquement
            if ($currentError -match 'duplicate key value violates unique constraint "_sqlx_migrations_pkey"') {
                # Conflit de numéro de migration
                $migrationNum = ($output | Select-String -Pattern "Applied (\d+)/migrate" | Select-Object -Last 1)
                if ($migrationNum -match "Applied (\d+)/") {
                    $conflictNum = $matches[1]
                    Write-Host "[AUTO-FIX] Conflit detecte avec migration $conflictNum" -ForegroundColor Yellow
                    Write-Host "[AUTO-FIX] Suppression de l'entree de _sqlx_migrations..." -ForegroundColor Yellow
                    
                    psql $DatabaseUrl -c "DELETE FROM _sqlx_migrations WHERE version = $conflictNum;" 2>&1 | Out-Null
                    Write-Host "[OK] Entree supprimee" -ForegroundColor Green
                }
            } elseif ($currentError -match 'column "(\w+)" does not exist') {
                $columnName = $matches[1]
                Write-Host "[AUTO-FIX] Colonne manquante: $columnName" -ForegroundColor Yellow
                
                # Chercher la table qui devrait contenir cette colonne
                $migrationNum = ($output | Select-String -Pattern "Applied (\d+)/migrate" | Select-Object -Last 1)
                if ($migrationNum -match "Applied (\d+)/") {
                    $migNum = $matches[1]
                    Write-Host "[INFO] Migration en cours: $migNum" -ForegroundColor Cyan
                    
                    # Chercher toutes les tables qui pourraient contenir cette colonne
                    $tables = psql $DatabaseUrl -c "SELECT table_name FROM information_schema.columns WHERE column_name = '$columnName' AND table_schema = 'public';" 2>&1
                    if ($tables -match "(\w+)") {
                        $tableName = $matches[1]
                        Write-Host "[AUTO-FIX] Suppression de la table $tableName..." -ForegroundColor Yellow
                        psql $DatabaseUrl -c "DROP TABLE IF EXISTS $tableName CASCADE;" 2>&1 | Out-Null
                        Write-Host "[OK] Table supprimee" -ForegroundColor Green
                    }
                }
            } elseif ($currentError -match 'relation "(\w+)" already exists') {
                $relationName = $matches[1]
                Write-Host "[AUTO-FIX] Relation existante: $relationName" -ForegroundColor Yellow
                Write-Host "[AUTO-FIX] Suppression..." -ForegroundColor Yellow
                psql $DatabaseUrl -c "DROP TABLE IF EXISTS $relationName CASCADE; DROP VIEW IF EXISTS $relationName CASCADE; DROP SEQUENCE IF EXISTS ${relationName}_id_seq CASCADE;" 2>&1 | Out-Null
                Write-Host "[OK] Relation supprimee" -ForegroundColor Green
            } elseif ($currentError -match 'table "(\w+)" does not exist') {
                Write-Host "[INFO] Table manquante (sera creee par la migration)" -ForegroundColor Yellow
            }
            
            Write-Host ""
            Write-Host "Progres total: $totalApplied migrations appliquees dans cette session" -ForegroundColor Cyan
            Write-Host ""
        } else {
            Write-Host "[ERREUR] Impossible d'extraire l'erreur" -ForegroundColor Red
            $output | Select-Object -Last 10
            break
        }
    }
}

# Étape 3: Vérification finale
Write-Host ""
Write-Host "[ETAPE 3/3] Verification finale..." -ForegroundColor Yellow

if (-not $success) {
    Write-Host ""
    Write-Host "[ATTENTION] Maximum d'iterations atteint ($maxIterations)" -ForegroundColor Yellow
    Write-Host "Total de migrations appliquees dans cette session: $totalApplied" -ForegroundColor Cyan
}

Push-Location backend
$info = cargo sqlx migrate info 2>&1
$applied = ($info | Select-String -Pattern "applied").Count
$pending = ($info | Select-String -Pattern "pending").Count
Pop-Location

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "RESUME FINAL" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Migrations appliquees: $applied" -ForegroundColor Green
Write-Host "Migrations en attente: $pending" -ForegroundColor $(if ($pending -eq 0) { "Green" } else { "Yellow" })
Write-Host ""

if ($pending -eq 0) {
    Write-Host "[SUCCESS] Toutes les migrations ont ete appliquees avec succes!" -ForegroundColor Green
} else {
    Write-Host "[INFO] Il reste $pending migrations a appliquer" -ForegroundColor Yellow
    Write-Host "[INFO] Relancez ce script pour continuer" -ForegroundColor Cyan
}

$env:DATABASE_URL = $null
$env:PGPASSWORD = $null

Write-Host ""



