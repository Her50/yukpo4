# Audit Complet OpenAI API dans GCP
# Verifie tous les aspects de la configuration OpenAI pour comprendre pourquoi l'API n'est pas accessible

param(
    [string]$GcpProjectId = "yukpo-project",
    [string]$GcpServiceName = "yukpo-backend",
    [string]$GcpRegion = "europe-west1",
    [string]$SecretName = "openai-api-key"
)

$ErrorActionPreference = "Continue"

Write-Host "AUDIT COMPLET - Configuration OpenAI dans GCP" -ForegroundColor Cyan
Write-Host ("=" * 80) -ForegroundColor Cyan
Write-Host ""

# Configuration
gcloud config set project $GcpProjectId | Out-Null

# ============================================================================
# 1. VERIFICATION DU SECRET DANS SECRET MANAGER
# ============================================================================
Write-Host "1. VERIFICATION DU SECRET DANS SECRET MANAGER" -ForegroundColor Yellow
Write-Host ("-" * 80) -ForegroundColor Gray

$secretExists = gcloud secrets describe $SecretName --project=$GcpProjectId 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "   OK Secret $SecretName existe" -ForegroundColor Green

    $versions = gcloud secrets versions list $SecretName --project=$GcpProjectId --format="value(name)" 2>&1
    if ($versions) {
        $latestVersion = ($versions | Select-Object -First 1)
        Write-Host "   Versions disponibles: $($versions.Count)" -ForegroundColor Cyan
        Write-Host "   Derniere version: $latestVersion" -ForegroundColor Cyan
    }

    Write-Host "   Verification de la valeur du secret..." -ForegroundColor Cyan
    $secretValue = gcloud secrets versions access latest --secret=$SecretName --project=$GcpProjectId 2>&1

    if ($LASTEXITCODE -eq 0 -and $secretValue) {
        $keyLength = $secretValue.Length
        if ($keyLength -gt 20) {
            $keyPrefix = $secretValue.Substring(0, 20)
        } else {
            $keyPrefix = $secretValue
        }

        if ($secretValue -match "^sk-") {
            Write-Host "   OK Format valide (commence par sk-, longueur: $keyLength caracteres)" -ForegroundColor Green
            Write-Host "   Prefixe: $keyPrefix..." -ForegroundColor Gray
        } else {
            Write-Host "   ERREUR Format INVALIDE (ne commence pas par sk-)" -ForegroundColor Red
            Write-Host "   Le secret doit contenir une cle OpenAI valide (format: sk-proj-...)" -ForegroundColor Yellow
        }
    } else {
        Write-Host "   ERREUR Impossible de lire la valeur du secret" -ForegroundColor Red
        Write-Host "   Erreur: $secretValue" -ForegroundColor Yellow
    }
} else {
    Write-Host "   ERREUR Secret $SecretName N EXISTE PAS" -ForegroundColor Red
    Write-Host "   Creer le secret avec: gcloud secrets create $SecretName --data-file=- --project=$GcpProjectId" -ForegroundColor Yellow
}

Write-Host ""

# ============================================================================
# 2. VERIFICATION DES PERMISSIONS IAM
# ============================================================================
Write-Host "2. VERIFICATION DES PERMISSIONS IAM" -ForegroundColor Yellow
Write-Host ("-" * 80) -ForegroundColor Gray

$serviceAccount = gcloud run services describe $GcpServiceName --region=$GcpRegion --format="value(spec.template.spec.serviceAccountName)" --project=$GcpProjectId 2>&1

if ($LASTEXITCODE -eq 0 -and $serviceAccount) {
    Write-Host "   OK Service Account identifie: $serviceAccount" -ForegroundColor Green

    Write-Host "   Verification des permissions IAM..." -ForegroundColor Cyan
    $iamPolicyJson = gcloud secrets get-iam-policy $SecretName --project=$GcpProjectId --format=json 2>&1
    $iamPolicy = $null
    if ($LASTEXITCODE -eq 0) {
        try {
            $iamPolicy = $iamPolicyJson | ConvertFrom-Json
        } catch {
            Write-Host "   ATTENTION Impossible de parser la politique IAM" -ForegroundColor Yellow
        }
    }

    if ($iamPolicy -and $iamPolicy.bindings) {
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
            Write-Host "   OK Service Account a acces au secret (role: secretmanager.secretAccessor)" -ForegroundColor Green
        } else {
            Write-Host "   ERREUR Service Account N A PAS acces au secret" -ForegroundColor Red
            Write-Host "   Commande pour corriger:" -ForegroundColor Yellow
            $q = [char]34
            Write-Host ("      gcloud secrets add-iam-policy-binding " + $SecretName + " " + $q) -ForegroundColor White
            Write-Host ("        --member=" + $q + "serviceAccount:$serviceAccount" + $q + " " + $q) -ForegroundColor White
            Write-Host ("        --role=" + $q + "roles/secretmanager.secretAccessor" + $q + " " + $q) -ForegroundColor White
            Write-Host "        --project=$GcpProjectId" -ForegroundColor White
        }
    } else {
        Write-Host "   ATTENTION Impossible de recuperer la politique IAM" -ForegroundColor Yellow
    }
} else {
    Write-Host "   ATTENTION Service Account par defaut sera utilise" -ForegroundColor Yellow
    $serviceAccount = "$GcpProjectId@appspot.gserviceaccount.com"
    Write-Host "   Service Account suppose: $serviceAccount" -ForegroundColor Cyan
}

Write-Host ""

# ============================================================================
# 3. VERIFICATION DE LA CONFIGURATION CLOUD RUN
# ============================================================================
Write-Host "3. VERIFICATION DE LA CONFIGURATION CLOUD RUN" -ForegroundColor Yellow
Write-Host ("-" * 80) -ForegroundColor Gray

$serviceConfig = gcloud run services describe $GcpServiceName --region=$GcpRegion --format=json --project=$GcpProjectId 2>&1 | ConvertFrom-Json

if ($LASTEXITCODE -eq 0) {
    Write-Host "   OK Service Cloud Run trouve" -ForegroundColor Green

    $envVars = $serviceConfig.spec.template.spec.containers[0].env
    $openaiFound = $false
    $openaiIsSecret = $false

    if ($envVars) {
        foreach ($envVar in $envVars) {
            if ($envVar.name -eq "OPENAI_API_KEY") {
                $openaiFound = $true
                if ($envVar.valueFrom) {
                    $openaiIsSecret = $true
                    $secretRef = $envVar.valueFrom.secretKeyRef
                    Write-Host "   OK OPENAI_API_KEY est configuree comme SECRET" -ForegroundColor Green
                    Write-Host "      Secret: $($secretRef.name)" -ForegroundColor Cyan
                    Write-Host "      Version: $($secretRef.version)" -ForegroundColor Cyan

                    if ($secretRef.name -ne $SecretName) {
                        Write-Host "   ATTENTION Le secret reference ($($secretRef.name)) ne correspond pas au nom attendu ($SecretName)" -ForegroundColor Yellow
                    }
                } elseif ($envVar.value) {
                    Write-Host "   ATTENTION OPENAI_API_KEY est une valeur DIRECTE (pas un secret)" -ForegroundColor Yellow
                    Write-Host "      Recommandation: Utiliser Secret Manager pour la securite" -ForegroundColor Yellow
                }
                break
            }
        }
    }

    if (-not $openaiFound) {
        Write-Host "   ERREUR OPENAI_API_KEY N EST PAS configuree dans Cloud Run" -ForegroundColor Red
        Write-Host "   Commande pour corriger:" -ForegroundColor Yellow
        Write-Host "      gcloud run services update $GcpServiceName" -ForegroundColor White
        Write-Host "        --region=$GcpRegion" -ForegroundColor White
        Write-Host "        --project=$GcpProjectId" -ForegroundColor White
        Write-Host ("        --update-secrets=OPENAI_API_KEY=" + $SecretName + ":latest") -ForegroundColor White
    }

    $latestRevision = $serviceConfig.status.latestReadyRevisionName
    Write-Host "   Derniere revision: $latestRevision" -ForegroundColor Cyan

} else {
    Write-Host "   ERREUR Impossible de recuperer la configuration du service" -ForegroundColor Red
    Write-Host "   Erreur: $serviceConfig" -ForegroundColor Yellow
}

Write-Host ""

# ============================================================================
# 4. VERIFICATION DES LOGS RECENTS
# ============================================================================
Write-Host "4. ANALYSE DES LOGS RECENTS (30 dernieres minutes)" -ForegroundColor Yellow
Write-Host ("-" * 80) -ForegroundColor Gray

$logFilter = "resource.type=cloud_run_revision AND resource.labels.service_name=" + $GcpServiceName
$logsRaw = gcloud logging read $logFilter --limit=200 --project=$GcpProjectId --format=json --freshness=30m 2>&1 | ConvertFrom-Json
$logs = @($logsRaw)

if ($logs -and $logs.Count -gt 0) {
    Write-Host "   OK $($logs.Count) entrees de log trouvees" -ForegroundColor Green

    $getMsg = { if ($_.textPayload) { $_.textPayload } elseif ($_.jsonPayload -and $_.jsonPayload.message) { $_.jsonPayload.message } else { $null } }
    $openaiLogs = $logs | Where-Object {
        $msg = & $getMsg
        $msg -and (
            $msg -like '*OPENAI*' -or $msg -like '*openai*' -or
            $msg -like '*AppIA*' -or $msg -like '*initialize_models*' -or
            $msg -like '*MAIN*OPENAI*' -or $msg -like '*modele*'
        )
    }

    if ($openaiLogs) {
        Write-Host "   Logs OpenAI trouves:" -ForegroundColor Cyan
        $openaiLogs | Select-Object -First 5 | ForEach-Object {
            $timestamp = if ($_.timestamp) { $_.timestamp } else { "N/A" }
            $severity = if ($_.severity) { $_.severity } else { "INFO" }
            $message = if ($_.textPayload) { $_.textPayload } else { $_.jsonPayload.message }
            Write-Host "      [$timestamp] [$severity] $message" -ForegroundColor Gray
        }

        $errors = $openaiLogs | Where-Object {
            $m = & $getMsg
            $_.severity -eq "ERROR" -or ($m -and ($m -like '*NON TROUVEE*' -or $m -like '*MANQUANTE*'))
        }

        if ($errors) {
            Write-Host "   ERREURS OpenAI trouvees:" -ForegroundColor Red
            $errors | Select-Object -First 3 | ForEach-Object {
                $message = if ($_.textPayload) { $_.textPayload } else { $_.jsonPayload.message }
                Write-Host "      $message" -ForegroundColor Red
            }
        } else {
            Write-Host "   OK Aucune erreur OpenAI dans les logs" -ForegroundColor Green
        }
    } else {
        Write-Host "   ATTENTION Aucun log OpenAI trouve (peut indiquer que l IA ne s initialise pas)" -ForegroundColor Yellow
    }

    $initLogs = $logs | Where-Object {
        $msg = & $getMsg
        $msg -and ($msg -like '*initialize_models*' -or $msg -like '*Debut initialisation*' -or $msg -like '*AppIA initialise*')
    }

    if ($initLogs) {
        Write-Host "   OK Logs d initialisation AppIA trouves" -ForegroundColor Green
    } else {
        Write-Host "   ATTENTION Aucun log d initialisation AppIA trouve" -ForegroundColor Yellow
        Write-Host "      Cela peut indiquer que AppIA ne s initialise pas au demarrage" -ForegroundColor Yellow
    }
} else {
    Write-Host "   ATTENTION Aucun log trouve (le service peut etre recent ou ne pas avoir genere de logs)" -ForegroundColor Yellow
}

Write-Host ""

# ============================================================================
# 5. TEST D ACCES AU SECRET
# ============================================================================
Write-Host "5. TEST D ACCES AU SECRET" -ForegroundColor Yellow
Write-Host ("-" * 80) -ForegroundColor Gray

Write-Host "   Test d acces au secret avec le Service Account..." -ForegroundColor Cyan

$testAccess = gcloud secrets versions access latest --secret=$SecretName --project=$GcpProjectId 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "   OK Acces au secret reussi" -ForegroundColor Green
} else {
    Write-Host "   ERREUR Echec d acces au secret" -ForegroundColor Red
    Write-Host "   Erreur: $testAccess" -ForegroundColor Yellow
}

Write-Host ""

# ============================================================================
# 6. VARIABLES D ENVIRONNEMENT
# ============================================================================
Write-Host "6. VARIABLES D ENVIRONNEMENT CONFIGUREES" -ForegroundColor Yellow
Write-Host ("-" * 80) -ForegroundColor Gray

if ($serviceConfig) {
    $envVars = $serviceConfig.spec.template.spec.containers[0].env
    if ($envVars) {
        Write-Host "   Variables d environnement configurees: $($envVars.Count)" -ForegroundColor Cyan

        $iaVars = $envVars | Where-Object {
            $_.name -like '*AI*' -or
            $_.name -like '*OPENAI*' -or
            $_.name -like '*MISTRAL*' -or
            $_.name -like '*GEMINI*' -or
            $_.name -like '*ANTHROPIC*'
        }

        if ($iaVars) {
            Write-Host "   Variables IA configurees:" -ForegroundColor Cyan
            foreach ($var in $iaVars) {
                $type = if ($var.valueFrom) { "SECRET" } else { "VALUE" }
                Write-Host "      - $($var.name): $type" -ForegroundColor Gray
            }
        } else {
            Write-Host "   ATTENTION Aucune variable IA trouvee" -ForegroundColor Yellow
        }
    }
}

Write-Host ""

# ============================================================================
# 7. RESUME ET RECOMMANDATIONS
# ============================================================================
Write-Host "RESUME DE L AUDIT" -ForegroundColor Cyan
Write-Host ("=" * 80) -ForegroundColor Cyan
Write-Host ""

$issues = @()

if ($LASTEXITCODE -ne 0 -or -not $secretExists) {
    $issues += "Secret $SecretName n existe pas dans Secret Manager"
}

if (-not $openaiFound) {
    $issues += "OPENAI_API_KEY n est pas configuree dans Cloud Run"
}

if ($issues.Count -eq 0) {
    Write-Host "OK Configuration semble correcte" -ForegroundColor Green
    Write-Host ""
    Write-Host "Si le probleme persiste, verifier:" -ForegroundColor Yellow
    Write-Host "   1. La cle OpenAI est valide et a des credits (https://platform.openai.com/usage)" -ForegroundColor White
    Write-Host "   2. Les quotas OpenAI ne sont pas depasses" -ForegroundColor White
    Write-Host "   3. Le service Cloud Run a ete redeploye apres la configuration" -ForegroundColor White
    Write-Host "   4. Les logs de demarrage montrent que AppIA s initialise correctement" -ForegroundColor White
} else {
    Write-Host "Problemes identifies:" -ForegroundColor Red
    foreach ($issue in $issues) {
        Write-Host "   $issue" -ForegroundColor Red
    }
    Write-Host ""
    Write-Host "Actions recommandees:" -ForegroundColor Yellow
    Write-Host "   1. Executer le script de correction: .\scripts\fix-openai-api-key-gcp.ps1" -ForegroundColor White
    Write-Host "   2. Ou suivre les commandes affichees ci-dessus" -ForegroundColor White
}

Write-Host ""
Write-Host "Pour voir les logs en temps reel:" -ForegroundColor Cyan
$dq = [char]34
Write-Host ("   gcloud logging tail " + $dq + "resource.type=cloud_run_revision AND resource.labels.service_name=" + $GcpServiceName + $dq + " --project=" + $GcpProjectId) -ForegroundColor White
Write-Host ""
Write-Host "Pour les logs de demarrage (2h) et chercher OPENAI/AppIA:" -ForegroundColor Cyan
Write-Host "   gcloud logging read resource.type=cloud_run_revision AND resource.labels.service_name=$GcpServiceName --limit=300 --project=$GcpProjectId --format=json --freshness=2h > logs-demarrage.json" -ForegroundColor White
Write-Host "   Puis ouvrir logs-demarrage.json et chercher OPENAI, AppIA, MAIN, initialize_models" -ForegroundColor Gray
Write-Host ""
Write-Host "Pour forcer un redeploiement (recharger les secrets):" -ForegroundColor Cyan
Write-Host "   gcloud run services update $GcpServiceName --region=$GcpRegion --project=$GcpProjectId --no-traffic" -ForegroundColor White
Write-Host ""
Write-Host "Audit termine" -ForegroundColor Green
