# Script pour corriger les erreurs d'import causées par le script précédent
Write-Host "Correction des erreurs d'import..." -ForegroundColor Cyan

$files = Get-ChildItem "src" -Filter "*.tsx" -Recurse

foreach ($file in $files) {
    Write-Host "Correction de: $($file.Name)" -ForegroundColor Yellow
    
    $content = Get-Content $file.FullName -Raw -Encoding UTF8
    
    # Corriger les imports mal formatés
    $content = $content -replace ';`nimport', ';`nimport'
    $content = $content -replace ';`nimport', ';`nimport'
    $content = $content -replace ';`nimport', ';`nimport'
    $content = $content -replace ';`nimport', ';`nimport'
    $content = $content -replace ';`nimport', ';`nimport'
    
    # Remplacer les `n par de vraies nouvelles lignes
    $content = $content -replace '`n', "`n"
    
    # Nettoyer les imports dupliqués
    $lines = $content -split "`n"
    $uniqueLines = @()
    $seenImports = @{}
    
    foreach ($line in $lines) {
        if ($line -match '^import\s+.*from\s+') {
            $importKey = $line.Trim()
            if (-not $seenImports.ContainsKey($importKey)) {
                $seenImports[$importKey] = $true
                $uniqueLines += $line
            }
        } else {
            $uniqueLines += $line
        }
    }
    
    $content = $uniqueLines -join "`n"
    
    Set-Content $file.FullName $content -Encoding UTF8
}

Write-Host "Corrections d'import terminees!" -ForegroundColor Green















