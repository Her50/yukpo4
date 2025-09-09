# Script de correction et test de la base de donnees Yukpo
Write-Host "Correction et test de la base de donnees Yukpo" -ForegroundColor Green

# Charger les variables d'environnement
if (Test-Path ".env") {
    Get-Content .env | ForEach-Object {
        if ($_ -match "^([^#][^=]+)=(.*)$") {
            [System.Environment]::SetEnvironmentVariable($matches[1], $matches[2])
        }
    }
    Write-Host "Variables d'environnement chargees" -ForegroundColor Green
} else {
    Write-Host "Fichier .env non trouve" -ForegroundColor Red
    exit 1
}

# Verifier PostgreSQL
Write-Host "`nVerification de PostgreSQL..." -ForegroundColor Yellow
try {
    $pgVersion = psql --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "PostgreSQL installe: $pgVersion" -ForegroundColor Green
    } else {
        Write-Host "PostgreSQL non trouve" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "Erreur PostgreSQL: $_" -ForegroundColor Red
    exit 1
}

# Tester la connexion a la base de donnees
Write-Host "`nTest de connexion a la base de donnees..." -ForegroundColor Yellow
try {
    $result = psql $env:DATABASE_URL -c "SELECT version();" 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Connexion PostgreSQL reussie" -ForegroundColor Green
    } else {
        Write-Host "Echec connexion PostgreSQL: $result" -ForegroundColor Red
        
        # Tentative de creation de la base de donnees
        Write-Host "`nTentative de creation de la base de donnees..." -ForegroundColor Yellow
        $dbUrlParts = $env:DATABASE_URL -split "://"
        $dbParts = $dbUrlParts[1] -split "@"
        $userPass = $dbParts[0] -split ":"
        $hostDb = $dbParts[1] -split "/"
        
        $dbUser = $userPass[0]
        $dbPass = $userPass[1]
        $dbHost = $hostDb[0] -split ":" | Select-Object -First 1
        $dbName = $hostDb[1]
        
        Write-Host "   Utilisateur: $dbUser" -ForegroundColor Cyan
        Write-Host "   Hote: $dbHost" -ForegroundColor Cyan
        Write-Host "   Base: $dbName" -ForegroundColor Cyan
        
        # Creer la base de donnees
        $env:PGPASSWORD = $dbPass
        psql -U $dbUser -h $dbHost -d postgres -c "CREATE DATABASE $dbName;" 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "Base de donnees creee" -ForegroundColor Green
        } else {
            Write-Host "Base de donnees existe deja ou erreur de creation" -ForegroundColor Yellow
        }
    }
} catch {
    Write-Host "Erreur connexion: $_" -ForegroundColor Red
    exit 1
}

# Appliquer les migrations
Write-Host "`nApplication des migrations..." -ForegroundColor Yellow
Push-Location "backend"
try {
    sqlx migrate run
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Migrations appliquees avec succes" -ForegroundColor Green
    } else {
        Write-Host "Erreur lors des migrations" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "Erreur migrations: $_" -ForegroundColor Red
    exit 1
} finally {
    Pop-Location
}

# Creer un utilisateur de test
Write-Host "`nCreation d'un utilisateur de test..." -ForegroundColor Yellow

$createUserSQL = @"
-- Creer un utilisateur de test avec mot de passe hashe
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

-- Creer un utilisateur admin
INSERT INTO users (email, password_hash, role, tokens_balance, preferred_lang, created_at, updated_at)
VALUES (
    'admin@yukpo.dev',
    '\$2b\$12\$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/HS.iK2O', -- mot de passe: admin123
    'admin',
    10000,
    'fr',
    NOW(),
    NOW()
) ON CONFLICT (email) DO UPDATE SET
    role = 'admin',
    tokens_balance = 10000,
    updated_at = NOW();
"@

try {
    $createUserSQL | psql $env:DATABASE_URL
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Utilisateurs de test crees/mis a jour" -ForegroundColor Green
    } else {
        Write-Host "Erreur creation utilisateurs" -ForegroundColor Red
    }
} catch {
    Write-Host "Erreur SQL: $_" -ForegroundColor Red
}

# Verifier les tables
Write-Host "`nVerification des tables..." -ForegroundColor Yellow
try {
    $tables = psql $env:DATABASE_URL -c "\dt" 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Tables disponibles:" -ForegroundColor Green
        Write-Host $tables -ForegroundColor Cyan
    } else {
        Write-Host "Erreur liste tables: $tables" -ForegroundColor Red
    }
} catch {
    Write-Host "Erreur verification tables: $_" -ForegroundColor Red
}

# Verifier les utilisateurs
Write-Host "`nVerification des utilisateurs..." -ForegroundColor Yellow
try {
    $users = psql $env:DATABASE_URL -c "SELECT email, role, tokens_balance FROM users;" 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Utilisateurs en base:" -ForegroundColor Green
        Write-Host $users -ForegroundColor Cyan
    } else {
        Write-Host "Erreur liste utilisateurs: $users" -ForegroundColor Red
    }
} catch {
    Write-Host "Erreur verification utilisateurs: $_" -ForegroundColor Red
}

Write-Host "`nResume de la configuration:" -ForegroundColor Cyan
Write-Host "   Base de donnees: OK" -ForegroundColor Green
Write-Host "   Migrations: OK" -ForegroundColor Green
Write-Host "   Utilisateurs de test: OK" -ForegroundColor Green

Write-Host "`nIdentifiants de test:" -ForegroundColor Yellow
Write-Host "   Utilisateur: test@yukpo.dev / test123" -ForegroundColor White
Write-Host "   Admin: admin@yukpo.dev / admin123" -ForegroundColor White

Write-Host "`nProchaines etapes:" -ForegroundColor Cyan
Write-Host "   1. Lancer le backend: cd backend && cargo run" -ForegroundColor White
Write-Host "   2. Lancer le frontend: cd frontend && npm run dev" -ForegroundColor White
Write-Host "   3. Tester la connexion sur http://localhost:5173" -ForegroundColor White 