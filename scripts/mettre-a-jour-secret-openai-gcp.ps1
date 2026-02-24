# Script pour mettre à jour le secret OpenAI dans GCP Secret Manager
# Usage: .\scripts\mettre-a-jour-secret-openai-gcp.ps1 -ApiKey "sk-proj-..."

param(
    [Parameter(Mandatory=$true)]
    [string]$ApiKey,
    [string]$GcpProjectId = "yukpo-project",
    [string]$SecretName = "openai-api-key",
    [switch]$UpdateCloudRun = $true,
    [string]$GcpServiceName = "yukpo-backend",
    [string]$GcpRegion = "europe-west1"
)

Write-Host ""
Write-Host "🔧 MISE À JOUR SECRET OPENAI - GCP" -ForegroundColor Cyan
Write-Host "===================================" -ForegroundColor Cyan
Write-Host "Projet: $GcpProjectId" -ForegroundColor Yellow
Write-Host "Secret: $SecretName" -ForegroundColor Yellow
Write-Host ""

# Validation de la clé API
if ($ApiKey.Length -lt 20) {
    Write-Host "❌ ERREUR: Clé API trop courte ($($ApiKey.Length) caractères)" -ForegroundColor Red
    Write-Host "   Une clé OpenAI valide doit faire au moins 50 caractères" -ForegroundColor Red
    exit 1
}

if (-not ($ApiKey -match "^sk-")) {
    Write-Host "❌ ERREUR: Clé API invalide (ne commence pas par 'sk-')" -ForegroundColor Red
    Write-Host "   Format attendu: sk-proj-... ou sk-..." -ForegroundColor Red
    exit 1
}

Write-Host "✅ Clé API valide (longueur: $($ApiKey.Length) caractères)" -ForegroundColor Green
Write-Host ""

# Configuration gcloud
gcloud config set project $GcpProjectId | Out-Null

# Vérifier si le secret existe
Write-Host "1️⃣  Vérification du secret..." -ForegroundColor Yellow
$secretExists = gcloud secrets describe $SecretName --project=$GcpProjectId 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "   ⚠️  Secret n'existe pas, création..." -ForegroundColor Yellow
    $createResult = gcloud secrets create $SecretName --project=$GcpProjectId 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "   ❌ Erreur lors de la création du secret" -ForegroundColor Red
        Write-Host "   $createResult" -ForegroundColor Red
        exit 1
    }
    Write-Host "   ✅ Secret créé" -ForegroundColor Green
} else {
    Write-Host "   ✅ Secret existe" -ForegroundColor Green
}

# Ajouter une nouvelle version du secret
Write-Host ""
Write-Host "2️⃣  Ajout d'une nouvelle version du secret..." -ForegroundColor Yellow
$ApiKey | gcloud secrets versions add $SecretName --data-file=- --project=$GcpProjectId 2>&1 | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-Host "   ✅ Secret mis à jour avec succès" -ForegroundColor Green
} else {
    Write-Host "   ❌ Erreur lors de la mise à jour du secret" -ForegroundColor Red
    exit 1
}

# Vérifier les permissions IAM
Write-Host ""
Write-Host "3️⃣  Vérification des permissions IAM..." -ForegroundColor Yellow
$serviceAccount = gcloud run services describe $GcpServiceName --region=$GcpRegion --project=$GcpProjectId --format="value(spec.template.spec.serviceAccountName)" 2>&1
if ($LASTEXITCODE -eq 0 -and $serviceAccount) {
    Write-Host "   Service Account: $serviceAccount" -ForegroundColor Cyan
    
    $iamPolicy = gcloud secrets get-iam-policy $SecretName --project=$GcpProjectId --format=json 2>&1 | ConvertFrom-Json
    $hasAccess = $false
    if ($LASTEXITCODE -eq 0) {
        foreach ($binding in $iamPolicy.bindings) {
            if ($binding.role -eq "roles/secretmanager.secretAccessor") {
                foreach ($member in $binding.members) {
                    if ($member -eq "serviceAccount:$serviceAccount") {
                        $hasAccess = $true
                        break
                    }
                }
            }
        }
    }
    
    if (-not $hasAccess) {
        Write-Host "   ⚠️  Service Account n'a pas accès, attribution des permissions..." -ForegroundColor Yellow
        $permissionResult = gcloud secrets add-iam-policy-binding $SecretName --member="serviceAccount:$serviceAccount" --role="roles/secretmanager.secretAccessor" --project=$GcpProjectId 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "   ✅ Permissions attribuées" -ForegroundColor Green
        } else {
            Write-Host "   ⚠️  Erreur lors de l'attribution des permissions (peut être déjà configuré)" -ForegroundColor Yellow
        }
    } else {
        Write-Host "   ✅ Permissions déjà configurées" -ForegroundColor Green
    }
} else {
    Write-Host "   ⚠️  Impossible de récupérer le Service Account" -ForegroundColor Yellow
}

# Mettre à jour Cloud Run si demandé
if ($UpdateCloudRun) {
    Write-Host ""
    Write-Host "4️⃣  Mise à jour de Cloud Run..." -ForegroundColor Yellow
    
    # Vérifier si OPENAI_API_KEY est déjà configurée
    $serviceConfig = gcloud run services describe $GcpServiceName --region=$GcpRegion --project=$GcpProjectId --format=json 2>&1 | ConvertFrom-Json
    $needsUpdate = $true
    if ($LASTEXITCODE -eq 0) {
        $containers = $serviceConfig.spec.template.spec.containers
        if ($containers -and $containers.Count -gt 0) {
            $container = $containers[0]
            $envVars = $container.env
            foreach ($env in $envVars) {
                if ($env.name -eq "OPENAI_API_KEY" -and $env.valueFrom -and $env.valueFrom.secretKeyRef) {
                    $needsUpdate = $false
                    Write-Host "   ✅ OPENAI_API_KEY est déjà configurée" -ForegroundColor Green
                    break
                }
            }
        }
    }
    
    if ($needsUpdate) {
        Write-Host "   🔧 Ajout de OPENAI_API_KEY dans Cloud Run..." -ForegroundColor Yellow
        $updateResult = gcloud run services update $GcpServiceName --region=$GcpRegion --project=$GcpProjectId --update-secrets="OPENAI_API_KEY=$SecretName`:latest" 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "   ✅ Cloud Run mis à jour avec succès" -ForegroundColor Green
            Write-Host "   ⏳ Le service va être redéployé automatiquement (1-2 minutes)" -ForegroundColor Yellow
        } else {
            Write-Host "   ⚠️  Erreur lors de la mise à jour de Cloud Run" -ForegroundColor Yellow
            Write-Host "   $updateResult" -ForegroundColor Yellow
        }
    }
}

# Vérification finale
Write-Host ""
Write-Host "5️⃣  Vérification finale..." -ForegroundColor Yellow
$secretValue = gcloud secrets versions access latest --secret=$SecretName --project=$GcpProjectId 2>&1
if ($LASTEXITCODE -eq 0) {
    $keyLength = $secretValue.Trim().Length
    $keyPrefix = if ($keyLength -gt 10) { $secretValue.Trim().Substring(0, 10) } else { $secretValue.Trim() }
    Write-Host "   ✅ Secret vérifié (longueur: $keyLength, préfixe: $keyPrefix...)" -ForegroundColor Green
} else {
    Write-Host "   ⚠️  Impossible de vérifier le secret" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "✅ MISE À JOUR TERMINÉE" -ForegroundColor Green
Write-Host ""
Write-Host "Prochaines étapes:" -ForegroundColor Yellow
Write-Host "   1. Attendre le redéploiement de Cloud Run (1-2 minutes)" -ForegroundColor White
Write-Host "   2. Vérifier les logs pour confirmer que OPENAI_API_KEY est chargée:" -ForegroundColor White
Write-Host "      gcloud logging tail `"resource.type=cloud_run_revision AND resource.labels.service_name=$GcpServiceName`" --project=$GcpProjectId" -ForegroundColor Gray
Write-Host "   3. Tester la création d'un produit" -ForegroundColor White
Write-Host ""
Write-Host "Pour diagnostiquer les problèmes:" -ForegroundColor Cyan
Write-Host "   .\scripts\diagnostic-et-fix-openai-gcp-complet.ps1" -ForegroundColor Gray
Write-Host ""

