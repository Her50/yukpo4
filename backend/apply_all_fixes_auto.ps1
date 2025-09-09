# Script automatique pour appliquer toutes les corrections
Write-Host "Application automatique des corrections..." -ForegroundColor Yellow

# Parametres de connexion
$host_db = "localhost"
$user_db = "postgres"
$db_name = "yukpo_db"

Write-Host "Connexion a $host_db avec utilisateur $user_db sur base $db_name" -ForegroundColor Cyan

# Demander le mot de passe une seule fois
Write-Host "Mot de passe PostgreSQL:" -ForegroundColor Yellow
$password = Read-Host

# Definir la variable d'environnement
$env:PGPASSWORD = $password

# Tester la connexion
Write-Host "Test de connexion..." -ForegroundColor Cyan

try {
    $test_connection = psql -h $host_db -U $user_db -d $db_name -c "SELECT 'Connexion reussie!' as status;" 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Connexion reussie a la base $db_name" -ForegroundColor Green
    } else {
        Write-Host "Echec de la connexion: $test_connection" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "Erreur de connexion: $_" -ForegroundColor Red
    exit 1
}

# 1. CORRECTION GPS
Write-Host "Etape 1: Correction GPS..." -ForegroundColor Yellow

try {
    Write-Host "Application de la correction GPS..." -ForegroundColor Cyan
    
    $gps_result = psql -h $host_db -U $user_db -d $db_name -f "final_gps_integration_fixed.sql" 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Correction GPS appliquee avec succes!" -ForegroundColor Green
        Write-Host "Resultats GPS:" -ForegroundColor Cyan
        Write-Host $gps_result -ForegroundColor White
    } else {
        Write-Host "Erreur lors de la correction GPS:" -ForegroundColor Red
        Write-Host $gps_result -ForegroundColor Red
    }
} catch {
    Write-Host "Erreur GPS: $_" -ForegroundColor Red
}

# 2. CORRECTION DES IMAGES
Write-Host "Etape 2: Correction des images..." -ForegroundColor Yellow

try {
    Write-Host "Application de la correction des images..." -ForegroundColor Cyan
    
    $image_result = psql -h $host_db -U $user_db -d $db_name -f "fix_image_search_complete.sql" 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Correction des images appliquee avec succes!" -ForegroundColor Green
        Write-Host "Resultats Images:" -ForegroundColor Cyan
        Write-Host $image_result -ForegroundColor White
    } else {
        Write-Host "Erreur lors de la correction des images:" -ForegroundColor Red
        Write-Host $image_result -ForegroundColor Red
    }
} catch {
    Write-Host "Erreur Images: $_" -ForegroundColor Red
}

# 3. VERIFICATION FINALE
Write-Host "Etape 3: Verification finale..." -ForegroundColor Yellow

# Verifier les fonctions GPS
Write-Host "Verification des fonctions GPS..." -ForegroundColor Cyan
$gps_functions = psql -h $host_db -U $user_db -d $db_name -c "SELECT proname as function_name FROM pg_proc WHERE proname IN ('search_services_gps_final', 'fast_gps_search_with_user_fallback', 'fast_text_gps_search_with_user_fallback') ORDER BY proname;" 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "Fonctions GPS:" -ForegroundColor Green
    Write-Host $gps_functions -ForegroundColor White
} else {
    Write-Host "Erreur lors de la verification des fonctions GPS" -ForegroundColor Red
}

# Verifier les colonnes d'image
Write-Host "Verification des colonnes d'image..." -ForegroundColor Cyan
$image_columns = psql -h $host_db -U $user_db -d $db_name -c "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'media' AND column_name LIKE 'image_%' ORDER BY column_name;" 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "Colonnes d'image:" -ForegroundColor Green
    Write-Host $image_columns -ForegroundColor White
} else {
    Write-Host "Erreur lors de la verification des colonnes d'image" -ForegroundColor Red
}

# Nettoyage
$env:PGPASSWORD = ""

# Resume final
Write-Host "Corrections terminees!" -ForegroundColor Green
Write-Host "Prochaines etapes:" -ForegroundColor Cyan
Write-Host "1. Redemarrer le serveur backend" -ForegroundColor White
Write-Host "2. Tester la recherche avec filtrage GPS" -ForegroundColor White
Write-Host "3. Tester la recherche d'images" -ForegroundColor White

Write-Host "`nToutes les corrections ont ete appliquees!" -ForegroundColor Green 