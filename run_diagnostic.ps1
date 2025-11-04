# Script PowerShell pour exécuter le diagnostic de la base de données
# Date: 2025-11-04

Write-Host "🔍 DIAGNOSTIC BASE DE DONNÉES YUKPOMNANG" -ForegroundColor Cyan
Write-Host ""

# Récupérer l'URL de la base depuis .env
$envFile = "backend\.env"
if (Test-Path $envFile) {
    $dbUrl = Get-Content $envFile | Where-Object { $_ -match "^DATABASE_URL=" } | ForEach-Object { $_ -replace "^DATABASE_URL=", "" }
    
    if ($dbUrl) {
        Write-Host "✅ DATABASE_URL trouvée dans backend\.env" -ForegroundColor Green
        
        # Parser l'URL PostgreSQL
        # Format: postgresql://user:password@host:port/database
        if ($dbUrl -match "postgresql://([^:]+):([^@]+)@([^:]+):(\d+)/(.+)") {
            $user = $matches[1]
            $password = $matches[2]
            $host = $matches[3]
            $port = $matches[4]
            $database = $matches[5]
            
            Write-Host "📊 Connexion à: $host:$port/$database" -ForegroundColor Yellow
            Write-Host ""
            
            # Construire la commande psql
            $env:PGPASSWORD = $password
            
            # Exécuter le script de diagnostic
            psql -h $host -p $port -U $user -d $database -f verify_database_structure.sql
            
        }
        else {
            Write-Host "❌ Impossible de parser DATABASE_URL" -ForegroundColor Red
            Write-Host "Format attendu: postgresql://user:password@host:port/database"
        }
    }
    else {
        Write-Host "❌ DATABASE_URL non trouvée dans $envFile" -ForegroundColor Red
    }
}
else {
    Write-Host "❌ Fichier $envFile introuvable" -ForegroundColor Red
    Write-Host ""
    Write-Host "💡 Vous pouvez aussi exécuter manuellement:" -ForegroundColor Yellow
    Write-Host "   psql -h <HOST> -U <USER> -d <DATABASE> -f verify_database_structure.sql"
}

Write-Host ""
Write-Host "📝 Alternative: Copiez le contenu de verify_database_structure.sql" -ForegroundColor Cyan
Write-Host "   et exécutez-le dans pgAdmin ou DBeaver"

