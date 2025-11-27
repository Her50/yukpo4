# Script PowerShell pour vérifier et corriger les index manquants
# Diagnostic et application des index pour optimiser get_services_for_prestataire

Write-Host "=== Diagnostic des Index pour get_services_for_prestataire ===" -ForegroundColor Cyan

# Vérifier si DATABASE_URL est définie
if (-not $env:DATABASE_URL) {
    Write-Host "ERREUR: DATABASE_URL n'est pas définie" -ForegroundColor Red
    Write-Host "Veuillez définir la variable d'environnement DATABASE_URL" -ForegroundColor Yellow
    exit 1
}

Write-Host "`n1. Vérification des migrations appliquées..." -ForegroundColor Yellow
$migrationsQuery = @"
SELECT 
    version,
    description,
    installed_on,
    success
FROM _sqlx_migrations
WHERE description LIKE '%index%' 
   OR description LIKE '%optimize%'
   OR description LIKE '%services%'
ORDER BY installed_on DESC
LIMIT 20;
"@

try {
    $migrations = psql $env:DATABASE_URL -c $migrationsQuery
    Write-Host $migrations
}
catch {
    Write-Host "Erreur lors de la vérification des migrations: $_" -ForegroundColor Red
}

Write-Host "`n2. Vérification des index existants sur 'services'..." -ForegroundColor Yellow
$indexesQuery = @"
SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'services'
  AND (
    indexname LIKE '%user_id%created_at%'
    OR indexname LIKE '%services_user_id%'
    OR indexname LIKE '%services_data_produits%'
    OR indexname LIKE '%services_category%'
  )
ORDER BY indexname;
"@

try {
    $indexes = psql $env:DATABASE_URL -c $indexesQuery
    Write-Host $indexes
    
    if ($indexes -match "0 rows") {
        Write-Host "⚠️ Aucun index trouvé - Les migrations ne se sont peut-être pas exécutées" -ForegroundColor Yellow
    }
}
catch {
    Write-Host "Erreur lors de la vérification des index: $_" -ForegroundColor Red
}

Write-Host "`n3. Vérification des index sur 'products_lifecycle'..." -ForegroundColor Yellow
$productsIndexesQuery = @"
SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'products_lifecycle'
  AND indexname LIKE '%service_product%'
ORDER BY indexname;
"@

try {
    $productsIndexes = psql $env:DATABASE_URL -c $productsIndexesQuery
    Write-Host $productsIndexes
}
catch {
    Write-Host "Erreur lors de la vérification des index products_lifecycle: $_" -ForegroundColor Red
}

Write-Host "`n4. Vérification des index manquants..." -ForegroundColor Yellow
$missingQuery = @"
SELECT 
    'Index manquant' as status,
    'idx_services_user_id_created_at' as index_name
WHERE NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'services' 
    AND indexname = 'idx_services_user_id_created_at'
)
UNION ALL
SELECT 
    'Index manquant' as status,
    'idx_services_data_produits_gin' as index_name
WHERE NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'services' 
    AND indexname = 'idx_services_data_produits_gin'
)
UNION ALL
SELECT 
    'Index manquant' as status,
    'idx_products_lifecycle_service_product' as index_name
WHERE NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'products_lifecycle' 
    AND indexname = 'idx_products_lifecycle_service_product'
);
"@

try {
    $missing = psql $env:DATABASE_URL -c $missingQuery
    Write-Host $missing
    
    if ($missing -match "0 rows") {
        Write-Host "✅ Tous les index nécessaires existent" -ForegroundColor Green
    }
    else {
        Write-Host "⚠️ Des index manquent - Application recommandée" -ForegroundColor Yellow
        Write-Host "`nVoulez-vous appliquer les index manquants ? (O/N)" -ForegroundColor Cyan
        $response = Read-Host
        if ($response -eq "O" -or $response -eq "o") {
            Write-Host "`nApplication des index manquants..." -ForegroundColor Yellow
            psql $env:DATABASE_URL -f "scripts/apply_missing_indexes.sql"
            if ($LASTEXITCODE -eq 0) {
                Write-Host "✅ Index appliqués avec succès" -ForegroundColor Green
            }
            else {
                Write-Host "❌ Erreur lors de l'application des index" -ForegroundColor Red
            }
        }
    }
}
catch {
    Write-Host "Erreur lors de la vérification des index manquants: $_" -ForegroundColor Red
}

Write-Host "`n=== Diagnostic terminé ===" -ForegroundColor Cyan

