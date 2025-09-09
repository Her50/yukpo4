$baseUrl = "http://localhost:3001"

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
    exit 1
}

$loginBody = @{
    email = $email
    password = $password
}
try {
    $loginResponse = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method POST -Body ($loginBody | ConvertTo-Json) -ContentType "application/json"
    $jwtToken = $loginResponse.token
    $jwtParts = $jwtToken -split '\.'
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

function Assert-Status($response, $expected, $msg) {
    $ok = $response.StatusCode -eq $expected
    if ($ok) {
        Write-Host "✅ $msg" -ForegroundColor Green
    } else {
        Write-Host "❌ $msg (attendu $expected, reçu $($response.StatusCode))" -ForegroundColor Red
        Write-Host "Réponse: $($response.Content | ConvertTo-Json -Depth 10)"
    }
}

function Invoke-Api($body) {
    $headers = @{
        "Authorization" = "Bearer $jwtToken"
        "Content-Type"  = "application/json"
    }
    $fixedBody = @{
        user_id = [int]$body.user_id
        data    = $body.data
    }
    try {
        $jsonBody = $fixedBody | ConvertTo-Json -Depth 10
        $response = Invoke-WebRequest -Uri "$baseUrl/services/create" -Method POST -Headers $headers -Body $jsonBody -ErrorAction Stop
        return $response
    } catch {
        return $_.Exception.Response
    }
}

$payloads = @(
    @{
        name = "Test complet IA (positif)"
        expected = 201
        data = @{
            titre = @{ valeur = "Test complet IA"; type_donnee = "string"; origine_champs = "ia" }
            description = @{ valeur = "desc test"; type_donnee = "string"; origine_champs = "ia" }
            category = @{ valeur = "test"; type_donnee = "string"; origine_champs = "ia" }
            is_tarissable = $true
            vitesse_tarissement = "lente"
            gps = $false
            intention = "Test intention"
        }
    },
    @{
        name = "Service non tarissable sans vitesse"
        expected = 201
        data = @{
            titre = @{ valeur = "Service non tarissable"; type_donnee = "string"; origine_champs = "ia" }
            description = @{ valeur = "desc non tarissable"; type_donnee = "string"; origine_champs = "ia" }
            category = @{ valeur = "autre"; type_donnee = "string"; origine_champs = "ia" }
            is_tarissable = $false
            gps = $false
            intention = "Pas de vitesse requise"
        }
    },
    @{
        name = "Service avec GPS valide"
        expected = 201
        data = @{
            titre = @{ valeur = "Service GPS"; type_donnee = "string"; origine_champs = "ia" }
            description = @{ valeur = "desc gps"; type_donnee = "string"; origine_champs = "ia" }
            category = @{ valeur = "gps"; type_donnee = "string"; origine_champs = "ia" }
            is_tarissable = $false
            gps = $true
            gps_coords = "48.8566,2.3522"
            intention = "Service géolocalisé"
        }
    },
    @{
        name = "Service avec vitesse moyenne"
        expected = 201
        data = @{
            titre = @{ valeur = "Service vitesse moyenne"; type_donnee = "string"; origine_champs = "ia" }
            description = @{ valeur = "desc vitesse moyenne"; type_donnee = "string"; origine_champs = "ia" }
            category = @{ valeur = "test"; type_donnee = "string"; origine_champs = "ia" }
            is_tarissable = $true
            vitesse_tarissement = "moyenne"
            gps = $false
            intention = "Test vitesse moyenne"
        }
    },
    @{
        name = "Service avec vitesse rapide"
        expected = 201
        data = @{
            titre = @{ valeur = "Service vitesse rapide"; type_donnee = "string"; origine_champs = "ia" }
            description = @{ valeur = "desc vitesse rapide"; type_donnee = "string"; origine_champs = "ia" }
            category = @{ valeur = "test"; type_donnee = "string"; origine_champs = "ia" }
            is_tarissable = $true
            vitesse_tarissement = "rapide"
            gps = $false
            intention = "Test vitesse rapide"
        }
    },
    @{
        name = "Intention recherche_besoin"
        expected = 201
        data = @{
            titre = @{ valeur = "Recherche plombier"; type_donnee = "string"; origine_champs = "ia" }
            description = @{ valeur = "Je cherche un plombier pour une fuite"; type_donnee = "string"; origine_champs = "ia" }
            category = @{ valeur = "plomberie"; type_donnee = "string"; origine_champs = "ia" }
            is_tarissable = $false
            gps = $true
            gps_coords = "48.8566,2.3522"
            intention = "recherche_besoin"
        }
    },
    @{
        name = "Intention demande_echange"
        expected = 201
        data = @{
            titre = @{ valeur = "Demande d'échange"; type_donnee = "string"; origine_champs = "ia" }
            description = @{ valeur = "Je souhaite échanger un service"; type_donnee = "string"; origine_champs = "ia" }
            category = @{ valeur = "echange"; type_donnee = "string"; origine_champs = "ia" }
            is_tarissable = $false
            gps = $false
            intention = "demande_echange"
        }
    }
)

foreach ($payload in $payloads) {
    Write-Host "\n=== Test IA : $($payload.name) ===" -ForegroundColor Yellow
    $body = @{ user_id = $userId; data = $payload.data }
    $response = Invoke-Api $body
    Assert-Status $response $payload.expected $payload.name
}
