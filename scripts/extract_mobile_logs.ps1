# Script PowerShell pour extraire uniquement les logs mobiles des logs backend
# Usage: .\extract_mobile_logs.ps1 [fichier_log] [output_file]

param(
    [string]$InputFile = $null,
    [string]$OutputFile = "mobile_logs.txt"
)

if ($null -eq $InputFile) {
    Write-Host "Usage: .\extract_mobile_logs.ps1 -InputFile <fichier_log> [-OutputFile <output_file>]"
    Write-Host "Ou pipe: Get-Content log.txt | .\extract_mobile_logs.ps1"
    exit 1
}

# Extraire les logs mobiles (préfixe 📱[MOBILE] ou MobileLog)
$pattern = "📱\[MOBILE|MobileLog|MobileLogs"
$lines = Get-Content $InputFile | Select-String -Pattern $pattern

if ($lines) {
    $lines | Out-File -FilePath $OutputFile -Encoding UTF8
    Write-Host "✅ Logs mobiles extraits dans: $OutputFile"
    Write-Host "📊 Nombre de lignes: $($lines.Count)"
}
else {
    Write-Host "⚠️  Aucun log mobile trouvé"
}

