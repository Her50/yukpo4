# Script pour renommer toutes les migrations en conflit avec des numéros séquentiels uniques
# Date: 2026-02-15

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "RENOMMAGE MIGRATIONS EN CONFLIT" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$migrationsDir = "backend\migrations"
if (-not (Test-Path $migrationsDir)) {
    Write-Host "[ERREUR] Dossier migrations non trouve: $migrationsDir" -ForegroundColor Red
    exit 1
}

Write-Host "[ETAPE 1/3] Analyse des migrations..." -ForegroundColor Yellow

# Récupérer toutes les migrations et les grouper par préfixe numérique
$allMigrations = Get-ChildItem $migrationsDir -Filter "*.sql" | Sort-Object Name

# Dictionnaire pour stocker les migrations par préfixe
$migrationsByPrefix = @{}

foreach ($migration in $allMigrations) {
    # Extraire le préfixe numérique (peut être 00000030, 20250101, etc.)
    if ($migration.Name -match '^(\d+)_') {
        $prefix = $matches[1]
        if (-not $migrationsByPrefix.ContainsKey($prefix)) {
            $migrationsByPrefix[$prefix] = @()
        }
        $migrationsByPrefix[$prefix] += $migration
    }
}

# Identifier les conflits (préfixes avec plus d'une migration)
$conflicts = $migrationsByPrefix.GetEnumerator() | Where-Object { $_.Value.Count -gt 1 } | Sort-Object { [int]($_.Key -replace '^\d{8}', '0') -as [int] }

Write-Host "   [INFO] Total migrations: $($allMigrations.Count)" -ForegroundColor Cyan
Write-Host "   [INFO] Conflits detectes: $($conflicts.Count)" -ForegroundColor Yellow
Write-Host ""

if ($conflicts.Count -eq 0) {
    Write-Host "[OK] Aucun conflit detecte!" -ForegroundColor Green
    exit 0
}

Write-Host "[ETAPE 2/3] Renommage des migrations en conflit..." -ForegroundColor Yellow

# Trouver le numéro de migration le plus élevé actuellement
# SQLx utilise le préfixe numérique pour déterminer l'ordre
$maxMigrationNum = 0
foreach ($migration in $allMigrations) {
    if ($migration.Name -match '^(\d+)_') {
        $num = $matches[1]
        # Pour les migrations avec format date (20250101, 20250101001, etc.), on les garde telles quelles
        # Pour les migrations numériques (00000030), on extrait le numéro
        if ($num -match '^\d{8,}$') {
            # Format date (8+ chiffres), on ne change pas
            continue
        } else {
            # Format numérique (00000030), extraire le numéro
            try {
                $numValue = [int]$num
                if ($numValue -gt $maxMigrationNum) {
                    $maxMigrationNum = $numValue
                }
            } catch {
                # Ignorer les erreurs de conversion
            }
        }
    }
}

Write-Host "   [INFO] Numero de migration maximum: $maxMigrationNum" -ForegroundColor Cyan
Write-Host ""

$renamedCount = 0
# Utiliser un numéro de départ élevé pour éviter les conflits (commencer à 1000)
$nextMigrationNum = [Math]::Max($maxMigrationNum + 1, 1000)

# Traiter chaque conflit
foreach ($conflict in $conflicts) {
    $prefix = $conflict.Key
    $migrations = $conflict.Value | Sort-Object Name
    
    Write-Host "   [CONFLIT] Prefixe: $prefix ($($migrations.Count) migrations)" -ForegroundColor Yellow
    
    # Garder la première migration avec le préfixe original
    $firstMigration = $migrations[0]
    Write-Host "      [GARDE] $($firstMigration.Name)" -ForegroundColor Green
    
    # Renommer les autres avec des numéros séquentiels
    for ($i = 1; $i -lt $migrations.Count; $i++) {
        $migration = $migrations[$i]
        $newName = "{0:D8}_{1}" -f $nextMigrationNum, ($migration.Name -replace '^\d+_', '')
        $newPath = Join-Path $migrationsDir $newName
        
        Write-Host "      [RENOMME] $($migration.Name) -> $newName" -ForegroundColor Cyan
        
        Rename-Item -Path $migration.FullName -NewName $newName -ErrorAction Stop
        $renamedCount++
        $nextMigrationNum++
    }
    Write-Host ""
}

Write-Host "[ETAPE 3/3] Verification..." -ForegroundColor Yellow

# Vérifier qu'il n'y a plus de conflits
$remainingConflicts = Get-ChildItem $migrationsDir -Filter "*.sql" | 
    Group-Object { ($_.Name -replace '^(\d+)_.*', '$1') } | 
    Where-Object { $_.Count -gt 1 }

if ($remainingConflicts.Count -eq 0) {
    Write-Host "   [OK] Aucun conflit restant!" -ForegroundColor Green
} else {
    Write-Host "   [ATTENTION] $($remainingConflicts.Count) conflits restants" -ForegroundColor Yellow
    foreach ($conflict in $remainingConflicts) {
        Write-Host "      Prefixe $($conflict.Name): $($conflict.Count) migrations" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "[SUCCESS] $renamedCount migrations renommees" -ForegroundColor Green
Write-Host ""

