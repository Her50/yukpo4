# Script de vérification complète de OPENAI_API_KEY dans GCP
# Vérifie le secret, les permissions, la configuration Cloud Run et les logs

param(
    [string]$GcpProjectId = "yukpo-project",
    [string]$GcpServiceName = "yukpo-backend",
    [string]$GcpRegion = "europe-west1",
    [string]$SecretName = "openai-api-key"
)

Write-Host "🔍 Vérification complète de OPENAI_API_KEY dans GCP" -ForegroundColor Cyan
Write-Host ""

# 1. Vérifier si le secret existe
Write-Host "1️⃣ Vérification du secret dans Secret Manager..." -ForegroundColor Yellow
$secretExists = gcloud secrets describe $SecretName --project=$GcpProjectId 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "   ✅ Secret '$SecretName' existe" -ForegroundColor Green
    
    # Vérifier la valeur du secret (sans l'afficher complètement)
    $secretValue = gcloud secrets versions access latest --secret=$SecretName --project=$GcpProjectId 2>&1
    if ($secretValue -match "^sk-") {
        $keyLength = $secretValue.Length
        Write-Host "   ✅ Secret valide (commence par 'sk-', longueur: $keyLength caractères)" -ForegroundColor Green
    } else {
        Write-Host "   ❌ Secret invalide ou vide (ne commence pas par 'sk-')" -ForegroundColor Red
        Write-Host "   💡 Le secret doit contenir une clé OpenAI valide (format: sk-proj-...)" -ForegroundColor Yellow
    }
} else {
    Write-Host "   ❌ Secret '$SecretName' n'existe pas" -ForegroundColor Red
    exit 1
}

Write-Host ""

# 2. Vérifier les permissions du Service Account
Write-Host "2️⃣ Vérification des permissions IAM..." -ForegroundColor Yellow
$serviceAccount = gcloud run services describe $GcpServiceName --region=$GcpRegion --project=$GcpProjectId --format="value(spec.template.spec.serviceAccountName)" 2>&1
if ($LASTEXITCODE -eq 0 -and $serviceAccount) {
    Write-Host "   Service Account: $serviceAccount" -ForegroundColor Cyan
    
    $hasPermission = gcloud secrets get-iam-policy $SecretName --project=$GcpProjectId --format="get(bindings[].members)" 2>&1 | Select-String -Pattern $serviceAccount
    if ($hasPermission) {
        Write-Host "   ✅ Service Account a accès au secret" -ForegroundColor Green
    } else {
        Write-Host "   ❌ Service Account n'a PAS accès au secret" -ForegroundColor Red
        Write-Host "   💡 Exécuter: gcloud secrets add-iam-policy-binding $SecretName --member=`"serviceAccount:$serviceAccount`" --role=`"roles/secretmanager.secretAccessor`" --project=$GcpProjectId" -ForegroundColor Yellow
    }
} else {
    Write-Host "   ⚠️ Impossible de récupérer le Service Account" -ForegroundColor Yellow
}

Write-Host ""

# 3. Vérifier la configuration dans Cloud Run
Write-Host "3️⃣ Vérification de la configuration Cloud Run..." -ForegroundColor Yellow
$envVars = gcloud run services describe $GcpServiceName --region=$GcpRegion --project=$GcpProjectId --format="get(spec.template.spec.containers[0].env)" 2>&1
if ($envVars -match "OPENAI_API_KEY") {
    Write-Host "   ✅ OPENAI_API_KEY est configurée dans Cloud Run" -ForegroundColor Green
    
    # Vérifier si c'est un secret ou une valeur directe
    if ($envVars -match "valueFrom") {
        Write-Host "   ✅ OPENAI_API_KEY est référencée depuis Secret Manager" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️ OPENAI_API_KEY est une valeur directe (pas un secret)" -ForegroundColor Yellow
    }
} else {
    Write-Host "   ❌ OPENAI_API_KEY n'est PAS configurée dans Cloud Run" -ForegroundColor Red
    Write-Host "   💡 Exécuter: gcloud run services update $GcpServiceName --region=$GcpRegion --project=$GcpProjectId --update-secrets=`"OPENAI_API_KEY=$SecretName:latest`"" -ForegroundColor Yellow
}

Write-Host ""

# 4. Vérifier les logs récents
Write-Host "4️⃣ Analyse des logs récents (30 dernières minutes)..." -ForegroundColor Yellow
$logs = gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=$GcpServiceName" --limit=100 --project=$GcpProjectId --format=json --freshness=30m 2>&1 | ConvertFrom-Json

$openaiErrors = $logs | Where-Object { 
    $_.textPayload -like '*OPENAI*' -or 
    $_.textPayload -like '*openai*' -or 
    $_.textPayload -like '*API*key*' -or
    $_.textPayload -like '*401*' -or
    $_.textPayload -like '*403*' -or
    $_.textPayload -like '*unauthorized*'
}

if ($openaiErrors) {
    Write-Host "   ⚠️ Erreurs OpenAI trouvées dans les logs:" -ForegroundColor Yellow
    $openaiErrors | Select-Object -First 5 | ForEach-Object {
        Write-Host "   [$($_.timestamp)] $($_.severity): $($_.textPayload)" -ForegroundColor Red
    }
} else {
    Write-Host "   ✅ Aucune erreur OpenAI dans les logs récents" -ForegroundColor Green
}

Write-Host ""

# 5. Résumé
Write-Host "📊 Résumé de la vérification:" -ForegroundColor Cyan
Write-Host "   - Secret existe: ✅" -ForegroundColor Green
Write-Host "   - Permissions IAM: Vérifiez ci-dessus" -ForegroundColor Yellow
Write-Host "   - Configuration Cloud Run: Vérifiez ci-dessus" -ForegroundColor Yellow
Write-Host "   - Logs: Vérifiez ci-dessus" -ForegroundColor Yellow
Write-Host ""
Write-Host "💡 Si tout est ✅, le problème peut venir de:" -ForegroundColor Yellow
Write-Host "   1. La valeur du secret n'est pas une clé OpenAI valide" -ForegroundColor Yellow
Write-Host "   2. La clé OpenAI a expiré ou été révoquée" -ForegroundColor Yellow
Write-Host "   3. Le service n'a pas encore redémarré après la configuration" -ForegroundColor Yellow
Write-Host "   4. Les quotas OpenAI sont dépassés" -ForegroundColor Yellow

