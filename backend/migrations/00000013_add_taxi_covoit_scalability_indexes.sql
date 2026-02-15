-- Migration pour optimiser recherche taxis et covoiturages (scalabilité horizontale)
-- Date: 2025-01-28
-- Objectif: Ajouter index pour performance recherche avec filtres multiples
-- Note: Index partiels pour optimiser les recherches fréquentes

-- ============================================================================
-- INDEX POUR TAXIS - Optimisation recherche avec filtres multiples
-- ============================================================================

-- Note: L'index GIN pour zone_intervention (TEXT[]) est déjà créé dans 20251126
-- (idx_taxis_zone_gin). Pas besoin de le recréer ici.

-- Index composite pour recherche disponible + on_duty + récent
CREATE INDEX IF NOT EXISTS idx_taxis_available_composite ON taxis_ville
    (is_available_now, is_on_duty, updated_at DESC) 
    WHERE is_available_now = true AND is_on_duty = true AND is_active = true;

-- Index pour recherche GPS avec disponibilité
CREATE INDEX IF NOT EXISTS idx_taxis_gps_active ON taxis_ville
    (gps_actuel) 
    WHERE gps_actuel IS NOT NULL AND is_available_now = true AND is_active = true;

-- Index pour recherche par type de véhicule
CREATE INDEX IF NOT EXISTS idx_taxis_type_vehicule ON taxis_ville
    (type_vehicule) 
    WHERE is_active = true AND is_available_now = true;

-- ============================================================================
-- INDEX POUR COVOITURAGES - Optimisation recherche avec filtres multiples
-- ============================================================================

-- Index composite pour recherche départ + destination + date
CREATE INDEX IF NOT EXISTS idx_covoit_depart_dest_date ON covoiturages
    (depart, destination, date_depart ASC) 
    WHERE is_active = true AND statut = 'ouvert' AND places_disponibles > 0;

-- Index pour recherche trajets futurs (sans CURRENT_DATE car non-immutable)
-- Note: PostgreSQL utilisera cet index efficacement pour les requêtes avec date_depart >= CURRENT_DATE
CREATE INDEX IF NOT EXISTS idx_covoit_date_future ON covoiturages
    (date_depart ASC) 
    WHERE is_active = true AND statut = 'ouvert';

-- Index pour recherche par places disponibles (tri par disponibilité)
CREATE INDEX IF NOT EXISTS idx_covoit_places_available ON covoiturages
    (places_disponibles DESC, date_depart ASC) 
    WHERE places_disponibles > 0 AND is_active = true AND statut = 'ouvert';

-- Index composite pour recherche par prix maximum
CREATE INDEX IF NOT EXISTS idx_covoit_prix_date ON covoiturages
    (prix_par_place ASC, date_depart ASC) 
    WHERE is_active = true AND statut = 'ouvert' AND places_disponibles > 0;

-- Index pour recherche par conducteur (mes trajets)
CREATE INDEX IF NOT EXISTS idx_covoit_user_date ON covoiturages
    (user_id, date_depart DESC, created_at DESC) 
    WHERE is_active = true;

-- ============================================================================
-- COMMENTAIRES
-- ============================================================================

COMMENT ON INDEX idx_taxis_available_composite IS 'Index composite pour recherche taxis disponibles et en service';
COMMENT ON INDEX idx_taxis_gps_active IS 'Index pour recherche GPS avec disponibilité';
COMMENT ON INDEX idx_taxis_type_vehicule IS 'Index pour filtre par type de véhicule';
COMMENT ON INDEX idx_covoit_depart_dest_date IS 'Index composite pour recherche départ/destination/date';
COMMENT ON INDEX idx_covoit_date_future IS 'Index pour recherche trajets futurs uniquement';
COMMENT ON INDEX idx_covoit_places_available IS 'Index pour tri par places disponibles';
COMMENT ON INDEX idx_covoit_prix_date IS 'Index pour recherche par prix maximum';
COMMENT ON INDEX idx_covoit_user_date IS 'Index pour liste "mes trajets" (conducteur)';

