# Script pour créer le compte SUPER SUPER ADMIN dans AWS PostgreSQL
# Email: admin@yukpo.dev
# Mot de passe: Hernandez87
# Rôle: super_admin (tous les droits)
# Usage: .\scripts\create_super_admin_aws.ps1 [-DatabaseUrl "postgresql://..."] [-UseRust] [-UsePsql] [-AutoConfirm]

param(
    [string]$DatabaseUrl = "",
    [switch]$UseRust = $false,
    [switch]$UsePsql = $false,
    [switch]$AutoConfirm = $false
)

Write-Host "🔐 Création du compte SUPER SUPER ADMIN dans AWS PostgreSQL" -ForegroundColor Green
Write-Host "   Rôle: super_admin (tous les droits)" -ForegroundColor Cyan
Write-Host ""

# Configuration
$adminEmail = "admin@yukpo.dev"
$adminPassword = "Hernandez87"
$adminName = "Super Super Admin"
$adminRole = "super_admin"  # ✅ Rôle super_admin pour tous les droits
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
    Write-Host "⚠️ Vous allez créer/mettre à jour le compte SUPER SUPER ADMIN:" -ForegroundColor Yellow
    Write-Host "   Email: $adminEmail" -ForegroundColor White
    Write-Host "   Mot de passe: $adminPassword" -ForegroundColor White
    Write-Host "   Rôle: $adminRole (tous les droits)" -ForegroundColor White
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
        # Modifier temporairement le binaire pour utiliser super_admin
        $binPath = "backend/src/bin/create_admin_user.rs"
        if (-not (Test-Path $binPath)) {
            Write-Host "⚠️ Binaire create_admin_user.rs non trouvé, passage à psql..." -ForegroundColor Yellow
            $UsePsql = $true
        } else {
            try {
                Write-Host "📦 Compilation et exécution du binaire Rust..." -ForegroundColor Yellow
                $env:DATABASE_URL = $DatabaseUrl
                
                # Lire le fichier, remplacer 'admin' par 'super_admin', exécuter, puis restaurer
                $originalContent = Get-Content $binPath -Raw
                $modifiedContent = $originalContent -replace "'admin'", "'super_admin'"
                $modifiedContent | Set-Content $binPath -NoNewline
                
                Push-Location backend
                $result = cargo run --bin create_admin_user 2>&1
                Pop-Location
                
                # Restaurer le fichier original
                $originalContent | Set-Content $binPath -NoNewline
                
                if ($LASTEXITCODE -eq 0) {
                    Write-Host "✅ Compte SUPER SUPER ADMIN créé/mis à jour avec succès!" -ForegroundColor Green
                    Write-Host ""
                    Write-Host "=== Identifiants de connexion ===" -ForegroundColor Cyan
                    Write-Host "Email: $adminEmail" -ForegroundColor White
                    Write-Host "Mot de passe: $adminPassword" -ForegroundColor White
                    Write-Host "Rôle: $adminRole (tous les droits)" -ForegroundColor White
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

# Méthode 2: Utiliser psql directement (recommandé pour AWS)
if ($UsePsql) {
    Write-Host ""
    Write-Host "🔧 Méthode psql..." -ForegroundColor Green
    
    # Vérifier que psql est disponible
    $psqlAvailable = Get-Command psql -ErrorAction SilentlyContinue
    if (-not $psqlAvailable) {
        Write-Host "❌ psql non trouvé. Veuillez installer PostgreSQL client." -ForegroundColor Red
        exit 1
    }
    
    # Utiliser le script SQL existant
    $sqlScriptPath = "scripts/create_super_admin_aws.sql"
    
    if (-not (Test-Path $sqlScriptPath)) {
        Write-Host "❌ Script SQL non trouvé: $sqlScriptPath" -ForegroundColor Red
        exit 1
    }
    
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
            
            $result = psql -h $dbHost -p $dbPort -U $dbUser -d $dbName -f $sqlScriptPath 2>&1
            
            if ($LASTEXITCODE -eq 0) {
                Write-Host "✅ Compte SUPER SUPER ADMIN créé/mis à jour avec succès!" -ForegroundColor Green
                Write-Host ""
                Write-Host "=== Résultat ===" -ForegroundColor Cyan
                Write-Host $result -ForegroundColor White
                Write-Host ""
                Write-Host "=== Identifiants de connexion ===" -ForegroundColor Cyan
                Write-Host "Email: $adminEmail" -ForegroundColor White
                Write-Host "Mot de passe: $adminPassword" -ForegroundColor White
                Write-Host "Rôle: $adminRole (tous les droits)" -ForegroundColor White
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
        Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
    }
}

Write-Host ""
Write-Host "✅ Opération terminée!" -ForegroundColor Green

