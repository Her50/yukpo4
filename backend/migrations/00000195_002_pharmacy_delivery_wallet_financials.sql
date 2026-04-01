-- Pharmacy sprint pass: delivery linkage, wallet reservation traceability, pharmacist withdrawals.

ALTER TABLE pharmacy_orders
    ADD COLUMN IF NOT EXISTS linked_delivery_id UUID,
    ADD COLUMN IF NOT EXISTS wallet_reserved_cents BIGINT DEFAULT 0,
    ADD COLUMN IF NOT EXISTS wallet_reference TEXT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE table_name = 'pharmacy_orders'
          AND constraint_name = 'fk_pharmacy_orders_linked_delivery'
    ) THEN
        ALTER TABLE pharmacy_orders
            ADD CONSTRAINT fk_pharmacy_orders_linked_delivery
            FOREIGN KEY (linked_delivery_id) REFERENCES deliveries(id) ON DELETE SET NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_pharmacy_orders_linked_delivery_id
    ON pharmacy_orders(linked_delivery_id);

CREATE INDEX IF NOT EXISTS idx_pharmacy_orders_wallet_reserved
    ON pharmacy_orders(wallet_reserved_cents);
