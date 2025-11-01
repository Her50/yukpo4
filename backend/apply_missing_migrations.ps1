# Script PowerShell pour appliquer les migrations manquantes en production
# Migrations à appliquer :
# - 20251026_create_image_analyses_table.sql (table image_analyses)
# - 20250122_create_hybrid_image_search_function.sql (fonction hybrid_image_search)
# - 20251031_002_create_search_history.sql (table search_history)

Write-Host "=== Application des migrations manquantes ===" -ForegroundColor Cyan
Write-Host "Migrations pour recherche par image hybride" -ForegroundColor Green

# Vérifier si DATABASE_URL est définie
if (-not $env:DATABASE_URL) {
    Write-Host "ERREUR: DATABASE_URL n'est pas définie" -ForegroundColor Red
    Write-Host "Veuillez définir la variable d'environnement DATABASE_URL" -ForegroundColor Yellow
    Write-Host "Exemple: `$env:DATABASE_URL = 'postgresql://user:password@host:port/database'" -ForegroundColor Blue
    exit 1
}

Write-Host "Connexion à la base de données..." -ForegroundColor Blue
Write-Host "URL: $($env:DATABASE_URL.Substring(0, [Math]::Min(50, $env:DATABASE_URL.Length)))..." -ForegroundColor Gray

$migrations = @(
    @{
        File        = "migrations/20251026_create_image_analyses_table.sql"
        Description = "Table image_analyses"
    },
    @{
        File        = "migrations/20250122_create_hybrid_image_search_function.sql"
        Description = "Fonction hybrid_image_search"
    },
    @{
        File        = "migrations/20251031_002_create_search_history.sql"
        Description = "Table search_history"
    }
)

foreach ($migration in $migrations) {
    Write-Host "`n=== Application: $($migration.Description) ===" -ForegroundColor Yellow
    Write-Host "Fichier: $($migration.File)" -ForegroundColor Gray
    
    if (-not (Test-Path $migration.File)) {
        Write-Host "   ✗ Fichier non trouvé: $($migration.File)" -ForegroundColor Red
        continue
    }
    
    try {
        # Appliquer la migration avec psql
        $result = psql $env:DATABASE_URL -f $migration.File 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "   ✓ Migration appliquée avec succès!" -ForegroundColor Green
        }
        else {
            Write-Host "   ⚠ Code de retour: $LASTEXITCODE" -ForegroundColor Yellow
            Write-Host "   Sortie: $result" -ForegroundColor Gray
            
            # Vérifier si c'est une erreur "already exists" (normal si migration déjà appliquée)
            if ($result -match "already exists|existe déjà|duplicate") {
                Write-Host "   ℹ Migration déjà appliquée (normal)" -ForegroundColor Cyan
            }
            else {
                Write-Host "   ✗ Erreur lors de l'application de la migration" -ForegroundColor Red
            }
        }
    }
    catch {
        Write-Host "   ✗ Exception: $_" -ForegroundColor Red
    }
}

Write-Host "`n=== Vérification des objets créés ===" -ForegroundColor Cyan

# Vérifier image_analyses
Write-Host "`nVérification table image_analyses..." -ForegroundColor Yellow
$check1 = psql $env:DATABASE_URL -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'image_analyses');" -t
if ($check1 -match "t|true") {
    Write-Host "   ✓ Table image_analyses existe" -ForegroundColor Green
}
else {
    Write-Host "   ✗ Table image_analyses n'existe pas" -ForegroundColor Red
}

# Vérifier hybrid_image_search
Write-Host "`nVérification fonction hybrid_image_search..." -ForegroundColor Yellow
$check2 = psql $env:DATABASE_URL -c "SELECT EXISTS (SELECT FROM pg_proc WHERE proname = 'hybrid_image_search');" -t
if ($check2 -match "t|true") {
    Write-Host "   ✓ Fonction hybrid_image_search existe" -ForegroundColor Green
}
else {
    Write-Host "   ✗ Fonction hybrid_image_search n'existe pas" -ForegroundColor Red
}

# Vérifier search_history
Write-Host "`nVérification table search_history..." -ForegroundColor Yellow
$check3 = psql $env:DATABASE_URL -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'search_history');" -t
if ($check3 -match "t|true") {
    Write-Host "   ✓ Table search_history existe" -ForegroundColor Green
}
else {
    Write-Host "   ✗ Table search_history n'existe pas" -ForegroundColor Red
}

Write-Host "`n=== Migration terminée ===" -ForegroundColor Green
Write-Host "Si des erreurs persistent, vérifiez les logs ci-dessus" -ForegroundColor Yellow

