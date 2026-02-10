# Script pour vérifier la clé SSH et générer les commandes pour Hetzner

$ErrorActionPreference = "Continue"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Vérification Clé SSH Hetzner" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Afficher la clé publique
$publicKeyPath = "$env:USERPROFILE\.ssh\hetzner_deploy.pub"
if (Test-Path $publicKeyPath) {
    $publicKey = Get-Content $publicKeyPath
    Write-Host "✅ Clé publique trouvée:" -ForegroundColor Green
    Write-Host ""
    Write-Host "📋 Clé publique à ajouter sur Hetzner:" -ForegroundColor Cyan
    Write-Host ("=" * 70) -ForegroundColor Gray
    Write-Host $publicKey -ForegroundColor Yellow
    Write-Host ("=" * 70) -ForegroundColor Gray
    Write-Host ""
    
    Write-Host "🔧 Commandes à exécuter sur Hetzner:" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "# 1. Se connecter à Hetzner" -ForegroundColor Gray
    Write-Host "ssh root@46.224.14.85" -ForegroundColor White
    Write-Host ""
    Write-Host "# 2. Vérifier si la clé existe déjà" -ForegroundColor Gray
    Write-Host "grep 'github-actions-hetzner' ~/.ssh/authorized_keys" -ForegroundColor White
    Write-Host ""
    Write-Host "# 3. Si la clé n'existe pas, l'ajouter:" -ForegroundColor Gray
    Write-Host "echo '$publicKey' >> ~/.ssh/authorized_keys" -ForegroundColor White
    Write-Host ""
    Write-Host "# 4. Vérifier les permissions" -ForegroundColor Gray
    Write-Host "chmod 600 ~/.ssh/authorized_keys" -ForegroundColor White
    Write-Host "chmod 700 ~/.ssh" -ForegroundColor White
    Write-Host ""
    Write-Host "# 5. Vérifier que la clé est bien ajoutée" -ForegroundColor Gray
    Write-Host "cat ~/.ssh/authorized_keys | grep 'github-actions-hetzner'" -ForegroundColor White
    Write-Host ""
} else {
    Write-Host "❌ Clé publique non trouvée!" -ForegroundColor Red
}

# 2. Vérifier le format de la clé privée
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Vérification Format Clé Privée" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$privateKeyPath = "$env:USERPROFILE\.ssh\hetzner_deploy"
if (Test-Path $privateKeyPath) {
    $privateKey = Get-Content $privateKeyPath -Raw
    Write-Host "✅ Clé privée trouvée" -ForegroundColor Green
    Write-Host ""
    
    # Vérifier le format
    if ($privateKey -match "BEGIN OPENSSH PRIVATE KEY" -and $privateKey -match "END OPENSSH PRIVATE KEY") {
        Write-Host "✅ Format correct (OPENSSH)" -ForegroundColor Green
    } else {
        Write-Host "⚠️ Format suspect" -ForegroundColor Yellow
    }
    
    # Compter les lignes
    $lines = ($privateKey -split "`n").Count
    Write-Host "📊 Nombre de lignes: $lines" -ForegroundColor Cyan
    
    # Vérifier la longueur
    $length = $privateKey.Length
    Write-Host "📊 Longueur totale: $length caractères" -ForegroundColor Cyan
    Write-Host ""
    
    Write-Host "⚠️ IMPORTANT: Dans GitHub Secrets, la clé doit être:" -ForegroundColor Yellow
    Write-Host "   - Le contenu COMPLET (avec BEGIN et END)" -ForegroundColor White
    Write-Host "   - Sans espaces supplémentaires au début/fin" -ForegroundColor White
    Write-Host "   - Exactement comme dans le fichier local" -ForegroundColor White
    Write-Host ""
    
    Write-Host "📋 Première ligne de la clé privée:" -ForegroundColor Cyan
    $firstLine = ($privateKey -split "`n")[0]
    Write-Host "   $firstLine" -ForegroundColor Gray
    Write-Host ""
    Write-Host "📋 Dernière ligne de la clé privée:" -ForegroundColor Cyan
    $lastLine = ($privateKey -split "`n")[-1]
    Write-Host "   $lastLine" -ForegroundColor Gray
} else {
    Write-Host "❌ Clé privée non trouvée!" -ForegroundColor Red
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Diagnostic" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Si le workflow échoue toujours avec 'Permission denied':" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. ✅ Vérifiez que la clé publique est sur Hetzner" -ForegroundColor White
Write-Host "   (utilisez les commandes ci-dessus)" -ForegroundColor Gray
Write-Host ""
Write-Host "2. ✅ Vérifiez le format de la clé dans GitHub Secrets" -ForegroundColor White
Write-Host "   - Ouvrez: https://github.com/Her50/yukpo4/settings/secrets/actions" -ForegroundColor Gray
Write-Host "   - Cliquez sur 'edit' à côté de HETZNER_SSH_PRIVATE_KEY" -ForegroundColor Gray
Write-Host "   - Vérifiez que la clé commence par '-----BEGIN' et finit par '-----END'" -ForegroundColor Gray
Write-Host ""
Write-Host "3. ✅ Testez la connexion manuellement" -ForegroundColor White
Write-Host "   ssh -i $privateKeyPath root@46.224.14.85 'echo OK'" -ForegroundColor Gray
Write-Host ""

