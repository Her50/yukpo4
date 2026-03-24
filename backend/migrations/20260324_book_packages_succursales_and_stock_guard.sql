-- 2026-03-24
-- Bourse du livre: traçabilité succursale choisie + garde-fou stock par succursale
-- Idempotent: peut être rejoué sans effet de bord.

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'book_delivery_packages'
    ) THEN
        ALTER TABLE book_delivery_packages
            ADD COLUMN IF NOT EXISTS librairie_lieu_id INTEGER,
            ADD COLUMN IF NOT EXISTS succursale_label VARCHAR(255),
            ADD COLUMN IF NOT EXISTS stock_disponible_succursale BOOLEAN;

        CREATE INDEX IF NOT EXISTS idx_book_packages_lieu
            ON book_delivery_packages(librairie_lieu_id);

        IF EXISTS (
            SELECT 1
            FROM information_schema.tables
            WHERE table_schema = 'public'
              AND table_name = 'book_purchases'
        ) THEN
            ALTER TABLE book_purchases
                ADD COLUMN IF NOT EXISTS librairie_lieu_id INTEGER,
                ADD COLUMN IF NOT EXISTS succursale_label VARCHAR(255),
                ADD COLUMN IF NOT EXISTS stock_disponible_succursale BOOLEAN;

            CREATE INDEX IF NOT EXISTS idx_book_purchases_lieu
                ON book_purchases(librairie_lieu_id);
        END IF;
    ELSE
        RAISE NOTICE 'book_delivery_packages absente: migration succursales ignorée proprement (book_purchases probablement absente aussi sur cette base cible).';
    END IF;
END
$$;

