-- Migration pour optimiser recherche hôpitaux et laboratoires (scalabilité horizontale)
-- Date: 2025-01-28
-- Objectif: Ajouter index pour performance recherche avec filtres multiples
-- Note: Index partiels pour optimiser les recherches fréquentes

-- ============================================================================
-- INDEX POUR HÔPITAUX - Optimisation recherche avec filtres multiples
-- ============================================================================

-- Index pour recherche GPS avec disponibilité
CREATE INDEX IF NOT EXISTS idx_hospitals_gps_active ON hopitaux_cliniques
    (gps)
    WHERE gps IS NOT NULL AND is_available_now = true AND is_active = true;

-- Index GIN pour prestations_medicales (recherche par prestation)
CREATE INDEX IF NOT EXISTS idx_hospitals_prestations_gin ON hopitaux_cliniques
    USING GIN(prestations_medicales)
    WHERE is_active = true;

-- Index composite pour recherche urgences + disponibilité
CREATE INDEX IF NOT EXISTS idx_hospitals_urgences ON hopitaux_cliniques
    (urgences_disponible, is_available_now)
    WHERE urgences_disponible = true AND is_active = true;

-- Index pour recherche par ville/quartier
CREATE INDEX IF NOT EXISTS idx_hospitals_ville_quartier ON hopitaux_cliniques
    (ville, quartier)
    WHERE is_active = true;

-- Index pour recherche par type d'établissement
CREATE INDEX IF NOT EXISTS idx_hospitals_type_etablissement ON hopitaux_cliniques
    (type_etablissement)
    WHERE is_active = true;

-- Index composite pour recherche disponible + récent
CREATE INDEX IF NOT EXISTS idx_hospitals_available_composite ON hopitaux_cliniques
    (is_available_now, updated_at DESC)
    WHERE is_available_now = true AND is_active = true;

-- ============================================================================
-- INDEX POUR LABORATOIRES - Optimisation recherche avec filtres multiples
-- ============================================================================

-- Index pour recherche GPS avec disponibilité
CREATE INDEX IF NOT EXISTS idx_labs_gps_active ON laboratoires_imagerie
    (gps)
    WHERE gps IS NOT NULL AND is_available_now = true AND is_active = true;

-- Index GIN pour analyses_disponibles (recherche par analyse)
CREATE INDEX IF NOT EXISTS idx_labs_analyses_gin ON laboratoires_imagerie
    USING GIN(analyses_disponibles)
    WHERE is_active = true;

-- Index GIN pour imagerie_disponible (recherche par type d'imagerie)
CREATE INDEX IF NOT EXISTS idx_labs_imagerie_gin ON laboratoires_imagerie
    USING GIN(imagerie_disponible)
    WHERE is_active = true;

-- Index pour recherche par ville/quartier
CREATE INDEX IF NOT EXISTS idx_labs_ville_quartier ON laboratoires_imagerie
    (ville, quartier)
    WHERE is_active = true;

-- Index pour recherche par type de laboratoire
CREATE INDEX IF NOT EXISTS idx_labs_type_laboratoire ON laboratoires_imagerie
    (type_laboratoire)
    WHERE is_active = true;

-- Index composite pour recherche disponible + récent
CREATE INDEX IF NOT EXISTS idx_labs_available_composite ON laboratoires_imagerie
    (is_available_now, updated_at DESC)
    WHERE is_available_now = true AND is_active = true;

-- ============================================================================
-- COMMENTAIRES
-- ============================================================================

COMMENT ON INDEX idx_hospitals_gps_active IS 'Index pour recherche GPS avec disponibilité';
COMMENT ON INDEX idx_hospitals_prestations_gin IS 'Index GIN pour recherche par prestation médicale';
COMMENT ON INDEX idx_hospitals_urgences IS 'Index composite pour recherche urgences disponibles';
COMMENT ON INDEX idx_hospitals_ville_quartier IS 'Index pour recherche par ville/quartier';
COMMENT ON INDEX idx_hospitals_type_etablissement IS 'Index pour filtre par type d''établissement';
COMMENT ON INDEX idx_hospitals_available_composite IS 'Index composite pour recherche hôpitaux disponibles et récents';

COMMENT ON INDEX idx_labs_gps_active IS 'Index pour recherche GPS avec disponibilité';
COMMENT ON INDEX idx_labs_analyses_gin IS 'Index GIN pour recherche par analyse';
COMMENT ON INDEX idx_labs_imagerie_gin IS 'Index GIN pour recherche par type d''imagerie';
COMMENT ON INDEX idx_labs_ville_quartier IS 'Index pour recherche par ville/quartier';
COMMENT ON INDEX idx_labs_type_laboratoire IS 'Index pour filtre par type de laboratoire';
COMMENT ON INDEX idx_labs_available_composite IS 'Index composite pour recherche laboratoires disponibles et récents';

