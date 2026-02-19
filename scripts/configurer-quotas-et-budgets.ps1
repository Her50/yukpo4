# Script de Configuration Quotas Places API et Budgets GCP
# Date: 2026-02-19
# Objectif: Configurer les quotas et budgets pour protéger contre les coûts excessifs

$PROJECT = "yukpo-project"
$PROJECT_ID = "738929393617"
$SERVICE = "places-backend.googleapis.com"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Configuration Quotas et Budgets GCP" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Vérifier la configuration gcloud
Write-Host "[1/6] Vérification de la configuration gcloud..." -ForegroundColor Yellow
$currentProject = gcloud config get-value project 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Erreur: gcloud n'est pas configuré" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Projet: $currentProject" -ForegroundColor Green
Write-Host ""

# 2. Récupérer le compte de facturation
Write-Host "[2/6] Récupération du compte de facturation..." -ForegroundColor Yellow
try {
    $billingAccounts = gcloud billing accounts list --format="json" 2>&1 | ConvertFrom-Json
    if ($billingAccounts -and $billingAccounts.Count -gt 0) {
        $billingAccount = $billingAccounts[0]
        $BILLING_ACCOUNT_ID = $billingAccount.name -replace "billingAccounts/", ""
        Write-Host "✅ Compte de facturation trouvé: $($billingAccount.displayName) (ID: $BILLING_ACCOUNT_ID)" -ForegroundColor Green
    }
    else {
        Write-Host "⚠️ Aucun compte de facturation trouvé" -ForegroundColor Yellow
        Write-Host "   Les budgets doivent être créés manuellement via la console" -ForegroundColor Gray
        $BILLING_ACCOUNT_ID = $null
    }
}
catch {
    Write-Host "⚠️ Erreur lors de la récupération du compte de facturation" -ForegroundColor Yellow
    Write-Host "   Détails: $_" -ForegroundColor Gray
    $BILLING_ACCOUNT_ID = $null
}
Write-Host ""

# 3. Vérifier les quotas Places API actuels
Write-Host "[3/6] Vérification des quotas Places API..." -ForegroundColor Yellow
try {
    Write-Host "  📊 Récupération des quotas..." -ForegroundColor Cyan
    $quotas = gcloud services quota list --service=$SERVICE --consumer=projects/$PROJECT_ID --format="json" 2>&1
    if ($LASTEXITCODE -eq 0 -and $quotas) {
        $quotasJson = $quotas | ConvertFrom-Json
        Write-Host "    ✅ Quotas récupérés" -ForegroundColor Green
        Write-Host "    ℹ️ Note: La modification de quotas nécessite souvent une demande via la console" -ForegroundColor Gray
    }
    else {
        Write-Host "    ⚠️ Impossible de récupérer les quotas via CLI" -ForegroundColor Yellow
        Write-Host "    ℹ️ Configuration manuelle requise via console" -ForegroundColor Gray
    }
}
catch {
    Write-Host "    ⚠️ Erreur lors de la récupération des quotas" -ForegroundColor Yellow
}
Write-Host ""

# 4. Créer un budget (si billing account disponible)
Write-Host "[4/6] Création du budget mensuel..." -ForegroundColor Yellow
if ($BILLING_ACCOUNT_ID) {
    try {
        $budgetName = "Budget-Mensuel-Yukpo-100USD"
        Write-Host "  📊 Création du budget: $budgetName" -ForegroundColor Cyan
        
        # Vérifier si le budget existe déjà
        $existingBudgets = gcloud billing budgets list --billing-account=$BILLING_ACCOUNT_ID --format="json" 2>&1 | ConvertFrom-Json
        $budgetExists = $existingBudgets | Where-Object { $_.displayName -eq $budgetName }
        
        if ($budgetExists) {
            Write-Host "    ⚠️ Budget existe déjà: $budgetName" -ForegroundColor Yellow
            Write-Host "    ℹ️ Utiliser la console pour le modifier si nécessaire" -ForegroundColor Gray
        }
        else {
            # Créer le budget via gcloud (nécessite un fichier YAML)
            Write-Host "    ℹ️ Création du budget via console recommandée" -ForegroundColor Gray
            Write-Host "    URL: https://console.cloud.google.com/billing/budgets/create?project=$PROJECT_ID" -ForegroundColor Cyan
            Write-Host ""
            Write-Host "    Configuration recommandée:" -ForegroundColor Yellow
            Write-Host "      - Nom: Budget Mensuel Yukpo - `$100" -ForegroundColor White
            Write-Host "      - Montant: 100 USD" -ForegroundColor White
            Write-Host "      - Période: Mensuel" -ForegroundColor White
            Write-Host "      - Alertes: 50%, 80%, 100%" -ForegroundColor White
        }
    }
    catch {
        Write-Host "    ⚠️ Erreur lors de la création du budget" -ForegroundColor Yellow
        Write-Host "    ℹ️ Création manuelle requise via console" -ForegroundColor Gray
    }
}
else {
    Write-Host "  ⚠️ Compte de facturation non disponible" -ForegroundColor Yellow
    Write-Host "  ℹ️ Créer le budget manuellement via:" -ForegroundColor Gray
    Write-Host "     https://console.cloud.google.com/billing/budgets/create?project=$PROJECT_ID" -ForegroundColor Cyan
}
Write-Host ""

# 5. Générer les commandes et URLs
Write-Host "[5/6] Génération des commandes et URLs..." -ForegroundColor Yellow
$commandsFile = "configuration-quotas-budgets-commands.txt"
@"
========================================
CONFIGURATION QUOTAS ET BUDGETS GCP
Date: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
Projet: $PROJECT (ID: $PROJECT_ID)
========================================

URLS DIRECTES:
==============

1. QUOTAS PLACES API:
   https://console.cloud.google.com/apis/api/places-backend.googleapis.com/quotas?project=$PROJECT_ID

2. BUDGETS ET ALERTES:
   https://console.cloud.google.com/billing/budgets?project=$PROJECT_ID

3. CRÉER UN BUDGET:
   https://console.cloud.google.com/billing/budgets/create?project=$PROJECT_ID

CONFIGURATION RECOMMANDÉE:
==========================

QUOTAS PLACES API:
------------------
1. Aller sur l'URL ci-dessus
2. Chercher "Requests per day"
3. Cliquer "EDIT QUOTAS"
4. Nouvelle limite: 50000 (50,000 requêtes/jour)
5. Justification: "Limitation pour éviter coûts excessifs suite à bug code. Application en développement."
6. Sauvegarder

7. Chercher "Requests per minute"
8. Cliquer "EDIT QUOTAS"
9. Nouvelle limite: 100 (100 requêtes/minute)
10. Sauvegarder

BUDGETS:
--------
1. Aller sur l'URL de création de budget
2. Nom: "Budget Mensuel Yukpo - `$100"
3. Compte de facturation: Sélectionner votre compte
4. Montant: 100 USD
5. Période: Mensuel
6. Filtre (optionnel): Project = yukpo-project
7. Alertes:
   - Alerte 1: 50% (`$50)
   - Alerte 2: 80% (`$80)
   - Alerte 3: 100% (`$100)
8. Email notifications: Votre email
9. Sauvegarder

COMMANDES GCLOUD (Si Permissions Disponibles):
===============================================

# Lister les quotas Places API
gcloud services quota list --service=$SERVICE --consumer=projects/$PROJECT_ID

# Lister les budgets
gcloud billing budgets list --billing-account=$BILLING_ACCOUNT_ID

# Créer un budget (nécessite fichier YAML - voir documentation)
# gcloud billing budgets create --billing-account=$BILLING_ACCOUNT_ID --budget-file=budget.yaml

NOTES:
======
- Les quotas peuvent nécessiter une demande d'approbation
- Les budgets peuvent être créés via console (plus simple)
- Vérifier régulièrement les alertes par email

"@ | Out-File -FilePath $commandsFile -Encoding UTF8
Write-Host "✅ Commandes sauvegardées dans: $commandsFile" -ForegroundColor Green
Write-Host ""

# 6. Résumé
Write-Host "[6/6] Résumé..." -ForegroundColor Yellow
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "✅ Configuration préparée!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "ACTIONS REQUISES:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. CONFIGURER LES QUOTAS PLACES API:" -ForegroundColor Cyan
Write-Host "   https://console.cloud.google.com/apis/api/places-backend.googleapis.com/quotas?project=$PROJECT_ID" -ForegroundColor White
Write-Host "   - Limiter à 50,000 requêtes/jour" -ForegroundColor Gray
Write-Host "   - Limiter à 100 requêtes/minute" -ForegroundColor Gray
Write-Host ""
Write-Host "2. CRÉER UN BUDGET:" -ForegroundColor Cyan
Write-Host "   https://console.cloud.google.com/billing/budgets/create?project=$PROJECT_ID" -ForegroundColor White
Write-Host "   - Montant: `$100/mois" -ForegroundColor Gray
Write-Host "   - Alertes: 50%, 80%, 100%" -ForegroundColor Gray
Write-Host ""
Write-Host "Fichier de commandes:" -ForegroundColor Yellow
Write-Host "  $commandsFile" -ForegroundColor White
Write-Host ""

