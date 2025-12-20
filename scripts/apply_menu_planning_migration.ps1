# Script PowerShell pour appliquer les migrations menu planning sur la base de données
# Usage: .\apply_menu_planning_migration.ps1

$ErrorActionPreference = "Stop"

# Configuration base de données
$dbHost = "your-render-db-host.render.com"
$dbName = "yukpo_db"
$dbUser = "yukpo_db_user"
$dbPassword = "YOUR_PASSWORD"
$dbUrl = "postgresql://${dbUser}:${dbPassword}@${dbHost}/${dbName}"

Write-Host "===================================" -ForegroundColor Cyan
Write-Host "Application des migrations Menu Planning" -ForegroundColor Cyan
Write-Host "===================================" -ForegroundColor Cyan
Write-Host ""

# Chemin vers le fichier de migration
$migrationFile = "backend/migrations/20250127_create_menu_planning_tables.sql"

if (-not (Test-Path $migrationFile)) {
    Write-Host "❌ Erreur: Fichier de migration non trouvé: $migrationFile" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Fichier de migration trouvé: $migrationFile" -ForegroundColor Green

# Vérifier si psql est disponible
$psqlPath = Get-Command psql -ErrorAction SilentlyContinue

if (-not $psqlPath) {
    Write-Host ""
    Write-Host "⚠️  psql n'est pas dans le PATH. Installation de pgcli comme alternative..." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Option 1: Installer PostgreSQL client" -ForegroundColor Yellow
    Write-Host "  - Windows: https://www.postgresql.org/download/windows/" -ForegroundColor Yellow
    Write-Host "  - Ou utiliser Docker: docker run -it --rm postgres psql $dbUrl" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Option 2: Utiliser le backend Rust pour appliquer les migrations" -ForegroundColor Yellow
    Write-Host "  - Les migrations sont automatiquement appliquées au démarrage du serveur" -ForegroundColor Yellow
    Write-Host "  - Ou utiliser: cargo run --bin migrate" -ForegroundColor Yellow
    Write-Host ""
    exit 1
}

Write-Host "✅ psql trouvé: $($psqlPath.Source)" -ForegroundColor Green
Write-Host ""

# Lire le contenu de la migration
$migrationSQL = Get-Content $migrationFile -Raw

Write-Host "📝 Contenu de la migration:" -ForegroundColor Cyan
Write-Host "  - Taille: $($migrationSQL.Length) caractères" -ForegroundColor Gray
Write-Host "  - Lignes: $((Get-Content $migrationFile).Count)" -ForegroundColor Gray
Write-Host ""

# Vérifier que les tables n'existent pas déjà (optionnel)
Write-Host "🔍 Vérification de l'état actuel de la base..." -ForegroundColor Cyan

$checkTablesQuery = @"
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
    'family_profiles', 
    'recipes', 
    'menu_plans', 
    'planned_meals', 
    'recipe_favorites', 
    'shopping_lists', 
    'shopping_list_items', 
    'nutrition_analytics'
);
"@

Write-Host ""
Write-Host "⚠️  ATTENTION: Vous allez appliquer les migrations sur la base de données de production!" -ForegroundColor Yellow
Write-Host "   Base: $dbName" -ForegroundColor Yellow
Write-Host "   Host: $dbHost" -ForegroundColor Yellow
Write-Host ""
$confirmation = Read-Host "Continuer? (oui/non)"

if ($confirmation -ne "oui") {
    Write-Host "❌ Opération annulée" -ForegroundColor Red
    exit 0
}

Write-Host ""
Write-Host "🚀 Application de la migration..." -ForegroundColor Cyan

# Appliquer la migration
try {
    # Utiliser PGPASSWORD pour éviter la demande de mot de passe
    $env:PGPASSWORD = $dbPassword
    
    $result = & psql -h $dbHost -U $dbUser -d $dbName -f $migrationFile 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "✅ Migration appliquée avec succès!" -ForegroundColor Green
        Write-Host ""
        Write-Host "📊 Vérification des tables créées..." -ForegroundColor Cyan
        
        # Vérifier les tables créées
        $verifyQuery = @"
SELECT 
    '✅ ' || table_name as status
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
    'family_profiles', 
    'recipes', 
    'menu_plans', 
    'planned_meals', 
    'recipe_favorites', 
    'shopping_lists', 
    'shopping_list_items', 
    'nutrition_analytics'
)
ORDER BY table_name;
"@
        
        $tablesResult = & psql -h $dbHost -U $dbUser -d $dbName -c $verifyQuery 2>&1
        
        Write-Host $tablesResult
        
        Write-Host ""
        Write-Host "===================================" -ForegroundColor Cyan
        Write-Host "✅ Migration complétée avec succès!" -ForegroundColor Green
        Write-Host "===================================" -ForegroundColor Cyan
        
    }
    else {
        Write-Host ""
        Write-Host "❌ Erreur lors de l'application de la migration" -ForegroundColor Red
        Write-Host $result
        exit 1
    }
    
}
catch {
    Write-Host ""
    Write-Host "❌ Erreur: $_" -ForegroundColor Red
    exit 1
}
finally {
    # Nettoyer la variable d'environnement
    Remove-Item env:PGPASSWORD -ErrorAction SilentlyContinue
}

Write-Host ""
Write-Host "📝 Prochaines étapes:" -ForegroundColor Cyan
Write-Host "   1. Vérifier que les tables sont créées correctement" -ForegroundColor Gray
Write-Host "   2. Vérifier les index avec: \d+ table_name dans psql" -ForegroundColor Gray
Write-Host "   3. Tester le service menu planning via l'API" -ForegroundColor Gray
Write-Host ""

