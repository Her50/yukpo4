-- ============================================================================
-- 2026-05-15 : Système de parrainage Yukpo (PR #1 — fondations)
--
-- PHILOSOPHIE :
--   • Chaque user a un code unique de 6 chars (sans 0/O/1/I) généré à
--     l'inscription. Partagé via lien ?ref=XXXXXX (cookie 30j).
--   • Filleul attaché à 1 seul parrain max, set une seule fois au signup.
--   • Bonus 500 FCFA crédité au wallet_credit_bourse du PARRAIN UNIQUEMENT
--     quand le filleul passe sa PREMIÈRE commande (livres ou cahiers)
--     en statut "completed" → géré en PR #2.
--   • Retrait cash universel (pas seulement parrains) → table wallet_payout_requests.
--     Tout user avec solde wallet > seuil peut demander, admin traite manuellement
--     (canal mobile money). Pas de fenêtre temporelle stricte côté code.
-- ============================================================================

-- ─── 1. Colonnes sur users ───────────────────────────────────────────────────
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS referral_code VARCHAR(10) UNIQUE,
    ADD COLUMN IF NOT EXISTS referred_by   INTEGER REFERENCES users(id) ON DELETE SET NULL;

-- Pas d'auto-parrainage
ALTER TABLE users
    DROP CONSTRAINT IF EXISTS users_referred_by_not_self;
ALTER TABLE users
    ADD CONSTRAINT users_referred_by_not_self CHECK (referred_by IS NULL OR referred_by <> id);

CREATE INDEX IF NOT EXISTS idx_users_referred_by ON users(referred_by) WHERE referred_by IS NOT NULL;

-- ─── 2. Tracking clics anonymes (avant signup) ───────────────────────────────
CREATE TABLE IF NOT EXISTS referral_clicks (
    id                  BIGSERIAL PRIMARY KEY,
    code                VARCHAR(10) NOT NULL,
    ip_hash             TEXT,
    ua_hash             TEXT,
    landing_path        TEXT,
    signed_up_user_id   INTEGER REFERENCES users(id) ON DELETE SET NULL,
    clicked_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_referral_clicks_code      ON referral_clicks(code);
CREATE INDEX IF NOT EXISTS idx_referral_clicks_clicked   ON referral_clicks(clicked_at DESC);

-- ─── 3. Relations parrain ↔ filleul ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS referrals (
    id                  BIGSERIAL PRIMARY KEY,
    parrain_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    filleul_id          INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    status              TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','converted')),
    first_order_id      INTEGER,
    bonus_credited_at   TIMESTAMPTZ,
    bonus_amount_xaf    INTEGER NOT NULL DEFAULT 500,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT referrals_not_self CHECK (parrain_id <> filleul_id)
);
CREATE INDEX IF NOT EXISTS idx_referrals_parrain ON referrals(parrain_id, status);

-- ─── 4. Demandes de payout cash (universel, pas seulement parrains) ──────────
-- Toute source de crédit dans wallet_credit_bourse_ledger est retirable :
-- ventes livres occasion, troc, bonus parrainage. Admin traite via mobile money.
CREATE TABLE IF NOT EXISTS wallet_payout_requests (
    id              BIGSERIAL PRIMARY KEY,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount_xaf      INTEGER NOT NULL CHECK (amount_xaf > 0),
    operator        TEXT NOT NULL CHECK (operator IN ('orange_money','mtn_momo')),
    phone_e164      TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','approved','paid','rejected')),
    admin_note      TEXT,
    payout_ref      TEXT,
    requested_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at    TIMESTAMPTZ,
    paid_at         TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_wallet_payout_user_status ON wallet_payout_requests(user_id, status);
CREATE INDEX IF NOT EXISTS idx_wallet_payout_pending     ON wallet_payout_requests(requested_at DESC) WHERE status = 'pending';

-- ─── 5. Backfill : générer un code pour les users existants ──────────────────
-- Alphabet sans 0/O/1/I/L pour éviter confusion à l'oral.
-- Fonction utilisée UNIQUEMENT pour le backfill ; la génération runtime se
-- fait côté Rust dans referral_service::generate_code() (avec retry sur conflit).
DO $$
DECLARE
    rec RECORD;
    new_code TEXT;
    alphabet TEXT := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    attempt INT;
BEGIN
    FOR rec IN SELECT id FROM users WHERE referral_code IS NULL LOOP
        attempt := 0;
        LOOP
            new_code := '';
            FOR i IN 1..6 LOOP
                new_code := new_code || substr(alphabet, 1 + floor(random() * length(alphabet))::INT, 1);
            END LOOP;
            BEGIN
                UPDATE users SET referral_code = new_code WHERE id = rec.id;
                EXIT;
            EXCEPTION WHEN unique_violation THEN
                attempt := attempt + 1;
                IF attempt > 10 THEN
                    RAISE NOTICE 'Failed to generate unique code for user %, skipping', rec.id;
                    EXIT;
                END IF;
            END;
        END LOOP;
    END LOOP;
END $$;
