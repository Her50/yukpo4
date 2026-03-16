-- Migration: Bourse du Livre V2 Phase 2
-- Date: 2026-03-15
-- Description: Upload fichiers programmes scolaires (PDF/Excel/Image) avec extraction IA,
--              achat direct sans échange, livraison dépôt-seulement, période académique

-- ============================================================================
-- 1. PROGRAMMES SCOLAIRES: Colonnes upload fichier + extraction IA
-- ============================================================================

-- Fichier source uploadé par l'admin
ALTER TABLE programmes_scolaires ADD COLUMN IF NOT EXISTS fichier_url TEXT;
ALTER TABLE programmes_scolaires ADD COLUMN IF NOT EXISTS fichier_type TEXT; -- 'pdf', 'excel', 'image'
ALTER TABLE programmes_scolaires ADD COLUMN IF NOT EXISTS fichier_nom TEXT;

-- Période académique (ex: "2025-2026") — obligatoire pour matching intelligent
ALTER TABLE programmes_scolaires ADD COLUMN IF NOT EXISTS periode_academique TEXT; -- "2025-2026"
ALTER TABLE programmes_scolaires ADD COLUMN IF NOT EXISTS date_debut_validite DATE;
ALTER TABLE programmes_scolaires ADD COLUMN IF NOT EXISTS date_fin_validite DATE;

-- Extraction IA du fichier
ALTER TABLE programmes_scolaires ADD COLUMN IF NOT EXISTS extraction_status TEXT DEFAULT 'pending'; -- 'pending','extracting','done','error'
ALTER TABLE programmes_scolaires ADD COLUMN IF NOT EXISTS extraction_result JSONB; -- Résultat brut IA
ALTER TABLE programmes_scolaires ADD COLUMN IF NOT EXISTS livres_extraits JSONB DEFAULT '[]'; -- [{titre, auteur, editeur, isbn, classe, matiere}]
ALTER TABLE programmes_scolaires ADD COLUMN IF NOT EXISTS nombre_livres_extraits INTEGER DEFAULT 0;

-- ============================================================================
-- 2. ACHAT DIRECT: Table pour achats sans échange
-- ============================================================================

CREATE TABLE IF NOT EXISTS book_purchases (
    id SERIAL PRIMARY KEY,

    -- Acheteur
    acheteur_id INTEGER REFERENCES users(id) ON DELETE CASCADE,

    -- Livre acheté
    livre_id INTEGER REFERENCES livres_scolaires(id) ON DELETE CASCADE,

    -- Vendeur (propriétaire du livre)
    vendeur_id INTEGER REFERENCES users(id),

    -- Montants
    prix_achat DECIMAL(12,2) NOT NULL,
    commission_app DECIMAL(12,2) DEFAULT 0,
    montant_vendeur DECIMAL(12,2) DEFAULT 0, -- prix_achat - commission
    frais_livraison DECIMAL(12,2) DEFAULT 0,
    montant_total DECIMAL(12,2) DEFAULT 0, -- prix_achat + frais_livraison
    devise TEXT DEFAULT 'XAF',

    -- Livraison
    package_id INTEGER REFERENCES book_delivery_packages(id),
    mode_livraison TEXT DEFAULT 'depot_seulement', -- 'depot_seulement', 'depot_et_recuperation'
    adresse_livraison TEXT,
    gps_livraison TEXT,

    -- Paiement
    paiement_statut TEXT DEFAULT 'en_attente', -- 'en_attente', 'paye', 'rembourse'
    paiement_reference TEXT,
    paiement_methode TEXT, -- 'mobile_money', 'cash', 'carte'

    -- Statut global
    statut TEXT DEFAULT 'en_attente', -- 'en_attente', 'confirme', 'en_livraison', 'livre', 'annule'

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_book_purchases_acheteur ON book_purchases(acheteur_id, statut);
CREATE INDEX IF NOT EXISTS idx_book_purchases_vendeur ON book_purchases(vendeur_id, statut);
CREATE INDEX IF NOT EXISTS idx_book_purchases_livre ON book_purchases(livre_id);

DO $$
BEGIN
    CREATE TRIGGER trigger_update_book_purchases_updated_at
        BEFORE UPDATE ON book_purchases
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN
    RAISE NOTICE 'trigger already exists';
END $$;

-- ============================================================================
-- 3. PAQUETS LIVRAISON: Support dépôt-seulement
-- ============================================================================

ALTER TABLE book_delivery_packages ADD COLUMN IF NOT EXISTS type_livraison TEXT DEFAULT 'depot_et_recuperation';
  -- 'depot_seulement' = coursier va juste déposer, pas de livres à récupérer
  -- 'depot_et_recuperation' = coursier récupère ET dépose des livres

ALTER TABLE book_delivery_packages ADD COLUMN IF NOT EXISTS purchase_id INTEGER;
  -- Lien vers un achat direct si applicable (pas un troc)

-- ============================================================================
-- 4. TROC: Support achat direct dans le système existant
-- ============================================================================

-- Ajouter un type de transaction au troc
ALTER TABLE troc_livres_scolaires ADD COLUMN IF NOT EXISTS type_transaction TEXT DEFAULT 'troc';
  -- 'troc' = échange classique
  -- 'achat' = achat direct (le livre_offert_id est NULL ou le même livre, pas d'échange)
  -- 'don' = don vérifié

-- Montant payé si achat direct
ALTER TABLE troc_livres_scolaires ADD COLUMN IF NOT EXISTS montant_paye DECIMAL(12,2);
ALTER TABLE troc_livres_scolaires ADD COLUMN IF NOT EXISTS devise_paiement TEXT DEFAULT 'XAF';

-- Flag: troc déjà inclus dans un paquet de livraison (constitution intelligente)
ALTER TABLE troc_livres_scolaires ADD COLUMN IF NOT EXISTS is_packaged BOOLEAN DEFAULT false;

-- ============================================================================
-- 5. INDEX ADDITIONNELS
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_programmes_periode ON programmes_scolaires(periode_academique) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_programmes_extraction ON programmes_scolaires(extraction_status) WHERE extraction_status != 'done';
CREATE INDEX IF NOT EXISTS idx_book_packages_type ON book_delivery_packages(type_livraison, statut);
CREATE INDEX IF NOT EXISTS idx_troc_type_transaction ON troc_livres_scolaires(type_transaction, statut);

-- ============================================================================
-- 6. CHAÎNE TROC V3: DAG sans réciprocité, vendeurs, livraison multi-jours
-- ============================================================================

-- Transferts directionnels (arêtes du DAG): qui envoie quoi à qui
ALTER TABLE chaines_troc_livres ADD COLUMN IF NOT EXISTS transfers JSONB;
  -- [{sender_id, receiver_id, livre_id, livre_titre, valeur, statut}]

-- Route optimisée du coursier (waypoints ordonnés)
ALTER TABLE chaines_troc_livres ADD COLUMN IF NOT EXISTS route_optimisee JSONB;
  -- [{ordre, user_id, gps, adresse, type, pickup_livre_ids, dropoff_livre_ids}]

-- Planning de livraison multi-jours
ALTER TABLE chaines_troc_livres ADD COLUMN IF NOT EXISTS delivery_schedule JSONB;
  -- [{jour, user_id, creneau_debut, creneau_fin, type}]

-- Référence lisible
ALTER TABLE chaines_troc_livres ADD COLUMN IF NOT EXISTS reference TEXT;

-- Nombre de vendeurs dans la chaîne
ALTER TABLE chaines_troc_livres ADD COLUMN IF NOT EXISTS nombre_vendeurs INTEGER DEFAULT 0;

-- IDs des paquets générés
ALTER TABLE chaines_troc_livres ADD COLUMN IF NOT EXISTS package_ids JSONB;

-- ============================================================================
-- 7. LOG D'ANNULATION LIVRE PAR COURSIER (aléas terrain)
-- ============================================================================

CREATE TABLE IF NOT EXISTS book_cancellation_log (
    id SERIAL PRIMARY KEY,
    package_id INTEGER NOT NULL,
    livre_id INTEGER NOT NULL,
    chaine_id INTEGER,
    coursier_id INTEGER NOT NULL,
    destinataire_id INTEGER NOT NULL,  -- user qui devait recevoir le livre
    raison TEXT,                        -- raison de l'annulation
    valeur_livre DECIMAL(12,2) DEFAULT 0,
    commission_remboursee DECIMAL(12,2) DEFAULT 0,
    -- Le destinataire est crédité de valeur_livre + commission_remboursee
    -- Les frais de livraison NE SONT PAS impactés
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cancel_log_package ON book_cancellation_log(package_id);
CREATE INDEX IF NOT EXISTS idx_cancel_log_chaine ON book_cancellation_log(chaine_id) WHERE chaine_id IS NOT NULL;

-- Solde wallet pour crédits (remboursements livres annulés)
ALTER TABLE users ADD COLUMN IF NOT EXISTS wallet_balance DECIMAL(12,2) DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS wallet_devise TEXT DEFAULT 'XAF';

-- ============================================================================
-- 8. DISPONIBILITÉ PARTICIPANT POUR LIVRAISON
-- ============================================================================

ALTER TABLE troc_livres_scolaires ADD COLUMN IF NOT EXISTS disponibilite_debut TIMESTAMPTZ;
ALTER TABLE troc_livres_scolaires ADD COLUMN IF NOT EXISTS disponibilite_fin TIMESTAMPTZ;

-- Disponibilité directement sur les livres aussi (pour scheduling)
ALTER TABLE livres_scolaires ADD COLUMN IF NOT EXISTS disponibilite_debut TIMESTAMPTZ;
ALTER TABLE livres_scolaires ADD COLUMN IF NOT EXISTS disponibilite_fin TIMESTAMPTZ;

-- ============================================================================
-- COMMENTAIRES
-- ============================================================================

COMMENT ON TABLE book_purchases IS 'Achats directs de livres sans échange (pas de troc, juste paiement)';
COMMENT ON COLUMN programmes_scolaires.fichier_url IS 'URL du fichier source (PDF/Excel/Image) uploadé par admin';
COMMENT ON COLUMN programmes_scolaires.livres_extraits IS 'Liste de livres extraits par IA du fichier programme';
COMMENT ON COLUMN book_delivery_packages.type_livraison IS 'depot_seulement = pas de pickup, juste dépôt chez le destinataire';
COMMENT ON TABLE book_cancellation_log IS 'Log des livres annulés par le coursier sur le terrain — déclenche crédit wallet du destinataire';
COMMENT ON COLUMN chaines_troc_livres.transfers IS 'DAG: arêtes directionnelles [{sender_id, receiver_id, livre_id, ...}] sans réciprocité';
COMMENT ON COLUMN chaines_troc_livres.route_optimisee IS 'Waypoints ordonnés du coursier, vendeurs en premier';
