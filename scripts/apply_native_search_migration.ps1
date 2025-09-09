# Script pour appliquer la migration des index de recherche native PostgreSQL
# Base de données: yukpo_db
# Utilisateur: postgres

Write-Host "=== MIGRATION: Index de recherche native PostgreSQL ===" -ForegroundColor Cyan
Write-Host "Base de données: yukpo_db" -ForegroundColor Yellow
Write-Host "Utilisateur: postgres" -ForegroundColor Yellow
Write-Host ""

# Vérifier que psql est disponible
try {
    $psqlVersion = psql --version 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ psql détecté: $psqlVersion" -ForegroundColor Green
    } else {
        throw "psql non disponible"
    }
} catch {
    Write-Host "❌ Erreur: psql n'est pas installé ou n'est pas dans le PATH" -ForegroundColor Red
    Write-Host "Veuillez installer PostgreSQL ou ajouter psql au PATH" -ForegroundColor Yellow
    exit 1
}

# Configuration de la base de données
$DB_NAME = "yukpo_db"
$DB_USER = "postgres"
$DB_HOST = "localhost"
$DB_PORT = "5432"

# Demander le mot de passe PostgreSQL
Write-Host "Entrez le mot de passe pour l'utilisateur postgres:" -ForegroundColor Yellow
$DB_PASSWORD = Read-Host -AsSecureString
$DB_PASSWORD_PLAIN = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($DB_PASSWORD))

# Construire l'URL de connexion
$DATABASE_URL = "postgresql://${DB_USER}:${DB_PASSWORD_PLAIN}@${DB_HOST}:${DB_PORT}/${DB_NAME}"

Write-Host ""
Write-Host "Connexion à la base de données..." -ForegroundColor Blue

# Test de connexion
try {
    $testQuery = "SELECT version();"
    $testResult = psql $DATABASE_URL -c $testQuery 2>$null
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Connexion réussie à $DB_NAME" -ForegroundColor Green
        Write-Host "Version PostgreSQL: $testResult" -ForegroundColor Gray
    } else {
        throw "Échec de la connexion"
    }
} catch {
    Write-Host "❌ Erreur de connexion à la base de données" -ForegroundColor Red
    Write-Host "Vérifiez que:" -ForegroundColor Yellow
    Write-Host "  - PostgreSQL est démarré" -ForegroundColor Yellow
    Write-Host "  - La base $DB_NAME existe" -ForegroundColor Yellow
    Write-Host "  - L'utilisateur $DB_USER a les droits d'accès" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "=== ÉTAPE 1: Vérification de la structure existante ===" -ForegroundColor Cyan

# Vérifier la structure de la table services
$structureQuery = @"
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'services' 
ORDER BY ordinal_position;
"@

Write-Host "Structure de la table services:" -ForegroundColor Blue
try {
    psql $DATABASE_URL -c $structureQuery
} catch {
    Write-Host "❌ Erreur lors de la vérification de la structure" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "=== ÉTAPE 2: Vérification des extensions ===" -ForegroundColor Cyan

# Vérifier les extensions disponibles
$extensionsQuery = @"
SELECT 
    extname,
    extversion,
    extrelocatable
FROM pg_extension 
ORDER BY extname;
"@

Write-Host "Extensions installées:" -ForegroundColor Blue
try {
    psql $DATABASE_URL -c $extensionsQuery
} catch {
    Write-Host "❌ Erreur lors de la vérification des extensions" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "=== ÉTAPE 3: Application de la migration ===" -ForegroundColor Cyan

# Appliquer la migration
$migrationFile = "..\migrations\20250830_001_add_native_search_indexes.sql"
Write-Host "Application de la migration: $migrationFile" -ForegroundColor Blue

try {
    psql $DATABASE_URL -f $migrationFile
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Migration appliquée avec succès!" -ForegroundColor Green
    } else {
        throw "Échec de l'application de la migration"
    }
} catch {
    Write-Host "❌ Erreur lors de l'application de la migration" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "=== ÉTAPE 4: Vérification des index créés ===" -ForegroundColor Cyan

# Vérifier les index créés
$indexesQuery = @"
SELECT 
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'services' 
AND indexname LIKE 'idx_services_%'
ORDER BY indexname;
"@

Write-Host "Index de recherche créés:" -ForegroundColor Blue
try {
    psql $DATABASE_URL -c $indexesQuery
} catch {
    Write-Host "❌ Erreur lors de la vérification des index" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "=== ÉTAPE 5: Test de performance ===" -ForegroundColor Cyan

# Test de recherche simple
$testSearchQuery = @"
EXPLAIN (ANALYZE, BUFFERS) 
SELECT 
    id,
    data->>'titre_service' as titre,
    ts_rank(
        to_tsvector('french', data->>'titre_service'),
        plainto_tsquery('french', 'plombier')
    ) as rank
FROM services 
WHERE to_tsvector('french', data->>'titre_service') @@ plainto_tsquery('french', 'plombier')
ORDER BY rank DESC
LIMIT 5;
"@

Write-Host "Test de recherche full-text (plombier):" -ForegroundColor Blue
try {
    psql $DATABASE_URL -c $testSearchQuery
} catch {
    Write-Host "❌ Erreur lors du test de recherche" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "=== MIGRATION TERMINÉE AVEC SUCCÈS! ===" -ForegroundColor Green
Write-Host ""
Write-Host "Les index de recherche native PostgreSQL ont été créés:" -ForegroundColor White
Write-Host "  ✅ Full-text search (recherche textuelle intelligente)" -ForegroundColor Green
Write-Host "  ✅ Trigram similarity (recherche floue et fautes de frappe)" -ForegroundColor Green
Write-Host "  ✅ Index combinés pour performance optimale" -ForegroundColor Green
Write-Host ""
Write-Host "Votre application peut maintenant utiliser la recherche native PostgreSQL" -ForegroundColor White
Write-Host "au lieu de Pinecone pour les recherches de services!" -ForegroundColor White

# Nettoyer le mot de passe en mémoire
$DB_PASSWORD_PLAIN = $null
[System.GC]::Collect() 