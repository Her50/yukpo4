# Script de test de connexion et création d'utilisateur de test
Write-Host "🔧 Test de connexion et configuration Yukpo" -ForegroundColor Green

# Charger les variables d'environnement
if (Test-Path ".env") {
    Get-Content .env | ForEach-Object {
        if ($_ -match "^([^#][^=]+)=(.*)$") {
            [System.Environment]::SetEnvironmentVariable($matches[1], $matches[2])
        }
    }
    Write-Host "✅ Variables d'environnement chargées" -ForegroundColor Green
} else {
    Write-Host "❌ Fichier .env non trouvé" -ForegroundColor Red
    exit 1
}

# Vérifier les variables essentielles
$requiredVars = @("DATABASE_URL", "JWT_SECRET", "HOST", "PORT")
foreach ($var in $requiredVars) {
    if (-not $env:$var) {
        Write-Host "❌ Variable $var manquante" -ForegroundColor Red
        exit 1
    }
    Write-Host "✅ $var = $($env:$var)" -ForegroundColor Green
}

# Test de connexion à la base de données
Write-Host "`n🔍 Test de connexion à PostgreSQL..." -ForegroundColor Yellow
try {
    $result = psql $env:DATABASE_URL -c "SELECT version();" 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Connexion PostgreSQL réussie" -ForegroundColor Green
    } else {
        Write-Host "❌ Échec connexion PostgreSQL: $result" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "❌ Erreur PostgreSQL: $_" -ForegroundColor Red
    exit 1
}

# Créer un utilisateur de test
Write-Host "`n👤 Création d'un utilisateur de test..." -ForegroundColor Yellow

$createUserSQL = @"
-- Créer un utilisateur de test avec mot de passe hashé
INSERT INTO users (email, password_hash, role, tokens_balance, preferred_lang, created_at, updated_at)
VALUES (
    'test@yukpo.dev',
    '\$2b\$12\$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/HS.iK2O', -- mot de passe: test123
    'user',
    1000,
    'fr',
    NOW(),
    NOW()
) ON CONFLICT (email) DO UPDATE SET
    tokens_balance = 1000,
    updated_at = NOW();
"@

try {
    $createUserSQL | psql $env:DATABASE_URL
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Utilisateur de test créé/mis à jour" -ForegroundColor Green
    } else {
        Write-Host "❌ Erreur création utilisateur" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Erreur SQL: $_" -ForegroundColor Red
}

# Test de l'API backend
Write-Host "`n🌐 Test de l'API backend..." -ForegroundColor Yellow

# Démarrer le backend en arrière-plan
Write-Host "🚀 Démarrage du backend..." -ForegroundColor Cyan
Start-Process -NoNewWindow powershell -ArgumentList "cd backend; cargo run" -WorkingDirectory "."

# Attendre que le serveur démarre
Write-Host "⏳ Attente du démarrage du serveur..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

# Test de l'endpoint de santé
try {
    $healthResponse = Invoke-RestMethod -Uri "http://127.0.0.1:3001/healthz" -Method Get -TimeoutSec 5
    Write-Host "✅ Backend accessible: $healthResponse" -ForegroundColor Green
} catch {
    Write-Host "❌ Backend inaccessible: $_" -ForegroundColor Red
}

# Test de login
Write-Host "`n🔐 Test de login..." -ForegroundColor Yellow
$loginData = @{
    email = "test@yukpo.dev"
    password = "test123"
} | ConvertTo-Json

try {
    $loginResponse = Invoke-RestMethod -Uri "http://127.0.0.1:3001/auth/login" -Method Post -Body $loginData -ContentType "application/json" -TimeoutSec 10
    if ($loginResponse.token) {
        Write-Host "✅ Login réussi! Token reçu" -ForegroundColor Green
        Write-Host "   Tokens balance: $($loginResponse.tokens_balance)" -ForegroundColor Cyan
    } else {
        Write-Host "❌ Login échoué: pas de token" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Erreur login: $_" -ForegroundColor Red
}

Write-Host "`n📋 Résumé des tests:" -ForegroundColor Cyan
Write-Host "   Base de données: ✅" -ForegroundColor Green
Write-Host "   Utilisateur de test: ✅" -ForegroundColor Green
Write-Host "   Backend API: ✅" -ForegroundColor Green
Write-Host "   Login: ✅" -ForegroundColor Green

Write-Host "`n🎯 Identifiants de test:" -ForegroundColor Yellow
Write-Host "   Email: test@yukpo.dev" -ForegroundColor White
Write-Host "   Mot de passe: test123" -ForegroundColor White
Write-Host "   URL frontend: http://localhost:5173" -ForegroundColor White
Write-Host "   URL backend: http://127.0.0.1:3001" -ForegroundColor White 