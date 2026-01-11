-- Migration: Gestion du cycle de vie des produits (désactivation/réactivation)
-- Date: 2025-01-19
-- Description: Déplace la logique de désactivation automatique des services vers les produits

-- 1. Ajouter les champs de gestion de cycle de vie aux produits
-- Note: Les produits sont stockés dans service.data->'produits' (JSONB array)
-- On va créer une table dédiée pour tracker l'état des produits

CREATE TABLE IF NOT EXISTS products_lifecycle (
    id SERIAL PRIMARY KEY,
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    product_index INTEGER NOT NULL, -- Index du produit dans le tableau data->'produits'
    product_nom TEXT NOT NULL,
    product_type TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    auto_deactivate_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days'), -- Désactivation après 30 jours
    last_reactivated_at TIMESTAMPTZ,
    reactivation_cost INTEGER DEFAULT 1000, -- 1000 FCFA par produit
    deactivation_count INTEGER DEFAULT 0,
    total_reactivation_paid INTEGER DEFAULT 0,
    
    -- Contrainte d'unicité : un seul enregistrement par produit
    UNIQUE(service_id, product_index)
);

-- 2. Index pour optimiser les requêtes
CREATE INDEX IF NOT EXISTS idx_products_lifecycle_service_id ON products_lifecycle(service_id);
CREATE INDEX IF NOT EXISTS idx_products_lifecycle_active ON products_lifecycle(is_active);
CREATE INDEX IF NOT EXISTS idx_products_lifecycle_auto_deactivate ON products_lifecycle(auto_deactivate_at) 
WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_products_lifecycle_service_active ON products_lifecycle(service_id, is_active);

-- 3. Fonction pour synchroniser les produits existants vers la table lifecycle
CREATE OR REPLACE FUNCTION sync_products_to_lifecycle()
RETURNS void AS $$
DECLARE
    service_record RECORD;
    product_record JSONB;
    product_idx INTEGER;
BEGIN
    -- Itérer sur tous les services actifs avec des produits
    FOR service_record IN 
        SELECT id, data 
        FROM services 
        WHERE is_active = TRUE 
        AND jsonb_typeof(data->'produits') = 'array'
    LOOP
        product_idx := 0;
        
        -- Itérer sur chaque produit du service
        FOR product_record IN 
            SELECT * FROM jsonb_array_elements(service_record.data->'produits')
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
                COALESCE(product_record->>'nom', product_record->>'name', 'Produit'),
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

-- 4. Fonction pour désactiver automatiquement les produits expirés
-- ✅ CORRIGÉ 2026-01-XX: Utiliser service_products.is_active comme source de vérité
-- Synchroniser products_lifecycle pour les métadonnées de cycle de vie
CREATE OR REPLACE FUNCTION deactivate_expired_products()
RETURNS TABLE(
    service_id INTEGER,
    product_index INTEGER,
    product_nom TEXT,
    user_id INTEGER,
    deactivation_reason TEXT
) AS $$
BEGIN
    RETURN QUERY
    UPDATE service_products sp
    SET 
        is_active = FALSE,
        updated_at = NOW(),
        product_data = jsonb_set(
            COALESCE(sp.product_data, '{}'::jsonb),
            '{deactivated_at}',
            to_jsonb(NOW()::text),
            true
        ) || jsonb_build_object(
            'deactivation_type', 'auto',
            'deactivation_reason', 'expired_time'
        )
    FROM services s
    LEFT JOIN products_lifecycle pl ON pl.service_id = sp.service_id AND pl.product_index = sp.product_index
    WHERE sp.service_id = s.id
        AND sp.is_active = TRUE
        AND COALESCE(sp.auto_deactivate_at, pl.auto_deactivate_at) <= NOW()
    RETURNING 
        sp.service_id,
        sp.product_index,
        COALESCE(sp.product_name, pl.product_nom, 'Produit'),
        s.user_id,
        'expired_time'::TEXT;
    
    -- Synchroniser products_lifecycle (métadonnées de cycle de vie)
    UPDATE products_lifecycle pl
    SET 
        is_active = FALSE,
        updated_at = NOW(),
        deactivation_count = deactivation_count + 1
    FROM service_products sp
    WHERE pl.service_id = sp.service_id
        AND pl.product_index = sp.product_index
        AND sp.is_active = FALSE
        AND pl.is_active = TRUE;
END;
$$ LANGUAGE plpgsql;

-- 5. Fonction pour réactiver un produit avec paiement
CREATE OR REPLACE FUNCTION reactivate_product(
    p_service_id INTEGER,
    p_product_index INTEGER,
    p_user_id INTEGER
) RETURNS JSONB AS $$
DECLARE
    v_reactivation_cost INTEGER := 1000; -- 1000 FCFA par produit
    v_user_balance BIGINT;
    v_product RECORD;
BEGIN
    -- ✅ CORRIGÉ 2026-01-XX: Vérifier dans service_products (source de vérité)
    SELECT sp.*, s.user_id INTO v_product
    FROM service_products sp
    JOIN services s ON s.id = sp.service_id
    WHERE sp.service_id = p_service_id
        AND sp.product_index = p_product_index
        AND s.user_id = p_user_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'Produit non trouvé ou accès refusé'
        );
    END IF;
    
    -- Vérifier si le produit est déjà actif
    IF v_product.is_active THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'Produit déjà actif'
        );
    END IF;
    
    -- Vérifier le solde de l'utilisateur
    SELECT tokens_balance INTO v_user_balance
    FROM users
    WHERE id = p_user_id;
    
    IF v_user_balance < v_reactivation_cost THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'Solde insuffisant',
            'required', v_reactivation_cost,
            'balance', v_user_balance
        );
    END IF;
    
    -- Débiter le solde
    UPDATE users
    SET tokens_balance = tokens_balance - v_reactivation_cost
    WHERE id = p_user_id;
    
    -- ✅ CORRIGÉ 2026-01-XX: Réactiver le produit dans service_products (source de vérité)
    UPDATE service_products
    SET 
        is_active = TRUE,
        updated_at = NOW(),
        auto_deactivate_at = NOW() + INTERVAL '30 days',
        product_data = jsonb_set(
            COALESCE(product_data, '{}'::jsonb),
            '{reactivated_at}',
            to_jsonb(NOW()::text),
            true
        ) || jsonb_build_object('reactivation_type', 'paid', 'reactivation_cost', v_reactivation_cost)
    WHERE service_id = p_service_id
        AND product_index = p_product_index;
    
    -- Synchroniser products_lifecycle (métadonnées de cycle de vie)
    UPDATE products_lifecycle
    SET 
        is_active = TRUE,
        updated_at = NOW(),
        last_reactivated_at = NOW(),
        auto_deactivate_at = NOW() + INTERVAL '30 days',
        total_reactivation_paid = total_reactivation_paid + v_reactivation_cost
    WHERE service_id = p_service_id
        AND product_index = p_product_index;
    
    -- Logger l'action
    INSERT INTO service_logs (service_id, user_id, action, reason)
    VALUES (
        p_service_id,
        p_user_id,
        'product_reactivation',
        format('Produit "%s" réactivé pour %s FCFA', COALESCE(v_product.product_name, 'Produit'), v_reactivation_cost)
    );
    
    RETURN jsonb_build_object(
        'success', TRUE,
        'message', 'Produit réactivé avec succès',
        'cost', v_reactivation_cost,
        'next_deactivation', NOW() + INTERVAL '30 days',
        'new_balance', v_user_balance - v_reactivation_cost
    );
END;
$$ LANGUAGE plpgsql;

-- 6. Fonction pour réactiver plusieurs produits d'un coup
CREATE OR REPLACE FUNCTION reactivate_multiple_products(
    p_service_id INTEGER,
    p_product_indices INTEGER[],
    p_user_id INTEGER
) RETURNS JSONB AS $$
DECLARE
    v_reactivation_cost_per_product INTEGER := 1000;
    v_total_cost INTEGER;
    v_user_balance BIGINT;
    v_reactivated_count INTEGER := 0;
    v_product_idx INTEGER;
BEGIN
    -- Calculer le coût total
    v_total_cost := v_reactivation_cost_per_product * array_length(p_product_indices, 1);
    
    -- Vérifier le solde
    SELECT tokens_balance INTO v_user_balance
    FROM users
    WHERE id = p_user_id;
    
    IF v_user_balance < v_total_cost THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'Solde insuffisant',
            'required', v_total_cost,
            'balance', v_user_balance,
            'products_count', array_length(p_product_indices, 1),
            'cost_per_product', v_reactivation_cost_per_product
        );
    END IF;
    
    -- Débiter le solde
    UPDATE users
    SET tokens_balance = tokens_balance - v_total_cost
    WHERE id = p_user_id;
    
    -- ✅ CORRIGÉ 2026-01-XX: Réactiver tous les produits dans service_products (source de vérité)
    FOREACH v_product_idx IN ARRAY p_product_indices
    LOOP
        UPDATE service_products
        SET 
            is_active = TRUE,
            updated_at = NOW(),
            auto_deactivate_at = NOW() + INTERVAL '30 days',
            product_data = jsonb_set(
                COALESCE(product_data, '{}'::jsonb),
                '{reactivated_at}',
                to_jsonb(NOW()::text),
                true
            ) || jsonb_build_object('reactivation_type', 'paid', 'reactivation_cost', v_reactivation_cost_per_product)
        WHERE service_id = p_service_id
            AND product_index = v_product_idx
            AND is_active = FALSE;
        
        IF FOUND THEN
            v_reactivated_count := v_reactivated_count + 1;
        END IF;
        
        -- Synchroniser products_lifecycle (métadonnées de cycle de vie)
        UPDATE products_lifecycle
        SET 
            is_active = TRUE,
            updated_at = NOW(),
            last_reactivated_at = NOW(),
            auto_deactivate_at = NOW() + INTERVAL '30 days',
            total_reactivation_paid = total_reactivation_paid + v_reactivation_cost_per_product
        WHERE service_id = p_service_id
            AND product_index = v_product_idx;
    END LOOP;
    
    -- Logger l'action
    INSERT INTO service_logs (service_id, user_id, action, reason)
    VALUES (
        p_service_id,
        p_user_id,
        'multiple_products_reactivation',
        format('%s produits réactivés pour %s FCFA', v_reactivated_count, v_total_cost)
    );
    
    RETURN jsonb_build_object(
        'success', TRUE,
        'message', format('%s produit(s) réactivé(s) avec succès', v_reactivated_count),
        'reactivated_count', v_reactivated_count,
        'total_cost', v_total_cost,
        'cost_per_product', v_reactivation_cost_per_product,
        'next_deactivation', NOW() + INTERVAL '30 days',
        'new_balance', v_user_balance - v_total_cost
    );
END;
$$ LANGUAGE plpgsql;

-- 7. Vue pour faciliter l'accès aux produits désactivés
DROP VIEW IF EXISTS inactive_products_view;
CREATE OR REPLACE VIEW inactive_products_view AS
SELECT 
    pl.id,
    pl.service_id,
    pl.product_index,
    pl.product_nom,
    pl.product_type,
    pl.auto_deactivate_at,
    pl.last_reactivated_at,
    pl.reactivation_cost,
    pl.deactivation_count,
    s.user_id,
    s.data->'produits'->pl.product_index AS product_data,
    COALESCE(
        u.nom_complet,
        NULLIF(TRIM(CONCAT(u.prenom, ' ', u.nom)), ''),
        u.email
    ) AS user_name,
    u.email AS user_email,
    u.tokens_balance AS user_balance
FROM products_lifecycle pl
JOIN services s ON s.id = pl.service_id
JOIN users u ON u.id = s.user_id
WHERE pl.is_active = FALSE;

-- 8. Trigger pour synchroniser automatiquement les produits
CREATE OR REPLACE FUNCTION sync_product_on_service_update()
RETURNS TRIGGER AS $$
DECLARE
    product_record JSONB;
    product_idx INTEGER;
BEGIN
    -- Si le service a des produits, synchroniser
    IF jsonb_typeof(NEW.data->'produits') = 'array' THEN
        product_idx := 0;
        
        FOR product_record IN 
            SELECT * FROM jsonb_array_elements(NEW.data->'produits')
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
                COALESCE(product_record->>'nom', product_record->>'name', 'Produit'),
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
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_products ON services;
CREATE TRIGGER trigger_sync_products
    AFTER INSERT OR UPDATE ON services
    FOR EACH ROW
    WHEN (jsonb_typeof(NEW.data->'produits') = 'array')
    EXECUTE FUNCTION sync_product_on_service_update();

-- 9. Fonction pour obtenir les produits actifs/inactifs d'un service
CREATE OR REPLACE FUNCTION get_service_products_status(p_service_id INTEGER)
RETURNS TABLE(
    product_index INTEGER,
    product_nom TEXT,
    product_type TEXT,
    is_active BOOLEAN,
    days_until_deactivation INTEGER,
    auto_deactivate_at TIMESTAMPTZ,
    reactivation_cost INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        pl.product_index,
        pl.product_nom,
        pl.product_type,
        pl.is_active,
        CASE 
            WHEN pl.is_active AND pl.auto_deactivate_at IS NOT NULL THEN
                EXTRACT(DAY FROM (pl.auto_deactivate_at - NOW()))::INTEGER
            ELSE 0
        END AS days_until_deactivation,
        pl.auto_deactivate_at,
        pl.reactivation_cost
    FROM products_lifecycle pl
    WHERE pl.service_id = p_service_id
    ORDER BY pl.product_index;
END;
$$ LANGUAGE plpgsql;

-- 10. Désactiver la logique de désactivation automatique des SERVICES
-- On garde les colonnes pour compatibilité, mais on met à NULL les dates de désactivation auto
UPDATE services 
SET auto_deactivate_at = NULL
WHERE auto_deactivate_at IS NOT NULL;

-- Commentaire pour documenter le changement
COMMENT ON TABLE products_lifecycle IS 'Gestion du cycle de vie des produits : désactivation automatique après 30 jours, réactivation payante à 1000 FCFA';
COMMENT ON COLUMN products_lifecycle.auto_deactivate_at IS 'Date de désactivation automatique du produit (30 jours après création/réactivation)';
COMMENT ON COLUMN products_lifecycle.reactivation_cost IS 'Coût de réactivation du produit en FCFA (1000 par défaut)';
COMMENT ON COLUMN products_lifecycle.deactivation_count IS 'Nombre de fois que le produit a été désactivé automatiquement';
COMMENT ON COLUMN products_lifecycle.total_reactivation_paid IS 'Montant total payé pour les réactivations de ce produit';

-- 11. Synchroniser les produits existants
SELECT sync_products_to_lifecycle();

-- 12. Statistiques
SELECT 
    COUNT(*) as total_products,
    SUM(CASE WHEN is_active THEN 1 ELSE 0 END) as active_products,
    SUM(CASE WHEN NOT is_active THEN 1 ELSE 0 END) as inactive_products
FROM products_lifecycle;

