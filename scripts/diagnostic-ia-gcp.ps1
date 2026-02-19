# Script de diagnostic pour analyser pourquoi OPENAI_API_KEY ne fonctionne pas dans GCP
# Usage: .\scripts\diagnostic-ia-gcp.ps1

param(
    [string]$GcpProjectId = "yukpo-project",
    [string]$GcpRegion = "europe-west1",
    [string]$GcpServiceName = "yukpo-backend"
)

Write-Host "`n🔍 DIAGNOSTIC COMPLET - OPENAI_API_KEY dans GCP" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "Projet: $GcpProjectId" -ForegroundColor Yellow
Write-Host "Région: $GcpRegion" -ForegroundColor Yellow
Write-Host "Service: $GcpServiceName" -ForegroundColor Yellow
Write-Host ""

# Configuration gcloud
gcloud config set project $GcpProjectId | Out-Null

$errors = @()
$warnings = @()
$success = @()

# 1. VÉRIFIER SI LE SECRET EXISTE DANS SECRET MANAGER
Write-Host "`n1️⃣  VÉRIFICATION SECRET MANAGER" -ForegroundColor Yellow
Write-Host "-----------------------------------" -ForegroundColor Yellow

$secretName = "openai-api-key"
$secretExists = gcloud secrets describe $secretName --project=$GcpProjectId 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Secret '$secretName' existe dans Secret Manager" -ForegroundColor Green
    $success += "Secret existe"
    
    # Récupérer les versions du secret
    $versions = gcloud secrets versions list $secretName --project=$GcpProjectId --format="value(name)" 2>&1
    if ($LASTEXITCODE -eq 0 -and $versions) {
        $latestVersion = ($versions | Select-Object -First 1)
        Write-Host "   📌 Version la plus récente: $latestVersion" -ForegroundColor Gray
    } else {
        $warnings += "Aucune version du secret trouvée"
        Write-Host "   ⚠️  Aucune version du secret trouvée" -ForegroundColor Yellow
    }
} else {
    Write-Host "❌ Secret '$secretName' N'EXISTE PAS dans Secret Manager" -ForegroundColor Red
    $errors += "Secret '$secretName' manquant dans Secret Manager"
    Write-Host ""
    Write-Host "🔧 SOLUTION: Créer le secret avec cette commande:" -ForegroundColor Yellow
    Write-Host "   echo -n 'sk-proj-VOTRE-CLE-ICI' | gcloud secrets create $secretName \`" -ForegroundColor Cyan
    Write-Host "     --project=$GcpProjectId \`" -ForegroundColor Cyan
    Write-Host "     --data-file=-" -ForegroundColor Cyan
}

# 2. VÉRIFIER LES PERMISSIONS DU SERVICE ACCOUNT
Write-Host "`n2️⃣  VÉRIFICATION PERMISSIONS SERVICE ACCOUNT" -ForegroundColor Yellow
Write-Host "-----------------------------------------------" -ForegroundColor Yellow

# Récupérer le service account de Cloud Run
$serviceAccount = gcloud run services describe $GcpServiceName `
    --region=$GcpRegion `
    --project=$GcpProjectId `
    --format="value(spec.template.spec.serviceAccountName)" 2>&1

if ($LASTEXITCODE -eq 0 -and $serviceAccount) {
    Write-Host "✅ Service Account trouvé: $serviceAccount" -ForegroundColor Green
    $success += "Service Account: $serviceAccount"
    
    # Vérifier les permissions IAM sur le secret
    $iamPolicy = gcloud secrets get-iam-policy $secretName --project=$GcpProjectId --format=json 2>&1
    if ($LASTEXITCODE -eq 0) {
        $policyJson = $iamPolicy | ConvertFrom-Json
        $hasAccess = $false
        
        foreach ($binding in $policyJson.bindings) {
            if ($binding.role -eq "roles/secretmanager.secretAccessor") {
                foreach ($member in $binding.members) {
                    if ($member -like "*$serviceAccount*") {
                        $hasAccess = $true
                        Write-Host "✅ Service Account a accès au secret (role: secretAccessor)" -ForegroundColor Green
                        $success += "Permissions OK"
                        break
                    }
                }
            }
        }
        
        if (-not $hasAccess) {
            Write-Host "❌ Service Account N'A PAS accès au secret" -ForegroundColor Red
            $errors += "Service Account $serviceAccount n'a pas accès au secret"
            Write-Host ""
            Write-Host "🔧 SOLUTION: Donner l'accès avec cette commande:" -ForegroundColor Yellow
            Write-Host "   gcloud secrets add-iam-policy-binding $secretName \`" -ForegroundColor Cyan
            Write-Host "     --member=`"serviceAccount:$serviceAccount`" \`" -ForegroundColor Cyan
            Write-Host "     --role=`"roles/secretmanager.secretAccessor`" \`" -ForegroundColor Cyan
            Write-Host "     --project=$GcpProjectId" -ForegroundColor Cyan
        }
    } else {
        $warnings += "Impossible de récupérer les permissions IAM"
        Write-Host "⚠️  Impossible de récupérer les permissions IAM" -ForegroundColor Yellow
    }
} else {
    # Utiliser le service account par défaut
    $defaultServiceAccount = "$GcpProjectId@appspot.gserviceaccount.com"
    Write-Host "⚠️  Service Account non trouvé, utilisation du défaut: $defaultServiceAccount" -ForegroundColor Yellow
    $serviceAccount = $defaultServiceAccount
}

# 3. VÉRIFIER LA CONFIGURATION DANS CLOUD RUN
Write-Host "`n3️⃣  VÉRIFICATION CONFIGURATION CLOUD RUN" -ForegroundColor Yellow
Write-Host "------------------------------------------" -ForegroundColor Yellow

# Récupérer la configuration complète du service
$serviceConfig = gcloud run services describe $GcpServiceName `
    --region=$GcpRegion `
    --project=$GcpProjectId `
    --format=json 2>&1

if ($LASTEXITCODE -eq 0) {
    $serviceJson = $serviceConfig | ConvertFrom-Json
    $containers = $serviceJson.spec.template.spec.containers
    
    if ($containers -and $containers.Count -gt 0) {
        $container = $containers[0]
        $envVars = $container.env
        $secrets = $container.envFrom
        
        # Vérifier les variables d'environnement
        $openaiVarFound = $false
        $openaiSecretRef = $null
        
        Write-Host "📋 Variables d'environnement configurées:" -ForegroundColor Gray
        foreach ($env in $envVars) {
            if ($env.name -eq "OPENAI_API_KEY") {
                $openaiVarFound = $true
                if ($env.valueFrom) {
                    $openaiSecretRef = $env.valueFrom.secretKeyRef
                    Write-Host "   ✅ OPENAI_API_KEY trouvée (référence secret)" -ForegroundColor Green
                    Write-Host "      Secret: $($openaiSecretRef.name)" -ForegroundColor Gray
                    Write-Host "      Version: $($openaiSecretRef.version)" -ForegroundColor Gray
                    $success += "OPENAI_API_KEY référencée dans Cloud Run"
                    
                    # Vérifier que le nom du secret correspond
                    if ($openaiSecretRef.name -ne $secretName) {
                        $warnings += "Nom du secret différent: $($openaiSecretRef.name) vs $secretName"
                        Write-Host "      ⚠️  Nom du secret différent: $($openaiSecretRef.name) vs $secretName" -ForegroundColor Yellow
                    }
                } elseif ($env.value) {
                    Write-Host "   ⚠️  OPENAI_API_KEY trouvée (valeur directe - NON RECOMMANDÉ)" -ForegroundColor Yellow
                    Write-Host "      Valeur: $($env.value.Substring(0, [Math]::Min(20, $env.value.Length)))..." -ForegroundColor Gray
                    $warnings += "OPENAI_API_KEY en valeur directe (devrait être un secret)"
                }
            }
        }
        
        if (-not $openaiVarFound) {
            Write-Host "❌ OPENAI_API_KEY N'EST PAS configurée dans Cloud Run" -ForegroundColor Red
            $errors += "OPENAI_API_KEY manquante dans Cloud Run"
            Write-Host ""
            Write-Host "🔧 SOLUTION: Ajouter la référence au secret avec cette commande:" -ForegroundColor Yellow
            Write-Host "   gcloud run services update $GcpServiceName \`" -ForegroundColor Cyan
            Write-Host "     --region=$GcpRegion \`" -ForegroundColor Cyan
            Write-Host "     --project=$GcpProjectId \`" -ForegroundColor Cyan
            Write-Host "     --update-secrets=`"OPENAI_API_KEY=$secretName:latest`"" -ForegroundColor Cyan
        }
    }
} else {
    $errors += "Impossible de récupérer la configuration Cloud Run"
    Write-Host "❌ Impossible de récupérer la configuration Cloud Run" -ForegroundColor Red
}

# 4. VÉRIFIER LES LOGS RÉCENTS
Write-Host "`n4️⃣  ANALYSE DES LOGS RÉCENTS" -ForegroundColor Yellow
Write-Host "-------------------------------" -ForegroundColor Yellow

Write-Host "Recuperation des logs recents (50 dernieres lignes)..." -ForegroundColor Gray
$logs = gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=$GcpServiceName" `
    --limit=50 `
    --project=$GcpProjectId `
    --format="value(textPayload)" 2>&1

if ($LASTEXITCODE -eq 0 -and $logs) {
    $openaiErrors = $logs | Where-Object { $_ -like "*OPENAI*" -or $_ -like "*openai*" -or $_ -like "*API key*" -or $_ -like "*non configur*" }
    
    if ($openaiErrors) {
        Write-Host "⚠️  Erreurs liées à OPENAI_API_KEY trouvées dans les logs:" -ForegroundColor Yellow
        foreach ($error in $openaiErrors) {
            Write-Host "   $error" -ForegroundColor Red
        }
        $warnings += "Erreurs OPENAI trouvées dans les logs"
    } else {
        Write-Host "✅ Aucune erreur OPENAI_API_KEY trouvée dans les logs récents" -ForegroundColor Green
        $success += "Pas d'erreurs dans les logs"
    }
} else {
    Write-Host "⚠️  Impossible de récupérer les logs" -ForegroundColor Yellow
    $warnings += "Impossible de récupérer les logs"
}

# 5. TEST DE CONNEXION AU SECRET (si possible)
Write-Host "`n5. TEST D'ACCES AU SECRET" -ForegroundColor Yellow
Write-Host "-----------------------------" -ForegroundColor Yellow

$secretCheckResult = gcloud secrets describe $secretName --project=$GcpProjectId 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "🔐 Tentative de lecture du secret (vérification d'accès)..." -ForegroundColor Gray
    $secretValue = gcloud secrets versions access latest --secret=$secretName --project=$GcpProjectId 2>&1
    
    if ($LASTEXITCODE -eq 0 -and $secretValue) {
        $secretLength = $secretValue.Length
        $secretPrefix = $secretValue.Substring(0, [Math]::Min(10, $secretLength))
        Write-Host "✅ Secret accessible, longueur: $secretLength caractères" -ForegroundColor Green
        Write-Host "   Préfixe: $secretPrefix..." -ForegroundColor Gray
        $success += "Secret accessible"
        
        # Vérifier le format de la clé
        if ($secretValue -like "sk-*") {
            Write-Host "✅ Format de la clé OpenAI valide (commence par 'sk-')" -ForegroundColor Green
        } else {
            $warnings += "Format de la clé OpenAI suspect (ne commence pas par 'sk-')"
            Write-Host "⚠️  Format de la clé suspect (ne commence pas par 'sk-')" -ForegroundColor Yellow
        }
    } else {
        $errors += "Impossible d'accéder au secret"
        Write-Host "❌ Impossible d'accéder au secret (permissions insuffisantes)" -ForegroundColor Red
    }
}

# RÉSUMÉ FINAL
$separator = "=" * 60
Write-Host "`n$separator" -ForegroundColor Cyan
Write-Host "📊 RÉSUMÉ DU DIAGNOSTIC" -ForegroundColor Cyan
Write-Host "="*60 -ForegroundColor Cyan
Write-Host ""

if ($success.Count -gt 0) {
    Write-Host "✅ SUCCÈS ($($success.Count)):" -ForegroundColor Green
    foreach ($item in $success) {
        Write-Host "   • $item" -ForegroundColor Gray
    }
    Write-Host ""
}

if ($warnings.Count -gt 0) {
    Write-Host "⚠️  AVERTISSEMENTS ($($warnings.Count)):" -ForegroundColor Yellow
    foreach ($item in $warnings) {
        Write-Host "   • $item" -ForegroundColor Gray
    }
    Write-Host ""
}

if ($errors.Count -gt 0) {
    Write-Host "❌ ERREURS CRITIQUES ($($errors.Count)):" -ForegroundColor Red
    foreach ($item in $errors) {
        Write-Host "   • $item" -ForegroundColor Gray
    }
    Write-Host ""
    Write-Host "🔧 ACTIONS REQUISES:" -ForegroundColor Yellow
    Write-Host "   1. Corriger les erreurs listées ci-dessus" -ForegroundColor White
    Write-Host "   2. Redéployer le service Cloud Run après corrections" -ForegroundColor White
    Write-Host "   3. Vérifier les logs après redéploiement" -ForegroundColor White
} else {
    Write-Host "✅ Aucune erreur critique trouvée!" -ForegroundColor Green
    Write-Host ""
    Write-Host "💡 Si le problème persiste, vérifiez:" -ForegroundColor Yellow
    Write-Host "   • Les logs détaillés du service Cloud Run" -ForegroundColor White
    Write-Host "   • Que le code backend utilise bien std::env::var('OPENAI_API_KEY')" -ForegroundColor White
    Write-Host "   • Que le service a été redéployé après configuration du secret" -ForegroundColor White
}

Write-Host ""
Write-Host "Pour voir les logs en temps reel:" -ForegroundColor Cyan
$logCommand = "gcloud logging tail `"resource.type=cloud_run_revision AND resource.labels.service_name=$GcpServiceName`" --project=$GcpProjectId"
Write-Host "   $logCommand" -ForegroundColor Gray
Write-Host ""

