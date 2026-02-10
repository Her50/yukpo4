# Script pour guider l'obtention du mot de passe Hetzner

$ErrorActionPreference = "Continue"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Obtention Mot de Passe Hetzner" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "📋 Méthodes pour obtenir le mot de passe root:" -ForegroundColor Yellow
Write-Host ""

Write-Host "1. Panel Hetzner Cloud (Recommandé)" -ForegroundColor Cyan
Write-Host "   - Ouvrez: https://console.hetzner.cloud/" -ForegroundColor Gray
Write-Host "   - Connectez-vous avec vos identifiants" -ForegroundColor Gray
Write-Host "   - Allez dans 'Servers' → Trouvez votre serveur (46.224.14.85)" -ForegroundColor Gray
Write-Host "   - Cliquez sur le serveur → Onglet 'Reset' ou 'Rescue'" -ForegroundColor Gray
Write-Host "   - Cliquez sur 'Reset root password'" -ForegroundColor Gray
Write-Host "   - Le nouveau mot de passe sera affiché (copiez-le !)" -ForegroundColor Gray
Write-Host ""

Write-Host "2. Email de Création" -ForegroundColor Cyan
Write-Host "   - Vérifiez votre email (celui utilisé pour Hetzner)" -ForegroundColor Gray
Write-Host "   - Cherchez l'email Hetzner avec 'Server credentials' ou 'Your server is ready'" -ForegroundColor Gray
Write-Host "   - Le mot de passe root est dans cet email" -ForegroundColor Gray
Write-Host ""

Write-Host "3. Si vous avez déjà accès SSH" -ForegroundColor Cyan
Write-Host "   - Connectez-vous: ssh root@46.224.14.85" -ForegroundColor Gray
Write-Host "   - Exécutez: passwd root" -ForegroundColor Gray
Write-Host "   - Entrez le nouveau mot de passe" -ForegroundColor Gray
Write-Host ""

Write-Host "4. Alternative: Créer un Token API (Recommandé)" -ForegroundColor Cyan
Write-Host "   - Panel Hetzner → Security → API Tokens" -ForegroundColor Gray
Write-Host "   - Générer un nouveau token" -ForegroundColor Gray
Write-Host "   - Ajouter dans GitHub Secrets comme HETZNER_API_TOKEN" -ForegroundColor Gray
Write-Host "   - Pas besoin de mot de passe !" -ForegroundColor Gray
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Actions Immédiates" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "✅ Ouvrir le Panel Hetzner..." -ForegroundColor Green
Start-Process "https://console.hetzner.cloud/"

Write-Host ""
Write-Host "📝 Après avoir obtenu le mot de passe:" -ForegroundColor Yellow
Write-Host "   1. Ajoutez-le dans GitHub Secrets:" -ForegroundColor White
Write-Host "      https://github.com/Her50/yukpo4/settings/secrets/actions" -ForegroundColor Gray
Write-Host "      Nom: HETZNER_ROOT_PASSWORD" -ForegroundColor Gray
Write-Host ""
Write-Host "   2. Déclenchez le workflow:" -ForegroundColor White
Write-Host "      https://github.com/Her50/yukpo4/actions/workflows/setup-hetzner-ssh-auto.yml" -ForegroundColor Gray
Write-Host ""
Write-Host "💡 Voir OBTENIR_MOT_DE_PASSE_HETZNER.md pour plus de détails" -ForegroundColor Cyan
Write-Host ""

