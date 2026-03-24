-- 2026-03-24
-- Bootstrap ciblé GCP: crée les tables minimales Bourse Livre manquantes
-- sans dépendre des migrations historiques qui peuvent échouer sur schéma dérivé.

CREATE TABLE IF NOT EXISTS book_delivery_packages (
    id SERIAL PRIMARY KEY,
    reference TEXT NOT NULL UNIQUE,
    destinataire_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    destinataire_gps TEXT,
    destinataire_adresse TEXT,
    expediteur_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    expediteur_gps TEXT,
    expediteur_adresse TEXT,
    livres JSONB NOT NULL DEFAULT '[]',
    nombre_livres INTEGER DEFAULT 0,
    troc_ids JSONB DEFAULT '[]',
    delivery_id INTEGER,
    coursier_id INTEGER,
    valeur_totale DECIMAL(12,2) DEFAULT 0,
    commission_app DECIMAL(12,2) DEFAULT 0,
    frais_livraison DECIMAL(12,2) DEFAULT 0,
    montant_net_a_payer DECIMAL(12,2) DEFAULT 0,
    devise TEXT DEFAULT 'XAF',
    statut TEXT DEFAULT 'a_constituer',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    date_constitution TIMESTAMPTZ,
    date_livraison TIMESTAMPTZ,
    date_confirmation TIMESTAMPTZ,
    type_livraison TEXT DEFAULT 'depot_et_recuperation',
    purchase_id INTEGER,
    librairie_lieu_id INTEGER,
    succursale_label VARCHAR(255),
    stock_disponible_succursale BOOLEAN,
    claimed_by_librairie_id INTEGER,
    claimed_by_user_id INTEGER,
    claimed_at TIMESTAMPTZ,
    released_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_book_packages_reference ON book_delivery_packages(reference);
CREATE INDEX IF NOT EXISTS idx_book_packages_destinataire ON book_delivery_packages(destinataire_id, statut);
CREATE INDEX IF NOT EXISTS idx_book_packages_expediteur ON book_delivery_packages(expediteur_id, statut);
CREATE INDEX IF NOT EXISTS idx_book_packages_lieu ON book_delivery_packages(librairie_lieu_id);

CREATE TABLE IF NOT EXISTS book_purchases (
    id SERIAL PRIMARY KEY,
    acheteur_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    livre_id INTEGER REFERENCES livres_scolaires(id) ON DELETE CASCADE,
    vendeur_id INTEGER REFERENCES users(id),
    prix_achat DECIMAL(12,2) NOT NULL DEFAULT 0,
    commission_app DECIMAL(12,2) DEFAULT 0,
    montant_vendeur DECIMAL(12,2) DEFAULT 0,
    frais_livraison DECIMAL(12,2) DEFAULT 0,
    montant_total DECIMAL(12,2) DEFAULT 0,
    devise TEXT DEFAULT 'XAF',
    package_id INTEGER REFERENCES book_delivery_packages(id),
    mode_livraison TEXT DEFAULT 'depot_seulement',
    adresse_livraison TEXT,
    gps_livraison TEXT,
    paiement_statut TEXT DEFAULT 'en_attente',
    paiement_reference TEXT,
    paiement_methode TEXT,
    statut TEXT DEFAULT 'en_attente',
    librairie_lieu_id INTEGER,
    succursale_label VARCHAR(255),
    stock_disponible_succursale BOOLEAN,
    claimed_by_librairie_id INTEGER,
    claimed_by_user_id INTEGER,
    claimed_at TIMESTAMPTZ,
    released_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_book_purchases_acheteur ON book_purchases(acheteur_id, statut);
CREATE INDEX IF NOT EXISTS idx_book_purchases_vendeur ON book_purchases(vendeur_id, statut);
CREATE INDEX IF NOT EXISTS idx_book_purchases_lieu ON book_purchases(librairie_lieu_id);
