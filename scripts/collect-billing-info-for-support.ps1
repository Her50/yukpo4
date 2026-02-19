# Script de Collecte d'Informations pour Support Google Cloud - Anomalies de Coûts
# Date: 2026-02-18
# Objectif: Collecter toutes les informations nécessaires avant de contacter le support

$PROJECT = "yukpo-project"
$PROJECT_ID = "738929393617"
$OUTPUT_DIR = "billing-support-info"
$DATE = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Collecte d'Informations pour Support GCP" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Créer le dossier de sortie
if (-not (Test-Path $OUTPUT_DIR)) {
    New-Item -ItemType Directory -Path $OUTPUT_DIR | Out-Null
}

$OUTPUT_FILE = Join-Path $OUTPUT_DIR "support-info_$DATE.txt"
$CSV_FILE = Join-Path $OUTPUT_DIR "resources_$DATE.csv"

Write-Host "[1/8] Vérification de la configuration gcloud..." -ForegroundColor Yellow
$currentProject = gcloud config get-value project 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Erreur: gcloud n'est pas configuré" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Projet: $currentProject" -ForegroundColor Green
Write-Host ""

# Initialiser le fichier de sortie
@"
========================================
INFORMATIONS POUR SUPPORT GOOGLE CLOUD
Date: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
Projet: $PROJECT (ID: $PROJECT_ID)
========================================

"@ | Out-File -FilePath $OUTPUT_FILE -Encoding UTF8

Write-Host "[2/8] Collecte des informations du compte de facturation..." -ForegroundColor Yellow
try {
    $billingAccounts = gcloud billing accounts list --format="json" 2>&1 | ConvertFrom-Json
    if ($billingAccounts) {
        $billingInfo = @"
COMPTE DE FACTURATION:
"@
        foreach ($account in $billingAccounts) {
            $billingInfo += @"
- ID: $($account.name)
- Nom: $($account.displayName)
- État: $($account.open)
- Pays: $($account.countryCode)

"@
        }
        $billingInfo | Out-File -FilePath $OUTPUT_FILE -Append -Encoding UTF8
        Write-Host "✅ Comptes de facturation collectés" -ForegroundColor Green
    }
}
catch {
    Write-Host "⚠️ Impossible de récupérer les comptes de facturation" -ForegroundColor Yellow
}
Write-Host ""

Write-Host "[3/8] Liste des instances Compute Engine..." -ForegroundColor Yellow
try {
    $instances = gcloud compute instances list --project=$PROJECT --format="json" 2>&1 | ConvertFrom-Json
    if ($instances) {
        $instancesInfo = @"
INSTANCES COMPUTE ENGINE:
Total: $($instances.Count)

"@
        foreach ($instance in $instances) {
            $instancesInfo += @"
- Nom: $($instance.name)
- Zone: $($instance.zone)
- Machine Type: $($instance.machineType)
- Statut: $($instance.status)
- GPUs: $($instance.guestAccelerators.Count)
- IP Externe: $($instance.networkInterfaces[0].accessConfigs[0].natIP)

"@
        }
        $instancesInfo | Out-File -FilePath $OUTPUT_FILE -Append -Encoding UTF8
        Write-Host "✅ $($instances.Count) instance(s) trouvée(s)" -ForegroundColor Green
    }
    else {
        "INSTANCES COMPUTE ENGINE: Aucune instance trouvée`n" | Out-File -FilePath $OUTPUT_FILE -Append -Encoding UTF8
        Write-Host "✅ Aucune instance Compute Engine" -ForegroundColor Green
    }
}
catch {
    "INSTANCES COMPUTE ENGINE: Erreur lors de la collecte`n" | Out-File -FilePath $OUTPUT_FILE -Append -Encoding UTF8
    Write-Host "⚠️ Erreur lors de la collecte des instances" -ForegroundColor Yellow
}
Write-Host ""

Write-Host "[4/8] Liste des services Cloud Run..." -ForegroundColor Yellow
try {
    $services = gcloud run services list --project=$PROJECT --region=europe-west1 --format="json" 2>&1 | ConvertFrom-Json
    if ($services) {
        $servicesInfo = @"
SERVICES CLOUD RUN:
Total: $($services.Count)

"@
        foreach ($service in $services) {
            $servicesInfo += @"
- Nom: $($service.metadata.name)
- Région: $($service.metadata.namespace)
- URL: $($service.status.url)
- Révisions: $($service.status.conditions.Count)

"@
        }
        $servicesInfo | Out-File -FilePath $OUTPUT_FILE -Append -Encoding UTF8
        Write-Host "✅ $($services.Count) service(s) trouvé(s)" -ForegroundColor Green
    }
    else {
        "SERVICES CLOUD RUN: Aucun service trouvé`n" | Out-File -FilePath $OUTPUT_FILE -Append -Encoding UTF8
        Write-Host "✅ Aucun service Cloud Run" -ForegroundColor Green
    }
}
catch {
    "SERVICES CLOUD RUN: Erreur lors de la collecte`n" | Out-File -FilePath $OUTPUT_FILE -Append -Encoding UTF8
    Write-Host "⚠️ Erreur lors de la collecte des services" -ForegroundColor Yellow
}
Write-Host ""

Write-Host "[5/8] Liste des buckets Cloud Storage..." -ForegroundColor Yellow
try {
    $buckets = gsutil ls -p $PROJECT 2>&1
    if ($buckets) {
        $bucketsInfo = @"
BUCKETS CLOUD STORAGE:
Total: $($buckets.Count)

"@
        foreach ($bucket in $buckets) {
            if ($bucket -match 'gs://') {
                $bucketsInfo += @"
- $bucket

"@
            }
        }
        $bucketsInfo | Out-File -FilePath $OUTPUT_FILE -Append -Encoding UTF8
        Write-Host "✅ Buckets collectés" -ForegroundColor Green
    }
    else {
        "BUCKETS CLOUD STORAGE: Aucun bucket trouvé`n" | Out-File -FilePath $OUTPUT_FILE -Append -Encoding UTF8
        Write-Host "✅ Aucun bucket Cloud Storage" -ForegroundColor Green
    }
}
catch {
    "BUCKETS CLOUD STORAGE: Erreur lors de la collecte`n" | Out-File -FilePath $OUTPUT_FILE -Append -Encoding UTF8
    Write-Host "⚠️ Erreur lors de la collecte des buckets" -ForegroundColor Yellow
}
Write-Host ""

Write-Host "[6/8] Liste des instances Cloud SQL..." -ForegroundColor Yellow
try {
    $sqlInstances = gcloud sql instances list --project=$PROJECT --format="json" 2>&1 | ConvertFrom-Json
    if ($sqlInstances) {
        $sqlInfo = @"
INSTANCES CLOUD SQL:
Total: $($sqlInstances.Count)

"@
        foreach ($instance in $sqlInstances) {
            $sqlInfo += @"
- Nom: $($instance.name)
- Région: $($instance.region)
- Type: $($instance.databaseVersion)
- Tier: $($instance.settings.tier)
- État: $($instance.state)

"@
        }
        $sqlInfo | Out-File -FilePath $OUTPUT_FILE -Append -Encoding UTF8
        Write-Host "✅ $($sqlInstances.Count) instance(s) trouvée(s)" -ForegroundColor Green
    }
    else {
        "INSTANCES CLOUD SQL: Aucune instance trouvée`n" | Out-File -FilePath $OUTPUT_FILE -Append -Encoding UTF8
        Write-Host "✅ Aucune instance Cloud SQL" -ForegroundColor Green
    }
}
catch {
    "INSTANCES CLOUD SQL: Erreur lors de la collecte`n" | Out-File -FilePath $OUTPUT_FILE -Append -Encoding UTF8
    Write-Host "⚠️ Erreur lors de la collecte des instances SQL" -ForegroundColor Yellow
}
Write-Host ""

Write-Host "[7/8] Liste des APIs activées..." -ForegroundColor Yellow
try {
    $apis = gcloud services list --enabled --project=$PROJECT --format="json" 2>&1 | ConvertFrom-Json
    if ($apis) {
        $apisInfo = @"
APIS ACTIVÉES:
Total: $($apis.Count)

"@
        foreach ($api in $apis) {
            $apisInfo += @"
- $($api.config.name)

"@
        }
        $apisInfo | Out-File -FilePath $OUTPUT_FILE -Append -Encoding UTF8
        Write-Host "✅ $($apis.Count) API(s) trouvée(s)" -ForegroundColor Green
    }
}
catch {
    "APIS ACTIVÉES: Erreur lors de la collecte`n" | Out-File -FilePath $OUTPUT_FILE -Append -Encoding UTF8
    Write-Host "⚠️ Erreur lors de la collecte des APIs" -ForegroundColor Yellow
}
Write-Host ""

Write-Host "[8/8] Vérification des permissions IAM..." -ForegroundColor Yellow
try {
    $iamPolicy = gcloud projects get-iam-policy $PROJECT --format="json" 2>&1 | ConvertFrom-Json
    if ($iamPolicy) {
        $iamInfo = @"
PERMISSIONS IAM:
Total bindings: $($iamPolicy.bindings.Count)

"@
        foreach ($binding in $iamPolicy.bindings) {
            $iamInfo += @"
- Rôle: $($binding.role)
  Membres: $($binding.members -join ', ')

"@
        }
        $iamInfo | Out-File -FilePath $OUTPUT_FILE -Append -Encoding UTF8
        Write-Host "✅ Permissions collectées" -ForegroundColor Green
    }
}
catch {
    "PERMISSIONS IAM: Erreur lors de la collecte`n" | Out-File -FilePath $OUTPUT_FILE -Append -Encoding UTF8
    Write-Host "⚠️ Erreur lors de la collecte des permissions" -ForegroundColor Yellow
}
Write-Host ""

# Ajouter les instructions finales
@"

========================================
INSTRUCTIONS POUR CONTACTER LE SUPPORT
========================================

1. ACCÈS AU SUPPORT:
   - URL: https://console.cloud.google.com/support
   - Ou: billing-support@google.com

2. INFORMATIONS À FOURNIR:
   - Projet ID: $PROJECT_ID
   - Nom du projet: $PROJECT
   - Ce fichier contient toutes les informations nécessaires

3. DEMANDES:
   - Annulation de la facture pour coûts non autorisés
   - Explication détaillée de l'utilisation
   - Identification de la source des anomalies
   - Mise en place de protections (budgets, alertes)

4. PROCHAINES ÉTAPES:
   - Exporter les rapports de facturation depuis Console GCP
   - Vérifier les budgets et alertes configurés
   - Préparer le template de demande (voir CONTACT_SUPPORT_GOOGLE_CLOUD_ANOMALIES_COUTS.md)

========================================
Fichier généré: $OUTPUT_FILE
Date: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
========================================
"@ | Out-File -FilePath $OUTPUT_FILE -Append -Encoding UTF8

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "✅ Collecte terminée avec succès!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Fichier généré:" -ForegroundColor Yellow
Write-Host "  $OUTPUT_FILE" -ForegroundColor White
Write-Host ""
Write-Host "Prochaines étapes:" -ForegroundColor Yellow
Write-Host "1. Examiner le fichier généré" -ForegroundColor White
Write-Host "2. Exporter les rapports de facturation depuis Console GCP" -ForegroundColor White
Write-Host "3. Consulter CONTACT_SUPPORT_GOOGLE_CLOUD_ANOMALIES_COUTS.md" -ForegroundColor White
Write-Host "4. Contacter le support avec toutes ces informations" -ForegroundColor White
Write-Host ""


