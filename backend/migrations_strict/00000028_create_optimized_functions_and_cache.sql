-- Fonctions optimisées et système de cache

-- ============================================================================
-- ✅ NOUVEAU 2026-01-02: Optimisation critique add_product_to_service_jsonb_v2
-- ============================================================================
-- Problème: FOR UPDATE verrouille la ligne pendant toute la transaction, causant des timeouts
--           même sans médias si le service a déjà beaucoup de produits (JSONB volumineux)
-- Solution: Lire les données AVANT le verrou, construire le JSONB en mémoire, puis UPDATE atomique

CREATE OR REPLACE FUNCTION add_product_to_service_jsonb_v2(
    p_service_id INTEGER,
    p_product_json JSONB
) RETURNS TABLE(
    product_index INTEGER,
    produits_data JSONB,
    lieu_data JSONB
) AS $$
DECLARE
    v_product_index INTEGER;
    v_produits_data JSONB;
    v_lieu_data JSONB;
    v_current_data JSONB;
BEGIN
    -- ✅ OPTIMISÉ: Lire les données AVANT le verrou (lecture rapide)
    -- Cela permet de calculer l'index sans verrouiller la ligne
    SELECT 
        COALESCE(jsonb_array_length(data->'produits'->'valeur'), 0),
        data
    INTO v_product_index, v_current_data
    FROM services
    WHERE id = p_service_id AND is_active = true;
    
    -- Si le service n'existe pas, retourner vide
    IF v_product_index IS NULL OR v_current_data IS NULL THEN
        RETURN;
    END IF;
    
    -- ✅ OPTIMISÉ: Calculer le nouveau JSONB en mémoire (plus rapide que jsonb_set)
    -- Construire directement le nouveau tableau produits.valeur
    DECLARE
        v_new_produits_valeur JSONB;
        v_new_data JSONB;
    BEGIN
        -- Construire le nouveau tableau produits.valeur
        IF v_current_data->'produits'->'valeur' IS NOT NULL THEN
            -- Ajouter au tableau existant
            v_new_produits_valeur := (v_current_data->'produits'->'valeur') || jsonb_build_array(p_product_json);
        ELSE
            -- Créer un nouveau tableau
            v_new_produits_valeur := jsonb_build_array(p_product_json);
        END IF;
        
        -- Construire le nouveau data JSONB
        IF v_current_data->'produits' IS NOT NULL THEN
            -- Mettre à jour seulement produits.valeur
            v_new_data := jsonb_set(
                v_current_data,
                '{produits,valeur}',
                v_new_produits_valeur,
                true
            );
        ELSE
            -- Créer toute la structure produits
            v_new_data := v_current_data || jsonb_build_object(
                'produits',
                jsonb_build_object(
                    'type_donnee', 'autocomplete',
                    'valeur', v_new_produits_valeur,
                    'separateur', ',',
                    'sous_caracteristiques', '{}'::jsonb,
                    'filtrable', true,
                    'origine_champs', 'formulaire'
                )
            );
        END IF;
        
        -- ✅ OPTIMISÉ: UPDATE atomique sans verrou long
        -- On construit le JSONB en mémoire avant l'UPDATE, ce qui est plus rapide
        -- et évite de verrouiller la ligne pendant le calcul
        UPDATE services
        SET 
            data = v_new_data,
            updated_at = NOW()
        WHERE id = p_service_id
        AND is_active = true
        RETURNING 
            data->'produits' as produits_data,
            data->'lieu_produit' as lieu_data
        INTO v_produits_data, v_lieu_data;
        
        -- Si aucun service n'a été mis à jour (non trouvé ou inactif)
        IF NOT FOUND THEN
            RETURN;
        END IF;
    END;
    
    -- Retourner les résultats
    product_index := v_product_index;
    produits_data := v_produits_data;
    lieu_data := v_lieu_data;
    
    RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION add_product_to_service_jsonb_v2 IS 'Fonction optimisée qui évite les verrous longs. Lit les données AVANT le verrou, construit le nouveau JSONB en mémoire, puis fait un UPDATE atomique rapide. Réduit significativement le temps d''exécution même pour les services avec beaucoup de produits.';

-- Index pour garantir que les UPDATE sont rapides
-- ✅ NOTE: Ces index sont également dans 00000011 mais conservés ici car liés à la fonction optimisée
CREATE INDEX IF NOT EXISTS idx_services_id_for_updates 
    ON services(id) 
    WHERE is_active = true;

-- Index GIN sur data->'produits'->'valeur' pour accès rapide à la longueur
CREATE INDEX IF NOT EXISTS idx_services_produits_valeur_gin 
    ON services USING GIN ((data->'produits'->'valeur'))
    WHERE data->'produits'->'valeur' IS NOT NULL;

-- ✅ NOUVEAU: Index partiel pour les services avec beaucoup de produits
-- Cela aide PostgreSQL à choisir un plan d'exécution optimal
CREATE INDEX IF NOT EXISTS idx_services_data_produits_partial
    ON services USING GIN (data)
    WHERE is_active = true 
    AND data->'produits'->'valeur' IS NOT NULL
    AND jsonb_array_length(data->'produits'->'valeur') > 0;

-- ✅ NOUVEAU 2026-01-02: Queue asynchrone pour création de produits
-- SOLUTION DÉFINITIVE: Évite les timeouts et les erreurs TLS
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

-- ✅ NOUVEAU 2026-01-02: Table de cache PostgreSQL pour remplacer Redis
-- SOLUTION DÉFINITIVE: Cache basé sur PostgreSQL, plus fiable que Redis
CREATE TABLE IF NOT EXISTS cache_table (
    cache_key VARCHAR(255) PRIMARY KEY,
    cache_value JSONB NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    access_count INTEGER NOT NULL DEFAULT 0,
    last_accessed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- ✅ CORRECTION 2026-01-30: NOW() n'est pas IMMUTABLE, on ne peut pas l'utiliser dans un index partiel
-- L'index est créé sans prédicat (la migration 20260130_003 corrigera cela)
CREATE INDEX IF NOT EXISTS idx_cache_expires_at 
    ON cache_table(expires_at);

CREATE INDEX IF NOT EXISTS idx_cache_key_pattern 
    ON cache_table(cache_key text_pattern_ops);

-- ✅ CORRECTION 2026-01-30: DROP avant CREATE pour éviter l'erreur de changement de type de retour
DROP FUNCTION IF EXISTS cleanup_expired_cache() CASCADE;
CREATE FUNCTION cleanup_expired_cache()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM cache_table
    WHERE expires_at < NOW();
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_cache(key VARCHAR(255))
RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT cache_value INTO result
    FROM cache_table
    WHERE cache_key = key
      AND expires_at > NOW();
    
    IF result IS NOT NULL THEN
        UPDATE cache_table
        SET access_count = access_count + 1,
            last_accessed_at = NOW()
        WHERE cache_key = key;
    END IF;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION set_cache(
    key VARCHAR(255),
    value JSONB,
    ttl_seconds INTEGER DEFAULT 3600
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO cache_table (cache_key, cache_value, expires_at, updated_at)
    VALUES (key, value, NOW() + CAST((ttl_seconds || ' seconds') AS INTERVAL), NOW())
    ON CONFLICT (cache_key) 
    DO UPDATE SET
        cache_value = EXCLUDED.cache_value,
        expires_at = EXCLUDED.expires_at,
        updated_at = EXCLUDED.updated_at,
        access_count = 0;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION delete_cache(key VARCHAR(255))
RETURNS BOOLEAN AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM cache_table
    WHERE cache_key = key;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count > 0;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION delete_cache_pattern(pattern VARCHAR(255))
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM cache_table
    WHERE cache_key LIKE pattern;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE cache_table IS 'Table de cache PostgreSQL pour remplacer Redis. Plus fiable et intégré à la base de données.';
COMMENT ON FUNCTION get_cache IS 'Récupère une valeur du cache si elle n''est pas expirée.';
COMMENT ON FUNCTION set_cache IS 'Met une valeur en cache avec un TTL en secondes.';
COMMENT ON FUNCTION delete_cache IS 'Supprime une clé du cache.';
COMMENT ON FUNCTION delete_cache_pattern IS 'Supprime les clés du cache correspondant à un pattern.';

