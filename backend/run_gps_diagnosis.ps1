# Script PowerShell pour diagnostiquer le problème de recherche GPS
# Problème: 0 résultats malgré le filtrage GPS

Write-Host "🔍 DIAGNOSTIC COMPLET DU PROBLÈME DE RECHERCHE GPS" -ForegroundColor Yellow
Write-Host "=====================================================" -ForegroundColor Yellow

# 1. Vérifier que nous sommes dans le bon répertoire
if (-not (Test-Path "diagnose_gps_search_problem.sql")) {
    Write-Host "❌ ERREUR: Le fichier diagnose_gps_search_problem.sql n'existe pas!" -ForegroundColor Red
    Write-Host "   Assurez-vous d'être dans le répertoire backend" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Fichier de diagnostic trouvé" -ForegroundColor Green

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

# 5. Exécuter le diagnostic
Write-Host "`n🔍 EXÉCUTION DU DIAGNOSTIC..." -ForegroundColor Cyan
Write-Host "--------------------------------" -ForegroundColor Cyan

try {
    Write-Host "📝 Exécution du script de diagnostic..." -ForegroundColor Yellow
    
    $result = psql -h $host_db -U $user_db -d $db_name -f "diagnose_gps_search_problem.sql" 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Diagnostic exécuté avec succès!" -ForegroundColor Green
        Write-Host "📊 Résultats du diagnostic:" -ForegroundColor Cyan
        Write-Host "================================" -ForegroundColor Cyan
        Write-Host $result -ForegroundColor White
    } else {
        Write-Host "❌ Erreur lors de l'exécution du diagnostic:" -ForegroundColor Red
        Write-Host $result -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "❌ Erreur lors de l'exécution: $_" -ForegroundColor Red
    exit 1
}

# 6. Analyse des résultats
Write-Host "`n📊 ANALYSE DES RÉSULTATS..." -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan

# Extraire les informations clés des résultats
$diagnostic_output = $result -join "`n"

# Vérifier si la fonction existe
if ($diagnostic_output -match "✅ FONCTION EXISTE") {
    Write-Host "✅ La fonction search_services_gps_final existe" -ForegroundColor Green
} else {
    Write-Host "❌ La fonction search_services_gps_final est manquante!" -ForegroundColor Red
    Write-Host "   Il faut d'abord appliquer le script integrate_final_gps_search.sql" -ForegroundColor Yellow
}

# Vérifier les données GPS
if ($diagnostic_output -match "services_with_gps_fixe.*(\d+)") {
    $gps_fixe_count = $matches[1]
    Write-Host "📍 Services avec GPS fixe: $gps_fixe_count" -ForegroundColor Cyan
}

if ($diagnostic_output -match "users_with_gps.*(\d+)") {
    $users_gps_count = $matches[1]
    Write-Host "👥 Utilisateurs avec GPS: $users_gps_count" -ForegroundColor Cyan
}

# Vérifier les résultats de recherche
if ($diagnostic_output -match "total_results.*(\d+)") {
    $search_results = $matches[1]
    Write-Host "🔍 Résultats de recherche: $search_results" -ForegroundColor Cyan
    
    if ($search_results -eq "0") {
        Write-Host "❌ PROBLÈME CONFIRMÉ: 0 résultats de recherche!" -ForegroundColor Red
    } else {
        Write-Host "✅ Recherche fonctionne: $search_results résultats trouvés" -ForegroundColor Green
    }
}

# 7. Nettoyage
$env:PGPASSWORD = ""

# 8. Recommandations
Write-Host "`n💡 RECOMMANDATIONS:" -ForegroundColor Cyan
Write-Host "===================" -ForegroundColor Cyan

if ($diagnostic_output -match "❌ FONCTION MANQUANTE") {
    Write-Host "1. 🔧 Appliquer d'abord le script integrate_final_gps_search.sql" -ForegroundColor Yellow
    Write-Host "2. 🔍 Relancer ce diagnostic" -ForegroundColor Yellow
} else {
    Write-Host "1. 🔍 Analyser les résultats ci-dessus pour identifier le problème" -ForegroundColor Yellow
    Write-Host "2. 🧪 Vérifier que les fonctions GPS fonctionnent correctement" -ForegroundColor Yellow
    Write-Host "3. 📊 Vérifier que les données GPS sont bien formatées" -ForegroundColor Yellow
}

Write-Host "`n🚀 Diagnostic terminé! Analysez les résultats ci-dessus." -ForegroundColor Green 