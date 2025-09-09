# Script pour creer un utilisateur de test et tester /api/ia/auto
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$baseUrl = "http://localhost:3001"

# Donnees utilisateur de test
$email = "test_user_$(Get-Random)@yukpo.com"
$password = "Test1234!"

Write-Host "Creation d'un utilisateur de test: $email"

# 1. Creation de l'utilisateur
$registerBody = @{ 
    email = $email
    password = $password
    lang = "fr"
}

try {
    $registerResponse = Invoke-RestMethod -Uri "$baseUrl/auth/register" -Method POST -Body ($registerBody | ConvertTo-Json) -ContentType "application/json"
    Write-Host "Utilisateur cree avec succes" -ForegroundColor Green
} catch {
    Write-Host "Erreur lors de la creation utilisateur: $($_.Exception.Message)" -ForegroundColor Red
    # Continuons quand meme au cas ou l'utilisateur existe deja
}

# 2. Login pour recuperer le token
Write-Host "Tentative de connexion..."
$loginBody = @{ email = $email; password = $password }
try {
    $loginResponse = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method POST -Body ($loginBody | ConvertTo-Json) -ContentType "application/json"
    $jwtToken = $loginResponse.token
    Write-Host "Connexion reussie, token recupere" -ForegroundColor Green
} catch {
    Write-Host "Erreur lors du login: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Utilisation d'un utilisateur existant..." -ForegroundColor Yellow
    
    # Essayons avec l'utilisateur existant
    $email = "lelehernandez2007@yahoo.fr"
    $loginBody = @{ email = $email; password = $password }
    try {
        $loginResponse = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method POST -Body ($loginBody | ConvertTo-Json) -ContentType "application/json"
        $jwtToken = $loginResponse.token
        Write-Host "Connexion reussie avec utilisateur existant" -ForegroundColor Green
    } catch {
        Write-Host "Impossible de se connecter" -ForegroundColor Red
        exit 1
    }
}

$headers = @{ 
    Authorization = "Bearer $jwtToken"
    "Content-Type" = "application/json; charset=utf-8" 
}

# 3. Test de l'endpoint /api/ia/auto
Write-Host "`nTest de l'endpoint /api/ia/auto..."
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

$startTime = Get-Date

try {
    Write-Host "Envoi de la requete..." -ForegroundColor Yellow
    $response = Invoke-RestMethod -Uri "$baseUrl/api/ia/auto" -Method POST -Body ($testBody | ConvertTo-Json) -ContentType "application/json" -Headers $headers -TimeoutSec 60
    $elapsed = (Get-Date) - $startTime
    
    Write-Host "SUCCESS! Endpoint /api/ia/auto fonctionne ! Temps: $($elapsed.TotalSeconds) secondes" -ForegroundColor Green
    Write-Host "Reponse recue:" -ForegroundColor Cyan
    Write-Host ($response | ConvertTo-Json -Depth 5)
    
    # Verification de la structure de reponse
    if ($response.intention) {
        Write-Host "Intention detectee: $($response.intention)" -ForegroundColor Green
    } else {
        Write-Host "Pas d'intention dans la reponse" -ForegroundColor Yellow
    }
    
} catch {
    $elapsed = (Get-Date) - $startTime
    Write-Host "ERREUR apres $($elapsed.TotalSeconds) secondes" -ForegroundColor Red
    Write-Host "Details: $($_.Exception.Message)" -ForegroundColor Yellow
    
    if ($_.Exception.Response) {
        try {
            $stream = $_.Exception.Response.GetResponseStream()
            $reader = New-Object System.IO.StreamReader($stream)
            $body = $reader.ReadToEnd()
            Write-Host "Reponse brute de l API: $body" -ForegroundColor Yellow
        } catch {
            Write-Host "Impossible de lire la reponse d'erreur" -ForegroundColor Red
        }
    }
} 