-- Migration: Index de performance pour services spécialisés
-- Date: 2025-01-27
-- Description: Index composites pour optimiser les requêtes fréquentes
-- Compatible SQLx offline mode

-- ============================================================================
-- INDEX COMPOSITES POUR HÔPITAUX
-- ============================================================================

-- Index pour recherche consultations par utilisateur et statut
CREATE INDEX IF NOT EXISTS idx_hospital_consultations_user_status_date 
    ON hospital_consultations(user_id, status, appointment_date DESC);

-- Index pour recherche consultations par hôpital et date
CREATE INDEX IF NOT EXISTS idx_hospital_consultations_hospital_date_status 
    ON hospital_consultations(hospital_id, appointment_date, status);

-- Index pour recherche créneaux disponibles par hôpital, date et spécialité
CREATE INDEX IF NOT EXISTS idx_hospital_slots_hospital_date_specialty_available 
    ON hospital_slots(hospital_id, slot_date, specialty, status) 
    WHERE status = 'available';

-- Index pour analytics par hôpital et période
CREATE INDEX IF NOT EXISTS idx_hospital_analytics_hospital_date_range 
    ON hospital_analytics(hospital_id, date DESC);

-- Index pour urgences par hôpital, sévérité et statut
CREATE INDEX IF NOT EXISTS idx_hospital_emergencies_hospital_severity_status 
    ON hospital_emergencies(hospital_id, severity_level, status, arrival_time);

-- ============================================================================
-- INDEX COMPOSITES POUR PHARMACIES
-- ============================================================================

-- Index pour recherche commandes par utilisateur et statut
CREATE INDEX IF NOT EXISTS idx_pharmacy_orders_user_status_created 
    ON pharmacy_orders(user_id, status, created_at DESC);

-- Index pour recherche commandes par pharmacie et statut
CREATE INDEX IF NOT EXISTS idx_pharmacy_orders_pharmacy_status_created 
    ON pharmacy_orders(pharmacy_id, status, created_at DESC);

-- Index pour recherche réservations expirées
CREATE INDEX IF NOT EXISTS idx_pharmacy_reservations_expiry_status 
    ON pharmacy_reservations(expiry_time, status) 
    WHERE status = 'pending';

-- Index pour analytics par pharmacie et période
CREATE INDEX IF NOT EXISTS idx_pharmacy_analytics_pharmacy_date_range 
    ON pharmacy_analytics(pharmacy_id, date DESC);

-- Index pour items de commande par commande
CREATE INDEX IF NOT EXISTS idx_pharmacy_order_items_order_medication 
    ON pharmacy_order_items(order_id, medication_id);

-- ============================================================================
-- INDEX COMPOSITES POUR LABORATOIRES
-- ============================================================================

-- Index pour recherche examens par utilisateur et statut
CREATE INDEX IF NOT EXISTS idx_lab_examinations_user_status_date 
    ON lab_examinations(user_id, status, appointment_date DESC);

-- Index pour recherche examens par laboratoire et date
CREATE INDEX IF NOT EXISTS idx_lab_examinations_lab_date_status 
    ON lab_examinations(lab_id, appointment_date, status);

-- Index pour recherche types d'examens disponibles par laboratoire
CREATE INDEX IF NOT EXISTS idx_lab_examination_types_lab_available 
    ON lab_examination_types(lab_id, is_available, category) 
    WHERE is_available = TRUE;

-- Index pour analytics par laboratoire et période
CREATE INDEX IF NOT EXISTS idx_lab_analytics_lab_date_range 
    ON lab_analytics(lab_id, date DESC);

-- Index pour examens avec résultats disponibles
CREATE INDEX IF NOT EXISTS idx_lab_examinations_results_available_user 
    ON lab_examinations(user_id, results_available_at DESC) 
    WHERE results IS NOT NULL AND status = 'completed';

-- ============================================================================
-- INDEX POUR RECHERCHES GÉOLOCALISÉES (si tables existent)
-- ============================================================================

-- Index pour recherche hôpitaux par ville et disponibilité (protégé)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'hopitaux_cliniques' 
        AND column_name = 'is_available_now'
    ) THEN
        CREATE INDEX IF NOT EXISTS idx_hopitaux_cliniques_ville_available 
        ON hopitaux_cliniques(ville, is_available_now) 
        WHERE is_available_now = TRUE;
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'pharmacies' 
        AND column_name = 'is_available_now'
    ) THEN
        CREATE INDEX IF NOT EXISTS idx_pharmacies_ville_available 
        ON pharmacies(ville, is_available_now) 
        WHERE is_available_now = TRUE;
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'laboratoires' 
        AND column_name = 'is_available_now'
    ) THEN
        CREATE INDEX IF NOT EXISTS idx_laboratoires_ville_available 
        ON laboratoires(ville, is_available_now) 
        WHERE is_available_now = TRUE;
    END IF;
END $$;

-- ============================================================================
-- INDEX POUR OPTIMISATION PAGINATION
-- ============================================================================

-- Index pour pagination efficace des consultations
CREATE INDEX IF NOT EXISTS idx_hospital_consultations_pagination 
    ON hospital_consultations(created_at DESC, id) 
    WHERE status IN ('scheduled', 'confirmed', 'completed');

-- Index pour pagination efficace des commandes
CREATE INDEX IF NOT EXISTS idx_pharmacy_orders_pagination 
    ON pharmacy_orders(created_at DESC, id) 
    WHERE status IN ('pending', 'confirmed', 'ready', 'delivered');

-- Index pour pagination efficace des examens
CREATE INDEX IF NOT EXISTS idx_lab_examinations_pagination 
    ON lab_examinations(created_at DESC, id) 
    WHERE status IN ('scheduled', 'in_progress', 'completed');

-- ============================================================================
-- COMMENTAIRES
-- ============================================================================

COMMENT ON INDEX idx_hospital_consultations_user_status_date IS 
    'Optimise la recherche des consultations d''un utilisateur par statut et date';
COMMENT ON INDEX idx_pharmacy_orders_user_status_created IS 
    'Optimise la recherche des commandes d''un utilisateur par statut et date';
COMMENT ON INDEX idx_lab_examinations_user_status_date IS 
    'Optimise la recherche des examens d''un utilisateur par statut et date';

