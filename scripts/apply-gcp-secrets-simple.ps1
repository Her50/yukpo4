# Script simplifie pour creer les secrets GCP depuis AWS
param(
    [string]$GcpProjectId = "yukpo-project",
    [string]$GcpRegion = "europe-west1"
)

Write-Host "Creation des secrets GCP..." -ForegroundColor Yellow

# Activer Secret Manager API si necessaire
Write-Host "Verification de l'API Secret Manager..." -ForegroundColor Cyan
gcloud services enable secretmanager.googleapis.com --project=$GcpProjectId | Out-Null

# Recuperer le service account Cloud Run
Write-Host "Recuperation du service account..." -ForegroundColor Cyan
$serviceAccount = gcloud run services describe yukpo-backend `
    --region=$GcpRegion `
    --format="value(spec.template.spec.serviceAccountName)" `
    --project=$GcpProjectId 2>&1

if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrEmpty($serviceAccount)) {
    $serviceAccount = "$GcpProjectId@appspot.gserviceaccount.com"
}

Write-Host "Service Account: $serviceAccount" -ForegroundColor Green
Write-Host ""

# Liste des secrets a creer (vous devrez fournir les valeurs)
$secrets = @(
    @{Name="jwt-secret"; Description="JWT Secret pour authentification"},
    @{Name="database-url"; Description="URL connexion PostgreSQL"},
    @{Name="redis-url"; Description="URL connexion Redis"},
    @{Name="mongodb-url"; Description="URL connexion MongoDB"},
    @{Name="enable-auto-migrations"; Description="Activer migrations auto"}
)

Write-Host "Pour chaque secret, vous devrez entrer la valeur:" -ForegroundColor Yellow
Write-Host ""

foreach ($secret in $secrets) {
    Write-Host "Secret: $($secret.Name)" -ForegroundColor Cyan
    $value = Read-Host "Entrez la valeur (ou appuyez sur Entree pour ignorer)" -AsSecureString
    
    if ($value.Length -gt 0) {
        $plainValue = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
            [Runtime.InteropServices.Marshal]::SecureStringToBSTR($value)
        )
        
        # Verifier si le secret existe
        $exists = gcloud secrets describe $secret.Name --project=$GcpProjectId 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  Secret existe deja, ajout d'une nouvelle version..." -ForegroundColor Yellow
            echo -n $plainValue | gcloud secrets versions add $secret.Name `
                --data-file=- `
                --project=$GcpProjectId 2>&1 | Out-Null
        } else {
            Write-Host "  Creation du secret..." -ForegroundColor Cyan
            echo -n $plainValue | gcloud secrets create $secret.Name `
                --data-file=- `
                --replication-policy="automatic" `
                --project=$GcpProjectId 2>&1 | Out-Null
        }
        
        if ($LASTEXITCODE -eq 0) {
            # Donner acces au service account
            gcloud secrets add-iam-policy-binding $secret.Name `
                --member="serviceAccount:$serviceAccount" `
                --role="roles/secretmanager.secretAccessor" `
                --project=$GcpProjectId 2>&1 | Out-Null
            
            Write-Host "  OK: Secret $($secret.Name) cree" -ForegroundColor Green
        } else {
            Write-Host "  ERREUR: Impossible de creer le secret" -ForegroundColor Red
        }
    } else {
        Write-Host "  Ignore" -ForegroundColor Gray
    }
    Write-Host ""
}

Write-Host "Termine!" -ForegroundColor Green
Write-Host ""
Write-Host "Commandes pour mettre a jour Cloud Run:" -ForegroundColor Yellow
Write-Host "gcloud run services update yukpo-backend \"
Write-Host "  --region=$GcpRegion \"
Write-Host "  --update-secrets='JWT_SECRET=jwt-secret:latest,DATABASE_URL=database-url:latest,REDIS_URL=redis-url:latest,MONGODB_URL=mongodb-url:latest' \"
Write-Host "  --project=$GcpProjectId"

