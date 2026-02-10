# Ouvrir directement la page GitHub Actions pour declencher le workflow

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Ouverture GitHub Actions" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$workflowUrl = "https://github.com/Her50/yukpo4/actions/workflows/deploy-env-hetzner.yml"

Write-Host "Ouverture de la page GitHub Actions..." -ForegroundColor Yellow
Write-Host "  URL: $workflowUrl" -ForegroundColor Gray
Write-Host ""
Write-Host "Instructions:" -ForegroundColor Cyan
Write-Host "  1. Cliquez sur 'Run workflow' (bouton en haut a droite)" -ForegroundColor White
Write-Host "  2. Cliquez sur 'Run workflow' (bouton vert)" -ForegroundColor White
Write-Host "  3. Attendez 2-3 minutes" -ForegroundColor White
Write-Host ""

# Ouvrir dans le navigateur
Start-Process $workflowUrl

Write-Host "Page ouverte dans votre navigateur!" -ForegroundColor Green
Write-Host ""
Write-Host "Le workflow va automatiquement:" -ForegroundColor Cyan
Write-Host "  - Se connecter a AWS" -ForegroundColor Gray
Write-Host "  - Recuperer toutes les variables" -ForegroundColor Gray
Write-Host "  - Les adapter pour Hetzner" -ForegroundColor Gray
Write-Host "  - Deployer le fichier .env sur Hetzner" -ForegroundColor Gray
Write-Host "  - Verifier que tout est OK" -ForegroundColor Gray

