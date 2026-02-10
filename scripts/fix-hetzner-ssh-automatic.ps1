# Script pour corriger automatiquement SSH sur Hetzner
# Utilise WSL si disponible, sinon génère les commandes à exécuter manuellement

$ErrorActionPreference = "Continue"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Correction SSH Hetzner Automatique" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Récupérer la clé publique
$publicKeyPath = "$env:USERPROFILE\.ssh\hetzner_deploy.pub"
if (-not (Test-Path $publicKeyPath)) {
    Write-Host "❌ Clé publique non trouvée: $publicKeyPath" -ForegroundColor Red
    exit 1
}

$publicKey = Get-Content $publicKeyPath
Write-Host "✅ Clé publique trouvée" -ForegroundColor Green
Write-Host ""

# 2. Vérifier si WSL est disponible
$wslAvailable = $false
try {
    $wslCheck = wsl --list --quiet 2>&1
    if ($LASTEXITCODE -eq 0) {
        $wslAvailable = $true
        Write-Host "✅ WSL disponible" -ForegroundColor Green
    }
} catch {
    Write-Host "⚠️ WSL non disponible" -ForegroundColor Yellow
}

# 3. Créer le script bash à exécuter sur Hetzner
$bashScript = @"
#!/bin/bash
set -e

echo "🔧 Configuration SSH Hetzner pour GitHub Actions"
echo ""

# Clé publique à ajouter
PUBLIC_KEY="$publicKey"

# Vérifier si .ssh existe
if [ ! -d ~/.ssh ]; then
    echo "📁 Création du répertoire .ssh..."
    mkdir -p ~/.ssh
    chmod 700 ~/.ssh
fi

# Vérifier si authorized_keys existe
if [ ! -f ~/.ssh/authorized_keys ]; then
    echo "📝 Création du fichier authorized_keys..."
    touch ~/.ssh/authorized_keys
    chmod 600 ~/.ssh/authorized_keys
fi

# Vérifier si la clé existe déjà
if grep -q "github-actions-hetzner" ~/.ssh/authorized_keys 2>/dev/null; then
    echo "⚠️ Clé 'github-actions-hetzner' existe déjà"
    echo "🔄 Suppression de l'ancienne clé..."
    grep -v "github-actions-hetzner" ~/.ssh/authorized_keys > ~/.ssh/authorized_keys.tmp
    mv ~/.ssh/authorized_keys.tmp ~/.ssh/authorized_keys
fi

# Ajouter la nouvelle clé
echo "➕ Ajout de la clé publique..."
echo "$PUBLIC_KEY" >> ~/.ssh/authorized_keys

# Vérifier les permissions
echo "🔒 Vérification des permissions..."
chmod 600 ~/.ssh/authorized_keys
chmod 700 ~/.ssh

# Vérifier que la clé est bien ajoutée
if grep -q "github-actions-hetzner" ~/.ssh/authorized_keys; then
    echo "✅ Clé ajoutée avec succès!"
    echo ""
    echo "📋 Clé trouvée dans authorized_keys:"
    grep "github-actions-hetzner" ~/.ssh/authorized_keys
    echo ""
    echo "📊 Permissions:"
    ls -la ~/.ssh/authorized_keys
    ls -ld ~/.ssh
else
    echo "❌ Erreur: La clé n'a pas été ajoutée"
    exit 1
fi

echo ""
echo "✅ Configuration SSH terminée!"
"@

# Sauvegarder le script bash
$bashScriptPath = "fix-hetzner-ssh.sh"
$bashScript | Out-File -FilePath $bashScriptPath -Encoding UTF8 -NoNewline
Write-Host "✅ Script bash créé: $bashScriptPath" -ForegroundColor Green
Write-Host ""

# 4. Essayer d'exécuter via WSL
if ($wslAvailable) {
    Write-Host "🚀 Tentative d'exécution via WSL..." -ForegroundColor Yellow
    Write-Host ""
    
    # Copier le script dans WSL
    $wslScriptPath = "/tmp/fix-hetzner-ssh.sh"
    wsl bash -c "cat > $wslScriptPath" < $bashScriptPath
    
    # Essayer de se connecter et exécuter
    $privateKeyPath = "$env:USERPROFILE\.ssh\hetzner_deploy"
    if (Test-Path $privateKeyPath) {
        Write-Host "📤 Envoi du script sur Hetzner..." -ForegroundColor Cyan
        
        # Copier via WSL scp
        $wslKeyPath = wsl wslpath -a $privateKeyPath
        $wslScriptWslPath = wsl wslpath -a (Resolve-Path $bashScriptPath).Path
        
        $scpCommand = "scp -i $wslKeyPath -o StrictHostKeyChecking=no $wslScriptWslPath root@46.224.14.85:/tmp/fix-hetzner-ssh.sh"
        $sshCommand = "ssh -i $wslKeyPath -o StrictHostKeyChecking=no root@46.224.14.85 'bash /tmp/fix-hetzner-ssh.sh'"
        
        Write-Host "Exécution via WSL..." -ForegroundColor Gray
        try {
            wsl bash -c $scpCommand
            if ($LASTEXITCODE -eq 0) {
                Write-Host "✅ Script copié sur Hetzner" -ForegroundColor Green
                wsl bash -c $sshCommand
                if ($LASTEXITCODE -eq 0) {
                    Write-Host ""
                    Write-Host "✅ Configuration SSH terminée avec succès!" -ForegroundColor Green
                    exit 0
                }
            }
        } catch {
            Write-Host "⚠️ Échec de l'exécution automatique via WSL" -ForegroundColor Yellow
        }
    }
}

# 5. Si l'automatisation échoue, afficher les instructions manuelles
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Instructions Manuelles" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Le script automatique n'a pas pu se connecter." -ForegroundColor Yellow
Write-Host "Exécutez manuellement les commandes suivantes:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Copiez le script sur Hetzner:" -ForegroundColor Cyan
Write-Host "   scp fix-hetzner-ssh.sh root@46.224.14.85:/tmp/" -ForegroundColor White
Write-Host ""
Write-Host "2. Connectez-vous à Hetzner:" -ForegroundColor Cyan
Write-Host "   ssh root@46.224.14.85" -ForegroundColor White
Write-Host ""
Write-Host "3. Exécutez le script:" -ForegroundColor Cyan
Write-Host "   bash /tmp/fix-hetzner-ssh.sh" -ForegroundColor White
Write-Host ""
Write-Host "OU copiez-collez directement cette commande sur Hetzner:" -ForegroundColor Yellow
Write-Host ""
Write-Host "echo `"$publicKey`" >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys && chmod 700 ~/.ssh && grep 'github-actions-hetzner' ~/.ssh/authorized_keys" -ForegroundColor White
Write-Host ""

