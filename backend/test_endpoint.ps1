# Test de l'endpoint de test simple
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$baseUrl = "http://localhost:3001"

# Creer un utilisateur de test
$email = "test_user_$(Get-Random)@yukpo.com"
$password = "Test1234!"

# Creation utilisateur
$registerBody = @{ email = $email; password = $password; lang = "fr" }
try {
    Invoke-RestMethod -Uri "$baseUrl/auth/register" -Method POST -Body ($registerBody | ConvertTo-Json) -ContentType "application/json"
    Write-Host "Utilisateur cree: $email"
} catch {
    Write-Host "Erreur creation (peut-etre existe deja): $($_.Exception.Message)" -ForegroundColor Yellow
}

# Login
$loginBody = @{ email = $email; password = $password }
try {
    $loginResponse = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method POST -Body ($loginBody | ConvertTo-Json) -ContentType "application/json"
    $jwtToken = $loginResponse.token
    Write-Host "Connexion reussie, token recupere"
} catch {
    Write-Host "Erreur login: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

$headers = @{ 
    Authorization = "Bearer $jwtToken"
    "Content-Type" = "application/json; charset=utf-8" 
}

# Test endpoint simple
Write-Host "Test de /api/ia/test..."
$testBody = @{ message = "Test simple" }

try {
    $response = Invoke-RestMethod -Uri "$baseUrl/api/ia/test" -Method POST -Body ($testBody | ConvertTo-Json) -ContentType "application/json" -Headers $headers -TimeoutSec 30
    Write-Host "SUCCESS! Endpoint /api/ia/test fonctionne !" -ForegroundColor Green
    Write-Host ($response | ConvertTo-Json -Depth 5)
} catch {
    Write-Host "ERREUR /api/ia/test: $($_.Exception.Message)" -ForegroundColor Red
}

# Test endpoint principal
Write-Host "`nTest de /api/ia/auto..."
$autoBody = @{ 
    texte = "Je veux creer un service de cours de maths"
    base64_image = @()
    audio_base64 = $null
    video_base64 = $null
    doc_base64 = @()
    excel_base64 = $null
    site_web = $null
    gps_mobile = $null
}

try {
    $response = Invoke-RestMethod -Uri "$baseUrl/api/ia/auto" -Method POST -Body ($autoBody | ConvertTo-Json) -ContentType "application/json" -Headers $headers -TimeoutSec 30
    Write-Host "SUCCESS! Endpoint /api/ia/auto fonctionne !" -ForegroundColor Green
    Write-Host ($response | ConvertTo-Json -Depth 5)
} catch {
    Write-Host "ERREUR /api/ia/auto: $($_.Exception.Message)" -ForegroundColor Red
} 