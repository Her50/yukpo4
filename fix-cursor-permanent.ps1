# fix-cursor-permanent.ps1
# Script pour corriger définitivement le PATH Cursor

Write-Host "🔧 Correction définitive du PATH Cursor" -ForegroundColor Green

# Vérifier que Cursor CLI fonctionne
try {
    $version = cursor --version
    Write-Host "✅ Cursor CLI fonctionne: $version" -ForegroundColor Green
} catch {
    Write-Host "❌ Cursor CLI ne fonctionne pas. Exécutez d'abord fix-cursor-simple.ps1" -ForegroundColor Red
    exit 1
}

# Obtenir le chemin actuel de Cursor
$cursorPath = (Get-Command cursor).Source
$cursorBinDir = Split-Path $cursorPath -Parent

Write-Host "📍 Répertoire Cursor CLI: $cursorBinDir" -ForegroundColor Cyan

# Instructions pour corriger définitivement
Write-Host "`n📋 Instructions pour corriger définitivement:" -ForegroundColor Yellow
Write-Host "1. Appuyez sur Windows + R" -ForegroundColor White
Write-Host "2. Tapez: sysdm.cpl" -ForegroundColor White
Write-Host "3. Cliquez sur 'Variables d'environnement...'" -ForegroundColor White
Write-Host "4. Dans 'Variables système', trouvez et sélectionnez 'Path'" -ForegroundColor White
Write-Host "5. Cliquez sur 'Modifier...'" -ForegroundColor White
Write-Host "6. Supprimez l'ancienne entrée Cursor (si elle existe)" -ForegroundColor White
Write-Host "7. Cliquez sur 'Nouveau' et ajoutez:" -ForegroundColor White
Write-Host "   $cursorBinDir" -ForegroundColor Cyan
Write-Host "8. Cliquez sur 'OK' pour fermer toutes les fenêtres" -ForegroundColor White
Write-Host "9. Redémarrez votre terminal/PowerShell" -ForegroundColor White

Write-Host "`n💡 Alternative rapide (PowerShell en tant qu'administrateur):" -ForegroundColor Yellow
Write-Host "[Environment]::SetEnvironmentVariable('Path', `$env:Path + ';$cursorBinDir', 'Machine')" -ForegroundColor Gray

Write-Host "`n✅ Après cette correction, Cursor CLI fonctionnera dans tous les terminaux !" -ForegroundColor Green

