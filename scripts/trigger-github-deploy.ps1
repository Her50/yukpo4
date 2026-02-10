# Script pour declencher automatiquement le workflow GitHub Actions

$ErrorActionPreference = "Continue"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Deploiement .env via GitHub Actions" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Verifier que le token GitHub est disponible
$githubToken = $env:GITHUB_TOKEN
if (-not $githubToken) {
    Write-Host "Token GitHub non trouve dans GITHUB_TOKEN" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Option 1: Definir la variable d'environnement:" -ForegroundColor Cyan
    Write-Host "  `$env:GITHUB_TOKEN = 'votre_token'" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Option 2: Utiliser GitHub CLI (gh):" -ForegroundColor Cyan
    Write-Host "  gh auth login" -ForegroundColor Gray
    Write-Host "  gh workflow run deploy-env-hetzner.yml" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Option 3: Declencher manuellement:" -ForegroundColor Cyan
    Write-Host "  https://github.com/Her50/yukpo4/actions/workflows/deploy-env-hetzner.yml" -ForegroundColor Gray
    Write-Host "  Cliquez sur 'Run workflow' -> 'Run workflow'" -ForegroundColor Gray
    exit 1
}

$repo = "Her50/yukpo4"
$workflow = "deploy-env-hetzner.yml"

Write-Host "Declenchement du workflow GitHub Actions..." -ForegroundColor Yellow
Write-Host "  Repository: $repo" -ForegroundColor Gray
Write-Host "  Workflow: $workflow" -ForegroundColor Gray
Write-Host ""

$headers = @{
    "Accept" = "application/vnd.github.v3+json"
    "Authorization" = "token $githubToken"
}

$body = @{
    ref = "main"
    inputs = @{
        force = "false"
    }
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "https://api.github.com/repos/$repo/actions/workflows/$workflow/dispatches" `
        -Method Post `
        -Headers $headers `
        -Body $body `
        -ContentType "application/json"
    
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  Workflow declenche avec succes!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Suivez le deploiement:" -ForegroundColor Cyan
    Write-Host "  https://github.com/$repo/actions" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Le deploiement prendra 2-3 minutes..." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Le workflow va:" -ForegroundColor Cyan
    Write-Host "  1. Se connecter a AWS pour recuperer les variables" -ForegroundColor Gray
    Write-Host "  2. Les adapter pour Hetzner (PostgreSQL, Redis, Wasabi)" -ForegroundColor Gray
    Write-Host "  3. Copier le fichier .env sur Hetzner via SSH (Ubuntu)" -ForegroundColor Gray
    Write-Host "  4. Verifier que le fichier est bien cree" -ForegroundColor Gray
    
} catch {
    Write-Host "========================================" -ForegroundColor Red
    Write-Host "  Erreur lors du declenchement" -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Red
    Write-Host ""
    Write-Host "Erreur: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "Solution alternative:" -ForegroundColor Yellow
    Write-Host "  1. Allez sur: https://github.com/$repo/actions/workflows/$workflow" -ForegroundColor Cyan
    Write-Host "  2. Cliquez sur 'Run workflow'" -ForegroundColor Cyan
    Write-Host "  3. Cliquez sur 'Run workflow' (bouton vert)" -ForegroundColor Cyan
}

