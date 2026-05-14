-- Workflow "Demande de disponibilité" (RFQ pharmacie) :
--
-- 1. Utilisateur émet une alerte avec une liste de médicaments + sa position
-- 2. Le backend broadcast l'alerte aux pharmacies dans le rayon (5 km par défaut)
--    via push web + WhatsApp
-- 3. Chaque pharmacie peut valider manuellement la disponibilité (case à cocher
--    par médicament + prix + alternatives proposées)
-- 4. L'utilisateur voit les pharmacies classées par taux de complétude
--    (5/5 > 3/5 > 1/5) en temps réel
-- 5. À l'expiration (5 min), si aucune pharmacie n'a 100% des médicaments :
--    fallback sur l'historique récent des pharmacies du rayon, et option
--    "Élargir le rayon" affichée à l'utilisateur.
--
-- Les pharmaciens locaux ne veulent PAS partager leur catalogue : ce workflow
-- leur laisse le contrôle total — pas de stock public, validation à la demande.

-- Table principale : une alerte = un broadcast de demande de disponibilité
CREATE TABLE IF NOT EXISTS medication_alerts (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    -- Liste des médicaments demandés. Format JSONB pour flexibilité :
    -- [{name: "Doliprane 500mg", quantity?: 2, dosage?: "500mg"}, ...]
    query_items JSONB NOT NULL,
    total_items INTEGER NOT NULL,
    -- Géolocalisation du demandeur (centre du rayon de broadcast)
    gps_lat DOUBLE PRECISION NOT NULL,
    gps_lng DOUBLE PRECISION NOT NULL,
    radius_km REAL NOT NULL DEFAULT 5.0,
    -- Statut : open (en cours) → closed (expirée, on a affiché les résultats)
    status VARCHAR(20) NOT NULL DEFAULT 'open',
    -- 5 min par défaut. Configurable via le front (urgent / aujourd'hui /
    -- cette semaine plus tard si besoin).
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '5 minutes'),
    closed_at TIMESTAMPTZ,
    -- Stocke combien de pharmacies ont été notifiées au broadcast (pour
    -- afficher "X pharmacies notifiées, en attente de réponses…")
    notified_pharmacies_count INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT medication_alerts_status_check
        CHECK (status IN ('open', 'closed', 'expired', 'cancelled'))
);

CREATE INDEX IF NOT EXISTS idx_medication_alerts_user
    ON medication_alerts (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_medication_alerts_open
    ON medication_alerts (status, expires_at) WHERE status = 'open';

-- Table des réponses : une réponse = une pharmacie valide une alerte
CREATE TABLE IF NOT EXISTS pharmacy_responses (
    id BIGSERIAL PRIMARY KEY,
    alert_id BIGINT NOT NULL REFERENCES medication_alerts(id) ON DELETE CASCADE,
    pharmacy_id INTEGER NOT NULL REFERENCES pharmacies(id) ON DELETE CASCADE,
    pharmacy_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    -- Statut item par item :
    --   [{name: "Doliprane 500mg", available: true,  price: 1200, note?: ""},
    --    {name: "Spasfon",        available: false, alt: ["Phloroglucinol gé"]}]
    items_status JSONB NOT NULL,
    -- Cache du nombre d'items disponibles → tri rapide par complétude
    found_count INTEGER NOT NULL DEFAULT 0,
    -- Alternatives proposées par le pharmacien pour les médicaments
    -- indisponibles. N'entrent PAS dans le calcul de complétude mais affichées
    -- au patient comme suggestion. Format : [{original: "Smecta", alt: "Diosmectite générique"}]
    alternatives JSONB,
    responded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Une pharmacie ne peut répondre qu'une fois par alerte (peut éditer en UPDATE)
    CONSTRAINT pharmacy_responses_unique UNIQUE (alert_id, pharmacy_id)
);

CREATE INDEX IF NOT EXISTS idx_pharmacy_responses_alert
    ON pharmacy_responses (alert_id, found_count DESC);
CREATE INDEX IF NOT EXISTS idx_pharmacy_responses_pharmacy
    ON pharmacy_responses (pharmacy_id, responded_at DESC);

-- Archivage des ordonnances scannées par les pharmaciens.
-- Cas d'usage : un patient revient avec un problème ("son traitement n'a pas
-- marché"), le pharmacien tape son nom et retrouve l'ordonnance scannée.
CREATE TABLE IF NOT EXISTS pharmacy_archived_prescriptions (
    id BIGSERIAL PRIMARY KEY,
    pharmacy_id INTEGER NOT NULL REFERENCES pharmacies(id) ON DELETE CASCADE,
    pharmacy_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    -- Identité patient — minimum nécessaire pour retrouver. Pas de NIU/CNI
    -- (données sensibles) sauf si l'utilisateur le saisit explicitement.
    patient_name VARCHAR(255) NOT NULL,
    patient_phone VARCHAR(50),
    patient_notes TEXT,
    -- Image scannée. Stockée en base64 dans un champ TEXT pour MVP — à
    -- migrer vers S3/Wasabi quand le volume augmentera. Limite frontend
    -- à ~5MB par image.
    image_base64 TEXT,
    image_mime VARCHAR(50),
    -- Liste des médicaments extraits par IA au moment du scan (pré-rempli mais
    -- éditable par le pharmacien) : [{name, dosage, posologie?}]
    extracted_medications JSONB,
    -- Date de l'ordonnance (peut être différente du scan si scannée a posteriori)
    prescription_date DATE,
    scanned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index pour recherche rapide par nom patient (LIKE sur lower(patient_name))
CREATE INDEX IF NOT EXISTS idx_pharmacy_archives_patient_lower
    ON pharmacy_archived_prescriptions (pharmacy_id, lower(patient_name));
CREATE INDEX IF NOT EXISTS idx_pharmacy_archives_phone
    ON pharmacy_archived_prescriptions (pharmacy_id, patient_phone)
    WHERE patient_phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pharmacy_archives_scanned_at
    ON pharmacy_archived_prescriptions (pharmacy_id, scanned_at DESC);

-- Vue helper : pour le matching géographique des pharmacies à notifier.
-- Pas de PostGIS strict ici (la table pharmacies stocke gps en VARCHAR
-- "lat,lng"), on fait une approximation haversine côté Rust ou via la
-- query "WHERE gps SIMILAR TO ..." simple. Voir backend/src/services/
-- medication_alert_service.rs pour la logique de matching.
