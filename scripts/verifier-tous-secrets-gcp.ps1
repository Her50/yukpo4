# Script pour verifier tous les secrets dans GCP
# Usage: .\scripts\verifier-tous-secrets-gcp.ps1

param(
    [string]$GcpProjectId = "yukpo-project",
    [string]$GcpRegion = "europe-west1",
    [string]$GcpServiceName = "yukpo-backend"
)

Write-Host ""
Write-Host "VERIFICATION COMPLETE DE TOUS LES SECRETS GCP" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "Projet: $GcpProjectId" -ForegroundColor Yellow
Write-Host "Region: $GcpRegion" -ForegroundColor Yellow
Write-Host "Service: $GcpServiceName" -ForegroundColor Yellow
Write-Host ""

# Configuration gcloud
gcloud config set project $GcpProjectId | Out-Null

# Liste de tous les secrets qui devraient exister
$expectedSecrets = @{
    "DATABASE_URL" = "database-url"
    "REDIS_URL" = "redis-url"
    "JWT_SECRET" = "jwt-secret"
    "MONGODB_URL" = "mongodb-url"
    "OPENAI_API_KEY" = "openai-api-key"
    "AUPHONIC_API_KEY" = "auphonic-api-key"
    "EMBEDDING_API_KEY" = "embedding-api-key"
    "GOOGLE_CLIENT_ID" = "google-client-id"
    "GOOGLE_MAPS_API_KEY" = "google-maps-api-key"
    "GOOGLE_TRANSLATE_API_KEY" = "google-translate-api-key"
    "LIVEKIT_API_KEY" = "livekit-api-key"
    "LIVEKIT_API_SECRET" = "livekit-api-secret"
    "PEXELS_API_KEY" = "pexels-api-key"
    "PIXABAY_API_KEY" = "pixabay-api-key"
    "S3_ACCESS_KEY" = "s3-access-key"
    "S3_SECRET_KEY" = "s3-secret-key"
    "SENDGRID_API_KEY" = "sendgrid-api-key"
    "SORA_API_KEY" = "sora-api-key"
    "TWILIO_ACCOUNT_SID" = "twilio-account-sid"
    "TWILIO_AUTH_TOKEN" = "twilio-auth-token"
    "TWILIO_FROM_NUMBER" = "twilio-from-number"
    "UNSPLASH_ACCESS_KEY" = "unsplash-access-key"
    "VIDEO_RENDERER_RPC_TOKEN" = "video-renderer-rpc-token"
    "YOUTUBE_CLIENT_ID" = "youtube-client-id"
    "YOUTUBE_CLIENT_SECRET" = "youtube-client-secret"
    "YUKPO_API_KEY" = "yukpo-api-key"
}

# Recuperer le service account
Write-Host "Recuperation du Service Account..." -ForegroundColor Yellow
$serviceAccountOutput = gcloud run services describe $GcpServiceName --region=$GcpRegion --project=$GcpProjectId --format="value(spec.template.spec.serviceAccountName)" 2>&1
$serviceAccount = $serviceAccountOutput.Trim()

if ($LASTEXITCODE -ne 0 -or -not $serviceAccount -or $serviceAccount -eq "") {
    $serviceAccount = "$GcpProjectId@appspot.gserviceaccount.com"
    Write-Host "   Utilisation du Service Account par defaut: $serviceAccount" -ForegroundColor Gray
} else {
    Write-Host "   Service Account trouve: $serviceAccount" -ForegroundColor Green
}
Write-Host ""

# Recuperer la configuration Cloud Run
Write-Host "Recuperation de la configuration Cloud Run..." -ForegroundColor Yellow
$serviceConfigOutput = gcloud run services describe $GcpServiceName --region=$GcpRegion --project=$GcpProjectId --format=json 2>&1

if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERREUR] Impossible de recuperer la configuration Cloud Run" -ForegroundColor Red
    exit 1
}

$serviceJson = $serviceConfigOutput | ConvertFrom-Json
$containers = $serviceJson.spec.template.spec.containers
$envVars = $containers[0].env

# Creer un dictionnaire des variables configurees dans Cloud Run
$configuredVars = @{}
foreach ($env in $envVars) {
    if ($env.valueFrom -and $env.valueFrom.secretKeyRef) {
        $configuredVars[$env.name] = @{
            Type = "Secret"
            SecretName = $env.valueFrom.secretKeyRef.name
            Version = $env.valueFrom.secretKeyRef.version
        }
    } elseif ($env.value) {
        $configuredVars[$env.name] = @{
            Type = "Direct"
            Value = $env.value.Substring(0, [Math]::Min(20, $env.value.Length))
        }
    }
}

# Resultats
$results = @{
    OK = @()
    MissingSecret = @()
    MissingPermission = @()
    MissingInCloudRun = @()
    WrongReference = @()
    DirectValue = @()
}

Write-Host "VERIFICATION DES SECRETS" -ForegroundColor Yellow
Write-Host "========================" -ForegroundColor Yellow
Write-Host ""

foreach ($varName in $expectedSecrets.Keys) {
    $secretName = $expectedSecrets[$varName]
    Write-Host "Verification: $varName -> $secretName" -ForegroundColor Gray
    
    $hasError = $false
    
    # 1. Verifier si le secret existe
    $secretCheck = gcloud secrets describe $secretName --project=$GcpProjectId 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "   [ERREUR] Secret '$secretName' n'existe pas dans Secret Manager" -ForegroundColor Red
        $results.MissingSecret += "$varName (secret: $secretName)"
        $hasError = $true
        Write-Host ""
        continue
    }
    
    # 2. Verifier les permissions
    $iamPolicyOutput = gcloud secrets get-iam-policy $secretName --project=$GcpProjectId --format=json 2>&1
    $hasPermission = $false
    if ($LASTEXITCODE -eq 0) {
        try {
            $policyJson = $iamPolicyOutput | ConvertFrom-Json
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
            # Ignore parsing errors
        }
    }
    
    if (-not $hasPermission) {
        Write-Host "   [ERREUR] Service Account n'a pas acces au secret" -ForegroundColor Red
        $results.MissingPermission += "$varName (secret: $secretName)"
        $hasError = $true
    }
    
    # 3. Verifier si la variable est configuree dans Cloud Run
    if (-not $configuredVars.ContainsKey($varName)) {
        Write-Host "   [ERREUR] Variable '$varName' n'est pas configuree dans Cloud Run" -ForegroundColor Red
        $results.MissingInCloudRun += "$varName (secret: $secretName)"
        $hasError = $true
    } else {
        $config = $configuredVars[$varName]
        if ($config.Type -eq "Direct") {
            Write-Host "   [WARN] Variable '$varName' est en valeur directe (devrait etre un secret)" -ForegroundColor Yellow
            $results.DirectValue += "$varName (valeur: $($config.Value)...)"
            $hasError = $true
        } elseif ($config.Type -eq "Secret") {
            if ($config.SecretName -ne $secretName) {
                Write-Host "   [WARN] Variable '$varName' reference un secret different: $($config.SecretName) vs $secretName" -ForegroundColor Yellow
                $results.WrongReference += "$varName (reference: $($config.SecretName), attendu: $secretName)"
                $hasError = $true
            } else {
                Write-Host "   [OK] Variable configuree correctement" -ForegroundColor Green
                $results.OK += "$varName"
            }
        }
    }
    
    if (-not $hasError) {
        Write-Host "   [OK] Tout est correct" -ForegroundColor Green
    }
    Write-Host ""
}

# Resume final
Write-Host ""
$separator = "=" * 60
Write-Host $separator -ForegroundColor Cyan
Write-Host "RESUME DE LA VERIFICATION" -ForegroundColor Cyan
Write-Host $separator -ForegroundColor Cyan
Write-Host ""

if ($results.OK.Count -gt 0) {
    Write-Host "SECRETS CORRECTEMENT CONFIGURES ($($results.OK.Count)):" -ForegroundColor Green
    foreach ($item in $results.OK) {
        Write-Host "   + $item" -ForegroundColor Gray
    }
    Write-Host ""
}

if ($results.MissingSecret.Count -gt 0) {
    Write-Host "SECRETS MANQUANTS DANS SECRET MANAGER ($($results.MissingSecret.Count)):" -ForegroundColor Red
    foreach ($item in $results.MissingSecret) {
        Write-Host "   - $item" -ForegroundColor Gray
    }
    Write-Host ""
}

if ($results.MissingPermission.Count -gt 0) {
    Write-Host "PERMISSIONS MANQUANTES ($($results.MissingPermission.Count)):" -ForegroundColor Red
    foreach ($item in $results.MissingPermission) {
        Write-Host "   - $item" -ForegroundColor Gray
    }
    Write-Host ""
}

if ($results.MissingInCloudRun.Count -gt 0) {
    Write-Host "VARIABLES MANQUANTES DANS CLOUD RUN ($($results.MissingInCloudRun.Count)):" -ForegroundColor Red
    foreach ($item in $results.MissingInCloudRun) {
        Write-Host "   - $item" -ForegroundColor Gray
    }
    Write-Host ""
}

if ($results.WrongReference.Count -gt 0) {
    Write-Host "REFERENCES INCORRECTES ($($results.WrongReference.Count)):" -ForegroundColor Yellow
    foreach ($item in $results.WrongReference) {
        Write-Host "   ! $item" -ForegroundColor Gray
    }
    Write-Host ""
}

if ($results.DirectValue.Count -gt 0) {
    Write-Host "VARIABLES EN VALEUR DIRECTE ($($results.DirectValue.Count)):" -ForegroundColor Yellow
    foreach ($item in $results.DirectValue) {
        Write-Host "   ! $item" -ForegroundColor Gray
    }
    Write-Host ""
}

# Generer un script de correction si necessaire
$totalErrors = $results.MissingSecret.Count + $results.MissingPermission.Count + $results.MissingInCloudRun.Count + $results.WrongReference.Count + $results.DirectValue.Count

if ($totalErrors -gt 0) {
    Write-Host "ACTIONS REQUISES:" -ForegroundColor Yellow
    Write-Host "   1. Creer les secrets manquants dans Secret Manager" -ForegroundColor White
    Write-Host "   2. Attribuer les permissions manquantes au Service Account" -ForegroundColor White
    Write-Host "   3. Ajouter les variables manquantes dans Cloud Run" -ForegroundColor White
    Write-Host "   4. Corriger les references incorrectes" -ForegroundColor White
    Write-Host ""
    Write-Host "Voulez-vous generer un script de correction automatique? (O/N)" -ForegroundColor Cyan
    Write-Host "   Utilisez: .\scripts\generer-script-correction-secrets.ps1" -ForegroundColor Gray
} else {
    Write-Host "[OK] Tous les secrets sont correctement configures!" -ForegroundColor Green
}

Write-Host ""

