-- ===================================================================
-- SCRIPT COMPLET : Diagnostic + Correction autocomplete_combinations
-- Date: 2025-11-04
-- ===================================================================

\echo '🔍 ========== ÉTAPE 1: DIAGNOSTIC =========='
\echo ''

-- Vérifier si la table existe
\echo '📊 Table autocomplete_combinations...'
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'autocomplete_combinations') 
        THEN '✅ EXISTE' 
        ELSE '❌ MANQUANTE' 
    END as table_status;

-- Compter les enregistrements
\echo ''
\echo '📊 Nombre d''enregistrements...'
SELECT COUNT(*) as total_rows FROM autocomplete_combinations;

\echo ''
\echo '🔍 ========== ÉTAPE 2: VÉRIFICATION CONTRAINTES =========='
\echo ''

-- Lister les contraintes
SELECT 
    conname as constraint_name,
    contype as constraint_type
FROM pg_constraint
WHERE conrelid = 'autocomplete_combinations'::regclass;

\echo ''
\echo '🔍 ========== ÉTAPE 3: CORRECTION CONTRAINTES =========='
\echo ''

-- Supprimer l'ancienne contrainte sur full_vector
ALTER TABLE autocomplete_combinations 
DROP CONSTRAINT IF EXISTS unique_full_vector;

\echo '✅ Contrainte unique_full_vector supprimée'
\echo ''

-- Créer index unique sur product_vector (ce que le code Rust attend)
DROP INDEX IF EXISTS idx_combinations_product_vector_unique;
CREATE UNIQUE INDEX idx_combinations_product_vector_unique 
    ON autocomplete_combinations(product_vector);

\echo '✅ Index unique sur product_vector créé'
\echo ''

\echo '🔍 ========== ÉTAPE 4: INSERTION DONNÉES DE TEST =========='
\echo ''

-- Insérer des combinaisons de test
INSERT INTO autocomplete_combinations 
(product_vector, product_labels, usage_count, prix, has_variant, is_ai_preferred, created_at, updated_at)
VALUES 
    -- Smartphones populaires
    (ARRAY['Samsung', 'Galaxy S24', 'Noir', '128GB', 'Neuf'], 
     ARRAY['marque', 'modele', 'couleur', 'stockage', 'etat'],
     15, 450000, false, true, NOW(), NOW()),
    
    (ARRAY['Apple', 'iPhone 14 Pro', 'Noir', '256GB', 'Comme neuf'],
     ARRAY['marque', 'modele', 'couleur', 'stockage', 'etat'],
     12, 650000, false, true, NOW(), NOW()),
    
    (ARRAY['Apple', 'iPhone 13', 'Bleu', '128GB', 'Neuf'],
     ARRAY['marque', 'modele', 'couleur', 'stockage', 'etat'],
     8, 550000, false, false, NOW(), NOW()),
    
    -- Chaussures populaires
    (ARRAY['Nike', 'Air Max', 'Blanc', '42', 'Neuf'],
     ARRAY['marque', 'modele', 'couleur', 'pointure', 'etat'],
     20, 45000, true, true, NOW(), NOW()),
    
    (ARRAY['Adidas', 'Superstar', 'Noir', '40', 'Bon état'],
     ARRAY['marque', 'modele', 'couleur', 'pointure', 'etat'],
     10, 35000, true, false, NOW(), NOW()),
    
    (ARRAY['Nike', 'Air Force 1', 'Blanc', '41', 'Neuf'],
     ARRAY['marque', 'modele', 'couleur', 'pointure', 'etat'],
     18, 50000, true, true, NOW(), NOW()),
    
    -- Immobilier
    (ARRAY['Studio', 'Meublé', '1 pièce', 'Climatisé', 'Disponible'],
     ARRAY['type', 'equipement', 'pieces', 'confort', 'disponibilite'],
     25, 75000, false, true, NOW(), NOW()),
    
    (ARRAY['Appartement', '2 chambres', 'Non meublé', 'Douche', 'Cuisine équipée'],
     ARRAY['type', 'chambres', 'meuble', 'sdb', 'cuisine'],
     12, 120000, false, true, NOW(), NOW()),
    
    (ARRAY['Studio', 'Non meublé', '1 pièce', 'Eau courante', 'Electricité'],
     ARRAY['type', 'equipement', 'pieces', 'eau', 'energie'],
     8, 60000, false, false, NOW(), NOW()),
    
    -- Ordinateurs
    (ARRAY['HP', 'Pavilion', '15 pouces', '8GB RAM', 'Windows 11'],
     ARRAY['marque', 'modele', 'taille', 'ram', 'os'],
     6, 350000, false, false, NOW(), NOW()),
    
    (ARRAY['Dell', 'Inspiron', '14 pouces', '16GB RAM', 'Windows 11'],
     ARRAY['marque', 'modele', 'taille', 'ram', 'os'],
     4, 450000, false, false, NOW(), NOW()),
    
    -- Véhicules
    (ARRAY['Toyota', 'Corolla', '2020', 'Automatique', 'Essence'],
     ARRAY['marque', 'modele', 'annee', 'transmission', 'carburant'],
     7, 8500000, false, true, NOW(), NOW()),
    
    (ARRAY['Toyota', 'Hilux', '2022', 'Manuelle', 'Diesel'],
     ARRAY['marque', 'modele', 'annee', 'transmission', 'carburant'],
     5, 15000000, false, true, NOW(), NOW())

ON CONFLICT (product_vector) 
DO UPDATE SET 
    usage_count = autocomplete_combinations.usage_count + 1,
    updated_at = NOW();

\echo ''
\echo '🔍 ========== ÉTAPE 5: VÉRIFICATION FINALE =========='
\echo ''

-- Compter les résultats
SELECT 
    COUNT(*) as total_produits,
    COUNT(CASE WHEN usage_count >= 2 THEN 1 END) as produits_populaires,
    MAX(usage_count) as max_usage_count
FROM autocomplete_combinations;

\echo ''
\echo '📦 TOP 5 produits les plus populaires :'
SELECT 
    product_vector,
    product_labels,
    usage_count,
    prix
FROM autocomplete_combinations
ORDER BY usage_count DESC
LIMIT 5;

\echo ''
\echo '✅ ========== CORRECTION TERMINÉE =========='
\echo ''
\echo '💡 Testez maintenant le champ "Caractéristiques produit" dans le formulaire'
\echo '   Tapez "Nike", "Studio", "Samsung" ou "Toyota" pour voir les suggestions'

