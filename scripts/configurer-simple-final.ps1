# Script Simple - Configuration Quotas et Budgets
$PROJECT_ID = "738929393617"
$BILLING_ACCOUNT = "0117B7-CA43F5-8DFA8E"

Write-Host "Configuration Quotas et Budgets GCP" -ForegroundColor Cyan
Write-Host ""

# Activer API
Write-Host "Activation API Billing Budget..." -ForegroundColor Yellow
gcloud services enable billingbudgets.googleapis.com --project=yukpo-project 2>&1 | Out-Null
Write-Host "OK" -ForegroundColor Green
Write-Host ""

# Attendre
Start-Sleep -Seconds 3

# Créer budget
Write-Host "Creation budget..." -ForegroundColor Yellow
$result = gcloud billing budgets create --billing-account=$BILLING_ACCOUNT --display-name="Budget-Mensuel-Yukpo-100USD" --budget-amount=100USD --threshold-rule=percent=0.5 --threshold-rule=percent=0.8 --threshold-rule=percent=1.0 --projects=$PROJECT_ID 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "Budget cree avec succes!" -ForegroundColor Green
}
else {
    Write-Host "Erreur creation budget" -ForegroundColor Yellow
    Write-Host "Creation manuelle recommandee" -ForegroundColor Gray
}
Write-Host ""

Write-Host "URLS:" -ForegroundColor Yellow
Write-Host "Quotas: https://console.cloud.google.com/apis/api/places-backend.googleapis.com/quotas?project=$PROJECT_ID" -ForegroundColor Cyan
Write-Host "Budgets: https://console.cloud.google.com/billing/budgets/create?project=$PROJECT_ID" -ForegroundColor Cyan
Write-Host ""

