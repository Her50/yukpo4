# Test de l'API de recherche avec authentification
Write-Host "=== Test de l'API de recherche ===" -ForegroundColor Green

# 1. Connexion utilisateur pour obtenir un token
Write-Host "1. Connexion utilisateur..." -ForegroundColor Yellow
$loginBody = @{
    email = "test@test.com"
    password = "Hernandez87"
} | ConvertTo-Json

try {
    $loginResponse = Invoke-WebRequest -Uri "http://localhost:3001/api/auth/login" -Method POST -Headers @{"Content-Type"="application/json"} -Body $loginBody
    $loginData = $loginResponse.Content | ConvertFrom-Json
    
    if ($loginData.token) {
        $token = $loginData.token
        Write-Host "✓ Connexion réussie, token obtenu" -ForegroundColor Green
        
        # 2. Test de recherche avec le token
        Write-Host "2. Test de recherche..." -ForegroundColor Yellow
        $searchBody = @{
            texte = "Je cherche un électricien"
        } | ConvertTo-Json
        
        $searchResponse = Invoke-WebRequest -Uri "http://localhost:3001/api/ia/auto" -Method POST -Headers @{
            "Content-Type"="application/json"
            "Authorization"="Bearer $token"
        } -Body $searchBody
        
        Write-Host "✓ Recherche réussie" -ForegroundColor Green
        Write-Host "Status: $($searchResponse.StatusCode)" -ForegroundColor Cyan
        Write-Host "Réponse:" -ForegroundColor Cyan
        $searchData = $searchResponse.Content | ConvertFrom-Json
        $searchData | ConvertTo-Json -Depth 10
        
    } else {
        Write-Host "✗ Échec de connexion: pas de token" -ForegroundColor Red
        Write-Host "Réponse: $($loginResponse.Content)" -ForegroundColor Red
    }
    
} catch {
    Write-Host "✗ Erreur lors de la connexion: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $errorResponse = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($errorResponse)
        $errorContent = $reader.ReadToEnd()
        Write-Host "Détails de l'erreur: $errorContent" -ForegroundColor Red
    }
} 