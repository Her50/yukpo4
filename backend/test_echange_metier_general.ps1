# test_echange_metier_general.ps1 — Test PowerShell pour la logique métier d'échange général Yukpo
# Ce test vérifie la création d'un échange via l'API /echanges et la logique métier stricte (hors fournitures scolaires)

$apiBase = "http://localhost:3001"

# Création d'un utilisateur de test
$email = "test_metier_general_$([guid]::NewGuid().ToString('N').Substring(0,8))@yukpo.com"
$password = "Test1234!"
$registerBody = @{ email = $email; password = $password; lang = "fr" } | ConvertTo-Json
try {
    $registerResponse = Invoke-RestMethod -Uri "$apiBase/auth/register" -Method POST -Body $registerBody -ContentType "application/json"
    Write-Host "✅ Utilisateur de test créé : $email / $password"
} catch {
    Write-Host "❌ Erreur lors de la création de l'utilisateur de test." -ForegroundColor Red
    exit 1
}

# Login pour récupérer le JWT
$loginBody = @{ email = $email; password = $password } | ConvertTo-Json
try {
    $loginResponse = Invoke-RestMethod -Uri "$apiBase/auth/login" -Method POST -Body $loginBody -ContentType "application/json"
    $jwt = $loginResponse.token
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
} catch {
    Write-Host "❌ Erreur lors du login. Vérifie email/mot de passe et l'API." -ForegroundColor Red
    exit 1
}
$headers = @{ Authorization = "Bearer $jwt" }

# Création d'un échange général (mode echange)
$body = @{
    offre = @{
        mode = "echange"
        mode_troc = "echange"
        quantite = 10
        unite = "kg"
        lot = "A1"
        gps = @{ lat = 48.85; lon = 2.35 }
    }
    besoin = @{
        quantite = 5
        unite = "kg"
        lot = "B2"
        gps = @{ lat = 48.86; lon = 2.36 }
    }
    user_id = $userId
    reputation = 4.5
    mode_troc = "echange"
} | ConvertTo-Json -Depth 5

try {
    $resp = Invoke-RestMethod -Uri "$apiBase/echanges" -Method Post -Body $body -ContentType 'application/json' -Headers $headers -ErrorAction SilentlyContinue
    if ($resp -and $resp.echange_id) {
        Write-Host "✅ Echange général créé avec id $($resp.echange_id)" -ForegroundColor Green
        # Vérification du statut
        $status = Invoke-RestMethod -Uri "$apiBase/echanges/$($resp.echange_id)/status" -Method Get -Headers $headers -ErrorAction SilentlyContinue
        if ($status -and $status.statut) {
            Write-Host "✅ Statut de l’échange $($resp.echange_id) : $($status.statut)" -ForegroundColor Green
        } else {
            Write-Host "❌ Impossible de récupérer le statut de l’échange $($resp.echange_id)" -ForegroundColor Red
        }
    } else {
        Write-Host "❌ Echange général non créé (réponse: $($resp | Out-String))" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Erreur lors de la création de l'échange général : $($_.Exception.Message)" -ForegroundColor Red
}
