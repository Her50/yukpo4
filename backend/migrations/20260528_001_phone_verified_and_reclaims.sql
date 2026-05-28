-- =============================================================================
-- Migration : phone_verified + table phone_reclaims (anti-fraude squat numéro)
-- =============================================================================
-- Date    : 2026-05-28
-- Contexte: l'auth phone+PIN (migration 20260526_001) ne vérifie pas que
--           l'inscrit possède réellement la SIM (pas de Twilio). Un fraudeur
--           peut "squatter" un numéro qui ne lui appartient pas.
--
-- Défenses ajoutées :
--   1. Colonne users.phone_verified — par défaut FALSE pour tous les nouveaux
--      comptes phone+PIN. Sera passée à TRUE quand SMS/OTP arrivera, ou par
--      validation manuelle (admin / librairie partenaire).
--   2. Table phone_reclaims — file de signalements "ce n'est pas mon numéro".
--      Permet au vrai propriétaire de réclamer un numéro déjà pris.
--
-- Idempotence : ADD COLUMN IF NOT EXISTS + CREATE TABLE IF NOT EXISTS.
-- =============================================================================

-- 1. phone_verified : statut de vérification du numéro
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN NOT NULL DEFAULT FALSE;

-- Comptes legacy email+password : on les considère vérifiés implicitement
-- (ils n'ont pas créé de compte via phone+PIN, donc pas de risque squat).
-- Ne touche que les rows qui ont phone IS NOT NULL ET pin_hash IS NULL :
-- ce sont les vieux comptes pré-migration phone-PIN.
UPDATE users
   SET phone_verified = TRUE
 WHERE phone IS NOT NULL
   AND pin_hash IS NULL
   AND phone_verified = FALSE;

-- 2. Table phone_reclaims : signalements de squat
CREATE TABLE IF NOT EXISTS phone_reclaims (
    id              BIGSERIAL PRIMARY KEY,
    phone           TEXT NOT NULL,
    -- Lien optionnel vers l'utilisateur "squatteur" présumé (peut être NULL
    -- si ce n'est plus pertinent au moment du traitement).
    target_user_id  INT REFERENCES users(id) ON DELETE SET NULL,
    -- Coordonnées du réclamant pour le rappel admin. Email/phone alternatif.
    contact         TEXT NOT NULL,
    reason          TEXT,
    status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'reviewing', 'resolved', 'rejected')),
    -- IP + UA pour anti-spam massif (signalements répétés depuis même device).
    ip_address      INET,
    user_agent      TEXT,
    admin_notes     TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_phone_reclaims_phone   ON phone_reclaims (phone);
CREATE INDEX IF NOT EXISTS idx_phone_reclaims_status  ON phone_reclaims (status)
    WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_phone_reclaims_created ON phone_reclaims (created_at DESC);

-- Anti-spam : un même IP ne peut pas créer > 3 réclamations / 24 h pour le
-- même numéro. Géré côté backend (pas une contrainte SQL).

-- 3. Vérification finale
DO $$
DECLARE
    nb_verified   INTEGER;
    nb_unverified INTEGER;
BEGIN
    SELECT COUNT(*) INTO nb_verified   FROM users WHERE phone_verified = TRUE;
    SELECT COUNT(*) INTO nb_unverified FROM users WHERE phone_verified = FALSE;
    RAISE NOTICE '[phone-verified] verified: %, unverified: %', nb_verified, nb_unverified;
END $$;
