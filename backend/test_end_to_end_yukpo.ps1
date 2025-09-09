# test_end_to_end_yukpo.ps1
# Test end-to-end Yukpo : workflow complet utilisateur → IA → backend → matching
# 1. Création d’un service via demande naturelle (validation, vectorisation)
# 2. Recherche d’un besoin via demande naturelle (génération JSON, matching, réponse IA)

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$baseUrl = "http://localhost:3001"

# 0. Création automatique d'un utilisateur de test
$email = "testuser_$(Get-Random)@yukpo.com"
$password = "Test1234!"
$registerBody = @{ email = $email; password = $password; lang = "fr" }
try {
    Invoke-RestMethod -Uri "$baseUrl/auth/register" -Method POST -Body ($registerBody | ConvertTo-Json) -ContentType "application/json"
    Write-Host "✅ Utilisateur de test créé : $email / $password"
} catch {
    Write-Host "❌ Erreur lors de la création de l'utilisateur de test." -ForegroundColor Red
    exit 1
}

# 1. Login pour récupérer le token
$loginBody = @{ email = $email; password = $password }
try {
    $loginResponse = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method POST -Body ($loginBody | ConvertTo-Json) -ContentType "application/json"
    $jwtToken = $loginResponse.token
    Write-Host "[OK] Connexion réussie, token récupéré."
    $jwtParts = $jwtToken -split '\.'
    $payload = $jwtParts[1]
    switch ($payload.Length % 4) { 2 { $payload += '==' } 3 { $payload += '=' } }
    $payloadJson = [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($payload.Replace('-', '+').Replace('_', '/')))
    $payloadObj = $payloadJson | ConvertFrom-Json
    $user_id = $payloadObj.sub
    Write-Host "[DEBUG] user_id extrait du JWT : $user_id"
} catch {
    Write-Host "❌ Erreur lors du login utilisateur." -ForegroundColor Red
    exit 1
}
$headers = @{ Authorization = "Bearer $jwtToken"; "Content-Type" = "application/json; charset=utf-8" }

# 2. Création d’un service via demande naturelle
$demande_service = "Je veux créer un service de soutien scolaire en mathématiques pour le collège."
$inputBody = @{ texte = $demande_service }
$inputJson = $inputBody | ConvertTo-Json -Depth 5
$utf8Bytes = [System.Text.Encoding]::UTF8.GetBytes($inputJson)
Write-Host "[TEST] Génération JSON service via IA..."
try {
    $iaResponse = Invoke-RestMethod -Uri "$baseUrl/api/ia/auto" -Method Post -Body $utf8Bytes -ContentType 'application/json; charset=utf-8' -Headers $headers
    Write-Host "[OK] JSON service généré par IA : $($iaResponse | ConvertTo-Json -Depth 10)"
    $serviceJson = $iaResponse | ConvertTo-Json -Depth 10
    $serviceObj = $iaResponse
    # Correction du payload pour inclure user_id et data
    $servicePayload = @{ user_id = $user_id; data = $serviceObj }
    $servicePayloadJson = $servicePayload | ConvertTo-Json -Depth 10
    Write-Host "[TEST] Création du service (validation + vectorisation)..."
    $createResponse = Invoke-RestMethod -Uri "$baseUrl/services/create" -Method Post -Body $servicePayloadJson -ContentType "application/json" -Headers $headers
    Write-Host "[OK] Service créé : $($createResponse | ConvertTo-Json -Depth 10)"
} catch {
    Write-Host "❌ Erreur lors de la génération ou création du service." -ForegroundColor Red
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

# 3. Recherche d’un besoin via demande naturelle
$demande_besoin = "Je cherche du soutien scolaire en mathématiques pour mon enfant au collège."
$inputBody2 = @{ texte = $demande_besoin }
$inputJson2 = $inputBody2 | ConvertTo-Json -Depth 5
$utf8Bytes2 = [System.Text.Encoding]::UTF8.GetBytes($inputJson2)
Write-Host "[TEST] Génération JSON besoin via IA..."
try {
    $iaResponse2 = Invoke-RestMethod -Uri "$baseUrl/api/ia/auto" -Method Post -Body $utf8Bytes2 -ContentType 'application/json; charset=utf-8' -Headers $headers
    Write-Host "[OK] JSON besoin généré par IA : $($iaResponse2 | ConvertTo-Json -Depth 10)"
    $besoinObj = $iaResponse2.donnees_validees
    $besoinJson = $besoinObj | ConvertTo-Json -Depth 10
    Write-Host "[TEST] Recherche besoin (matching)..."
    $searchResponse = Invoke-RestMethod -Uri "$baseUrl/rechercher_besoin" -Method Post -Body $besoinJson -ContentType "application/json" -Headers $headers
    Write-Host "[RESULT] Résultat recherche : $($searchResponse | ConvertTo-Json -Depth 10)"
    if ($searchResponse.resultats.Count -gt 0) {
        Write-Host "[OK] Matching positif : $($searchResponse.resultats | ConvertTo-Json -Depth 10)"
    } else {
        Write-Host "[KO] Aucun service matché."
    }
    if ($searchResponse.reponse_intelligente) {
        Write-Host "[OK] reponse_intelligente bien renvoyée : $($searchResponse.reponse_intelligente)"
    } else {
        Write-Host "[KO] reponse_intelligente absente dans la réponse."
    }
} catch {
    Write-Host "❌ Erreur lors de la génération ou recherche besoin." -ForegroundColor Red
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
