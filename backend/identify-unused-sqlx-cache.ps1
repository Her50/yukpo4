#!/usr/bin/env pwsh
# Script pour identifier les fichiers .sqlx dans Git qui ne correspondent plus aux requêtes actuelles

Write-Host "=== Identification des fichiers .sqlx obsolètes ===" -ForegroundColor Green

Set-Location (Split-Path -Parent $MyInvocation.MyCommand.Definition)

# 1. Extraire toutes les requêtes SQLx du code source
Write-Host "1. Extraction des requêtes SQLx du code source..." -ForegroundColor Cyan
$allSqlQueries = @()
Get-ChildItem -Path src -Recurse -Filter "*.rs" | ForEach-Object {
    $content = Get-Content $_.FullName -Raw
    # Extraire les requêtes sqlx::query!, sqlx::query_scalar!, sqlx::query_as!
    $matches = [regex]::Matches($content, '(?:sqlx::query|sqlx::query_scalar|sqlx::query_as)!\([^)]*"([^"]+)"', [System.Text.RegularExpressions.RegexOptions]::Singleline)
    foreach ($match in $matches) {
        $query = $match.Groups[1].Value
        $allSqlQueries += $query
    }
}

Write-Host "   Requêtes SQLx trouvées dans le code: $($allSqlQueries.Count)" -ForegroundColor Yellow

# 2. Lister les fichiers .sqlx dans Git
Write-Host "2. Liste des fichiers .sqlx dans Git..." -ForegroundColor Cyan
$gitSqlxFiles = git ls-files backend/.sqlx 2>$null | ForEach-Object { 
    $_ -replace 'backend/\.sqlx/', ''
}
Write-Host "   Fichiers .sqlx dans Git: $($gitSqlxFiles.Count)" -ForegroundColor Yellow

# 3. Lire les fichiers .sqlx et extraire les requêtes SQL qu'ils représentent
Write-Host "3. Analyse des fichiers .sqlx dans Git..." -ForegroundColor Cyan
$sqlxFileQueries = @{}
foreach ($file in $gitSqlxFiles) {
    $filePath = Join-Path ".sqlx" $file
    if (Test-Path $filePath) {
        try {
            $json = Get-Content $filePath -Raw | ConvertFrom-Json
            if ($json.query) {
                $sqlxFileQueries[$file] = $json.query
            }
        } catch {
            # Ignorer les erreurs de parsing
        }
    }
}

Write-Host "   Fichiers .sqlx analysés: $($sqlxFileQueries.Count)" -ForegroundColor Yellow

# 4. Identifier les fichiers .sqlx qui ne correspondent à aucune requête actuelle
Write-Host "4. Identification des fichiers obsolètes..." -ForegroundColor Cyan
$obsoleteFiles = @()
foreach ($file in $sqlxFileQueries.Keys) {
    $queryInFile = $sqlxFileQueries[$file]
    $found = $false
    foreach ($queryInCode in $allSqlQueries) {
        # Normaliser les requêtes pour comparaison (supprimer espaces, retours à la ligne)
        $normalizedFile = $queryInFile -replace '\s+', ' '
        $normalizedCode = $queryInCode -replace '\s+', ' '
        if ($normalizedFile -eq $normalizedCode -or $normalizedFile -like "*$normalizedCode*" -or $normalizedCode -like "*$normalizedFile*") {
            $found = $true
            break
        }
    }
    if (-not $found) {
        $obsoleteFiles += $file
    }
}

Write-Host "   Fichiers .sqlx potentiellement obsolètes: $($obsoleteFiles.Count)" -ForegroundColor $(if ($obsoleteFiles.Count -gt 0) { "Red" } else { "Green" })

# 5. Afficher les fichiers obsolètes
if ($obsoleteFiles.Count -gt 0) {
    Write-Host ""
    Write-Host "Fichiers .sqlx potentiellement obsolètes (ne correspondent à aucune requête actuelle):" -ForegroundColor Red
    $obsoleteFiles | Select-Object -First 20 | ForEach-Object { Write-Host "   - $_" -ForegroundColor Yellow }
    
    if ($obsoleteFiles.Count -gt 20) {
        Write-Host "   ... et $($obsoleteFiles.Count - 20) autres fichiers" -ForegroundColor Yellow
    }
}

# 6. Identifier les requêtes du code qui n'ont pas de fichier .sqlx correspondant
Write-Host ""
Write-Host "5. Identification des requêtes sans fichier .sqlx..." -ForegroundColor Cyan
$queriesWithoutFile = @()
foreach ($queryInCode in $allSqlQueries) {
    $found = $false
    foreach ($queryInFile in $sqlxFileQueries.Values) {
        $normalizedFile = $queryInFile -replace '\s+', ' '
        $normalizedCode = $queryInCode -replace '\s+', ' '
        if ($normalizedFile -eq $normalizedCode -or $normalizedFile -like "*$normalizedCode*" -or $normalizedCode -like "*$normalizedFile*") {
            $found = $true
            break
        }
    }
    if (-not $found) {
        $queriesWithoutFile += $queryInCode.Substring(0, [Math]::Min(100, $queryInCode.Length))
    }
}

Write-Host "   Requêtes sans fichier .sqlx correspondant: $($queriesWithoutFile.Count)" -ForegroundColor $(if ($queriesWithoutFile.Count -gt 0) { "Red" } else { "Green" })

if ($queriesWithoutFile.Count -gt 0) {
    Write-Host ""
    Write-Host "Premières requêtes sans fichier .sqlx:" -ForegroundColor Red
    $queriesWithoutFile | Select-Object -First 5 | ForEach-Object { Write-Host "   - $_..." -ForegroundColor Yellow }
}

# 7. Résumé
Write-Host ""
Write-Host "=== Résumé ===" -ForegroundColor Green
Write-Host "Fichiers .sqlx dans Git: $($gitSqlxFiles.Count)" -ForegroundColor Cyan
Write-Host "Fichiers .sqlx potentiellement obsolètes: $($obsoleteFiles.Count)" -ForegroundColor $(if ($obsoleteFiles.Count -gt 0) { "Red" } else { "Green" })
Write-Host "Requêtes sans fichier .sqlx: $($queriesWithoutFile.Count)" -ForegroundColor $(if ($queriesWithoutFile.Count -gt 0) { "Red" } else { "Green" })

Write-Host ""
Write-Host "Gap: $($gitSqlxFiles.Count) fichiers dans Git - $(($gitSqlxFiles.Count) - $obsoleteFiles.Count) fichiers utilisés = $obsoleteFiles.Count fichiers obsolètes" -ForegroundColor Yellow

if ($obsoleteFiles.Count -gt 0) {
    Write-Host ""
    Write-Host "⚠️ Ces fichiers obsolètes dans Git peuvent causer des problèmes dans Docker si:" -ForegroundColor Red
    Write-Host "   1. Ils correspondent à d'anciennes requêtes qui ont changé" -ForegroundColor Yellow
    Write-Host "   2. Ils ne sont plus générés par 'cargo sqlx prepare --workspace'" -ForegroundColor Yellow
    Write-Host "   3. Docker copie ces fichiers obsolètes au lieu des nouveaux" -ForegroundColor Yellow
}

