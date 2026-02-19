# Script pour ouvrir la présentation dans le navigateur par défaut

$htmlFile = Join-Path $PSScriptRoot "presentation_actionnaires_microfinance.html"

if (Test-Path $htmlFile) {
    Write-Host "Ouverture de la présentation dans le navigateur..." -ForegroundColor Green
    Start-Process $htmlFile
    Write-Host "Document ouvert !" -ForegroundColor Green
    Write-Host ""
    Write-Host "Pour convertir en PDF :" -ForegroundColor Yellow
    Write-Host "  1. Dans le navigateur, appuyez sur Ctrl+P" -ForegroundColor Cyan
    Write-Host "  2. Choisissez 'Enregistrer au format PDF'" -ForegroundColor Cyan
    Write-Host "  3. Enregistrez le fichier" -ForegroundColor Cyan
} else {
    Write-Host "Erreur : Fichier non trouvé : $htmlFile" -ForegroundColor Red
    exit 1
}


