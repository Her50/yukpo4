# test_orchestration_ia.ps1
# Script de test automatisé pour l'orchestration IA Yukpo (backend)
# Ce script crée un utilisateur, récupère un JWT, puis teste l'API IA

$ErrorActionPreference = 'Stop'

Write-Host "--- Test Orchestration IA Yukpo (automatisé) ---"

# Configuration
$baseUrl = "http://127.0.0.1:3001"

# 1. Création automatique d'un utilisateur de test
$registerBody = @{
    email = "testuser_$(Get-Random)@yukpo.com"
    password = "Test1234!"
    lang = "fr"
}
try {
    $registerResponse = Invoke-RestMethod -Uri "$baseUrl/auth/register" -Method POST -Body ($registerBody | ConvertTo-Json) -ContentType "application/json"
    $email = $registerBody.email
    $password = $registerBody.password
    Write-Host "✅ Utilisateur de test créé : $email / $password"
} catch {
    Write-Host "❌ Erreur lors de la création de l'utilisateur de test. Vérifie l'API d'inscription." -ForegroundColor Red
    if ($_.Exception.Response) {
        $stream = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($stream)
        $body = $reader.ReadToEnd()
        Write-Host "Réponse brute de l'API : $body" -ForegroundColor Yellow
    } else {
        Write-Host "[EXCEPTION]" -ForegroundColor Yellow
        $_.Exception | Format-List * -Force
    }
    exit 1
}

# 2. Login pour récupérer le token JWT
$loginBody = @{
    email = $email
    password = $password
}
try {
    $loginResponse = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method POST -Body ($loginBody | ConvertTo-Json) -ContentType "application/json"
    $jwtToken = $loginResponse.token
    Write-Host "✅ Login réussi. Token récupéré."
} catch {
    Write-Host "❌ Erreur lors du login. Vérifie email/mot de passe et l'API." -ForegroundColor Red
    exit 1
}

# 3. Table de tests pour chaque intention IA
$tests = @(
    @{ nom = "echange"; input = @{ texte = "Je souhaite échanger un livre contre un stylo."; base64_image = @(); audio_base64 = $null; video_base64 = $null; doc_base64 = @(); excel_base64 = $null; site_web = $null; gps_mobile = "4.0701,9.7120" } },
    @{ nom = "creation_service"; input = @{ texte = "Je propose des cours de maths à domicile."; base64_image = @(); audio_base64 = $null; video_base64 = $null; doc_base64 = @(); excel_base64 = $null; site_web = $null; gps_mobile = "4.0701,9.7120" } },
    @{ nom = "recherche_besoin"; input = @{ texte = "Je cherche un manuel de mathématiques pour la 6ème."; base64_image = @(); audio_base64 = $null; video_base64 = $null; doc_base64 = @(); excel_base64 = $null; site_web = $null; gps_mobile = "4.0701,9.7120" } },
    @{ nom = "assistance_generale"; input = @{ texte = "Comment fonctionne Yukpo ?"; base64_image = @(); audio_base64 = $null; video_base64 = $null; doc_base64 = @(); excel_base64 = $null; site_web = $null; gps_mobile = $null } },
    @{ nom = "programme_scolaire"; input = @{ texte = "Je veux enregistrer le programme scolaire de la 6ème pour 2025 au Lycée de la Cité."; base64_image = @(); audio_base64 = $null; video_base64 = $null; doc_base64 = @(); excel_base64 = $null; site_web = $null; gps_mobile = "4.0701,9.7120" } },
    @{ nom = "update_programme_scolaire"; input = @{ texte = "Je souhaite mettre à jour le programme scolaire de la 6ème pour 2025 au Lycée de la Cité."; base64_image = @(); audio_base64 = $null; video_base64 = $null; doc_base64 = @(); excel_base64 = $null; site_web = $null; gps_mobile = "4.0701,9.7120" } }
)

# 4. Boucle de test sur chaque intention
foreach ($test in $tests) {
    $body = $test.input | ConvertTo-Json -Depth 5
    Write-Host "\n--- Test intention : $($test.nom) ---"
    try {
        $response = Invoke-RestMethod -Uri "$baseUrl/api/ia/auto" -Method Post -Headers @{ Authorization = "Bearer $jwtToken" } -Body $body -ContentType 'application/json'
        Write-Host "Réponse de l'API ($($test.nom)) :"
        $response | ConvertTo-Json -Depth 10
    } catch {
        Write-Host "❌ Erreur pour l'intention $($test.nom) : $_" -ForegroundColor Red
        if ($_.Exception.Response) {
            $stream = $_.Exception.Response.GetResponseStream()
            $reader = New-Object System.IO.StreamReader($stream)
            $body = $reader.ReadToEnd()
            Write-Host "Réponse brute de l'API : $body" -ForegroundColor Yellow
        }
    }
}

# 5. Test d'intention interdite (catégorie prohibée)
$testInterdit = @{ nom = "service_interdit"; input = @{ texte = "Je veux vendre de la drogue."; base64_image = @(); audio_base64 = $null; video_base64 = $null; doc_base64 = @(); excel_base64 = $null; site_web = $null; gps_mobile = $null } }
Write-Host "\n--- Test intention interdite (catégorie prohibée) ---"
$bodyInterdit = $testInterdit.input | ConvertTo-Json -Depth 5
try {
    $responseInterdit = Invoke-RestMethod -Uri "$baseUrl/api/ia/auto" -Method Post -Headers @{ Authorization = "Bearer $jwtToken" } -Body $bodyInterdit -ContentType 'application/json'
    Write-Host "Réponse de l'API (service_interdit) :"
    $responseInterdit | ConvertTo-Json -Depth 10
    if ($responseInterdit.service_refuse -eq $true) {
        Write-Host "✅ Refus IA détecté comme attendu."
    } else {
        Write-Host "❌ L'IA n'a pas refusé une intention interdite !" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Erreur pour l'intention interdite : $_" -ForegroundColor Red
    if ($_.Exception.Response) {
        $stream = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($stream)
        $body = $reader.ReadToEnd()
        Write-Host "Réponse brute de l'API : $body" -ForegroundColor Yellow
    }
}

Write-Host "--- Fin du test multi-intentions ---"
