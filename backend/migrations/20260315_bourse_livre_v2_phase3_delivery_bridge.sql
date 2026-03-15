-- Migration: Bourse du Livre V2 Phase 3 - Pont vers système de livraison intelligent
-- Date: 2026-03-15
-- Description: Intégration avec le système de matching coursier, disponibilité utilisateurs,
--              et dashboards dédiés livres scolaires

-- ============================================================================
-- 1. BRIDGE: Lier book_delivery_packages au système de livraison (deliveries)
-- ============================================================================

-- UUID de la livraison créée dans le système intelligent
ALTER TABLE book_delivery_packages ADD COLUMN IF NOT EXISTS delivery_uuid UUID;
CREATE INDEX IF NOT EXISTS idx_book_packages_delivery_uuid ON book_delivery_packages(delivery_uuid) WHERE delivery_uuid IS NOT NULL;

-- Statut du matching coursier
ALTER TABLE book_delivery_packages ADD COLUMN IF NOT EXISTS matching_status TEXT DEFAULT 'pending';
  -- 'pending' = pas encore dispatché
  -- 'searching' = en recherche de coursier
  -- 'matched' = coursier trouvé et assigné
  -- 'no_courier' = aucun coursier disponible (retry)

-- ============================================================================
-- 2. DISPONIBILITÉ UTILISATEURS (créneaux horaires)
-- ============================================================================

-- Créneaux de disponibilité pour l'expéditeur (vendeur)
ALTER TABLE book_delivery_packages ADD COLUMN IF NOT EXISTS creneau_expediteur_debut TIMESTAMPTZ;
ALTER TABLE book_delivery_packages ADD COLUMN IF NOT EXISTS creneau_expediteur_fin TIMESTAMPTZ;
ALTER TABLE book_delivery_packages ADD COLUMN IF NOT EXISTS expediteur_instructions TEXT;

-- Créneaux de disponibilité pour le destinataire (acheteur/receveur)
ALTER TABLE book_delivery_packages ADD COLUMN IF NOT EXISTS creneau_destinataire_debut TIMESTAMPTZ;
ALTER TABLE book_delivery_packages ADD COLUMN IF NOT EXISTS creneau_destinataire_fin TIMESTAMPTZ;
ALTER TABLE book_delivery_packages ADD COLUMN IF NOT EXISTS destinataire_instructions TEXT;

-- Disponibilité sur les achats directs aussi
ALTER TABLE book_purchases ADD COLUMN IF NOT EXISTS creneau_livraison_debut TIMESTAMPTZ;
ALTER TABLE book_purchases ADD COLUMN IF NOT EXISTS creneau_livraison_fin TIMESTAMPTZ;
ALTER TABLE book_purchases ADD COLUMN IF NOT EXISTS instructions_livraison TEXT;

-- ============================================================================
-- 3. ITINÉRAIRE COURSIER (multi-points)
-- ============================================================================

-- L'itinéraire est stocké en JSONB pour supporter multi-stops
-- Format: [{"type":"pickup","gps":"lat,lng","adresse":"...","user_id":123,"ordre":1},
--          {"type":"dropoff","gps":"lat,lng","adresse":"...","user_id":456,"ordre":2}]
ALTER TABLE book_delivery_packages ADD COLUMN IF NOT EXISTS itineraire JSONB;

-- ETA estimé en minutes
ALTER TABLE book_delivery_packages ADD COLUMN IF NOT EXISTS eta_minutes INTEGER;

-- Distance totale estimée en mètres
ALTER TABLE book_delivery_packages ADD COLUMN IF NOT EXISTS distance_totale_metres INTEGER;

-- ============================================================================
-- 4. NOTIFICATIONS ET TRACKING
-- ============================================================================

-- Dernière notification envoyée
ALTER TABLE book_delivery_packages ADD COLUMN IF NOT EXISTS derniere_notification_at TIMESTAMPTZ;
ALTER TABLE book_delivery_packages ADD COLUMN IF NOT EXISTS notifications_count INTEGER DEFAULT 0;

-- Position GPS temps réel du coursier (mise à jour pendant livraison)
ALTER TABLE book_delivery_packages ADD COLUMN IF NOT EXISTS coursier_gps_actuel TEXT;
ALTER TABLE book_delivery_packages ADD COLUMN IF NOT EXISTS coursier_gps_updated_at TIMESTAMPTZ;

-- ============================================================================
-- 5. INDEX PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_book_packages_matching ON book_delivery_packages(matching_status, statut)
    WHERE matching_status != 'matched';
CREATE INDEX IF NOT EXISTS idx_book_packages_coursier_actif ON book_delivery_packages(coursier_id, statut)
    WHERE coursier_id IS NOT NULL AND statut IN ('constitue', 'en_route');
CREATE INDEX IF NOT EXISTS idx_book_packages_destinataire ON book_delivery_packages(destinataire_id, statut);
CREATE INDEX IF NOT EXISTS idx_book_packages_expediteur ON book_delivery_packages(expediteur_id, statut);
CREATE INDEX IF NOT EXISTS idx_book_purchases_creneau ON book_purchases(creneau_livraison_debut)
    WHERE creneau_livraison_debut IS NOT NULL;

-- ============================================================================
-- COMMENTAIRES
-- ============================================================================

COMMENT ON COLUMN book_delivery_packages.delivery_uuid IS 'UUID de la livraison dans le système intelligent (table deliveries)';
COMMENT ON COLUMN book_delivery_packages.matching_status IS 'Statut du matching coursier: pending, searching, matched, no_courier';
COMMENT ON COLUMN book_delivery_packages.creneau_expediteur_debut IS 'Début du créneau de disponibilité de l''expéditeur';
COMMENT ON COLUMN book_delivery_packages.itineraire IS 'Points de passage du coursier [{type,gps,adresse,user_id,ordre}]';
COMMENT ON COLUMN book_delivery_packages.coursier_gps_actuel IS 'Position GPS temps réel du coursier pendant la livraison';
