# Script pour guider la recherche du numéro de client Hetzner

$ErrorActionPreference = "Continue"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Trouver Numéro Client Hetzner" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "📋 Où trouver votre numéro de client Hetzner:" -ForegroundColor Yellow
Write-Host ""

Write-Host "1. Panel Hetzner Cloud (Recommandé)" -ForegroundColor Cyan
Write-Host "   - Ouvrez: https://console.hetzner.cloud/" -ForegroundColor Gray
Write-Host "   - Cliquez sur votre nom (en haut à droite)" -ForegroundColor Gray
Write-Host "   - Allez dans 'Account Settings' ou 'Profile'" -ForegroundColor Gray
Write-Host "   - Le Customer Number est affiché" -ForegroundColor Gray
Write-Host ""

Write-Host "2. Email de Bienvenue" -ForegroundColor Cyan
Write-Host "   - Vérifiez votre email (celui utilisé pour Hetzner)" -ForegroundColor Gray
Write-Host "   - Cherchez 'Welcome to Hetzner Cloud'" -ForegroundColor Gray
Write-Host "   - Le numéro de client est dans l'email" -ForegroundColor Gray
Write-Host ""

Write-Host "3. Factures Hetzner" -ForegroundColor Cyan
Write-Host "   - Panel Hetzner → Billing → Invoices" -ForegroundColor Gray
Write-Host "   - Ouvrez une facture récente" -ForegroundColor Gray
Write-Host "   - Le numéro de client est en haut" -ForegroundColor Gray
Write-Host ""

Write-Host "4. Support Hetzner" -ForegroundColor Cyan
Write-Host "   - https://console.hetzner.cloud/support" -ForegroundColor Gray
Write-Host "   - Fournissez votre email et IP: 46.224.14.85" -ForegroundColor Gray
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Ouverture Panel Hetzner" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "✅ Ouverture du panel Hetzner dans votre navigateur..." -ForegroundColor Green
Start-Process "https://console.hetzner.cloud/"

Write-Host ""
Write-Host "💡 Le numéro de client n'est généralement PAS nécessaire pour:" -ForegroundColor Yellow
Write-Host "   - Réinitialiser le mot de passe root" -ForegroundColor White
Write-Host "   - Utiliser l'API Hetzner (nécessite un token API)" -ForegroundColor White
Write-Host "   - Se connecter au panel" -ForegroundColor White
Write-Host ""
Write-Host "📄 Voir TROUVER_NUMERO_CLIENT_HETZNER.md pour plus de détails" -ForegroundColor Cyan
Write-Host ""

