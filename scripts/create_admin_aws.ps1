# Script pour créer le compte administrateur dans la base de données AWS PostgreSQL
# Email: admin@yukpo.dev
# Mot de passe: Hernandez87
# Usage: .\scripts\create_admin_aws.ps1 [-DatabaseUrl "postgresql://..."] [-UseRust] [-UsePsql]

param(
    [string]$DatabaseUrl = "",
    [switch]$UseRust = $false,
    [switch]$UsePsql = $false,
    [switch]$AutoConfirm = $false
)

Write-Host "🔐 Création du compte administrateur dans AWS PostgreSQL" -ForegroundColor Green
Write-Host ""

# Configuration
$adminEmail = "admin@yukpo.dev"
$adminPassword = "Hernandez87"
$adminName = "Super Admin"
# Hash bcrypt pour "Hernandez87" (cost 12)
$passwordHash = '$2b$12$yi.th1fxm9Xrz6A.PjP9wuWyDrueHMZZBReIH7i7X.efPhGNV1Pii'

# Obtenir DATABASE_URL
if ([string]::IsNullOrEmpty($DatabaseUrl)) {
    Write-Host "📋 Récupération de DATABASE_URL depuis AWS SSM Parameter Store..." -ForegroundColor Yellow
    
    try {
        # Essayer de récupérer depuis SSM Parameter Store
        $ssmPath = "/yukpomnang/production/DATABASE_URL"
        $param = aws ssm get-parameter --name $ssmPath --region us-east-1 --with-decryption --query Parameter.Value --output text 2>&1
        
        if ($LASTEXITCODE -eq 0 -and $param -and $param -notmatch "error") {
            $DatabaseUrl = $param.Trim()
            Write-Host "✅ DATABASE_URL récupéré depuis SSM Parameter Store" -ForegroundColor Green
        } else {
            Write-Host "⚠️ Impossible de récupérer depuis SSM, demande manuelle..." -ForegroundColor Yellow
            $DatabaseUrl = Read-Host "Entrez la DATABASE_URL AWS PostgreSQL (format: postgresql://user:pass@host:5432/db)"
        }
    } catch {
        Write-Host "⚠️ AWS CLI non disponible, demande manuelle..." -ForegroundColor Yellow
        $DatabaseUrl = Read-Host "Entrez la DATABASE_URL AWS PostgreSQL (format: postgresql://user:pass@host:5432/db)"
    }
}

if ([string]::IsNullOrEmpty($DatabaseUrl)) {
    Write-Host "❌ DATABASE_URL est requis" -ForegroundColor Red
    exit 1
}

# Masquer le mot de passe dans l'URL pour l'affichage
$displayUrl = $DatabaseUrl -replace '://([^:]+):([^@]+)@', '://$1:***@'
Write-Host "📊 Base de données: $displayUrl" -ForegroundColor Cyan
Write-Host ""

# Confirmation
if (-not $AutoConfirm) {
    Write-Host "⚠️ Vous allez créer/mettre à jour le compte administrateur:" -ForegroundColor Yellow
    Write-Host "   Email: $adminEmail" -ForegroundColor White
    Write-Host "   Mot de passe: $adminPassword" -ForegroundColor White
    Write-Host ""
    $confirm = Read-Host "Continuer? (O/N)"
    if ($confirm -ne "O" -and $confirm -ne "o" -and $confirm -ne "Y" -and $confirm -ne "y") {
        Write-Host "❌ Opération annulée" -ForegroundColor Red
        exit 0
    }
}

# Méthode 1: Utiliser Rust (recommandé)
if ($UseRust -or (-not $UsePsql)) {
    Write-Host ""
    Write-Host "🚀 Méthode Rust (recommandée)..." -ForegroundColor Green
    
    # Vérifier que Rust est disponible
    $rustAvailable = Get-Command cargo -ErrorAction SilentlyContinue
    if (-not $rustAvailable) {
        Write-Host "⚠️ Rust/Cargo non trouvé, passage à psql..." -ForegroundColor Yellow
        $UsePsql = $true
    } else {
        # Vérifier que le binaire existe
        $binPath = "backend/src/bin/create_admin_user.rs"
        if (-not (Test-Path $binPath)) {
            Write-Host "⚠️ Binaire create_admin_user.rs non trouvé, passage à psql..." -ForegroundColor Yellow
            $UsePsql = $true
        } else {
            try {
                Write-Host "📦 Compilation et exécution du binaire Rust..." -ForegroundColor Yellow
                $env:DATABASE_URL = $DatabaseUrl
                
                Push-Location backend
                $result = cargo run --bin create_admin_user 2>&1
                Pop-Location
                
                if ($LASTEXITCODE -eq 0) {
                    Write-Host "✅ Compte administrateur créé/mis à jour avec succès!" -ForegroundColor Green
                    Write-Host ""
                    Write-Host "=== Identifiants de connexion ===" -ForegroundColor Cyan
                    Write-Host "Email: $adminEmail" -ForegroundColor White
                    Write-Host "Mot de passe: $adminPassword" -ForegroundColor White
                    exit 0
                } else {
                    Write-Host "❌ Erreur lors de l'exécution Rust:" -ForegroundColor Red
                    Write-Host $result -ForegroundColor Red
                    Write-Host ""
                    Write-Host "⚠️ Tentative avec psql..." -ForegroundColor Yellow
                    $UsePsql = $true
                }
            } catch {
                Write-Host "❌ Erreur: $_" -ForegroundColor Red
                Write-Host "⚠️ Tentative avec psql..." -ForegroundColor Yellow
                $UsePsql = $true
            }
        }
    }
}

# Méthode 2: Utiliser psql directement
if ($UsePsql) {
    Write-Host ""
    Write-Host "🔧 Méthode psql..." -ForegroundColor Green
    
    # Vérifier que psql est disponible
    $psqlAvailable = Get-Command psql -ErrorAction SilentlyContinue
    if (-not $psqlAvailable) {
        Write-Host "❌ psql non trouvé. Veuillez installer PostgreSQL client." -ForegroundColor Red
        exit 1
    }
    
    # Créer le script SQL temporaire
    $sqlScript = @"
-- Création ou mise à jour de l'utilisateur super admin
-- Email: $adminEmail
-- Mot de passe: $adminPassword
-- Hash: $passwordHash

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

-- Afficher l'utilisateur créé
SELECT 
    id, 
    email, 
    role, 
    nom_complet, 
    tokens_balance, 
    created_at 
FROM users 
WHERE email = '$adminEmail';
"@
    
    $tempSqlFile = [System.IO.Path]::GetTempFileName() + ".sql"
    $sqlScript | Out-File -FilePath $tempSqlFile -Encoding UTF8
    
    try {
        Write-Host "📝 Exécution du script SQL..." -ForegroundColor Yellow
        
        # Extraire les composants de l'URL pour psql
        if ($DatabaseUrl -match 'postgresql://([^:]+):([^@]+)@([^:]+):(\d+)/(.+)') {
            $dbUser = $matches[1]
            $dbPass = $matches[2]
            $dbHost = $matches[3]
            $dbPort = $matches[4]
            $dbName = $matches[5]
            
            # Nettoyer le nom de la base (enlever les paramètres de requête)
            $dbName = $dbName -split '\?' | Select-Object -First 1
            
            $env:PGPASSWORD = $dbPass
            
            $result = psql -h $dbHost -p $dbPort -U $dbUser -d $dbName -f $tempSqlFile 2>&1
            
            if ($LASTEXITCODE -eq 0) {
                Write-Host "✅ Compte administrateur créé/mis à jour avec succès!" -ForegroundColor Green
                Write-Host ""
                Write-Host "=== Résultat ===" -ForegroundColor Cyan
                Write-Host $result -ForegroundColor White
                Write-Host ""
                Write-Host "=== Identifiants de connexion ===" -ForegroundColor Cyan
                Write-Host "Email: $adminEmail" -ForegroundColor White
                Write-Host "Mot de passe: $adminPassword" -ForegroundColor White
            } else {
                Write-Host "❌ Erreur lors de l'exécution SQL:" -ForegroundColor Red
                Write-Host $result -ForegroundColor Red
                exit 1
            }
        } else {
            Write-Host "❌ Format de DATABASE_URL invalide" -ForegroundColor Red
            Write-Host "Format attendu: postgresql://user:password@host:port/database" -ForegroundColor Yellow
            exit 1
        }
    } catch {
        Write-Host "❌ Erreur: $_" -ForegroundColor Red
        exit 1
    } finally {
        # Nettoyer
        Remove-Item $tempSqlFile -ErrorAction SilentlyContinue
        Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
    }
}

Write-Host ""
Write-Host "✅ Opération terminée!" -ForegroundColor Green

