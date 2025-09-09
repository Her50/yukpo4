# test_all_routes.ps1
# Force l'encodage UTF-8 pour un affichage correct
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$baseUrl = "http://localhost:3001"
$token = ""

# Génère un email unique
$email = "apitest$(Get-Random)@example.com"

$successCount = 0
$failCount = 0

function AssertKey {
    param(
        [Parameter(Mandatory)]$Response,
        [Parameter(Mandatory)]$Key
    )
    if ($Response.PSObject.Properties.Name -contains $Key) {
        return $true
    } else {
        Write-Host "[ASSERT FAIL] Clé '$Key' absente dans la réponse."
        return $false
    }
}

# 1. Register
Write-Host "`n=== /auth/register (POST) ==="
try {
    $register = Invoke-RestMethod -Uri "$baseUrl/auth/register" -Method Post -Body (@{ email=$email; password="test1234" } | ConvertTo-Json) -ContentType "application/json"
    if (AssertKey $register "id") { $successCount++ } else { $failCount++ }
    Write-Host "Status: 200 (OK)"
    Write-Host ($register | ConvertTo-Json)
    $userId = $register.id
} catch {
    Write-Host "Status: $($_.Exception.Response.StatusCode.value__) (FAIL)"
    try {
        $stream = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($stream)
        $body = $reader.ReadToEnd()
        Write-Host "Body: $body"
    } catch {
        Write-Host "Body: (impossible à lire)"
    }
    Write-Host $_.Exception.Message
    $failCount++
}

# 2. Login
Write-Host "`n=== /auth/login (POST) ==="
try {
    $login = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method Post -Body (@{ email=$email; password="test1234" } | ConvertTo-Json) -ContentType "application/json"
    if (AssertKey $login "token") { $successCount++ } else { $failCount++ }
    Write-Host "Status: 200 (OK)"
    Write-Host ($login | ConvertTo-Json)
    $token = $login.token
} catch {
    Write-Host "Status: $($_.Exception.Response.StatusCode.value__) (FAIL)"
    try {
        $stream = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($stream)
        $body = $reader.ReadToEnd()
        Write-Host "Body: $body"
    } catch {
        Write-Host "Body: (impossible à lire)"
    }
    Write-Host $_.Exception.Message
    $failCount++
}

$headers = @{ Authorization = "Bearer $token" }

# 3. Test des routes publiques (sans token)
$publicRoutes = @(
    @{ name = "/healthz (GET, public)"; method = "Get"; url = "$baseUrl/healthz"; body = $null; expect = 200 }
)
foreach ($route in $publicRoutes) {
    Write-Host "`n=== $($route.name) ==="
    try {
        $response = Invoke-RestMethod -Uri $route.url -Method $route.method
        Write-Host "Status: 200 (OK)"
        $successCount++
        Write-Host ($response | ConvertTo-Json)
    } catch {
        Write-Host "Status: $($_.Exception.Response.StatusCode.value__) (FAIL)"
        try {
            $stream = $_.Exception.Response.GetResponseStream()
            $reader = New-Object System.IO.StreamReader($stream)
            $body = $reader.ReadToEnd()
            Write-Host "Body: $body"
        } catch {
            Write-Host "Body: (impossible à lire)"
        }
        Write-Host $_.Exception.Message
        $failCount++
    }
}

# 4. Test des routes protégées avec token
$routes = @(
    @{ name = "/user/me (GET)"; method = "Get"; url = "$baseUrl/user/me"; body = $null; expect = 200; assert = "email" },
    @{ name = "/users/balance (GET)"; method = "Get"; url = "$baseUrl/users/balance"; body = $null; expect = 200; assert = "tokens_balance" },
    @{ name = "/users/purchase_pack (POST)"; method = "Post"; url = "$baseUrl/users/purchase_pack"; body = (@{ pack_id = 1 } | ConvertTo-Json); expect = 200 },
    @{ name = "/user/me (PUT)"; method = "Put"; url = "$baseUrl/user/me"; body = (@{ preferred_lang = "fr" } | ConvertTo-Json); expect = 200 },
    @{ name = "/user/me/gps_consent (PATCH)"; method = "Patch"; url = "$baseUrl/user/me/gps_consent"; body = (@{ gps_consent = $true } | ConvertTo-Json); expect = 200 },
    @{ name = "/services/filter (GET)"; method = "Get"; url = "$baseUrl/services/filter"; body = $null; expect = 200 },
    @{ name = "/api/ia/score (POST)"; method = "Post"; url = "$baseUrl/api/ia/score"; body = (@{ ip = "127.0.0.1"; path = "/test"; freq = 1 } | ConvertTo-Json); expect = 200 },
    @{ name = "/api/ia/predict (POST)"; method = "Post"; url = "$baseUrl/api/ia/predict"; body = (@{ texte = "Ceci est un test IA" } | ConvertTo-Json); expect = 200 }
)
foreach ($route in $routes) {
    Write-Host "`n=== $($route.name) ==="
    try {
        if ($route.body) {
            $response = Invoke-RestMethod -Uri $route.url -Method $route.method -Headers $headers -Body $route.body -ContentType "application/json"
        } else {
            $response = Invoke-RestMethod -Uri $route.url -Method $route.method -Headers $headers
        }
        Write-Host "Status: 200 (OK)"
        if ($route.assert) {
            if (AssertKey $response $route.assert) { $successCount++ } else { $failCount++ }
        } else {
            $successCount++
        }
        Write-Host ($response | ConvertTo-Json)
    } catch {
        Write-Host "Status: $($_.Exception.Response.StatusCode.value__) (FAIL)"
        try {
            $stream = $_.Exception.Response.GetResponseStream()
            $reader = New-Object System.IO.StreamReader($stream)
            $body = $reader.ReadToEnd()
            Write-Host "Body: $body"
        } catch {
            Write-Host "Body: (impossible à lire)"
        }
        Write-Host $_.Exception.Message
        $failCount++
    }
}

# 5. Test des routes protégées sans token
foreach ($route in $routes) {
    Write-Host "`n=== $($route.name) (NO TOKEN) ==="
    try {
        if ($route.body) {
            $response = Invoke-RestMethod -Uri $route.url -Method $route.method -Body $route.body -ContentType "application/json"
        } else {
            $response = Invoke-RestMethod -Uri $route.url -Method $route.method
        }
        Write-Host "[FAIL] Accès non autorisé mais pas d'erreur !"
        $failCount++
    } catch {
        $status = $_.Exception.Response.StatusCode.value__
        if ($status -eq 401 -or $status -eq 403) {
            Write-Host "Status: $status (OK, accès refusé comme attendu)"
            $successCount++
        } else {
            Write-Host "Status: $status (FAIL)"
            try {
                $stream = $_.Exception.Response.GetResponseStream()
                $reader = New-Object System.IO.StreamReader($stream)
                $body = $reader.ReadToEnd()
                Write-Host "Body: $body"
            } catch {
                Write-Host "Body: (impossible à lire)"
            }
            Write-Host $_.Exception.Message
            $failCount++
        }
    }
}

# 6. Test des routes protégées avec token invalide
$badHeaders = @{ Authorization = "Bearer FAUXTOKEN123" }
foreach ($route in $routes) {
    Write-Host "`n=== $($route.name) (BAD TOKEN) ==="
    try {
        if ($route.body) {
            $response = Invoke-RestMethod -Uri $route.url -Method $route.method -Headers $badHeaders -Body $route.body -ContentType "application/json"
        } else {
            $response = Invoke-RestMethod -Uri $route.url -Method $route.method -Headers $badHeaders
        }
        Write-Host "[FAIL] Accès non autorisé mais pas d'erreur !"
        $failCount++
    } catch {
        $status = $_.Exception.Response.StatusCode.value__
        if ($status -eq 401 -or $status -eq 403) {
            Write-Host "Status: $status (OK, accès refusé comme attendu)"
            $successCount++
        } else {
            Write-Host "Status: $status (FAIL)"
            try {
                $stream = $_.Exception.Response.GetResponseStream()
                $reader = New-Object System.IO.StreamReader($stream)
                $body = $reader.ReadToEnd()
                Write-Host "Body: $body"
            } catch {
                Write-Host "Body: (impossible à lire)"
            }
            Write-Host $_.Exception.Message
            $failCount++
        }
    }
}

# Résumé final
Write-Host "`n==================="
Write-Host "Tests réussis : $successCount"
Write-Host "Tests échoués : $failCount"
Write-Host "==================="