-- Migration: Correction du trigger de synchronisation products_lifecycle
-- Date: 2025-12-01
-- Description: Corrige le trigger pour gérer les deux formats de stockage des produits
--              (array direct et array dans objet avec type_donnee)

-- 1. Corriger la fonction de synchronisation pour gérer les deux formats
CREATE OR REPLACE FUNCTION sync_product_on_service_update()
RETURNS TRIGGER AS $$
DECLARE
    product_record JSONB;
    product_idx INTEGER;
    produits_array JSONB;
BEGIN
    -- ✅ Détecter le format 1 : array direct (data->'produits' = array)
    IF jsonb_typeof(NEW.data->'produits') = 'array' THEN
        produits_array := NEW.data->'produits';
    -- ✅ Détecter le format 2 : array dans objet avec type_donnee (data->'produits'->'valeur' = array)
    ELSIF jsonb_typeof(NEW.data->'produits') = 'object' 
        AND jsonb_typeof(NEW.data->'produits'->'valeur') = 'array' THEN
        produits_array := NEW.data->'produits'->'valeur';
    ELSE
        -- Aucun produit à synchroniser
        RETURN NEW;
    END IF;
    
    -- Synchroniser tous les produits
    product_idx := 0;
    FOR product_record IN 
        SELECT * FROM jsonb_array_elements(produits_array)
    LOOP
        INSERT INTO products_lifecycle (
            service_id,
            product_index,
            product_nom,
            product_type,
            is_active,
            auto_deactivate_at
        ) VALUES (
            NEW.id,
            product_idx,
            COALESCE(
                product_record->>'nom', 
                product_record->>'name', 
                'Produit'
            ),
            COALESCE(product_record->>'type', 'autre'),
            TRUE,
            NOW() + INTERVAL '30 days'
        )
        ON CONFLICT (service_id, product_index) 
        DO UPDATE SET
            product_nom = EXCLUDED.product_nom,
            product_type = EXCLUDED.product_type,
            updated_at = NOW();
        
        product_idx := product_idx + 1;
    END LOOP;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Corriger le trigger pour détecter les deux formats
DROP TRIGGER IF EXISTS trigger_sync_products ON services;
CREATE TRIGGER trigger_sync_products
    AFTER INSERT OR UPDATE ON services
    FOR EACH ROW
    WHEN (
        -- Format 1 : array direct
        jsonb_typeof(NEW.data->'produits') = 'array'
        OR 
        -- Format 2 : array dans objet
        (
            jsonb_typeof(NEW.data->'produits') = 'object' 
            AND jsonb_typeof(NEW.data->'produits'->'valeur') = 'array'
        )
    )
    EXECUTE FUNCTION sync_product_on_service_update();

-- 3. Corriger la fonction sync_products_to_lifecycle() pour gérer les deux formats
CREATE OR REPLACE FUNCTION sync_products_to_lifecycle()
RETURNS void AS $$
DECLARE
    service_record RECORD;
    product_record JSONB;
    product_idx INTEGER;
    produits_array JSONB;
BEGIN
    -- Itérer sur tous les services actifs avec des produits
    FOR service_record IN 
        SELECT id, data 
        FROM services 
        WHERE is_active = TRUE 
        AND (
            jsonb_typeof(data->'produits') = 'array'
            OR (
                jsonb_typeof(data->'produits') = 'object' 
                AND jsonb_typeof(data->'produits'->'valeur') = 'array'
            )
        )
    LOOP
        -- Détecter le format
        IF jsonb_typeof(service_record.data->'produits') = 'array' THEN
            produits_array := service_record.data->'produits';
        ELSIF jsonb_typeof(service_record.data->'produits') = 'object' 
            AND jsonb_typeof(service_record.data->'produits'->'valeur') = 'array' THEN
            produits_array := service_record.data->'produits'->'valeur';
        ELSE
            CONTINUE;
        END IF;
        
        product_idx := 0;
        
        -- Itérer sur chaque produit du service
        FOR product_record IN 
            SELECT * FROM jsonb_array_elements(produits_array)
        LOOP
            -- Insérer ou mettre à jour dans products_lifecycle
            INSERT INTO products_lifecycle (
                service_id,
                product_index,
                product_nom,
                product_type,
                is_active,
                created_at,
                auto_deactivate_at
            ) VALUES (
                service_record.id,
                product_idx,
                COALESCE(
                    product_record->>'nom', 
                    product_record->>'name', 
                    'Produit'
                ),
                COALESCE(product_record->>'type', 'autre'),
                TRUE,
                NOW(),
                NOW() + INTERVAL '30 days'
            )
            ON CONFLICT (service_id, product_index) 
            DO UPDATE SET
                product_nom = EXCLUDED.product_nom,
                product_type = EXCLUDED.product_type,
                updated_at = NOW();
            
            product_idx := product_idx + 1;
        END LOOP;
    END LOOP;
    
    RAISE NOTICE 'Synchronisation des produits terminée';
END;
$$ LANGUAGE plpgsql;

-- 4. Fonction pour synchroniser les produits manquants (services existants)
DROP FUNCTION IF EXISTS sync_missing_products();
CREATE FUNCTION sync_missing_products()
RETURNS TABLE(
    svc_id INTEGER,
    products_synced INTEGER
) AS $$
DECLARE
    service_record RECORD;
    product_record JSONB;
    product_idx INTEGER;
    produits_array JSONB;
    synced_count INTEGER;
BEGIN
    FOR service_record IN 
        SELECT id, data 
        FROM services 
        WHERE is_active = TRUE
    LOOP
        synced_count := 0;
        
        -- Détecter le format
        IF jsonb_typeof(service_record.data->'produits') = 'array' THEN
            produits_array := service_record.data->'produits';
        ELSIF jsonb_typeof(service_record.data->'produits') = 'object' 
            AND jsonb_typeof(service_record.data->'produits'->'valeur') = 'array' THEN
            produits_array := service_record.data->'produits'->'valeur';
        ELSE
            CONTINUE;
        END IF;
        
        -- Synchroniser chaque produit
        product_idx := 0;
        FOR product_record IN 
            SELECT * FROM jsonb_array_elements(produits_array)
        LOOP
            INSERT INTO products_lifecycle (
                service_id,
                product_index,
                product_nom,
                product_type,
                is_active,
                auto_deactivate_at
            ) VALUES (
                service_record.id,
                product_idx,
                COALESCE(
                    product_record->>'nom', 
                    product_record->>'name', 
                    'Produit'
                ),
                COALESCE(product_record->>'type', 'autre'),
                TRUE,
                NOW() + INTERVAL '30 days'
            )
            ON CONFLICT (service_id, product_index) 
            DO UPDATE SET
                product_nom = EXCLUDED.product_nom,
                product_type = EXCLUDED.product_type,
                updated_at = NOW();
            
            synced_count := synced_count + 1;
            product_idx := product_idx + 1;
        END LOOP;
        
        IF synced_count > 0 THEN
            svc_id := service_record.id;
            products_synced := synced_count;
            RETURN NEXT;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 5. Exécuter la synchronisation des produits manquants
-- Note: Cette opération peut prendre du temps selon le nombre de services
DO $$
DECLARE
    result RECORD;
    total_services INTEGER := 0;
    total_products INTEGER := 0;
BEGIN
    RAISE NOTICE 'Début de la synchronisation des produits manquants...';
    
    FOR result IN 
        SELECT svc_id, products_synced FROM sync_missing_products()
    LOOP
        total_services := total_services + 1;
        total_products := total_products + result.products_synced;
    END LOOP;
    
    RAISE NOTICE 'Synchronisation terminée: % services, % produits synchronisés', 
        total_services, total_products;
END $$;

-- 6. Statistiques après synchronisation
SELECT 
    COUNT(DISTINCT service_id) as services_avec_produits,
    COUNT(*) as total_produits,
    SUM(CASE WHEN is_active THEN 1 ELSE 0 END) as produits_actifs,
    SUM(CASE WHEN NOT is_active THEN 1 ELSE 0 END) as produits_inactifs
FROM products_lifecycle;

-- Commentaire pour documenter la correction
COMMENT ON FUNCTION sync_product_on_service_update() IS 
    'Synchronise automatiquement les produits dans products_lifecycle lors de la création/mise à jour d''un service. Gère deux formats: array direct (data->produits) et array dans objet (data->produits->valeur)';

COMMENT ON FUNCTION sync_missing_products() IS 
    'Synchronise les produits manquants pour les services existants. À exécuter manuellement si nécessaire.';

