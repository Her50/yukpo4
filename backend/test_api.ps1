# Test automatisé des routes principales de l’API Axum (PowerShell natif)
# Nécessite PowerShell 5+ (Invoke-RestMethod)

$baseUrl = "http://127.0.0.1:3001"

function Show-Result($label, $response, $status) {
    Write-Host "\n=== $label ==="
    Write-Host "Status: $status"
    if ($response) { Write-Host $response | Out-String }
}

# Paramètres de test
$email = "testuser$(Get-Random)-api@example.com"  # Pour éviter les doublons
$password = "password123"

# 1. Création d'utilisateur (register)
$registerBody = @{ email = $email; password = $password } | ConvertTo-Json
try {
    $registerResp = Invoke-RestMethod -Uri "$baseUrl/auth/register" -Method POST -Body $registerBody -ContentType 'application/json' -ErrorAction Stop
    Show-Result "/auth/register (POST)" ($registerResp | ConvertTo-Json -Compress) 200
} catch {
    $status = $_.Exception.Response.StatusCode.Value__
    $content = $_.Exception.Response.Content
    Show-Result "/auth/register (POST)" $content $status
}

# 2. Authentification (login)
$loginBody = @{ email = $email; password = $password } | ConvertTo-Json
$token = $null
try {
    $loginResp = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method POST -Body $loginBody -ContentType 'application/json' -ErrorAction Stop
    $token = $loginResp.token
    Show-Result "/auth/login (POST)" ($loginResp | ConvertTo-Json -Compress) 200
    if ($token) { Write-Host "Token récupéré: $token" }
} catch {
    $status = $_.Exception.Response.StatusCode.Value__
    $content = $_.Exception.Response.Content
    Show-Result "/auth/login (POST)" $content $status
}

# 3. Route protégée /user/me (GET)
if ($token) {
    try {
        $headers = @{ Authorization = "Bearer $token" }
        $userResp = Invoke-RestMethod -Uri "$baseUrl/user/me" -Headers $headers -Method GET -ErrorAction Stop
        Show-Result "/user/me (GET, protégé)" ($userResp | ConvertTo-Json -Compress) 200
    } catch {
        $status = $_.Exception.Response.StatusCode.Value__
        $content = $_.Exception.Response.Content
        Show-Result "/user/me (GET, protégé)" $content $status
    }
} else {
    Write-Host "\n(Saute /user/me : pas de token)"
}

# 4. Test /services/filter (GET)
try {
    $r = Invoke-RestMethod -Uri "$baseUrl/services/filter" -Method GET -ErrorAction Stop
    Show-Result "/services/filter (GET)" ($r | ConvertTo-Json -Compress) 200
} catch {
    $status = $_.Exception.Response.StatusCode.Value__
    $content = $_.Exception.Response.Content
    Show-Result "/services/filter (GET)" $content $status
}

# 5. Test /api/ia/score (POST)
$iaScoreBody = @{ ip = "127.0.0.1"; path = "/test"; freq = 1 } | ConvertTo-Json
try {
    $r = Invoke-RestMethod -Uri "$baseUrl/api/ia/score" -Method POST -Body $iaScoreBody -ContentType 'application/json' -ErrorAction Stop
    Show-Result "/api/ia/score (POST)" ($r | ConvertTo-Json -Compress) 200
} catch {
    $status = $_.Exception.Response.StatusCode.Value__
    $content = $_.Exception.Response.Content
    Show-Result "/api/ia/score (POST)" $content $status
}

# 6. Test /api/ia/predict (POST)
$iaPredictBody = @{ texte = "Quel temps fera-t-il demain ?" } | ConvertTo-Json
try {
    $r = Invoke-RestMethod -Uri "$baseUrl/api/ia/predict" -Method POST -Body $iaPredictBody -ContentType 'application/json' -ErrorAction Stop
    Show-Result "/api/ia/predict (POST)" ($r | ConvertTo-Json -Compress) 200
} catch {
    $status = $_.Exception.Response.StatusCode.Value__
    $content = $_.Exception.Response.Content
    Show-Result "/api/ia/predict (POST)" $content $status
}

# 7. Test /healthz (GET)
try {
    $r = Invoke-RestMethod -Uri "$baseUrl/healthz" -Method GET -ErrorAction Stop
    Show-Result "/healthz (GET)" $r 200
} catch {
    $status = $_.Exception.Response.StatusCode.Value__
    $content = $_.Exception.Response.Content
    Show-Result "/healthz (GET)" $content $status
}

Write-Host "\n---\nTests terminés. Vérifie les codes de retour (200 = OK)."
