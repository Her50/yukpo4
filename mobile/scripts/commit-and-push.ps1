# Script pour commiter et pousser les changements vers le git yukpo4

Write-Host "📦 Commit et push vers le repository yukpo4" -ForegroundColor Cyan
Write-Host "===========================================" -ForegroundColor Cyan

# Vérifier le statut git
Write-Host "`n🔍 Vérification du statut git..." -ForegroundColor Yellow
git status

# Ajouter tous les fichiers modifiés
Write-Host "`n📝 Ajout des fichiers modifiés..." -ForegroundColor Yellow
git add .

# Créer un commit avec un message descriptif
$commitMessage = "feat: Correction de l'écran blanc après connexion et amélioration de la navigation mobile

- Ajout du GlobalIAStatsProvider dans App.tsx
- Correction des routes de navigation dans HomeScreen
- Amélioration de la gestion des erreurs
- Scripts de débogage pour visualiser les logs
- Build EAS réussi avec APK fonctionnel"

Write-Host "`n💾 Création du commit..." -ForegroundColor Yellow
git commit -m $commitMessage

# Pousser vers le repository distant
Write-Host "`n🚀 Push vers le repository distant..." -ForegroundColor Yellow
git push origin main

Write-Host "`n✅ Commit et push terminés avec succès!" -ForegroundColor Green
Write-Host "Repository: yukpo4" -ForegroundColor Cyan
Write-Host "Branche: main" -ForegroundColor Cyan

