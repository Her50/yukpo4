# Test simple de l'endpoint /api/ia/auto avec fallback
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$baseUrl = "http://localhost:3001"

# Test avec un utilisateur existant
$email = "lelehernandez2007@yahoo.fr"
$password = "Test1234!"

# Login pour recuperer le token
$loginBody = @{ email = $email; password = $password }
try {
    $loginResponse = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method POST -Body ($loginBody | ConvertTo-Json) -ContentType "application/json"
    $jwtToken = $loginResponse.token
    Write-Host "Connexion reussie, token recupere."
} catch {
    Write-Host "Erreur lors du login utilisateur." -ForegroundColor Red
    Write-Host "Details: $($_.Exception.Message)" -ForegroundColor Yellow
    exit 1
}

$headers = @{ 
    Authorization = "Bearer $jwtToken"
    "Content-Type" = "application/json; charset=utf-8" 
}

# Test de l'endpoint /api/ia/auto
$testBody = @{ 
    texte = "Je veux creer un service de cours de maths"
    base64_image = @()
    audio_base64 = $null
    video_base64 = $null
    doc_base64 = @()
    excel_base64 = $null
    site_web = $null
    gps_mobile = $null
}

Write-Host "Test de l'endpoint /api/ia/auto avec fallback..."
$startTime = Get-Date

try {
    $response = Invoke-RestMethod -Uri "$baseUrl/api/ia/auto" -Method POST -Body ($testBody | ConvertTo-Json) -ContentType "application/json" -Headers $headers -TimeoutSec 30
    $elapsed = (Get-Date) - $startTime
    
    Write-Host "Endpoint /api/ia/auto fonctionne ! Temps de reponse: $($elapsed.TotalSeconds) secondes" -ForegroundColor Green
    Write-Host "Reponse recue:" -ForegroundColor Cyan
    Write-Host ($response | ConvertTo-Json -Depth 5)
    
    # Verification de la structure de reponse
    if ($response.intention) {
        Write-Host "Intention detectee: $($response.intention)" -ForegroundColor Green
    } else {
        Write-Host "Pas d'intention dans la reponse" -ForegroundColor Yellow
    }
    
} catch {
    Write-Host "Erreur lors du test de /api/ia/auto" -ForegroundColor Red
    Write-Host "Details: $($_.Exception.Message)" -ForegroundColor Yellow
    
    if ($_.Exception.Response) {
        $stream = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($stream)
        $body = $reader.ReadToEnd()
        Write-Host "Reponse brute de l API : $body" -ForegroundColor Yellow
    }
} 