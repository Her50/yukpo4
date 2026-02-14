# Script pour corriger les permissions Artifact Registry GCP
# Résout l'erreur: Permission 'artifactregistry.repositories.uploadArtifacts' denied

param(
    [string]$ProjectId = "yukpo-project",
    [string]$ServiceAccountEmail = "",
    [string]$Region = "europe-west1",
    [string]$RepositoryName = "yukpo-backend"
)

Write-Host "🔧 Correction des permissions Artifact Registry GCP" -ForegroundColor Cyan
Write-Host ""

# Vérifier que gcloud est installé
if (-not (Get-Command gcloud -ErrorAction SilentlyContinue)) {
    Write-Host "❌ gcloud CLI n'est pas installé. Installez-le depuis: https://cloud.google.com/sdk/docs/install" -ForegroundColor Red
    exit 1
}

# Authentification
Write-Host "🔐 Vérification de l'authentification..." -ForegroundColor Yellow
$currentAccount = gcloud auth list --filter=status:ACTIVE --format="value(account)" 2>&1
if (-not $currentAccount) {
    Write-Host "⚠️  Aucun compte authentifié. Lancez: gcloud auth login" -ForegroundColor Yellow
    exit 1
}
Write-Host "✅ Authentifié en tant que: $currentAccount" -ForegroundColor Green

# Définir le projet
Write-Host ""
Write-Host "📋 Configuration du projet: $ProjectId" -ForegroundColor Yellow
gcloud config set project $ProjectId

# Si ServiceAccountEmail n'est pas fourni, demander
if ([string]::IsNullOrEmpty($ServiceAccountEmail)) {
    Write-Host ""
    Write-Host "📧 Entrez l'email du Service Account (ex: github-actions@yukpo-project.iam.gserviceaccount.com):" -ForegroundColor Yellow
    $ServiceAccountEmail = Read-Host
}

if ([string]::IsNullOrEmpty($ServiceAccountEmail)) {
    Write-Host "❌ Email du Service Account requis" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "🔍 Vérification du Service Account: $ServiceAccountEmail" -ForegroundColor Yellow

# Vérifier que le service account existe
$saExists = gcloud iam service-accounts describe $ServiceAccountEmail --project=$ProjectId 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Service Account non trouvé: $ServiceAccountEmail" -ForegroundColor Red
    Write-Host "💡 Créez-le avec: gcloud iam service-accounts create github-actions --display-name='GitHub Actions' --project=$ProjectId" -ForegroundColor Yellow
    exit 1
}
Write-Host "✅ Service Account trouvé" -ForegroundColor Green

# Activer l'API Artifact Registry
Write-Host ""
Write-Host "🔌 Activation de l'API Artifact Registry..." -ForegroundColor Yellow
gcloud services enable artifactregistry.googleapis.com --project=$ProjectId
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ API Artifact Registry activée" -ForegroundColor Green
} else {
    Write-Host "⚠️  Erreur lors de l'activation de l'API (peut-être déjà activée)" -ForegroundColor Yellow
}

# Créer le repository Artifact Registry s'il n'existe pas
Write-Host ""
Write-Host "📦 Vérification du repository Artifact Registry: $RepositoryName" -ForegroundColor Yellow
$repoExists = gcloud artifacts repositories describe $RepositoryName --location=$Region --project=$ProjectId 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "📦 Création du repository Artifact Registry..." -ForegroundColor Yellow
    gcloud artifacts repositories create $RepositoryName `
        --repository-format=docker `
        --location=$Region `
        --description="Docker repository for yukpo-backend" `
        --project=$ProjectId
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Repository créé: $RepositoryName" -ForegroundColor Green
    } else {
        Write-Host "❌ Erreur lors de la création du repository" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "✅ Repository existe déjà: $RepositoryName" -ForegroundColor Green
}

# Donner les permissions nécessaires au Service Account
Write-Host ""
Write-Host "🔐 Attribution des permissions Artifact Registry..." -ForegroundColor Yellow

$permissions = @(
    "roles/artifactregistry.writer",           # Permet d'uploader des images
    "roles/artifactregistry.reader",            # Permet de lire les images
    "roles/storage.objectAdmin"                 # Pour compatibilité avec GCR
)

foreach ($role in $permissions) {
    Write-Host "  → Attribution du rôle: $role" -ForegroundColor Cyan
    gcloud projects add-iam-policy-binding $ProjectId `
        --member="serviceAccount:$ServiceAccountEmail" `
        --role=$role `
        --condition=None 2>&1 | Out-Null
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "    ✅ Rôle attribué: $role" -ForegroundColor Green
    } else {
        Write-Host "    ⚠️  Erreur lors de l'attribution du rôle: $role" -ForegroundColor Yellow
    }
}

# Vérifier les permissions
Write-Host ""
Write-Host "🔍 Vérification des permissions..." -ForegroundColor Yellow
$policies = gcloud projects get-iam-policy $ProjectId --flatten="bindings[].members" --filter="bindings.members:serviceAccount:$ServiceAccountEmail" --format="table(bindings.role)" 2>&1

if ($policies -match "artifactregistry") {
    Write-Host "✅ Permissions Artifact Registry configurées" -ForegroundColor Green
} else {
    Write-Host "⚠️  Aucune permission Artifact Registry trouvée" -ForegroundColor Yellow
}

# Afficher l'URL du repository
Write-Host ""
Write-Host "📋 Informations du repository:" -ForegroundColor Cyan
$repoUrl = "$Region-docker.pkg.dev/$ProjectId/$RepositoryName"
Write-Host "  Repository URL: $repoUrl" -ForegroundColor White
Write-Host "  Image URL: $repoUrl/yukpo-backend:latest" -ForegroundColor White

Write-Host ""
Write-Host "✅ Configuration terminée!" -ForegroundColor Green
Write-Host ""
Write-Host "📝 Prochaines étapes:" -ForegroundColor Yellow
Write-Host "  1. Mettez à jour le workflow GitHub Actions pour utiliser Artifact Registry" -ForegroundColor White
Write-Host "  2. Remplacez 'gcr.io/$ProjectId/yukpo-backend' par '$repoUrl/yukpo-backend'" -ForegroundColor White
Write-Host "  3. Configurez Docker avec: gcloud auth configure-docker $Region-docker.pkg.dev" -ForegroundColor White

