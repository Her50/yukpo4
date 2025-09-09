# Script d'analyse du code Rust pour identifier le probleme de serialisation
Write-Host "ANALYSE DU CODE RUST - PROBLEME DE SERIALISATION" -ForegroundColor Cyan
Write-Host "=================================================" -ForegroundColor Cyan

Write-Host "`n1. Analyse du modele User..." -ForegroundColor Yellow

$userModelPath = "backend/src/models/user_model.rs"
if (Test-Path $userModelPath) {
    Write-Host "   Modele User trouve" -ForegroundColor Green
    
    $userModelContent = Get-Content $userModelPath -Raw
    Write-Host "   Structure User identifiee:" -ForegroundColor Gray
    
    # Extraire les champs problématiques
    if ($userModelContent -match "gps.*Option<String>") {
        Write-Host "   - gps: Option<String> OK" -ForegroundColor Green
    }
    if ($userModelContent -match "gps_consent.*bool") {
        Write-Host "   - gps_consent: bool OK" -ForegroundColor Green
    }
    if ($userModelContent -match "nom.*Option<String>") {
        Write-Host "   - nom: Option<String> OK" -ForegroundColor Green
    }
    if ($userModelContent -match "prenom.*Option<String>") {
        Write-Host "   - prenom: Option<String> OK" -ForegroundColor Green
    }
    if ($userModelContent -match "created_at.*NaiveDateTime") {
        Write-Host "   - created_at: NaiveDateTime OK" -ForegroundColor Green
    }
    if ($userModelContent -match "updated_at.*NaiveDateTime") {
        Write-Host "   - updated_at: NaiveDateTime OK" -ForegroundColor Green
    }
} else {
    Write-Host "   Modele User non trouve" -ForegroundColor Red
    exit 1
}

Write-Host "`n2. Analyse du controller user_controller.rs..." -ForegroundColor Yellow

$userControllerPath = "backend/src/controllers/user_controller.rs"
if (Test-Path $userControllerPath) {
    Write-Host "   Controller user_controller.rs trouve" -ForegroundColor Green
    
    $controllerContent = Get-Content $userControllerPath -Raw
    Write-Host "   Fonction get_user_profile identifiee:" -ForegroundColor Gray
    
    if ($controllerContent -match "get_user_profile") {
        Write-Host "   - Fonction get_user_profile trouvee" -ForegroundColor Green
    }
    
    if ($controllerContent -match "sqlx::query_as.*User") {
        Write-Host "   - Requete SQL avec query_as<User> trouvee" -ForegroundColor Green
    }
    
    if ($controllerContent -match "Ok\\(Json\\(profile\\)\\)") {
        Write-Host "   - Retour Json(profile) trouve" -ForegroundColor Green
    }
} else {
    Write-Host "   Controller user_controller.rs non trouve" -ForegroundColor Red
}

Write-Host "`n3. Test de compilation specifique..." -ForegroundColor Yellow

Set-Location "backend"

try {
    Write-Host "   Test de compilation du modele User..." -ForegroundColor Yellow
    $compileResult = cargo check --lib 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   Compilation du modele User reussie" -ForegroundColor Green
    } else {
        Write-Host "   Erreurs de compilation du modele User:" -ForegroundColor Red
        Write-Host "   $compileResult" -ForegroundColor Red
    }
} catch {
    Write-Host "   Erreur lors de la compilation: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n4. Analyse des dependances Cargo.toml..." -ForegroundColor Yellow

$cargoTomlPath = "Cargo.toml"
if (Test-Path $cargoTomlPath) {
    Write-Host "   Cargo.toml trouve" -ForegroundColor Green
    
    $cargoContent = Get-Content $cargoTomlPath -Raw
    
    # Vérifier les versions des dépendances critiques
    if ($cargoContent -match 'serde = "1\.0"') {
        Write-Host "   - serde: 1.0 OK" -ForegroundColor Green
    }
    if ($cargoContent -match 'chrono = "0\.4"') {
        Write-Host "   - chrono: 0.4 OK" -ForegroundColor Green
    }
    if ($cargoContent -match 'serde_json = "1\.0"') {
        Write-Host "   - serde_json: 1.0 OK" -ForegroundColor Green
    }
} else {
    Write-Host "   Cargo.toml non trouve" -ForegroundColor Red
}

Write-Host "`n5. Test de l'API pour confirmer l'erreur..." -ForegroundColor Yellow

Set-Location ".."
$baseUrl = "http://localhost:3001"
$realToken = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOjEsInJvbGUiOiJ1c2VyIiwiZW1haWwiOiJsZWxlaGVybmFuZGV6MjAwN0B5YWhvby5mciIsInRva2Vuc19iYWxhbmNlIjo5OTk5OTI5NzAzNSwiaWF0IjoxNzU2NjMxMjQyLCJleHAiOjE3NTY3MTc2NDJ9.lRG6dFYcNdP170gqFyHyp6AJn95iwukmz-vvXFgLNHw"

try {
    Write-Host "   Test de l'API /api/user/me..." -ForegroundColor Yellow
    $response = Invoke-WebRequest -Uri "$baseUrl/api/user/me" -Method Get -Headers @{"Authorization" = "Bearer $realToken"} -TimeoutSec 15
    
    Write-Host "   SUCCES ! API /api/user/me fonctionne maintenant" -ForegroundColor Green
    Write-Host "   Status Code: $($response.StatusCode)" -ForegroundColor Gray
    Write-Host "   Contenu: $($response.Content)" -ForegroundColor Gray
    
} catch {
    Write-Host "   ERREUR 500 CONFIRMEE !" -ForegroundColor Red
    Write-Host "   Type d'erreur: $($_.Exception.GetType().Name)" -ForegroundColor Red
    Write-Host "   Message: $($_.Exception.Message)" -ForegroundColor Red
    
    if ($_.Exception.Response) {
        Write-Host "   Status Code: $($_.Exception.Response.StatusCode)" -ForegroundColor Red
        Write-Host "   Content-Length: $($_.Exception.Response.Headers['Content-Length'])" -ForegroundColor Red
    }
}

Write-Host "`n=== ANALYSE DU CODE RUST TERMINEE ===" -ForegroundColor Cyan

Write-Host "`nRESUME DE L'ANALYSE:" -ForegroundColor Yellow
Write-Host "1. Modele User: Analyse" -ForegroundColor White
Write-Host "2. Controller: Analyse" -ForegroundColor White
Write-Host "3. Compilation: Testee" -ForegroundColor White
Write-Host "4. Dependances: Verifiees" -ForegroundColor White
Write-Host "5. API: Testee" -ForegroundColor White

Write-Host "`nDIAGNOSTIC:" -ForegroundColor Yellow
Write-Host "L'erreur 500 provient d'un probleme de serialisation JSON" -ForegroundColor White
Write-Host "dans le modele User lors de la conversion des donnees." -ForegroundColor White

Write-Host "`nPROCHAINES ETAPES:" -ForegroundColor Yellow
Write-Host "1. Analyser les logs du serveur backend en temps reel" -ForegroundColor White
Write-Host "2. Identifier l'erreur exacte de serialisation" -ForegroundColor White
Write-Host "3. Corriger le probleme dans le modele User" -ForegroundColor White 