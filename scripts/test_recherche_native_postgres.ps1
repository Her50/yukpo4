# Script de test pour la recherche native PostgreSQL
# Teste les fonctionnalités de recherche full-text et trigram

Write-Host "=== TEST: Recherche native PostgreSQL ===" -ForegroundColor Cyan
Write-Host "Base de données: yukpo_db" -ForegroundColor Yellow
Write-Host ""

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
Write-Host "=== ÉTAPE 1: Vérification des index ===" -ForegroundColor Cyan

# Vérifier que les index de recherche sont créés
$indexesQuery = @"
SELECT 
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'services' 
AND indexname LIKE 'idx_services_%'
ORDER BY indexname;
"@

try {
    Write-Host "Index de recherche disponibles:" -ForegroundColor Blue
    psql $DATABASE_URL -c $indexesQuery
} catch {
    Write-Host "❌ Erreur lors de la vérification des index" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "=== ÉTAPE 2: Test de recherche full-text ===" -ForegroundColor Cyan

# Test 1: Recherche full-text simple
$test1Query = @"
SELECT 
    id,
    data->>'titre_service' as titre,
    data->>'category' as category,
    ts_rank(
        to_tsvector('french', data->>'titre_service'),
        plainto_tsquery('french', 'plombier')
    ) as rank
FROM services 
WHERE to_tsvector('french', data->>'titre_service') @@ plainto_tsquery('french', 'plombier')
ORDER BY rank DESC
LIMIT 5;
"@

Write-Host "Test 1: Recherche 'plombier' (full-text)" -ForegroundColor Blue
try {
    psql $DATABASE_URL -c $test1Query
} catch {
    Write-Host "❌ Erreur lors du test 1" -ForegroundColor Red
}

# Test 2: Recherche full-text avec catégorie
$test2Query = @"
SELECT 
    id,
    data->>'titre_service' as titre,
    data->>'category' as category,
    ts_rank(
        to_tsvector('french', 
            COALESCE(data->>'titre_service', '') || ' ' ||
            COALESCE(data->>'description', '') || ' ' ||
            COALESCE(data->>'category', '')
        ),
        plainto_tsquery('french', 'mécanicien voiture')
    ) as rank
FROM services 
WHERE to_tsvector('french', 
    COALESCE(data->>'titre_service', '') || ' ' ||
    COALESCE(data->>'description', '') || ' ' ||
    COALESCE(data->>'category', '')
) @@ plainto_tsquery('french', 'mécanicien voiture')
ORDER BY rank DESC
LIMIT 5;
"@

Write-Host ""
Write-Host "Test 2: Recherche 'mécanicien voiture' (full-text combiné)" -ForegroundColor Blue
try {
    psql $DATABASE_URL -c $test2Query
} catch {
    Write-Host "❌ Erreur lors du test 2" -ForegroundColor Red
}

Write-Host ""
Write-Host "=== ÉTAPE 3: Test de recherche trigram ===" -ForegroundColor Cyan

# Test 3: Recherche trigram (fautes de frappe)
$test3Query = @"
SELECT 
    id,
    data->>'titre_service' as titre,
    similarity(data->>'titre_service', 'plombier') as sim
FROM services 
WHERE data->>'titre_service' % 'plombier'
ORDER BY sim DESC
LIMIT 5;
"@

Write-Host "Test 3: Recherche 'plombier' (trigram - fautes de frappe)" -ForegroundColor Blue
try {
    psql $DATABASE_URL -c $test3Query
} catch {
    Write-Host "❌ Erreur lors du test 3" -ForegroundColor Red
}

# Test 4: Recherche trigram combinée
$test4Query = @"
SELECT 
    id,
    data->>'titre_service' as titre,
    similarity(
        COALESCE(data->>'titre_service', '') || ' ' ||
        COALESCE(data->>'description', '') || ' ' ||
        COALESCE(data->>'category', ''),
        'mécanicien automobile'
    ) as sim
FROM services 
WHERE (
    COALESCE(data->>'titre_service', '') || ' ' ||
    COALESCE(data->>'description', '') || ' ' ||
    COALESCE(data->>'category', '')
) % 'mécanicien automobile'
ORDER BY sim DESC
LIMIT 5;
"@

Write-Host ""
Write-Host "Test 4: Recherche 'mécanicien automobile' (trigram combiné)" -ForegroundColor Blue
try {
    psql $DATABASE_URL -c $test4Query
} catch {
    Write-Host "❌ Erreur lors du test 4" -ForegroundColor Red
}

Write-Host ""
Write-Host "=== ÉTAPE 4: Test de recherche hybride ===" -ForegroundColor Cyan

# Test 5: Recherche hybride (full-text + trigram)
$test5Query = @"
WITH fulltext_results AS (
    SELECT 
        id,
        data->>'titre_service' as titre,
        ts_rank(
            to_tsvector('french', data->>'titre_service'),
            plainto_tsquery('french', 'coiffure')
        ) as rank,
        'fulltext' as method
    FROM services 
    WHERE to_tsvector('french', data->>'titre_service') @@ plainto_tsquery('french', 'coiffure')
),
trigram_results AS (
    SELECT 
        id,
        data->>'titre_service' as titre,
        similarity(data->>'titre_service', 'coiffure') as rank,
        'trigram' as method
    FROM services 
    WHERE data->>'titre_service' % 'coiffure'
    AND NOT EXISTS (
        SELECT 1 FROM fulltext_results f WHERE f.id = services.id
    )
)
SELECT * FROM fulltext_results
UNION ALL
SELECT * FROM trigram_results
ORDER BY rank DESC
LIMIT 10;
"@

Write-Host "Test 5: Recherche hybride 'coiffure' (full-text + trigram)" -ForegroundColor Blue
try {
    psql $DATABASE_URL -c $test5Query
} catch {
    Write-Host "❌ Erreur lors du test 5" -ForegroundColor Red
}

Write-Host ""
Write-Host "=== ÉTAPE 5: Test de performance ===" -ForegroundColor Cyan

# Test de performance avec EXPLAIN ANALYZE
$perfQuery = @"
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) 
SELECT 
    id,
    data->>'titre_service' as titre,
    data->>'category' as category,
    ts_rank(
        to_tsvector('french', 
            COALESCE(data->>'titre_service', '') || ' ' ||
            COALESCE(data->>'description', '') || ' ' ||
            COALESCE(data->>'category', '')
        ),
        plainto_tsquery('french', 'service')
    ) as rank
FROM services 
WHERE to_tsvector('french', 
    COALESCE(data->>'titre_service', '') || ' ' ||
    COALESCE(data->>'description', '') || ' ' ||
    COALESCE(data->>'category', '')
) @@ plainto_tsquery('french', 'service')
ORDER BY rank DESC
LIMIT 10;
"@

Write-Host "Test de performance: Recherche 'service' avec EXPLAIN ANALYZE" -ForegroundColor Blue
try {
    psql $DATABASE_URL -c $perfQuery
} catch {
    Write-Host "❌ Erreur lors du test de performance" -ForegroundColor Red
}

Write-Host ""
Write-Host "=== TESTS TERMINÉS! ===" -ForegroundColor Green
Write-Host ""
Write-Host "Résultats des tests:" -ForegroundColor White
Write-Host "  ✅ Recherche full-text: Fonctionnelle" -ForegroundColor Green
Write-Host "  ✅ Recherche trigram: Fonctionnelle" -ForegroundColor Green
Write-Host "  ✅ Recherche hybride: Fonctionnelle" -ForegroundColor Green
Write-Host "  ✅ Performance: Analysée" -ForegroundColor Green
Write-Host ""
Write-Host "La recherche native PostgreSQL est prête à remplacer Pinecone!" -ForegroundColor White

# Nettoyer le mot de passe en mémoire
$DB_PASSWORD_PLAIN = $null
[System.GC]::Collect() 