# Script pour déclencher automatiquement le workflow Docker Build

$ErrorActionPreference = "Continue"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Déclenchement Docker Build Workflow" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Vérifier que le token GitHub est disponible
$githubToken = $env:GITHUB_TOKEN
if (-not $githubToken) {
    Write-Host "Token GitHub non trouvé dans GITHUB_TOKEN" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Option 1: Utiliser GitHub CLI (gh):" -ForegroundColor Cyan
    Write-Host "  gh auth login" -ForegroundColor Gray
    Write-Host "  gh workflow run docker-build-optimized.yml --ref master -f push_to_registry=true -f push_to_aws=true -f push_to_hetzner=true" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Option 2: Déclencher manuellement:" -ForegroundColor Cyan
    Write-Host "  https://github.com/Her50/yukpo4/actions/workflows/docker-build-optimized.yml" -ForegroundColor Gray
    Write-Host "  Cliquez sur 'Run workflow' -> Sélectionnez 'master' -> Cochez les options -> 'Run workflow'" -ForegroundColor Gray
    exit 1
}

$repo = "Her50/yukpo4"
$workflow = "docker-build-optimized.yml"

Write-Host "Déclenchement du workflow GitHub Actions..." -ForegroundColor Yellow
Write-Host "  Repository: $repo" -ForegroundColor Gray
Write-Host "  Workflow: $workflow" -ForegroundColor Gray
Write-Host "  Branch: master" -ForegroundColor Gray
Write-Host "  Options: push_to_registry=true, push_to_aws=true, push_to_hetzner=true" -ForegroundColor Gray
Write-Host ""

$headers = @{
    "Accept" = "application/vnd.github.v3+json"
    "Authorization" = "token $githubToken"
}

$body = @{
    ref = "master"
    inputs = @{
        push_to_registry = "true"
        push_to_aws = "true"
        push_to_hetzner = "true"
    }
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "https://api.github.com/repos/$repo/actions/workflows/$workflow/dispatches" `
        -Method Post `
        -Headers $headers `
        -Body $body `
        -ContentType "application/json"
    
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  Workflow déclenché avec succès!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Suivez le build:" -ForegroundColor Cyan
    Write-Host "  https://github.com/$repo/actions" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Le build prendra 10-20 minutes..." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Le workflow va:" -ForegroundColor Cyan
    Write-Host "  1. Exécuter les migrations de base de données" -ForegroundColor Gray
    Write-Host "  2. Builder l'image Docker optimisée" -ForegroundColor Gray
    Write-Host "  3. Pousser vers GitHub Container Registry (GHCR)" -ForegroundColor Gray
    Write-Host "  4. Pousser vers AWS ECR" -ForegroundColor Gray
    Write-Host "  5. Déployer sur AWS ECS" -ForegroundColor Gray
    Write-Host "  6. Déployer sur Hetzner" -ForegroundColor Gray
    
} catch {
    Write-Host "========================================" -ForegroundColor Red
    Write-Host "  Erreur lors du déclenchement" -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Red
    Write-Host ""
    Write-Host "Erreur: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "Solution alternative:" -ForegroundColor Yellow
    Write-Host "  1. Allez sur: https://github.com/$repo/actions/workflows/$workflow" -ForegroundColor Cyan
    Write-Host "  2. Cliquez sur 'Run workflow'" -ForegroundColor Cyan
    Write-Host "  3. Sélectionnez 'master' comme branche" -ForegroundColor Cyan
    Write-Host "  4. Cochez: push_to_registry, push_to_aws, push_to_hetzner" -ForegroundColor Cyan
    Write-Host "  5. Cliquez sur 'Run workflow' (bouton vert)" -ForegroundColor Cyan
}

