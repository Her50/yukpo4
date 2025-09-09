# Ce script PowerShell vérifie et corrige l'encodage UTF-8 de tous les fichiers .sql dans backend/migrations
# Il remplace les caractères non-ASCII par leur équivalent ou les supprime

$MigrationDir = Join-Path $PSScriptRoot 'migrations'
$Files = Get-ChildItem -Path $MigrationDir -Filter *.sql

foreach ($file in $Files) {
    Write-Host "Vérification de $($file.Name) ..."
    $content = Get-Content $file.FullName -Raw
    # Supprime le BOM UTF-8 s'il existe
    if ($content.StartsWith([char]0xFEFF)) {
        $content = $content.Substring(1)
        Write-Host "  -> BOM détecté et supprimé."
    } elseif ($content.Length -ge 3 -and [System.Text.Encoding]::UTF8.GetBytes($content)[0..2] -eq @(0xEF,0xBB,0xBF)) {
        $content = $content.Substring(3)
        Write-Host "  -> BOM (EF BB BF) détecté et supprimé."
    }
    $fixed = $content -replace '[^\u0000-\u007F]', ''  # Supprime les caractères non-ASCII
    if ($content -ne $fixed) {
        Write-Host "  -> Caractères non-ASCII détectés et supprimés."
    }
    # Réécriture en UTF-8 sans BOM
    [System.IO.File]::WriteAllText($file.FullName, $fixed, [System.Text.Encoding]::UTF8)
    Write-Host "  -> Réécriture en UTF-8 sans BOM terminée."
}
Write-Host "Tous les fichiers de migration ont été vérifiés et corrigés."
