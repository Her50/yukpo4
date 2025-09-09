# Test end-to-end Yukpo : matching positif service <-> besoin
# Ce script crée un utilisateur, un service, puis effectue une recherche besoin avec un texte très similaire pour garantir un score élevé

$baseUrl = "http://localhost:3001"

# 0. Création automatique d'un utilisateur de test
$email = "testuser_$(Get-Random)@yukpo.com"
$password = "Test1234!"
$registerBody = @{ email = $email; password = $password; lang = "fr" }
try {
    $registerResponse = Invoke-RestMethod -Uri "$baseUrl/auth/register" -Method POST -Body ($registerBody | ConvertTo-Json) -ContentType "application/json"
    Write-Host "✅ Utilisateur de test créé : $email / $password"
} catch {
    Write-Host "❌ Erreur lors de la création de l'utilisateur de test." -ForegroundColor Red
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

# 1. Login pour récupérer le token
$loginBody = @{ email = $email; password = $password }
try {
    $loginResponse = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method POST -Body ($loginBody | ConvertTo-Json) -ContentType "application/json"
    $jwtToken = $loginResponse.token
    Write-Host "[DEBUG] loginResponse complet : $($loginResponse | ConvertTo-Json -Depth 10)"
    Write-Host "[OK] Connexion réussie, token récupéré."
    # --- Décodage du JWT pour extraire le user_id (champ 'sub') ---
    $jwtParts = $jwtToken -split '\.'
    if ($jwtParts.Length -ge 2) {
        $payload = $jwtParts[1]
        # Ajout du padding si nécessaire
        switch ($payload.Length % 4) {
            2 { $payload += '==' }
            3 { $payload += '=' }
        }
        $payloadJson = [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($payload.Replace('-', '+').Replace('_', '/')))
        $payloadObj = $payloadJson | ConvertFrom-Json
        $user_id = $payloadObj.sub
        Write-Host "[DEBUG] user_id extrait du JWT : $user_id"
    } else {
        Write-Host "[ERREUR] Format du JWT inattendu, impossible d'extraire le user_id." -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "❌ Erreur lors du login utilisateur." -ForegroundColor Red
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

# 2. Création d'un service complexe avec liste_produit
$service = @{
    titre       = @{ type_donnee = "string"; valeur = "Boutique informatique Yukpo"; origine_champs = "ia" }
    description = @{ type_donnee = "string"; valeur = "Vente de matériel informatique, PC, accessoires, imprimantes, et services de réparation."; origine_champs = "ia" }
    category    = @{ type_donnee = "string"; valeur = "Informatique"; origine_champs = "ia" }
    liste_produit = @(
        @{ nom = "PC portable"; prix = 500; stock = 10 },
        @{ nom = "Imprimante"; prix = 120; stock = 5 },
        @{ nom = "Souris sans fil"; prix = 15; stock = 50 }
    )
    intention   = "proposer_service"
    is_tarissable = $false
}
# Correction du payload pour inclure user_id et data
$servicePayload = @{ user_id = $user_id; data = $service }

Write-Host "[TEST] Création du service complexe..."
$serviceJson = $servicePayload | ConvertTo-Json -Depth 10
Write-Host "JSON envoyé : $serviceJson"
try {
    $createResponse = Invoke-RestMethod -Uri "$baseUrl/services/create" -Method Post -Body $serviceJson -ContentType "application/json" -Headers @{ Authorization = "Bearer $jwtToken" }
    Write-Host "[RESULT] Service complexe créé :" $createResponse
} catch {
    Write-Host "❌ Erreur lors de la création du service complexe." -ForegroundColor Red
    if ($_.Exception.Response) {
        $stream = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($stream)
        $body = $reader.ReadToEnd()
        Write-Host "Réponse brute de l'API : $body" -ForegroundColor Yellow
        Write-Host "[DEBUG] Headers : $($_.Exception.Response.Headers)"
        Write-Host "[DEBUG] Statut HTTP : $($_.Exception.Response.StatusCode)"
    } else {
        Write-Host "[EXCEPTION]" -ForegroundColor Yellow
        $_.Exception | Format-List * -Force
    }
    exit 1
}

# 3. Recherche besoin qui doit matcher (produit similaire)
$besoin1 = @{
    titre       = @{ type_donnee = "string"; valeur = "Achat PC portable"; origine_champs = "ia" }
    description = @{ type_donnee = "string"; valeur = "Je cherche un ordinateur portable pour le travail."; origine_champs = "ia" }
    category    = @{ type_donnee = "string"; valeur = "Informatique"; origine_champs = "ia" }
    liste_produit = @(
        @{ nom = "PC portable" }
    )
    intention   = "rechercher_besoin"
    reponse_intelligente = @{ type_donnee = "string"; valeur = ""; origine_champs = "ia" }
}
Write-Host "[TEST] Recherche besoin (doit matcher)..."
$besoinJson1 = $besoin1 | ConvertTo-Json -Depth 10
try {
    $searchResponse1 = Invoke-RestMethod -Uri "$baseUrl/rechercher_besoin" -Method Post -Body $besoinJson1 -ContentType "application/json" -Headers @{ Authorization = "Bearer $jwtToken" }
    Write-Host "[RESULT] Résultat recherche (match attendu) :" $searchResponse1
    if ($searchResponse1.resultats.Count -gt 0) {
        Write-Host "[OK] Matching positif :"
        foreach ($r in $searchResponse1.resultats) {
            Write-Host ("- ServiceID: {0} | Score: {1} | Titre: {2}" -f $r.service_id, $r.score, $r.data.titre.valeur)
        }
    } else {
        Write-Host "[KO] Aucun service matché (alors qu'un match était attendu)."
    }
    if ($searchResponse1.reponse_intelligente) {
        Write-Host "[OK] reponse_intelligente bien renvoyée : $($searchResponse1.reponse_intelligente)"
    } else {
        Write-Host "[KO] reponse_intelligente absente dans la réponse."
    }
} catch {
    Write-Host "❌ Erreur lors de la recherche besoin (match attendu)." -ForegroundColor Red
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

# 4. Recherche besoin qui ne doit pas matcher (produit très différent)
$besoin2 = @{
    titre       = @{ type_donnee = "string"; valeur = "Achat vélo électrique"; origine_champs = "ia" }
    description = @{ type_donnee = "string"; valeur = "Je cherche un vélo électrique pour mes déplacements."; origine_champs = "ia" }
    category    = @{ type_donnee = "string"; valeur = "Mobilité"; origine_champs = "ia" }
    liste_produit = @(
        @{ nom = "Vélo électrique" }
    )
    intention   = "rechercher_besoin"
    reponse_intelligente = @{ type_donnee = "string"; valeur = ""; origine_champs = "ia" }
}
Write-Host "[TEST] Recherche besoin (ne doit pas matcher)..."
$besoinJson2 = $besoin2 | ConvertTo-Json -Depth 10
try {
    $searchResponse2 = Invoke-RestMethod -Uri "$baseUrl/rechercher_besoin" -Method Post -Body $besoinJson2 -ContentType "application/json" -Headers @{ Authorization = "Bearer $jwtToken" }
    Write-Host "[RESULT] Résultat recherche (no match attendu) :" $searchResponse2
    if ($searchResponse2.resultats.Count -eq 0) {
        Write-Host "[OK] Aucun service matché (attendu)."
    } else {
        Write-Host "[KO] Matching inattendu :"
        foreach ($r in $searchResponse2.resultats) {
            Write-Host ("- ServiceID: {0} | Score: {1} | Titre: {2}" -f $r.service_id, $r.score, $r.data.titre.valeur)
        }
    }
    if ($searchResponse2.reponse_intelligente) {
        Write-Host "[OK] reponse_intelligente bien renvoyée : $($searchResponse2.reponse_intelligente)"
    } else {
        Write-Host "[KO] reponse_intelligente absente dans la réponse."
    }
} catch {
    Write-Host "❌ Erreur lors de la recherche besoin (no match attendu)." -ForegroundColor Red
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
