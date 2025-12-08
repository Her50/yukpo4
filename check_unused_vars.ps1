# Script pour analyser les variables non utilisées
$env:DATABASE_URL = "postgresql://yukpo_db_user:88X47ZWBiLkX5WatFcLU4KQ4rgaHYml4@dpg-d2t7ntbuibrs73eh9tvg-a.frankfurt-postgres.render.com/yukpo_db"
$warnings = cargo clippy --lib -p yukpomnang_backend --message-format=short 2>&1 | Select-String -Pattern "unused variable"

$results = @()
foreach ($warning in $warnings) {
    if ($warning -match 'warning: unused variable: `([^`]+)`\s+--> ([^:]+):(\d+):(\d+)') {
        $varName = $matches[1]
        $file = $matches[2]
        $line = $matches[3]
        $col = $matches[4]
        
        $results += [PSCustomObject]@{
            Variable = $varName
            File     = $file
            Line     = $line
            Column   = $col
        }
    }
}

$results | Format-Table -AutoSize
Write-Host "`nTotal: $($results.Count) variables non utilisées"

# Grouper par fichier
$results | Group-Object File | ForEach-Object {
    Write-Host "`n$($_.Name): $($_.Count) variables"
    $_.Group | ForEach-Object { Write-Host "  - $($_.Variable) (ligne $($_.Line))" }
}

