-- ✅ 2026-03-07 : Migration pour digitalisation complète des compagnies d'assurance
-- Tables: insurance_products, insurance_policies, insurance_claims, insurance_claim_documents, insurance_policy_documents

-- 1. Table insurance_products — Catalogue produits paramétrable par l'assureur
CREATE TABLE IF NOT EXISTS insurance_products (
    id SERIAL PRIMARY KEY,
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    assureur_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    nom_produit TEXT NOT NULL,
    type_assurance TEXT NOT NULL CHECK (type_assurance IN ('vie','non_vie')),
    sous_categorie TEXT NOT NULL,
    description TEXT,
    compagnie TEXT,
    prime_mensuelle NUMERIC(12,2),
    prime_trimestrielle NUMERIC(12,2),
    prime_semestrielle NUMERIC(12,2),
    prime_annuelle NUMERIC(12,2),
    devise TEXT DEFAULT 'XAF',
    couverture_max NUMERIC(14,2),
    franchise_montant NUMERIC(12,2) DEFAULT 0,
    franchise_pourcentage NUMERIC(5,2) DEFAULT 0,
    duree_contrat_mois INTEGER DEFAULT 12,
    age_min INTEGER DEFAULT 18,
    age_max INTEGER DEFAULT 70,
    garanties JSONB DEFAULT '[]'::jsonb,
    exclusions JSONB DEFAULT '[]'::jsonb,
    conditions_generales TEXT,
    avantages JSONB DEFAULT '[]'::jsonb,
    options_supplementaires JSONB DEFAULT '[]'::jsonb,
    documents_requis JSONB DEFAULT '[]'::jsonb,
    delai_carence_jours INTEGER DEFAULT 0,
    taux_commission NUMERIC(5,2) DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    is_featured BOOLEAN DEFAULT false,
    souscriptions_count INTEGER DEFAULT 0,
    note_moyenne NUMERIC(3,2) DEFAULT 0,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_insurance_products_service ON insurance_products(service_id);
CREATE INDEX IF NOT EXISTS idx_insurance_products_assureur ON insurance_products(assureur_user_id);
CREATE INDEX IF NOT EXISTS idx_insurance_products_type ON insurance_products(type_assurance, sous_categorie);
CREATE INDEX IF NOT EXISTS idx_insurance_products_active ON insurance_products(is_active) WHERE is_active = true;

-- 2. Table insurance_policies — Polices/contrats émis
CREATE TABLE IF NOT EXISTS insurance_policies (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES insurance_products(id) ON DELETE RESTRICT,
    assureur_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    client_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    numero_police TEXT NOT NULL UNIQUE,
    client_nom TEXT NOT NULL,
    client_prenom TEXT,
    client_telephone TEXT,
    client_email TEXT,
    client_adresse TEXT,
    client_date_naissance DATE,
    client_profession TEXT,
    beneficiaires JSONB DEFAULT '[]'::jsonb,
    date_effet DATE NOT NULL,
    date_expiration DATE NOT NULL,
    prime_totale NUMERIC(12,2) NOT NULL,
    devise TEXT DEFAULT 'XAF',
    frequence_paiement TEXT DEFAULT 'annuel' CHECK (frequence_paiement IN ('mensuel','trimestriel','semestriel','annuel','unique')),
    statut TEXT DEFAULT 'active' CHECK (statut IN ('brouillon','en_attente','active','suspendue','resiliee','expiree','annulee')),
    garanties_souscrites JSONB DEFAULT '[]'::jsonb,
    options_souscrites JSONB DEFAULT '[]'::jsonb,
    conditions_particulieres TEXT,
    objet_assure JSONB DEFAULT '{}'::jsonb,
    franchise_applicable NUMERIC(12,2) DEFAULT 0,
    plafond_indemnisation NUMERIC(14,2),
    dernier_paiement_at TIMESTAMPTZ,
    prochain_paiement_at TIMESTAMPTZ,
    motif_resiliation TEXT,
    renouvellement_auto BOOLEAN DEFAULT true,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_insurance_policies_product ON insurance_policies(product_id);
CREATE INDEX IF NOT EXISTS idx_insurance_policies_assureur ON insurance_policies(assureur_user_id);
CREATE INDEX IF NOT EXISTS idx_insurance_policies_client ON insurance_policies(client_user_id);
CREATE INDEX IF NOT EXISTS idx_insurance_policies_numero ON insurance_policies(numero_police);
CREATE INDEX IF NOT EXISTS idx_insurance_policies_statut ON insurance_policies(statut);
CREATE INDEX IF NOT EXISTS idx_insurance_policies_expiration ON insurance_policies(date_expiration);

-- 3. Table insurance_claims — Déclarations de sinistres
CREATE TABLE IF NOT EXISTS insurance_claims (
    id SERIAL PRIMARY KEY,
    policy_id INTEGER NOT NULL REFERENCES insurance_policies(id) ON DELETE RESTRICT,
    assureur_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    declarant_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    numero_sinistre TEXT NOT NULL UNIQUE,
    type_sinistre TEXT NOT NULL,
    date_sinistre DATE NOT NULL,
    lieu_sinistre TEXT,
    gps_sinistre TEXT,
    description_sinistre TEXT NOT NULL,
    circonstances TEXT,
    temoins JSONB DEFAULT '[]'::jsonb,
    dommages_estimes NUMERIC(14,2),
    montant_reclame NUMERIC(14,2),
    montant_indemnise NUMERIC(14,2),
    devise TEXT DEFAULT 'XAF',
    statut TEXT DEFAULT 'declare' CHECK (statut IN (
        'declare','en_cours_instruction','expertise_demandee','expertise_en_cours',
        'en_attente_documents','approuve','partiellement_approuve',
        'refuse','indemnise','clos','conteste'
    )),
    priorite TEXT DEFAULT 'normale' CHECK (priorite IN ('basse','normale','haute','urgente')),
    agent_traitant TEXT,
    expert_assigne TEXT,
    date_expertise DATE,
    rapport_expertise TEXT,
    motif_refus TEXT,
    date_indemnisation DATE,
    mode_indemnisation TEXT CHECK (mode_indemnisation IN ('virement','cheque','mobile_money','reparation_directe')),
    reference_paiement TEXT,
    notes_internes TEXT,
    historique_statuts JSONB DEFAULT '[]'::jsonb,
    ai_analysis JSONB DEFAULT '{}'::jsonb,
    fraud_score NUMERIC(5,2),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_insurance_claims_policy ON insurance_claims(policy_id);
CREATE INDEX IF NOT EXISTS idx_insurance_claims_assureur ON insurance_claims(assureur_user_id);
CREATE INDEX IF NOT EXISTS idx_insurance_claims_declarant ON insurance_claims(declarant_user_id);
CREATE INDEX IF NOT EXISTS idx_insurance_claims_statut ON insurance_claims(statut);
CREATE INDEX IF NOT EXISTS idx_insurance_claims_numero ON insurance_claims(numero_sinistre);
CREATE INDEX IF NOT EXISTS idx_insurance_claims_date ON insurance_claims(date_sinistre DESC);

-- 4. Table insurance_claim_documents — Pièces jointes sinistres
CREATE TABLE IF NOT EXISTS insurance_claim_documents (
    id SERIAL PRIMARY KEY,
    claim_id INTEGER NOT NULL REFERENCES insurance_claims(id) ON DELETE CASCADE,
    uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    type_document TEXT NOT NULL,
    nom_fichier TEXT NOT NULL,
    url_fichier TEXT NOT NULL,
    taille_octets BIGINT,
    mime_type TEXT,
    description TEXT,
    is_verified BOOLEAN DEFAULT false,
    verified_by INTEGER REFERENCES users(id),
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_claim_documents_claim ON insurance_claim_documents(claim_id);

-- 5. Table insurance_policy_documents — Documents des polices
CREATE TABLE IF NOT EXISTS insurance_policy_documents (
    id SERIAL PRIMARY KEY,
    policy_id INTEGER NOT NULL REFERENCES insurance_policies(id) ON DELETE CASCADE,
    uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    type_document TEXT NOT NULL,
    nom_fichier TEXT NOT NULL,
    url_fichier TEXT NOT NULL,
    taille_octets BIGINT,
    mime_type TEXT,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_policy_documents_policy ON insurance_policy_documents(policy_id);

-- ✅ Fin migration digitalisation assurance
