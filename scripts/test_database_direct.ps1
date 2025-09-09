# Script de test direct de la base de donnees
Write-Host "Test direct de la base de donnees" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan

Write-Host "`n1. Demande des parametres de connexion PostgreSQL..." -ForegroundColor Yellow
Write-Host "   Configuration automatique:" -ForegroundColor Blue
Write-Host "   Host: localhost" -ForegroundColor Gray
Write-Host "   Port: 5432" -ForegroundColor Gray
Write-Host "   Base: yukpo_db" -ForegroundColor Gray
Write-Host "   User: postgres" -ForegroundColor Gray

$dbHost = "localhost"
$dbPort = "5432"
$dbName = "yukpo_db"
$dbUser = "postgres"

$dbPassword = Read-Host "   Mot de passe pour l'utilisateur postgres" -AsSecureString
$dbPasswordPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($dbPassword))

Write-Host "`n2. Test de connexion a la base de donnees..." -ForegroundColor Yellow

try {
    $env:PGPASSWORD = $dbPasswordPlain
    
    # Test de connexion
    $testConnection = "psql -h $dbHost -p $dbPort -U $dbUser -d $dbName -c 'SELECT 1;'"
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

Write-Host "`n3. Test de la requete exacte de get_user_profile..." -ForegroundColor Yellow
Write-Host "   Nous allons tester la requete SQL exacte qui cause l'erreur 500" -ForegroundColor White

# Requete exacte de get_user_profile
$sqlQuery = @"
SELECT id, email, password_hash, role, is_provider, tokens_balance,
       token_price_user, token_price_provider, commission_pct,
       preferred_lang, created_at, updated_at, gps, gps_consent,
       nom, prenom, nom_complet, photo_profil, avatar_url
FROM users WHERE id = 1;
"@

try {
    Write-Host "   Execution de la requete SQL..." -ForegroundColor Yellow
    $queryCommand = "psql -h $dbHost -p $dbPort -U $dbUser -d $dbName -c `"$sqlQuery`""
    $queryResult = Invoke-Expression $queryCommand 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   SUCCES ! Requete SQL executee sans erreur" -ForegroundColor Green
        Write-Host "   Resultat: $queryResult" -ForegroundColor Gray
    } else {
        Write-Host "   ERREUR SQL DETECTEE !" -ForegroundColor Red
        Write-Host "   Erreur: $queryResult" -ForegroundColor Red
        
        Write-Host "`n   ANALYSE DE L'ERREUR SQL:" -ForegroundColor Yellow
        Write-Host "   Cette erreur SQL explique l'erreur 500 de l'API" -ForegroundColor White
    }
} catch {
    Write-Host "   Erreur lors de l'execution de la requete: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n4. Verification des colonnes de la table users..." -ForegroundColor Yellow

$checkColumnsQuery = @"
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'users' 
ORDER BY ordinal_position;
"@

try {
    Write-Host "   Verification des colonnes..." -ForegroundColor Yellow
    $columnsCommand = "psql -h $dbHost -p $dbPort -U $dbUser -d $dbName -c `"$checkColumnsQuery`""
    $columnsResult = Invoke-Expression $columnsCommand 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   Colonnes de la table users:" -ForegroundColor Green
        Write-Host "   $columnsResult" -ForegroundColor Gray
    } else {
        Write-Host "   Erreur lors de la verification des colonnes: $columnsResult" -ForegroundColor Red
    }
} catch {
    Write-Host "   Erreur lors de la verification des colonnes: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n5. Test d'une requete simplifiee..." -ForegroundColor Yellow

$simpleQuery = "SELECT id, email, tokens_balance FROM users WHERE id = 1;"

try {
    Write-Host "   Test de requete simplifiee..." -ForegroundColor Yellow
    $simpleCommand = "psql -h $dbHost -p $dbPort -U $dbUser -d $dbName -c `"$simpleQuery`""
    $simpleResult = Invoke-Expression $simpleCommand 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   SUCCES ! Requete simplifiee fonctionne" -ForegroundColor Green
        Write-Host "   Resultat: $simpleResult" -ForegroundColor Gray
    } else {
        Write-Host "   Erreur sur requete simplifiee: $simpleResult" -ForegroundColor Red
    }
} catch {
    Write-Host "   Erreur sur requete simplifiee: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n=== TEST BASE DE DONNEES TERMINE ===" -ForegroundColor Cyan
Write-Host "`nRESUME:" -ForegroundColor Yellow
Write-Host "1. Connexion a la base: Testee" -ForegroundColor White
Write-Host "2. Requete exacte de get_user_profile: Testee" -ForegroundColor White
Write-Host "3. Colonnes de la table users: Verifiees" -ForegroundColor White
Write-Host "4. Requete simplifiee: Testee" -ForegroundColor White

# Nettoyer le mot de passe de la memoire
$dbPasswordPlain = $null
$env:PGPASSWORD = $null 