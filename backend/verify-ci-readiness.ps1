# Script de vérification de préparation CI pour Phase 5
# Vérifie que le cache SQLx est présent et à jour

Write-Host "=== Vérification préparation CI Phase 5 ===" -ForegroundColor Cyan
Write-Host ""

$ErrorActionPreference = "Stop"

# 1. Vérifier présence du répertoire .sqlx
Write-Host "1. Vérification du cache SQLx..." -ForegroundColor Yellow

if (Test-Path ".sqlx") {
    $files = Get-ChildItem -Path ".sqlx" -Recurse -File
    $count = $files.Count
    Write-Host "   ✅ Cache .sqlx présent ($count fichiers)" -ForegroundColor Green
    
    if ($count -eq 0) {
        Write-Host "   ❌ ERREUR: Cache .sqlx vide!" -ForegroundColor Red
        Write-Host "   Action: Exécutez 'cargo sqlx prepare --workspace'" -ForegroundColor Yellow
        exit 1
    }
}
else {
    Write-Host "   ❌ ERREUR: Répertoire .sqlx manquant!" -ForegroundColor Red
    Write-Host "   Action: Exécutez 'cargo sqlx prepare --workspace'" -ForegroundColor Yellow
    exit 1
}

# 2. Vérifier compilation offline
Write-Host ""
Write-Host "2. Test compilation offline..." -ForegroundColor Yellow

$env:SQLX_OFFLINE = "true"
$env:CARGO_TERM_COLOR = "always"

try {
    cargo check --quiet 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ Compilation offline réussie" -ForegroundColor Green
    }
    else {
        Write-Host "   ❌ ERREUR: Compilation offline échoue!" -ForegroundColor Red
        Write-Host "   Action: Régénérez le cache: cargo sqlx prepare --workspace" -ForegroundColor Yellow
        exit 1
    }
}
catch {
    Write-Host "   ❌ ERREUR: Impossible de tester la compilation" -ForegroundColor Red
    Write-Host "   Détails: $_" -ForegroundColor Red
    exit 1
}

# 3. Vérifier .gitignore
Write-Host ""
Write-Host "3. Vérification .gitignore..." -ForegroundColor Yellow

if (Test-Path ".gitignore") {
    $gitignoreContent = Get-Content ".gitignore" -Raw
    if ($gitignoreContent -match "^\.sqlx$" -or $gitignoreContent -match "\.sqlx") {
        Write-Host "   ⚠️  WARNING: .sqlx est dans .gitignore" -ForegroundColor Yellow
        Write-Host "   Pour CI, .sqlx doit être commité dans le repo" -ForegroundColor Yellow
    }
    else {
        Write-Host "   ✅ .sqlx n'est pas ignoré (peut être commité)" -ForegroundColor Green
    }
}

# 4. Vérifier structure Cargo.toml
Write-Host ""
Write-Host "4. Vérification configuration Cargo..." -ForegroundColor Yellow

if (Test-Path "Cargo.toml") {
    Write-Host "   ✅ Cargo.toml présent" -ForegroundColor Green
}
else {
    Write-Host "   ❌ ERREUR: Cargo.toml manquant!" -ForegroundColor Red
    exit 1
}

# 5. Vérifier migrations
Write-Host ""
Write-Host "5. Vérification migrations..." -ForegroundColor Yellow

if (Test-Path "migrations") {
    $migrations = Get-ChildItem -Path "migrations" -Filter "*.sql"
    Write-Host "   ✅ Répertoire migrations présent ($($migrations.Count) fichiers)" -ForegroundColor Green
}
else {
    Write-Host "   ⚠️  WARNING: Répertoire migrations manquant" -ForegroundColor Yellow
}

# Résumé
Write-Host ""
Write-Host "=== Résumé ===" -ForegroundColor Cyan
Write-Host "✅ Cache SQLx: Présent et valide" -ForegroundColor Green
Write-Host "✅ Compilation offline: Fonctionnelle" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Actions pour le dépôt CI (Her50/yukpo4):" -ForegroundColor Yellow
Write-Host "   1. S'assurer que backend/.sqlx/ est commité" -ForegroundColor White
Write-Host "   2. Vérifier que SQLX_OFFLINE=true est défini dans le workflow" -ForegroundColor White
Write-Host "   3. Installer dépendances système (libpq-dev, openssl, etc.)" -ForegroundColor White
Write-Host "   4. Vérifier timeout du workflow (minimum 30 minutes)" -ForegroundColor White
Write-Host ""
Write-Host "=== Vérification terminée ===" -ForegroundColor Cyan

