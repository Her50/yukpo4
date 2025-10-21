# Script de déploiement Netlify pour Yukpomnang
# Ce script déploie le frontend sur Netlify avec toutes les optimisations

Write-Host "🚀 DÉPLOIEMENT NETLIFY - Yukpomnang" -ForegroundColor Green
Write-Host "=====================================" -ForegroundColor Green

# Vérifier si Netlify CLI est installé
Write-Host "`n🔍 Vérification de Netlify CLI..." -ForegroundColor Yellow
try {
    $netlifyVersion = netlify --version 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✅ Netlify CLI installé: $netlifyVersion" -ForegroundColor Green
    }
    else {
        throw "Netlify CLI non trouvé"
    }
}
catch {
    Write-Host "  ⚠️  Netlify CLI non installé. Installation en cours..." -ForegroundColor Yellow
    npm install -g netlify-cli
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  ❌ Erreur lors de l'installation de Netlify CLI" -ForegroundColor Red
        exit 1
    }
    Write-Host "  ✅ Netlify CLI installé avec succès" -ForegroundColor Green
}

# Naviguer vers le dossier frontend
Write-Host "`n📁 Navigation vers le dossier frontend..." -ForegroundColor Yellow
Set-Location frontend

# Vérifier si node_modules existe
Write-Host "`n📦 Vérification des dépendances..." -ForegroundColor Yellow
if (!(Test-Path "node_modules")) {
    Write-Host "  📦 Installation des dépendances npm..." -ForegroundColor Cyan
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  ❌ Erreur lors de l'installation des dépendances" -ForegroundColor Red
        Set-Location ..
        exit 1
    }
    Write-Host "  ✅ Dépendances installées" -ForegroundColor Green
}
else {
    Write-Host "  ✅ Dépendances déjà installées" -ForegroundColor Green
}

# Construire le projet
Write-Host "`n🔨 Construction du frontend..." -ForegroundColor Yellow
Write-Host "  🏗️  Exécution de npm run build..." -ForegroundColor Cyan
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host "  ❌ Erreur lors de la construction du frontend" -ForegroundColor Red
    Set-Location ..
    exit 1
}

Write-Host "  ✅ Frontend construit avec succès" -ForegroundColor Green

# Vérifier que le dossier dist existe
if (!(Test-Path "dist")) {
    Write-Host "  ❌ Le dossier dist n'existe pas après la construction" -ForegroundColor Red
    Set-Location ..
    exit 1
}

Write-Host "`n📊 Statistiques du build:" -ForegroundColor Cyan
$distSize = (Get-ChildItem -Path "dist" -Recurse | Measure-Object -Property Length -Sum).Sum / 1MB
Write-Host "  📦 Taille du build: $([math]::Round($distSize, 2)) MB" -ForegroundColor Cyan

# Déploiement sur Netlify
Write-Host "`n🚀 Déploiement sur Netlify..." -ForegroundColor Yellow
Write-Host "  🌐 Déploiement en production..." -ForegroundColor Cyan

# Déployer en production
netlify deploy --prod --dir=dist --message="Déploiement automatique depuis PowerShell"

if ($LASTEXITCODE -ne 0) {
    Write-Host "`n❌ ERREUR DE DÉPLOIEMENT!" -ForegroundColor Red
    Write-Host "=====================================" -ForegroundColor Red
    Write-Host "Consultez les logs ci-dessus pour plus de détails." -ForegroundColor Yellow
    Set-Location ..
    exit 1
}

Write-Host "`n✅ DÉPLOIEMENT RÉUSSI!" -ForegroundColor Green
Write-Host "=====================================" -ForegroundColor Green
Write-Host "`n🌐 Votre application est maintenant en ligne!" -ForegroundColor Green
Write-Host "📊 Consultez le dashboard Netlify pour voir les détails du déploiement" -ForegroundColor Cyan

Write-Host "`n📋 Informations utiles:" -ForegroundColor Yellow
Write-Host "  • Dashboard: https://app.netlify.com" -ForegroundColor Cyan
Write-Host "  • Configuration: netlify.toml" -ForegroundColor Cyan
Write-Host "  • API Backend: https://yukpomnang.onrender.com" -ForegroundColor Cyan

# Retourner au dossier parent
Set-Location ..

Write-Host "`n🎉 Script de déploiement terminé!" -ForegroundColor Green
