# Script simplifie pour creer un utilisateur super admin
# Usage: .\create_super_admin_simple.ps1

Write-Host "Creation de l'utilisateur super admin..." -ForegroundColor Green

# Parametres
$adminEmail = "admin@yukpo.dev"
$adminPassword = "Hernandez87"
$adminName = "Super Admin"

# Hash bcrypt sera genere avec Rust ou Python
$passwordHash = ""

# Essayer de generer le hash avec Rust
try {
    Write-Host "Generation du hash bcrypt avec Rust..." -ForegroundColor Yellow
    $rustHash = cargo run --bin hash_password_helper --quiet -- $adminPassword 2>&1 | Select-Object -Last 1
    if ($LASTEXITCODE -eq 0 -and $rustHash -match '^\$2b\$') {
        $passwordHash = $rustHash.Trim()
        Write-Host "Hash genere avec succes" -ForegroundColor Green
    } else {
        Write-Host "Rust non disponible ou erreur, essai avec Python..." -ForegroundColor Yellow
        # Essayer avec Python
        $pythonHash = python -c "import bcrypt; print(bcrypt.hashpw(b'$adminPassword', bcrypt.gensalt(rounds=12)).decode())" 2>&1
        if ($LASTEXITCODE -eq 0 -and $pythonHash -match '^\$2b\$') {
            $passwordHash = $pythonHash.Trim()
            Write-Host "Hash genere avec Python" -ForegroundColor Green
        } else {
            throw "Impossible de generer le hash"
        }
    }
} catch {
    Write-Host "Erreur lors de la generation du hash: $_" -ForegroundColor Red
    Write-Host "Vous pouvez generer le hash manuellement avec:" -ForegroundColor Yellow
    Write-Host "   cargo run --bin hash_password_helper -- Hernandez87" -ForegroundColor Cyan
    Write-Host "   ou" -ForegroundColor Cyan
    Write-Host "   python -c `"import bcrypt; print(bcrypt.hashpw(b'$adminPassword', bcrypt.gensalt(12)).decode())`"" -ForegroundColor Cyan
    exit 1
}

# Lire DATABASE_URL depuis .env
$envContent = Get-Content ".env" -Raw -ErrorAction SilentlyContinue
if (-not $envContent) {
    Write-Host "Fichier .env non trouve" -ForegroundColor Red
    exit 1
}

$databaseUrl = ""
if ($envContent -match "DATABASE_URL=(.+)") {
    $databaseUrl = $matches[1].Trim()
}

if (-not $databaseUrl) {
    Write-Host "DATABASE_URL non trouve dans .env" -ForegroundColor Red
    exit 1
}

# Script SQL
$sqlScript = @"
-- Creation ou mise a jour de l'utilisateur super admin
INSERT INTO users (
    email, 
    password_hash, 
    role, 
    nom_complet, 
    tokens_balance, 
    token_price_user, 
    token_price_provider, 
    commission_pct, 
    preferred_lang, 
    is_provider, 
    created_at, 
    updated_at
)
VALUES (
    '$adminEmail',
    '$passwordHash',
    'admin',
    '$adminName',
    1000000,
    1.0,
    1.0,
    0.0,
    'fr',
    false,
    NOW(),
    NOW()
)
ON CONFLICT (email) DO UPDATE SET
    password_hash = EXCLUDED.password_hash,
    role = 'admin',
    nom_complet = EXCLUDED.nom_complet,
    updated_at = NOW();

-- Afficher l'utilisateur cree
SELECT id, email, role, nom_complet, tokens_balance, created_at 
FROM users 
WHERE email = '$adminEmail';
"@

$sqlFile = "create_super_admin_temp.sql"
$sqlScript | Out-File -FilePath $sqlFile -Encoding UTF8

Write-Host "Execution du script SQL..." -ForegroundColor Yellow
try {
    psql $databaseUrl -f $sqlFile 2>&1 | Out-Host
    Write-Host ""
    Write-Host "Utilisateur super admin cree/mis a jour avec succes!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Identifiants de connexion:" -ForegroundColor Cyan
    Write-Host "   Email: $adminEmail" -ForegroundColor White
    Write-Host "   Mot de passe: $adminPassword" -ForegroundColor White
} catch {
    Write-Host "Erreur: $_" -ForegroundColor Red
} finally {
    if (Test-Path $sqlFile) {
        Remove-Item $sqlFile
    }
}
