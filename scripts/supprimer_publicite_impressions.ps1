# Script PowerShell pour supprimer la table publicite_impressions
# Usage: .\scripts\supprimer_publicite_impressions.ps1

Write-Host "=== Suppression de la table publicite_impressions ===" -ForegroundColor Cyan
Write-Host ""

# Informations de connexion
$host = "34.79.199.41"
$port = "5432"
$database = "yukpo_db"
$user = "yukpo_user"
$password = "TempPassword123!"

# Vérifier si psql est installé
$psqlPath = Get-Command psql -ErrorAction SilentlyContinue
if (-not $psqlPath) {
    Write-Host "[ERREUR] psql n'est pas installé ou n'est pas dans le PATH" -ForegroundColor Red
    Write-Host "Installez PostgreSQL ou ajoutez psql au PATH" -ForegroundColor Yellow
    Write-Host "Ou utilisez pgAdmin/DBeaver avec les instructions dans SUPPRESSION_MANUELLE_PUBLICITE_IMPRESSIONS.md" -ForegroundColor Yellow
    exit 1
}

# Définir le mot de passe
$env:PGPASSWORD = $password

Write-Host "[INFO] Connexion à la base de données..." -ForegroundColor Cyan
Write-Host "Host: $host" -ForegroundColor Gray
Write-Host "Database: $database" -ForegroundColor Gray
Write-Host "User: $user" -ForegroundColor Gray
Write-Host ""

# Script SQL de suppression
$sqlScript = @"
-- Vérifier que la table existe
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'publicite_impressions'
        ) 
        THEN 'La table existe'
        ELSE 'La table n''existe pas'
    END AS status;

-- Supprimer toutes les fonctions liées
DROP FUNCTION IF EXISTS check_publicite_frequency(INTEGER, INTEGER, VARCHAR) CASCADE;
DROP FUNCTION IF EXISTS record_publicite_impression(INTEGER, INTEGER, VARCHAR) CASCADE;
DROP FUNCTION IF EXISTS check_publicite_frequency(INTEGER, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS record_publicite_impression(INTEGER, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS check_publicite_frequency CASCADE;
DROP FUNCTION IF EXISTS record_publicite_impression CASCADE;

-- Supprimer tous les index
DROP INDEX IF EXISTS idx_publicite_impressions_publicite_user CASCADE;
DROP INDEX IF EXISTS idx_publicite_impressions_user_date CASCADE;
DROP INDEX IF EXISTS idx_publicite_impressions_publicite_date CASCADE;
DROP INDEX IF EXISTS idx_publicite_impressions_placement CASCADE;
DROP INDEX IF EXISTS idx_publicite_impressions_user_publicite_date CASCADE;

-- Supprimer la table
DROP TABLE IF EXISTS publicite_impressions CASCADE;

-- Vérification finale
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'publicite_impressions'
        ) 
        THEN 'ERREUR: La table existe encore'
        ELSE 'SUCCESS: La table a été supprimée'
    END AS resultat;
"@

# Exécuter le script
Write-Host "[INFO] Exécution du script de suppression..." -ForegroundColor Cyan
Write-Host ""

try {
    $connectionString = "postgresql://${user}:${password}@${host}:${port}/${database}?sslmode=require"
    $result = $sqlScript | psql $connectionString 2>&1
    
    Write-Host $result
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "[SUCCESS] Script exécuté avec succès!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Vous pouvez maintenant relancer les migrations:" -ForegroundColor Cyan
        Write-Host "  cd backend" -ForegroundColor Gray
        Write-Host "  `$env:DATABASE_URL = `"postgresql://yukpo_user:TempPassword123!@34.79.199.41:5432/yukpo_db?sslmode=require`"" -ForegroundColor Gray
        Write-Host "  cargo sqlx migrate run" -ForegroundColor Gray
    } else {
        Write-Host ""
        Write-Host "[ERREUR] Le script a échoué (code: $LASTEXITCODE)" -ForegroundColor Red
    }
} catch {
    Write-Host ""
    Write-Host "[ERREUR] Erreur lors de l'exécution: $_" -ForegroundColor Red
} finally {
    # Nettoyer le mot de passe de l'environnement
    Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
}

Write-Host ""


