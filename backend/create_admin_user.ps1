# Script pour créer un utilisateur admin dans la base de données Yukpo
Write-Host "🔧 Création de l'utilisateur admin dans la base de données..." -ForegroundColor Green

# Vérifier si le fichier .env existe
if (-not (Test-Path ".env")) {
    Write-Host "❌ Fichier .env non trouvé. Copie depuis le template..." -ForegroundColor Yellow
    Copy-Item "env_template.txt" ".env"
    Write-Host "✅ Fichier .env créé. Veuillez le configurer avec vos paramètres de base de données." -ForegroundColor Green
    Write-Host "📝 Modifiez le fichier .env avec vos paramètres PostgreSQL" -ForegroundColor Yellow
    exit 1
}

# Lire la configuration de la base de données
$envContent = Get-Content ".env" -Raw
$databaseUrl = ""
if ($envContent -match "DATABASE_URL=(.+)") {
    $databaseUrl = $matches[1].Trim()
}

if (-not $databaseUrl) {
    Write-Host "❌ DATABASE_URL non trouvé dans le fichier .env" -ForegroundColor Red
    exit 1
}

Write-Host "📊 Connexion à la base de données: $databaseUrl" -ForegroundColor Cyan

# Script SQL pour créer l'utilisateur admin
$sqlScript = @"
-- Création de l'utilisateur admin
INSERT INTO users (email, password_hash, role, name, created_at, updated_at)
VALUES (
    'admin@yukpo.dev',
    '\$2b\$12\$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/HS.iK2O', -- mot de passe: admin123
    'admin',
    'Admin Yukpo',
    NOW(),
    NOW()
) ON CONFLICT (email) DO UPDATE SET
    role = 'admin',
    updated_at = NOW();
"@

# Sauvegarder le script SQL
$sqlScript | Out-File -FilePath "create_admin.sql" -Encoding UTF8

Write-Host "📝 Script SQL créé: create_admin.sql" -ForegroundColor Green

# Exécuter le script avec psql
try {
    Write-Host "🚀 Exécution du script SQL..." -ForegroundColor Yellow
    psql $databaseUrl -f "create_admin.sql"
    Write-Host "✅ Utilisateur admin créé avec succès!" -ForegroundColor Green
    Write-Host ""
    Write-Host "🔐 Identifiants de connexion:" -ForegroundColor Cyan
    Write-Host "   Email: admin@yukpo.dev" -ForegroundColor White
    Write-Host "   Mot de passe: admin123" -ForegroundColor White
    Write-Host ""
    Write-Host "🌐 Vous pouvez maintenant vous connecter sur http://localhost:5173" -ForegroundColor Green
} catch {
    Write-Host "❌ Erreur lors de l'exécution du script SQL: $_" -ForegroundColor Red
    Write-Host "💡 Assurez-vous que PostgreSQL est démarré et accessible" -ForegroundColor Yellow
}

# Nettoyer le fichier temporaire
if (Test-Path "create_admin.sql") {
    Remove-Item "create_admin.sql"
}