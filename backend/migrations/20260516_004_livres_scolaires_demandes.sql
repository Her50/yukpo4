-- Migration: livres_scolaires_demandes — intégration des acheteurs comme
-- nœuds-sinks dans le DAG de matching de chaînes de troc.
-- Date: 2026-05-16
--
-- Contexte : avant cette migration, un acheteur d'occasion ne pouvait acheter
-- qu'un livre déjà listé en vente directe (table livres_scolaires avec
-- mode_listing='vente'). S'il existait une chaîne possible V → trocer_B →
-- acheteur_Y où la cash de Y débloquait la chaîne pour V, le système ne la
-- voyait pas car les acheteurs n'étaient pas représentés dans le graphe.
--
-- Solution : table `livres_scolaires_demandes` qui matérialise les besoins
-- d'achat d'occasion. find_matching_chaine les charge comme bundles
-- "demande-only" (sans livre offert) et les place en bout de chaîne.

CREATE TABLE IF NOT EXISTS livres_scolaires_demandes (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Identité du livre demandé. ISBN optionnel (souvent inconnu pour
    -- l'occasion), titre + matière + classe sont obligatoires.
    titre TEXT NOT NULL,
    auteur TEXT,
    editeur TEXT,
    isbn TEXT,
    matiere TEXT NOT NULL,
    classe_souhaitee TEXT NOT NULL,
    niveau TEXT,

    -- Budget plafond en XAF (Yukpo Wallet ou cash). Cap utilisé par le
    -- moteur de matching pour proposer une chaîne dont le coût total
    -- reste dans l'enveloppe du buyer.
    budget_max_xaf DOUBLE PRECISION,

    -- Géolocalisation acheteur (lieu de livraison).
    gps TEXT,
    ville TEXT,
    quartier TEXT,

    -- Lien optionnel avec un item du panier frontend (string id, peut être
    -- une UUID ou un id court généré côté useParentShop). Permet de retrouver
    -- la demande lorsque le buyer revient sur son panier.
    panier_item_id TEXT,

    -- Lien optionnel avec une commande_mixte si la demande a été créée au
    -- moment du checkout (pour orchestrer le paiement/réception).
    commande_mixte_id INTEGER,

    -- États
    is_active BOOLEAN NOT NULL DEFAULT true,
    -- Marquée satisfaite quand une chaîne est complétée et livrée.
    is_satisfied BOOLEAN NOT NULL DEFAULT false,
    -- Lien vers la chaîne qui a été acceptée (NULL tant que pas de match).
    matched_chaine_id INTEGER,

    -- Expiration : par défaut 60 jours, comme les listings livres_scolaires.
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '60 days'),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes pour le matching (lookup par classe + matière + actif).
CREATE INDEX IF NOT EXISTS idx_demandes_active_classe
    ON livres_scolaires_demandes (classe_souhaitee, matiere)
    WHERE is_active = true AND is_satisfied = false;

-- Lookup canonique (mêmes fonctions qu'au matching côté code Rust).
CREATE INDEX IF NOT EXISTS idx_demandes_classe_canon
    ON livres_scolaires_demandes (LOWER(BTRIM(classe_souhaitee)), LOWER(BTRIM(matiere)))
    WHERE is_active = true AND is_satisfied = false;

-- Lookup par user (mes demandes).
CREATE INDEX IF NOT EXISTS idx_demandes_user
    ON livres_scolaires_demandes (user_id, is_active, created_at DESC);

-- Lookup par panier_item_id (sync front-back).
CREATE INDEX IF NOT EXISTS idx_demandes_panier_item
    ON livres_scolaires_demandes (panier_item_id)
    WHERE panier_item_id IS NOT NULL;

-- Lookup par commande_mixte_id (fulfillment).
CREATE INDEX IF NOT EXISTS idx_demandes_commande
    ON livres_scolaires_demandes (commande_mixte_id)
    WHERE commande_mixte_id IS NOT NULL;

-- Trigger updated_at (réutilise la fonction commune définie dans 00000163).
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_update_livres_demandes_updated_at'
    ) THEN
        CREATE TRIGGER trigger_update_livres_demandes_updated_at
            BEFORE UPDATE ON livres_scolaires_demandes
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

COMMENT ON TABLE livres_scolaires_demandes IS 'Demandes d''achat de livres d''occasion (acheteur sans livre à offrir). Intégrées dans le DAG de matching comme nœuds-sinks.';
COMMENT ON COLUMN livres_scolaires_demandes.budget_max_xaf IS 'Budget plafond du buyer en XAF (wallet + cash). Le matching propose des chaînes dont le coût ne dépasse pas ce plafond.';
COMMENT ON COLUMN livres_scolaires_demandes.matched_chaine_id IS 'Chaîne acceptée par le buyer. NULL tant que la demande est ouverte au matching.';
COMMENT ON COLUMN livres_scolaires_demandes.panier_item_id IS 'ID de l''item correspondant côté useParentShop (frontend). Permet de retrouver la demande quand le buyer recharge son panier.';
