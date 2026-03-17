-- ✅ MIGRATIONS RÉSEAU LIBRAIRIES - Système intelligent de distribution
-- Date: 2026-03-16
-- Description: Tables pour le réseau de librairies, commandes mixtes, validation compétitive

-- ========================================
-- TYPE ENUMS
-- ========================================

-- Statut librairie
CREATE TYPE librairie_statut AS ENUM (
    'actif',
    'inactif', 
    'suspendu',
    'en_validation'
);

-- Statut commande mixte
CREATE TYPE commande_statut AS ENUM (
    'edition',
    'validation_budget',
    'envoyee_librairies',
    'en_validation',
    'validee_partielle',
    'validee_complete',
    'en_preparation',
    'en_livraison',
    'livree',
    'annulee'
);

-- Statut validation livre
CREATE TYPE livre_validation_statut AS ENUM (
    'en_attente',
    'valide',
    'indisponible',
    'en_cours_validation'
);

-- Statut livre occasion
CREATE TYPE livre_occasion_statut AS ENUM (
    'disponible',
    'reserve',
    'en_preparation',
    'livre'
);

-- Statut validation
CREATE TYPE validation_statut AS ENUM (
    'en_cours',
    'valide_partiel',
    'valide_complet',
    'abandonne',
    'expire'
);

-- Source prix
CREATE TYPE prix_source AS ENUM (
    'fichier_programme',
    'ia_extraction',
    'manuelle',
    'web_scraping'
);

-- Statut QR code
CREATE TYPE qr_code_statut AS ENUM (
    'genere',
    'scanne',
    'en_cours_validation',
    'valide',
    'expire',
    'annule'
);

-- Type notification
CREATE TYPE type_notification AS ENUM (
    'nouvelle_commande',
    'commande_annulee',
    'validation_complete',
    'partie_liberee',
    'rappel_validation'
);

-- Statut notification
CREATE TYPE notification_statut AS ENUM (
    'envoyee',
    'lue',
    'traitee',
    'ignoree'
);

-- Méthode paiement
CREATE TYPE methode_paiement AS ENUM (
    'wallet',
    'mobile_money',
    'carte_bancaire',
    'virement_bancaire',
    'especes'
);

-- Statut transaction
CREATE TYPE transaction_statut AS ENUM (
    'en_attente',
    'initiee',
    'succes',
    'echec',
    'annulee',
    'remboursee'
);

-- Statut chaîne livraison
CREATE TYPE chaine_statut AS ENUM (
    'en_construction',
    'optimisee',
    'en_cours',
    'completee',
    'annulee'
);

-- Type point passage
CREATE TYPE type_point_passage AS ENUM (
    'librairie',
    'utilisateur_vendeur',
    'utilisateur_acheteur',
    'point_depot'
);

-- Statut point
CREATE TYPE point_statut AS ENUM (
    'en_attente',
    'en_cours',
    'complete',
    'saute'
);

-- ========================================
-- TABLES PRINCIPALES
-- ========================================

-- Partenaires librairies
CREATE TABLE librairie_partners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    nom VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    telephone VARCHAR(50),
    gps VARCHAR(100) NOT NULL, -- "lat,lng"
    ville VARCHAR(100) NOT NULL,
    quartier VARCHAR(100),
    rayon_service_km INTEGER NOT NULL DEFAULT 50,
    statut librairie_statut NOT NULL DEFAULT 'en_validation',
    rating DECIMAL(3,2) NOT NULL DEFAULT 0.0 CHECK (rating >= 0 AND rating <= 5),
    temps_moyen_validation INTEGER NOT NULL DEFAULT 5, -- minutes
    commission_app DECIMAL(5,4) NOT NULL DEFAULT 0.0500 CHECK (commission_app >= 0 AND commission_app <= 1),
    est_actif BOOLEAN NOT NULL DEFAULT true,
    horaires_ouverture VARCHAR(100), -- "08:00-18:00"
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Index pour performances
CREATE INDEX idx_librairie_partners_gps ON librairie_partners USING gist (ll_to_earth(SPLIT_PART(gps, ',', 1)::float, SPLIT_PART(gps, ',', 2)::float));
CREATE INDEX idx_librairie_partners_statut ON librairie_partners(statut);
CREATE INDEX idx_librairie_partners_ville ON librairie_partners(ville);
CREATE INDEX idx_librairie_partners_actif ON librairie_partners(est_actif) WHERE est_actif = true;

-- Commandes mixtes (neufs + occasion)
CREATE TABLE commandes_mixtes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reference_commande VARCHAR(50) NOT NULL UNIQUE,
    budget_total DECIMAL(12,2) NOT NULL CHECK (budget_total > 0),
    devise VARCHAR(10) NOT NULL DEFAULT 'XAF',
    statut commande_statut NOT NULL DEFAULT 'edition',
    mode_livraison VARCHAR(50) NOT NULL DEFAULT 'coursier',
    adresse_livraison TEXT,
    gps_livraison VARCHAR(100),
    notes_client TEXT,
    commission_app DECIMAL(12,2) NOT NULL DEFAULT 0.0,
    montant_net_libraires DECIMAL(12,2) NOT NULL DEFAULT 0.0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Trigger pour updated_at
CREATE TRIGGER update_commandes_mixtes_updated_at 
    BEFORE UPDATE ON commandes_mixtes 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Index
CREATE INDEX idx_commandes_mixtes_user ON commandes_mixtes(user_id);
CREATE INDEX idx_commandes_mixtes_statut ON commandes_mixtes(statut);
CREATE INDEX idx_commandes_mixtes_reference ON commandes_mixtes(reference_commande);
CREATE INDEX idx_commandes_mixtes_created ON commandes_mixtes(created_at DESC);

-- Livres neufs dans commandes
CREATE TABLE commande_livres_neufs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    commande_id UUID NOT NULL REFERENCES commandes_mixtes(id) ON DELETE CASCADE,
    programme_scolaire_id UUID REFERENCES programmes_scolaires(id),
    titre VARCHAR(500) NOT NULL,
    auteur VARCHAR(255),
    editeur VARCHAR(255),
    isbn VARCHAR(50),
    classe VARCHAR(100) NOT NULL,
    matiere VARCHAR(100) NOT NULL,
    niveau VARCHAR(100),
    prix_officiel DECIMAL(12,2) NOT NULL CHECK (prix_officiel >= 0),
    prix_final DECIMAL(12,2) NOT NULL CHECK (prix_final >= 0),
    quantite INTEGER NOT NULL DEFAULT 1 CHECK (quantite > 0),
    est_au_programme BOOLEAN NOT NULL DEFAULT false,
    librairie_validateur_id UUID REFERENCES librairie_partners(id),
    statut_validation livre_validation_statut NOT NULL DEFAULT 'en_attente',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Index
CREATE INDEX idx_commande_livres_neufs_commande ON commande_livres_neufs(commande_id);
CREATE INDEX idx_commande_livres_neufs_programme ON commande_livres_neufs(programme_scolaire_id);
CREATE INDEX idx_commande_livres_neufs_statut ON commande_livres_neufs(statut_validation);
CREATE INDEX idx_commande_livres_neufs_validateur ON commande_livres_neufs(librairie_validateur_id);

-- Livres occasion dans commandes
CREATE TABLE commande_livres_occasion (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    commande_id UUID NOT NULL REFERENCES commandes_mixtes(id) ON DELETE CASCADE,
    livre_scolaire_id UUID NOT NULL REFERENCES livres_scolaires(id),
    titre VARCHAR(500) NOT NULL,
    auteur VARCHAR(255),
    classe VARCHAR(100) NOT NULL,
    matiere VARCHAR(100) NOT NULL,
    etat_livre VARCHAR(100) NOT NULL,
    prix DECIMAL(12,2) NOT NULL CHECK (prix >= 0),
    vendeur_id UUID NOT NULL REFERENCES users(id),
    quantite INTEGER NOT NULL DEFAULT 1 CHECK (quantite > 0),
    statut livre_occasion_statut NOT NULL DEFAULT 'disponible',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Index
CREATE INDEX idx_commande_livres_occasion_commande ON commande_livres_occasion(commande_id);
CREATE INDEX idx_commande_livres_occasion_livre ON commande_livres_occasion(livre_scolaire_id);
CREATE INDEX idx_commande_livres_occasion_vendeur ON commande_livres_occasion(vendeur_id);

-- Validations compétitives librairies
CREATE TABLE commande_validations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    commande_id UUID NOT NULL REFERENCES commandes_mixtes(id) ON DELETE CASCADE,
    librairie_id UUID NOT NULL REFERENCES librairie_partners(id) ON DELETE CASCADE,
    statut validation_statut NOT NULL DEFAULT 'en_cours',
    livres_valides JSONB DEFAULT '[]', -- Array of livre IDs
    timestamp_debut TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    timestamp_fin TIMESTAMP WITH TIME ZONE,
    verrou_exclusif BOOLEAN NOT NULL DEFAULT false,
    notes_validation TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Index
CREATE INDEX idx_commande_validations_commande ON commande_validations(commande_id);
CREATE INDEX idx_commande_validations_librairie ON commande_validations(librairie_id);
CREATE INDEX idx_commande_validations_statut ON commande_validations(statut);
CREATE INDEX idx_commande_validations_verrou ON commande_validations(verrou_exclusif) WHERE verrou_exclusif = true;

-- Contrainte: une seule validation active par librairie par commande
CREATE UNIQUE INDEX idx_unique_validation_active 
    ON commande_validations(commande_id, librairie_id) 
    WHERE statut IN ('en_cours', 'valide_partiel', 'valide_complet');

-- Prix officiels programme (IA)
CREATE TABLE prix_officiels_programme (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    programme_scolaire_id UUID NOT NULL REFERENCES programmes_scolaires(id) ON DELETE CASCADE,
    titre VARCHAR(500) NOT NULL,
    auteur VARCHAR(255),
    editeur VARCHAR(255),
    isbn VARCHAR(50),
    classe VARCHAR(100) NOT NULL,
    matiere VARCHAR(100) NOT NULL,
    niveau VARCHAR(100),
    prix_officiel DECIMAL(12,2) NOT NULL CHECK (prix_officiel >= 0),
    devise VARCHAR(10) NOT NULL DEFAULT 'XAF',
    source prix_source NOT NULL DEFAULT 'ia_extraction',
    confiance_score DECIMAL(3,2) NOT NULL DEFAULT 0.0 CHECK (confiance_score >= 0 AND confiance_score <= 1),
    fichier_source TEXT,
    date_extraction TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Index
CREATE INDEX idx_prix_officiels_programme ON prix_officiels_programme(programme_scolaire_id);
CREATE INDEX idx_prix_officiels_titre ON prix_officiels_programme USING gin(to_tsvector('french', titre));
CREATE INDEX idx_prix_officiels_classe_matiere ON prix_officiels_programme(classe, matiere);
CREATE INDEX idx_prix_officiels_source ON prix_officiels_programme(source);

-- QR Codes sécurité coursier
CREATE TABLE qr_codes_coursier (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    paquet_id UUID NOT NULL REFERENCES delivery_packages(id) ON DELETE CASCADE,
    coursier_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code_secret VARCHAR(20) NOT NULL UNIQUE,
    qr_code_data TEXT NOT NULL,
    timestamp_generation TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    timestamp_scan TIMESTAMP WITH TIME ZONE,
    timestamp_validation TIMESTAMP WITH TIME ZONE,
    statut qr_code_statut NOT NULL DEFAULT 'genere',
    livres_attendus JSONB NOT NULL DEFAULT '[]',
    destinations JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Index
CREATE INDEX idx_qr_codes_coursier_paquet ON qr_codes_coursier(paquet_id);
CREATE INDEX idx_qr_codes_coursier_coursier ON qr_codes_coursier(coursier_id);
CREATE INDEX idx_qr_codes_coursier_code ON qr_codes_coursier(code_secret);
CREATE INDEX idx_qr_codes_coursier_statut ON qr_codes_coursier(statut);

-- Notifications librairies
CREATE TABLE notifications_librairie (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    librairie_id UUID NOT NULL REFERENCES librairie_partners(id) ON DELETE CASCADE,
    commande_id UUID REFERENCES commandes_mixtes(id) ON DELETE CASCADE,
    type_notification type_notification NOT NULL,
    message TEXT NOT NULL,
    donnees_supplementaires JSONB,
    statut notification_statut NOT NULL DEFAULT 'envoyee',
    timestamp_envoi TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    timestamp_lecture TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Index
CREATE INDEX idx_notifications_librairie_librairie ON notifications_librairie(librairie_id);
CREATE INDEX idx_notifications_librairie_commande ON notifications_librairie(commande_id);
CREATE INDEX idx_notifications_librairie_statut ON notifications_librairie(statut);
CREATE INDEX idx_notifications_librairie_envoi ON notifications_librairie(timestamp_envoi DESC);

-- Transactions agrégées
CREATE TABLE transactions_agregees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    commande_id UUID REFERENCES commandes_mixtes(id) ON DELETE SET NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    montant_total DECIMAL(12,2) NOT NULL CHECK (montant_total > 0),
    devise VARCHAR(10) NOT NULL DEFAULT 'XAF',
    methode_paiement methode_paiement NOT NULL,
    statut transaction_statut NOT NULL DEFAULT 'en_attente',
    reference_paiement VARCHAR(100) NOT NULL UNIQUE,
    provider_transaction_id VARCHAR(255),
    commission_app DECIMAL(12,2) NOT NULL DEFAULT 0.0,
    montant_net DECIMAL(12,2) NOT NULL DEFAULT 0.0,
    details_repartition JSONB, -- Répartition libraires/vendeurs
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Trigger pour updated_at
CREATE TRIGGER update_transactions_agregees_updated_at 
    BEFORE UPDATE ON transactions_agregees 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Index
CREATE INDEX idx_transactions_agregees_user ON transactions_agregees(user_id);
CREATE INDEX idx_transactions_agregees_commande ON transactions_agregees(commande_id);
CREATE INDEX idx_transactions_agregees_reference ON transactions_agregees(reference_paiement);
CREATE INDEX idx_transactions_agregees_statut ON transactions_agregees(statut);

-- Chaînes livraison unifiées
CREATE TABLE chaines_livraison_unifiees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    commande_id UUID NOT NULL REFERENCES commandes_mixtes(id) ON DELETE CASCADE,
    reference_chaine VARCHAR(50) NOT NULL UNIQUE,
    statut chaine_statut NOT NULL DEFAULT 'en_construction',
    coursier_id UUID REFERENCES users(id) ON DELETE SET NULL,
    points_passage JSONB NOT NULL DEFAULT '[]',
    distance_totale_km DECIMAL(8,2) NOT NULL DEFAULT 0.0,
    duree_estimee_minutes INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Trigger pour updated_at
CREATE TRIGGER update_chaines_livraison_updated_at 
    BEFORE UPDATE ON chaines_livraison_unifiees 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Index
CREATE INDEX idx_chaines_livraison_commande ON chaines_livraison_unifiees(commande_id);
CREATE INDEX idx_chaines_livraison_coursier ON chaines_livraison_unifiees(coursier_id);
CREATE INDEX idx_chaines_livraison_statut ON chaines_livraison_unifiees(statut);
CREATE INDEX idx_chaines_livraison_reference ON chaines_livraison_unifiees(reference_chaine);

-- Traductions système (internationnalisation)
CREATE TABLE traductions_systeme (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cle_traduction VARCHAR(255) NOT NULL,
    langue VARCHAR(10) NOT NULL,
    traduction TEXT NOT NULL,
    contexte VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Trigger pour updated_at
CREATE TRIGGER update_traductions_systeme_updated_at 
    BEFORE UPDATE ON traductions_systeme 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Index unique sur clé + langue
CREATE UNIQUE INDEX idx_traductions_unique ON traductions_systeme(cle_traduction, langue);
CREATE INDEX idx_traductions_cle ON traductions_systeme(cle_traduction);
CREATE INDEX idx_traductions_langue ON traductions_systeme(langue);

-- ========================================
-- CONFIGURATION SYSTÈME
-- ========================================

CREATE TABLE configuration_systeme (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cle VARCHAR(255) NOT NULL UNIQUE,
    valeur JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Trigger pour updated_at
CREATE TRIGGER update_configuration_systeme_updated_at 
    BEFORE UPDATE ON configuration_systeme 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insertion valeurs par défaut
INSERT INTO configuration_systeme (cle, valeur, description) VALUES
('commission_app', '0.05', 'Commission application (5%)'),
('delai_validation_max', '300', 'Délai max validation librairie (secondes)'),
('rayon_recherche_librairie', '50', 'Rayon recherche librairies (km)'),
('delai_expiration_qr', '86400', 'Délai expiration QR code (secondes)'),
('temps_validation_par_defaut', '5', 'Temps validation par défaut (minutes)'),
('notification_rappel_delai', '120', 'Délai rappel notification (secondes)');

-- ========================================
-- FONCTIONS ET TRIGGERS UTILITAIRES
-- ========================================

-- Génération référence commande
CREATE OR REPLACE FUNCTION generer_reference_commande()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.reference_commande IS NULL OR NEW.reference_commande = '' THEN
        NEW.reference_commande := 'CMD-' || to_char(NOW(), 'YYYY') || '-' || 
                                  LPAD(nextval('commande_seq')::text, 5, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Séquence pour références
CREATE SEQUENCE IF NOT EXISTS commande_seq START 1;

-- Trigger sur commandes_mixtes
CREATE TRIGGER set_reference_commande
    BEFORE INSERT ON commandes_mixtes
    FOR EACH ROW EXECUTE FUNCTION generer_reference_commande();

-- Génération référence chaîne livraison
CREATE OR REPLACE FUNCTION generer_reference_chaine()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.reference_chaine IS NULL OR NEW.reference_chaine = '' THEN
        NEW.reference_chaine := 'CHN-' || to_char(NOW(), 'YYYY') || '-' || 
                               LPAD(nextval('chaine_seq')::text, 5, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Séquence pour chaînes
CREATE SEQUENCE IF NOT EXISTS chaine_seq START 1;

-- Trigger sur chaines_livraison_unifiees
CREATE TRIGGER set_reference_chaine
    BEFORE INSERT ON chaines_livraison_unifiees
    FOR EACH ROW EXECUTE FUNCTION generer_reference_chaine();

-- Fonction distance GPS (Haversine)
CREATE OR REPLACE FUNCTION distance_gps(lat1 FLOAT, lon1 FLOAT, lat2 FLOAT, lon2 FLOAT)
RETURNS FLOAT AS $$
BEGIN
    RETURN 6371 * ACOS(
        COS(RADIANS(lat1)) * COS(RADIANS(lat2)) *
        COS(RADIANS(lon2) - RADIANS(lon1)) +
        SIN(RADIANS(lat1)) * SIN(RADIANS(lat2))
    );
END;
$$ LANGUAGE plpgsql;

-- Fonction librairies proches
CREATE OR REPLACE FUNCTION librairies_proches(
    user_lat FLOAT, 
    user_lng FLOAT, 
    rayon_km INTEGER DEFAULT 50
)
RETURNS TABLE(
    librairie_id UUID,
    nom VARCHAR,
    distance_km FLOAT,
    gps VARCHAR
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        lp.id,
        lp.nom,
        distance_gps(user_lat, user_lng, 
                    SPLIT_PART(lp.gps, ',', 1)::FLOAT, 
                    SPLIT_PART(lp.gps, ',', 2)::FLOAT) as distance_km,
        lp.gps
    FROM librairie_partners lp
    WHERE lp.est_actif = true 
      AND lp.statut = 'actif'
      AND distance_gps(user_lat, user_lng, 
                       SPLIT_PART(lp.gps, ',', 1)::FLOAT, 
                       SPLIT_PART(lp.gps, ',', 2)::FLOAT) <= rayon_km
    ORDER BY distance_km;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- VUES UTILITAIRES
-- ========================================

-- Vue commandes avec détails
CREATE VIEW v_commandes_detaillees AS
SELECT 
    cm.id,
    cm.reference_commande,
    cm.user_id,
    cm.budget_total,
    cm.devise,
    cm.statut,
    cm.mode_livraison,
    cm.created_at,
    COUNT(DISTINCT cln.id) as nb_livres_neufs,
    COUNT(DISTINCT clo.id) as nb_livres_occasion,
    COALESCE(SUM(cln.prix_final * cln.quantite), 0) as total_neufs,
    COALESCE(SUM(clo.prix * clo.quantite), 0) as total_occasion
FROM commandes_mixtes cm
LEFT JOIN commande_livres_neufs cln ON cm.id = cln.commande_id
LEFT JOIN commande_livres_occasion clo ON cm.id = clo.commande_id
GROUP BY cm.id, cm.reference_commande, cm.user_id, cm.budget_total, cm.devise, cm.statut, cm.mode_livraison, cm.created_at;

-- Vue librairies avec statistiques
CREATE VIEW v_librairies_stats AS
SELECT 
    lp.id,
    lp.nom,
    lp.ville,
    lp.rating,
    lp.temps_moyen_validation,
    COUNT(DISTINCT cv.id) as nb_validations,
    COUNT(DISTINCT CASE WHEN cv.statut = 'valide_complet' THEN cv.id END) as nb_validations_completees,
    AVG(EXTRACT(EPOCH FROM (cv.timestamp_fin - cv.timestamp_debut))/60) as temps_moyen_validation_reel
FROM librairie_partners lp
LEFT JOIN commande_validations cv ON lp.id = cv.librairie_id
WHERE lp.est_actif = true
GROUP BY lp.id, lp.nom, lp.ville, lp.rating, lp.temps_moyen_validation;

-- ========================================
-- COMMENTAIRES
-- ========================================

COMMENT ON TABLE librairie_partners IS 'Partenaires librairies pour vente livres neufs';
COMMENT ON TABLE commandes_mixtes IS 'Commandes mixtes (neufs + occasion)';
COMMENT ON TABLE commande_livres_neufs IS 'Livres neufs dans les commandes mixtes';
COMMENT ON TABLE commande_livres_occasion IS 'Livres occasion dans les commandes mixtes';
COMMENT ON TABLE commande_validations IS 'Validations compétitives des librairies';
COMMENT ON TABLE prix_officiels_programme IS 'Prix officiels extraits par IA';
COMMENT ON TABLE qr_codes_coursier IS 'QR codes sécurité pour coursiers';
COMMENT ON TABLE notifications_librairie IS 'Notifications envoyées aux librairies';
COMMENT ON TABLE transactions_agregees IS 'Transactions agrégées avec commission';
COMMENT ON TABLE chaines_livraison_unifiees IS 'Chaînes livraison unifiées';
COMMENT ON TABLE traductions_systeme IS 'Traductions système pour internationnalisation';
