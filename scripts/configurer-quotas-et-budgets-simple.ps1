# Script Simplifié - Configuration Quotas et Budgets GCP
# Date: 2026-02-19

$PROJECT = "yukpo-project"
$PROJECT_ID = "738929393617"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Configuration Quotas et Budgets GCP" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "URLS DIRECTES POUR CONFIGURATION:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. QUOTAS PLACES API:" -ForegroundColor Cyan
Write-Host "   https://console.cloud.google.com/apis/api/places-backend.googleapis.com/quotas?project=$PROJECT_ID" -ForegroundColor White
Write-Host ""
Write-Host "2. BUDGETS ET ALERTES:" -ForegroundColor Cyan
Write-Host "   https://console.cloud.google.com/billing/budgets?project=$PROJECT_ID" -ForegroundColor White
Write-Host ""
Write-Host "3. CRÉER UN BUDGET:" -ForegroundColor Cyan
Write-Host "   https://console.cloud.google.com/billing/budgets/create?project=$PROJECT_ID" -ForegroundColor White
Write-Host ""

Write-Host "CONFIGURATION RECOMMANDÉE:" -ForegroundColor Yellow
Write-Host ""
Write-Host "QUOTAS PLACES API:" -ForegroundColor Cyan
Write-Host "  - Requests per day: 50,000" -ForegroundColor White
Write-Host "  - Requests per minute: 100" -ForegroundColor White
Write-Host "  - Requests per 100 seconds: 200" -ForegroundColor White
Write-Host ""
Write-Host "BUDGETS:" -ForegroundColor Cyan
Write-Host "  - Montant: `$100/mois" -ForegroundColor White
Write-Host "  - Alertes: 50% (`$50), 80% (`$80), 100% (`$100)" -ForegroundColor White
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "✅ URLs générées - Configuration manuelle requise" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "NOTE: Les quotas et budgets doivent être configurés via la console GCP" -ForegroundColor Yellow
Write-Host "      car ils nécessitent des permissions spéciales et des approbations." -ForegroundColor Yellow
Write-Host ""

