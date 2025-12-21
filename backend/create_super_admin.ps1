# Script pour creer un utilisateur super admin
# Usage: .\create_super_admin.ps1

Write-Host "Creation de l'utilisateur super admin..." -ForegroundColor Green

$adminEmail = "admin@yukpo.dev"
$adminPassword = "Hernandez87"

# Generer le hash avec Python
Write-Host "Generation du hash bcrypt..." -ForegroundColor Yellow
$pythonCmd = "import bcrypt; print(bcrypt.hashpw(b'$adminPassword', bcrypt.gensalt(rounds=12)).decode())"
$hashOutput = python -c $pythonCmd 2>&1

if ($LASTEXITCODE -ne 0 -or -not ($hashOutput -match '^\$2b\$')) {
    Write-Host "Erreur: Impossible de generer le hash avec Python" -ForegroundColor Red
    Write-Host "Veuillez installer bcrypt: pip install bcrypt" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Ou utilisez cette commande SQL directe avec psql:" -ForegroundColor Cyan
    Write-Host "psql `$DATABASE_URL -c `"INSERT INTO users (email, password_hash, role, nom_complet, tokens_balance, token_price_user, token_price_provider, commission_pct, preferred_lang, is_provider) VALUES ('$adminEmail', '<HASH_ICI>', 'admin', 'Super Admin', 1000000, 1.0, 1.0, 0.0, 'fr', false) ON CONFLICT (email) DO UPDATE SET role = 'admin', password_hash = EXCLUDED.password_hash;`"" -ForegroundColor White
    exit 1
}

$passwordHash = $hashOutput.Trim()
Write-Host "Hash genere avec succes" -ForegroundColor Green

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
$sql = @"
INSERT INTO users (
    email, password_hash, role, nom_complet, tokens_balance, 
    token_price_user, token_price_provider, commission_pct, 
    preferred_lang, is_provider, created_at, updated_at
)
VALUES (
    '$adminEmail',
    '$passwordHash',
    'admin',
    'Super Admin',
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

SELECT id, email, role, nom_complet, tokens_balance, created_at 
FROM users 
WHERE email = '$adminEmail';
"@

Write-Host "Execution du script SQL..." -ForegroundColor Yellow
$sql | psql $databaseUrl

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "Utilisateur super admin cree avec succes!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Identifiants de connexion:" -ForegroundColor Cyan
    Write-Host "   Email: $adminEmail" -ForegroundColor White
    Write-Host "   Mot de passe: $adminPassword" -ForegroundColor White
} else {
    Write-Host "Erreur lors de l'execution SQL" -ForegroundColor Red
}

