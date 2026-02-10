# Configuration WSL pour SSH vers Hetzner

Write-Host "Configuration WSL pour SSH Hetzner" -ForegroundColor Cyan
Write-Host "===================================" -ForegroundColor Gray
Write-Host ""

# Vérifier WSL
try {
    $wslCheck = wsl --list --quiet 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ WSL non installé" -ForegroundColor Red
        Write-Host "   Installez WSL: wsl --install" -ForegroundColor Yellow
        exit 1
    }
} catch {
    Write-Host "❌ WSL non disponible" -ForegroundColor Red
    exit 1
}

Write-Host "✅ WSL détecté" -ForegroundColor Green
Write-Host ""

# Vérifier la clé SSH Windows
$sshKeyPath = "$env:USERPROFILE\.ssh\hetzner_deploy"
if (-not (Test-Path $sshKeyPath)) {
    Write-Host "❌ Clé SSH non trouvée: $sshKeyPath" -ForegroundColor Red
    Write-Host "   Générez d'abord la clé SSH" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Clé SSH Windows trouvée" -ForegroundColor Green
Write-Host ""

# Copier la clé dans WSL
Write-Host "📋 Copie de la clé SSH dans WSL..." -ForegroundColor Cyan

$wslSetup = @'
# Créer le répertoire .ssh
mkdir -p ~/.ssh
chmod 700 ~/.ssh

# Copier la clé depuis Windows
cp /mnt/c/Users/' + $env:USERNAME + '/.ssh/hetzner_deploy ~/.ssh/hetzner_deploy
chmod 600 ~/.ssh/hetzner_deploy

# Ajouter Hetzner au known_hosts
ssh-keyscan -H 46.224.14.85 >> ~/.ssh/known_hosts 2>/dev/null

# Tester la connexion
echo "Test de connexion SSH..."
ssh -i ~/.ssh/hetzner_deploy -o StrictHostKeyChecking=no root@46.224.14.85 "echo 'Connexion SSH réussie!'" 2>&1

if [ $? -eq 0 ]; then
  echo "SETUP_SUCCESS"
else
  echo "SETUP_FAILED"
fi
'@

$result = wsl bash -c $wslSetup 2>&1

if ($result -match "SETUP_SUCCESS" -or $result -match "Connexion SSH réussie") {
    Write-Host "✅ Configuration WSL terminée avec succès!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Vous pouvez maintenant utiliser:" -ForegroundColor Cyan
    Write-Host "  wsl bash -c 'ssh -i ~/.ssh/hetzner_deploy root@46.224.14.85'" -ForegroundColor Gray
} else {
    Write-Host "❌ Erreur lors de la configuration" -ForegroundColor Red
    Write-Host $result
}

