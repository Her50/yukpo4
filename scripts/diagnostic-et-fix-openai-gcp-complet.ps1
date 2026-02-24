# Script complet de diagnostic et correction OPENAI_API_KEY dans GCP
# Usage: .\scripts\diagnostic-et-fix-openai-gcp-complet.ps1 [-Fix] [-ApiKey "sk-proj-..."]

param(
    [string]$GcpProjectId = "yukpo-project",
    [string]$GcpRegion = "europe-west1",
    [string]$GcpServiceName = "yukpo-backend",
    [string]$SecretName = "openai-api-key",
    [switch]$Fix = $false,
    [string]$ApiKey = "",
    [switch]$CheckLogs = $true
)

Write-Host ""
Write-Host "🔍 DIAGNOSTIC COMPLET OPENAI_API_KEY - GCP" -ForegroundColor Cyan
Write-Host "===========================================" -ForegroundColor Cyan
Write-Host "Projet: $GcpProjectId" -ForegroundColor Yellow
Write-Host "Région: $GcpRegion" -ForegroundColor Yellow
Write-Host "Service: $GcpServiceName" -ForegroundColor Yellow
Write-Host "Secret: $SecretName" -ForegroundColor Yellow
if ($Fix) {
    Write-Host "MODE: CORRECTION ACTIVÉE" -ForegroundColor Green
    if ($ApiKey) {
        Write-Host "Clé API fournie: Oui (longueur: $($ApiKey.Length) caractères)" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Clé API non fournie - vous devrez la saisir" -ForegroundColor Yellow
    }
} else {
    Write-Host "MODE: DIAGNOSTIC UNIQUEMENT" -ForegroundColor Yellow
}
Write-Host ""

# Configuration gcloud
gcloud config set project $GcpProjectId | Out-Null

$errors = @()
$warnings = @()
$success = @()

# ============================================================================
# ÉTAPE 1: Vérifier le secret dans Secret Manager
# ============================================================================
Write-Host "1️⃣  Vérification du secret dans Secret Manager..." -ForegroundColor Yellow
$secretExists = gcloud secrets describe $SecretName --project=$GcpProjectId 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "   ✅ Secret '$SecretName' existe" -ForegroundColor Green
    $success += "Secret existe"
    
    # Récupérer la valeur du secret (sans l'afficher complètement)
    $secretValue = gcloud secrets versions access latest --secret=$SecretName --project=$GcpProjectId 2>&1
    if ($LASTEXITCODE -eq 0) {
        $keyLength = $secretValue.Trim().Length
        $keyPrefix = if ($keyLength -gt 10) { $secretValue.Trim().Substring(0, 10) } else { $secretValue.Trim() }
        
        Write-Host "   Longueur: $keyLength caractères" -ForegroundColor Gray
        Write-Host "   Préfixe: $keyPrefix..." -ForegroundColor Gray
        
        if ($keyLength -lt 20) {
            Write-Host "   ❌ PROBLÈME CRITIQUE: Secret trop court ($keyLength caractères)" -ForegroundColor Red
            Write-Host "      Une clé OpenAI valide doit faire au moins 50 caractères" -ForegroundColor Red
            $errors += "Secret trop court ($keyLength caractères, minimum 50 requis)"
        } elseif (-not ($secretValue.Trim() -match "^sk-")) {
            Write-Host "   ❌ PROBLÈME CRITIQUE: Secret ne commence pas par 'sk-'" -ForegroundColor Red
            Write-Host "      Format attendu: sk-proj-... ou sk-..." -ForegroundColor Red
            $errors += "Format de clé invalide (doit commencer par 'sk-')"
        } else {
            Write-Host "   ✅ Format de clé valide" -ForegroundColor Green
            $success += "Format de clé valide"
        }
    } else {
        Write-Host "   ❌ Impossible d'accéder à la valeur du secret" -ForegroundColor Red
        $errors += "Impossible d'accéder à la valeur du secret"
    }
} else {
    Write-Host "   ❌ Secret '$SecretName' n'existe pas" -ForegroundColor Red
    $errors += "Secret n'existe pas"
}

Write-Host ""

# ============================================================================
# ÉTAPE 2: Vérifier les permissions IAM
# ============================================================================
Write-Host "2️⃣  Vérification des permissions IAM..." -ForegroundColor Yellow
$serviceAccount = gcloud run services describe $GcpServiceName --region=$GcpRegion --project=$GcpProjectId --format="value(spec.template.spec.serviceAccountName)" 2>&1
if ($LASTEXITCODE -eq 0 -and $serviceAccount) {
    Write-Host "   Service Account: $serviceAccount" -ForegroundColor Cyan
    
    $iamPolicy = gcloud secrets get-iam-policy $SecretName --project=$GcpProjectId --format=json 2>&1 | ConvertFrom-Json
    if ($LASTEXITCODE -eq 0) {
        $hasAccess = $false
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
        
        if ($hasAccess) {
            Write-Host "   ✅ Service Account a accès au secret" -ForegroundColor Green
            $success += "Permissions IAM correctes"
        } else {
            Write-Host "   ❌ Service Account n'a PAS accès au secret" -ForegroundColor Red
            $errors += "Service Account n'a pas accès au secret"
            
            if ($Fix) {
                Write-Host "   🔧 Attribution des permissions..." -ForegroundColor Yellow
                $permissionResult = gcloud secrets add-iam-policy-binding $SecretName --member="serviceAccount:$serviceAccount" --role="roles/secretmanager.secretAccessor" --project=$GcpProjectId 2>&1
                if ($LASTEXITCODE -eq 0) {
                    Write-Host "   ✅ Permissions attribuées avec succès" -ForegroundColor Green
                    $success += "Permissions IAM corrigées"
                } else {
                    Write-Host "   ❌ Erreur lors de l'attribution des permissions" -ForegroundColor Red
                    Write-Host "   $permissionResult" -ForegroundColor Red
                    $errors += "Erreur attribution permissions"
                }
            }
        }
    } else {
        Write-Host "   ⚠️  Impossible de récupérer les permissions IAM" -ForegroundColor Yellow
        $warnings += "Impossible de vérifier les permissions IAM"
    }
} else {
    Write-Host "   ⚠️  Impossible de récupérer le Service Account" -ForegroundColor Yellow
    $warnings += "Impossible de récupérer le Service Account"
}

Write-Host ""

# ============================================================================
# ÉTAPE 3: Vérifier la configuration dans Cloud Run
# ============================================================================
Write-Host "3️⃣  Vérification de la configuration Cloud Run..." -ForegroundColor Yellow
$serviceConfig = gcloud run services describe $GcpServiceName --region=$GcpRegion --project=$GcpProjectId --format=json 2>&1 | ConvertFrom-Json
if ($LASTEXITCODE -eq 0) {
    $containers = $serviceConfig.spec.template.spec.containers
    if ($containers -and $containers.Count -gt 0) {
        $container = $containers[0]
        $envVars = $container.env
        
        $openaiVarFound = $false
        $isSecret = $false
        foreach ($env in $envVars) {
            if ($env.name -eq "OPENAI_API_KEY") {
                $openaiVarFound = $true
                if ($env.valueFrom -and $env.valueFrom.secretKeyRef) {
                    $isSecret = $true
                    $secretRef = $env.valueFrom.secretKeyRef.name
                    $secretVersion = $env.valueFrom.secretKeyRef.version
                    Write-Host "   ✅ OPENAI_API_KEY est configurée" -ForegroundColor Green
                    Write-Host "      Secret: $secretRef" -ForegroundColor Gray
                    Write-Host "      Version: $secretVersion" -ForegroundColor Gray
                    $success += "OPENAI_API_KEY configurée dans Cloud Run"
                    
                    if ($secretRef -ne $SecretName) {
                        Write-Host "   ⚠️  Le secret référencé ($secretRef) est différent de celui attendu ($SecretName)" -ForegroundColor Yellow
                        $warnings += "Nom de secret différent"
                    }
                } else {
                    Write-Host "   ⚠️  OPENAI_API_KEY est une valeur directe (pas un secret)" -ForegroundColor Yellow
                    $warnings += "OPENAI_API_KEY n'est pas un secret"
                }
                break
            }
        }
        
        if (-not $openaiVarFound) {
            Write-Host "   ❌ OPENAI_API_KEY n'est PAS configurée dans Cloud Run" -ForegroundColor Red
            $errors += "OPENAI_API_KEY non configurée dans Cloud Run"
            
            if ($Fix) {
                Write-Host "   🔧 Ajout de OPENAI_API_KEY dans Cloud Run..." -ForegroundColor Yellow
                $updateResult = gcloud run services update $GcpServiceName --region=$GcpRegion --project=$GcpProjectId --update-secrets="OPENAI_API_KEY=$SecretName`:latest" 2>&1
                if ($LASTEXITCODE -eq 0) {
                    Write-Host "   ✅ OPENAI_API_KEY ajoutée avec succès" -ForegroundColor Green
                    Write-Host "   ⏳ Le service va être redéployé automatiquement..." -ForegroundColor Yellow
                    $success += "OPENAI_API_KEY ajoutée dans Cloud Run"
                } else {
                    Write-Host "   ❌ Erreur lors de l'ajout de OPENAI_API_KEY" -ForegroundColor Red
                    Write-Host "   $updateResult" -ForegroundColor Red
                    $errors += "Erreur ajout OPENAI_API_KEY dans Cloud Run"
                }
            }
        }
    }
} else {
    Write-Host "   ❌ Impossible de récupérer la configuration du service" -ForegroundColor Red
    $errors += "Impossible de récupérer la configuration Cloud Run"
}

Write-Host ""

# ============================================================================
# ÉTAPE 4: Mettre à jour le secret si nécessaire
# ============================================================================
if ($Fix -and $errors.Count -gt 0) {
    # Vérifier si le secret est trop court ou invalide
    $needsUpdate = $false
    foreach ($error in $errors) {
        if ($error -match "trop court" -or $error -match "Format de clé invalide") {
            $needsUpdate = $true
            break
        }
    }
    
    if ($needsUpdate) {
        Write-Host "4️⃣  Mise à jour du secret..." -ForegroundColor Yellow
        
        if (-not $ApiKey) {
            Write-Host "   ⚠️  Clé API non fournie en paramètre" -ForegroundColor Yellow
            Write-Host "   💡 Pour mettre à jour le secret, utilisez:" -ForegroundColor Cyan
            Write-Host "      .\scripts\diagnostic-et-fix-openai-gcp-complet.ps1 -Fix -ApiKey 'sk-proj-VOTRE_CLE_ICI'" -ForegroundColor White
            Write-Host ""
            Write-Host "   Ou mettez à jour manuellement via:" -ForegroundColor Cyan
            Write-Host "      echo -n 'sk-proj-VOTRE_CLE' | gcloud secrets versions add $SecretName --data-file=- --project=$GcpProjectId" -ForegroundColor White
        } else {
            # Valider la clé
            if ($ApiKey.Length -lt 20) {
                Write-Host "   ❌ Clé API fournie trop courte ($($ApiKey.Length) caractères)" -ForegroundColor Red
                $errors += "Clé API fournie invalide"
            } elseif (-not ($ApiKey -match "^sk-")) {
                Write-Host "   ❌ Clé API fournie ne commence pas par 'sk-'" -ForegroundColor Red
                $errors += "Clé API fournie invalide"
            } else {
                Write-Host "   🔧 Ajout d'une nouvelle version du secret..." -ForegroundColor Yellow
                $ApiKey | gcloud secrets versions add $SecretName --data-file=- --project=$GcpProjectId 2>&1 | Out-Null
                if ($LASTEXITCODE -eq 0) {
                    Write-Host "   ✅ Secret mis à jour avec succès" -ForegroundColor Green
                    $success += "Secret mis à jour"
                } else {
                    Write-Host "   ❌ Erreur lors de la mise à jour du secret" -ForegroundColor Red
                    $errors += "Erreur mise à jour secret"
                }
            }
        }
        Write-Host ""
    }
}

# ============================================================================
# ÉTAPE 5: Vérifier les logs récents
# ============================================================================
if ($CheckLogs) {
    Write-Host "5️⃣  Analyse des logs récents (30 dernières minutes)..." -ForegroundColor Yellow
    try {
        $logs = gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=$GcpServiceName" --limit=200 --project=$GcpProjectId --format=json --freshness=30m 2>&1 | ConvertFrom-Json
        
        $openaiErrors = $logs | Where-Object { 
            $textPayload = if ($_.textPayload) { $_.textPayload } else { "" }
            $jsonPayload = if ($_.jsonPayload) { ($_.jsonPayload | ConvertTo-Json -Depth 10) } else { "" }
            $combined = "$textPayload $jsonPayload"
            
            $combined -like '*OPENAI*' -or 
            $combined -like '*openai*' -or 
            $combined -like '*API*key*' -or
            $combined -like '*401*' -or
            $combined -like '*403*' -or
            $combined -like '*unauthorized*' -or
            $combined -like '*OPENAI_API_KEY*' -or
            $combined -like '*non trouvée*' -or
            $combined -like '*non configurée*'
        }
        
        if ($openaiErrors) {
            Write-Host "   ⚠️  Erreurs OpenAI trouvées dans les logs:" -ForegroundColor Yellow
            $errorCount = 0
            $openaiErrors | Select-Object -First 10 | ForEach-Object {
                $errorCount++
                $timestamp = if ($_.timestamp) { $_.timestamp } else { "N/A" }
                $severity = if ($_.severity) { $_.severity } else { "INFO" }
                $textPayload = if ($_.textPayload) { $_.textPayload } else { "" }
                $jsonPayload = if ($_.jsonPayload) { ($_.jsonPayload | ConvertTo-Json -Compress) } else { "" }
                $message = if ($textPayload) { $textPayload } else { $jsonPayload }
                
                Write-Host "   [$timestamp] $severity : $($message.Substring(0, [Math]::Min(200, $message.Length)))" -ForegroundColor Red
            }
            if ($errorCount -gt 10) {
                Write-Host "   ... et $($errorCount - 10) autres erreurs" -ForegroundColor Gray
            }
            $warnings += "$errorCount erreur(s) OpenAI dans les logs"
        } else {
            Write-Host "   ✅ Aucune erreur OpenAI dans les logs récents" -ForegroundColor Green
            $success += "Aucune erreur dans les logs"
        }
    } catch {
        Write-Host "   ⚠️  Impossible d'analyser les logs: $_" -ForegroundColor Yellow
        $warnings += "Impossible d'analyser les logs"
    }
    Write-Host ""
}

# ============================================================================
# RÉSUMÉ FINAL
# ============================================================================
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "📊 RÉSUMÉ DU DIAGNOSTIC" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

if ($success.Count -gt 0) {
    Write-Host "✅ Points positifs:" -ForegroundColor Green
    foreach ($item in $success) {
        Write-Host "   • $item" -ForegroundColor Green
    }
    Write-Host ""
}

if ($warnings.Count -gt 0) {
    Write-Host "⚠️  Avertissements:" -ForegroundColor Yellow
    foreach ($item in $warnings) {
        Write-Host "   • $item" -ForegroundColor Yellow
    }
    Write-Host ""
}

if ($errors.Count -gt 0) {
    Write-Host "❌ Problèmes détectés:" -ForegroundColor Red
    foreach ($item in $errors) {
        Write-Host "   • $item" -ForegroundColor Red
    }
    Write-Host ""
    
    Write-Host "💡 Actions recommandées:" -ForegroundColor Cyan
    Write-Host "   1. Obtenir une vraie clé OpenAI depuis https://platform.openai.com/api-keys" -ForegroundColor White
    Write-Host "   2. Mettre à jour le secret avec:" -ForegroundColor White
    Write-Host "      .\scripts\diagnostic-et-fix-openai-gcp-complet.ps1 -Fix -ApiKey 'sk-proj-VOTRE_CLE'" -ForegroundColor Gray
    Write-Host "   3. Vérifier que OPENAI_API_KEY est référencée dans Cloud Run" -ForegroundColor White
    Write-Host "   4. Attendre le redéploiement du service (1-2 minutes)" -ForegroundColor White
    Write-Host "   5. Tester la création d'un produit" -ForegroundColor White
} else {
    Write-Host "✅ Aucun problème critique détecté!" -ForegroundColor Green
    Write-Host ""
    Write-Host "💡 Si la création de produit échoue toujours:" -ForegroundColor Yellow
    Write-Host "   1. Vérifier que la clé OpenAI a des crédits disponibles" -ForegroundColor White
    Write-Host "   2. Vérifier les quotas OpenAI sur https://platform.openai.com/usage" -ForegroundColor White
    Write-Host "   3. Vérifier les logs en temps réel:" -ForegroundColor White
    Write-Host "      gcloud logging tail `"resource.type=cloud_run_revision AND resource.labels.service_name=$GcpServiceName`" --project=$GcpProjectId" -ForegroundColor Gray
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

