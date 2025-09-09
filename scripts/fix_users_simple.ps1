# Script de correction de la table users - Version simplifiee
# Ce script applique les corrections necessaires pour resoudre l'erreur 500

Write-Host "Correction de la table users" -ForegroundColor Cyan
Write-Host "===============================" -ForegroundColor Cyan

# Configuration
$baseUrl = "http://localhost:3001"

Write-Host "`n1. Verification de la sante du serveur..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$baseUrl/healthz" -Method Get -TimeoutSec 5
    Write-Host "   Serveur en ligne: $response" -ForegroundColor Green
} catch {
    Write-Host "   Serveur inaccessible: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host "`n2. Test de l'API d'authentification avant correction..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$baseUrl/api/user/me" -Method Get -Headers @{"Authorization" = "Bearer test_token"} -TimeoutSec 10
    Write-Host "   Erreur: l'API a accepte un token invalide" -ForegroundColor Red
} catch {
    if ($_.Exception.Response.StatusCode -eq 401) {
        Write-Host "   API d'authentification fonctionne (rejette les tokens invalides)" -ForegroundColor Green
    } else {
        Write-Host "   Erreur inattendue: $($_.Exception.Response.StatusCode) - $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host "`n3. Application des corrections de la base de donnees..." -ForegroundColor Yellow

# Demander les informations de connexion a la base de donnees
Write-Host "   Configuration de la base de donnees:" -ForegroundColor Blue
$dbHost = Read-Host "   Host (defaut: localhost)" 
if ([string]::IsNullOrEmpty($dbHost)) { $dbHost = "localhost" }

$dbPort = Read-Host "   Port (defaut: 5432)"
if ([string]::IsNullOrEmpty($dbPort)) { $dbPort = "5432" }

$dbName = Read-Host "   Nom de la base (defaut: yukpo)"
if ([string]::IsNullOrEmpty($dbName)) { $dbName = "yukpo" }

$dbUser = Read-Host "   Utilisateur (defaut: postgres)"
if ([string]::IsNullOrEmpty($dbUser)) { $dbUser = "postgres" }

$dbPassword = Read-Host "   Mot de passe" -AsSecureString
$dbPasswordPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($dbPassword))

Write-Host "`n   Connexion a la base de donnees..." -ForegroundColor Yellow

try {
    # Verifier la connexion avec psql
    $testConnection = "psql -h $dbHost -p $dbPort -U $dbUser -d $dbName -c 'SELECT 1;'"
    $env:PGPASSWORD = $dbPasswordPlain
    
    $result = Invoke-Expression $testConnection 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   Connexion a la base de donnees reussie" -ForegroundColor Green
    } else {
        Write-Host "   Echec de la connexion a la base de donnees" -ForegroundColor Red
        Write-Host "   Erreur: $result" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "   Erreur lors de la connexion: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host "`n   Application du script de correction..." -ForegroundColor Yellow

# Executer le script de correction
try {
    $sqlFile = "scripts/fix_users_table.sql"
    if (Test-Path $sqlFile) {
        $fixCommand = "psql -h $dbHost -p $dbPort -U $dbUser -d $dbName -f $sqlFile"
        $fixResult = Invoke-Expression $fixCommand 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "   Script de correction applique avec succes" -ForegroundColor Green
        } else {
            Write-Host "   Erreur lors de l'application du script" -ForegroundColor Red
            Write-Host "   Erreur: $fixResult" -ForegroundColor Red
        }
    } else {
        Write-Host "   Fichier de correction introuvable: $sqlFile" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "   Erreur lors de l'execution du script: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host "`n4. Test de l'API d'authentification apres correction..." -ForegroundColor Yellow

# Attendre un peu que les changements prennent effet
Start-Sleep -Seconds 3

try {
    $response = Invoke-RestMethod -Uri "$baseUrl/api/user/me" -Method Get -Headers @{"Authorization" = "Bearer test_token"} -TimeoutSec 10
    Write-Host "   Erreur: l'API a accepte un token invalide" -ForegroundColor Red
} catch {
    if ($_.Exception.Response.StatusCode -eq 401) {
        Write-Host "   API d'authentification fonctionne toujours (rejette les tokens invalides)" -ForegroundColor Green
    } else {
        Write-Host "   Erreur inattendue: $($_.Exception.Response.StatusCode) - $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host "`n5. Test avec un token valide..." -ForegroundColor Yellow
Write-Host "   Pour tester avec un vrai token, copiez-le depuis le localStorage du navigateur" -ForegroundColor Blue
Write-Host "   Ouvrez la console du navigateur et tapez: localStorage.getItem('token')" -ForegroundColor Blue

$testToken = Read-Host "   Collez votre token JWT ici (ou appuyez sur Entree pour ignorer)"

if ($testToken -and $testToken -ne "") {
    Write-Host "   Test avec le token fourni..." -ForegroundColor Yellow
    
    try {
        $response = Invoke-RestMethod -Uri "$baseUrl/api/user/me" -Method Get -Headers @{"Authorization" = "Bearer $testToken"} -TimeoutSec 10
        Write-Host "   SUCCES ! API d'authentification fonctionne maintenant" -ForegroundColor Green
        Write-Host "   Donnees utilisateur: $($response | ConvertTo-Json -Depth 2)" -ForegroundColor Gray
        
        Write-Host "`nPROBLEME RESOLU !" -ForegroundColor Green
        Write-Host "L'API /api/user/me fonctionne maintenant correctement." -ForegroundColor White
        
    } catch {
        if ($_.Exception.Response.StatusCode -eq 500) {
            Write-Host "   Erreur 500 persistante - Probleme non resolu" -ForegroundColor Red
            Write-Host "   Verifiez les logs du serveur backend pour plus de details" -ForegroundColor Yellow
        } else {
            Write-Host "   Erreur inattendue: $($_.Exception.Response.StatusCode) - $($_.Exception.Message)" -ForegroundColor Red
        }
    }
} else {
    Write-Host "   Test ignore - pas de token fourni" -ForegroundColor Yellow
}

Write-Host "`n=== CORRECTION TERMINEE ===" -ForegroundColor Cyan
Write-Host "`nRESUME DES ACTIONS EFFECTUEES:" -ForegroundColor Yellow
Write-Host "1. Verification de la sante du serveur" -ForegroundColor Green
Write-Host "2. Test de l'API avant correction" -ForegroundColor Green
Write-Host "3. Application des corrections de la base de donnees" -ForegroundColor Green
Write-Host "4. Test de l'API apres correction" -ForegroundColor Green

Write-Host "`nPROCHAINES ETAPES:" -ForegroundColor Yellow
Write-Host "1. Testez l'application dans le navigateur" -ForegroundColor White
Write-Host "2. Verifiez que l'API /api/user/me fonctionne" -ForegroundColor White
Write-Host "3. Testez la recuperation des services" -ForegroundColor White
Write-Host "4. Si tout fonctionne, passez a la reactivation des WebSockets" -ForegroundColor White

# Nettoyer le mot de passe de la memoire
$dbPasswordPlain = $null
$env:PGPASSWORD = $null 