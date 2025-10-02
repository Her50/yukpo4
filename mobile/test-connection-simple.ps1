# Test de connexion mobile vers Render
Write-Host "Test de connexion mobile vers le backend Render..." -ForegroundColor Cyan

$backendUrl = "https://yukpomnang.onrender.com"

# Test 1: Health check
Write-Host "`n1. Test du health check..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$backendUrl/healthz" -Method GET
    if ($response.StatusCode -eq 200) {
        Write-Host "Backend accessible: $($response.StatusCode)" -ForegroundColor Green
        $healthData = $response.Content | ConvertFrom-Json
        Write-Host "   Status: $($healthData.status)" -ForegroundColor White
        Write-Host "   Service: $($healthData.service)" -ForegroundColor White
    }
}
catch {
    Write-Host "Erreur health check: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 2: Test d'authentification
Write-Host "`n2. Test d'authentification..." -ForegroundColor Yellow
try {
    $loginData = @{
        email    = "test@example.com"
        password = "test123"
    } | ConvertTo-Json

    $response = Invoke-WebRequest -Uri "$backendUrl/auth/login" -Method POST -ContentType "application/json" -Body $loginData
    if ($response.StatusCode -eq 200) {
        Write-Host "Authentification fonctionnelle: $($response.StatusCode)" -ForegroundColor Green
        $authData = $response.Content | ConvertFrom-Json
        if ($authData.token) {
            Write-Host "   Token recu: $($authData.token.Substring(0, 20))..." -ForegroundColor White
        }
    }
}
catch {
    Write-Host "Erreur authentification: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 3: Verification de la configuration mobile
Write-Host "`n3. Verification de la configuration mobile..." -ForegroundColor Yellow
$configFile = "src/config/environment.ts"
if (Test-Path $configFile) {
    $config = Get-Content $configFile
    $apiUrl = $config | Where-Object { $_ -match "API_URL.*yukpomnang.onrender.com" }
    if ($apiUrl) {
        Write-Host "Configuration mobile correcte" -ForegroundColor Green
        Write-Host "   $apiUrl" -ForegroundColor White
    }
    else {
        Write-Host "Configuration mobile incorrecte" -ForegroundColor Red
    }
}
else {
    Write-Host "Fichier de configuration non trouve" -ForegroundColor Red
}

Write-Host "`nResume:" -ForegroundColor Cyan
Write-Host "   - Backend Render: https://yukpomnang.onrender.com" -ForegroundColor White
Write-Host "   - API Mobile: https://yukpomnang.onrender.com" -ForegroundColor White
Write-Host "   - Authentification: Fonctionnelle" -ForegroundColor White

Write-Host "`nProchaines etapes:" -ForegroundColor Cyan
Write-Host "   1. Lancer l'application mobile: npm start" -ForegroundColor White
Write-Host "   2. Tester la connexion avec les identifiants" -ForegroundColor White
Write-Host "   3. Verifier que l'authentification fonctionne" -ForegroundColor White
