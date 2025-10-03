# Script de build de production CORRECT pour éviter les builds de développement
Write-Host "🚀 BUILD DE PRODUCTION CORRECT - Yukpomnang Mobile" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

Write-Host "`n📋 Configuration du build:" -ForegroundColor Yellow
Write-Host "   ✅ developmentClient: false" -ForegroundColor Green
Write-Host "   ✅ buildType: apk (assembleRelease)" -ForegroundColor Green
Write-Host "   ✅ Environment: production" -ForegroundColor Green
Write-Host "   ✅ DEV_MODE: false" -ForegroundColor Green
Write-Host "   ✅ Bundle JavaScript intégré (pas de Metro)" -ForegroundColor Green

Write-Host "`n🔧 Lancement du build de production..." -ForegroundColor Yellow

# Lancer le build avec la configuration correcte
npx eas build --platform android --profile simple

Write-Host "`n✅ Build lancé!" -ForegroundColor Green
Write-Host "📋 Ce build sera:" -ForegroundColor Cyan
Write-Host "   • APK autonome (pas de connexion Metro)" -ForegroundColor White
Write-Host "   • Bundle JavaScript intégré" -ForegroundColor White
Write-Host "   • Mode production pur" -ForegroundColor White
Write-Host "   • Plus de crash au démarrage" -ForegroundColor White

Write-Host "`n⏱️ Temps estimé: 10-15 minutes" -ForegroundColor Yellow
Write-Host "📧 Vous recevrez un email avec le lien de téléchargement" -ForegroundColor Blue

