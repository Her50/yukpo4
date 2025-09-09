Write-Host "Vérification des variables d'environnement du backend" -ForegroundColor Cyan

# Vérifier les variables d'environnement
Write-Host "`nVariables d'environnement:" -ForegroundColor Yellow

$env_vars = @(
    "YUKPO_API_KEY",
    "EMBEDDING_API_URL",
    "EMBEDDING_TIMEOUT_SECONDS",
    "EMBEDDING_MAX_RETRIES"
)

foreach ($var in $env_vars) {
    $value = [Environment]::GetEnvironmentVariable($var)
    if ($value) {
        Write-Host "  ✅ $var = $value" -ForegroundColor Green
    } else {
        Write-Host "  ❌ $var = (non définie)" -ForegroundColor Red
    }
}

# Test de communication directe avec la clé attendue
Write-Host "`nTest de communication avec la clé attendue..." -ForegroundColor Yellow

$headers = @{
    "Content-Type" = "application/json"
    "x-api-key" = "yukpo_embedding_key_2024"
}

$payload = @{
    query = "je cherche un pressing"
    type_donnee = "texte"
    top_k = 5
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "http://localhost:8000/search_embedding_pinecone" -Method POST -Headers $headers -Body $payload -TimeoutSec 30
    
    Write-Host "✅ Communication réussie avec la clé attendue" -ForegroundColor Green
    Write-Host "Nombre de résultats: $($response.results.Count)" -ForegroundColor Yellow
} catch {
    Write-Host "❌ Erreur avec la clé attendue: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`nVérification terminée" -ForegroundColor Green 