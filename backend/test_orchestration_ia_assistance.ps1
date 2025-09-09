# Test orchestration IA – intention assistance_generale
# Ce test vérifie que l'orchestrateur IA détecte correctement l'intention assistance_generale et retourne un JSON conforme.

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$baseUrl = "http://localhost:3001"

# Création automatique d'un utilisateur de test
$email = "testuser_assistance_$(Get-Random)@yukpo.com"
$password = "Test1234!"
$registerBody = @{ email = $email; password = $password; lang = "fr" }
try {
    Invoke-RestMethod -Uri "$baseUrl/auth/register" -Method POST -Body ($registerBody | ConvertTo-Json) -ContentType "application/json"
    Write-Host "✅ Utilisateur de test créé : $email / $password"
} catch {
    Write-Host "❌ Erreur lors de la création de l'utilisateur de test." -ForegroundColor Red
    exit 1
}

# Login pour récupérer le token
$loginBody = @{ email = $email; password = $password }
try {
    $loginResponse = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method POST -Body ($loginBody | ConvertTo-Json) -ContentType "application/json"
    $jwtToken = $loginResponse.token
    Write-Host "[OK] Connexion réussie, token récupéré."
} catch {
    Write-Host "❌ Erreur lors du login utilisateur." -ForegroundColor Red
    exit 1
}
$headers = @{ Authorization = "Bearer $jwtToken"; "Content-Type" = "application/json; charset=utf-8" }

function Get-TokenCount {
    param(
        [string]$Text
    )
    $tokens = $Text -split '\s+' | Where-Object { $_ -ne '' }
    return $tokens.Count
}

# Test intention assistance_generale
$texteAssistance = "Pouvez-vous m'expliquer comment fonctionne la plateforme Yukpo pour les nouveaux utilisateurs ?"
$tokenCount = Get-TokenCount $texteAssistance
Write-Host "[INFO] Nombre de tokens (entrée utilisateur, assistance) : $tokenCount"
$bodyAssistance = @{ texte = $texteAssistance }
Write-Host "[TEST] Orchestration IA : POST sur /api/ia/auto (intention assistance_generale)"
$startTime = Get-Date
try {
    $responseAssistance = Invoke-RestMethod -Uri "$baseUrl/api/ia/auto" -Method POST -Body ($bodyAssistance | ConvertTo-Json) -ContentType "application/json" -Headers $headers
    $elapsed = (Get-Date) - $startTime
    Write-Host "[OK] Orchestration IA (assistance_generale) terminée en $($elapsed.TotalSeconds) secondes."
    Write-Host "[DEBUG] Réponse complète (assistance_generale) : $($responseAssistance | ConvertTo-Json -Depth 10)"
    if ($responseAssistance.intention -eq "assistance_generale" -or $responseAssistance.data.intention.valeur -eq "assistance_generale") {
        Write-Host "[OK] Intention assistance_generale détectée."
    } else {
        Write-Host "[KO] L'intention détectée n'est pas assistance_generale !"
    }
} catch {
    Write-Host "❌ Erreur lors de l'orchestration IA (assistance_generale)." -ForegroundColor Red
    if ($_.Exception.Response) {
        $stream = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($stream)
        $body = $reader.ReadToEnd()
        Write-Host "Réponse brute de l'API : $body" -ForegroundColor Yellow
    } else {
        Write-Host "[EXCEPTION]" -ForegroundColor Yellow
        $_.Exception | Format-List * -Force
    }
}
