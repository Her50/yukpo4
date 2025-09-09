# Script direct pour appliquer les corrections SQL
Write-Host "Application directe des corrections SQL..." -ForegroundColor Yellow

# Parametres de connexion
$host_db = "localhost"
$user_db = "postgres"
$db_name = "yukpo_db"

Write-Host "Connexion a $host_db avec utilisateur $user_db sur base $db_name" -ForegroundColor Cyan

# 1. CORRECTION GPS - Appliquer directement le script SQL
Write-Host "Etape 1: Application de la correction GPS..." -ForegroundColor Yellow

try {
    Write-Host "Lecture du fichier final_gps_integration.sql..." -ForegroundColor Cyan
    $gps_sql = Get-Content "final_gps_integration.sql" -Raw
    
    if ($gps_sql) {
        Write-Host "Fichier GPS lu avec succes (${gps_sql.Length} caracteres)" -ForegroundColor Green
        Write-Host "Contenu du fichier:" -ForegroundColor Cyan
        Write-Host $gps_sql -ForegroundColor White
    } else {
        Write-Host "ERREUR: Fichier final_gps_integration.sql vide ou introuvable!" -ForegroundColor Red
    }
} catch {
    Write-Host "Erreur lecture fichier GPS: $_" -ForegroundColor Red
}

# 2. CORRECTION DES IMAGES - Lire le fichier SQL
Write-Host "Etape 2: Lecture du fichier de correction des images..." -ForegroundColor Yellow

try {
    Write-Host "Lecture du fichier fix_image_search_complete.sql..." -ForegroundColor Cyan
    $image_sql = Get-Content "fix_image_search_complete.sql" -Raw
    
    if ($image_sql) {
        Write-Host "Fichier Images lu avec succes (${image_sql.Length} caracteres)" -ForegroundColor Green
        Write-Host "Premieres lignes du fichier:" -ForegroundColor Cyan
        Write-Host ($image_sql -split "`n" | Select-Object -First 10) -ForegroundColor White
    } else {
        Write-Host "ERREUR: Fichier fix_image_search_complete.sql vide ou introuvable!" -ForegroundColor Red
    }
} catch {
    Write-Host "Erreur lecture fichier Images: $_" -ForegroundColor Red
}

# 3. INSTRUCTIONS POUR L'APPLICATION MANUELLE
Write-Host "Etape 3: Instructions pour application manuelle..." -ForegroundColor Yellow
Write-Host "=================================================" -ForegroundColor Yellow

Write-Host "Pour appliquer ces corrections, vous devez:" -ForegroundColor Cyan
Write-Host "1. Vous connecter a PostgreSQL avec votre mot de passe" -ForegroundColor White
Write-Host "2. Executer le script GPS:" -ForegroundColor White
Write-Host "   psql -h localhost -U postgres -d yukpo_db -f final_gps_integration.sql" -ForegroundColor Yellow
Write-Host "3. Executer le script Images:" -ForegroundColor White
Write-Host "   psql -h localhost -U postgres -d yukpo_db -f fix_image_search_complete.sql" -ForegroundColor Yellow

Write-Host "`nOu utiliser le script interactif:" -ForegroundColor Cyan
Write-Host "   .\apply_fixes_direct.ps1" -ForegroundColor Yellow

Write-Host "`nResume des corrections a appliquer:" -ForegroundColor Green
Write-Host "- GPS: Fonction search_services_gps_final avec fallback automatique" -ForegroundColor White
Write-Host "- Images: Colonnes image_signature, image_hash, image_metadata + fonctions" -ForegroundColor White
Write-Host "- Performance: Optimisations avec CROSS JOIN LATERAL" -ForegroundColor White 