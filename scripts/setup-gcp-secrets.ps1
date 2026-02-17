# Script PowerShell pour créer les secrets GCP dans Secret Manager
# Usage: .\scripts\setup-gcp-secrets.ps1

param(
    [string]$ProjectId = "yukpo-project",
    [string]$Region = "europe-west1",
    [string]$ServiceAccountEmail = ""
)

Write-Host "🔐 Configuration des secrets GCP Secret Manager..." -ForegroundColor Yellow
Write-Host ""

# Vérifier que gcloud est installé
if (-not (Get-Command gcloud -ErrorAction SilentlyContinue)) {
    Write-Host "❌ ERREUR: gcloud CLI n'est pas installé" -ForegroundColor Red
    Write-Host "   Installez-le depuis: https://cloud.google.com/sdk/docs/install" -ForegroundColor Yellow
    exit 1
}

# Vérifier l'authentification
Write-Host "🔍 Vérification de l'authentification GCP..." -ForegroundColor Cyan
$authStatus = gcloud auth list --filter=status:ACTIVE --format="value(account)" 2>&1
if (-not $authStatus) {
    Write-Host "⚠️  Vous n'êtes pas authentifié. Exécution de gcloud auth login..." -ForegroundColor Yellow
    gcloud auth login
}

Write-Host "✅ Authentifié: $authStatus" -ForegroundColor Green
Write-Host ""

# Définir le projet
Write-Host "🔧 Configuration du projet: $ProjectId" -ForegroundColor Cyan
gcloud config set project $ProjectId
Write-Host ""

# Récupérer le service account si non fourni
if ([string]::IsNullOrEmpty($ServiceAccountEmail)) {
    Write-Host "🔍 Récupération du service account Cloud Run..." -ForegroundColor Cyan
    $ServiceAccountEmail = gcloud run services describe yukpo-backend `
        --region=$Region `
        --format="value(spec.template.spec.serviceAccountName)" `
        --project=$ProjectId 2>&1
    
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrEmpty($ServiceAccountEmail)) {
        Write-Host "⚠️  Service account non trouvé, utilisation du compte par défaut" -ForegroundColor Yellow
        $ServiceAccountEmail = "$ProjectId@appspot.gserviceaccount.com"
    }
}

Write-Host "✅ Service Account: $ServiceAccountEmail" -ForegroundColor Green
Write-Host ""

# Fonction pour créer un secret
function Create-Secret {
    param(
        [string]$SecretName,
        [string]$Description,
        [string]$SecretValue
    )
    
    Write-Host "🔐 Création du secret: $SecretName" -ForegroundColor Cyan
    
    # Vérifier si le secret existe déjà
    $existing = gcloud secrets describe $SecretName --project=$ProjectId 2>&1
    # ✅ CORRECTION: Utiliser un fichier temporaire pour éviter les retours à la ligne
    # echo -n ne fonctionne pas dans PowerShell (le -n est ignoré)
    $tempFile = [System.IO.Path]::GetTempFileName()
    try {
        [System.IO.File]::WriteAllText($tempFile, $SecretValue, [System.Text.Encoding]::UTF8)
        if ($LASTEXITCODE -eq 0) {
            Write-Host "⚠️  Le secret $SecretName existe déjà" -ForegroundColor Yellow
            $update = Read-Host "Voulez-vous le mettre à jour? (o/N)"
            if ($update -eq "o" -or $update -eq "O") {
                Write-Host "📝 Mise à jour du secret $SecretName..." -ForegroundColor Cyan
                gcloud secrets versions add $SecretName `
                    --data-file=$tempFile `
                    --project=$ProjectId
                Write-Host "✅ Secret $SecretName mis à jour" -ForegroundColor Green
            } else {
                Write-Host "⏭️  Secret $SecretName ignoré" -ForegroundColor Yellow
                return
            }
        } else {
            # Créer le secret
            gcloud secrets create $SecretName `
                --data-file=$tempFile `
                --replication-policy="automatic" `
                --project=$ProjectId
        }
    } finally {
        if (Test-Path $tempFile) {
            Remove-Item $tempFile -Force
        }
    }
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Secret $SecretName créé" -ForegroundColor Green
        } else {
            Write-Host "❌ Erreur lors de la création du secret $SecretName" -ForegroundColor Red
            return
        }
    }
    
    # Donner accès au service account
    Write-Host "🔑 Attribution des permissions au service account..." -ForegroundColor Cyan
    gcloud secrets add-iam-policy-binding $SecretName `
        --member="serviceAccount:$ServiceAccountEmail" `
        --role="roles/secretmanager.secretAccessor" `
        --project=$ProjectId
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Permissions accordées pour $SecretName" -ForegroundColor Green
    } else {
        Write-Host "❌ Erreur lors de l'attribution des permissions" -ForegroundColor Red
    }
    Write-Host ""
}

# Demander les valeurs des secrets
Write-Host "📝 Saisie des secrets (les valeurs ne seront pas affichées)" -ForegroundColor Yellow
Write-Host ""

# JWT_SECRET
$jwtSecret = Read-Host "Entrez la valeur de JWT_SECRET" -AsSecureString
$jwtSecretPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
    [Runtime.InteropServices.Marshal]::SecureStringToBSTR($jwtSecret)
)

if (-not [string]::IsNullOrEmpty($jwtSecretPlain)) {
    Create-Secret -SecretName "jwt-secret" `
        -Description "JWT Secret pour l'authentification" `
        -SecretValue $jwtSecretPlain
}

# DATABASE_URL (optionnel)
$dbUrl = Read-Host "Entrez la valeur de DATABASE_URL (ou appuyez sur Entrée pour ignorer)" -AsSecureString
if ($dbUrl.Length -gt 0) {
    $dbUrlPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
        [Runtime.InteropServices.Marshal]::SecureStringToBSTR($dbUrl)
    )
    if (-not [string]::IsNullOrEmpty($dbUrlPlain)) {
        Create-Secret -SecretName "database-url" `
            -Description "URL de connexion PostgreSQL" `
            -SecretValue $dbUrlPlain
    }
}

# MONGODB_URL (optionnel)
$mongoUrl = Read-Host "Entrez la valeur de MONGODB_URL (ou appuyez sur Entrée pour ignorer)" -AsSecureString
if ($mongoUrl.Length -gt 0) {
    $mongoUrlPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
        [Runtime.InteropServices.Marshal]::SecureStringToBSTR($mongoUrl)
    )
    if (-not [string]::IsNullOrEmpty($mongoUrlPlain)) {
        Create-Secret -SecretName "mongodb-url" `
            -Description "URL de connexion MongoDB" `
            -SecretValue $mongoUrlPlain
    }
}

# REDIS_URL (optionnel)
$redisUrl = Read-Host "Entrez la valeur de REDIS_URL (ou appuyez sur Entrée pour ignorer)" -AsSecureString
if ($redisUrl.Length -gt 0) {
    $redisUrlPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
        [Runtime.InteropServices.Marshal]::SecureStringToBSTR($redisUrl)
    )
    if (-not [string]::IsNullOrEmpty($redisUrlPlain)) {
        Create-Secret -SecretName "redis-url" `
            -Description "URL de connexion Redis" `
            -SecretValue $redisUrlPlain
    }
}

Write-Host ""
Write-Host "✅ Configuration terminée!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Prochaines étapes:" -ForegroundColor Yellow
Write-Host "1. Mettre à jour Cloud Run pour référencer les secrets:" -ForegroundColor White
Write-Host "   gcloud run services update yukpo-backend \"
Write-Host "     --region=$Region \"
Write-Host "     --update-secrets='JWT_SECRET=jwt-secret:latest' \"
Write-Host "     --project=$ProjectId"
Write-Host ""
Write-Host "2. Ou utiliser la console GCP:" -ForegroundColor White
Write-Host "   Cloud Run → yukpo-backend → Modifier → Variables et secrets"
Write-Host "   → Ajouter une variable → Référencer un secret"
Write-Host ""

