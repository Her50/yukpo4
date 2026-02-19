# Script de Téléchargement des Rapports de Facturation GCP
# Date: 2026-02-19
# Objectif: Télécharger les rapports de facturation détaillés pour analyse

$PROJECT = "yukpo-project"
$PROJECT_ID = "738929393617"
$OUTPUT_DIR = "billing-reports"
$DATE = Get-Date -Format "yyyy-MM-dd"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Téléchargement Rapports Facturation GCP" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Créer le dossier de sortie
if (-not (Test-Path $OUTPUT_DIR)) {
    New-Item -ItemType Directory -Path $OUTPUT_DIR | Out-Null
}

Write-Host "[1/4] Récupération des comptes de facturation..." -ForegroundColor Yellow
try {
    $billingAccounts = gcloud billing accounts list --format="json" 2>&1 | ConvertFrom-Json
    if ($billingAccounts) {
        foreach ($account in $billingAccounts) {
            $accountId = $account.name -replace "billingAccounts/", ""
            Write-Host "✅ Compte trouvé: $($account.displayName) (ID: $accountId)" -ForegroundColor Green
            
            # Exporter les rapports pour les 3 derniers mois
            $months = @(
                (Get-Date).AddMonths(-2).ToString("yyyy-MM"),
                (Get-Date).AddMonths(-1).ToString("yyyy-MM"),
                (Get-Date).ToString("yyyy-MM")
            )
            
            foreach ($month in $months) {
                Write-Host "  📊 Export $month..." -ForegroundColor Cyan
                $outputFile = Join-Path $OUTPUT_DIR "billing_${accountId}_${month}.csv"
                
                # Exporter via gcloud billing
                gcloud billing projects describe $PROJECT_ID --format="json" --billing-account=$accountId 2>&1 | Out-Null
                
                Write-Host "    ✅ Rapport disponible dans Console GCP" -ForegroundColor Gray
                Write-Host "    URL: https://console.cloud.google.com/billing/$accountId/reports?project=$PROJECT_ID" -ForegroundColor Gray
            }
        }
    }
}
catch {
    Write-Host "⚠️ Erreur lors de la récupération des comptes" -ForegroundColor Yellow
    Write-Host "   Détails: $_" -ForegroundColor Gray
}
Write-Host ""

Write-Host "[2/4] Génération des commandes d'export..." -ForegroundColor Yellow
$exportScript = Join-Path $OUTPUT_DIR "export-commands.txt"
@"
========================================
COMMANDES POUR EXPORTER LES RAPPORTS
========================================

1. EXPORT VIA CONSOLE GCP (Recommandé):
   https://console.cloud.google.com/billing/reports?project=$PROJECT_ID

   Étapes:
   - Sélectionner la période (3 derniers mois)
   - Grouper par: Service, SKU, Project
   - Exporter en CSV

2. EXPORT VIA gcloud CLI:
   gcloud billing projects describe $PROJECT_ID --format="json"

3. EXPORT DÉTAILLÉ PAR SERVICE:
   - Places API: Vérifier dans APIs & Services > Quotas
   - Translation API: Vérifier dans APIs & Services > Quotas
   - Cloud Run: Vérifier dans Cloud Run > Métriques
   - Cloud SQL: Vérifier dans Cloud SQL > Utilisation

4. URLS DIRECTES:
   - Rapports: https://console.cloud.google.com/billing/reports?project=$PROJECT_ID
   - Budgets: https://console.cloud.google.com/billing/budgets?project=$PROJECT_ID
   - Anomalies: https://console.cloud.google.com/billing/anomalies?project=$PROJECT_ID
   - Quotas Places: https://console.cloud.google.com/apis/api/places-backend.googleapis.com/quotas?project=$PROJECT_ID
   - Quotas Translation: https://console.cloud.google.com/apis/api/translate.googleapis.com/quotas?project=$PROJECT_ID

"@ | Out-File -FilePath $exportScript -Encoding UTF8
Write-Host "✅ Commandes sauvegardées dans: $exportScript" -ForegroundColor Green
Write-Host ""

Write-Host "[3/4] Vérification des quotas d'utilisation..." -ForegroundColor Yellow
try {
    # Vérifier les quotas pour Places API
    Write-Host "  📊 Places API..." -ForegroundColor Cyan
    $placesQuota = gcloud services quota list --service=places-backend.googleapis.com --consumer=projects/$PROJECT_ID --format="json" 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "    ✅ Quotas Places API récupérés" -ForegroundColor Green
    }
    
    # Vérifier les quotas pour Translation API
    Write-Host "  📊 Translation API..." -ForegroundColor Cyan
    $translateQuota = gcloud services quota list --service=translate.googleapis.com --consumer=projects/$PROJECT_ID --format="json" 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "    ✅ Quotas Translation API récupérés" -ForegroundColor Green
    }
}
catch {
    Write-Host "    ⚠️ Impossible de récupérer les quotas via CLI" -ForegroundColor Yellow
    Write-Host "    ℹ️ Vérifier dans Console GCP: APIs & Services > Quotas" -ForegroundColor Gray
}
Write-Host ""

Write-Host "[4/4] Génération du rapport d'analyse..." -ForegroundColor Yellow
$analysisFile = Join-Path $OUTPUT_DIR "analyse-couts_$DATE.txt"
@"
========================================
ANALYSE DES COÛTS - APIs GOOGLE
Date: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
Projet: $PROJECT (ID: $PROJECT_ID)
========================================

APIS GOOGLE UTILISÉES DANS L'APPLICATION:
========================================

1. GOOGLE PLACES API
   - Utilisation Backend:
     * Création de service: 1 appel/service créé
     * Enrichissement lieu: 1-2 appels/service
   - Utilisation Frontend Mobile:
     * Autocomplete (ModernGPSModal): Appel à chaque frappe (debounce 300ms)
     * LocationSelector: Appel à chaque frappe (debounce 300ms)
     * hotelPlacesService: Appel par recherche
     * healthPlacesService: Appel par recherche
   
   RISQUE: Si 1000 utilisateurs tapent 10 caracteres chacun = 10,000 appels
   COUT: ~$0.017 par requete (apres $200 gratuit/mois)

2. GOOGLE TRANSLATION API
   - Utilisation Backend:
     * Traduction texte en anglais: 1 appel/traduction
     * Appelé lors création service
   
   COUT: 500,000 caracteres gratuits/mois, puis $20/million

3. AUTRES APIs ACTIVÉES (41 au total)
   - BigQuery (peut être coûteux)
   - Cloud Run (facturé par utilisation)
   - Cloud SQL (db-f1-micro = gratuit normalement)
   - Cloud Storage (facturé par stockage/transfert)

RECOMMANDATIONS:
========================================

1. VÉRIFIER LES RAPPORTS DE FACTURATION:
   - Identifier quel service génère le plus de coûts
   - Vérifier si Places API est la source principale
   - Vérifier si Translation API est la source principale

2. OPTIMISER L'UTILISATION:
   - Augmenter le debounce de l'autocomplete (300ms → 500ms)
   - Limiter les appels Places API côté frontend
   - Mettre en cache les résultats d'autocomplete
   - Désactiver l'autocomplete si non utilisé

3. CONFIGURER DES BUDGETS:
   - Budget mensuel: $50-100
   - Alerte à 80% du budget
   - Blocage automatique à 100%

4. VÉRIFIER LES QUOTAS:
   - Places API: Limiter les requêtes/jour
   - Translation API: Limiter les caractères/mois
   - Configurer des alertes de quota

PROCHAINES ÉTAPES:
========================================

1. Exporter les rapports depuis Console GCP
2. Analyser les coûts par service/API
3. Identifier la source principale des coûts
4. Contacter le support avec ces informations
5. Mettre en place des protections (budgets, quotas)

"@ | Out-File -FilePath $analysisFile -Encoding UTF8
Write-Host "✅ Analyse sauvegardée dans: $analysisFile" -ForegroundColor Green
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "✅ Téléchargement terminé!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Fichiers générés:" -ForegroundColor Yellow
Write-Host "  - $exportScript" -ForegroundColor White
Write-Host "  - $analysisFile" -ForegroundColor White
Write-Host ""
Write-Host "IMPORTANT: Les rapports CSV doivent etre telecharges manuellement depuis:" -ForegroundColor Yellow
Write-Host "  https://console.cloud.google.com/billing/reports?project=$PROJECT_ID" -ForegroundColor Cyan
Write-Host ""

