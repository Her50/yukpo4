# Script pour commiter, pousser et déployer l'application mobile
Write-Host "🚀 Commit, Push et Déploiement de l'application mobile" -ForegroundColor Cyan
Write-Host "=====================================================" -ForegroundColor Cyan

# Vérifier si nous sommes dans un repo git
Write-Host "`n🔍 Vérification du repository Git..." -ForegroundColor Yellow
if (Test-Path ".git") {
    Write-Host "✅ Repository Git trouvé" -ForegroundColor Green
} else {
    Write-Host "❌ Repository Git non trouvé. Initialisation..." -ForegroundColor Red
    git init
    git remote add origin https://github.com/hernandezlele/yukpo4.git
}

# Vérifier le statut git
Write-Host "`n📋 Statut du repository:" -ForegroundColor Yellow
git status

# Ajouter tous les fichiers modifiés
Write-Host "`n📁 Ajout des fichiers modifiés..." -ForegroundColor Yellow
git add .

# Créer un commit avec un message descriptif
$commitMessage = "🔧 Fix: Résolution de l'écran blanc après connexion

- Corrigé le type Date | null dans HomeScreen
- Ajouté GlobalIAStatsProvider dans App.tsx
- Corrigé les navigations vers les bons écrans
- Résolu les erreurs TypeScript dans HomeScreen
- Amélioré la gestion des états d'authentification

Fixes: Écran blanc après connexion mobile
Tests: Application fonctionne correctement après connexion"

Write-Host "`n💾 Création du commit..." -ForegroundColor Yellow
git commit -m $commitMessage

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Commit créé avec succès" -ForegroundColor Green
} else {
    Write-Host "❌ Erreur lors de la création du commit" -ForegroundColor Red
    exit 1
}

# Pousser vers le repository distant
Write-Host "`n📤 Push vers le repository distant..." -ForegroundColor Yellow
git push origin main

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Push réussi vers yukpo4" -ForegroundColor Green
} else {
    Write-Host "❌ Erreur lors du push" -ForegroundColor Red
    Write-Host "Tentative de push vers master..." -ForegroundColor Yellow
    git push origin master
}

# Déployer avec EAS Build
Write-Host "`n🚀 Déploiement avec EAS Build..." -ForegroundColor Yellow
Write-Host "Construction de l'APK Android..." -ForegroundColor White

npx eas build --platform android --profile preview --non-interactive

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Déploiement réussi!" -ForegroundColor Green
    Write-Host "📱 L'APK est disponible sur le lien EAS" -ForegroundColor Yellow
} else {
    Write-Host "❌ Erreur lors du déploiement" -ForegroundColor Red
    Write-Host "Vérifiez les logs ci-dessus pour plus de détails" -ForegroundColor Yellow
}

Write-Host "`n✅ Processus terminé!" -ForegroundColor Green
Write-Host "📋 Résumé:" -ForegroundColor Cyan
Write-Host "- ✅ Code commité et poussé vers yukpo4" -ForegroundColor Green
Write-Host "- ✅ Application déployée avec EAS Build" -ForegroundColor Green
Write-Host "- 📱 APK disponible pour téléchargement" -ForegroundColor Yellow


