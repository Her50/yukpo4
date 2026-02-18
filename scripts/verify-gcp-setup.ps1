# Script de Verification - Configuration GCP Complete
# Verifie que tous les secrets, permissions et configurations sont en place

param(
    [string]$ProjectId = "yukpo-project",
    [string]$ServiceName = "yukpo-backend",
    [string]$Region = "europe-west1",
    [string]$CloudSqlInstance = "yukpo-postgres"
)

Write-Host "Verification Configuration GCP Complete" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$allGood = $true

# 1. Verifier les secrets
Write-Host "1. Verification des secrets dans Secret Manager..." -ForegroundColor Yellow
$requiredSecrets = @("jwt-secret", "database-url", "redis-url", "mongodb-url")

foreach ($secretName in $requiredSecrets) {
    try {
        $secretInfo = gcloud secrets describe $secretName --project=$ProjectId 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "   [OK] Secret $secretName existe" -ForegroundColor Green
        } else {
            Write-Host "   [ERREUR] Secret $secretName manquant!" -ForegroundColor Red
            Write-Host "      Creez-le avec: echo -n 'VALEUR' | gcloud secrets create $secretName --data-file=- --project=$ProjectId" -ForegroundColor Yellow
            $allGood = $false
        }
    } catch {
        Write-Host "   [ERREUR] Erreur lors de la verification du secret $secretName" -ForegroundColor Red
        $allGood = $false
    }
}

# 2. Verifier le service account et ses permissions
Write-Host ""
Write-Host "2. Verification du service account et permissions IAM..." -ForegroundColor Yellow
try {
    $serviceAccount = gcloud run services describe $ServiceName `
        --region=$Region `
        --project=$ProjectId `
        --format="value(spec.template.spec.serviceAccountName)" 2>&1
    
    if ($LASTEXITCODE -eq 0 -and $serviceAccount) {
        Write-Host "   [OK] Service account: $serviceAccount" -ForegroundColor Green
        
        # Verifier les permissions
        $iamPolicy = gcloud projects get-iam-policy $ProjectId `
            --flatten="bindings[].members" `
            --filter="bindings.members:serviceAccount:$serviceAccount" 2>&1
        
        $hasCloudSql = $iamPolicy -match "cloudsql.client"
        $hasSecretAccessor = $iamPolicy -match "secretmanager.secretAccessor"
        
        if ($hasCloudSql) {
            Write-Host "   [OK] Permission cloudsql.client accordee" -ForegroundColor Green
        } else {
            Write-Host "   [ERREUR] Permission cloudsql.client manquante!" -ForegroundColor Red
            Write-Host "      Accordez-la avec: gcloud projects add-iam-policy-binding $ProjectId --member='serviceAccount:$serviceAccount' --role='roles/cloudsql.client'" -ForegroundColor Yellow
            $allGood = $false
        }
        
        if ($hasSecretAccessor) {
            Write-Host "   [OK] Permission secretmanager.secretAccessor accordee" -ForegroundColor Green
        } else {
            Write-Host "   [ERREUR] Permission secretmanager.secretAccessor manquante!" -ForegroundColor Red
            Write-Host "      Accordez-la avec: gcloud projects add-iam-policy-binding $ProjectId --member='serviceAccount:$serviceAccount' --role='roles/secretmanager.secretAccessor'" -ForegroundColor Yellow
            $allGood = $false
        }
    } else {
        Write-Host "   [ATTENTION] Service account non configure explicitement" -ForegroundColor Yellow
        Write-Host "      Le service utilise le compte par defaut (compute@...)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   [ERREUR] Erreur lors de la verification du service account" -ForegroundColor Red
    $allGood = $false
}

# 3. Verifier l'instance Cloud SQL
Write-Host ""
Write-Host "3. Verification de l'instance Cloud SQL..." -ForegroundColor Yellow
try {
    $sqlInfo = gcloud sql instances describe $CloudSqlInstance --project=$ProjectId 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   [OK] Instance Cloud SQL $CloudSqlInstance existe" -ForegroundColor Green
        
        $sqlState = gcloud sql instances describe $CloudSqlInstance `
            --project=$ProjectId `
            --format="value(state)" 2>&1
        
        if ($sqlState -eq "RUNNABLE") {
            Write-Host "   [OK] Instance en etat RUNNABLE" -ForegroundColor Green
        } else {
            Write-Host "   [ATTENTION] Instance en etat: $sqlState" -ForegroundColor Yellow
        }
    } else {
        Write-Host "   [ERREUR] Instance Cloud SQL $CloudSqlInstance non trouvee!" -ForegroundColor Red
        Write-Host "      Creez l'instance avec: gcloud sql instances create $CloudSqlInstance ..." -ForegroundColor Yellow
        $allGood = $false
    }
} catch {
    Write-Host "   [ERREUR] Erreur lors de la verification de Cloud SQL" -ForegroundColor Red
    $allGood = $false
}

# 4. Verifier la connexion Cloud SQL dans Cloud Run
Write-Host ""
Write-Host "4. Verification de la connexion Cloud SQL dans Cloud Run..." -ForegroundColor Yellow
try {
    $cloudSqlConnection = gcloud run services describe $ServiceName `
        --region=$Region `
        --project=$ProjectId `
        --format="value(spec.template.metadata.annotations.'run.googleapis.com/cloudsql-instances')" 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        if ($cloudSqlConnection) {
            Write-Host "   [OK] Connexion Cloud SQL configuree: $cloudSqlConnection" -ForegroundColor Green
            
            $expectedConnection = "$ProjectId`:$Region`:$CloudSqlInstance"
            if ($cloudSqlConnection -eq $expectedConnection) {
                Write-Host "   [OK] Instance correcte" -ForegroundColor Green
            } else {
                Write-Host "   [ATTENTION] Instance differente de celle attendue" -ForegroundColor Yellow
                Write-Host "      Attendu: $expectedConnection" -ForegroundColor Yellow
                Write-Host "      Trouve: $cloudSqlConnection" -ForegroundColor Yellow
            }
        } else {
            Write-Host "   [ERREUR] Aucune connexion Cloud SQL configuree!" -ForegroundColor Red
            Write-Host "      Ajoutez-la avec: gcloud run services update $ServiceName --add-cloudsql-instances=$ProjectId`:$Region`:$CloudSqlInstance --region=$Region --project=$ProjectId" -ForegroundColor Yellow
            $allGood = $false
        }
    } else {
        Write-Host "   [ERREUR] Erreur lors de la verification" -ForegroundColor Red
        $allGood = $false
    }
} catch {
    Write-Host "   [ERREUR] Erreur lors de la verification" -ForegroundColor Red
    $allGood = $false
}

# Resume
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
if ($allGood) {
    Write-Host "[OK] Toutes les verifications sont passees!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Vous pouvez maintenant deployer l'application:" -ForegroundColor Cyan
    Write-Host "   git push origin main" -ForegroundColor Gray
    exit 0
} else {
    Write-Host "[ERREUR] Certaines verifications ont echoue!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Corrigez les problemes ci-dessus avant de deployer." -ForegroundColor Yellow
    exit 1
}
