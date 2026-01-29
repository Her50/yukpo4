# Script PowerShell pour analyser quelles tables existent et lesquelles manquent
# Usage: .\scripts\analyse_tables_crees_manquantes.ps1

$ErrorActionPreference = "Stop"

$REGION = "us-east-1"
$PROJECT_NAME = "yukpomnang"
$ENVIRONMENT = "production"
$SSM_DATABASE_URL_PATH = "/${PROJECT_NAME}/${ENVIRONMENT}/DATABASE_URL"

Write-Host "==================================================================================" -ForegroundColor Cyan
Write-Host "🔍 Analyse : Tables Créées vs Tables Manquantes" -ForegroundColor Cyan
Write-Host "=================================================================================="
Write-Host ""

# 1. Récupérer DATABASE_URL depuis SSM
Write-Host "📋 Étape 1: Récupération de DATABASE_URL..." -ForegroundColor Yellow
try {
    $databaseUrl = aws ssm get-parameter `
        --name $SSM_DATABASE_URL_PATH `
        --region $REGION `
        --with-decryption `
        --query 'Parameter.Value' `
        --output text
    
    if (-not $databaseUrl) {
        Write-Host "❌ Impossible de récupérer DATABASE_URL depuis SSM" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "✅ DATABASE_URL récupérée" -ForegroundColor Green
    Write-Host ""
} catch {
    Write-Host "❌ Erreur lors de la récupération de DATABASE_URL: $_" -ForegroundColor Red
    exit 1
}

# Extraire les informations de connexion
if ($databaseUrl -match "postgresql://([^:]+):([^@]+)@([^:]+):(\d+)/(.+)") {
    $dbUser = $matches[1]
    $dbPassword = $matches[2]
    $dbHost = $matches[3]
    $dbPort = $matches[4]
    $dbName = $matches[5]
    
    $env:PGPASSWORD = $dbPassword
    
    Write-Host "📋 Étape 2: Vérification de l'état de la migration 0..." -ForegroundColor Yellow
    
    # Vérifier si la table _sqlx_migrations existe
    $checkMigrationsTable = "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '_sqlx_migrations') as exists;"
    $migrationsTableExists = psql -h $dbHost -p $dbPort -U $dbUser -d $dbName -t -c $checkMigrationsTable 2>&1 | Out-String
    
    if ($migrationsTableExists -match "t|true") {
        Write-Host "✅ Table _sqlx_migrations existe" -ForegroundColor Green
        Write-Host ""
        
        # Vérifier l'état de la migration 0
        $migration0Query = "SELECT version, description, success, installed_on, encode(checksum, 'hex') as checksum_hex FROM _sqlx_migrations WHERE version = 0;"
        $migration0 = psql -h $dbHost -p $dbPort -U $dbUser -d $dbName -c $migration0Query 2>&1 | Out-String
        
        Write-Host "📊 État de la migration 0:" -ForegroundColor Cyan
        Write-Host $migration0
        Write-Host ""
        
        # Lister toutes les migrations appliquées
        $allMigrationsQuery = "SELECT version, description, success FROM _sqlx_migrations ORDER BY version;"
        $allMigrations = psql -h $dbHost -p $dbPort -U $dbUser -d $dbName -c $allMigrationsQuery 2>&1 | Out-String
        
        Write-Host "📊 Toutes les migrations appliquées:" -ForegroundColor Cyan
        Write-Host $allMigrations
        Write-Host ""
    } else {
        Write-Host "❌ Table _sqlx_migrations n'existe pas - Aucune migration n'a été appliquée" -ForegroundColor Red
        Write-Host ""
    }
    
    # 2. Vérifier les tables de base (créées au début de la migration 0)
    Write-Host "📋 Étape 3: Vérification des tables de base (début migration 0)..." -ForegroundColor Yellow
    
    $baseTables = @("users", "services", "media", "publicites")
    $baseTablesQuery = "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('$($baseTables -join "','")') ORDER BY table_name;"
    $existingBaseTables = psql -h $dbHost -p $dbPort -U $dbUser -d $dbName -t -c $baseTablesQuery 2>&1 | Where-Object { $_ -match '\S' } | ForEach-Object { $_.Trim() }
    
    Write-Host "📊 Tables de base existantes:" -ForegroundColor Cyan
    foreach ($table in $baseTables) {
        if ($existingBaseTables -contains $table) {
            Write-Host "   ✅ $table" -ForegroundColor Green
        } else {
            Write-Host "   ❌ $table" -ForegroundColor Red
        }
    }
    Write-Host ""
    
    # 3. Vérifier les tables critiques manquantes (créées plus tard dans la migration 0)
    Write-Host "📋 Étape 4: Vérification des tables critiques (milieu/fin migration 0)..." -ForegroundColor Yellow
    
    $criticalTables = @(
        @{Name="live_flash_sales"; Line=1800; DependsOn=@("live_sessions", "services")},
        @{Name="global_promo_events"; Line=1863; DependsOn=@("users")},
        @{Name="social_publication_jobs"; Line=1977; DependsOn=@()},
        @{Name="video_generation_jobs"; Line=2053; DependsOn=@()},
        @{Name="deliveries"; Line=2415; DependsOn=@("users", "couriers", "delivery_parcels")},
        @{Name="delivery_matching_queue"; Line=2708; DependsOn=@("deliveries", "delivery_zones")},
        @{Name="product_creation_queue"; Line=5354; DependsOn=@("services", "users")},
        @{Name="product_orders"; Line="N/A"; DependsOn=@("services", "users"); Migration="20250120_001_add_order_preparation_system.sql"},
        @{Name="delivery_proximity_suggestions"; Line="N/A"; DependsOn=@("deliveries"); Migration="migration delivery"}
    )
    
    $criticalTablesQuery = "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('$($criticalTables.Name -join "','")') ORDER BY table_name;"
    $existingCriticalTables = psql -h $dbHost -p $dbPort -U $dbUser -d $dbName -t -c $criticalTablesQuery 2>&1 | Where-Object { $_ -match '\S' } | ForEach-Object { $_.Trim() }
    
    Write-Host "📊 Tables critiques:" -ForegroundColor Cyan
    foreach ($tableInfo in $criticalTables) {
        $tableName = $tableInfo.Name
        $exists = $existingCriticalTables -contains $tableName
        
        if ($exists) {
            Write-Host "   ✅ $tableName (ligne $($tableInfo.Line))" -ForegroundColor Green
        } else {
            Write-Host "   ❌ $tableName (ligne $($tableInfo.Line))" -ForegroundColor Red
            if ($tableInfo.DependsOn.Count -gt 0) {
                Write-Host "      Dépend de: $($tableInfo.DependsOn -join ', ')" -ForegroundColor Yellow
            }
            if ($tableInfo.Migration) {
                Write-Host "      Migration séparée: $($tableInfo.Migration)" -ForegroundColor Cyan
            }
        }
    }
    Write-Host ""
    
    # 4. Vérifier les tables de dépendance
    Write-Host "📋 Étape 5: Vérification des tables de dépendance..." -ForegroundColor Yellow
    
    $allDependencies = $criticalTables | ForEach-Object { $_.DependsOn } | Where-Object { $_ } | Select-Object -Unique
    if ($allDependencies) {
        $dependenciesQuery = "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('$($allDependencies -join "','")') ORDER BY table_name;"
        $existingDependencies = psql -h $dbHost -p $dbPort -U $dbUser -d $dbName -t -c $dependenciesQuery 2>&1 | Where-Object { $_ -match '\S' } | ForEach-Object { $_.Trim() }
        
        Write-Host "📊 Tables de dépendance:" -ForegroundColor Cyan
        foreach ($dep in $allDependencies) {
            if ($existingDependencies -contains $dep) {
                Write-Host "   ✅ $dep" -ForegroundColor Green
            } else {
                Write-Host "   ❌ $dep (MANQUANTE - bloque la création d'autres tables)" -ForegroundColor Red
            }
        }
        Write-Host ""
    }
    
    # 5. Analyse et recommandations
    Write-Host "📋 Étape 6: Analyse et recommandations..." -ForegroundColor Yellow
    Write-Host ""
    
    $missingCritical = $criticalTables | Where-Object { $existingCriticalTables -notcontains $_.Name }
    $missingBase = $baseTables | Where-Object { $existingBaseTables -notcontains $_ }
    
    if ($missingBase.Count -eq 0 -and $missingCritical.Count -gt 0) {
        Write-Host "🔍 DIAGNOSTIC: Migration 0 partiellement exécutée" -ForegroundColor Yellow
        Write-Host "   - Tables du début créées (users, services)" -ForegroundColor Gray
        Write-Host "   - Tables du milieu/fin manquantes" -ForegroundColor Gray
        Write-Host ""
        Write-Host "💡 CAUSE PROBABLE:" -ForegroundColor Cyan
        Write-Host "   La migration 0 s'est arrêtée entre la ligne 110 (services) et la ligne 1800 (live_flash_sales)" -ForegroundColor White
        Write-Host "   Possiblement à cause d'une erreur SQL silencieuse ou d'un timeout" -ForegroundColor White
        Write-Host ""
        Write-Host "🔧 SOLUTION RECOMMANDÉE:" -ForegroundColor Green
        Write-Host "   1. Exécuter les migrations séparées pour les tables manquantes:" -ForegroundColor White
        foreach ($tableInfo in $missingCritical) {
            if ($tableInfo.Migration) {
                Write-Host "      - $($tableInfo.Name) → $($tableInfo.Migration)" -ForegroundColor Cyan
            }
        }
        Write-Host "   2. Ou réexécuter la migration 0 complète (après avoir supprimé l'entrée dans _sqlx_migrations)" -ForegroundColor White
    } elseif ($missingBase.Count -gt 0) {
        Write-Host "🔍 DIAGNOSTIC: Migration 0 non exécutée ou échouée très tôt" -ForegroundColor Red
        Write-Host "   - Même les tables de base sont manquantes" -ForegroundColor Gray
        Write-Host ""
        Write-Host "🔧 SOLUTION: Exécuter toutes les migrations depuis le début" -ForegroundColor Green
    } else {
        Write-Host "✅ Toutes les tables critiques existent" -ForegroundColor Green
    }
    
} else {
    Write-Host "❌ Format de DATABASE_URL invalide" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "==================================================================================" -ForegroundColor Cyan
Write-Host "✅ Analyse terminée" -ForegroundColor Green
Write-Host "=================================================================================="

