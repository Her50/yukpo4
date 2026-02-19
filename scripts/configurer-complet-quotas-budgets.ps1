# Script Complet - Configuration Quotas et Budgets GCP
# Date: 2026-02-19
# Note: Les quotas et budgets nécessitent souvent une configuration via console

$PROJECT = "yukpo-project"
$PROJECT_ID = "738929393617"
$BILLING_ACCOUNT = "0117B7-CA43F5-8DFA8E"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Configuration Quotas et Budgets GCP" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Vérifier la configuration
Write-Host "[1/4] Vérification de la configuration..." -ForegroundColor Yellow
$currentProject = gcloud config get-value project 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Projet: $currentProject" -ForegroundColor Green
}
Write-Host ""

# 2. Lister les budgets existants
Write-Host "[2/4] Vérification des budgets existants..." -ForegroundColor Yellow
try {
    $budgets = gcloud billing budgets list --billing-account=$BILLING_ACCOUNT --format="json" 2>&1 | ConvertFrom-Json
    if ($budgets) {
        Write-Host "✅ Budgets existants:" -ForegroundColor Green
        foreach ($budget in $budgets) {
            Write-Host "   - $($budget.displayName): $($budget.amount.specifiedAmount.units) $($budget.amount.specifiedAmount.currencyCode)" -ForegroundColor Gray
        }
    }
    else {
        Write-Host "⚠️ Aucun budget trouvé" -ForegroundColor Yellow
    }
}
catch {
    Write-Host "⚠️ Impossible de lister les budgets" -ForegroundColor Yellow
    Write-Host "   Détails: $_" -ForegroundColor Gray
}
Write-Host ""

# 3. Créer le budget via gcloud (syntaxe correcte)
Write-Host "[3/4] Création du budget mensuel..." -ForegroundColor Yellow
try {
    $budgetName = "Budget-Mensuel-Yukpo-100USD"
    Write-Host "  📊 Tentative de création du budget: $budgetName" -ForegroundColor Cyan
    
    # Vérifier si le budget existe déjà
    $existingBudgets = gcloud billing budgets list --billing-account=$BILLING_ACCOUNT --format="json" 2>&1 | ConvertFrom-Json
    $budgetExists = $existingBudgets | Where-Object { $_.displayName -like "*Yukpo*" -or $_.displayName -like "*100*" }
    
    if ($budgetExists) {
        Write-Host "    ⚠️ Budget similaire existe déjà" -ForegroundColor Yellow
        Write-Host "    ℹ️ Vérifier dans la console si configuration correcte" -ForegroundColor Gray
    }
    else {
        # Créer le budget avec la syntaxe correcte
        $createBudget = gcloud billing budgets create `
            --billing-account=$BILLING_ACCOUNT `
            --display-name=$budgetName `
            --budget-amount=100USD `
            --threshold-rule=percent=0.5 `
            --threshold-rule=percent=0.8 `
            --threshold-rule=percent=1.0 `
            --projects=$PROJECT_ID 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "    ✅ Budget créé avec succès!" -ForegroundColor Green
        }
        else {
            Write-Host "    ⚠️ Erreur lors de la création: $createBudget" -ForegroundColor Yellow
            Write-Host "    ℹ️ Création manuelle recommandée via console" -ForegroundColor Gray
        }
    }
}
catch {
    Write-Host "    ⚠️ Erreur: $_" -ForegroundColor Yellow
    Write-Host "    ℹ️ Création manuelle recommandée" -ForegroundColor Gray
}
Write-Host ""

# 4. Générer les instructions finales
Write-Host "[4/4] Génération des instructions..." -ForegroundColor Yellow
$instructionsFile = "INSTRUCTIONS_CONFIGURATION_QUOTAS_BUDGETS.txt"
@"
========================================
INSTRUCTIONS CONFIGURATION QUOTAS ET BUDGETS
Date: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
Projet: $PROJECT (ID: $PROJECT_ID)
========================================

⚠️ IMPORTANT: Les quotas et budgets doivent être configurés via la console GCP
   car les commandes CLI nécessitent des permissions spéciales.

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

1. Aller sur l'URL des quotas Places API ci-dessus

2. Chercher "Requests per day" (Requêtes par jour)
   - Cliquer "EDIT QUOTAS" ou "Modifier les quotas"
   - Nouvelle limite: 50000
   - Justification: "Limitation pour éviter coûts excessifs suite à bug code. Application en développement avec un seul testeur."
   - Sauvegarder

3. Chercher "Requests per minute" (Requêtes par minute)
   - Cliquer "EDIT QUOTAS"
   - Nouvelle limite: 100
   - Justification: Même que ci-dessus
   - Sauvegarder

4. Chercher "Requests per 100 seconds"
   - Cliquer "EDIT QUOTAS"
   - Nouvelle limite: 200
   - Sauvegarder

NOTE: Les quotas peuvent nécessiter une demande d'approbation.

CONFIGURATION BUDGET:
====================

1. Aller sur l'URL de création de budget ci-dessus

2. Informations de base:
   - Nom: "Budget Mensuel Yukpo - `$100"
   - Compte de facturation: yukpo (0117B7-CA43F5-8DFA8E)
   - Période: Mensuel
   - Montant: 100 USD

3. Filtres (optionnel):
   - Project: yukpo-project (738929393617)
   - OU Service: Places API (New)

4. Alertes:
   - Alerte 1: 50% (`$50) - Email notifications
   - Alerte 2: 80% (`$80) - Email notifications
   - Alerte 3: 100% (`$100) - Email notifications

5. Sauvegarder

VÉRIFICATION:
=============

Après configuration, vérifier:
- Les quotas sont appliqués (vérifier dans la console)
- Le budget est actif (vérifier dans la console)
- Les alertes sont configurées (vérifier les emails)

COMMANDES GCLOUD (Référence):
=============================

# Lister les budgets
gcloud billing budgets list --billing-account=$BILLING_ACCOUNT

# Vérifier les services activés
gcloud services list --enabled --project=$PROJECT_ID

# Vérifier l'utilisation Places API (via console recommandé)
# https://console.cloud.google.com/apis/api/places-backend.googleapis.com/quotas?project=$PROJECT_ID

"@ | Out-File -FilePath $instructionsFile -Encoding UTF8
Write-Host "✅ Instructions sauvegardées dans: $instructionsFile" -ForegroundColor Green
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "✅ Configuration préparée!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "PROCHAINES ÉTAPES:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Configurer les quotas Places API:" -ForegroundColor Cyan
Write-Host "   https://console.cloud.google.com/apis/api/places-backend.googleapis.com/quotas?project=$PROJECT_ID" -ForegroundColor White
Write-Host ""
Write-Host "2. Créer le budget:" -ForegroundColor Cyan
Write-Host "   https://console.cloud.google.com/billing/budgets/create?project=$PROJECT_ID" -ForegroundColor White
Write-Host ""
Write-Host "Fichier d'instructions:" -ForegroundColor Yellow
Write-Host "  $instructionsFile" -ForegroundColor White
Write-Host ""

