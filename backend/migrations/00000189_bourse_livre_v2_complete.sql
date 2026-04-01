-- Migration: Bourse du Livre V2 - Refonte complète
-- Date: 2026-03-15
-- Description: Ajout colonnes recto/verso, mode troc/vente/don, prix détecté,
--              devise, valeur calculée, état 3 niveaux, programmes scolaires,
--              paquets coursier, commissions, dons

-- ============================================================================
-- 1. NOUVELLES COLONNES SUR livres_scolaires
-- ============================================================================

-- Images recto/verso séparées
ALTER TABLE livres_scolaires ADD COLUMN IF NOT EXISTS image_recto TEXT;
ALTER TABLE livres_scolaires ADD COLUMN IF NOT EXISTS image_verso TEXT;

-- Mode: troc, vente, don
ALTER TABLE livres_scolaires ADD COLUMN IF NOT EXISTS mode_listing TEXT DEFAULT 'troc'; -- 'troc', 'vente', 'don'

-- Prix détecté par IA sur le livre physique
ALTER TABLE livres_scolaires ADD COLUMN IF NOT EXISTS prix_detecte DECIMAL(12,2);
ALTER TABLE livres_scolaires ADD COLUMN IF NOT EXISTS devise_detectee TEXT DEFAULT 'XAF';

-- Valeur calculée selon état et ratio
ALTER TABLE livres_scolaires ADD COLUMN IF NOT EXISTS valeur_calculee DECIMAL(12,2);
ALTER TABLE livres_scolaires ADD COLUMN IF NOT EXISTS ratio_etat DECIMAL(4,2); -- ex: 0.70 pour "Bon"

-- État 3 niveaux: 'bon', 'acceptable', 'rejete'
-- (on garde etat_livre existant mais on ajoute etat_classification)
ALTER TABLE livres_scolaires ADD COLUMN IF NOT EXISTS etat_classification TEXT; -- 'bon', 'acceptable', 'rejete'

-- Lien programme scolaire
ALTER TABLE livres_scolaires ADD COLUMN IF NOT EXISTS programme_scolaire_id INTEGER;
ALTER TABLE livres_scolaires ADD COLUMN IF NOT EXISTS est_au_programme BOOLEAN;
ALTER TABLE livres_scolaires ADD COLUMN IF NOT EXISTS programme_match_details JSONB;

-- Statut analyse IA
ALTER TABLE livres_scolaires ADD COLUMN IF NOT EXISTS ia_analysis_status TEXT DEFAULT 'pending'; -- 'pending', 'analyzing', 'done', 'error'
ALTER TABLE livres_scolaires ADD COLUMN IF NOT EXISTS ia_analysis_result JSONB;
ALTER TABLE livres_scolaires ADD COLUMN IF NOT EXISTS ia_confidence DECIMAL(4,2);

-- Situation troc: 'offre' (vente uniquement) ou 'offre_demande' (troc)
ALTER TABLE livres_scolaires ADD COLUMN IF NOT EXISTS situation_troc TEXT DEFAULT 'offre_demande'; -- 'offre', 'offre_demande'

-- Troc matché → passe en vente
ALTER TABLE livres_scolaires ADD COLUMN IF NOT EXISTS offre_matchee BOOLEAN DEFAULT false;

-- Session d'upload (pour regrouper les livres envoyés en une session)
ALTER TABLE livres_scolaires ADD COLUMN IF NOT EXISTS upload_session_id TEXT;

-- ============================================================================
-- 2. TABLE PROGRAMMES SCOLAIRES (admin)
-- ============================================================================

CREATE TABLE IF NOT EXISTS programmes_scolaires (
    id SERIAL PRIMARY KEY,
    pays TEXT NOT NULL DEFAULT 'Cameroun',
    systeme_educatif TEXT NOT NULL DEFAULT 'francophone', -- 'francophone', 'anglophone'
    niveau TEXT NOT NULL, -- 'Primaire', 'Collège', 'Lycée'
    classe TEXT NOT NULL, -- '6ème', '5ème', 'Terminale', etc.
    matiere TEXT NOT NULL, -- 'Mathématiques', 'Français', etc.
    titre_livre TEXT NOT NULL, -- Titre officiel du manuel
    auteur_livre TEXT,
    editeur_livre TEXT,
    isbn_livre TEXT,
    annee_scolaire TEXT, -- '2025-2026'
    est_obligatoire BOOLEAN DEFAULT true,
    keywords TEXT[], -- Mots-clés pour matching flou
    prix_officiel DECIMAL(12,2), -- Prix officiel si connu
    devise TEXT DEFAULT 'XAF',
    created_by INTEGER REFERENCES users(id),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='programmes_scolaires' AND column_name='matiere') THEN
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_programmes_classe_matiere ON programmes_scolaires(classe, matiere) WHERE is_active = true';
    END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_programmes_pays_niveau 
    ON programmes_scolaires(pays, niveau, classe) WHERE is_active = true;

DO $$
BEGIN
    CREATE INDEX IF NOT EXISTS idx_programmes_titre_trgm 
        ON programmes_scolaires USING GIN(titre_livre gin_trgm_ops) WHERE is_active = true;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'pg_trgm non disponible pour programmes_scolaires';
END $$;

-- ============================================================================
-- 3. TABLE PAQUETS LIVRAISON LIVRES (coursier)
-- ============================================================================

CREATE TABLE IF NOT EXISTS book_delivery_packages (
    id SERIAL PRIMARY KEY,
    
    -- Référence simple (ex: "BL-A1B2" - facile à noter)
    reference TEXT NOT NULL UNIQUE,
    
    -- Destinataire du paquet
    destinataire_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    destinataire_gps TEXT,
    destinataire_adresse TEXT,
    
    -- Expéditeur (celui qui donne/vend les livres)
    expediteur_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    expediteur_gps TEXT,
    expediteur_adresse TEXT,
    
    -- Livres dans le paquet
    livres JSONB NOT NULL DEFAULT '[]', -- [{livre_id, titre, valeur, mode}]
    nombre_livres INTEGER DEFAULT 0,
    
    -- Lien avec le troc/vente
    troc_ids JSONB DEFAULT '[]', -- IDs des trocs associés
    
    -- Livraison
    delivery_id INTEGER, -- FK vers deliveries existant
    coursier_id INTEGER, -- FK vers couriers
    
    -- Financier
    valeur_totale DECIMAL(12,2) DEFAULT 0,
    commission_app DECIMAL(12,2) DEFAULT 0,
    frais_livraison DECIMAL(12,2) DEFAULT 0,
    montant_net_a_payer DECIMAL(12,2) DEFAULT 0, -- Ce que le destinataire paie
    devise TEXT DEFAULT 'XAF',
    
    -- Statut
    statut TEXT DEFAULT 'a_constituer', -- 'a_constituer', 'constitue', 'en_route', 'livre', 'confirme'
    
    -- Dates
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    date_constitution TIMESTAMPTZ,
    date_livraison TIMESTAMPTZ,
    date_confirmation TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_book_packages_reference ON book_delivery_packages(reference);
CREATE INDEX IF NOT EXISTS idx_book_packages_destinataire ON book_delivery_packages(destinataire_id, statut);
CREATE INDEX IF NOT EXISTS idx_book_packages_expediteur ON book_delivery_packages(expediteur_id, statut);
CREATE INDEX IF NOT EXISTS idx_book_packages_coursier ON book_delivery_packages(coursier_id, statut);
CREATE INDEX IF NOT EXISTS idx_book_packages_delivery ON book_delivery_packages(delivery_id);

-- ============================================================================
-- 4. TABLE COMMISSIONS BOURSE DU LIVRE
-- ============================================================================

CREATE TABLE IF NOT EXISTS book_exchange_commissions (
    id SERIAL PRIMARY KEY,
    
    -- Livre concerné
    livre_id INTEGER REFERENCES livres_scolaires(id) ON DELETE CASCADE,
    troc_id INTEGER,
    package_id INTEGER REFERENCES book_delivery_packages(id),
    
    -- Utilisateurs
    vendeur_id INTEGER REFERENCES users(id),
    acheteur_id INTEGER REFERENCES users(id),
    
    -- Type: 'troc', 'vente', 'don'
    type_transaction TEXT NOT NULL,
    
    -- Montants
    valeur_livre DECIMAL(12,2) NOT NULL,
    taux_commission DECIMAL(4,2) NOT NULL DEFAULT 0.05, -- 5% (harmonisé avec logique applicative)
    montant_commission DECIMAL(12,2) NOT NULL,
    montant_reversement_vendeur DECIMAL(12,2) DEFAULT 0,
    devise TEXT DEFAULT 'XAF',
    
    -- Statut reversement
    reversement_statut TEXT DEFAULT 'en_attente', -- 'en_attente', 'effectue', 'annule'
    reversement_date TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_book_commissions_vendeur ON book_exchange_commissions(vendeur_id, reversement_statut);
CREATE INDEX IF NOT EXISTS idx_book_commissions_livre ON book_exchange_commissions(livre_id);

-- ============================================================================
-- 5. TABLE DEMANDES DE DONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS book_donation_requests (
    id SERIAL PRIMARY KEY,
    
    -- Demandeur
    demandeur_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    
    -- Livre demandé
    livre_id INTEGER REFERENCES livres_scolaires(id) ON DELETE CASCADE,
    
    -- Justification
    motif TEXT NOT NULL,
    justificatif_url TEXT, -- Photo pièce justificative (certificat scolarité, etc.)
    
    -- Vérification
    est_verifie BOOLEAN DEFAULT false,
    verifie_par INTEGER REFERENCES users(id),
    verification_date TIMESTAMPTZ,
    verification_notes TEXT,
    
    -- Statut: 'en_attente', 'approuve', 'refuse', 'livre'
    statut TEXT DEFAULT 'en_attente',
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_book_donations_demandeur ON book_donation_requests(demandeur_id, statut);
CREATE INDEX IF NOT EXISTS idx_book_donations_livre ON book_donation_requests(livre_id, statut);

-- ============================================================================
-- 6. TABLE SESSIONS D'UPLOAD (pour analyse progressive)
-- ============================================================================

CREATE TABLE IF NOT EXISTS book_upload_sessions (
    id TEXT PRIMARY KEY, -- UUID
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    
    -- Compteurs
    total_livres INTEGER DEFAULT 0,
    livres_analyses INTEGER DEFAULT 0,
    livres_acceptes INTEGER DEFAULT 0,
    livres_rejetes INTEGER DEFAULT 0,
    
    -- Récap par classe (JSONB)
    recap_par_classe JSONB DEFAULT '{}',
    
    -- Valeur totale calculée
    valeur_totale DECIMAL(12,2) DEFAULT 0,
    devise TEXT DEFAULT 'XAF',
    
    -- GPS de récupération (obligatoire)
    gps_recuperation TEXT,
    adresse_recuperation TEXT,
    
    -- Mode par défaut
    mode_listing_defaut TEXT DEFAULT 'troc', -- 'troc', 'vente', 'don'
    
    -- Statut: 'en_cours', 'termine', 'valide', 'annule'
    statut TEXT DEFAULT 'en_cours',
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    date_validation TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_book_sessions_user ON book_upload_sessions(user_id, statut);

-- ============================================================================
-- 7. NOUVEAUX INDEX SUR livres_scolaires
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_livres_mode_listing ON livres_scolaires(mode_listing) 
    WHERE is_active = true AND is_available = true;
CREATE INDEX IF NOT EXISTS idx_livres_etat_classification ON livres_scolaires(etat_classification) 
    WHERE is_active = true AND is_available = true;
CREATE INDEX IF NOT EXISTS idx_livres_upload_session ON livres_scolaires(upload_session_id) 
    WHERE upload_session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_livres_ia_status ON livres_scolaires(ia_analysis_status) 
    WHERE ia_analysis_status != 'done';

-- ============================================================================
-- 8. TRIGGERS
-- ============================================================================

DO $$
BEGIN
    CREATE TRIGGER trigger_update_programmes_scolaires_updated_at
        BEFORE UPDATE ON programmes_scolaires
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN
    RAISE NOTICE 'trigger trigger_update_programmes_scolaires_updated_at already exists';
END $$;

DO $$
BEGIN
    CREATE TRIGGER trigger_update_book_packages_updated_at
        BEFORE UPDATE ON book_delivery_packages
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN
    RAISE NOTICE 'trigger trigger_update_book_packages_updated_at already exists';
END $$;

DO $$
BEGIN
    CREATE TRIGGER trigger_update_book_donations_updated_at
        BEFORE UPDATE ON book_donation_requests
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN
    RAISE NOTICE 'trigger trigger_update_book_donations_updated_at already exists';
END $$;

DO $$
BEGIN
    CREATE TRIGGER trigger_update_book_sessions_updated_at
        BEFORE UPDATE ON book_upload_sessions
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN
    RAISE NOTICE 'trigger trigger_update_book_sessions_updated_at already exists';
END $$;

-- ============================================================================
-- COMMENTAIRES
-- ============================================================================

COMMENT ON TABLE programmes_scolaires IS 'Programmes scolaires officiels chargés par les admins pour vérifier si un livre est au programme';
COMMENT ON TABLE book_delivery_packages IS 'Paquets/lots de livres à livrer par coursier avec références simples';
COMMENT ON TABLE book_exchange_commissions IS 'Commissions de l''application sur chaque transaction de livre';
COMMENT ON TABLE book_donation_requests IS 'Demandes de dons de livres avec vérification';
COMMENT ON TABLE book_upload_sessions IS 'Sessions d''upload progressif de livres avec analyse IA en arrière-plan';
