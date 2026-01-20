# Script pour appliquer la migration de correction to_tsvector
# Date: 2026-01-14

Write-Host "🔧 Application de la migration de correction to_tsvector..." -ForegroundColor Cyan

# Chemin du fichier de migration
$migrationFile = "backend\migrations\20260114_fix_image_search_to_tsvector_error.sql"

if (-Not (Test-Path $migrationFile)) {
    Write-Host "❌ Fichier de migration non trouvé: $migrationFile" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Fichier de migration trouvé: $migrationFile" -ForegroundColor Green

# Essayer de récupérer DATABASE_URL depuis les variables d'environnement
$databaseUrl = $env:DATABASE_URL

if (-Not $databaseUrl) {
    Write-Host "⚠️  DATABASE_URL non trouvée dans les variables d'environnement" -ForegroundColor Yellow
    Write-Host "📝 Veuillez fournir les informations de connexion PostgreSQL:" -ForegroundColor Cyan
    
    $dbHost = Read-Host "Host (défaut: localhost)"
    if ([string]::IsNullOrEmpty($dbHost)) { $dbHost = "localhost" }
    
    $dbPort = Read-Host "Port (défaut: 5432)"
    if ([string]::IsNullOrEmpty($dbPort)) { $dbPort = "5432" }
    
    $dbName = Read-Host "Nom de la base de données (défaut: yukpo_db)"
    if ([string]::IsNullOrEmpty($dbName)) { $dbName = "yukpo_db" }
    
    $dbUser = Read-Host "Utilisateur (défaut: postgres)"
    if ([string]::IsNullOrEmpty($dbUser)) { $dbUser = "postgres" }
    
    $dbPassword = Read-Host "Mot de passe" -AsSecureString
    $plainPassword = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($dbPassword))
    
    $env:PGPASSWORD = $plainPassword
    
    Write-Host "🔌 Application de la migration..." -ForegroundColor Yellow
    Get-Content $migrationFile | psql -h $dbHost -p $dbPort -U $dbUser -d $dbName
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Migration appliquée avec succès!" -ForegroundColor Green
    } else {
        Write-Host "❌ Erreur lors de l'application de la migration" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "✅ DATABASE_URL trouvée dans les variables d'environnement" -ForegroundColor Green
    
    # Parser l'URL PostgreSQL
    if ($databaseUrl -match "postgres(ql)?://([^:]+):([^@]+)@([^:]+):?(\d+)?/(.+)") {
        $dbUser = $matches[2]
        $dbPass = $matches[3]
        $dbHost = $matches[4]
        $dbPort = if ($matches[5]) { $matches[5] } else { "5432" }
        $dbName = $matches[6]
        
        $env:PGPASSWORD = $dbPass
        
        Write-Host "🔌 Connexion à: $dbHost:$dbPort/$dbName (utilisateur: $dbUser)" -ForegroundColor Cyan
        Write-Host "📝 Application de la migration..." -ForegroundColor Yellow
        
        Get-Content $migrationFile | psql -h $dbHost -p $dbPort -U $dbUser -d $dbName
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Migration appliquée avec succès!" -ForegroundColor Green
        } else {
            Write-Host "❌ Erreur lors de l'application de la migration" -ForegroundColor Red
            exit 1
        }
    } else {
        Write-Host "❌ Format de DATABASE_URL invalide" -ForegroundColor Red
        Write-Host "Format attendu: postgresql://user:password@host:port/database" -ForegroundColor Yellow
        exit 1
    }
}

Write-Host ""
Write-Host "✅ Migration terminée!" -ForegroundColor Green
Write-Host "📋 La migration sera aussi appliquée automatiquement au prochain démarrage du backend via auto_migrate.rs" -ForegroundColor Cyan






