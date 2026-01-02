# Script pour appliquer la correction de run_audio_cache_cleanup
Write-Host "🔧 Application de la correction run_audio_cache_cleanup..." -ForegroundColor Cyan

# Lire DATABASE_URL depuis l'environnement
$databaseUrl = $env:DATABASE_URL

if (-not $databaseUrl) {
    Write-Host "❌ DATABASE_URL non trouvée dans l'environnement" -ForegroundColor Red
    Write-Host "💡 Essayez de charger .env ou définir DATABASE_URL" -ForegroundColor Yellow
    exit 1
}

Write-Host "📋 DATABASE_URL trouvée" -ForegroundColor Green

# Extraire les informations de connexion depuis DATABASE_URL
# Format: postgresql://user:password@host:port/database
if ($databaseUrl -match "postgresql://([^:]+):([^@]+)@([^:]+):?(\d+)?/(.+)") {
    $dbUser = $matches[1]
    $dbPass = $matches[2]
    $dbHost = $matches[3]
    $dbPort = if ($matches[4]) { $matches[4] } else { "5432" }
    $dbName = $matches[5] -replace '\?.*$', ''  # Enlever les paramètres de requête
    
    Write-Host "🔌 Connexion à: $dbHost:$dbPort/$dbName (utilisateur: $dbUser)" -ForegroundColor Cyan
    
    # Définir le mot de passe pour psql
    $env:PGPASSWORD = $dbPass
    
    # Appliquer la migration
    $migrationFile = "migrations\20251231_fix_audio_cache_cleanup_null_handling.sql"
    
    if (Test-Path $migrationFile) {
        Write-Host "📁 Application de la migration: $migrationFile" -ForegroundColor Yellow
        
        $result = Get-Content $migrationFile | psql -h $dbHost -p $dbPort -U $dbUser -d $dbName 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Migration appliquée avec succès!" -ForegroundColor Green
            Write-Host $result
        } else {
            Write-Host "❌ Erreur lors de l'application de la migration" -ForegroundColor Red
            Write-Host $result
            exit 1
        }
    } else {
        Write-Host "❌ Fichier de migration non trouvé: $migrationFile" -ForegroundColor Red
        exit 1
    }
    
    # Nettoyer le mot de passe de l'environnement
    Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
} else {
    Write-Host "❌ Format DATABASE_URL invalide" -ForegroundColor Red
    Write-Host "Format attendu: postgresql://user:password@host:port/database" -ForegroundColor Yellow
    exit 1
}

Write-Host "`n✅ Correction appliquée avec succès!" -ForegroundColor Green


