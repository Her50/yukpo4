# Supprime le BOM UTF-8 (EF BB BF) en début de chaque fichier .sql dans le dossier migrations
$MigrationDir = Join-Path $PSScriptRoot 'migrations'
$Files = Get-ChildItem -Path $MigrationDir -Filter *.sql

foreach ($file in $Files) {
    Write-Host "Traitement de $($file.Name) ..."
    $bytes = [System.IO.File]::ReadAllBytes($file.FullName)
    if ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {
        $bytes = $bytes[3..($bytes.Length-1)]
        Write-Host "  -> BOM UTF-8 détecté et supprimé."
    }
    [System.IO.File]::WriteAllBytes($file.FullName, $bytes)
    Write-Host "  -> Réécriture du fichier terminée."
}
Write-Host "Tous les fichiers de migration ont été traités pour suppression du BOM."
