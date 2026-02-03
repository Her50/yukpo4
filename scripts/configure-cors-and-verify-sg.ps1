# Script combiné pour configurer CORS et vérifier Security Groups
# Usage: .\scripts\configure-cors-and-verify-sg.ps1

Write-Host "🚀 Configuration complète: CORS + Security Groups" -ForegroundColor Cyan
Write-Host "=" * 60 -ForegroundColor Cyan
Write-Host ""

# Étape 1: Configurer CORS
Write-Host "📋 ÉTAPE 1: Configuration CORS dans ECS" -ForegroundColor Yellow
Write-Host "-" * 60 -ForegroundColor Gray
& "$PSScriptRoot\configure-cors-ecs.ps1"

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "❌ Échec de la configuration CORS. Arrêt du script." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "=" * 60 -ForegroundColor Cyan
Write-Host ""

# Étape 2: Vérifier Security Groups
Write-Host "📋 ÉTAPE 2: Vérification Security Groups" -ForegroundColor Yellow
Write-Host "-" * 60 -ForegroundColor Gray
& "$PSScriptRoot\verify-security-groups.ps1"

Write-Host ""
Write-Host "=" * 60 -ForegroundColor Cyan
Write-Host ""

# Résumé final
Write-Host "✅ Configuration terminée!" -ForegroundColor Green
Write-Host ""
Write-Host "📝 Prochaines étapes:" -ForegroundColor Cyan
Write-Host "  1. Attendre que le service ECS se déploie (quelques minutes)"
Write-Host "  2. Tester la connectivité:"
Write-Host "     curl -v https://yukpomnang-backend-alb-2043939972.us-east-1.elb.amazonaws.com/api/health"
Write-Host "  3. Tester depuis le mobile avec les nouvelles configurations"
Write-Host ""

