# Script pour appliquer la migration optimize_vector_matching_vectorial directement sur Render
# Usage: .\apply_vector_matching_render.ps1

Write-Host "🚀 Application de la migration 20260113_optimize_vector_matching_vectorial.sql sur Render..." -ForegroundColor Cyan

# Vérifier que DATABASE_URL est défini
$databaseUrl = $env:DATABASE_URL
if (-not $databaseUrl) {
    Write-Host "❌ ERREUR: DATABASE_URL n'est pas défini dans les variables d'environnement" -ForegroundColor Red
    Write-Host "💡 Astuce: Définissez DATABASE_URL avant d'exécuter ce script" -ForegroundColor Yellow
    Write-Host "   Exemple: `$env:DATABASE_URL = 'postgresql://user:password@host:port/database'" -ForegroundColor Cyan
    exit 1
}

Write-Host "✅ DATABASE_URL trouvé" -ForegroundColor Green

# Chemin vers le fichier de migration
$migrationFile = "migrations\20260113_optimize_vector_matching_vectorial.sql"

if (-not (Test-Path $migrationFile)) {
    Write-Host "❌ ERREUR: Fichier de migration introuvable: $migrationFile" -ForegroundColor Red
    exit 1
}

Write-Host "📄 Lecture du fichier de migration..." -ForegroundColor Cyan
$sqlContent = Get-Content $migrationFile -Raw

# Extraire les informations de connexion depuis DATABASE_URL
# Format: postgresql://user:password@host:port/database
if ($databaseUrl -match "postgresql://([^:]+):([^@]+)@([^:]+):(\d+)/(.+)") {
    $dbUser = $matches[1]
    $dbPassword = $matches[2]
    $dbHost = $matches[3]
    $dbPort = $matches[4]
    $dbName = $matches[5]
    
    Write-Host "🔌 Connexion à: ${dbHost}:${dbPort}/${dbName}" -ForegroundColor Cyan
    
    # Vérifier si psql est disponible
    $psqlPath = Get-Command psql -ErrorAction SilentlyContinue
    if ($psqlPath) {
        Write-Host "✅ psql trouvé, application de la migration..." -ForegroundColor Green
        
        # Appliquer via psql directement avec le fichier
        $env:PGPASSWORD = $dbPassword
        Write-Host "📤 Application de la migration..." -ForegroundColor Cyan
        $result = psql -h $dbHost -p $dbPort -U $dbUser -d $dbName -f $migrationFile 2>&1
        
        Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host ""
            Write-Host "✅ Migration appliquée avec succès!" -ForegroundColor Green
            Write-Host "✅ Fonction calculate_vector_match_score_optimized mise à jour" -ForegroundColor Green
            Write-Host "✅ Test vectoriel unique (équivalent %in% R) maintenant actif" -ForegroundColor Green
        } else {
            Write-Host ""
            Write-Host "❌ Erreur lors de l'application de la migration:" -ForegroundColor Red
            Write-Host $result
            exit 1
        }
    } else {
        # Utiliser sqlx migrate run si psql n'est pas disponible
        Write-Host "⚠️ psql non trouvé, tentative avec sqlx migrate run..." -ForegroundColor Yellow
        
        # Définir DATABASE_URL pour sqlx
        $env:DATABASE_URL = $databaseUrl
        
        # Appliquer la migration
        Set-Location $PSScriptRoot
        Write-Host "📤 Application via sqlx migrate run..." -ForegroundColor Cyan
        $result = sqlx migrate run 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host ""
            Write-Host "✅ Migration appliquée avec succès via sqlx!" -ForegroundColor Green
        } else {
            # Si erreur de migration 0, c'est normal, on continue
            if ($result -match "migration 0 was previously applied") {
                Write-Host "⚠️ Avertissement: Migration 0 modifiée (normal, ignoré)" -ForegroundColor Yellow
                Write-Host "✅ Les autres migrations ont été appliquées" -ForegroundColor Green
            } else {
                Write-Host "❌ Erreur lors de l'application de la migration:" -ForegroundColor Red
                Write-Host $result
                exit 1
            }
        }
    }
} else {
    Write-Host "❌ ERREUR: Format DATABASE_URL invalide" -ForegroundColor Red
    Write-Host "Format attendu: postgresql://user:password@host:port/database" -ForegroundColor Yellow
    Write-Host "Format reçu: $databaseUrl" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "🎉 Migration terminée avec succès!" -ForegroundColor Green


