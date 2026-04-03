-- Migration: Étendre wallet_transactions pour tous les services (pharmacie, restaurant, etc.)
-- La table originale (bus_ticket_escrow_credit_system) a une contrainte CHECK trop restrictive.
-- On supprime la contrainte et on ajoute les colonnes manquantes utilisées par les contrôleurs.
-- Date: 2026-04-03

-- 1. Supprimer la contrainte CHECK restrictive sur transaction_type
DO $$
DECLARE
    constraint_name TEXT;
BEGIN
    SELECT tc.constraint_name INTO constraint_name
    FROM information_schema.table_constraints tc
    WHERE tc.table_name = 'wallet_transactions'
      AND tc.constraint_type = 'CHECK'
      AND tc.constraint_name LIKE '%transaction_type%';

    IF constraint_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE wallet_transactions DROP CONSTRAINT ' || quote_ident(constraint_name);
    END IF;

    -- Aussi chercher par pattern générique si le nom diffère
    FOR constraint_name IN
        SELECT tc.constraint_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.check_constraints cc USING (constraint_name)
        WHERE tc.table_name = 'wallet_transactions'
          AND tc.constraint_type = 'CHECK'
          AND cc.check_clause LIKE '%transaction_type%'
    LOOP
        EXECUTE 'ALTER TABLE wallet_transactions DROP CONSTRAINT IF EXISTS ' || quote_ident(constraint_name);
    END LOOP;
END $$;

-- 2. Ajouter les colonnes manquantes
--    Groupe A : utilisées par le reversal pharmacie / payout restaurant (nouveau format)
ALTER TABLE wallet_transactions
    ADD COLUMN IF NOT EXISTS direction            TEXT,     -- 'credit' | 'debit'
    ADD COLUMN IF NOT EXISTS amount_cents         BIGINT,   -- montant en centimes (pharmacie/restaurant)
    ADD COLUMN IF NOT EXISTS balance_before_cents BIGINT,
    ADD COLUMN IF NOT EXISTS balance_after_cents  BIGINT;

--    Groupe B : utilisées par l'ancien code restaurant (format historique)
ALTER TABLE wallet_transactions
    ADD COLUMN IF NOT EXISTS montant          NUMERIC(12,2),  -- montant FCFA (décimale)
    ADD COLUMN IF NOT EXISTS type_transaction TEXT,           -- 'credit' | 'debit'
    ADD COLUMN IF NOT EXISTS motif            TEXT;           -- description courte

-- 3. Rendre les colonnes originales nullable (certains inserts n'ont pas ces colonnes)
ALTER TABLE wallet_transactions
    ALTER COLUMN amount        DROP NOT NULL,
    ALTER COLUMN balance_before DROP NOT NULL,
    ALTER COLUMN balance_after  DROP NOT NULL;

-- 4. Commission Yukpo restaurant
INSERT INTO yukpo_commission_config (service_type, rate)
VALUES ('restaurant', 0.02)
ON CONFLICT (service_type) DO NOTHING;

-- 5. Colonnes de traçabilité financière pour restaurant_orders (manquantes)
ALTER TABLE restaurant_orders
    ADD COLUMN IF NOT EXISTS wallet_reserved_cents  BIGINT DEFAULT 0,
    ADD COLUMN IF NOT EXISTS reversed_at            TIMESTAMPTZ;

-- 6. Index pour audits
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_direction ON wallet_transactions(direction);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_type ON wallet_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_restaurant_orders_reversed_at ON restaurant_orders(reversed_at);
