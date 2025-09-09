# Script PowerShell pour appliquer les corrections GPS SQL
# =====================================================

Write-Host "Application des corrections GPS SQL..." -ForegroundColor Cyan

# Lire la configuration depuis le fichier .env
$envContent = Get-Content ".env" -ErrorAction SilentlyContinue
$dbHost = ""
$dbPort = ""
$dbName = ""
$dbUser = ""

foreach ($line in $envContent) {
    if ($line -match "^DATABASE_URL=") {
        $dbUrl = $line -replace "^DATABASE_URL=", ""
        if ($dbUrl -match "postgres://([^:]+):([^@]+)@([^:]+)/(.+)") {
            $dbUser = $matches[1]
            $dbPass = $matches[2]
            $dbHost = $matches[3]
            $dbPort = "5432"
            $dbName = $matches[4]
        }
    }
}

if (-not $dbHost -or -not $dbPort -or -not $dbName -or -not $dbUser) {
    Write-Host "Impossible de lire la configuration de la base de donnees depuis .env" -ForegroundColor Red
    exit 1
}

Write-Host "Configuration detectee:" -ForegroundColor Green
Write-Host "   Host: $dbHost" -ForegroundColor White
Write-Host "   Port: $dbPort" -ForegroundColor White
Write-Host "   Base: $dbName" -ForegroundColor White
Write-Host "   User: $dbUser" -ForegroundColor White

# Etape 1: Appliquer les corrections GPS
Write-Host "Etape 1: Application des corrections GPS..." -ForegroundColor Green

try {
    $env:PGPASSWORD = $dbPass
    $result = psql -h $dbHost -p $dbPort -U $dbUser -d $dbName -f "apply_gps_fix_via_api.sql" 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Corrections GPS appliquees avec succes!" -ForegroundColor Green
    } else {
        Write-Host "Erreur lors de l'application des corrections GPS:" -ForegroundColor Red
        Write-Host $result -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "Erreur lors de l'execution de psql:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
} finally {
    Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
}

# Etape 2: Insérer les services de test
Write-Host "Etape 2: Insertion des services de test..." -ForegroundColor Green

try {
    $env:PGPASSWORD = $dbPass
    $result = psql -h $dbHost -p $dbPort -U $dbUser -d $dbName -f "insert_test_services_gps.sql" 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Services de test inseres avec succes!" -ForegroundColor Green
    } else {
        Write-Host "Erreur lors de l'insertion des services de test:" -ForegroundColor Red
        Write-Host $result -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "Erreur lors de l'execution de psql:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
} finally {
    Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
}

# Etape 3: Tester à nouveau
Write-Host "Etape 3: Test de verification..." -ForegroundColor Green

try {
    $env:PGPASSWORD = $dbPass
    $result = psql -h $dbHost -p $dbPort -U $dbUser -d $dbName -f "test_gps_search_direct.sql" 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Test de verification reussi!" -ForegroundColor Green
        Write-Host "Resultats du test:" -ForegroundColor Cyan
        Write-Host $result -ForegroundColor White
    } else {
        Write-Host "Erreur lors du test de verification:" -ForegroundColor Red
        Write-Host $result -ForegroundColor Red
    }
} catch {
    Write-Host "Erreur lors de l'execution de psql:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
} finally {
    Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
}

Write-Host "Application des corrections terminee!" -ForegroundColor Cyan 