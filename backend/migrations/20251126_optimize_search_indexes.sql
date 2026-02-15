-- Migration: Optimisation des index de recherche
-- Date: 2025-11-26
-- Description: Ajoute des index pour améliorer les performances de recherche
-- Compatible SQLx offline mode

-- Index pour services.search_vector (si la colonne existe)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'services' 
        AND column_name = 'search_vector'
    ) THEN
        CREATE INDEX IF NOT EXISTS idx_services_search_vector 
        ON services USING GIN(search_vector);
    END IF;
END $$;

-- Index pour autocomplete_characteristics
CREATE INDEX IF NOT EXISTS idx_autocomplete_characteristics_value 
ON autocomplete_characteristics(value) 
WHERE is_active = TRUE;

-- Index pour products_lifecycle
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'products_lifecycle') THEN
        CREATE INDEX IF NOT EXISTS idx_products_lifecycle_service_status 
        ON products_lifecycle(service_id, status) 
        WHERE status = 'active';
    END IF;
END $$;

