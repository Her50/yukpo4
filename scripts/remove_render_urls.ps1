# Script pour remplacer toutes les URLs Render complètes par des placeholders
# Ce script a été utilisé pour nettoyer les credentials du dépôt
$renderUrl = "postgresql://yukpo_db_user:YOUR_PASSWORD@your-render-db-host.render.com/yukpo_db"
$renderHost = "your-render-db-host.render.com"
$placeholderUrl = "postgresql://user:password@host:port/database"
$placeholderHost = "your-render-db-host.render.com"

# Liste des fichiers à traiter (tous les fichiers trackés par Git)
$files = git ls-files | Where-Object { 
    $_ -match '\.(ps1|sh|rs|yml|md|sql|txt|py)$' 
}

$count = 0
foreach ($file in $files) {
    if (Test-Path $file) {
        $content = Get-Content $file -Raw -ErrorAction SilentlyContinue
        if ($content -and ($content -match "88X47ZWBiLkX5WatFcLU4KQ4rgaHYml4" -or $content -match [regex]::Escape($renderHost))) {
            $originalContent = $content
            $content = $content -replace [regex]::Escape($renderUrl), $placeholderUrl
            $content = $content -replace [regex]::Escape($renderHost), $placeholderHost
            $content = $content -replace "yukpo_db_user:88X47ZWBiLkX5WatFcLU4KQ4rgaHYml4", "user:password"
            $content = $content -replace '"88X47ZWBiLkX5WatFcLU4KQ4rgaHYml4"', '"YOUR_PASSWORD"'
            $content = $content -replace "'88X47ZWBiLkX5WatFcLU4KQ4rgaHYml4'", "'YOUR_PASSWORD'"
            $content = $content -replace "88X47ZWBiLkX5WatFcLU4KQ4rgaHYml4", "YOUR_PASSWORD"
            
            if ($content -ne $originalContent) {
                Set-Content -Path $file -Value $content -NoNewline
                Write-Host "✅ Modifié: $file" -ForegroundColor Green
                $count++
            }
        }
    }
}

Write-Host "`n✅ $count fichiers modifiés" -ForegroundColor Green

