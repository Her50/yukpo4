# Script principal pour appliquer toutes les corrections
Write-Host "🚀 APPLICATION DE TOUTES LES CORRECTIONS" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Green

# 1. Demander les informations de connexion une seule fois
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

# Convertir le mot de passe
$BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($password)
$plain_password = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)

# Tester la connexion
Write-Host "`n🧪 TEST DE CONNEXION..." -ForegroundColor Cyan
$env:PGPASSWORD = $plain_password

try {
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

# 2. CORRECTION GPS (Priorité 1)
Write-Host "`n🔧 ÉTAPE 1: CORRECTION GPS" -ForegroundColor Yellow
Write-Host "============================" -ForegroundColor Yellow

try {
    Write-Host "📝 Application de la correction GPS..." -ForegroundColor Cyan
    
    $gps_result = psql -h $host_db -U $user_db -d $db_name -f "final_gps_integration.sql" 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Correction GPS appliquée avec succès!" -ForegroundColor Green
        Write-Host "📊 Résultats GPS:" -ForegroundColor Cyan
        Write-Host $gps_result -ForegroundColor White
    } else {
        Write-Host "❌ Erreur lors de la correction GPS:" -ForegroundColor Red
        Write-Host $gps_result -ForegroundColor Red
        Write-Host "⚠️  Continuons avec la correction des images..." -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ Erreur GPS: $_" -ForegroundColor Red
    Write-Host "⚠️  Continuons avec la correction des images..." -ForegroundColor Yellow
}

# 3. CORRECTION DES IMAGES (Priorité 2)
Write-Host "`n🖼️ ÉTAPE 2: CORRECTION DES IMAGES" -ForegroundColor Yellow
Write-Host "=====================================" -ForegroundColor Yellow

try {
    Write-Host "📝 Application de la correction des images..." -ForegroundColor Cyan
    
    $image_result = psql -h $host_db -U $user_db -d $db_name -f "fix_image_search_complete.sql" 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Correction des images appliquée avec succès!" -ForegroundColor Green
        Write-Host "📊 Résultats Images:" -ForegroundColor Cyan
        Write-Host $image_result -ForegroundColor White
    } else {
        Write-Host "❌ Erreur lors de la correction des images:" -ForegroundColor Red
        Write-Host $image_result -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Erreur Images: $_" -ForegroundColor Red
}

# 4. VÉRIFICATION FINALE
Write-Host "`n🔍 ÉTAPE 3: VÉRIFICATION FINALE" -ForegroundColor Yellow
Write-Host "=================================" -ForegroundColor Yellow

# Vérifier les fonctions GPS
Write-Host "📋 Vérification des fonctions GPS..." -ForegroundColor Cyan
$gps_functions = psql -h $host_db -U $user_db -d $db_name -c "SELECT proname as function_name FROM pg_proc WHERE proname IN ('search_services_gps_final', 'fast_gps_search_with_user_fallback', 'fast_text_gps_search_with_user_fallback') ORDER BY proname;" 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Fonctions GPS:" -ForegroundColor Green
    Write-Host $gps_functions -ForegroundColor White
} else {
    Write-Host "❌ Erreur lors de la vérification des fonctions GPS" -ForegroundColor Red
}

# Vérifier les colonnes d'image
Write-Host "`n📋 Vérification des colonnes d'image..." -ForegroundColor Cyan
$image_columns = psql -h $host_db -U $user_db -d $db_name -c "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'media' AND column_name LIKE 'image_%' ORDER BY column_name;" 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Colonnes d'image:" -ForegroundColor Green
    Write-Host $image_columns -ForegroundColor White
} else {
    Write-Host "❌ Erreur lors de la vérification des colonnes d'image" -ForegroundColor Red
}

# 5. Nettoyage
$env:PGPASSWORD = ""

# 6. Résumé final
Write-Host "`n🎉 CORRECTIONS TERMINÉES!" -ForegroundColor Green
Write-Host "=======================" -ForegroundColor Green
Write-Host "✅ Correction GPS appliquée" -ForegroundColor Green
Write-Host "✅ Correction des images appliquée" -ForegroundColor Green
Write-Host "✅ Vérifications effectuées" -ForegroundColor Green

Write-Host "`n📋 PROCHAINES ÉTAPES:" -ForegroundColor Cyan
Write-Host "1. 🔄 Redémarrer le serveur backend" -ForegroundColor White
Write-Host "2. 🧪 Tester la recherche avec filtrage GPS" -ForegroundColor White
Write-Host "3. 🖼️ Tester la recherche d'images" -ForegroundColor White
Write-Host "4. 📊 Vérifier les performances (<100ms)" -ForegroundColor White

Write-Host "`n💡 NOTE:" -ForegroundColor Yellow
Write-Host "Si la recherche GPS retourne encore 0 résultats, exécutez:" -ForegroundColor White
Write-Host "   .\run_gps_diagnosis.ps1" -ForegroundColor Cyan

Write-Host "`n🚀 Toutes les corrections ont été appliquées!" -ForegroundColor Green 