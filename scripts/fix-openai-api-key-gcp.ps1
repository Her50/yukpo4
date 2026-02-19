# Script pour corriger la configuration OPENAI_API_KEY dans GCP
# Usage: .\scripts\fix-openai-api-key-gcp.ps1

param(
    [string]$GcpProjectId = "yukpo-project",
    [string]$GcpRegion = "europe-west1",
    [string]$GcpServiceName = "yukpo-backend",
    [switch]$DryRun = $false
)

Write-Host ""
Write-Host "CORRECTION CONFIGURATION OPENAI_API_KEY dans GCP" -ForegroundColor Cyan
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host "Projet: $GcpProjectId" -ForegroundColor Yellow
Write-Host "Region: $GcpRegion" -ForegroundColor Yellow
Write-Host "Service: $GcpServiceName" -ForegroundColor Yellow
if ($DryRun) {
    Write-Host "MODE: DRY RUN (aucune modification)" -ForegroundColor Yellow
}
Write-Host ""

# Configuration gcloud
gcloud config set project $GcpProjectId | Out-Null

$secretName = "openai-api-key"

# 1. Recuperer le service account de Cloud Run
Write-Host "1. Recuperation du Service Account..." -ForegroundColor Yellow
$serviceAccountOutput = gcloud run services describe $GcpServiceName --region=$GcpRegion --project=$GcpProjectId --format="value(spec.template.spec.serviceAccountName)" 2>&1
$serviceAccount = $serviceAccountOutput.Trim()

if ($LASTEXITCODE -ne 0 -or -not $serviceAccount -or $serviceAccount -eq "") {
    # Utiliser le service account par defaut
    $serviceAccount = "$GcpProjectId@appspot.gserviceaccount.com"
    Write-Host "   Utilisation du Service Account par defaut: $serviceAccount" -ForegroundColor Gray
} else {
    Write-Host "   Service Account trouve: $serviceAccount" -ForegroundColor Green
}

# 2. Donner l'acces au secret au Service Account
Write-Host ""
Write-Host "2. Attribution des permissions au Service Account..." -ForegroundColor Yellow

if ($DryRun) {
    Write-Host "   [DRY RUN] Commande qui serait executee:" -ForegroundColor Gray
    Write-Host "   gcloud secrets add-iam-policy-binding $secretName --member=serviceAccount:$serviceAccount --role=roles/secretmanager.secretAccessor --project=$GcpProjectId" -ForegroundColor Cyan
} else {
    Write-Host "   Attribution du role secretAccessor..." -ForegroundColor Gray
    $permissionResult = gcloud secrets add-iam-policy-binding $secretName --member="serviceAccount:$serviceAccount" --role="roles/secretmanager.secretAccessor" --project=$GcpProjectId 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   [OK] Permissions attribuees avec succes" -ForegroundColor Green
    } else {
        Write-Host "   [ERREUR] Impossible d'attribuer les permissions" -ForegroundColor Red
        Write-Host "   $permissionResult" -ForegroundColor Red
        exit 1
    }
}

# 3. Ajouter la reference au secret dans Cloud Run
Write-Host ""
Write-Host "3. Ajout de OPENAI_API_KEY dans Cloud Run..." -ForegroundColor Yellow

if ($DryRun) {
    Write-Host "   [DRY RUN] Commande qui serait executee:" -ForegroundColor Gray
    $secretRef = "$secretName:latest"
    Write-Host "   gcloud run services update $GcpServiceName --region=$GcpRegion --project=$GcpProjectId --update-secrets=`"OPENAI_API_KEY=$secretRef`"" -ForegroundColor Cyan
} else {
    Write-Host "   Mise a jour du service Cloud Run..." -ForegroundColor Gray
    
    # Recuperer la version la plus recente du secret
    $versionsOutput = gcloud secrets versions list $secretName --project=$GcpProjectId --format="value(name)" 2>&1
    $latestVersion = ($versionsOutput | Select-Object -First 1).Trim()
    
    if ($latestVersion) {
        # Extraire le numero de version (ex: "projects/.../secrets/.../versions/1" -> "1")
        if ($latestVersion -match "versions/(\d+)$") {
            $versionNumber = $matches[1]
            $secretRef = "$secretName`:$versionNumber"
        } else {
            $secretRef = "$secretName`:latest"
        }
    } else {
        $secretRef = "$secretName`:latest"
    }
    
    Write-Host "   Reference secret: $secretRef" -ForegroundColor Gray
    $updateResult = gcloud run services update $GcpServiceName --region=$GcpRegion --project=$GcpProjectId --update-secrets="OPENAI_API_KEY=$secretRef" 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   [OK] Service Cloud Run mis a jour avec succes" -ForegroundColor Green
        Write-Host "   Le service va etre redeploye automatiquement..." -ForegroundColor Gray
    } else {
        Write-Host "   [ERREUR] Impossible de mettre a jour le service" -ForegroundColor Red
        Write-Host "   $updateResult" -ForegroundColor Red
        exit 1
    }
}

# 4. Verification finale
Write-Host ""
Write-Host "4. Verification finale..." -ForegroundColor Yellow

if (-not $DryRun) {
    Start-Sleep -Seconds 5  # Attendre un peu pour que le service se mette a jour
    
    # Verifier que la variable est bien configuree
    $serviceConfigOutput = gcloud run services describe $GcpServiceName --region=$GcpRegion --project=$GcpProjectId --format=json 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        try {
            $serviceJson = $serviceConfigOutput | ConvertFrom-Json
            $containers = $serviceJson.spec.template.spec.containers
            
            if ($containers -and $containers.Count -gt 0) {
                $container = $containers[0]
                $envVars = $container.env
                
                $openaiVarFound = $false
                foreach ($env in $envVars) {
                    if ($env.name -eq "OPENAI_API_KEY" -and $env.valueFrom -and $env.valueFrom.secretKeyRef) {
                        $openaiVarFound = $true
                        Write-Host "   [OK] OPENAI_API_KEY est maintenant configuree" -ForegroundColor Green
                        Write-Host "      Secret: $($env.valueFrom.secretKeyRef.name)" -ForegroundColor Gray
                        Write-Host "      Version: $($env.valueFrom.secretKeyRef.version)" -ForegroundColor Gray
                        break
                    }
                }
                
                if (-not $openaiVarFound) {
                    Write-Host "   [WARN] OPENAI_API_KEY n'a pas ete trouvee (peut-etre en cours de deploiement)" -ForegroundColor Yellow
                }
            }
        } catch {
            Write-Host "   [WARN] Impossible de verifier la configuration (peut-etre en cours de deploiement)" -ForegroundColor Yellow
        }
    }
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
if ($DryRun) {
    Write-Host "DRY RUN TERMINE - Aucune modification effectuee" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Pour appliquer les corrections, relancez sans -DryRun:" -ForegroundColor Cyan
    Write-Host "   .\scripts\fix-openai-api-key-gcp.ps1" -ForegroundColor White
} else {
    Write-Host "CORRECTIONS APPLIQUEES AVEC SUCCES" -ForegroundColor Green
    Write-Host ""
    Write-Host "Prochaines etapes:" -ForegroundColor Yellow
    Write-Host "   1. Attendre que le service Cloud Run soit redeploye (1-2 minutes)" -ForegroundColor White
    Write-Host "   2. Verifier les logs pour confirmer que OPENAI_API_KEY est chargee" -ForegroundColor White
    Write-Host "   3. Tester la creation d'un produit avec l'IA" -ForegroundColor White
    Write-Host ""
    Write-Host "Pour voir les logs en temps reel:" -ForegroundColor Cyan
    $logCommand = "gcloud logging tail `"resource.type=cloud_run_revision AND resource.labels.service_name=$GcpServiceName`" --project=$GcpProjectId"
    Write-Host "   $logCommand" -ForegroundColor Gray
}
Write-Host ""

