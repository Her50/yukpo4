# Script PowerShell : Vérification du statut d’un échange après création via l’orchestrateur IA
# Ce script crée deux échanges croisés via l’orchestrateur IA, puis vérifie leur statut métier (matching)

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$baseUrl = "http://localhost:3001"
$password = "Test1234!"

# Création de deux utilisateurs de test
$email1 = "testuser_echange1_$(Get-Random)@yukpo.com"
$email2 = "testuser_echange2_$(Get-Random)@yukpo.com"
$registerBody1 = @{ email = $email1; password = $password; lang = "fr" }
$registerBody2 = @{ email = $email2; password = $password; lang = "fr" }
Invoke-RestMethod -Uri "$baseUrl/auth/register" -Method POST -Body ($registerBody1 | ConvertTo-Json) -ContentType "application/json"
Invoke-RestMethod -Uri "$baseUrl/auth/register" -Method POST -Body ($registerBody2 | ConvertTo-Json) -ContentType "application/json"

# Login pour récupérer les tokens
$loginBody1 = @{ email = $email1; password = $password }
$loginBody2 = @{ email = $email2; password = $password }
$jwtToken1 = (Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method POST -Body ($loginBody1 | ConvertTo-Json) -ContentType "application/json").token
$jwtToken2 = (Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method POST -Body ($loginBody2 | ConvertTo-Json) -ContentType "application/json").token
$headers1 = @{ Authorization = "Bearer $jwtToken1"; "Content-Type" = "application/json; charset=utf-8" }
$headers2 = @{ Authorization = "Bearer $jwtToken2"; "Content-Type" = "application/json; charset=utf-8" }

# Création des deux échanges croisés via l’orchestreur IA
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

# Vérification désactivée : la réponse de l'orchestrateur IA ne contient pas le JSON métier (intention/mode/gps),
# donc on ne peut pas valider le schéma ici côté client.
# Assert-ExchangeJson-Schema $response1 "utilisateur 1"
# Assert-ExchangeJson-Schema $response2 "utilisateur 2"

# Récupération des IDs d’échange
$echangeId1 = $response1.echange_id
$echangeId2 = $response2.echange_id

if (-not $echangeId1 -or -not $echangeId2) {
    Write-Host "❌ Impossible de récupérer les IDs d’échange."
    exit 1
}

# Vérification du statut métier de chaque échange (matching)
Start-Sleep -Seconds 2 # Laisse le temps au matching de s’exécuter côté backend

$statut1 = Invoke-RestMethod -Uri "$baseUrl/echanges/$echangeId1/status" -Headers $headers1 -Method GET
$statut2 = Invoke-RestMethod -Uri "$baseUrl/echanges/$echangeId2/status" -Headers $headers2 -Method GET

Write-Host "\nStatut de l’échange 1 ($echangeId1) :"
$statut1 | ConvertTo-Json -Depth 10
Write-Host "\nStatut de l’échange 2 ($echangeId2) :"
$statut2 | ConvertTo-Json -Depth 10

# Correction : vérifie matched_with et statut
if ($statut1.statut -eq 'matché' -and $statut2.statut -eq 'matché' -and $statut1.matched_with -eq $echangeId2 -and $statut2.matched_with -eq $echangeId1) {
    Write-Host "\n✅ Matching réussi : les deux échanges sont appariés (matched_with = $($statut1.matched_with))"
    $matched = $true
} else {
    Write-Host "\n[INFO] Matching non encore effectif ou partiel. Relancez le script ou vérifiez la logique métier."
    $matched = $false
}

# Boucle d'attente/réessai pour le matching (s'arrête dès que matching détecté)
$maxTries = 12   # 12 x 5s = 60s max
$try = 0
while ($try -lt $maxTries -and -not $matched) {
    Start-Sleep -Seconds 5
    $statut1 = Invoke-RestMethod -Uri "$baseUrl/echanges/$echangeId1/status" -Headers $headers1 -Method GET
    $statut2 = Invoke-RestMethod -Uri "$baseUrl/echanges/$echangeId2/status" -Headers $headers2 -Method GET
    if ($statut1.statut -eq 'matché' -and $statut2.statut -eq 'matché' -and $statut1.matched_with -eq $echangeId2 -and $statut2.matched_with -eq $echangeId1) {
        $matched = $true
        Write-Host "`n✅ Matching réussi : les deux échanges sont appariés (matched_with = $($statut1.matched_with))"
    } else {
        Write-Host "Tentative $($try+1)/$maxTries : toujours en attente de matching..."
    }
    $try++
}

if (-not $matched) {
    Write-Host "`n❌ Matching non détecté après $($maxTries*5) secondes. Vérifiez la logique métier ou le cron backend."
}

# CONSEIL :
# Pour accélérer le matching, assurez-vous que le cron de matching est bien actif côté backend.
# Si besoin, relancez le script ou forcez le cron (voir logs backend).
