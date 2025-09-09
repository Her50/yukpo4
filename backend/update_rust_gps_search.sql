-- Mise à jour du code Rust pour utiliser les nouvelles fonctions GPS optimisées
-- Ce script crée des fonctions de compatibilité pour le code existant

-- 1. Fonction de compatibilité pour le code Rust existant
-- Remplace la logique complexe par un appel simple à fast_text_gps_search_v2
CREATE OR REPLACE FUNCTION search_services_gps_compatible(
    search_query TEXT,
    user_gps_zone TEXT DEFAULT NULL,
    search_radius_km INTEGER DEFAULT 50,
    max_results INTEGER DEFAULT 20
)
RETURNS TABLE (
    service_id INTEGER,
    titre_service TEXT,
    category TEXT,
    gps_coords TEXT,
    distance_km DECIMAL,
    relevance_score FLOAT
) AS $$
BEGIN
    -- Utiliser la fonction optimisée
    RETURN QUERY
    SELECT * FROM fast_text_gps_search_v2(search_query, user_gps_zone, search_radius_km, max_results);
END;
$$ LANGUAGE plpgsql STABLE;

-- 2. Test de la fonction de compatibilité
SELECT 'Test search_services_gps_compatible' as test_name;
SELECT * FROM search_services_gps_compatible('restaurant', '4.0511,9.7679', 50, 5);

-- 3. Vérifier les performances
EXPLAIN (ANALYZE, BUFFERS) 
SELECT * FROM search_services_gps_compatible('restaurant', '4.0511,9.7679', 50, 5);

-- 4. Afficher un résumé des fonctions GPS disponibles
SELECT 'Fonctions GPS disponibles' as info;
SELECT 
    proname as fonction,
    prosrc as source
FROM pg_proc 
WHERE proname LIKE '%gps%' 
ORDER BY proname; 