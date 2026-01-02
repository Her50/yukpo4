-- Migration: Queue asynchrone pour création de produits
-- ✅ SOLUTION DÉFINITIVE: Évite les timeouts et les erreurs TLS

CREATE TABLE IF NOT EXISTS product_creation_queue (
    id BIGSERIAL PRIMARY KEY,
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_data JSONB NOT NULL,
    images_to_process TEXT[] DEFAULT '{}',
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    priority INTEGER NOT NULL DEFAULT 5,
    attempt_count INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 3,
    error_message TEXT,
    result_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_queue_status_priority 
    ON product_creation_queue(status, priority, created_at) 
    WHERE status IN ('pending', 'processing');

CREATE INDEX IF NOT EXISTS idx_product_queue_created_at 
    ON product_creation_queue(created_at) 
    WHERE status IN ('completed', 'failed');

CREATE INDEX IF NOT EXISTS idx_product_queue_service_id 
    ON product_creation_queue(service_id) 
    WHERE status = 'pending';

CREATE OR REPLACE FUNCTION cleanup_old_product_creation_jobs()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM product_creation_queue
    WHERE status IN ('completed', 'failed')
      AND created_at < NOW() - INTERVAL '7 days';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE product_creation_queue IS 'Queue asynchrone pour création de produits. Évite les timeouts et erreurs TLS en traitant les créations en arrière-plan.';
COMMENT ON FUNCTION cleanup_old_product_creation_jobs IS 'Nettoie les jobs de création de produits de plus de 7 jours.';

