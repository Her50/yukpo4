# Script d'analyse du cache SQLx pour Docker

Write-Host "=== ANALYSE DU CACHE SQLX ===" -ForegroundColor Cyan
Write-Host ""

# 1. Vérifier que le cache existe
Write-Host "1. Vérification de l'existence du cache..." -ForegroundColor Yellow
if (-not (Test-Path ".sqlx")) {
    Write-Host "   ❌ Le dossier .sqlx n'existe pas!" -ForegroundColor Red
    exit 1
}

$cacheFiles = Get-ChildItem -Path .sqlx -File
$cacheCount = ($cacheFiles | Measure-Object).Count
Write-Host "   ✅ Cache trouvé: $cacheCount fichiers" -ForegroundColor Green

# 2. Vérifier la structure du cache
Write-Host ""
Write-Host "2. Vérification de la structure du cache..." -ForegroundColor Yellow
$firstFile = $cacheFiles | Select-Object -First 1
if ($firstFile) {
    try {
        $content = Get-Content $firstFile.FullName | ConvertFrom-Json
        Write-Host "   ✅ Format JSON valide" -ForegroundColor Green
        Write-Host "   ✅ db_name: $($content.db_name)" -ForegroundColor Green
    }
    catch {
        Write-Host "   ❌ Erreur de lecture du cache: $_" -ForegroundColor Red
    }
}

# 3. Compter les requêtes dans le code source
Write-Host ""
Write-Host "3. Comptage des requêtes SQLx dans le code source..." -ForegroundColor Yellow
$queryMacros = @(
    (Select-String -Path "src/**/*.rs" -Pattern "sqlx::query!" -AllMatches | Measure-Object).Count,
    (Select-String -Path "src/**/*.rs" -Pattern "sqlx::query_scalar!" -AllMatches | Measure-Object).Count,
    (Select-String -Path "src/**/*.rs" -Pattern "sqlx::query_as!" -AllMatches | Measure-Object).Count
)
$totalQueries = ($queryMacros | Measure-Object -Sum).Sum
Write-Host "   📊 Requêtes trouvées dans le code:" -ForegroundColor Cyan
Write-Host "      - sqlx::query!: $($queryMacros[0])" -ForegroundColor Gray
Write-Host "      - sqlx::query_scalar!: $($queryMacros[1])" -ForegroundColor Gray
Write-Host "      - sqlx::query_as!: $($queryMacros[2])" -ForegroundColor Gray
Write-Host "      - Total: $totalQueries" -ForegroundColor Gray
Write-Host "   📦 Fichiers dans le cache: $cacheCount" -ForegroundColor Cyan

# 4. Vérifier si le cache fonctionne localement
Write-Host ""
Write-Host "4. Test de compilation en mode offline..." -ForegroundColor Yellow
$env:SQLX_OFFLINE = "true"
$checkResult = cargo check --lib 2>&1
$exitCode = $LASTEXITCODE

if ($exitCode -eq 0) {
    Write-Host "   ✅ Compilation locale réussie en mode offline" -ForegroundColor Green
}
else {
    Write-Host "   ⚠️  Compilation locale échouée en mode offline" -ForegroundColor Yellow
    $errors = $checkResult | Select-String -Pattern "error" | Select-Object -First 5
    if ($errors) {
        Write-Host "   Premières erreurs:" -ForegroundColor Red
        $errors | ForEach-Object { Write-Host "      $_" -ForegroundColor Gray }
    }
}

# 5. Vérifier le Dockerfile
Write-Host ""
Write-Host "5. Vérification du Dockerfile..." -ForegroundColor Yellow
if (Test-Path "Dockerfile") {
    $dockerfileContent = Get-Content Dockerfile -Raw
    if ($dockerfileContent -match "COPY.*\.sqlx") {
        Write-Host "   ✅ Le Dockerfile copie bien le cache .sqlx" -ForegroundColor Green
    }
    else {
        Write-Host "   ❌ Le Dockerfile ne copie pas le cache .sqlx" -ForegroundColor Red
    }
    if ($dockerfileContent -match "ENV.*SQLX_OFFLINE.*true") {
        Write-Host "   ✅ Le Dockerfile définit SQLX_OFFLINE=true" -ForegroundColor Green
    }
    else {
        Write-Host "   ❌ Le Dockerfile ne définit pas SQLX_OFFLINE=true" -ForegroundColor Red
    }
}
else {
    Write-Host "   ❌ Le Dockerfile n'existe pas" -ForegroundColor Red
}

# 6. Recommandations
Write-Host ""
Write-Host "=== RECOMMANDATIONS ===" -ForegroundColor Cyan

if ($cacheCount -lt $totalQueries) {
    Write-Host "⚠️  Le nombre de fichiers dans le cache ($cacheCount) est inférieur au nombre de requêtes ($totalQueries)" -ForegroundColor Yellow
    Write-Host "   → Essayez de régénérer le cache avec: cargo sqlx prepare --workspace" -ForegroundColor Gray
}

if ($exitCode -ne 0) {
    Write-Host "⚠️  La compilation locale échoue en mode offline" -ForegroundColor Yellow
    Write-Host "   → Le cache n'est peut-être pas complet" -ForegroundColor Gray
    Write-Host "   → Régénérez le cache avec une connexion à la base de données" -ForegroundColor Gray
}

Write-Host ""
Write-Host "=== FIN DE L'ANALYSE ===" -ForegroundColor Cyan


