# Script pour tester si la clé OpenAI est valide en faisant un appel API réel

param(
    [string]$GcpProjectId = "yukpo-project",
    [string]$SecretName = "openai-api-key"
)

Write-Host "🧪 Test de la clé OpenAI API" -ForegroundColor Cyan
Write-Host ""

# 1. Récupérer la clé depuis Secret Manager
Write-Host "1️⃣ Récupération de la clé depuis Secret Manager..." -ForegroundColor Yellow
$apiKey = gcloud secrets versions access latest --secret=$SecretName --project=$GcpProjectId 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "   ❌ Impossible de récupérer le secret" -ForegroundColor Red
    exit 1
}

if ($apiKey -notmatch "^sk-") {
    Write-Host "   ❌ Clé invalide (ne commence pas par 'sk-')" -ForegroundColor Red
    exit 1
}

$keyLength = $apiKey.Trim().Length
Write-Host "   ✅ Clé récupérée (longueur: $keyLength caractères)" -ForegroundColor Green

# 2. Tester la clé avec un appel API OpenAI simple
Write-Host ""
Write-Host "2️⃣ Test de la clé avec un appel API OpenAI..." -ForegroundColor Yellow

$headers = @{
    "Authorization" = "Bearer $apiKey"
    "Content-Type" = "application/json"
}

$body = @{
    model = "gpt-3.5-turbo"
    messages = @(
        @{
            role = "user"
            content = "Say hello"
        }
    )
    max_tokens = 10
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "https://api.openai.com/v1/chat/completions" -Method Post -Headers $headers -Body $body -TimeoutSec 30
    
    if ($response.choices) {
        Write-Host "   ✅ Clé OpenAI VALIDE - Test réussi!" -ForegroundColor Green
        Write-Host "   Réponse: $($response.choices[0].message.content)" -ForegroundColor Cyan
        exit 0
    } else {
        Write-Host "   ❌ Réponse inattendue de l'API" -ForegroundColor Red
        exit 1
    }
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    $errorMessage = $_.Exception.Message
    
    Write-Host "   ❌ Erreur lors du test API:" -ForegroundColor Red
    Write-Host "   Status Code: $statusCode" -ForegroundColor Red
    Write-Host "   Message: $errorMessage" -ForegroundColor Red
    
    if ($statusCode -eq 401) {
        Write-Host ""
        Write-Host "   💡 La clé OpenAI est INVALIDE ou EXPIRÉE" -ForegroundColor Yellow
        Write-Host "   Actions:" -ForegroundColor Yellow
        Write-Host "   1. Vérifier la clé sur https://platform.openai.com/api-keys" -ForegroundColor Yellow
        Write-Host "   2. Créer une nouvelle clé si nécessaire" -ForegroundColor Yellow
        Write-Host "   3. Mettre à jour le secret: gcloud secrets versions add $SecretName --data-file=- --project=$GcpProjectId" -ForegroundColor Yellow
    } elseif ($statusCode -eq 429) {
        Write-Host ""
        Write-Host "   💡 Rate limit dépassé (trop de requêtes)" -ForegroundColor Yellow
    } elseif ($statusCode -eq 403) {
        Write-Host ""
        Write-Host "   💡 Accès refusé - Vérifier les permissions de la clé" -ForegroundColor Yellow
    }
    
    exit 1
}

