# Script Final - Configuration Quotas et Budgets GCP
# Date: 2026-02-19

$PROJECT = "yukpo-project"
$PROJECT_ID = "738929393617"
$BILLING_ACCOUNT = "0117B7-CA43F5-8DFA8E"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Configuration Quotas et Budgets GCP" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Activer l'API Billing Budget
Write-Host "[1/4] Activation de l'API Billing Budget..." -ForegroundColor Yellow
$enableAPI = gcloud services enable billingbudgets.googleapis.com --project=$PROJECT_ID 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ API Billing Budget activée" -ForegroundColor Green
}
else {
    Write-Host "⚠️ Erreur activation API: $enableAPI" -ForegroundColor Yellow
    Write-Host "   Activer manuellement: https://console.developers.google.com/apis/api/billingbudgets.googleapis.com/overview?project=$PROJECT_ID" -ForegroundColor Gray
}
Write-Host ""

# 2. Attendre quelques secondes pour propagation
Write-Host "[2/4] Attente propagation API (5 secondes)..." -ForegroundColor Yellow
Start-Sleep -Seconds 5
Write-Host "✅ Attente terminée" -ForegroundColor Green
Write-Host ""

# 3. Créer le budget
Write-Host "[3/4] Création du budget mensuel..." -ForegroundColor Yellow
$budgetName = "Budget-Mensuel-Yukpo-100USD"
Write-Host "  📊 Budget: $budgetName" -ForegroundColor Cyan

$createBudget = gcloud billing budgets create --billing-account=$BILLING_ACCOUNT --display-name=$budgetName --budget-amount=100USD --threshold-rule=percent=0.5 --threshold-rule=percent=0.8 --threshold-rule=percent=1.0 --projects=$PROJECT_ID 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "    ✅ Budget créé avec succès!" -ForegroundColor Green
}
else {
    Write-Host "    ⚠️ Erreur: $createBudget" -ForegroundColor Yellow
    Write-Host "    ℹ️ Création manuelle recommandée" -ForegroundColor Gray
}
Write-Host ""

# 4. Générer les instructions
Write-Host "[4/4] Génération des instructions..." -ForegroundColor Yellow
$instructionsFile = "INSTRUCTIONS_CONFIGURATION_FINALE.txt"
$instructions = "========================================`n"
$instructions += "INSTRUCTIONS CONFIGURATION QUOTAS ET BUDGETS`n"
$instructions += "Date: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')`n"
$instructions += "Projet: $PROJECT (ID: $PROJECT_ID)`n"
$instructions += "========================================`n`n"
$instructions += "URLS DIRECTES:`n"
$instructions += "==============`n`n"
$instructions += "1. QUOTAS PLACES API:`n"
$instructions += "   https://console.cloud.google.com/apis/api/places-backend.googleapis.com/quotas?project=$PROJECT_ID`n`n"
$instructions += "2. BUDGETS:`n"
$instructions += "   https://console.cloud.google.com/billing/budgets?project=$PROJECT_ID`n`n"
$instructions += "3. CRÉER BUDGET:`n"
$instructions += "   https://console.cloud.google.com/billing/budgets/create?project=$PROJECT_ID`n`n"
$instructions += "CONFIGURATION QUOTAS:`n"
$instructions += "- Requests per day: 50,000`n"
$instructions += "- Requests per minute: 100`n`n"
$instructions += "CONFIGURATION BUDGET:`n"
$instructions += "- Montant: `$100/mois`n"
$instructions += "- Alertes: 50%, 80%, 100%`n"

$instructions | Out-File -FilePath $instructionsFile -Encoding UTF8
Write-Host "✅ Instructions sauvegardées dans: $instructionsFile" -ForegroundColor Green
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "✅ Configuration terminée!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "URLS IMPORTANTES:" -ForegroundColor Yellow
Write-Host "  Quotas: https://console.cloud.google.com/apis/api/places-backend.googleapis.com/quotas?project=$PROJECT_ID" -ForegroundColor Cyan
Write-Host "  Budgets: https://console.cloud.google.com/billing/budgets/create?project=$PROJECT_ID" -ForegroundColor Cyan
Write-Host ""

