-- 2026-05-19 — Fix enum delivery_courier_status désynchronisé.
--
-- Contexte : la migration `0000_create_all_tables.sql:2331` crée l'enum
-- avec les valeurs historiques {pending_review, approved, rejected, suspended}.
-- La migration `00001030_create_delivery_tables.sql:39` tente de re-créer
-- l'enum avec les valeurs modernes {pending_review, active, suspended,
-- inactive, rejected} mais le `DO BEGIN ... EXCEPTION WHEN duplicate_object
-- THEN NULL` capture l'erreur et ne fait rien. Résultat : le code Rust
-- attend `active` mais le DB a `approved` → endpoint /packages/{id}/
-- assign-courier filtre `status='active'` → 0 coursiers détectés.
--
-- Sim 15 a révélé le bug en staging. Probable aussi en prod.
--
-- Fix : ajouter `active` et `inactive` à l'enum existant via ALTER TYPE
-- ADD VALUE IF NOT EXISTS. Idempotent.
--
-- Note : ALTER TYPE ADD VALUE refuse d'être dans une transaction.
-- sqlx::migrate!() en sqlx 0.8 gère ça correctement en détectant
-- automatiquement et en passant le statement hors-tx.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumlabel = 'active'
          AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'delivery_courier_status')
    ) THEN
        ALTER TYPE delivery_courier_status ADD VALUE 'active';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumlabel = 'inactive'
          AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'delivery_courier_status')
    ) THEN
        ALTER TYPE delivery_courier_status ADD VALUE 'inactive';
    END IF;
END $$;
