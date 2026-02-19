# Script pour mettre a jour le secret GitHub avec GitHub CLI (methode la plus simple)
# Usage: .\scripts\update_github_secret_gh.ps1

param(
    [string]$Repository = "Her50/yukpo4",
    [string]$SecretName = "GCP_DATABASE_URL",
    [string]$DatabaseUrl = "postgresql://yukpo_user:MTeInD(Vw)b`$C3Np479P@/yukpo_db?host=/cloudsql/yukpo-project:europe-west1:yukpo-postgres"
)

Write-Host "Mise a jour du secret GitHub $SecretName" -ForegroundColor Yellow
Write-Host "Repository: $Repository" -ForegroundColor Cyan
Write-Host ""

# Verifier que GitHub CLI est installe
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    Write-Host "ERREUR: GitHub CLI (gh) n'est pas installe" -ForegroundColor Red
    Write-Host ""
    Write-Host "Installez-le depuis: https://cli.github.com/" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "OU utilisez le script alternatif:" -ForegroundColor Cyan
    Write-Host "  .\scripts\update_github_secret_simple.ps1 -GitHubToken 'VOTRE_TOKEN'" -ForegroundColor White
    Write-Host ""
    Write-Host "Pour creer un token: https://github.com/settings/tokens/new" -ForegroundColor Cyan
    exit 1
}

Write-Host "OK GitHub CLI trouve" -ForegroundColor Green
Write-Host ""

# Verifier l'authentification
Write-Host "Verification de l'authentification GitHub..." -ForegroundColor Cyan
$authStatus = gh auth status 2>&1

if ($LASTEXITCODE -ne 0) {
    Write-Host "Vous n'etes pas authentifie avec GitHub CLI" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Authentification..." -ForegroundColor Cyan
    gh auth login
} else {
    Write-Host "OK Authentifie avec GitHub CLI" -ForegroundColor Green
}

Write-Host ""
Write-Host "Mise a jour du secret $SecretName..." -ForegroundColor Yellow

# Mettre a jour le secret
$result = gh secret set $SecretName --repo $Repository --body $DatabaseUrl 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "OK Secret mis a jour avec succes!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Le secret $SecretName a ete mis a jour dans $Repository" -ForegroundColor Cyan
    Write-Host "Les prochains deploiements utiliseront automatiquement la nouvelle valeur." -ForegroundColor Cyan
} else {
    Write-Host ""
    Write-Host "ERREUR lors de la mise a jour: $result" -ForegroundColor Red
    Write-Host ""
    Write-Host "SOLUTION MANUELLE:" -ForegroundColor Yellow
    Write-Host "1. Allez sur: https://github.com/$Repository/settings/secrets/actions" -ForegroundColor White
    Write-Host "2. Cliquez sur '$SecretName' ou 'New repository secret'" -ForegroundColor White
    Write-Host "3. Collez la valeur suivante:" -ForegroundColor White
    Write-Host "   $DatabaseUrl" -ForegroundColor Cyan
    Write-Host ""
    exit 1
}

Write-Host ""
Write-Host "OK Mise a jour terminee!" -ForegroundColor Green


