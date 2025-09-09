-- Migration: Ajout de PostGIS et fonctionnalités géospatiales avancées
-- Base de données: yukpo_db
-- Utilisateur: postgres

\c yukpo_db;

-- 1. Installation de l'extension PostGIS
CREATE EXTENSION IF NOT EXISTS postgis;

-- 2. Ajout de colonnes géospatiales optimisées
ALTER TABLE services 
ADD COLUMN IF NOT EXISTS location_geom GEOMETRY(POINT, 4326),
ADD COLUMN IF NOT EXISTS location_geog GEOGRAPHY(POINT, 4326),
ADD COLUMN IF NOT EXISTS search_radius INTEGER DEFAULT 50000; -- Rayon de recherche en mètres

-- 3. Création d'index géospatial optimisés
CREATE INDEX IF NOT EXISTS idx_services_location_geom ON services USING GIST (location_geom);
CREATE INDEX IF NOT EXISTS idx_services_location_geog ON services USING GIST (location_geog);
CREATE INDEX IF NOT EXISTS idx_services_gps_trgm ON services USING GIN (gps gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_services_gps_fixe_trgm ON services USING GIN ((data->>'gps_fixe') gin_trgm_ops);

-- 4. Index composite pour la recherche géospatiale + catégorie
CREATE INDEX IF NOT EXISTS idx_services_geo_category ON services (category, location_geom) 
WHERE location_geom IS NOT NULL;

-- 5. Index pour la recherche par rayon
CREATE INDEX IF NOT EXISTS idx_services_search_radius ON services (search_radius, location_geom) 
WHERE location_geom IS NOT NULL;

-- 6. Fonction pour convertir les coordonnées GPS en géométrie PostGIS
CREATE OR REPLACE FUNCTION convert_gps_to_geometry(gps_text TEXT)
RETURNS GEOMETRY AS $$
DECLARE
    lat DECIMAL;
    lng DECIMAL;
BEGIN
    -- Vérifier le format "lat,lng"
    IF gps_text ~ '^-?\d+\.?\d*,-?\d+\.?\d*$' THEN
        lat := CAST(SPLIT_PART(gps_text, ',', 1) AS DECIMAL);
        lng := CAST(SPLIT_PART(gps_text, ',', 2) AS DECIMAL);
        
        -- Vérifier les limites géographiques
        IF lat BETWEEN -90 AND 90 AND lng BETWEEN -180 AND 180 THEN
            RETURN ST_SetSRID(ST_MakePoint(lng, lat), 4326);
        END IF;
    END IF;
    
    RETURN NULL;
EXCEPTION
    WHEN OTHERS THEN
        RETURN NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 7. Fonction pour calculer la distance entre deux points
CREATE OR REPLACE FUNCTION calculate_distance_km(
    lat1 DECIMAL, lng1 DECIMAL, 
    lat2 DECIMAL, lng2 DECIMAL
)
RETURNS DECIMAL AS $$
BEGIN
    RETURN ST_Distance(
        ST_SetSRID(ST_MakePoint(lng1, lat1), 4326)::geography,
        ST_SetSRID(ST_MakePoint(lng2, lat2), 4326)::geography
    ) / 1000.0; -- Conversion en kilomètres
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 8. Fonction pour rechercher les services dans un rayon
CREATE OR REPLACE FUNCTION search_services_in_radius(
    search_lat DECIMAL,
    search_lng DECIMAL,
    radius_km INTEGER DEFAULT 50,
    category_filter TEXT DEFAULT NULL
)
RETURNS TABLE(
    id INTEGER,
    titre_service TEXT,
    category TEXT,
    distance_km DECIMAL,
    location_type TEXT,
    gps_coords TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.id,
        s.data->>'titre_service' as titre_service,
        COALESCE(s.category, s.data->'category'->>'valeur') as category,
        ST_Distance(
            ST_SetSRID(ST_MakePoint(search_lng, search_lat), 4326)::geography,
            COALESCE(s.location_geog, s.location_geom::geography)
        ) / 1000.0 as distance_km,
        CASE 
            WHEN s.data->>'gps_fixe' IS NOT NULL THEN 'gps_fixe'
            WHEN s.gps IS NOT NULL THEN 'gps_prestataire'
            ELSE 'adresse'
        END as location_type,
        COALESCE(s.data->>'gps_fixe', s.gps) as gps_coords
    FROM services s
    WHERE s.is_active = true
    AND (
        s.location_geom IS NOT NULL OR 
        s.location_geog IS NOT NULL OR
        s.gps IS NOT NULL OR
        s.data->>'gps_fixe' IS NOT NULL
    )
    AND (
        category_filter IS NULL OR 
        s.category = category_filter OR 
        s.data->'category'->>'valeur' = category_filter
    )
    AND (
        s.location_geog IS NOT NULL AND
        ST_DWithin(
            ST_SetSRID(ST_MakePoint(search_lng, search_lat), 4326)::geography,
            s.location_geog,
            radius_km * 1000
        )
        OR
        s.location_geom IS NOT NULL AND
        ST_DWithin(
            ST_SetSRID(ST_MakePoint(search_lng, lat1), 4326)::geography,
            s.location_geom::geography,
            radius_km * 1000
        )
        OR
        (s.gps IS NOT NULL OR s.data->>'gps_fixe' IS NOT NULL) AND
        calculate_distance_km(
            search_lat, search_lng,
            CAST(SPLIT_PART(COALESCE(s.data->>'gps_fixe', s.gps), ',', 1) AS DECIMAL),
            CAST(SPLIT_PART(COALESCE(s.data->>'gps_fixe', s.gps), ',', 2) AS DECIMAL)
        ) <= radius_km
    )
    ORDER BY distance_km ASC;
END;
$$ LANGUAGE plpgsql STABLE;

-- 9. Déclencheur pour maintenir les colonnes géospatiales à jour
CREATE OR REPLACE FUNCTION update_service_geospatial()
RETURNS TRIGGER AS $$
BEGIN
    -- Mettre à jour location_geom et location_geog quand gps ou gps_fixe change
    IF NEW.gps IS DISTINCT FROM OLD.gps OR 
       NEW.data->>'gps_fixe' IS DISTINCT FROM OLD.data->>'gps_fixe' THEN
        
        -- Mettre à jour location_geom
        NEW.location_geom := COALESCE(
            convert_gps_to_geometry(NEW.data->>'gps_fixe'),
            convert_gps_to_geometry(NEW.gps)
        );
        
        -- Mettre à jour location_geog
        IF NEW.location_geom IS NOT NULL THEN
            NEW.location_geog := NEW.location_geom::geography;
        ELSE
            NEW.location_geog := NULL;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 10. Création du déclencheur
DROP TRIGGER IF EXISTS trigger_update_service_geospatial ON services;
CREATE TRIGGER trigger_update_service_geospatial
    BEFORE INSERT OR UPDATE ON services
    FOR EACH ROW
    EXECUTE FUNCTION update_service_geospatial();

-- 11. Mise à jour des données existantes
UPDATE services 
SET 
    location_geom = convert_gps_to_geometry(COALESCE(data->>'gps_fixe', gps)),
    location_geog = convert_gps_to_geometry(COALESCE(data->>'gps_fixe', gps))::geography
WHERE (data->>'gps_fixe' IS NOT NULL OR gps IS NOT NULL)
AND location_geom IS NULL;

-- 12. Vérification des extensions installées
SELECT 
    extname as extension,
    extversion as version
FROM pg_extension 
WHERE extname IN ('postgis', 'pg_trgm');

-- 13. Vérification des index créés
SELECT 
    indexname,
    tablename,
    indexdef
FROM pg_indexes 
WHERE tablename = 'services' 
AND indexname LIKE '%geo%' OR indexname LIKE '%gps%'
ORDER BY indexname;

-- 14. Statistiques des colonnes géospatiales
SELECT 
    COUNT(*) as total_services,
    COUNT(location_geom) as with_geometry,
    COUNT(location_geog) as with_geography,
    COUNT(gps) as with_gps,
    COUNT(data->>'gps_fixe') as with_gps_fixe
FROM services; 