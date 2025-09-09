# Test simple de l'API pour diagnostiquer l'erreur
Write-Host "Test simple de l'API /api/ia/auto" -ForegroundColor Yellow

$baseUrl = "http://localhost:3001"

# Test 1: Endpoint de santé
Write-Host "1. Test endpoint de santé..." -ForegroundColor Cyan
try {
    $health = Invoke-WebRequest -Uri "$baseUrl/healthz" -Method GET
    Write-Host "Backend accessible: $($health.Content)" -ForegroundColor Green
} catch {
    Write-Host "Backend inaccessible: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Test 2: Test simple avec token de développement
Write-Host "2. Test /api/ia/auto avec token de développement..." -ForegroundColor Cyan
$headers = @{ 
    "Authorization" = "Bearer dev_token_12345"
    "Content-Type" = "application/json"
}

$testBody = @{
    texte = "Je veux créer un service de traiteur"
} | ConvertTo-Json

try {
    $response = Invoke-WebRequest -Uri "$baseUrl/api/ia/auto" -Method POST -Headers $headers -Body $testBody
    Write-Host "API fonctionne: Status $($response.StatusCode)" -ForegroundColor Green
    Write-Host "Réponse: $($response.Content)" -ForegroundColor Gray
} catch {
    Write-Host "Erreur API: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $stream = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($stream)
        $body = $reader.ReadToEnd()
        Write-Host "Détails: $body" -ForegroundColor Yellow
    }
}

Write-Host "Test terminé" -ForegroundColor Yellow 