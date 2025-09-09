# test_echanges.ps1 — Tests PowerShell avancés pour l’API d’échanges Yukpo
# Ce script teste les endpoints principaux de gestion des échanges (troc)
# Nécessite : PowerShell 5+, module Invoke-RestMethod, API Yukpo démarrée

$apiBase = "http://localhost:3001"

# Récupération du token JWT (à adapter selon votre environnement)
# Exemple : lecture d’un token de test depuis un fichier ou une variable d’environnement
$jwt = $null
if (-not $jwt) {
    try {
        $jwt = Get-Content -Path "token_test.txt" -Raw
    } catch {}
}
# Si aucun JWT, tentative de connexion automatique pour en générer un
if (-not $jwt) {
    Write-Host "Aucun token JWT trouvé. Tentative de connexion automatique..." -ForegroundColor Yellow
    $loginBody = @{ email = "test@yukpo.com"; password = "motdepasse" } | ConvertTo-Json
    try {
        $loginResp = Invoke-RestMethod -Uri "$apiBase/auth/login" -Method Post -Body $loginBody -ContentType "application/json"
        Write-Host "Réponse brute de /auth/login : $($loginResp | ConvertTo-Json -Depth 5)" -ForegroundColor Yellow
        # Recherche du champ contenant le JWT
        $jwt = $null
        foreach ($key in $loginResp.PSObject.Properties.Name) {
            if ($loginResp[$key] -is [string] -and $loginResp[$key] -match '^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$') {
                $jwt = $loginResp[$key]
                Write-Host "JWT trouvé dans le champ '$key'" -ForegroundColor Green
                break
            }
        }
        if ($jwt) {
            Set-Content -Path "token_test.txt" -Value $jwt
            Write-Host "Token JWT généré et sauvegardé dans token_test.txt" -ForegroundColor Green
        } else {
            Write-Host "Aucun champ JWT détecté dans la réponse de connexion." -ForegroundColor Red
            exit 1
        }
    } catch {
        Write-Host "Connexion impossible, tentative de création de l'utilisateur de test..." -ForegroundColor Yellow
        $registerBody = @{ email = "test@yukpo.com"; password = "motdepasse"; nom = "Test" } | ConvertTo-Json
        try {
            $registerResp = Invoke-RestMethod -Uri "$apiBase/auth/register" -Method Post -Body $registerBody -ContentType "application/json" | Out-Null
            Write-Host "Utilisateur de test créé. Nouvelle tentative de connexion..." -ForegroundColor Green
            $loginResp = Invoke-RestMethod -Uri "$apiBase/auth/login" -Method Post -Body $loginBody -ContentType "application/json"
            Write-Host "Réponse brute de /auth/login (après register) : $($loginResp | ConvertTo-Json -Depth 5)" -ForegroundColor Yellow
            $jwt = $null
            foreach ($key in $loginResp.PSObject.Properties.Name) {
                if ($loginResp[$key] -is [string] -and $loginResp[$key] -match '^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$') {
                    $jwt = $loginResp[$key]
                    Write-Host "JWT trouvé dans le champ '$key'" -ForegroundColor Green
                    break
                }
            }
            if ($jwt) {
                Set-Content -Path "token_test.txt" -Value $jwt
                Write-Host "Token JWT généré et sauvegardé dans token_test.txt" -ForegroundColor Green
            } else {
                Write-Host "Aucun champ JWT détecté dans la réponse de connexion après création." -ForegroundColor Red
                exit 1
            }
        } catch {
            Write-Host "Impossible de créer l'utilisateur de test ou d'obtenir un JWT. Vérifiez l'API d'authentification." -ForegroundColor Red
            exit 1
        }
    }
}
$headers = @{ Authorization = "Bearer $jwt" }

# Génération d'un email de test unique
$email = "test_echange_$([guid]::NewGuid().ToString('N').Substring(0,8))@yukpo.com"
$password = "Test1234!"

# Création de l'utilisateur de test
$registerBody = @{ email = $email; password = $password; lang = "fr" } | ConvertTo-Json
try {
    $registerResponse = Invoke-RestMethod -Uri "http://localhost:3001/auth/register" -Method POST -Body $registerBody -ContentType "application/json"
    Write-Host "✅ Utilisateur de test créé : $email / $password"
} catch {
    Write-Host "❌ Erreur lors de la création de l'utilisateur de test. Vérifie l'API d'inscription." -ForegroundColor Red
    exit 1
}

# Login pour récupérer le JWT
$loginBody = @{ email = $email; password = $password } | ConvertTo-Json
try {
    $loginResponse = Invoke-RestMethod -Uri "http://localhost:3001/auth/login" -Method POST -Body $loginBody -ContentType "application/json"
    $jwt = $loginResponse.token
    # Décodage du JWT pour extraire l'ID utilisateur (sub)
    $jwtParts = $jwt -split '\.'
    if ($jwtParts.Length -ge 2) {
        $payload = $jwtParts[1]
        switch ($payload.Length % 4) { 2 { $payload += '==' } 3 { $payload += '=' } }
        $payloadJson = [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($payload.Replace('-', '+').Replace('_', '/')))
        $payloadObj = $payloadJson | ConvertFrom-Json
        $userId = [int]$payloadObj.sub
        Write-Host "[DEBUG] user_id extrait du JWT : $userId" -ForegroundColor Yellow
    } else {
        Write-Host "❌ Impossible de décoder le JWT pour extraire l'ID utilisateur." -ForegroundColor Red
        exit 1
    }
    Write-Host "✅ Login réussi. Token et user_id récupérés."
} catch {
    Write-Host "❌ Erreur lors du login. Vérifie email/mot de passe et l'API." -ForegroundColor Red
    exit 1
}
$headers = @{ Authorization = "Bearer $jwt" }

function Test-ValidEchange {
    Write-Host "Test: Création d’un échange valide..." -ForegroundColor Cyan
    $body = @{
        offre = @{
            mode = "echange"
            mode_troc = "echange"
            quantite = 10;
            unite = "kg";
            lot = "A1";
            gps = @{ lat = 48.85; lon = 2.35 }
        };
        besoin = @{
            quantite = 5;
            unite = "kg";
            lot = "B2";
            gps = @{ lat = 48.86; lon = 2.36 }
        };
        user_id = $userId;
        reputation = 4.5
        mode_troc = "echange" # <-- Ajouté à la racine pour fiabiliser
    } | ConvertTo-Json -Depth 5
    try {
        $resp = Invoke-RestMethod -Uri "$apiBase/echanges" -Method Post -Body $body -ContentType 'application/json' -Headers $headers -ErrorAction SilentlyContinue
        if ($resp -and $resp.echange_id) {
            Write-Host "OK: Echange créé avec id $($resp.echange_id)" -ForegroundColor Green
        } else {
            Write-Host "ERREUR: Echange non créé (réponse: $($resp | Out-String))" -ForegroundColor Red
        }
    } catch {
        Write-Host "ERREUR: Echange non créé (exception: $($_.Exception.Message))" -ForegroundColor Red
    }
}

function Test-InvalidEchange {
    Write-Host "Test: Création d’un échange invalide (champ manquant)..." -ForegroundColor Cyan
    $body = @{
        offre = @{
            mode = "echange"
            mode_troc = "echange"
            # quantite manquant
            unite = "kg"
        };
        besoin = @{
            quantite = 5;
            unite = "kg"
        };
        user_id = $userId
    } | ConvertTo-Json -Depth 5
    try {
        $resp = Invoke-RestMethod -Uri "$apiBase/echanges" -Method Post -Body $body -ContentType 'application/json' -Headers $headers -ErrorAction Stop
        if ($resp.error) {
            Write-Host "OK: Echange invalide rejeté (erreur attendue)" -ForegroundColor Green
        } else {
            Write-Host "ERREUR: Echange invalide accepté !" -ForegroundColor Red
        }
    } catch {
        Write-Host "OK: Echange invalide rejeté (erreur attendue)" -ForegroundColor Green
    }
}

function Test-StatusEchange {
    Write-Host "Test: Consultation du statut d’un échange..." -ForegroundColor Cyan
    # Créer un échange valide d’abord
    $body = @{
        offre = @{
            mode = "echange"
            mode_troc = "echange"
            quantite = 10;
            unite = "kg";
            lot = "A1";
            gps = @{ lat = 48.85; lon = 2.35 }
        };
        besoin = @{
            quantite = 5;
            unite = "kg";
            lot = "B2";
            gps = @{ lat = 48.86; lon = 2.36 }
        };
        user_id = $userId;
        reputation = 4.5
        mode_troc = "echange" # <-- Ajouté à la racine pour fiabiliser
    } | ConvertTo-Json -Depth 5
    $resp = Invoke-RestMethod -Uri "$apiBase/echanges" -Method Post -Body $body -ContentType 'application/json' -Headers $headers -ErrorAction SilentlyContinue
    if ($resp -and $resp.echange_id) {
        $id = $resp.echange_id
        $status = Invoke-RestMethod -Uri "$apiBase/echanges/$id/status" -Method Get -Headers $headers -ErrorAction SilentlyContinue
        if ($status -and $status.statut) {
            Write-Host "OK: Statut de l’échange $id : $($status.statut)" -ForegroundColor Green
        } else {
            Write-Host "ERREUR: Impossible de récupérer le statut de l’échange $id" -ForegroundColor Red
        }
    } else {
        Write-Host "ERREUR: Impossible de créer un échange pour le test de statut" -ForegroundColor Red
    }
}

function Test-MatchingAutomatique {
    Write-Host "Test: Matching automatique (scoring pondéré, JSON strictement compatible)..." -ForegroundColor Cyan
    # Créer deux échanges strictement symétriques (structure et valeurs identiques, juste offre/besoin inversés)
    $email1 = "test_echange1_$([guid]::NewGuid().ToString('N').Substring(0,8))@yukpo.com"
    $password1 = "Test1234!"
    $registerBody1 = @{ email = $email1; password = $password1; lang = "fr" } | ConvertTo-Json
    try { Invoke-RestMethod -Uri "http://localhost:3001/auth/register" -Method POST -Body $registerBody1 -ContentType "application/json" | Out-Null } catch {}
    $loginBody1 = @{ email = $email1; password = $password1 } | ConvertTo-Json
    $loginResponse1 = Invoke-RestMethod -Uri "http://localhost:3001/auth/login" -Method POST -Body $loginBody1 -ContentType "application/json"
    $jwt1 = $loginResponse1.token
    $jwtParts1 = $jwt1 -split '\.'
    $payload1 = $jwtParts1[1]; switch ($payload1.Length % 4) { 2 { $payload1 += '==' } 3 { $payload1 += '=' } }
    $payloadJson1 = [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($payload1.Replace('-', '+').Replace('_', '/')))
    $payloadObj1 = $payloadJson1 | ConvertFrom-Json
    $userId1 = [int]$payloadObj1.sub
    $headers1 = @{ Authorization = "Bearer $jwt1" }
    $email2 = "test_echange2_$([guid]::NewGuid().ToString('N').Substring(0,8))@yukpo.com"
    $password2 = "Test1234!"
    $registerBody2 = @{ email = $email2; password = $password2; lang = "fr" } | ConvertTo-Json
    try { Invoke-RestMethod -Uri "http://localhost:3001/auth/register" -Method POST -Body $registerBody2 -ContentType "application/json" | Out-Null } catch {}
    $loginBody2 = @{ email = $email2; password = $password2 } | ConvertTo-Json
    $loginResponse2 = Invoke-RestMethod -Uri "http://localhost:3001/auth/login" -Method POST -Body $loginBody2 -ContentType "application/json"
    $jwt2 = $loginResponse2.token
    $jwtParts2 = $jwt2 -split '\.'
    $payload2 = $jwtParts2[1]; switch ($payload2.Length % 4) { 2 { $payload2 += '==' } 3 { $payload2 += '=' } }
    $payloadJson2 = [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($payload2.Replace('-', '+').Replace('_', '/')))
    $payloadObj2 = $payloadJson2 | ConvertFrom-Json
    $userId2 = [int]$payloadObj2.sub
    $headers2 = @{ Authorization = "Bearer $jwt2" }
    # Structure JSON strictement identique (mêmes champs, même ordre, mêmes types)
    $offre1 = @{ mode = "echange"; mode_troc = "echange"; quantite = 10; unite = "kg"; lot = "A1"; gps = @{ lat = 48.85; lon = 2.35 } }
    $besoin1 = @{ quantite = 5; unite = "kg"; lot = "B2"; gps = @{ lat = 48.86; lon = 2.36 } }
    $offre2 = @{ mode = "echange"; mode_troc = "echange"; quantite = 5; unite = "kg"; lot = "B2"; gps = @{ lat = 48.86; lon = 2.36 } }
    $besoin2 = @{ quantite = 10; unite = "kg"; lot = "A1"; gps = @{ lat = 48.85; lon = 2.35 } }
    $body1 = @{ offre = $offre1; besoin = $besoin1; user_id = $userId1; reputation = 4.0 } | ConvertTo-Json -Depth 5
    $body2 = @{ offre = $offre2; besoin = $besoin2; user_id = $userId2; reputation = 4.2 } | ConvertTo-Json -Depth 5
    $resp1 = Invoke-RestMethod -Uri "$apiBase/echanges" -Method Post -Body $body1 -ContentType 'application/json' -Headers $headers1 -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 3 # Délai augmenté pour garantir l'insertion et la visibilité en base
    $resp2 = Invoke-RestMethod -Uri "$apiBase/echanges" -Method Post -Body $body2 -ContentType 'application/json' -Headers $headers2 -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
    # Relance explicite du matching automatique (nouveau endpoint)
    $matchingResp = Invoke-RestMethod -Uri "$apiBase/echanges/relancer-matching" -Method Post -Headers $headers1 -ErrorAction SilentlyContinue
    $maxTries = 5
    $matched = $false
    for ($i = 0; $i -lt $maxTries; $i++) {
        Start-Sleep -Seconds 2
        $status1 = Invoke-RestMethod -Uri "$apiBase/echanges/$($resp1.echange_id)/status" -Method Get -Headers $headers1 -ErrorAction SilentlyContinue
        $status2 = Invoke-RestMethod -Uri "$apiBase/echanges/$($resp2.echange_id)/status" -Method Get -Headers $headers2 -ErrorAction SilentlyContinue
        Write-Host "DEBUG: Statut1 = $($status1 | ConvertTo-Json -Depth 5)"
        Write-Host "DEBUG: Statut2 = $($status2 | ConvertTo-Json -Depth 5)"
        if (
            $status1.statut -eq "matche" -and
            $status2.statut -eq "matche" -and
            $status1.match_id -eq $status2.match_id -and
            $status1.match_id -ne $null
        ) {
            $matched = $true
            break
        }
    }
    if ($matched) {
        Write-Host "OK: Matching automatique réussi entre $($resp1.echange_id) et $($resp2.echange_id)" -ForegroundColor Green
    } else {
        Write-Host "ERREUR: Matching automatique non détecté !" -ForegroundColor Red
    }
}

function Test-EchangeModeInvalide {
    Write-Host "Test: Création d’un échange avec mode invalide..." -ForegroundColor Cyan
    $body = @{
        intention = "echange"
        mode = "vente"
        listeproduit = @(@{ isbn = "9781234567890"; titre = "Maths"; etat = "neuf" })
        mode_troc = "echange"
        gps = @{ lat = 48.85; lon = 2.35 }
        user_id = $userId
    } | ConvertTo-Json -Depth 5
    try {
        $resp = Invoke-RestMethod -Uri "$apiBase/fournitures/gestion" -Method Post -Body $body -ContentType 'application/json' -Headers $headers -ErrorAction Stop
        Write-Host "ERREUR: Echange avec mode invalide accepté !" -ForegroundColor Red
    } catch {
        if ($_.Exception.Response.StatusCode.value__ -eq 400) {
            $errResp = $null
            try { $errResp = $_.Exception.Response.GetResponseStream() | 
                % { $reader = New-Object IO.StreamReader($_); $reader.ReadToEnd() } | ConvertFrom-Json } catch {}
            if ($errResp) {
                Write-Host "OK: Echange avec mode invalide rejeté (erreur attendue) : $($errResp | ConvertTo-Json -Depth 5)" -ForegroundColor Green
            } else {
                Write-Host "OK: Echange avec mode invalide rejeté (erreur attendue, pas de message JSON)" -ForegroundColor Green
            }
        } else {
            Write-Host "ERREUR: Statut inattendu $($_.Exception.Response.StatusCode)" -ForegroundColor Red
        }
    }
}

function Test-EchangeGPSInvalide {
    Write-Host "Test: Création d’un échange avec GPS invalide..." -ForegroundColor Cyan
    $body = @{
        intention = "echange"
        mode = "echange"
        listeproduit = @(@{ isbn = "9781234567890"; titre = "Maths"; etat = "neuf" })
        mode_troc = "echange"
        gps = @{ lat = 999.0; lon = 2.35 }
        user_id = $userId
    } | ConvertTo-Json -Depth 5
    try {
        $resp = Invoke-RestMethod -Uri "$apiBase/fournitures/gestion" -Method Post -Body $body -ContentType 'application/json' -Headers $headers -ErrorAction Stop
        Write-Host "ERREUR: Echange avec GPS invalide accepté !" -ForegroundColor Red
    } catch {
        if ($_.Exception.Response.StatusCode.value__ -eq 400) {
            $errResp = $null
            try { $errResp = $_.Exception.Response.GetResponseStream() | 
                % { $reader = New-Object IO.StreamReader($_); $reader.ReadToEnd() } | ConvertFrom-Json } catch {}
            if ($errResp) {
                Write-Host "OK: Echange avec GPS invalide rejeté (erreur attendue) : $($errResp | ConvertTo-Json -Depth 5)" -ForegroundColor Green
            } else {
                Write-Host "OK: Echange avec GPS invalide rejeté (erreur attendue, pas de message JSON)" -ForegroundColor Green
            }
        } else {
            Write-Host "ERREUR: Statut inattendu $($_.Exception.Response.StatusCode)" -ForegroundColor Red
        }
    }
}

function Test-EchangeDon {
    Write-Host "Test: Création d’un échange de don (champ don=true)..." -ForegroundColor Cyan
    $body = @{
        intention = "echange"
        mode = "don"
        don = $true
        listeproduit = @(@{ isbn = "9781234567890"; titre = "Maths"; etat = "neuf" })
        user_id = $userId
    } | ConvertTo-Json -Depth 5
    try {
        $resp = Invoke-RestMethod -Uri "$apiBase/fournitures/gestion" -Method Post -Body $body -ContentType 'application/json' -Headers $headers -ErrorAction Stop
        if ($resp.error) {
            Write-Host "OK: Echange de don rejeté (erreur attendue) : $($resp | ConvertTo-Json -Depth 5)" -ForegroundColor Green
        } else {
            Write-Host "ERREUR: Echange de don accepté alors qu'il devrait être rejeté !" -ForegroundColor Red
        }
    } catch {
        if ($_.Exception.Response.StatusCode.value__ -eq 400) {
            Write-Host "OK: Echange de don rejeté (erreur attendue)" -ForegroundColor Green
        } else {
            Write-Host "ERREUR: Statut inattendu $($_.Exception.Response.StatusCode)" -ForegroundColor Red
        }
    }
}

function Test-EchangeQuantiteNegative {
    Write-Host "Test: Création d’un échange avec quantité négative..." -ForegroundColor Cyan
    $body = @{
        intention = "echange"
        mode = "echange"
        listeproduit = @(@{ isbn = "9781234567890"; titre = "Maths"; etat = "neuf"; quantite = -5 })
        user_id = $userId
    } | ConvertTo-Json -Depth 5
    try {
        $resp = Invoke-RestMethod -Uri "$apiBase/fournitures/gestion" -Method Post -Body $body -ContentType 'application/json' -Headers $headers -ErrorAction Stop
        Write-Host "ERREUR: Echange avec quantité négative accepté !" -ForegroundColor Red
    } catch {
        if ($_.Exception.Response.StatusCode.value__ -eq 400) {
            Write-Host "OK: Echange avec quantité négative rejeté (erreur attendue)" -ForegroundColor Green
        } else {
            Write-Host "ERREUR: Statut inattendu $($_.Exception.Response.StatusCode)" -ForegroundColor Red
        }
    }
}

function Test-EchangeProduitInconnu {
    Write-Host "Test: Création d’un échange avec produit inconnu..." -ForegroundColor Cyan
    $body = @{
        intention = "echange"
        mode = "echange"
        listeproduit = @(@{ isbn = "0000000000000"; titre = "ProduitInconnu"; etat = "neuf" })
        user_id = $userId
    } | ConvertTo-Json -Depth 5
    try {
        $resp = Invoke-RestMethod -Uri "$apiBase/fournitures/gestion" -Method Post -Body $body -ContentType 'application/json' -Headers $headers -ErrorAction Stop
        Write-Host "ERREUR: Echange avec produit inconnu accepté !" -ForegroundColor Red
    } catch {
        if ($_.Exception.Response.StatusCode.value__ -eq 400) {
            Write-Host "OK: Echange avec produit inconnu rejeté (erreur attendue)" -ForegroundColor Green
        } else {
            Write-Host "ERREUR: Statut inattendu $($_.Exception.Response.StatusCode)" -ForegroundColor Red
        }
    }
}

function Test-EchangeDoublon {
    Write-Host "Test: Création d’un doublon d’échange (même utilisateur, même offre/besoin)..." -ForegroundColor Cyan
    $body = @{
        intention = "echange"
        mode = "echange"
        listeproduit = @(@{ isbn = "9781234567890"; titre = "Maths"; etat = "neuf" })
        user_id = $userId
    } | ConvertTo-Json -Depth 5
    try {
        $resp1 = Invoke-RestMethod -Uri "$apiBase/fournitures/gestion" -Method Post -Body $body -ContentType 'application/json' -Headers $headers -ErrorAction Stop
        $resp2 = Invoke-RestMethod -Uri "$apiBase/fournitures/gestion" -Method Post -Body $body -ContentType 'application/json' -Headers $headers -ErrorAction Stop
        if ($resp2.error) {
            Write-Host "OK: Doublon d’échange rejeté (erreur attendue) : $($resp2 | ConvertTo-Json -Depth 5)" -ForegroundColor Green
        } else {
            Write-Host "ERREUR: Doublon d’échange accepté !" -ForegroundColor Red
        }
    } catch {
        if ($_.Exception.Response.value__ -eq 400) {
            Write-Host "OK: Doublon d’échange rejeté (erreur attendue)" -ForegroundColor Green
        } else {
            Write-Host "ERREUR: Statut inattendu $($_.Exception.Response.StatusCode)" -ForegroundColor Red
        }
    }
}

function Test-EchangeModeAchat {
    Write-Host "Test: Création d’un échange avec mode=achat..." -ForegroundColor Cyan
    $body = @{
        intention = "echange"
        mode = "achat"
        listeproduit = @(@{ isbn = "9781234567890"; titre = "Maths"; etat = "neuf" })
        mode_troc = "echange"
        gps = @{ lat = 48.85; lon = 2.35 }
        user_id = 1
    } | ConvertTo-Json -Depth 5
    try {
        $resp = Invoke-RestMethod -Uri "$apiBase/echanges" -Method Post -Body $body -ContentType 'application/json' -Headers $headers -ErrorAction Stop
        Write-Host "ERREUR: Echange avec mode=achat accepté !" -ForegroundColor Red
    } catch {
        try {
            $errResp = $_.ErrorDetails.Message | ConvertFrom-Json
            if ($errResp -and $errResp.error) {
                Write-Host "OK: Echange avec mode=achat rejeté (erreur attendue) : $($errResp | ConvertTo-Json -Depth 5)" -ForegroundColor Green
            } else {
                Write-Host "OK: Echange avec mode=achat rejeté (erreur attendue, pas de message JSON)" -ForegroundColor Green
            }
        } catch {
            Write-Host "OK: Echange avec mode=achat rejeté (erreur attendue, pas de message JSON)" -ForegroundColor Green
        }
    }
}

function Test-EchangeModeAchatComplet {
    Write-Host "Test: Processus complet avec mode=achat (création, statut, matching)..." -ForegroundColor Cyan
    $email = "test_achat_$([guid]::NewGuid().ToString('N').Substring(0,8))@yukpo.com"
    $password = "Test1234!"
    $registerBody = @{ email = $email; password = $password; lang = "fr" } | ConvertTo-Json
    try { Invoke-RestMethod -Uri "http://localhost:3001/auth/register" -Method POST -Body $registerBody -ContentType "application/json" | Out-Null } catch {}
    $loginBody = @{ email = $email; password = $password } | ConvertTo-Json
    $loginResponse = Invoke-RestMethod -Uri "http://localhost:3001/auth/login" -Method POST -Body $loginBody -ContentType "application/json"
    $jwt = $loginResponse.token
    $headersAchat = @{ Authorization = "Bearer $jwt" }
    $offre = @{ mode = "echange"; mode_troc = "echange"; produit = "pommes"; quantite = 10; unite = "kg"; lot = "A1"; gps = @{ lat = 48.85; lon = 2.35 } }
    $besoin = @{ produit = "oranges"; quantite = 5; unite = "kg"; lot = "B2"; gps = @{ lat = 48.86; lon = 2.36 } }
    $bodyAchat = @{ offre = $offre; besoin = $besoin; user_id = 1; reputation = 4.0; mode = "achat" } | ConvertTo-Json -Depth 5
    try {
        $respAchat = Invoke-RestMethod -Uri "$apiBase/echanges" -Method Post -Body $bodyAchat -ContentType 'application/json' -Headers $headersAchat -ErrorAction Stop
        Write-Host "ERREUR: Echange avec mode=achat accepté ! (ceci n'est pas conforme à la logique métier)" -ForegroundColor Red
    } catch {
        try {
            $errResp = $_.ErrorDetails.Message | ConvertFrom-Json
            if ($errResp -and $errResp.error) {
                Write-Host "OK: Echange avec mode=achat rejeté (logique métier respectée) : $($errResp | ConvertTo-Json -Depth 5)" -ForegroundColor Green
            } else {
                Write-Host "OK: Echange avec mode=achat rejeté (logique métier respectée, pas de message JSON)" -ForegroundColor Green
            }
        } catch {
            Write-Host "OK: Echange avec mode=achat rejeté (logique métier respectée, pas de message JSON)" -ForegroundColor Green
        }
    }
}

# Exécution des tests
test-validEchange
test-invalidEchange
test-statusEchange
test-matchingAutomatique
test-echangeModeInvalide
test-echangeGPSInvalide
test-echangeDon
test-echangeQuantiteNegative
test-echangeProduitInconnu
test-echangeDoublon
Test-EchangeModeAchat
Test-EchangeModeAchatComplet
