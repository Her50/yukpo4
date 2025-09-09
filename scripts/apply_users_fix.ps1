# Script de correction de la table users
# Ce script applique les corrections nécessaires pour résoudre l'erreur 500

Write-Host "🔧 Correction de la table users" -ForegroundColor Cyan
Write-Host "===============================" -ForegroundColor Cyan

# Configuration
$baseUrl = "http://localhost:3001"
$dbHost = "localhost"
$dbPort = "5432"
$dbName = "yukpo"  # Ajustez selon votre configuration
$dbUser = "postgres"  # Ajustez selon votre configuration

Write-Host "`n1. Vérification de la santé du serveur..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$baseUrl/healthz" -Method Get -TimeoutSec 5
    Write-Host "   ✅ Serveur en ligne: $response" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Serveur inaccessible: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "   Vérifiez que le serveur backend est en cours d'exécution sur le port 3001" -ForegroundColor Yellow
    exit 1
}

Write-Host "`n2. Test de l'API d'authentification avant correction..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$baseUrl/api/user/me" -Method Get -Headers @{"Authorization" = "Bearer test_token"} -TimeoutSec 10
    Write-Host "   ❌ Erreur: l'API a accepté un token invalide" -ForegroundColor Red
} catch {
    if ($_.Exception.Response.StatusCode -eq 401) {
        Write-Host "   ✅ API d'authentification fonctionne (rejette les tokens invalides)" -ForegroundColor Green
    } else {
        Write-Host "   ❌ Erreur inattendue: $($_.Exception.Response.StatusCode) - $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host "`n3. Application des corrections de la base de données..." -ForegroundColor Yellow

# Demander les informations de connexion à la base de données
Write-Host "   ℹ️  Configuration de la base de données:" -ForegroundColor Blue
$dbHost = Read-Host "   Host (défaut: localhost)" 
if ([string]::IsNullOrEmpty($dbHost)) { $dbHost = "localhost" }

$dbPort = Read-Host "   Port (défaut: 5432)"
if ([string]::IsNullOrEmpty($dbPort)) { $dbPort = "5432" }

$dbName = Read-Host "   Nom de la base (défaut: yukpo)"
if ([string]::IsNullOrEmpty($dbName)) { $dbName = "yukpo" }

$dbUser = Read-Host "   Utilisateur (défaut: postgres)"
if ([string]::IsNullOrEmpty($dbUser)) { $dbUser = "postgres" }

$dbPassword = Read-Host "   Mot de passe" -AsSecureString
$dbPasswordPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($dbPassword))

Write-Host "`n   🔍 Connexion à la base de données..." -ForegroundColor Yellow

# Construire la chaîne de connexion
$connectionString = "Host=$dbHost;Port=$dbPort;Database=$dbName;Username=$dbUser;Password=$dbPasswordPlain"

try {
    # Vérifier la connexion avec psql
    $testConnection = "psql -h $dbHost -p $dbPort -U $dbUser -d $dbName -c 'SELECT 1;'"
    $env:PGPASSWORD = $dbPasswordPlain
    
    $result = Invoke-Expression $testConnection 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ Connexion à la base de données réussie" -ForegroundColor Green
    } else {
        Write-Host "   ❌ Échec de la connexion à la base de données" -ForegroundColor Red
        Write-Host "   Erreur: $result" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "   ❌ Erreur lors de la connexion: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host "`n   🔧 Application du script de correction..." -ForegroundColor Yellow

# Exécuter le script de correction
try {
    $sqlFile = "scripts/fix_users_table.sql"
    if (Test-Path $sqlFile) {
        $fixCommand = "psql -h $dbHost -p $dbPort -U $dbUser -d $dbName -f $sqlFile"
        $fixResult = Invoke-Expression $fixCommand 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "   ✅ Script de correction appliqué avec succès" -ForegroundColor Green
        } else {
            Write-Host "   ❌ Erreur lors de l'application du script" -ForegroundColor Red
            Write-Host "   Erreur: $fixResult" -ForegroundColor Red
        }
    } else {
        Write-Host "   ❌ Fichier de correction introuvable: $sqlFile" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "   ❌ Erreur lors de l'exécution du script: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host "`n4. Test de l'API d'authentification après correction..." -ForegroundColor Yellow

# Attendre un peu que les changements prennent effet
Start-Sleep -Seconds 3

try {
    $response = Invoke-RestMethod -Uri "$baseUrl/api/user/me" -Method Get -Headers @{"Authorization" = "Bearer test_token"} -TimeoutSec 10
    Write-Host "   ❌ Erreur: l'API a accepté un token invalide" -ForegroundColor Red
} catch {
    if ($_.Exception.Response.StatusCode -eq 401) {
        Write-Host "   ✅ API d'authentification fonctionne toujours (rejette les tokens invalides)" -ForegroundColor Green
    } else {
        Write-Host "   ❌ Erreur inattendue: $($_.Exception.Response.StatusCode) - $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host "`n5. Test avec un token valide..." -ForegroundColor Yellow
Write-Host "   ℹ️  Pour tester avec un vrai token, copiez-le depuis le localStorage du navigateur" -ForegroundColor Blue
Write-Host "   ℹ️  Ouvrez la console du navigateur et tapez: localStorage.getItem('token')" -ForegroundColor Blue

$testToken = Read-Host "   🔑 Collez votre token JWT ici (ou appuyez sur Entrée pour ignorer)"

if ($testToken -and $testToken -ne "") {
    Write-Host "   🧪 Test avec le token fourni..." -ForegroundColor Yellow
    
    try {
        $response = Invoke-RestMethod -Uri "$baseUrl/api/user/me" -Method Get -Headers @{"Authorization" = "Bearer $testToken"} -TimeoutSec 10
        Write-Host "   ✅ SUCCÈS ! API d'authentification fonctionne maintenant" -ForegroundColor Green
        Write-Host "   📊 Données utilisateur: $($response | ConvertTo-Json -Depth 2)" -ForegroundColor Gray
        
        Write-Host "`n🎉 PROBLÈME RÉSOLU !" -ForegroundColor Green
        Write-Host "L'API /api/user/me fonctionne maintenant correctement." -ForegroundColor White
        
    } catch {
        if ($_.Exception.Response.StatusCode -eq 500) {
            Write-Host "   ❌ Erreur 500 persistante - Problème non résolu" -ForegroundColor Red
            Write-Host "   🔍 Vérifiez les logs du serveur backend pour plus de détails" -ForegroundColor Yellow
        } else {
            Write-Host "   ❌ Erreur inattendue: $($_.Exception.Response.StatusCode) - $($_.Exception.Message)" -ForegroundColor Red
        }
    }
} else {
    Write-Host "   ⏭️  Test ignoré - pas de token fourni" -ForegroundColor Yellow
}

Write-Host "`n🔍 === CORRECTION TERMINÉE ===" -ForegroundColor Cyan
Write-Host "`n📋 RÉSUMÉ DES ACTIONS EFFECTUÉES:" -ForegroundColor Yellow
Write-Host "1. ✅ Vérification de la santé du serveur" -ForegroundColor Green
Write-Host "2. ✅ Test de l'API avant correction" -ForegroundColor Green
Write-Host "3. ✅ Application des corrections de la base de données" -ForegroundColor Green
Write-Host "4. ✅ Test de l'API après correction" -ForegroundColor Green

Write-Host "`n💡 PROCHAINES ÉTAPES:" -ForegroundColor Yellow
Write-Host "1. Testez l'application dans le navigateur" -ForegroundColor White
Write-Host "2. Vérifiez que l'API /api/user/me fonctionne" -ForegroundColor White
Write-Host "3. Testez la récupération des services" -ForegroundColor White
Write-Host "4. Si tout fonctionne, passez à la réactivation des WebSockets" -ForegroundColor White

Write-Host "`n🚀 POUR RÉACTIVER LES WEBSOCKETS:" -ForegroundColor Yellow
Write-Host "1. Modifiez CURRENT_PHASE = 'phase2' dans websocket-progressive.ts" -ForegroundColor White
Write-Host "2. Décommentez les routes WebSocket dans backend/src/lib.rs" -ForegroundColor White
Write-Host "3. Testez progressivement chaque composant WebSocket" -ForegroundColor White

# Nettoyer le mot de passe de la mémoire
$dbPasswordPlain = $null
$env:PGPASSWORD = $null 