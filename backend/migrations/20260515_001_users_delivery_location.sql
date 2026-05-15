-- Migration : ajoute le lieu de livraison persistant + numéro WhatsApp secondaire
-- Date : 2026-05-15
--
-- Workflow associé : au 1er login, le user remplit sa zone de livraison
-- (autocomplete Photon : rue, POI, quartier) + confirme/édite son WhatsApp.
-- Une fois saved, l'app ne demande PLUS jamais ces infos (ni de GPS à chaque
-- action). Le lieu est utilisé pour Troc, Vendre, Recap, etc.

BEGIN;

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS delivery_location_text TEXT,
    ADD COLUMN IF NOT EXISTS delivery_location_lat DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS delivery_location_lng DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS delivery_location_saved_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS whatsapp_number_secondary VARCHAR(20);

COMMENT ON COLUMN users.delivery_location_text IS
    'Lieu de livraison textuel choisi par l''user (ex: "Carrefour Mvog-Ada, Yaoundé"). Source de vérité.';
COMMENT ON COLUMN users.delivery_location_lat IS
    'Latitude associée au lieu de livraison (Photon/OSM).';
COMMENT ON COLUMN users.delivery_location_lng IS
    'Longitude associée au lieu de livraison (Photon/OSM).';
COMMENT ON COLUMN users.delivery_location_saved_at IS
    'Timestamp de la dernière sauvegarde. NULL = onboarding non fait.';
COMMENT ON COLUMN users.whatsapp_number_secondary IS
    'Numéro WhatsApp secondaire optionnel (conjoint, autre contact familial).';

COMMIT;
