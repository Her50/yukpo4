-- ============================================
-- SCRIPT : Application Migration + Tests
-- ============================================
-- Date: 2026-01-03
-- Objectif: Appliquer la migration service_products et exécuter les tests
-- ============================================

\echo '🚀 Début de l''application de la migration...'

-- ============================================
-- ÉTAPE 1 : Vérifier l'état actuel
-- ============================================
\echo '📊 Vérification de l''état actuel des tables...'

-- Vérifier si products (UUID) existe
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_name = 'products'
        ) THEN '✅ Table products (UUID) existe'
        ELSE '❌ Table products (UUID) n''existe pas'
    END as status_products;

-- Vérifier si service_products (SERIAL) existe
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_name = 'service_products'
        ) THEN '✅ Table service_products (SERIAL) existe'
        ELSE '❌ Table service_products (SERIAL) n''existe pas'
    END as status_service_products;

-- ============================================
-- ÉTAPE 2 : Appliquer la migration service_products
-- ============================================
\echo '🔧 Application de la migration service_products...'

-- Créer la table service_products si elle n'existe pas
CREATE TABLE IF NOT EXISTS service_products (
    id SERIAL PRIMARY KEY,
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    product_index INTEGER NOT NULL,
    product_data JSONB NOT NULL,
    
    -- Métadonnées générées
    product_name TEXT GENERATED ALWAYS AS (
        COALESCE(
            product_data->'nom'->>'valeur',
            product_data->>'nom',
            product_data->'nom_produit'->>'valeur',
            product_data->>'nom_produit',
            'Produit sans nom'
        )
    ) STORED,
    
    product_type TEXT GENERATED ALWAYS AS (
        COALESCE(
            product_data->'type'->>'valeur',
            product_data->>'type',
            'autre'
        )
    ) STORED,
    
    product_price NUMERIC GENERATED ALWAYS AS (
        CASE 
            WHEN product_data->'prix'->'valeur'->>'montant' IS NOT NULL 
            THEN (product_data->'prix'->'valeur'->>'montant')::NUMERIC
            WHEN product_data->'prix'->>'montant' IS NOT NULL 
            THEN (product_data->'prix'->>'montant')::NUMERIC
            WHEN product_data->>'prix' IS NOT NULL 
            THEN (product_data->>'prix')::NUMERIC
            ELSE NULL
        END
    ) STORED,
    
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    auto_deactivate_at TIMESTAMPTZ,
    
    UNIQUE(service_id, product_index)
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_service_products_service_id ON service_products(service_id);
CREATE INDEX IF NOT EXISTS idx_service_products_active ON service_products(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_service_products_type ON service_products(product_type);
CREATE INDEX IF NOT EXISTS idx_service_products_name_gin ON service_products USING GIN(to_tsvector('french', product_name));
CREATE INDEX IF NOT EXISTS idx_service_products_data_gin ON service_products USING GIN(product_data);
CREATE INDEX IF NOT EXISTS idx_service_products_service_index ON service_products(service_id, product_index);
CREATE INDEX IF NOT EXISTS idx_service_products_created_at ON service_products(created_at DESC);

-- Trigger pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_service_products_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_service_products_updated_at ON service_products;
CREATE TRIGGER trg_service_products_updated_at
    BEFORE UPDATE ON service_products
    FOR EACH ROW
    EXECUTE FUNCTION update_service_products_updated_at();

COMMENT ON TABLE service_products IS 'Table séparée pour les produits de services. Améliore les performances d''ajout et de recherche par rapport au JSONB dans services.data';
COMMENT ON COLUMN service_products.product_index IS 'Position du produit dans l''ordre d''affichage (0, 1, 2, ...). Doit être unique par service.';
COMMENT ON COLUMN service_products.product_data IS 'Toutes les données du produit au format JSONB (nom, prix, description, type, images, etc.)';

\echo '✅ Migration service_products appliquée !'

-- ============================================
-- ÉTAPE 3 : Vérification des tables
-- ============================================
\echo '🔍 Vérification des tables...'

-- Vérifier la structure de products (UUID)
SELECT 
    'products (UUID)' as table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'products'
ORDER BY ordinal_position
LIMIT 10;

-- Vérifier la structure de service_products (SERIAL)
SELECT 
    'service_products (SERIAL)' as table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'service_products'
ORDER BY ordinal_position;

-- Vérifier les index
SELECT 
    tablename,
    indexname
FROM pg_indexes
WHERE tablename IN ('products', 'service_products')
ORDER BY tablename, indexname;

-- ============================================
-- ÉTAPE 4 : Exécuter les tests
-- ============================================
\echo '🧪 Exécution des tests...'

-- Test 1 : Vérifier intégrité produits
\echo '📊 TEST 1 : Vérification intégrité produits...'
SELECT 
    COUNT(*) as services_avec_differences,
    SUM(CASE 
        WHEN jsonb_array_length(s.data->'produits'->'valeur') > COUNT(p.id) THEN 1 
        ELSE 0 
    END) as services_avec_produits_manquants,
    SUM(CASE 
        WHEN jsonb_array_length(s.data->'produits'->'valeur') < COUNT(p.id) THEN 1 
        ELSE 0 
    END) as services_avec_produits_en_trop
FROM services s
LEFT JOIN service_products p ON p.service_id = s.id
WHERE s.is_active = true
AND s.data->'produits'->'valeur' IS NOT NULL
AND jsonb_typeof(s.data->'produits'->'valeur') = 'array'
AND jsonb_array_length(s.data->'produits'->'valeur') > 0
GROUP BY s.id
HAVING jsonb_array_length(s.data->'produits'->'valeur') != COUNT(p.id);

-- Test 2 : Vérifier product_id dans autocomplete_characteristics
\echo '📊 TEST 2 : Vérification product_id dans autocomplete_characteristics...'
SELECT 
    COUNT(*) as product_id_invalides
FROM autocomplete_characteristics ac
LEFT JOIN service_products p ON p.id = ac.product_id::INTEGER
WHERE ac.is_real_product = TRUE
AND ac.identifiant_base = 'produits'
AND ac.product_id IS NOT NULL
AND (
    ac.product_id::INTEGER != p.id
    OR p.id IS NULL
);

-- Test 3 : Statistiques globales
\echo '📊 TEST 3 : Statistiques globales...'
SELECT 
    'Services avec produits (JSONB)' as metric,
    COUNT(DISTINCT s.id)::BIGINT as count
FROM services s
WHERE s.is_active = true
AND s.data->'produits'->'valeur' IS NOT NULL
AND jsonb_typeof(s.data->'produits'->'valeur') = 'array'
AND jsonb_array_length(s.data->'produits'->'valeur') > 0

UNION ALL

SELECT 
    'Produits dans JSONB (total)' as metric,
    SUM(jsonb_array_length(s.data->'produits'->'valeur'))::BIGINT as count
FROM services s
WHERE s.is_active = true
AND s.data->'produits'->'valeur' IS NOT NULL
AND jsonb_typeof(s.data->'produits'->'valeur') = 'array'

UNION ALL

SELECT 
    'Produits dans table service_products (total)' as metric,
    COUNT(*)::BIGINT as count
FROM service_products
WHERE is_active = true

UNION ALL

SELECT 
    'Produits avec autocomplete_characteristics' as metric,
    COUNT(DISTINCT ac.product_id)::BIGINT as count
FROM autocomplete_characteristics ac
WHERE ac.is_real_product = TRUE
AND ac.identifiant_base = 'produits'
AND ac.product_id IS NOT NULL;

-- Test 4 : Vérifier services récents
\echo '📊 TEST 4 : Services récents (produits uniquement dans table)...'
SELECT 
    s.id as service_id,
    s.data->'titre_service'->>'valeur' as service_titre,
    COUNT(p.id) as produits_table,
    CASE 
        WHEN s.data->'produits' IS NULL THEN '✅ NULL (correct après suppression JSONB)'
        WHEN s.data->'produits' = 'null'::jsonb THEN '✅ NULL (correct)'
        WHEN s.data->'produits'->'valeur' IS NULL THEN '✅ VALEUR NULL (correct)'
        ELSE '⚠️ PRODUITS ENCORE DANS JSONB'
    END as status_jsonb
FROM services s
INNER JOIN service_products p ON p.service_id = s.id
WHERE s.is_active = true
AND s.created_at > NOW() - INTERVAL '7 days'
GROUP BY s.id, s.data
ORDER BY s.created_at DESC
LIMIT 10;

\echo '✅ Tests terminés !'

