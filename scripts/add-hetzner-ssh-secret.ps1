# Script pour ajouter HETZNER_SSH_PRIVATE_KEY dans GitHub Secrets

$ErrorActionPreference = "Continue"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Ajout Secret GitHub HETZNER_SSH" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$sshKeyPath = "$env:USERPROFILE\.ssh\hetzner_deploy"

# Verifier que la cle existe
if (-not (Test-Path $sshKeyPath)) {
    Write-Host "ERREUR: Cle SSH non trouvee: $sshKeyPath" -ForegroundColor Red
    Write-Host ""
    Write-Host "Generez d'abord la cle SSH:" -ForegroundColor Yellow
    Write-Host "  ssh-keygen -t ed25519 -f `"$sshKeyPath`" -N `"`" -C `"hetzner-deploy`"" -ForegroundColor Gray
    exit 1
}

Write-Host "Cle SSH trouvee: $sshKeyPath" -ForegroundColor Green
Write-Host ""

# Lire la cle privee
$privateKey = Get-Content $sshKeyPath -Raw

Write-Host "Instructions pour ajouter le secret GitHub:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Allez sur: https://github.com/Her50/yukpo4/settings/secrets/actions" -ForegroundColor Cyan
Write-Host ""
Write-Host "2. Cliquez sur 'New repository secret'" -ForegroundColor Cyan
Write-Host ""
Write-Host "3. Nom du secret: HETZNER_SSH_PRIVATE_KEY" -ForegroundColor Cyan
Write-Host ""
Write-Host "4. Valeur (copiez tout le contenu ci-dessous):" -ForegroundColor Cyan
Write-Host ""
Write-Host "========================================" -ForegroundColor Gray
Write-Host $privateKey -ForegroundColor White
Write-Host "========================================" -ForegroundColor Gray
Write-Host ""

# Essayer avec GitHub CLI si disponible
if (Get-Command gh -ErrorAction SilentlyContinue) {
    Write-Host "GitHub CLI detecte - Ajout automatique..." -ForegroundColor Yellow
    
    # Verifier si on est connecte
    $ghAuth = gh auth status 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "GitHub CLI connecte" -ForegroundColor Green
        
        # Ajouter le secret
        $privateKey | gh secret set HETZNER_SSH_PRIVATE_KEY --repo Her50/yukpo4 2>&1 | Out-Host
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host ""
            Write-Host "========================================" -ForegroundColor Green
            Write-Host "  Secret ajoute avec succes!" -ForegroundColor Green
            Write-Host "========================================" -ForegroundColor Green
            Write-Host ""
            Write-Host "Vous pouvez maintenant lancer le workflow!" -ForegroundColor Cyan
        } else {
            Write-Host ""
            Write-Host "ERREUR lors de l'ajout automatique" -ForegroundColor Red
            Write-Host "Utilisez les instructions manuelles ci-dessus" -ForegroundColor Yellow
        }
    } else {
        Write-Host "GitHub CLI non connecte" -ForegroundColor Yellow
        Write-Host "Connectez-vous avec: gh auth login" -ForegroundColor Gray
        Write-Host ""
        Write-Host "Ou utilisez les instructions manuelles ci-dessus" -ForegroundColor Yellow
    }
} else {
    Write-Host "GitHub CLI non installe" -ForegroundColor Yellow
    Write-Host "Installez-le avec: winget install GitHub.cli" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Ou utilisez les instructions manuelles ci-dessus" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  TERMINE" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

