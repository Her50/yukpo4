-- Migration: Création de la table publicites pour le système de publicité payante
-- Date: 2025-10-21
-- Description: Table pour gérer les publicités des prestataires avec tracking analytics

-- ✅ Vérifier que PostGIS est disponible (doit être créé par migration 20250830_002)
-- CREATE EXTENSION IF NOT EXISTS postgis;

-- ✅ Créer la table publicites
CREATE TABLE IF NOT EXISTS publicites (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Informations de base
    titre VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Produits indexés (format: 'serviceId_productIndex')
    produits_indexes TEXT[] NOT NULL DEFAULT '{}',
    
    -- Médias publicitaires (stockés en base64)
    videos TEXT[] DEFAULT '{}', -- Array de vidéos en base64
    thumbnails TEXT[] DEFAULT '{}', -- Array de miniatures en base64
    
    -- Tarification et durée
    duree_jours INTEGER NOT NULL CHECK (duree_jours > 0),
    cout INTEGER NOT NULL CHECK (cout >= 0), -- En FCFA (centimes)
    devise_utilisateur VARCHAR(10) DEFAULT 'FCFA',
    
    -- Zone géographique d'impact
    zone_geographique VARCHAR(50) NOT NULL DEFAULT 'local' CHECK (zone_geographique IN ('local', 'regional', 'international')),
    geo_publicitaire GEOMETRY(POINT, 4326), -- Coordonnées GPS PostGIS (SRID 4326 = WGS84)
    rayon_km INTEGER DEFAULT 50, -- Rayon en km (pour zone locale)
    
    -- Status et lifecycle
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'pending', 'paused')),
    date_debut TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    date_fin TIMESTAMPTZ NOT NULL,
    
    -- Analytics et tracking
    vues INTEGER NOT NULL DEFAULT 0,
    clics INTEGER NOT NULL DEFAULT 0,
    impressions INTEGER NOT NULL DEFAULT 0, -- Nombre d'affichages dans le carousel
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Contraintes
    CONSTRAINT check_date_fin_after_debut CHECK (date_fin > date_debut),
    CONSTRAINT check_produits_not_empty CHECK (array_length(produits_indexes, 1) > 0)
);

-- ✅ Index pour performances
CREATE INDEX IF NOT EXISTS idx_publicites_user_id ON publicites(user_id);
CREATE INDEX IF NOT EXISTS idx_publicites_status ON publicites(status);
CREATE INDEX IF NOT EXISTS idx_publicites_zone ON publicites(zone_geographique);
CREATE INDEX IF NOT EXISTS idx_publicites_date_fin ON publicites(date_fin);
CREATE INDEX IF NOT EXISTS idx_publicites_active ON publicites(status, date_fin) WHERE status = 'active';

-- ✅ Index spatial pour geo_publicitaire (nécessite PostGIS)
CREATE INDEX IF NOT EXISTS idx_publicites_geo ON publicites USING GIST(geo_publicitaire) WHERE geo_publicitaire IS NOT NULL;

-- ✅ Index GIN pour recherche dans produits_indexes
CREATE INDEX IF NOT EXISTS idx_publicites_produits_gin ON publicites USING GIN(produits_indexes);

-- ✅ Fonction pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_publicites_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_publicites_updated_at ON publicites;
CREATE TRIGGER trigger_update_publicites_updated_at
    BEFORE UPDATE ON publicites
    FOR EACH ROW
    EXECUTE FUNCTION update_publicites_updated_at();

-- ✅ Fonction pour calculer automatiquement date_fin
CREATE OR REPLACE FUNCTION set_publicite_date_fin()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.date_fin IS NULL OR NEW.date_fin = NEW.date_debut THEN
        NEW.date_fin = NEW.date_debut + (NEW.duree_jours || ' days')::interval;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_publicite_date_fin ON publicites;
CREATE TRIGGER trigger_set_publicite_date_fin
    BEFORE INSERT OR UPDATE ON publicites
    FOR EACH ROW
    EXECUTE FUNCTION set_publicite_date_fin();

-- ✅ Fonction pour désactiver automatiquement les publicités expirées
CREATE OR REPLACE FUNCTION deactivate_expired_publicites()
RETURNS INTEGER AS $$
DECLARE
    affected_count INTEGER;
BEGIN
    UPDATE publicites
    SET status = 'expired'
    WHERE status = 'active'
    AND date_fin < NOW();
    
    GET DIAGNOSTICS affected_count = ROW_COUNT;
    RETURN affected_count;
END;
$$ LANGUAGE plpgsql;

-- ✅ Commentaires pour documentation
COMMENT ON TABLE publicites IS 'Table pour gérer les publicités payantes des prestataires';
COMMENT ON COLUMN publicites.produits_indexes IS 'Array des produits indexés (format: serviceId_productIndex)';
COMMENT ON COLUMN publicites.videos IS 'Array des vidéos promotionnelles en base64';
COMMENT ON COLUMN publicites.thumbnails IS 'Array des miniatures des vidéos en base64';
COMMENT ON COLUMN publicites.zone_geographique IS 'Portée géographique: local (ville), regional (pays), international';
COMMENT ON COLUMN publicites.geo_publicitaire IS 'Coordonnées GPS du centre de la zone publicitaire';
COMMENT ON COLUMN publicites.rayon_km IS 'Rayon de diffusion en km (pour zone locale)';
COMMENT ON COLUMN publicites.vues IS 'Nombre de fois où la publicité a été vue';
COMMENT ON COLUMN publicites.clics IS 'Nombre de clics sur la publicité';
COMMENT ON COLUMN publicites.impressions IS 'Nombre d''affichages dans le carousel';

-- ✅ Créer quelques publicités de test (optionnel)
-- INSERT INTO publicites (user_id, titre, description, produits_indexes, duree_jours, cout, zone_geographique, geo_publicitaire, date_debut, date_fin)
-- VALUES 
-- (1, 'Promotion Immobilier -20%', 'Réduction sur tous nos biens immobiliers', ARRAY['12_0', '12_1'], 30, 15000, 'local', POINT(4.0511, 9.7679), NOW(), NOW() + INTERVAL '30 days'),
-- (2, 'Flash Auto - Liquidation', 'Véhicules à prix cassés!', ARRAY['15_0'], 14, 7000, 'regional', POINT(4.0604, 9.7135), NOW(), NOW() + INTERVAL '14 days');

