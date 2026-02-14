# 💰 Script : Configurer Budget et Alertes Azure
# Usage: .\scripts\setup-azure-budget.ps1

param(
    [string]$SubscriptionId = "",
    [string]$BudgetName = "yukpomnang-monthly-budget",
    [double]$BudgetAmount = 50.0,
    [string]$Email = ""
)

$ErrorActionPreference = "Stop"

Write-Host "💰 Configuration Budget Azure" -ForegroundColor Cyan
Write-Host "==============================" -ForegroundColor Cyan
Write-Host ""

# Vérifier Azure CLI
if (-not (Get-Command az -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Azure CLI n'est pas installé" -ForegroundColor Red
    exit 1
}

# Obtenir l'ID de l'abonnement si non fourni
if ([string]::IsNullOrEmpty($SubscriptionId)) {
    $account = az account show --output json | ConvertFrom-Json
    $SubscriptionId = $account.id
    Write-Host "📋 Abonnement détecté: $($account.name) ($SubscriptionId)" -ForegroundColor Yellow
}

# Demander l'email si non fourni
if ([string]::IsNullOrEmpty($Email)) {
    $Email = Read-Host "Entrez votre email pour recevoir les alertes de budget"
}

Write-Host ""
Write-Host "📊 Configuration du budget..." -ForegroundColor Yellow
Write-Host "   Montant: `$$BudgetAmount/mois" -ForegroundColor Gray
Write-Host "   Email: $Email" -ForegroundColor Gray
Write-Host ""

# Créer le budget
$budgetJson = @{
    category = "Cost"
    amount = $BudgetAmount
    timeGrain = "Monthly"
    timePeriod = @{
        startDate = (Get-Date -Format "yyyy-MM-01T00:00:00Z")
    }
    notifications = @{
        actual = @{
            enabled = $true
            operator = "GreaterThan"
            threshold = 100
            contactEmails = @($Email)
        }
        forecasted = @{
            enabled = $true
            operator = "GreaterThan"
            threshold = 90
            contactEmails = @($Email)
        }
        threshold50 = @{
            enabled = $true
            operator = "GreaterThan"
            threshold = 50
            contactEmails = @($Email)
        }
    }
} | ConvertTo-Json -Depth 10

$budgetFile = [System.IO.Path]::GetTempFileName()
$budgetJson | Out-File -FilePath $budgetFile -Encoding UTF8

az consumption budget create `
    --budget-name $BudgetName `
    --subscription $SubscriptionId `
    --amount $BudgetAmount `
    --time-grain Monthly `
    --start-date (Get-Date -Format "yyyy-MM-01") `
    --end-date (Get-Date).AddYears(1).ToString("yyyy-MM-dd") `
    --category Cost `
    --notifications threshold=50 operator=GreaterThan contact-emails=$Email `
    --notifications threshold=90 operator=GreaterThan contact-emails=$Email `
    --notifications threshold=100 operator=GreaterThan contact-emails=$Email `
    --output none

Write-Host "✅ Budget créé avec succès !" -ForegroundColor Green
Write-Host ""
Write-Host "📧 Vous recevrez des alertes par email à:" -ForegroundColor Cyan
Write-Host "   - 50% du budget" -ForegroundColor White
Write-Host "   - 90% du budget" -ForegroundColor White
Write-Host "   - 100% du budget" -ForegroundColor White
Write-Host ""

# Nettoyer
Remove-Item $budgetFile -ErrorAction SilentlyContinue

Write-Host "✅ Configuration terminée !" -ForegroundColor Green

