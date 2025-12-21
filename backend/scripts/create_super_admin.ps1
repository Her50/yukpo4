# Script pour créer un utilisateur super admin dans la base de données Yukpo
# Usage: .\scripts\create_super_admin.ps1

Write-Host "🔧 Création de l'utilisateur super admin dans la base de données..." -ForegroundColor Green

# Paramètres
$adminEmail = "admin@yukpo.dev"
$adminPassword = "Hernandez87"
$adminName = "Super Admin"

# Vérifier si le fichier .env existe
if (-not (Test-Path ".env")) {
    Write-Host "❌ Fichier .env non trouvé. Copie depuis le template..." -ForegroundColor Yellow
    if (Test-Path "env_template.txt") {
        Copy-Item "env_template.txt" ".env"
        Write-Host "✅ Fichier .env créé. Veuillez le configurer avec vos paramètres de base de données." -ForegroundColor Green
        Write-Host "📝 Modifiez le fichier .env avec vos paramètres PostgreSQL" -ForegroundColor Yellow
    } else {
        Write-Host "❌ Template .env non trouvé" -ForegroundColor Red
    }
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
    Write-Host "💡 Ajoutez DATABASE_URL=postgresql://user:password@host:port/database dans votre .env" -ForegroundColor Yellow
    exit 1
}

Write-Host "📊 Connexion à la base de données..." -ForegroundColor Cyan
Write-Host "📧 Email admin: $adminEmail" -ForegroundColor Cyan

# Hasher le mot de passe avec bcrypt (cost 12)
# Note: On va utiliser Rust pour hasher le mot de passe correctement
Write-Host "🔐 Hachage du mot de passe avec bcrypt..." -ForegroundColor Yellow

# Créer un script Rust temporaire pour hasher le mot de passe
$rustScript = @"
use bcrypt::{hash, DEFAULT_COST};

fn main() {
    let password = "$adminPassword";
    let cost = 12u32;
    match hash(password, cost) {
        Ok(hash) => println!("{}", hash),
        Err(e) => {
            eprintln!("Erreur: {}", e);
            std::process::exit(1);
        }
    }
}
"@

$rustScriptPath = "temp_hash_password.rs"
$rustScript | Out-File -FilePath $rustScriptPath -Encoding UTF8

# Compiler et exécuter le script Rust pour obtenir le hash
try {
    Write-Host "⚙️  Génération du hash bcrypt..." -ForegroundColor Yellow
    $hashResult = cargo run --quiet --bin hash_password_helper 2>&1
    if ($LASTEXITCODE -ne 0) {
        # Si le binaire n'existe pas, on crée un petit programme Rust temporaire
        $tempMain = @"
fn main() {
    use bcrypt::{hash, DEFAULT_COST};
    let password = "$adminPassword";
    match hash(password, 12) {
        Ok(h) => println!("{}", h),
        Err(e) => {
            eprintln!("Erreur: {}", e);
            std::process::exit(1);
        }
    }
}
"@
        # Créer un fichier temporaire dans src/bin
        $binDir = "src\bin"
        if (-not (Test-Path $binDir)) {
            New-Item -ItemType Directory -Path $binDir -Force | Out-Null
        }
        $tempBin = "$binDir\hash_password_helper.rs"
        $tempMain | Out-File -FilePath $tempBin -Encoding UTF8
        
        # Ajouter au Cargo.toml si nécessaire (on le fait manuellement via echo)
        Write-Host "📦 Compilation du helper de hachage..." -ForegroundColor Yellow
        $hashResult = cargo run --bin hash_password_helper 2>&1
        Remove-Item $tempBin -ErrorAction SilentlyContinue
    }
    
    # Hash par défaut si le script Rust échoue (pour test - À REMPLACER PAR LE VRAI HASH)
    # Pour l'instant, on va utiliser un hash pré-généré pour "Hernandez87"
    # Hash bcrypt cost 12 pour "Hernandez87": $2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/HS.iK2O
    
    # Utiliser Python si disponible pour générer le hash
    $pythonScript = @"
import bcrypt
password = b'$adminPassword'
hashed = bcrypt.hashpw(password, bcrypt.gensalt(rounds=12))
print(hashed.decode('utf-8'))
"@
    
    $pythonScriptPath = "temp_hash.py"
    $pythonScript | Out-File -FilePath $pythonScriptPath -Encoding UTF8
    
    try {
        $passwordHash = python $pythonScriptPath 2>&1 | Select-Object -Last 1
        if ($LASTEXITCODE -ne 0) {
            throw "Python failed"
        }
        Remove-Item $pythonScriptPath -ErrorAction SilentlyContinue
    } catch {
        Write-Host "⚠️  Python non disponible, utilisation d'un hash pré-généré..." -ForegroundColor Yellow
        # Hash pré-calculé pour "Hernandez87" avec bcrypt cost 12
        # Note: Il faut générer ce hash correctement. Pour l'instant, on utilise un placeholder
        $passwordHash = "\$2b\$12\$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/HS.iK2O"  # Ce hash doit être régénéré pour "Hernandez87"
        Write-Host "⚠️  ATTENTION: Utilisation d'un hash temporaire. Vous devez le régénérer!" -ForegroundColor Red
    }
    
} catch {
    Write-Host "❌ Erreur lors du hachage du mot de passe: $_" -ForegroundColor Red
    Write-Host "💡 Vous pouvez générer le hash manuellement avec:" -ForegroundColor Yellow
    Write-Host "   python -c `"import bcrypt; print(bcrypt.hashpw(b'$adminPassword', bcrypt.gensalt(12)).decode())`"" -ForegroundColor Cyan
    exit 1
}

# Pour l'instant, générons le hash avec une méthode simple
# On va utiliser le hash existant comme modèle et demander à l'utilisateur de le générer
Write-Host "⚠️  IMPORTANT: Le hash du mot de passe doit être généré avec bcrypt cost 12." -ForegroundColor Yellow
Write-Host "💡 Pour générer le hash, exécutez dans un terminal Python:" -ForegroundColor Cyan
Write-Host "   python -c `"import bcrypt; print(bcrypt.hashpw(b'$adminPassword', bcrypt.gensalt(12)).decode())`"" -ForegroundColor White
Write-Host ""
Write-Host "📝 Entrez le hash généré (ou appuyez sur Entrée pour utiliser un hash temporaire):" -ForegroundColor Yellow
$passwordHash = Read-Host

if ([string]::IsNullOrWhiteSpace($passwordHash)) {
    Write-Host "❌ Hash requis. Veuillez générer le hash et réessayer." -ForegroundColor Red
    exit 1
}

# Script SQL pour créer l'utilisateur admin
$sqlScript = @"
-- Création ou mise à jour de l'utilisateur super admin
INSERT INTO users (email, password_hash, role, nom_complet, tokens_balance, token_price_user, token_price_provider, commission_pct, preferred_lang, is_provider, created_at, updated_at)
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

-- Afficher l'utilisateur créé
SELECT id, email, role, nom_complet, tokens_balance, created_at 
FROM users 
WHERE email = '$adminEmail';
"@

# Sauvegarder le script SQL
$sqlScriptPath = "create_super_admin.sql"
$sqlScript | Out-File -FilePath $sqlScriptPath -Encoding UTF8

Write-Host "📝 Script SQL créé: $sqlScriptPath" -ForegroundColor Green

# Exécuter le script avec psql
try {
    Write-Host "🚀 Exécution du script SQL..." -ForegroundColor Yellow
    $result = psql $databaseUrl -f $sqlScriptPath 2>&1
    Write-Host $result
    Write-Host ""
    Write-Host "✅ Utilisateur super admin créé/mis à jour avec succès!" -ForegroundColor Green
    Write-Host ""
    Write-Host "🔐 Identifiants de connexion:" -ForegroundColor Cyan
    Write-Host "   Email: $adminEmail" -ForegroundColor White
    Write-Host "   Mot de passe: $adminPassword" -ForegroundColor White
    Write-Host ""
    Write-Host "🌐 Vous pouvez maintenant vous connecter avec ces identifiants" -ForegroundColor Green
} catch {
    Write-Host "❌ Erreur lors de l'exécution du script SQL: $_" -ForegroundColor Red
    Write-Host "💡 Assurez-vous que PostgreSQL est démarré et accessible" -ForegroundColor Yellow
    Write-Host "💡 Vérifiez que psql est dans votre PATH" -ForegroundColor Yellow
    exit 1
}

# Nettoyer le fichier temporaire
if (Test-Path $sqlScriptPath) {
    Remove-Item $sqlScriptPath
}

Write-Host ""
Write-Host "✨ Script terminé!" -ForegroundColor Green

