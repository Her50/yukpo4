# Script pour appliquer la migration via l'API REST Cloud SQL
# Utilise l'authentification gcloud pour éviter de demander le mot de passe

$ProjectId = "yukpo-project"
$InstanceName = "yukpo-postgres"
$DatabaseName = "yukpo_db"
$sqlFile = "scripts\apply_delivery_proximity_migration_simple.sql"

Write-Host "Application de la migration via API Cloud SQL..." -ForegroundColor Cyan
Write-Host ""

# Vérifier que gcloud est disponible
if (-not (Get-Command gcloud -ErrorAction SilentlyContinue)) {
    Write-Host "Erreur: gcloud non trouve" -ForegroundColor Red
    exit 1
}

# Vérifier l'authentification
$account = gcloud config get-value account 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "Erreur: Non authentifie avec gcloud" -ForegroundColor Red
    Write-Host "Executez: gcloud auth login" -ForegroundColor Yellow
    exit 1
}

Write-Host "Authentifie en tant que: $account" -ForegroundColor Green
Write-Host ""

# Lire le fichier SQL
if (-not (Test-Path $sqlFile)) {
    Write-Host "Erreur: Fichier non trouve: $sqlFile" -ForegroundColor Red
    exit 1
}

$sqlContent = Get-Content $sqlFile -Raw -Encoding UTF8

Write-Host "Fichier SQL lu (${sqlContent.Length} caracteres)" -ForegroundColor Green
Write-Host ""

# Utiliser gcloud sql connect avec un script temporaire
Write-Host "Methode: Utilisation de gcloud sql connect..." -ForegroundColor Yellow
Write-Host ""
Write-Host "ATTENTION: Cette methode necessite une connexion interactive." -ForegroundColor Yellow
Write-Host ""
Write-Host "Pour appliquer la migration:" -ForegroundColor Cyan
Write-Host "1. Executez: gcloud sql connect $InstanceName --user=yukpo_user --database=$DatabaseName --project=$ProjectId" -ForegroundColor White
Write-Host "2. Dans psql, executez:" -ForegroundColor White
Write-Host "   \i $sqlFile" -ForegroundColor Gray
Write-Host ""
Write-Host "OU copiez-collez le contenu suivant dans psql:" -ForegroundColor Cyan
Write-Host "---" -ForegroundColor Gray
Write-Host $sqlContent -ForegroundColor White
Write-Host "---" -ForegroundColor Gray
Write-Host ""

# Alternative: Utiliser la console Cloud SQL
Write-Host "Alternative: Via la console Cloud SQL (recommandee)" -ForegroundColor Cyan
Write-Host "1. Ouvrez: https://console.cloud.google.com/sql/instances/$InstanceName/overview?project=$ProjectId" -ForegroundColor White
Write-Host "2. Cliquez sur 'DATABASES' puis selectionnez '$DatabaseName'" -ForegroundColor White
Write-Host "3. Cliquez sur 'Query' ou 'SQL Editor'" -ForegroundColor White
Write-Host "4. Copiez-collez le contenu de: $sqlFile" -ForegroundColor White
Write-Host "5. Executez la requete" -ForegroundColor White
Write-Host ""

Write-Host "Script termine. Utilisez une des methodes ci-dessus pour appliquer la migration." -ForegroundColor Green

