-- Migration: Import permanent via lien Drive / cloud
-- Permet aux partenaires (pharmacie, supermarché, ecommerce) de pointer
-- vers un fichier Excel/CSV hébergé sur Google Drive, Dropbox, OneDrive
-- ou n'importe quelle URL publique, et de le synchroniser périodiquement.
-- Date: 2026-04-03

CREATE TABLE IF NOT EXISTS partner_import_links (
    id              SERIAL       PRIMARY KEY,
    user_id         INTEGER      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    -- 'pharmacie' | 'supermarche' | 'ecommerce'
    service_type    VARCHAR(30)  NOT NULL,
    -- ID du service concerné (pharmacy.service_id, supermarket.service_id, etc.)
    service_id      INTEGER      NOT NULL,

    -- Lien original communiqué par le partenaire (Google Drive, Dropbox, URL directe…)
    drive_url       TEXT         NOT NULL,
    -- URL de téléchargement direct calculée automatiquement
    download_url    TEXT         NOT NULL,

    -- Format détecté : 'csv' | 'xlsx' (pour l'instant on ne supporte que CSV côté backend)
    file_format     VARCHAR(10)  NOT NULL DEFAULT 'csv',

    -- Planification : 'manual' | 'hourly' | 'daily' | 'weekly'
    sync_schedule   VARCHAR(20)  NOT NULL DEFAULT 'daily',
    -- Heure d'exécution pour daily/weekly (0-23, heure UTC)
    sync_hour       INTEGER      NOT NULL DEFAULT 3
                        CHECK (sync_hour >= 0 AND sync_hour <= 23),
    -- Jour de semaine pour weekly (0=dimanche … 6=samedi)
    sync_day_of_week INTEGER     DEFAULT 1
                        CHECK (sync_day_of_week >= 0 AND sync_day_of_week <= 6),

    -- Étiquette / description libre (ex: "Catalogue médicaments avril 2026")
    label           TEXT,

    is_active       BOOLEAN      NOT NULL DEFAULT true,

    -- Suivi dernière synchronisation
    last_sync_at    TIMESTAMPTZ,
    last_sync_status VARCHAR(20),   -- 'success' | 'error' | 'running'
    last_sync_count INTEGER,        -- nombre de produits importés
    last_sync_error TEXT,

    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_partner_import_links_user    ON partner_import_links(user_id);
CREATE INDEX IF NOT EXISTS idx_partner_import_links_service ON partner_import_links(service_id, service_type);
-- Index utilisé par le scheduler pour trouver les liens actifs non-manuels
CREATE INDEX IF NOT EXISTS idx_partner_import_links_active
    ON partner_import_links(sync_schedule, last_sync_at)
    WHERE is_active = true AND sync_schedule != 'manual';

-- Commentaire sur la stratégie d'URL :
--   Google Drive (share)  : https://drive.google.com/file/d/{ID}/view  → https://drive.google.com/uc?export=download&id={ID}
--   Google Sheets (sheet) : https://docs.google.com/spreadsheets/d/{ID}/edit → https://docs.google.com/spreadsheets/d/{ID}/export?format=csv
--   Dropbox               : ...?dl=0 → ...?dl=1
--   OneDrive              : ...sharing_link... → lien embed direct
--   URL directe .csv/.xlsx : inchangée
