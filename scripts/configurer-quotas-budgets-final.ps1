# Script Final - Configuration Quotas et Budgets GCP
# Date: 2026-02-19

$PROJECT = "yukpo-project"
$PROJECT_ID = "738929393617"
$BILLING_ACCOUNT = "0117B7-CA43F5-8DFA8E"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Configuration Quotas et Budgets GCP" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Vérifier la configuration
Write-Host "[1/3] Vérification de la configuration..." -ForegroundColor Yellow
$currentProject = gcloud config get-value project 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Projet: $currentProject" -ForegroundColor Green
}
Write-Host ""

# 2. Lister les budgets existants
Write-Host "[2/3] Vérification des budgets existants..." -ForegroundColor Yellow
$budgetsOutput = gcloud billing budgets list --billing-account=$BILLING_ACCOUNT --format="table(displayName,budgetAmount.specifiedAmount.units,budgetAmount.specifiedAmount.currencyCode)" 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Budgets existants:" -ForegroundColor Green
    Write-Host $budgetsOutput -ForegroundColor Gray
}
else {
    Write-Host "⚠️ Impossible de lister les budgets ou aucun budget trouvé" -ForegroundColor Yellow
}
Write-Host ""

# 3. Créer le budget
Write-Host "[3/3] Tentative de création du budget..." -ForegroundColor Yellow
$budgetName = "Budget-Mensuel-Yukpo-100USD"
Write-Host "  📊 Création du budget: $budgetName" -ForegroundColor Cyan

$createResult = gcloud billing budgets create --billing-account=$BILLING_ACCOUNT --display-name=$budgetName --budget-amount=100USD --threshold-rule=percent=0.5 --threshold-rule=percent=0.8 --threshold-rule=percent=1.0 --projects=$PROJECT_ID 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "    ✅ Budget créé avec succès!" -ForegroundColor Green
}
else {
    Write-Host "    ⚠️ Erreur lors de la création" -ForegroundColor Yellow
    Write-Host "    Détails: $createResult" -ForegroundColor Gray
    Write-Host "    ℹ️ Création manuelle recommandée via console" -ForegroundColor Gray
}
Write-Host ""

# Générer les instructions
$instructionsFile = "INSTRUCTIONS_CONFIGURATION_QUOTAS_BUDGETS.txt"
$instructions = @"
========================================
INSTRUCTIONS CONFIGURATION QUOTAS ET BUDGETS
Date: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
Projet: $PROJECT (ID: $PROJECT_ID)
Compte de facturation: $BILLING_ACCOUNT
========================================

URLS DIRECTES:
==============

1. QUOTAS PLACES API:
   https://console.cloud.google.com/apis/api/places-backend.googleapis.com/quotas?project=$PROJECT_ID

2. BUDGETS ET ALERTES:
   https://console.cloud.google.com/billing/budgets?project=$PROJECT_ID

3. CRÉER UN BUDGET:
   https://console.cloud.google.com/billing/budgets/create?project=$PROJECT_ID

CONFIGURATION QUOTAS PLACES API:
================================

1. Aller sur l'URL des quotas Places API
2. Chercher "Requests per day"
   - Cliquer "EDIT QUOTAS"
   - Nouvelle limite: 50000
   - Justification: "Limitation pour éviter coûts excessifs suite à bug code. Application en développement."
   - Sauvegarder
3. Chercher "Requests per minute"
   - Cliquer "EDIT QUOTAS"
   - Nouvelle limite: 100
   - Sauvegarder

CONFIGURATION BUDGET:
====================

1. Aller sur l'URL de création de budget
2. Nom: "Budget Mensuel Yukpo - `$100"
3. Montant: 100 USD
4. Période: Mensuel
5. Alertes: 50% (`$50), 80% (`$80), 100% (`$100)
6. Sauvegarder

"@

$instructions | Out-File -FilePath $instructionsFile -Encoding UTF8
Write-Host "✅ Instructions sauvegardées dans: $instructionsFile" -ForegroundColor Green
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "✅ Configuration préparée!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "URLS IMPORTANTES:" -ForegroundColor Yellow
Write-Host "  Quotas: https://console.cloud.google.com/apis/api/places-backend.googleapis.com/quotas?project=$PROJECT_ID" -ForegroundColor Cyan
Write-Host "  Budgets: https://console.cloud.google.com/billing/budgets/create?project=$PROJECT_ID" -ForegroundColor Cyan
Write-Host ""

