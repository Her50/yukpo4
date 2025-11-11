-- Migration pour système de signalement de produits/services
-- Date: 2025-10-20
-- Description: Permet aux utilisateurs de signaler des produits/services problématiques

-- 1. Table pour les signalements
CREATE TABLE IF NOT EXISTS signalements (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    service_id INTEGER REFERENCES services(id) ON DELETE CASCADE,
    product_id TEXT, -- ID du produit dans le service (peut être null si signalement du service entier)
    product_name TEXT, -- Nom du produit signalé
    type_signalement VARCHAR(50) NOT NULL CHECK (type_signalement IN (
        'contenu_inapproprie',
        'arnaque_suspectee',
        'prix_trompeur',
        'produit_contrefait',
        'photo_trompeuse',
        'harcèlement',
        'spam',
        'informations_fausses',
        'autre'
    )),
    motifs_predefinis TEXT[], -- Motifs cochés depuis la liste
    motif_libre TEXT, -- Description libre du problème
    preuves JSONB, -- Screenshots, liens, etc.
    statut VARCHAR(20) DEFAULT 'en_attente' CHECK (statut IN (
        'en_attente',
        'en_cours',
        'resolu',
        'rejete',
        'archive'
    )),
    priorite VARCHAR(20) DEFAULT 'normale' CHECK (priorite IN ('basse', 'normale', 'haute', 'urgente')),
    moderateur_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    decision TEXT, -- Décision du modérateur
    action_prise TEXT, -- Action effectuée (avertissement, suspension, suppression, etc.)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    traite_at TIMESTAMP WITH TIME ZONE
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_signalements_user ON signalements(user_id);
CREATE INDEX IF NOT EXISTS idx_signalements_service ON signalements(service_id);
CREATE INDEX IF NOT EXISTS idx_signalements_product ON signalements(product_id);
CREATE INDEX IF NOT EXISTS idx_signalements_statut ON signalements(statut);
CREATE INDEX IF NOT EXISTS idx_signalements_created ON signalements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_signalements_priorite ON signalements(priorite, created_at DESC);

-- 2. Table pour historique de sanctions (pour gérer les récidivistes)
CREATE TABLE IF NOT EXISTS sanctions_historique (
    id SERIAL PRIMARY KEY,
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    signalement_id INTEGER REFERENCES signalements(id) ON DELETE SET NULL,
    type_sanction VARCHAR(50) NOT NULL CHECK (type_sanction IN (
        'avertissement',
        'suspension_temporaire',
        'suspension_definitive',
        'suppression_service',
        'suppression_produit',
        'restriction_publication'
    )),
    duree_jours INTEGER, -- Durée de la sanction en jours (null = définitif)
    raison TEXT NOT NULL,
    moderateur_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    debut_sanction TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    fin_sanction TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sanctions_service ON sanctions_historique(service_id);
CREATE INDEX IF NOT EXISTS idx_sanctions_user ON sanctions_historique(user_id);
CREATE INDEX IF NOT EXISTS idx_sanctions_active ON sanctions_historique(is_active, fin_sanction);

-- 3. Vue pour statistiques de signalements par prestataire
CREATE OR REPLACE VIEW prestataire_signalements_stats AS
SELECT 
    s.user_id,
    u.nom_complet,
    COUNT(*) as total_signalements,
    COUNT(*) FILTER (WHERE sig.statut = 'en_attente') as signalements_en_attente,
    COUNT(*) FILTER (WHERE sig.statut = 'resolu') as signalements_resolus,
    COUNT(*) FILTER (WHERE sig.statut = 'rejete') as signalements_rejetes,
    COUNT(*) FILTER (WHERE sig.created_at > NOW() - INTERVAL '30 days') as signalements_30j,
    MAX(sig.created_at) as dernier_signalement
FROM services s
LEFT JOIN signalements sig ON sig.service_id = s.id
JOIN users u ON s.user_id = u.id
GROUP BY s.user_id, u.nom_complet;

-- 4. Fonction pour détecter les prestataires à risque
CREATE OR REPLACE FUNCTION check_prestataire_risque(p_user_id INTEGER)
RETURNS JSON AS $$
DECLARE
    signalements_count INTEGER;
    sanctions_count INTEGER;
    dernier_signalement TIMESTAMP;
    result JSON;
BEGIN
    -- Compter les signalements non résolus
    SELECT COUNT(*), MAX(created_at) 
    INTO signalements_count, dernier_signalement
    FROM signalements sig
    JOIN services s ON sig.service_id = s.id
    WHERE s.user_id = p_user_id 
      AND sig.statut IN ('en_attente', 'en_cours');
    
    -- Compter les sanctions actives
    SELECT COUNT(*) 
    INTO sanctions_count
    FROM sanctions_historique
    WHERE user_id = p_user_id 
      AND is_active = TRUE
      AND (fin_sanction IS NULL OR fin_sanction > NOW());
    
    -- Déterminer le niveau de risque
    result := json_build_object(
        'risque', CASE 
            WHEN sanctions_count > 0 THEN 'élevé'
            WHEN signalements_count >= 3 THEN 'moyen'
            WHEN signalements_count > 0 THEN 'faible'
            ELSE 'aucun'
        END,
        'signalements_actifs', signalements_count,
        'sanctions_actives', sanctions_count,
        'dernier_signalement', dernier_signalement,
        'recommandation', CASE
            WHEN sanctions_count > 0 THEN 'Prestataire sanctionné - Procéder avec prudence'
            WHEN signalements_count >= 3 THEN 'Plusieurs signalements - Vérifier attentivement'
            WHEN signalements_count > 0 THEN 'Signalement en cours - Rester vigilant'
            ELSE 'Aucun signalement connu'
        END
    );
    
    RETURN result;
END;
$$ LANGUAGE plpgsql STABLE;

-- 5. Trigger pour mettre à jour updated_at
CREATE OR REPLACE FUNCTION update_signalement_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    IF NEW.statut != OLD.statut AND NEW.statut IN ('resolu', 'rejete') THEN
        NEW.traite_at = NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_signalement_timestamp
BEFORE UPDATE ON signalements
FOR EACH ROW
EXECUTE FUNCTION update_signalement_timestamp();

-- Commentaires
COMMENT ON TABLE signalements IS 'Signalements de produits/services par les utilisateurs';
COMMENT ON COLUMN signalements.motifs_predefinis IS 'Liste des motifs cochés par l''utilisateur';
COMMENT ON COLUMN signalements.motif_libre IS 'Description libre du problème';
COMMENT ON COLUMN signalements.preuves IS 'Captures d''écran, liens, documents de preuve';
COMMENT ON TABLE sanctions_historique IS 'Historique des sanctions appliquées aux prestataires';
COMMENT ON FUNCTION check_prestataire_risque IS 'Retourne le niveau de risque d''un prestataire';

