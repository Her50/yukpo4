# Script PowerShell pour corriger les types de timestamp
# Remplacer NaiveDateTime par DateTime<Utc> dans tous les fichiers Rust

$files = @(
    "src/services/native_search_service.rs",
    "src/services/rechercher_besoin.rs"
)

foreach ($file in $files) {
    if (Test-Path $file) {
        Write-Host "Correction de $file..."
        $content = Get-Content $file -Raw
        $content = $content -replace 'chrono::NaiveDateTime', 'chrono::DateTime<chrono::Utc>'
        $content = $content -replace 'NaiveDateTime', 'DateTime<Utc>'
        Set-Content $file $content -NoNewline
        Write-Host "✅ $file corrigé"
    }
}

Write-Host "Correction terminée !" 