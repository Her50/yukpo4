-- ============================================================================
-- Migration : Équipe établissement (invitations partageables WhatsApp)
-- Date : 2026-05-10
-- ============================================================================
-- Permet au responsable d'un établissement d'inviter des membres pour gérer
-- la page (rôle manager / editor / viewer). Pattern calqué sur la table
-- libraire_team_invitations.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS etablissement_team_invitations (
    id                SERIAL PRIMARY KEY,
    etablissement_id  INTEGER NOT NULL REFERENCES etablissements_scolaires(id) ON DELETE CASCADE,
    invitation_token  TEXT NOT NULL UNIQUE,
    role              VARCHAR(20) NOT NULL DEFAULT 'editor'
                      CHECK (role IN ('manager', 'editor', 'viewer')),
    telephone         VARCHAR(50),
    nom_affiche       VARCHAR(255),
    invited_by        INTEGER REFERENCES users(id) ON DELETE SET NULL,
    opened_at         TIMESTAMPTZ,
    accepted_at       TIMESTAMPTZ,
    accepted_user_id  INTEGER REFERENCES users(id) ON DELETE SET NULL,
    expires_at        TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '30 days',
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_etab_invitations_etab
    ON etablissement_team_invitations(etablissement_id, accepted_at);

CREATE INDEX IF NOT EXISTS idx_etab_invitations_token
    ON etablissement_team_invitations(invitation_token);

-- Une fois acceptée, l'invitation référence un user qu'on peut considérer
-- comme membre actif de l'équipe (même mécanisme léger que pour libraire :
-- pas de table membres séparée, on lit accepted_user_id directement).

COMMIT;
