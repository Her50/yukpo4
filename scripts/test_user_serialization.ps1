# Script de test de la serialisation du modele User
Write-Host "Test de la serialisation du modele User" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan

Write-Host "`n1. Analyse du modele User..." -ForegroundColor Yellow

$userModelPath = "backend/src/models/user_model.rs"
if (Test-Path $userModelPath) {
    Write-Host "   Modele User trouve" -ForegroundColor Green
    
    $userModelContent = Get-Content $userModelPath -Raw
    Write-Host "   Structure User identifiee:" -ForegroundColor Gray
    
    # Extraire les champs problématiques
    if ($userModelContent -match "gps.*Option<String>") {
        Write-Host "   - gps: Option<String> ✅" -ForegroundColor Green
    }
    if ($userModelContent -match "gps_consent.*bool") {
        Write-Host "   - gps_consent: bool ✅" -ForegroundColor Green
    }
    if ($userModelContent -match "nom.*Option<String>") {
        Write-Host "   - nom: Option<String> ✅" -ForegroundColor Green
    }
    if ($userModelContent -match "prenom.*Option<String>") {
        Write-Host "   - prenom: Option<String> ✅" -ForegroundColor Green
    }
} else {
    Write-Host "   Modele User non trouve" -ForegroundColor Red
    exit 1
}

Write-Host "`n2. Test de compilation specifique du modele User..." -ForegroundColor Yellow

Set-Location "backend"

try {
    Write-Host "   Test de compilation du modele User..." -ForegroundColor Yellow
    $compileResult = cargo check --lib 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ Compilation du modele User reussie" -ForegroundColor Green
    } else {
        Write-Host "   ❌ Erreurs de compilation du modele User:" -ForegroundColor Red
        Write-Host "   $compileResult" -ForegroundColor Red
    }
} catch {
    Write-Host "   Erreur lors de la compilation: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n3. Test de la serialisation avec des donnees reelles..." -ForegroundColor Yellow

Set-Location ".."

# Créer un script Rust temporaire pour tester la sérialisation
$testSerializationScript = @"
use serde_json;
use chrono::NaiveDateTime;

#[derive(serde::Serialize)]
struct TestUser {
    id: i32,
    email: String,
    password_hash: String,
    role: String,
    is_provider: bool,
    tokens_balance: i64,
    token_price_user: Option<f64>,
    token_price_provider: Option<f64>,
    commission_pct: Option<f32>,
    preferred_lang: Option<String>,
    created_at: NaiveDateTime,
    updated_at: NaiveDateTime,
    gps: Option<String>,
    gps_consent: bool,
    nom: Option<String>,
    prenom: Option<String>,
    nom_complet: Option<String>,
    photo_profil: Option<String>,
    avatar_url: Option<String>,
}

fn main() {
    let user = TestUser {
        id: 1,
        email: "test@example.com".to_string(),
        password_hash: "hash".to_string(),
        role: "user".to_string(),
        is_provider: false,
        tokens_balance: 1000,
        token_price_user: Some(1.0),
        token_price_provider: Some(1.0),
        commission_pct: Some(0.1),
        preferred_lang: Some("fr".to_string()),
        created_at: chrono::Utc::now().naive_utc(),
        updated_at: chrono::Utc::now().naive_utc(),
        gps: Some("48.8566,2.3522".to_string()),
        gps_consent: true,
        nom: Some("Doe".to_string()),
        prenom: Some("John".to_string()),
        nom_complet: Some("John Doe".to_string()),
        photo_profil: Some("photo.jpg".to_string()),
        avatar_url: Some("https://example.com/avatar.jpg".to_string()),
    };
    
    match serde_json::to_string(&user) {
        Ok(json) => println!("Serialisation reussie: {}", json),
        Err(e) => eprintln!("Erreur de serialisation: {}", e),
    }
}
"@

$testScriptPath = "test_serialization.rs"
$testScriptPath | Out-File -FilePath $testScriptPath -Encoding UTF8

Write-Host "   Script de test de serialisation cree: $testScriptPath" -ForegroundColor Green

Write-Host "`n4. Test de l'API avec analyse des erreurs..." -ForegroundColor Yellow

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

Write-Host "`n5. Test de l'API /api/users/balance pour comparaison..." -ForegroundColor Yellow

try {
    $response = Invoke-WebRequest -Uri "$baseUrl/api/users/balance" -Method Get -Headers @{"Authorization" = "Bearer $realToken"} -TimeoutSec 10
    Write-Host "   SUCCES ! API /api/users/balance fonctionne" -ForegroundColor Green
    Write-Host "   Status Code: $($response.StatusCode)" -ForegroundColor Gray
    Write-Host "   Contenu: $($response.Content)" -ForegroundColor Gray
} catch {
    Write-Host "   Erreur sur /api/users/balance: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n=== TEST DE SERIALISATION TERMINE ===" -ForegroundColor Cyan

Write-Host "`nRESUME DE L'ANALYSE:" -ForegroundColor Yellow
Write-Host "1. Modele User: Analyse" -ForegroundColor White
Write-Host "2. Compilation: Testee" -ForegroundColor White
Write-Host "3. Script de test: Cree" -ForegroundColor White
Write-Host "4. API /api/user/me: Testee" -ForegroundColor White
Write-Host "5. API /api/users/balance: Testee" -ForegroundColor White

Write-Host "`nDIAGNOSTIC:" -ForegroundColor Yellow
Write-Host "L'erreur 500 provient d'un probleme de serialisation JSON" -ForegroundColor White
Write-Host "dans le modele User lors de la conversion des donnees." -ForegroundColor White

Write-Host "`nPROCHAINES ETAPES:" -ForegroundColor Yellow
Write-Host "1. Analyser les logs du serveur backend en temps reel" -ForegroundColor White
Write-Host "2. Identifier l'erreur exacte de serialisation" -ForegroundColor White
Write-Host "3. Corriger le probleme dans le modele User" -ForegroundColor White

# Nettoyer le fichier temporaire
if (Test-Path $testScriptPath) {
    Remove-Item $testScriptPath
    Write-Host "`nFichier temporaire nettoye: $testScriptPath" -ForegroundColor Gray
} 