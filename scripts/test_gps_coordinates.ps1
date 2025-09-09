# Script de test des coordonnées GPS
# ===================================

Write-Host "🔍 Test des coordonnées GPS dans la base de données" -ForegroundColor Cyan
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

# Exécuter le script de test
Write-Host "🚀 Exécution du test des coordonnées GPS..." -ForegroundColor Cyan

$testScript = "backend/test_gps_coordinates.sql"
if (Test-Path $testScript) {
    Write-Host "📝 Exécution du script: $testScript" -ForegroundColor Yellow
    
    $result = psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f $testScript 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Test exécuté avec succès" -ForegroundColor Green
        Write-Host "📊 Résultats:" -ForegroundColor Cyan
        Write-Host $result -ForegroundColor White
    } else {
        Write-Host "❌ Erreur lors de l'exécution du test" -ForegroundColor Red
        Write-Host "Détails de l'erreur:" -ForegroundColor Yellow
        Write-Host $result -ForegroundColor Red
    }
} else {
    Write-Host "❌ Fichier de test non trouvé: $testScript" -ForegroundColor Red
}

# Nettoyer le mot de passe
if ($env:PGPASSWORD) {
    Remove-Item Env:PGPASSWORD
}

Write-Host "🏁 Test terminé" -ForegroundColor Cyan 
 