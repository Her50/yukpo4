-- ============================================================================
-- Migration : indexes de performance pour la rentrée 2026-2027
-- Date : 2026-05-10
-- ============================================================================
-- Anticipe la charge de la rentrée : recherche école par parents, listing des
-- programmes admin, lookup invitations team.
-- ============================================================================

BEGIN;

-- 1. Recherche école par ville (parent qui filtre par ville)
CREATE INDEX IF NOT EXISTS idx_etablissements_published_ville
    ON etablissements_scolaires(ville)
    WHERE page_status = 'published' AND is_active = true;

-- 2. Lookup invitation team par token (acceptation depuis lien WhatsApp)
CREATE INDEX IF NOT EXISTS idx_libraire_invitations_token
    ON libraire_team_invitations(invitation_token);

-- 3. Membres d'équipe librairie actifs (vérification rôle à chaque appel
--    de valider_livres_commande)
CREATE INDEX IF NOT EXISTS idx_libraire_team_members_user_active
    ON libraire_team_members(user_id, is_active)
    WHERE is_active = true;

-- 4. Recherche fuzzy nom + sigle (déjà gin_trgm sur nom_etablissement et
--    nom_abrege via 20260507 et 20260510_001 — vérification que les deux
--    coexistent et n'entrent pas en conflit)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_etablissements_nom_trgm') THEN
        CREATE INDEX idx_etablissements_nom_trgm
            ON etablissements_scolaires
            USING GIN (nom_etablissement gin_trgm_ops);
    END IF;
END $$;

-- 5. Listing programmes par etab + année + classe (déjà couvert par
--    idx_programmes_etab_classe_annee_type — on s'assure juste qu'il existe)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_programmes_etab_annee')
       AND EXISTS (
           SELECT 1 FROM information_schema.columns
           WHERE table_name = 'programmes_scolaires' AND column_name = 'annee_scolaire'
       )
    THEN
        CREATE INDEX idx_programmes_etab_annee
            ON programmes_scolaires(etablissement_id, annee_scolaire)
            WHERE is_active = true;
    END IF;
END $$;

-- 6. Lookup invitation établissement par accepted_user_id (require_etab_role
--    fait ce check à chaque appel d'endpoint admin — index critique)
CREATE INDEX IF NOT EXISTS idx_etab_invitations_accepted_user
    ON etablissement_team_invitations(accepted_user_id, etablissement_id)
    WHERE accepted_at IS NOT NULL;

COMMIT;
