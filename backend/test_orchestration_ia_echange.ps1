# Test d'orchestration IA pour l'intention echange
# Ce script PowerShell vérifie que l'IA et le backend produisent un JSON conforme pour l'intention echange

# Configuration de l'encodage pour éviter les problèmes d'accents
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$baseUrl = "http://localhost:3001"

# Création de deux utilisateurs de test pour échanges croisés
$email1 = "testuser_echange1_$(Get-Random)@yukpo.com"
$email2 = "testuser_echange2_$(Get-Random)@yukpo.com"
$password = "Test1234!"
$registerBody1 = @{ email = $email1; password = $password; lang = "fr" }
$registerBody2 = @{ email = $email2; password = $password; lang = "fr" }
try {
    Invoke-RestMethod -Uri "$baseUrl/auth/register" -Method POST -Body ($registerBody1 | ConvertTo-Json) -ContentType "application/json"
    Invoke-RestMethod -Uri "$baseUrl/auth/register" -Method POST -Body ($registerBody2 | ConvertTo-Json) -ContentType "application/json"
    Write-Host "✅ Utilisateurs de test créés : $email1 / $email2"
} catch {
    Write-Host "❌ Erreur lors de la création des utilisateurs de test." -ForegroundColor Red
    exit 1
}

# Login pour récupérer les tokens
$loginBody1 = @{ email = $email1; password = $password }
$loginBody2 = @{ email = $email2; password = $password }
try {
    $loginResponse1 = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method POST -Body ($loginBody1 | ConvertTo-Json) -ContentType "application/json"
    $loginResponse2 = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method POST -Body ($loginBody2 | ConvertTo-Json) -ContentType "application/json"
    $jwtToken1 = $loginResponse1.token
    $jwtToken2 = $loginResponse2.token
    Write-Host "[OK] Connexion réussie, tokens récupérés."
} catch {
    Write-Host "❌ Erreur lors du login utilisateur." -ForegroundColor Red
    exit 1
}
$headers1 = @{ Authorization = "Bearer $jwtToken1"; "Content-Type" = "application/json; charset=utf-8" }
$headers2 = @{ Authorization = "Bearer $jwtToken2"; "Content-Type" = "application/json; charset=utf-8" }

# Matching exact
$question1 = "Je souhaite échanger mon vélo contre un ordinateur portable à Douala."
$question2 = "Je souhaite échanger un ordinateur portable contre un vélo à Douala."
$body1 = @{ texte = $question1 }
$body2 = @{ texte = $question2 }
$response1 = Invoke-RestMethod -Uri "$baseUrl/api/ia/auto" -Method POST -Body ($body1 | ConvertTo-Json) -ContentType "application/json" -Headers $headers1
$response2 = Invoke-RestMethod -Uri "$baseUrl/api/ia/auto" -Method POST -Body ($body2 | ConvertTo-Json) -ContentType "application/json" -Headers $headers2
Write-Host "\nRéponse de l'orchestrateur IA pour utilisateur 1 :"
$response1 | ConvertTo-Json -Depth 10
Write-Host "\nRéponse de l'orchestrateur IA pour utilisateur 2 :"
$response2 | ConvertTo-Json -Depth 10
Assert-ExchangeJson-Schema $response1 "utilisateur 1"
Assert-ExchangeJson-Schema $response2 "utilisateur 2"

# Matching partiel (nom approché)
$question3 = "Je souhaite échanger mon vélo de ville contre un laptop à Douala."
$question4 = "Je souhaite échanger un ordinateur portable contre un vélo de ville à Douala."
$body3 = @{ texte = $question3 }
$body4 = @{ texte = $question4 }
$response3 = Invoke-RestMethod -Uri "$baseUrl/api/ia/auto" -Method POST -Body ($body3 | ConvertTo-Json) -ContentType "application/json" -Headers $headers1
$response4 = Invoke-RestMethod -Uri "$baseUrl/api/ia/auto" -Method POST -Body ($body4 | ConvertTo-Json) -ContentType "application/json" -Headers $headers2
Write-Host "\nRéponse de l'orchestrateur IA pour utilisateur 3 :"
$response3 | ConvertTo-Json -Depth 10
Write-Host "\nRéponse de l'orchestrateur IA pour utilisateur 4 :"
$response4 | ConvertTo-Json -Depth 10
Assert-ExchangeJson-Schema $response3 "utilisateur 3"
Assert-ExchangeJson-Schema $response4 "utilisateur 4"

# Matching impossible (catégories incompatibles)
$question5 = "Je souhaite échanger mon livre contre une trottinette à Douala."
$question6 = "Je souhaite échanger un ordinateur portable contre un vélo à Douala."
$body5 = @{ texte = $question5 }
$body6 = @{ texte = $question6 }
$response5 = Invoke-RestMethod -Uri "$baseUrl/api/ia/auto" -Method POST -Body ($body5 | ConvertTo-Json) -ContentType "application/json" -Headers $headers1
$response6 = Invoke-RestMethod -Uri "$baseUrl/api/ia/auto" -Method POST -Body ($body6 | ConvertTo-Json) -ContentType "application/json" -Headers $headers2
Write-Host "\nRéponse de l'orchestrateur IA pour utilisateur 5 :"
$response5 | ConvertTo-Json -Depth 10
Write-Host "\nRéponse de l'orchestrateur IA pour utilisateur 6 :"
$response6 | ConvertTo-Json -Depth 10
Assert-ExchangeJson-Schema $response5 "utilisateur 5"
Assert-ExchangeJson-Schema $response6 "utilisateur 6"

# Vérification des réponses métier (matching attendu)
if ($response1.echange_id -and $response2.echange_id) {
    Write-Host "\n✅ Les deux échanges ont bien été créés. Vérifiez dans le backend si un matching a eu lieu."
} else {
    Write-Host "\n❌ Un ou les deux échanges n'ont pas été créés correctement."
}
