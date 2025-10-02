# Script de debug pour l'authentification mobile
Write-Host "Debug de l'authentification mobile..." -ForegroundColor Cyan

Write-Host "`n1. Verification des fichiers d'authentification..." -ForegroundColor Yellow

# Verifier que les fichiers existent
$files = @(
    "src/contexts/AuthContext.tsx",
    "src/screens/auth/LoginScreen.tsx", 
    "src/screens/auth/RegisterScreen.tsx",
    "src/navigation/AppNavigator.tsx"
)

foreach ($file in $files) {
    if (Test-Path $file) {
        Write-Host "   ✅ $file" -ForegroundColor Green
    }
    else {
        Write-Host "   ❌ $file manquant" -ForegroundColor Red
    }
}

Write-Host "`n2. Verification de la configuration API..." -ForegroundColor Yellow
$configFile = "src/config/environment.ts"
if (Test-Path $configFile) {
    $config = Get-Content $configFile
    $apiUrl = $config | Where-Object { $_ -match "API_URL.*yukpomnang.onrender.com" }
    if ($apiUrl) {
        Write-Host "   ✅ URL API correcte" -ForegroundColor Green
    }
    else {
        Write-Host "   ❌ URL API incorrecte" -ForegroundColor Red
    }
}
else {
    Write-Host "   ❌ Fichier de configuration manquant" -ForegroundColor Red
}

Write-Host "`n3. Test de connexion au backend..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "https://yukpomnang.onrender.com/healthz" -Method GET
    if ($response.StatusCode -eq 200) {
        Write-Host "   ✅ Backend accessible" -ForegroundColor Green
    }
}
catch {
    Write-Host "   ❌ Backend inaccessible: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n4. Test d'authentification..." -ForegroundColor Yellow
try {
    $loginData = @{
        email    = "test@example.com"
        password = "test123"
    } | ConvertTo-Json

    $response = Invoke-WebRequest -Uri "https://yukpomnang.onrender.com/auth/login" -Method POST -ContentType "application/json" -Body $loginData
    if ($response.StatusCode -eq 200) {
        Write-Host "   ✅ Authentification fonctionnelle" -ForegroundColor Green
        $authData = $response.Content | ConvertFrom-Json
        if ($authData.token) {
            Write-Host "   ✅ Token JWT reçu" -ForegroundColor Green
        }
    }
}
catch {
    Write-Host "   ❌ Erreur authentification: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n5. Prochaines etapes de debug:" -ForegroundColor Cyan
Write-Host "   1. Lancer l'app: npm start" -ForegroundColor White
Write-Host "   2. Ouvrir les logs de debug dans l'app" -ForegroundColor White
Write-Host "   3. Tester la connexion avec test@example.com / test123" -ForegroundColor White
Write-Host "   4. Verifier les logs dans la console" -ForegroundColor White

Write-Host "`n6. Solutions possibles:" -ForegroundColor Cyan
Write-Host "   - Verifier que l'AuthContext n'a pas de double initialisation" -ForegroundColor White
Write-Host "   - S'assurer que la navigation fonctionne correctement" -ForegroundColor White
Write-Host "   - Verifier que le token est bien sauvegarde dans AsyncStorage" -ForegroundColor White
