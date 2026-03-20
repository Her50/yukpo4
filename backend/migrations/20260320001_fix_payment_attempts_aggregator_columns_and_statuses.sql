-- Aligne le schéma payment_attempts avec le flux agrégateur actuel.
-- Contexte:
-- - Le code backend met à jour aggregator_provider, aggregator_ref et payment_url.
-- - Le code manipule aussi des statuts "processing" et "completed".
-- - Sur certaines bases, ces colonnes/valeurs ne sont pas présentes dans les migrations SQLx.

ALTER TABLE payment_attempts
    ADD COLUMN IF NOT EXISTS aggregator_provider VARCHAR(30),
    ADD COLUMN IF NOT EXISTS aggregator_ref VARCHAR(255),
    ADD COLUMN IF NOT EXISTS payment_url TEXT;

CREATE INDEX IF NOT EXISTS idx_payment_attempts_aggregator_ref
    ON payment_attempts(aggregator_ref);

-- Normaliser d'éventuels statuts legacy avant de renforcer la contrainte.
UPDATE payment_attempts
SET status = 'success'
WHERE status = 'completed';

-- Remplacer la contrainte de statut par une version compatible avec le code actuel.
ALTER TABLE payment_attempts
    DROP CONSTRAINT IF EXISTS valid_status;

ALTER TABLE payment_attempts
    ADD CONSTRAINT valid_status CHECK (
        status IN (
            'pending',
            'processing',
            'success',
            'completed',
            'failed',
            'cancelled',
            'expired'
        )
    );
