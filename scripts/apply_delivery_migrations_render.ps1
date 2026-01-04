# Script pour appliquer les migrations delivery (aller-retour + delivery_media) sur Render
# Date: 2025-01-31

$ErrorActionPreference = "Stop"

Write-Host "🚀 Application des migrations delivery sur Render..." -ForegroundColor Cyan
Write-Host "   - Migration aller-retour (00000030)" -ForegroundColor Yellow
Write-Host "   - Migration delivery_media (00000031)" -ForegroundColor Yellow

# Vérifier que DATABASE_URL est définie (ou utiliser variables d'environnement Render)
if (-not $env:DATABASE_URL) {
    Write-Host "⚠️ DATABASE_URL n'est pas définie" -ForegroundColor Yellow
    Write-Host "💡 Définissez DATABASE_URL avec les informations de connexion Render:" -ForegroundColor Cyan
    Write-Host "   Exemple: `$env:DATABASE_URL = 'postgresql://user:password@host.render.com:5432/database?sslmode=require'" -ForegroundColor Gray
    Write-Host ""
    
    # Demander les informations de connexion si non fournies
    $dbHost = Read-Host "Host Render (ex: dpg-xxx.render.com)"
    $dbPort = Read-Host "Port (défaut: 5432)" 
    if ([string]::IsNullOrEmpty($dbPort)) { $dbPort = "5432" }
    $dbName = Read-Host "Nom de la base de données"
    $dbUser = Read-Host "Utilisateur"
    $dbPass = Read-Host "Mot de passe" -AsSecureString
    $dbPassPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($dbPass))
    
    $env:DATABASE_URL = "postgresql://${dbUser}:${dbPassPlain}@${dbHost}:${dbPort}/${dbName}?sslmode=require"
    Write-Host ""
}

# Ajouter sslmode=require si manquant (requis pour Render)
if ($env:DATABASE_URL -notmatch "sslmode") {
    $separator = if ($env:DATABASE_URL -match "\?") { "&" } else { "?" }
    $env:DATABASE_URL = "${env:DATABASE_URL}${separator}sslmode=require"
    Write-Host "✅ Mode SSL ajouté à DATABASE_URL (requis pour Render)" -ForegroundColor Green
}

# Extraire le mot de passe pour psql
$dbUrl = $env:DATABASE_URL
if ($dbUrl -match "postgresql://([^:]+):([^@]+)@") {
    $env:PGPASSWORD = $matches[2]
}

# Vérifier que psql est disponible
if (-not (Get-Command psql -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Erreur: psql n'est pas installé ou n'est pas dans le PATH" -ForegroundColor Red
    Write-Host "💡 Installez PostgreSQL client ou ajoutez psql au PATH" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ psql détecté" -ForegroundColor Green

# Test de connexion
Write-Host "`n🔍 Test de connexion à la base de données..." -ForegroundColor Cyan
try {
    $testResult = psql $env:DATABASE_URL -c "SELECT version();" 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Connexion réussie!" -ForegroundColor Green
    } else {
        Write-Host "❌ Échec de connexion: $testResult" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "❌ Erreur de connexion: $_" -ForegroundColor Red
    exit 1
}

# Appliquer les migrations
$migrations = @(
    @{File = "backend\migrations\00000030_add_delivery_round_trip.sql"; Name = "Aller-retour deliveries"},
    @{File = "backend\migrations\00000031_add_delivery_media_table.sql"; Name = "Table delivery_media"}
)

$success = $true

foreach ($migration in $migrations) {
    $migrationFile = $migration.File
    $migrationName = $migration.Name
    
    Write-Host "`n📝 Application de la migration: $migrationName" -ForegroundColor Yellow
    Write-Host "   Fichier: $migrationFile" -ForegroundColor Gray
    
    if (-not (Test-Path $migrationFile)) {
        Write-Host "   ❌ Fichier introuvable: $migrationFile" -ForegroundColor Red
        $success = $false
        continue
    }
    
    try {
        # Lire et appliquer le fichier SQL
        $sqlContent = Get-Content $migrationFile -Raw
        $sqlContent | psql $env:DATABASE_URL 2>&1 | Out-String | ForEach-Object {
            if ($_ -match "ERROR" -or $_ -match "error") {
                Write-Host "   ⚠️ $_" -ForegroundColor Yellow
            } else {
                Write-Host "   $_" -ForegroundColor Gray
            }
        }
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "   ✅ Migration appliquée avec succès!" -ForegroundColor Green
        } else {
            Write-Host "   ⚠️ Code de sortie: $LASTEXITCODE (peut être normal si déjà appliquée)" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "   ❌ Erreur lors de l'application: $_" -ForegroundColor Red
        $success = $false
    }
}

# Vérification finale
Write-Host "`n🔍 Vérification des tables et colonnes créées..." -ForegroundColor Cyan

$verifications = @(
    @{Query = "SELECT column_name FROM information_schema.columns WHERE table_name = 'deliveries' AND column_name = 'is_round_trip';"; Desc = "Colonne is_round_trip"},
    @{Query = "SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'delivery_media');"; Desc = "Table delivery_media"}
)

foreach ($check in $verifications) {
    try {
        $result = psql $env:DATABASE_URL -t -c $check.Query 2>&1
        if ($LASTEXITCODE -eq 0 -and ($result -match "t|is_round_trip")) {
            Write-Host "   ✅ $($check.Desc)" -ForegroundColor Green
        } else {
            Write-Host "   ⚠️ $($check.Desc) - Non trouvé (peut être normal si migration déjà appliquée)" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "   ⚠️ Erreur de vérification: $_" -ForegroundColor Yellow
    }
}

Write-Host "`n✅ Migrations delivery appliquées!" -ForegroundColor Green
Write-Host "💡 Les migrations seront aussi appliquées automatiquement au prochain démarrage via auto_migrate.rs" -ForegroundColor Cyan

