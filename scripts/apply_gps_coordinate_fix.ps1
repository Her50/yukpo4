# Script d'application de la correction des coordonnées GPS
# ======================================================

Write-Host "🔧 Application de la correction des coordonnées GPS" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

# Vérifier si psql est disponible
try {
    $psqlVersion = psql --version 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ PostgreSQL client trouvé: $psqlVersion" -ForegroundColor Green
    } else {
        throw "psql non trouvé"
    }
} catch {
    Write-Host "❌ Erreur: psql non trouvé. Vérifiez que PostgreSQL est installé et dans le PATH." -ForegroundColor Red
    exit 1
}

# Configuration de la base de données
$DB_NAME = "yukpo_db"
$DB_HOST = "localhost"
$DB_PORT = "5432"
$DB_USER = "postgres"

Write-Host "📊 Connexion à la base de données: $DB_NAME sur $DB_HOST:$DB_PORT" -ForegroundColor Yellow

# Demander le mot de passe si nécessaire
$DB_PASSWORD = Read-Host "Mot de passe PostgreSQL (laissez vide si pas de mot de passe)" -AsSecureString
if ($DB_PASSWORD.Length -gt 0) {
    $env:PGPASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($DB_PASSWORD))
}

# Test de connexion
Write-Host "🔌 Test de connexion..." -ForegroundColor Yellow
$testConnection = psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "SELECT 'Connexion réussie' as status;" 2>$null

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Connexion à la base de données réussie" -ForegroundColor Green
} else {
    Write-Host "❌ Erreur de connexion à la base de données" -ForegroundColor Red
    Write-Host "Vérifiez que:" -ForegroundColor Yellow
    Write-Host "  - PostgreSQL est démarré" -ForegroundColor Yellow
    Write-Host "  - Les paramètres de connexion sont corrects" -ForegroundColor Yellow
    Write-Host "  - L'utilisateur a les droits d'accès" -ForegroundColor Yellow
    exit 1
}

# Appliquer la correction
Write-Host "🚀 Application de la correction des coordonnées GPS..." -ForegroundColor Cyan

$fixScript = "backend/fix_gps_coordinate_order.sql"
if (Test-Path $fixScript) {
    Write-Host "📝 Application du script: $fixScript" -ForegroundColor Yellow
    
    $result = psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f $fixScript 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Correction appliquée avec succès" -ForegroundColor Green
        Write-Host "📊 Résultats des tests:" -ForegroundColor Cyan
        Write-Host $result -ForegroundColor White
    } else {
        Write-Host "❌ Erreur lors de l'application de la correction" -ForegroundColor Red
        Write-Host "Détails de l'erreur:" -ForegroundColor Yellow
        Write-Host $result -ForegroundColor Red
    }
} else {
    Write-Host "❌ Fichier de correction non trouvé: $fixScript" -ForegroundColor Red
}

# Tester la correction
Write-Host "🧪 Test de la correction..." -ForegroundColor Cyan

$testResult = psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "
SELECT '=== TEST FINAL ===' as test_type;
SELECT 
    'Douala inversé corrigé' as test,
    fix_gps_coordinate_order('9.767869,4.051056') as resultat,
    '4.051056,9.767869' as attendu;
SELECT 
    'Yaoundé inversé corrigé' as test,
    fix_gps_coordinate_order('11.502075,3.848033') as resultat,
    '3.848033,11.502075' as attendu;
" 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Test de la correction réussi" -ForegroundColor Green
    Write-Host "📊 Résultats du test:" -ForegroundColor Cyan
    Write-Host $testResult -ForegroundColor White
} else {
    Write-Host "❌ Erreur lors du test de la correction" -ForegroundColor Red
    Write-Host "Détails de l'erreur:" -ForegroundColor Yellow
    Write-Host $testResult -ForegroundColor Red
}

# Nettoyer le mot de passe
if ($env:PGPASSWORD) {
    Remove-Item Env:PGPASSWORD
}

Write-Host "🏁 Correction terminée" -ForegroundColor Cyan
Write-Host "💡 Les coordonnées GPS sont maintenant automatiquement corrigées" -ForegroundColor Green
Write-Host "🌍 Les services devraient maintenant afficher la bonne localisation" -ForegroundColor Green 
 