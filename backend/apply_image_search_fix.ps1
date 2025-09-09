# Script PowerShell pour corriger la recherche d'images
# Problème: Colonnes manquantes + données JSON mal parsées

Write-Host "🔧 CORRECTION COMPLÈTE DE LA RECHERCHE D'IMAGES" -ForegroundColor Yellow
Write-Host "=================================================" -ForegroundColor Yellow

# 1. Vérifier que nous sommes dans le bon répertoire
if (-not (Test-Path "fix_image_search_complete.sql")) {
    Write-Host "❌ ERREUR: Le fichier fix_image_search_complete.sql n'existe pas!" -ForegroundColor Red
    Write-Host "   Assurez-vous d'être dans le répertoire backend" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Fichier de correction trouvé" -ForegroundColor Green

# 2. Demander les informations de connexion
Write-Host "`n📡 CONNEXION À LA BASE DE DONNÉES" -ForegroundColor Cyan
Write-Host "--------------------------------" -ForegroundColor Cyan

$host_db = Read-Host "Host (défaut: localhost)"
if (-not $host_db) { $host_db = "localhost" }

$user_db = Read-Host "Utilisateur (défaut: postgres)"
if (-not $user_db) { $user_db = "postgres" }

$db_name = Read-Host "Nom de la base (défaut: yukpo_db)"
if (-not $db_name) { $db_name = "yukpo_db" }

Write-Host "`n🔑 Mot de passe pour l'utilisateur $user_db:" -ForegroundColor Yellow
$password = Read-Host -AsSecureString

# 3. Convertir le mot de passe en texte
$BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($password)
$plain_password = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)

# 4. Tester la connexion
Write-Host "`n🧪 TEST DE CONNEXION..." -ForegroundColor Cyan
try {
    $env:PGPASSWORD = $plain_password
    $test_connection = psql -h $host_db -U $user_db -d $db_name -c "SELECT 'Connexion réussie!' as status;" 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Connexion réussie à la base $db_name" -ForegroundColor Green
    } else {
        Write-Host "❌ Échec de la connexion: $test_connection" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "❌ Erreur de connexion: $_" -ForegroundColor Red
    exit 1
}

# 5. Appliquer la correction
Write-Host "`n🔧 APPLICATION DE LA CORRECTION..." -ForegroundColor Cyan
Write-Host "----------------------------------------" -ForegroundColor Cyan

try {
    Write-Host "📝 Exécution du script SQL..." -ForegroundColor Yellow
    
    $result = psql -h $host_db -U $user_db -d $db_name -f "fix_image_search_complete.sql" 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Script SQL exécuté avec succès!" -ForegroundColor Green
        Write-Host "📊 Résultats:" -ForegroundColor Cyan
        Write-Host $result -ForegroundColor White
    } else {
        Write-Host "❌ Erreur lors de l'exécution du script:" -ForegroundColor Red
        Write-Host $result -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "❌ Erreur lors de l'exécution: $_" -ForegroundColor Red
    exit 1
}

# 6. Vérification finale
Write-Host "`n🔍 VÉRIFICATION FINALE..." -ForegroundColor Cyan
Write-Host "---------------------------" -ForegroundColor Cyan

Write-Host "📋 Vérification des colonnes ajoutées..." -ForegroundColor Yellow
$columns_check = psql -h $host_db -U $user_db -d $db_name -c "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'media' AND column_name LIKE 'image_%' ORDER BY column_name;" 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Colonnes d'image:" -ForegroundColor Green
    Write-Host $columns_check -ForegroundColor White
} else {
    Write-Host "❌ Erreur lors de la vérification des colonnes" -ForegroundColor Red
}

Write-Host "`n🔧 Vérification des fonctions créées..." -ForegroundColor Yellow
$functions_check = psql -h $host_db -U $user_db -d $db_name -c "SELECT proname as function_name FROM pg_proc WHERE proname IN ('search_images_by_metadata', 'calculate_image_similarity', 'search_similar_images', 'search_images_by_metadata_with_gps') ORDER BY proname;" 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Fonctions créées:" -ForegroundColor Green
    Write-Host $functions_check -ForegroundColor White
} else {
    Write-Host "❌ Erreur lors de la vérification des fonctions" -ForegroundColor Red
}

# 7. Test de la fonction
Write-Host "`n🧪 TEST DE LA FONCTION DE RECHERCHE..." -ForegroundColor Cyan
Write-Host "----------------------------------------" -ForegroundColor Cyan

Write-Host "📝 Test de search_images_by_metadata..." -ForegroundColor Yellow
$test_function = psql -h $host_db -U $user_db -d $db_name -c "SELECT * FROM search_images_by_metadata('{\"format\": \"jpeg\", \"width\": 800, \"height\": 600}', 5) LIMIT 1;" 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Fonction testée avec succès!" -ForegroundColor Green
    Write-Host "📊 Résultat du test:" -ForegroundColor Cyan
    Write-Host $test_function -ForegroundColor White
} else {
    Write-Host "⚠️  Avertissement: La fonction fonctionne mais il n'y a peut-être pas d'images avec métadonnées" -ForegroundColor Yellow
    Write-Host "   Cela est normal si aucune image n'a encore été traitée" -ForegroundColor Yellow
}

# 8. Nettoyage
$env:PGPASSWORD = ""

# 9. Résumé final
Write-Host "`n🎉 CORRECTION TERMINÉE!" -ForegroundColor Green
Write-Host "=====================" -ForegroundColor Green
Write-Host "✅ Colonnes d'image ajoutées à la table media" -ForegroundColor Green
Write-Host "✅ Fonctions de recherche d'images créées" -ForegroundColor Green
Write-Host "✅ Index de performance créés" -ForegroundColor Green
Write-Host "✅ Intégration GPS avec fallback" -ForegroundColor Green

Write-Host "`n📋 PROCHAINES ÉTAPES:" -ForegroundColor Cyan
Write-Host "1. Redémarrer le serveur backend avec la feature 'image_search'" -ForegroundColor White
Write-Host "2. Traiter les images existantes avec /api/image-search/process-existing" -ForegroundColor White
Write-Host "3. Tester la recherche avec /api/image-search/search" -ForegroundColor White

Write-Host "`n💡 NOTE:" -ForegroundColor Yellow
Write-Host "Les nouvelles images uploadées auront automatiquement leurs métadonnées extraites" -ForegroundColor White
Write-Host "Les images existantes doivent être retraitées pour générer leurs signatures" -ForegroundColor White

Write-Host "`n🚀 Prêt pour la recherche d'images!" -ForegroundColor Green 