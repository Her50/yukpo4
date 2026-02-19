# Script de diagnostic pour analyser pourquoi OPENAI_API_KEY ne fonctionne pas dans GCP
# Usage: .\scripts\diagnostic-ia-gcp-simple.ps1

param(
    [string]$GcpProjectId = "yukpo-project",
    [string]$GcpRegion = "europe-west1",
    [string]$GcpServiceName = "yukpo-backend"
)

Write-Host ""
Write-Host "DIAGNOSTIC COMPLET - OPENAI_API_KEY dans GCP" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "Projet: $GcpProjectId" -ForegroundColor Yellow
Write-Host "Region: $GcpRegion" -ForegroundColor Yellow
Write-Host "Service: $GcpServiceName" -ForegroundColor Yellow
Write-Host ""

# Configuration gcloud
gcloud config set project $GcpProjectId | Out-Null

$errors = @()
$warnings = @()
$success = @()

# 1. VERIFIER SI LE SECRET EXISTE DANS SECRET MANAGER
Write-Host ""
Write-Host "1. VERIFICATION SECRET MANAGER" -ForegroundColor Yellow
Write-Host "------------------------------" -ForegroundColor Yellow

$secretName = "openai-api-key"
$secretCheck = gcloud secrets describe $secretName --project=$GcpProjectId 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "[OK] Secret '$secretName' existe dans Secret Manager" -ForegroundColor Green
    $success += "Secret existe"
    
    # Recuperer les versions du secret
    $versions = gcloud secrets versions list $secretName --project=$GcpProjectId --format="value(name)" 2>&1
    if ($LASTEXITCODE -eq 0 -and $versions) {
        $latestVersion = ($versions | Select-Object -First 1)
        Write-Host "   Version la plus recente: $latestVersion" -ForegroundColor Gray
    } else {
        $warnings += "Aucune version du secret trouvee"
        Write-Host "   [WARN] Aucune version du secret trouvee" -ForegroundColor Yellow
    }
} else {
    Write-Host "[ERREUR] Secret '$secretName' N'EXISTE PAS dans Secret Manager" -ForegroundColor Red
    $errors += "Secret '$secretName' manquant dans Secret Manager"
    Write-Host ""
    Write-Host "SOLUTION: Creer le secret avec cette commande:" -ForegroundColor Yellow
    Write-Host "   echo -n 'sk-proj-VOTRE-CLE-ICI' | gcloud secrets create $secretName --project=$GcpProjectId --data-file=-" -ForegroundColor Cyan
}

# 2. VERIFIER LES PERMISSIONS DU SERVICE ACCOUNT
Write-Host ""
Write-Host "2. VERIFICATION PERMISSIONS SERVICE ACCOUNT" -ForegroundColor Yellow
Write-Host "-------------------------------------------" -ForegroundColor Yellow

# Recuperer le service account de Cloud Run
$serviceAccountOutput = gcloud run services describe $GcpServiceName --region=$GcpRegion --project=$GcpProjectId --format="value(spec.template.spec.serviceAccountName)" 2>&1
$serviceAccount = $serviceAccountOutput.Trim()

if ($LASTEXITCODE -eq 0 -and $serviceAccount -and $serviceAccount -ne "") {
    Write-Host "[OK] Service Account trouve: $serviceAccount" -ForegroundColor Green
    $success += "Service Account: $serviceAccount"
    
    # Verifier les permissions IAM sur le secret
    $iamPolicyOutput = gcloud secrets get-iam-policy $secretName --project=$GcpProjectId --format=json 2>&1
    if ($LASTEXITCODE -eq 0) {
        try {
            $policyJson = $iamPolicyOutput | ConvertFrom-Json
            $hasAccess = $false
            
            if ($policyJson.bindings) {
                foreach ($binding in $policyJson.bindings) {
                    if ($binding.role -eq "roles/secretmanager.secretAccessor") {
                        foreach ($member in $binding.members) {
                            if ($member -like "*$serviceAccount*") {
                                $hasAccess = $true
                                Write-Host "[OK] Service Account a acces au secret (role: secretAccessor)" -ForegroundColor Green
                                $success += "Permissions OK"
                                break
                            }
                        }
                    }
                }
            }
            
            if (-not $hasAccess) {
                Write-Host "[ERREUR] Service Account N'A PAS acces au secret" -ForegroundColor Red
                $errors += "Service Account $serviceAccount n'a pas acces au secret"
                Write-Host ""
                Write-Host "SOLUTION: Donner l'acces avec cette commande:" -ForegroundColor Yellow
                Write-Host "   gcloud secrets add-iam-policy-binding $secretName --member=serviceAccount:$serviceAccount --role=roles/secretmanager.secretAccessor --project=$GcpProjectId" -ForegroundColor Cyan
            }
        } catch {
            $warnings += "Impossible de parser les permissions IAM"
            Write-Host "[WARN] Impossible de parser les permissions IAM" -ForegroundColor Yellow
        }
    } else {
        $warnings += "Impossible de recuperer les permissions IAM"
        Write-Host "[WARN] Impossible de recuperer les permissions IAM" -ForegroundColor Yellow
    }
} else {
    # Utiliser le service account par defaut
    $defaultServiceAccount = "$GcpProjectId@appspot.gserviceaccount.com"
    Write-Host "[WARN] Service Account non trouve, utilisation du defaut: $defaultServiceAccount" -ForegroundColor Yellow
    $serviceAccount = $defaultServiceAccount
}

# 3. VERIFIER LA CONFIGURATION DANS CLOUD RUN
Write-Host ""
Write-Host "3. VERIFICATION CONFIGURATION CLOUD RUN" -ForegroundColor Yellow
Write-Host "--------------------------------------" -ForegroundColor Yellow

# Recuperer la configuration complete du service
$serviceConfigOutput = gcloud run services describe $GcpServiceName --region=$GcpRegion --project=$GcpProjectId --format=json 2>&1

if ($LASTEXITCODE -eq 0) {
    try {
        $serviceJson = $serviceConfigOutput | ConvertFrom-Json
        $containers = $serviceJson.spec.template.spec.containers
        
        if ($containers -and $containers.Count -gt 0) {
            $container = $containers[0]
            $envVars = $container.env
            
            # Verifier les variables d'environnement
            $openaiVarFound = $false
            $openaiSecretRef = $null
            
            Write-Host "Variables d'environnement configurees:" -ForegroundColor Gray
            if ($envVars) {
                foreach ($env in $envVars) {
                    if ($env.name -eq "OPENAI_API_KEY") {
                        $openaiVarFound = $true
                        if ($env.valueFrom -and $env.valueFrom.secretKeyRef) {
                            $openaiSecretRef = $env.valueFrom.secretKeyRef
                            Write-Host "   [OK] OPENAI_API_KEY trouvee (reference secret)" -ForegroundColor Green
                            Write-Host "      Secret: $($openaiSecretRef.name)" -ForegroundColor Gray
                            Write-Host "      Version: $($openaiSecretRef.version)" -ForegroundColor Gray
                            $success += "OPENAI_API_KEY referencee dans Cloud Run"
                            
                            # Verifier que le nom du secret correspond
                            if ($openaiSecretRef.name -ne $secretName) {
                                $warnings += "Nom du secret different: $($openaiSecretRef.name) vs $secretName"
                                Write-Host "      [WARN] Nom du secret different: $($openaiSecretRef.name) vs $secretName" -ForegroundColor Yellow
                            }
                        } elseif ($env.value) {
                            Write-Host "   [WARN] OPENAI_API_KEY trouvee (valeur directe - NON RECOMMANDE)" -ForegroundColor Yellow
                            $valuePreview = $env.value.Substring(0, [Math]::Min(20, $env.value.Length))
                            Write-Host "      Valeur: $valuePreview..." -ForegroundColor Gray
                            $warnings += "OPENAI_API_KEY en valeur directe (devrait etre un secret)"
                        }
                    }
                }
            }
            
            if (-not $openaiVarFound) {
                Write-Host "[ERREUR] OPENAI_API_KEY N'EST PAS configuree dans Cloud Run" -ForegroundColor Red
                $errors += "OPENAI_API_KEY manquante dans Cloud Run"
                Write-Host ""
                Write-Host "SOLUTION: Ajouter la reference au secret avec cette commande:" -ForegroundColor Yellow
                Write-Host "   gcloud run services update $GcpServiceName --region=$GcpRegion --project=$GcpProjectId --update-secrets=OPENAI_API_KEY=$secretName:latest" -ForegroundColor Cyan
            }
        }
    } catch {
        $errors += "Impossible de parser la configuration Cloud Run"
        Write-Host "[ERREUR] Impossible de parser la configuration Cloud Run" -ForegroundColor Red
    }
} else {
    $errors += "Impossible de recuperer la configuration Cloud Run"
    Write-Host "[ERREUR] Impossible de recuperer la configuration Cloud Run" -ForegroundColor Red
}

# 4. VERIFIER LES LOGS RECENTS
Write-Host ""
Write-Host "4. ANALYSE DES LOGS RECENTS" -ForegroundColor Yellow
Write-Host "---------------------------" -ForegroundColor Yellow

Write-Host "Recuperation des logs recents (50 dernieres lignes)..." -ForegroundColor Gray
$logsOutput = gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=$GcpServiceName" --limit=50 --project=$GcpProjectId --format="value(textPayload)" 2>&1

if ($LASTEXITCODE -eq 0 -and $logsOutput) {
    $openaiErrors = $logsOutput | Where-Object { $_ -like "*OPENAI*" -or $_ -like "*openai*" -or $_ -like "*API key*" -or $_ -like "*non configur*" }
    
    if ($openaiErrors) {
        Write-Host "[WARN] Erreurs liees a OPENAI_API_KEY trouvees dans les logs:" -ForegroundColor Yellow
        foreach ($error in $openaiErrors) {
            Write-Host "   $error" -ForegroundColor Red
        }
        $warnings += "Erreurs OPENAI trouvees dans les logs"
    } else {
        Write-Host "[OK] Aucune erreur OPENAI_API_KEY trouvee dans les logs recents" -ForegroundColor Green
        $success += "Pas d'erreurs dans les logs"
    }
} else {
    Write-Host "[WARN] Impossible de recuperer les logs" -ForegroundColor Yellow
    $warnings += "Impossible de recuperer les logs"
}

# 5. TEST D'ACCES AU SECRET
Write-Host ""
Write-Host "5. TEST D'ACCES AU SECRET" -ForegroundColor Yellow
Write-Host "------------------------" -ForegroundColor Yellow

$secretCheckResult = gcloud secrets describe $secretName --project=$GcpProjectId 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "Tentative de lecture du secret (verification d'acces)..." -ForegroundColor Gray
    $secretValueOutput = gcloud secrets versions access latest --secret=$secretName --project=$GcpProjectId 2>&1
    
    if ($LASTEXITCODE -eq 0 -and $secretValueOutput) {
        $secretValue = $secretValueOutput.Trim()
        $secretLength = $secretValue.Length
        if ($secretLength -gt 10) {
            $secretPrefix = $secretValue.Substring(0, 10)
        } else {
            $secretPrefix = $secretValue
        }
        Write-Host "[OK] Secret accessible, longueur: $secretLength caracteres" -ForegroundColor Green
        Write-Host "   Prefixe: $secretPrefix..." -ForegroundColor Gray
        $success += "Secret accessible"
        
        # Verifier le format de la cle
        if ($secretValue -like "sk-*") {
            Write-Host "[OK] Format de la cle OpenAI valide (commence par 'sk-')" -ForegroundColor Green
        } else {
            $warnings += "Format de la cle OpenAI suspect (ne commence pas par 'sk-')"
            Write-Host "[WARN] Format de la cle suspect (ne commence pas par 'sk-')" -ForegroundColor Yellow
        }
    } else {
        $errors += "Impossible d'acceder au secret"
        Write-Host "[ERREUR] Impossible d'acceder au secret (permissions insuffisantes)" -ForegroundColor Red
    }
}

# RESUME FINAL
Write-Host ""
$separator = "=" * 60
Write-Host $separator -ForegroundColor Cyan
Write-Host "RESUME DU DIAGNOSTIC" -ForegroundColor Cyan
Write-Host $separator -ForegroundColor Cyan
Write-Host ""

if ($success.Count -gt 0) {
    Write-Host "SUCCES ($($success.Count)):" -ForegroundColor Green
    foreach ($item in $success) {
        Write-Host "   - $item" -ForegroundColor Gray
    }
    Write-Host ""
}

if ($warnings.Count -gt 0) {
    Write-Host "AVERTISSEMENTS ($($warnings.Count)):" -ForegroundColor Yellow
    foreach ($item in $warnings) {
        Write-Host "   - $item" -ForegroundColor Gray
    }
    Write-Host ""
}

if ($errors.Count -gt 0) {
    Write-Host "ERREURS CRITIQUES ($($errors.Count)):" -ForegroundColor Red
    foreach ($item in $errors) {
        Write-Host "   - $item" -ForegroundColor Gray
    }
    Write-Host ""
    Write-Host "ACTIONS REQUISES:" -ForegroundColor Yellow
    Write-Host "   1. Corriger les erreurs listees ci-dessus" -ForegroundColor White
    Write-Host "   2. Redeployer le service Cloud Run apres corrections" -ForegroundColor White
    Write-Host "   3. Verifier les logs apres redeploiement" -ForegroundColor White
} else {
    Write-Host "[OK] Aucune erreur critique trouvee!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Si le probleme persiste, verifiez:" -ForegroundColor Yellow
    Write-Host "   - Les logs detailles du service Cloud Run" -ForegroundColor White
    Write-Host "   - Que le code backend utilise bien std::env::var('OPENAI_API_KEY')" -ForegroundColor White
    Write-Host "   - Que le service a ete redeploye apres configuration du secret" -ForegroundColor White
}

Write-Host ""
Write-Host "Pour voir les logs en temps reel:" -ForegroundColor Cyan
$logCommand = "gcloud logging tail `"resource.type=cloud_run_revision AND resource.labels.service_name=$GcpServiceName`" --project=$GcpProjectId"
Write-Host "   $logCommand" -ForegroundColor Gray
Write-Host ""

