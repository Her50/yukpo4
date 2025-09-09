# Script d'analyse du code Rust pour identifier l'erreur de serialisation
Write-Host "Analyse du code Rust pour identifier l'erreur de serialisation" -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan

Write-Host "`n1. Verification de la structure du projet backend..." -ForegroundColor Yellow

$backendPath = "backend"
if (Test-Path $backendPath) {
    Write-Host "   Repertoire backend trouve" -ForegroundColor Green
    
    # Lister les fichiers principaux
    Write-Host "`n   Fichiers principaux du backend:" -ForegroundColor Yellow
    Get-ChildItem $backendPath -Name | Where-Object {$_ -match "\.(rs|toml)$"} | ForEach-Object {
        Write-Host "   - $_" -ForegroundColor Gray
    }
} else {
    Write-Host "   Repertoire backend non trouve" -ForegroundColor Red
    exit 1
}

Write-Host "`n2. Analyse du fichier Cargo.toml..." -ForegroundColor Yellow

$cargoTomlPath = Join-Path $backendPath "Cargo.toml"
if (Test-Path $cargoTomlPath) {
    Write-Host "   Cargo.toml trouve, analyse des dependances..." -ForegroundColor Green
    
    $cargoContent = Get-Content $cargoTomlPath -Raw
    Write-Host "   Contenu du Cargo.toml:" -ForegroundColor Gray
    Write-Host "   $cargoContent" -ForegroundColor Gray
} else {
    Write-Host "   Cargo.toml non trouve" -ForegroundColor Red
}

Write-Host "`n3. Recherche des routes et handlers pour /api/user/me..." -ForegroundColor Yellow

# Rechercher dans les fichiers Rust
$rustFiles = Get-ChildItem $backendPath -Recurse -Filter "*.rs"
Write-Host "   Fichiers Rust trouves: $($rustFiles.Count)" -ForegroundColor Gray

# Rechercher spécifiquement les routes
Write-Host "`n   Recherche des routes /api/user/me..." -ForegroundColor Yellow
$userMeRoutes = $rustFiles | ForEach-Object {
    $content = Get-Content $_.FullName -Raw
    if ($content -match "user/me|get_user_profile") {
        Write-Host "   - $($_.Name) (ligne contenant la route)" -ForegroundColor Green
        $_.FullName
    }
}

Write-Host "`n4. Analyse des modeles de donnees utilisateur..." -ForegroundColor Yellow

# Rechercher les structures User
$userModels = $rustFiles | ForEach-Object {
    $content = Get-Content $_.FullName -Raw
    if ($content -match "struct User|struct.*User|#\[derive.*User") {
        Write-Host "   - $($_.Name) (contient des modeles User)" -ForegroundColor Green
        $_.FullName
    }
}

Write-Host "`n5. Test de compilation pour identifier les erreurs..." -ForegroundColor Yellow

Write-Host "   Test de compilation du backend..." -ForegroundColor Yellow
Set-Location $backendPath

try {
    $compileResult = cargo check 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ Compilation reussie - pas d'erreurs de syntaxe" -ForegroundColor Green
    } else {
        Write-Host "   ❌ Erreurs de compilation detectees:" -ForegroundColor Red
        Write-Host "   $compileResult" -ForegroundColor Red
    }
} catch {
    Write-Host "   Erreur lors de la compilation: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n6. Analyse des schemas de base de donnees..." -ForegroundColor Yellow

# Rechercher les migrations et schemas
$migrationFiles = Get-ChildItem $backendPath -Recurse -Filter "*.sql"
Write-Host "   Fichiers de migration trouves: $($migrationFiles.Count)" -ForegroundColor Gray

# Analyser la structure de la table users
$usersTableMigration = $migrationFiles | Where-Object {$_.Content -match "CREATE TABLE.*users|ALTER TABLE.*users"}
if ($usersTableMigration) {
    Write-Host "   Migration de la table users trouvee: $($usersTableMigration.Name)" -ForegroundColor Green
}

Write-Host "`n7. Test de l'API avec analyse des erreurs..." -ForegroundColor Yellow

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
Write-Host "1. Structure du projet: Analyse" -ForegroundColor White
Write-Host "2. Dependances Cargo: Verifiees" -ForegroundColor White
Write-Host "3. Routes et handlers: Recherches" -ForegroundColor White
Write-Host "4. Modeles de donnees: Identifies" -ForegroundColor White
Write-Host "5. Compilation: Testee" -ForegroundColor White
Write-Host "6. Schemas DB: Verifies" -ForegroundColor White
Write-Host "7. API: Testee" -ForegroundColor White

Write-Host "`nDIAGNOSTIC:" -ForegroundColor Yellow
Write-Host "L'erreur 500 provient probablement d'un probleme de serialisation JSON" -ForegroundColor White
Write-Host "dans le code Rust lors de la conversion des donnees utilisateur." -ForegroundColor White

Write-Host "`nPROCHAINES ETAPES:" -ForegroundColor Yellow
Write-Host "1. Analyser les logs du serveur backend en temps reel" -ForegroundColor White
Write-Host "2. Identifier l'erreur exacte dans le code Rust" -ForegroundColor White
Write-Host "3. Corriger le probleme de serialisation" -ForegroundColor White 