-- Journal des consentements utilisateur pour la PWA Pharmacie.
--
-- Conformité : permet de prouver qu'un utilisateur a explicitement accepté
-- les conditions d'utilisation (informations indicatives, ne remplaçant pas
-- l'avis d'un pharmacien/médecin) avant d'utiliser les fonctions IA
-- (posologie, interactions, alternatives).
--
-- Le frontend stocke aussi le consentement en localStorage pour éviter
-- de redemander à chaque visite, mais le log serveur sert de preuve.
--
-- user_id est NULL pour les utilisateurs non authentifiés (la PWA pharmacie
-- est en partie publique). Dans ce cas on retient l'IP hashée et le user-agent.

CREATE TABLE IF NOT EXISTS pharmacie_consents (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    -- Hash SHA-256 hex de l'IP (32-64 chars). On évite de stocker l'IP claire
    -- pour rester aligné avec les exigences RGPD / loi 2024-046 Cameroun.
    ip_hash VARCHAR(128),
    user_agent VARCHAR(512),
    -- Version du texte de consentement accepté (en cas de changement, on
    -- redemandera l'acceptation aux utilisateurs ayant accepté une version
    -- antérieure).
    consent_version VARCHAR(32) NOT NULL DEFAULT 'v1',
    accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Méta libre : langue affichée, parcours d'arrivée, etc.
    meta JSONB
);

CREATE INDEX IF NOT EXISTS idx_pharmacie_consents_user
    ON pharmacie_consents (user_id) WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pharmacie_consents_ip
    ON pharmacie_consents (ip_hash) WHERE ip_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pharmacie_consents_accepted_at
    ON pharmacie_consents (accepted_at DESC);
