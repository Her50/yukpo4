# Script pour creer les secrets GCP depuis GitHub Secrets
# Usage: .\scripts\create-gcp-secrets-from-github.ps1

param(
    [string]$GcpProjectId = "yukpo-project",
    [string]$GcpRegion = "europe-west1"
)

Write-Host "Creation des secrets GCP depuis GitHub Secrets..." -ForegroundColor Yellow
Write-Host ""

# Activer Secret Manager API
Write-Host "Verification de l'API Secret Manager..." -ForegroundColor Cyan
gcloud services enable secretmanager.googleapis.com --project=$GcpProjectId | Out-Null

# Recuperer le service account
$serviceAccount = gcloud run services describe yukpo-backend `
    --region=$GcpRegion `
    --format="value(spec.template.spec.serviceAccountName)" `
    --project=$GcpProjectId 2>&1

if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrEmpty($serviceAccount)) {
    $serviceAccount = "$GcpProjectId@appspot.gserviceaccount.com"
}

Write-Host "Service Account: $serviceAccount" -ForegroundColor Green
Write-Host ""

# Fonction pour creer un secret
function Create-Secret {
    param(
        [string]$SecretName,
        [string]$SecretValue,
        [string]$Description = ""
    )
    
    if ([string]::IsNullOrEmpty($SecretValue)) {
        Write-Host "  Ignore: $SecretName (valeur vide)" -ForegroundColor Gray
        return $false
    }
    
    Write-Host "  Creation: $SecretName" -ForegroundColor Cyan
    
    # Verifier si existe
    $exists = gcloud secrets describe $SecretName --project=$GcpProjectId 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "    Secret existe, ajout nouvelle version..." -ForegroundColor Yellow
        echo -n $SecretValue | gcloud secrets versions add $SecretName `
            --data-file=- `
            --project=$GcpProjectId 2>&1 | Out-Null
    } else {
        if ([string]::IsNullOrEmpty($Description)) {
            $Description = "Secret migre depuis GitHub - $SecretName"
        }
        echo -n $SecretValue | gcloud secrets create $SecretName `
            --data-file=- `
            --replication-policy="automatic" `
            --project=$GcpProjectId 2>&1 | Out-Null
    }
    
    if ($LASTEXITCODE -eq 0) {
        # Permissions
        gcloud secrets add-iam-policy-binding $SecretName `
            --member="serviceAccount:$serviceAccount" `
            --role="roles/secretmanager.secretAccessor" `
            --project=$GcpProjectId 2>&1 | Out-Null
        
        Write-Host "    OK: Secret $SecretName cree" -ForegroundColor Green
        return $true
    } else {
        Write-Host "    ERREUR: Impossible de creer $SecretName" -ForegroundColor Red
        return $false
    }
}

# Liste des secrets a creer (depuis GitHub Secrets avec prefixe GCP_ENV_)
Write-Host "Recuperation des secrets depuis GitHub..." -ForegroundColor Cyan

# Secrets critiques a creer (vous devrez les creer manuellement dans GitHub d'abord)
$secretsToCreate = @(
    @{Name="jwt-secret"; GitHubSecret="GCP_ENV_JWT_SECRET"; Description="JWT Secret"},
    @{Name="database-url"; GitHubSecret="GCP_ENV_DATABASE_URL"; Description="Database URL"},
    @{Name="redis-url"; GitHubSecret="GCP_ENV_REDIS_URL"; Description="Redis URL"},
    @{Name="mongodb-url"; GitHubSecret="GCP_ENV_MONGODB_URL"; Description="MongoDB URL"}
)

Write-Host ""
Write-Host "IMPORTANT: Les secrets doivent etre crees dans GitHub Secrets avec le prefixe GCP_ENV_" -ForegroundColor Yellow
Write-Host "Exemple: GCP_ENV_JWT_SECRET, GCP_ENV_DATABASE_URL, etc." -ForegroundColor Yellow
Write-Host ""
Write-Host "Pour creer les secrets manuellement dans GCP Secret Manager:" -ForegroundColor Cyan
Write-Host ""

foreach ($secret in $secretsToCreate) {
    Write-Host "gcloud secrets create $($secret.Name) \"
    Write-Host "  --data-file=- \"
    Write-Host "  --replication-policy=automatic \"
    Write-Host "  --project=$GcpProjectId"
    Write-Host ""
    Write-Host "# Puis donner acces:"
    Write-Host "gcloud secrets add-iam-policy-binding $($secret.Name) \"
    Write-Host "  --member=serviceAccount:$serviceAccount \"
    Write-Host "  --role=roles/secretmanager.secretAccessor \"
    Write-Host "  --project=$GcpProjectId"
    Write-Host ""
}

Write-Host "Commandes pour mettre a jour Cloud Run avec les secrets:" -ForegroundColor Yellow
Write-Host "gcloud run services update yukpo-backend \"
Write-Host "  --region=$GcpRegion \"
Write-Host "  --update-secrets='JWT_SECRET=jwt-secret:latest,DATABASE_URL=database-url:latest,REDIS_URL=redis-url:latest,MONGODB_URL=mongodb-url:latest' \"
Write-Host "  --update-env-vars='GPU_ENABLED=true,GPU_ENDPOINT=http://yukpo-gpu-workers:8080,GPU_ZONE=europe-west1-b,GPU_INSTANCE_NAME=yukpo-gpu-worker,GCP_PROJECT_ID=$GcpProjectId,GPU_MONTHLY_BUDGET=100.0,GPU_SCALE_UP_THRESHOLD=70.0,GPU_SCALE_DOWN_THRESHOLD=20.0,GPU_MAX_INSTANCES=3,GPU_MIN_INSTANCES=0' \"
Write-Host "  --project=$GcpProjectId"

