# Script de Vérification du Secret Base de Données
# Date: 2026-02-19
# Objectif: Vérifier que le secret database-url est correct

$PROJECT = "yukpo-project"
$SECRET_NAME = "database-url"
$DB_NAME = "yukpo_db"
$SOCKET_PATH = "/cloudsql/yukpo-project:europe-west1:yukpo-postgres"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Vérification Secret Base de Données" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Vérifier la configuration gcloud
Write-Host "[1/5] Vérification de la configuration gcloud..." -ForegroundColor Yellow
$currentProject = gcloud config get-value project 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Erreur: gcloud n'est pas configuré" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Projet: $currentProject" -ForegroundColor Green
Write-Host ""

# 2. Vérifier que le secret existe
Write-Host "[2/5] Vérification de l'existence du secret..." -ForegroundColor Yellow
try {
    $secretExists = gcloud secrets describe $SECRET_NAME --project=$PROJECT 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Secret '$SECRET_NAME' existe" -ForegroundColor Green
    }
    else {
        Write-Host "❌ Secret '$SECRET_NAME' n'existe pas" -ForegroundColor Red
        exit 1
    }
}
catch {
    Write-Host "❌ Erreur lors de la vérification du secret: $_" -ForegroundColor Red
    exit 1
}
Write-Host ""

# 3. Récupérer le secret actuel
Write-Host "[3/5] Récupération du secret actuel..." -ForegroundColor Yellow
try {
    $databaseUrl = gcloud secrets versions access latest --secret=$SECRET_NAME --project=$PROJECT 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Secret récupéré" -ForegroundColor Green
        
        # Masquer le mot de passe pour l'affichage
        if ($databaseUrl -match "postgresql://([^:]+):([^@]+)@") {
            $user = $matches[1]
            $password = $matches[2]
            $passwordMasked = if ($password.Length -gt 4) { 
                $password.Substring(0, 2) + "***" + $password.Substring($password.Length - 2) 
            }
            else { 
                "***" 
            }
            $databaseUrlMasked = $databaseUrl -replace [regex]::Escape($password), $passwordMasked
            Write-Host "Secret (masqué):" -ForegroundColor Cyan
            Write-Host "  $databaseUrlMasked" -ForegroundColor Gray
        }
    }
    else {
        Write-Host "❌ Erreur lors de la récupération du secret" -ForegroundColor Red
        exit 1
    }
}
catch {
    Write-Host "❌ Erreur: $_" -ForegroundColor Red
    exit 1
}
Write-Host ""

# 4. Vérifier le format et la base de données
Write-Host "[4/5] Vérification du format et de la base de données..." -ForegroundColor Yellow
$errors = @()

# Vérifier que c'est yukpo_db
if ($databaseUrl -notmatch "@/([^?]+)") {
    $errors += "Format DATABASE_URL incorrect (pas de base de données détectée)"
}
else {
    $dbInUrl = $matches[1]
    if ($dbInUrl -ne $DB_NAME) {
        $errors += "Base de données incorrecte: '$dbInUrl' (attendu: '$DB_NAME')"
        Write-Host "⚠️ ATTENTION: Base de données incorrecte!" -ForegroundColor Yellow
        Write-Host "   Actuel: $dbInUrl" -ForegroundColor Red
        Write-Host "   Attendu: $DB_NAME" -ForegroundColor Green
    }
    else {
        Write-Host "✅ Base de données correcte: $DB_NAME" -ForegroundColor Green
    }
}

# Vérifier le format Unix socket
if ($databaseUrl -notmatch "host=/cloudsql/") {
    $errors += "Format Unix socket non détecté (host=/cloudsql/...)"
    Write-Host "⚠️ Format Unix socket non détecté" -ForegroundColor Yellow
}
else {
    Write-Host "✅ Format Unix socket détecté" -ForegroundColor Green
    
    # Vérifier le socket path
    if ($databaseUrl -match "host=([^&]+)") {
        $socketInUrl = $matches[1]
        if ($socketInUrl -ne $SOCKET_PATH) {
            Write-Host "⚠️ Socket path différent:" -ForegroundColor Yellow
            Write-Host "   Actuel: $socketInUrl" -ForegroundColor Gray
            Write-Host "   Attendu: $SOCKET_PATH" -ForegroundColor Gray
        }
        else {
            Write-Host "✅ Socket path correct: $SOCKET_PATH" -ForegroundColor Green
        }
    }
}

# Vérifier l'utilisateur
if ($databaseUrl -notmatch "postgresql://([^:]+):") {
    $errors += "Utilisateur non détecté"
}
else {
    $userInUrl = $matches[1]
    Write-Host "✅ Utilisateur: $userInUrl" -ForegroundColor Green
}

Write-Host ""

# 5. Résumé
Write-Host "[5/5] Résumé de la vérification..." -ForegroundColor Yellow
Write-Host ""

if ($errors.Count -eq 0) {
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "✅ Vérification réussie!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Le secret est correctement configuré:" -ForegroundColor Green
    Write-Host "  - Base de données: $DB_NAME ✅" -ForegroundColor White
    Write-Host "  - Format Unix socket: ✅" -ForegroundColor White
    Write-Host "  - Utilisateur: ✅" -ForegroundColor White
    Write-Host ""
}
else {
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "⚠️ Problèmes détectés!" -ForegroundColor Yellow
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Erreurs trouvées:" -ForegroundColor Red
    foreach ($error in $errors) {
        Write-Host "  - $error" -ForegroundColor Red
    }
    Write-Host ""
    Write-Host "Action recommandée:" -ForegroundColor Yellow
    Write-Host "  Exécuter: .\scripts\update-database-secret-and-test.ps1" -ForegroundColor Cyan
    Write-Host ""
}

Write-Host "Informations du secret:" -ForegroundColor Yellow
Write-Host "  - Nom: $SECRET_NAME" -ForegroundColor White
Write-Host "  - Projet: $PROJECT" -ForegroundColor White
Write-Host "  - Base attendue: $DB_NAME" -ForegroundColor White
Write-Host "  - Socket attendu: $SOCKET_PATH" -ForegroundColor White
Write-Host ""

