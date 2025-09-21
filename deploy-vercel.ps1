#!/usr/bin/env pwsh
# Script de déploiement pour Vercel

Write-Host "=== Déploiement Yukpomnang sur Vercel ===" -ForegroundColor Cyan

# Vérifier que nous sommes dans le bon répertoire
if (-not (Test-Path "frontend/package.json")) {
    Write-Host "Erreur: Ce script doit être exécuté depuis la racine du projet" -ForegroundColor Red
    exit 1
}

# Vérifier que Vercel CLI est installé
$vercelVersion = vercel --version 2>$null
if (-not $vercelVersion) {
    Write-Host "Installation de Vercel CLI..." -ForegroundColor Yellow
    npm i -g vercel
}

# S'assurer que le fichier .env.production existe
if (-not (Test-Path "frontend/.env.production")) {
    Write-Host "Création du fichier .env.production..." -ForegroundColor Yellow
    Copy-Item "frontend/.env" "frontend/.env.production"
    
    # Remplacer les URLs de développement par celles de production
    $content = Get-Content "frontend/.env.production"
    $content = $content -replace "localhost:8000", "yukpomnang.onrender.com"
    $content = $content -replace "localhost:3000", "yukpomnang.onrender.com"
    $content = $content -replace "development", "production"
    $content = $content -replace "APP_DEBUG=true", "APP_DEBUG=false"
    Set-Content "frontend/.env.production" $content
}

Write-Host "Configuration de l'environnement de production..." -ForegroundColor Green

# Construire le frontend
Write-Host "Construction du frontend..." -ForegroundColor Yellow
Set-Location frontend
npm install
npm run build

# Retourner à la racine
Set-Location ..

# Déployer sur Vercel
Write-Host "Déploiement sur Vercel..." -ForegroundColor Yellow
vercel --prod

Write-Host "`n=== Déploiement terminé ===" -ForegroundColor Green
Write-Host "Frontend: https://yukpomnang.vercel.app" -ForegroundColor Cyan
Write-Host "Backend: https://yukpomnang.onrender.com" -ForegroundColor Cyan

Write-Host "`nPour tester la connexion, ouvrez: test-connection.html" -ForegroundColor Yellow 