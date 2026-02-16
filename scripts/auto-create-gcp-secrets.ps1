# Script automatique pour creer les secrets GCP depuis GitHub Secrets
param(
    [string]$GcpProjectId = "yukpo-project",
    [string]$GcpRegion = "europe-west1"
)

Write-Host "Creation automatique des secrets GCP..." -ForegroundColor Yellow
Write-Host ""

# Activer Secret Manager API
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

# Mapping GitHub Secrets -> GCP Secrets
# Essayer d'abord GCP_ENV_*, puis les secrets directs
$secretsMapping = @{
    "GCP_ENV_JWT_SECRET" = @("jwt-secret", "JWT_SECRET")
    "GCP_DATABASE_URL" = @("database-url", "DATABASE_URL")
    "GCP_ENV_DATABASE_URL" = @("database-url", "DATABASE_URL")
    "GCP_ENV_REDIS_URL" = @("redis-url", "REDIS_URL")
    "GCP_ENV_MONGODB_URL" = @("mongodb-url", "MONGODB_URL")
}

# Fonction pour creer un secret
function Create-GcpSecretFromGitHub {
    param(
        [string]$GitHubSecretName,
        [string]$GcpSecretName,
        [string]$Description = ""
    )
    
    Write-Host "Recuperation: $GitHubSecretName -> $GcpSecretName" -ForegroundColor Cyan
    
    # Recuperer depuis GitHub Secrets
    if (Get-Command gh -ErrorAction SilentlyContinue) {
        $value = gh secret get $GitHubSecretName --repo Her50/yukpo4 2>&1
        
        if ($LASTEXITCODE -eq 0 -and $value -and $value.Length -gt 0) {
            Write-Host "  Valeur recuperee depuis GitHub" -ForegroundColor Green
            
            # Verifier si le secret existe
            $exists = gcloud secrets describe $GcpSecretName --project=$GcpProjectId 2>&1
            if ($LASTEXITCODE -eq 0) {
                Write-Host "  Secret existe, ajout nouvelle version..." -ForegroundColor Yellow
                echo -n $value | gcloud secrets versions add $GcpSecretName `
                    --data-file=- `
                    --project=$GcpProjectId 2>&1 | Out-Null
            } else {
                if ([string]::IsNullOrEmpty($Description)) {
                    $Description = "Migre depuis GitHub - $GitHubSecretName"
                }
                echo -n $value | gcloud secrets create $GcpSecretName `
                    --data-file=- `
                    --replication-policy="automatic" `
                    --project=$GcpProjectId 2>&1 | Out-Null
            }
            
            if ($LASTEXITCODE -eq 0) {
                # Permissions
                gcloud secrets add-iam-policy-binding $GcpSecretName `
                    --member="serviceAccount:$serviceAccount" `
                    --role="roles/secretmanager.secretAccessor" `
                    --project=$GcpProjectId 2>&1 | Out-Null
                
                Write-Host "  OK: Secret $GcpSecretName cree" -ForegroundColor Green
                return $true
            } else {
                Write-Host "  ERREUR: Impossible de creer $GcpSecretName" -ForegroundColor Red
                return $false
            }
        } else {
            Write-Host "  AVERTISSEMENT: Secret GitHub $GitHubSecretName non trouve ou vide" -ForegroundColor Yellow
            return $false
        }
    } else {
        Write-Host "  ERREUR: GitHub CLI (gh) non installe" -ForegroundColor Red
        Write-Host "  Installez-le depuis: https://cli.github.com/" -ForegroundColor Yellow
        return $false
    }
}

# Creer tous les secrets
$created = 0
$createdSecrets = @{}

foreach ($gitHubSecret in $secretsMapping.Keys) {
    $mapping = $secretsMapping[$gitHubSecret]
    $gcpSecretName = $mapping[0]
    $envVarName = $mapping[1]
    
    # Essayer ce secret GitHub
    if (Create-GcpSecretFromGitHub -GitHubSecretName $gitHubSecret -GcpSecretName $gcpSecretName) {
        $created++
        $createdSecrets[$envVarName] = $gcpSecretName
    }
    Write-Host ""
}

Write-Host "Resume: $created secret(s) cree(s)" -ForegroundColor $(if ($created -gt 0) { "Green" } else { "Yellow" })
Write-Host ""

# Mettre a jour Cloud Run
if ($created -gt 0) {
    Write-Host "Mise a jour de Cloud Run..." -ForegroundColor Cyan
    $secretsList = @()
    foreach ($envVar in $createdSecrets.Keys) {
        $secretName = $createdSecrets[$envVar]
        $secretsList += "$envVar=$secretName:latest"
    }
    $secretsStr = $secretsList -join ","
    
    Write-Host "  Secrets a ajouter: $secretsStr" -ForegroundColor Cyan
    
    gcloud run services update yukpo-backend `
        --region=$GcpRegion `
        --update-secrets=$secretsStr `
        --project=$GcpProjectId 2>&1 | Out-Null
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "OK: Cloud Run mis a jour" -ForegroundColor Green
    } else {
        Write-Host "ERREUR: Impossible de mettre a jour Cloud Run" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "Termine!" -ForegroundColor Green

