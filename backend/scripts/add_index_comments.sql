-- Ajouter les commentaires aux index créés
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_services_titre_service_tsvector') THEN
        COMMENT ON INDEX idx_services_titre_service_tsvector IS 'Index full-text pour recherche rapide dans titre_service';
    END IF;
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_services_description_tsvector') THEN
        COMMENT ON INDEX idx_services_description_tsvector IS 'Index full-text pour recherche rapide dans description';
    END IF;
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_services_category_tsvector') THEN
        COMMENT ON INDEX idx_services_category_tsvector IS 'Index full-text pour recherche rapide dans category';
    END IF;
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_services_search_combined_tsvector') THEN
        COMMENT ON INDEX idx_services_search_combined_tsvector IS 'Index full-text combiné pour recherche globale rapide';
    END IF;
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_services_products_tsvector') THEN
        COMMENT ON INDEX idx_services_products_tsvector IS 'Index full-text pour recherche dans les produits';
    END IF;
END $$;

