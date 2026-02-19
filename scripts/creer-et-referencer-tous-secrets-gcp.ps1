# Script pour creer tous les secrets manquants et les referencer dans Cloud Run
# Usage: .\scripts\creer-et-referencer-tous-secrets-gcp.ps1

param(
    [string]$GcpProjectId = "yukpo-project",
    [string]$GcpRegion = "europe-west1",
    [string]$GcpServiceName = "yukpo-backend",
    [switch]$DryRun = $false
)

Write-Host ""
Write-Host "CREATION ET REFERENCEMENT DE TOUS LES SECRETS GCP" -ForegroundColor Cyan
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host "Projet: $GcpProjectId" -ForegroundColor Yellow
Write-Host "Region: $GcpRegion" -ForegroundColor Yellow
Write-Host "Service: $GcpServiceName" -ForegroundColor Yellow
if ($DryRun) {
    Write-Host "MODE: DRY RUN (aucune modification)" -ForegroundColor Yellow
}
Write-Host ""

gcloud config set project $GcpProjectId | Out-Null

# Recuperer le service account
$serviceAccountOutput = gcloud run services describe $GcpServiceName --region=$GcpRegion --project=$GcpProjectId --format="value(spec.template.spec.serviceAccountName)" 2>&1
$serviceAccount = $serviceAccountOutput.Trim()

if ($LASTEXITCODE -ne 0 -or -not $serviceAccount -or $serviceAccount -eq "") {
    $serviceAccount = "$GcpProjectId@appspot.gserviceaccount.com"
}

Write-Host "Service Account: $serviceAccount" -ForegroundColor Gray
Write-Host ""

# Liste de tous les secrets a creer/referencer
# Valeurs trouvees dans le codebase
$secretsToCreate = @{
    "google-maps-api-key" = "AIzaSyDFfWEq1Umm06SNTbR-cRhRQ5Sq_taEAWQ"
    "google-translate-api-key" = "AIzaSyDFfWEq1Umm06SNTbR-cRhRQ5Sq_taEAWQ"
    "google-client-id" = "PLACEHOLDER_REMPLACER_PAR_VRAIE_VALEUR"
    "pexels-api-key" = "1ytrq9SUFeMBA68ieIw9rFio3zZCU8ch6355srswcZer6hnJaLPv5Jl8"
    "pixabay-api-key" = "53555366-49550f2da946ADC1e8e4F5B99"
    "unsplash-access-key" = "iOBl0EgF7Um3QclokoYMV4aH2IkDyOoRuPYswWxrrSM"
    "auphonic-api-key" = "AdxU2ktP7YfxzWd2N5JfMFDketxNRktq"
    "embedding-api-key" = "yukpo_embedding_key_2024"
    "yukpo-api-key" = "yukpo_embedding_key_2024"
    "livekit-api-key" = "APIPHE9xDv5RPaP"
    "livekit-api-secret" = "qVRL18gIk8W3Dp8V4Wu23I99t0XbZ5pM66D9i5MTTkE"
    "video-renderer-rpc-token" = "l-5nF6KwiPasSeCj2h_ixIevCZO2mLijLcJg6KNmP2UxAQGMSLD9RnRrBC_0mGhY"
    "youtube-client-id" = "PLACEHOLDER_REMPLACER_PAR_VRAIE_VALEUR"
    "youtube-client-secret" = "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"
    "sendgrid-api-key" = "PLACEHOLDER_REMPLACER_PAR_VRAIE_VALEUR"
    "twilio-account-sid" = "PLACEHOLDER_REMPLACER_PAR_VRAIE_VALEUR"
    "twilio-auth-token" = "PLACEHOLDER_REMPLACER_PAR_VRAIE_VALEUR"
    "twilio-from-number" = "PLACEHOLDER_REMPLACER_PAR_VRAIE_VALEUR"
    "sora-api-key" = "PLACEHOLDER_REMPLACER_PAR_VRAIE_VALEUR"
}

# Mapping des noms de variables vers noms de secrets
$varToSecretMap = @{
    "GOOGLE_MAPS_API_KEY" = "google-maps-api-key"
    "GOOGLE_TRANSLATE_API_KEY" = "google-translate-api-key"
    "GOOGLE_CLIENT_ID" = "google-client-id"
    "PEXELS_API_KEY" = "pexels-api-key"
    "PIXABAY_API_KEY" = "pixabay-api-key"
    "UNSPLASH_ACCESS_KEY" = "unsplash-access-key"
    "AUPHONIC_API_KEY" = "auphonic-api-key"
    "EMBEDDING_API_KEY" = "embedding-api-key"
    "YUKPO_API_KEY" = "yukpo-api-key"
    "LIVEKIT_API_KEY" = "livekit-api-key"
    "LIVEKIT_API_SECRET" = "livekit-api-secret"
    "VIDEO_RENDERER_RPC_TOKEN" = "video-renderer-rpc-token"
    "YOUTUBE_CLIENT_ID" = "youtube-client-id"
    "YOUTUBE_CLIENT_SECRET" = "youtube-client-secret"
    "SENDGRID_API_KEY" = "sendgrid-api-key"
    "TWILIO_ACCOUNT_SID" = "twilio-account-sid"
    "TWILIO_AUTH_TOKEN" = "twilio-auth-token"
    "TWILIO_FROM_NUMBER" = "twilio-from-number"
    "SORA_API_KEY" = "sora-api-key"
}

$created = @()
$existing = @()
$failed = @()
$referenced = @()

Write-Host "1. CREATION DES SECRETS MANQUANTS" -ForegroundColor Yellow
Write-Host "----------------------------------" -ForegroundColor Yellow
Write-Host ""

foreach ($secretName in $secretsToCreate.Keys) {
    $secretValue = $secretsToCreate[$secretName]
    
    Write-Host "Verification: $secretName" -ForegroundColor Gray
    
    # Verifier si le secret existe
    $secretCheck = gcloud secrets describe $secretName --project=$GcpProjectId 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   [INFO] Secret existe deja" -ForegroundColor Cyan
        $existing += $secretName
    } else {
        if ($DryRun) {
            Write-Host "   [DRY RUN] Serait cree avec valeur: ${secretValue}..." -ForegroundColor Gray
            $created += $secretName
            } else {
                # Creer le secret
                if ($secretValue -like "PLACEHOLDER*" -or $secretValue -like "*your_*" -or $secretValue -like "*REMPLACER*") {
                    Write-Host "   [SKIP] Valeur placeholder, secret non cree" -ForegroundColor Yellow
                    $failed += "$secretName (placeholder)"
                    continue
                } else {
                Write-Host "   Creation du secret..." -ForegroundColor Gray
                $createResult = echo -n $secretValue | gcloud secrets create $secretName --project=$GcpProjectId --data-file=- 2>&1
                
                if ($LASTEXITCODE -eq 0) {
                    Write-Host "   [OK] Secret cree avec succes" -ForegroundColor Green
                    $created += $secretName
                } else {
                    Write-Host "   [ERREUR] Impossible de creer le secret" -ForegroundColor Red
                    Write-Host "   $createResult" -ForegroundColor Red
                    $failed += $secretName
                }
            }
        }
    }
    Write-Host ""
}

# 2. Attribution des permissions
Write-Host "2. ATTRIBUTION DES PERMISSIONS" -ForegroundColor Yellow
Write-Host "-----------------------------" -ForegroundColor Yellow
Write-Host ""

$allSecrets = $created + $existing
foreach ($secretName in $allSecrets) {
    if ($secretName -like "*PLACEHOLDER*") { continue }
    
    Write-Host "Verification permissions: $secretName" -ForegroundColor Gray
    
    # Verifier les permissions
    $iamPolicy = gcloud secrets get-iam-policy $secretName --project=$GcpProjectId --format=json 2>&1
    $hasPermission = $false
    
    if ($LASTEXITCODE -eq 0) {
        try {
            $policyJson = $iamPolicy | ConvertFrom-Json
            if ($policyJson.bindings) {
                foreach ($binding in $policyJson.bindings) {
                    if ($binding.role -eq "roles/secretmanager.secretAccessor") {
                        foreach ($member in $binding.members) {
                            if ($member -like "*$serviceAccount*") {
                                $hasPermission = $true
                                break
                            }
                        }
                    }
                }
            }
        } catch {
            # Ignore
        }
    }
    
    if ($hasPermission) {
        Write-Host "   [OK] Permissions deja configurees" -ForegroundColor Green
    } else {
        if ($DryRun) {
            Write-Host "   [DRY RUN] Permissions seraient attribuees" -ForegroundColor Gray
        } else {
            Write-Host "   Attribution des permissions..." -ForegroundColor Gray
            $permResult = gcloud secrets add-iam-policy-binding $secretName --member="serviceAccount:$serviceAccount" --role="roles/secretmanager.secretAccessor" --project=$GcpProjectId 2>&1
            
            if ($LASTEXITCODE -eq 0) {
                Write-Host "   [OK] Permissions attribuees" -ForegroundColor Green
            } else {
                Write-Host "   [ERREUR] Impossible d'attribuer les permissions" -ForegroundColor Red
            }
        }
    }
    Write-Host ""
}

# 3. Referencement dans Cloud Run
Write-Host "3. REFERENCEMENT DANS CLOUD RUN" -ForegroundColor Yellow
Write-Host "-------------------------------" -ForegroundColor Yellow
Write-Host ""

# Construire la liste des secrets a referencer (uniquement ceux qui existent vraiment)
$secretsToReference = @()
foreach ($varName in $varToSecretMap.Keys) {
    $secretName = $varToSecretMap[$varName]
    # Verifier que le secret existe vraiment dans Secret Manager
    $secretCheck = gcloud secrets describe $secretName --project=$GcpProjectId 2>&1
    if ($LASTEXITCODE -eq 0) {
        $secretsToReference += "${varName}=${secretName}:latest"
    }
}

if ($secretsToReference.Count -gt 0) {
    $secretsString = $secretsToReference -join ","
    
    if ($DryRun) {
        Write-Host "[DRY RUN] Secrets qui seraient referencies:" -ForegroundColor Gray
        foreach ($ref in $secretsToReference) {
            Write-Host "   $ref" -ForegroundColor Cyan
        }
        Write-Host ""
        Write-Host "Commande qui serait executee:" -ForegroundColor Gray
        Write-Host "   gcloud run services update $GcpServiceName --region=$GcpRegion --project=$GcpProjectId --update-secrets=`"$secretsString`"" -ForegroundColor Cyan
    } else {
        Write-Host "Mise a jour de Cloud Run avec $($secretsToReference.Count) secrets..." -ForegroundColor Gray
        $updateResult = gcloud run services update $GcpServiceName --region=$GcpRegion --project=$GcpProjectId --update-secrets=$secretsString 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "[OK] Service Cloud Run mis a jour avec succes" -ForegroundColor Green
            Write-Host "Le service va etre redeploye automatiquement..." -ForegroundColor Gray
            $referenced = $secretsToReference.Count
        } else {
            Write-Host "[ERREUR] Impossible de mettre a jour le service" -ForegroundColor Red
            Write-Host "$updateResult" -ForegroundColor Red
        }
    }
} else {
    Write-Host "[WARN] Aucun secret a referencer" -ForegroundColor Yellow
}

Write-Host ""

# Resume final
Write-Host ""
$separator = "=" * 60
Write-Host $separator -ForegroundColor Cyan
Write-Host "RESUME" -ForegroundColor Cyan
Write-Host $separator -ForegroundColor Cyan
Write-Host ""

if ($existing.Count -gt 0) {
    Write-Host "SECRETS EXISTANTS ($($existing.Count)):" -ForegroundColor Cyan
    foreach ($item in $existing) {
        Write-Host "   + $item" -ForegroundColor Gray
    }
    Write-Host ""
}

if ($created.Count -gt 0) {
    Write-Host "SECRETS CREES ($($created.Count)):" -ForegroundColor Green
    foreach ($item in $created) {
        Write-Host "   + $item" -ForegroundColor Gray
    }
    Write-Host ""
}

if ($failed.Count -gt 0) {
    Write-Host "SECRETS NON CREES ($($failed.Count)):" -ForegroundColor Yellow
    foreach ($item in $failed) {
        Write-Host "   ! $item" -ForegroundColor Gray
    }
    Write-Host ""
}

if ($referenced -gt 0) {
    Write-Host "SECRETS REFERENCES DANS CLOUD RUN: $referenced" -ForegroundColor Green
    Write-Host ""
}

if ($DryRun) {
    Write-Host "DRY RUN TERMINE - Aucune modification effectuee" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Pour appliquer les changements, relancez sans -DryRun:" -ForegroundColor Cyan
    Write-Host "   .\scripts\creer-et-referencer-tous-secrets-gcp.ps1" -ForegroundColor White
} else {
    Write-Host "OPERATION TERMINEE" -ForegroundColor Green
    Write-Host ""
    Write-Host "Prochaines etapes:" -ForegroundColor Yellow
    Write-Host "   1. Attendre le redéploiement du service (1-2 minutes)" -ForegroundColor White
    Write-Host "   2. Verifier les logs pour confirmer le chargement des variables" -ForegroundColor White
    Write-Host "   3. Tester les fonctionnalites qui utilisent ces API" -ForegroundColor White
}

Write-Host ""

