# Script de Correction - Configuration GCP
# Corrige automatiquement les problemes identifies

param(
    [string]$ProjectId = "yukpo-project",
    [string]$ServiceName = "yukpo-backend",
    [string]$Region = "europe-west1",
    [string]$CloudSqlInstance = "yukpo-postgres"
)

Write-Host "Correction Configuration GCP" -ForegroundColor Cyan
Write-Host "============================" -ForegroundColor Cyan
Write-Host ""

# 1. Accorder la permission secretmanager.secretAccessor
Write-Host "1. Attribution de la permission secretmanager.secretAccessor..." -ForegroundColor Yellow

try {
    $serviceAccount = gcloud run services describe $ServiceName `
        --region=$Region `
        --project=$ProjectId `
        --format="value(spec.template.spec.serviceAccountName)" 2>&1
    
    if ($LASTEXITCODE -eq 0 -and $serviceAccount) {
        Write-Host "   Service account: $serviceAccount" -ForegroundColor Gray
        
        # Verifier si la permission existe deja
        $iamPolicy = gcloud projects get-iam-policy $ProjectId `
            --flatten="bindings[].members" `
            --filter="bindings.members:serviceAccount:$serviceAccount" 2>&1
        
        if ($iamPolicy -match "secretmanager.secretAccessor") {
            Write-Host "   [OK] Permission deja accordee" -ForegroundColor Green
        } else {
            Write-Host "   Attribution de la permission..." -ForegroundColor Yellow
            gcloud projects add-iam-policy-binding $ProjectId `
                --member="serviceAccount:$serviceAccount" `
                --role="roles/secretmanager.secretAccessor" `
                --project=$ProjectId 2>&1 | Out-Null
            
            if ($LASTEXITCODE -eq 0) {
                Write-Host "   [OK] Permission accordee avec succes" -ForegroundColor Green
            } else {
                Write-Host "   [ERREUR] Echec de l'attribution de la permission" -ForegroundColor Red
                exit 1
            }
        }
    } else {
        Write-Host "   [ERREUR] Impossible de recuperer le service account" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "   [ERREUR] Erreur lors de l'attribution de la permission: $_" -ForegroundColor Red
    exit 1
}

# 2. Ajouter la connexion Cloud SQL dans Cloud Run
Write-Host ""
Write-Host "2. Ajout de la connexion Cloud SQL dans Cloud Run..." -ForegroundColor Yellow

try {
    $cloudSqlConnection = "$ProjectId`:$Region`:$CloudSqlInstance"
    Write-Host "   Instance Cloud SQL: $cloudSqlConnection" -ForegroundColor Gray
    
    # Verifier si la connexion existe deja
    $existingConnection = gcloud run services describe $ServiceName `
        --region=$Region `
        --project=$ProjectId `
        --format="value(spec.template.metadata.annotations.'run.googleapis.com/cloudsql-instances')" 2>&1
    
    if ($LASTEXITCODE -eq 0 -and $existingConnection -eq $cloudSqlConnection) {
        Write-Host "   [OK] Connexion Cloud SQL deja configuree" -ForegroundColor Green
    } else {
        Write-Host "   Ajout de la connexion Cloud SQL..." -ForegroundColor Yellow
        gcloud run services update $ServiceName `
            --add-cloudsql-instances=$cloudSqlConnection `
            --region=$Region `
            --project=$ProjectId 2>&1 | Out-Null
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "   [OK] Connexion Cloud SQL ajoutee avec succes" -ForegroundColor Green
        } else {
            Write-Host "   [ERREUR] Echec de l'ajout de la connexion Cloud SQL" -ForegroundColor Red
            exit 1
        }
    }
} catch {
    Write-Host "   [ERREUR] Erreur lors de l'ajout de la connexion Cloud SQL: $_" -ForegroundColor Red
    exit 1
}

# Resume
Write-Host ""
Write-Host "============================" -ForegroundColor Cyan
Write-Host "[OK] Corrections appliquees avec succes!" -ForegroundColor Green
Write-Host ""
Write-Host "Verifiez la configuration avec:" -ForegroundColor Cyan
Write-Host "   .\scripts\verify-gcp-setup.ps1" -ForegroundColor Gray

