-- Fonctions SQL principales pour le système

-- ========================================
-- FONCTIONS ET TRIGGERS SQL
-- ========================================

-- Fonction : Désactiver les produits expirés automatiquement
-- ✅ MODIFIÉ 2025-01-28: Inclut vérification stock = 0 (uniquement pour les produits)
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
    UPDATE products_lifecycle pl
    SET 
        is_active = FALSE,
        updated_at = NOW(),
        deactivation_count = deactivation_count + 1
    FROM services s
    WHERE pl.service_id = s.id
        AND pl.is_active = TRUE
        AND (
            -- Critère 1: Délai expiré (existant)
            pl.auto_deactivate_at <= NOW()
            OR
            -- ✅ NOUVEAU Critère 2: Stock = 0 (uniquement pour les produits)
            (
                s.is_tarissable = TRUE  -- Uniquement pour les produits
                AND EXISTS (
                    SELECT 1 
                    FROM autocomplete_combinations ac
                    WHERE ac.service_id = s.id
                        AND ac.stock IS NOT NULL
                        AND ac.stock <= 0
                )
            )
        )
    RETURNING 
        pl.service_id,
        pl.product_index,
        pl.product_nom,
        s.user_id,
        CASE 
            WHEN pl.auto_deactivate_at <= NOW() THEN 'expired_time'
            ELSE 'stock_zero'
        END;
END;
$$ LANGUAGE plpgsql;

-- Fonction : Mettre à jour updated_at pour publicites
CREATE OR REPLACE FUNCTION update_publicites_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger : Appliquer update_publicites_updated_at
DROP TRIGGER IF EXISTS trigger_update_publicites_updated_at ON publicites;
CREATE TRIGGER trigger_update_publicites_updated_at
    BEFORE UPDATE ON publicites
    FOR EACH ROW
    EXECUTE FUNCTION update_publicites_updated_at();

-- Fonction : Calculer automatiquement date_fin pour publicites
CREATE OR REPLACE FUNCTION set_publicite_date_fin()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.date_fin IS NULL OR NEW.date_fin = NEW.date_debut THEN
        NEW.date_fin = NEW.date_debut + (NEW.duree_jours || ' days')::interval;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger : Appliquer set_publicite_date_fin
DROP TRIGGER IF EXISTS trigger_set_publicite_date_fin ON publicites;
CREATE TRIGGER trigger_set_publicite_date_fin
    BEFORE INSERT OR UPDATE ON publicites
    FOR EACH ROW
    EXECUTE FUNCTION set_publicite_date_fin();

-- Fonction : Désactiver les publicités expirées
CREATE OR REPLACE FUNCTION deactivate_expired_publicites()
RETURNS INTEGER AS $$
DECLARE
    affected_count INTEGER;
BEGIN
    UPDATE publicites
    SET status = 'expired'
    WHERE status = 'active'
    AND date_fin < NOW();
    
    GET DIAGNOSTICS affected_count = ROW_COUNT;
    RETURN affected_count;
END;
$$ LANGUAGE plpgsql;

-- ✅ NOUVEAU: Fonction pour vérifier si une publicité doit être active selon la planification
CREATE OR REPLACE FUNCTION is_publicite_scheduled_active(pub_id INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
    pub_schedule JSONB;
    start_date TIMESTAMPTZ;
    end_date TIMESTAMPTZ;
    pause_weekends BOOLEAN;
    current_day INTEGER;
BEGIN
    SELECT schedule INTO pub_schedule FROM publicites WHERE id = pub_id;
    IF pub_schedule IS NULL OR pub_schedule = '{}'::jsonb THEN
        RETURN TRUE;
    END IF;
    IF pub_schedule->>'start_date' IS NOT NULL THEN
        start_date := (pub_schedule->>'start_date')::timestamptz;
        IF NOW() < start_date THEN RETURN FALSE; END IF;
    END IF;
    IF pub_schedule->>'end_date' IS NOT NULL THEN
        end_date := (pub_schedule->>'end_date')::timestamptz;
        IF NOW() > end_date THEN RETURN FALSE; END IF;
    END IF;
    pause_weekends := COALESCE((pub_schedule->>'pause_on_weekends')::boolean, FALSE);
    IF pause_weekends THEN
        current_day := EXTRACT(DOW FROM NOW())::integer;
        IF current_day = 0 OR current_day = 6 THEN RETURN FALSE; END IF;
    END IF;
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- ✅ NOUVEAU: Fonction pour filtrer par ciblage avancé
CREATE OR REPLACE FUNCTION matches_targeting(pub_targeting JSONB, user_age INTEGER, user_gender TEXT, user_interests TEXT[], user_behaviors TEXT[])
RETURNS BOOLEAN AS $$
DECLARE
    target_age_min INTEGER;
    target_age_max INTEGER;
    target_gender TEXT;
    target_interests JSONB;
    target_behaviors JSONB;
BEGIN
    IF pub_targeting IS NULL OR pub_targeting = '{}'::jsonb THEN RETURN TRUE; END IF;
    IF pub_targeting->'age_range' IS NOT NULL THEN
        target_age_min := COALESCE((pub_targeting->'age_range'->>'min')::integer, 0);
        target_age_max := COALESCE((pub_targeting->'age_range'->>'max')::integer, 999);
        IF user_age < target_age_min OR user_age > target_age_max THEN RETURN FALSE; END IF;
    END IF;
    target_gender := pub_targeting->>'gender';
    IF target_gender IS NOT NULL AND target_gender != 'all' THEN
        IF target_gender != user_gender THEN RETURN FALSE; END IF;
    END IF;
    target_interests := pub_targeting->'interests';
    IF target_interests IS NOT NULL AND jsonb_array_length(target_interests) > 0 THEN
        IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements_text(target_interests) AS interest WHERE interest = ANY(user_interests)) THEN
            RETURN FALSE;
        END IF;
    END IF;
    target_behaviors := pub_targeting->'behaviors';
    IF target_behaviors IS NOT NULL AND jsonb_array_length(target_behaviors) > 0 THEN
        IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements_text(target_behaviors) AS behavior WHERE behavior = ANY(user_behaviors)) THEN
            RETURN FALSE;
        END IF;
    END IF;
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- ✅ NOUVEAU: Fonction pour vérifier le retargeting
CREATE OR REPLACE FUNCTION matches_retargeting(pub_retargeting JSONB, user_id INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
    retargeting_rules JSONB;
    rule JSONB;
    rule_type TEXT;
    days_since INTEGER;
    match_found BOOLEAN := FALSE;
BEGIN
    IF pub_retargeting IS NULL OR pub_retargeting = '{}'::jsonb THEN RETURN TRUE; END IF;
    retargeting_rules := pub_retargeting->'rules';
    IF retargeting_rules IS NULL OR jsonb_array_length(retargeting_rules) = 0 THEN RETURN TRUE; END IF;
    FOR rule IN SELECT * FROM jsonb_array_elements(retargeting_rules) LOOP
        rule_type := rule->>'type';
        days_since := COALESCE((rule->>'days_since')::integer, 7);
        CASE rule_type
            WHEN 'viewed_product' THEN
                SELECT EXISTS (SELECT 1 FROM user_behavior WHERE user_id = user_id AND behavior_type = 'product_view' AND created_at > NOW() - (days_since || ' days')::interval) INTO match_found;
            WHEN 'abandoned_cart' THEN
                SELECT EXISTS (SELECT 1 FROM shopping_baskets WHERE user_id = user_id AND status = 'abandoned' AND updated_at > NOW() - (days_since || ' days')::interval) INTO match_found;
            WHEN 'visited_service' THEN
                SELECT EXISTS (SELECT 1 FROM user_behavior WHERE user_id = user_id AND behavior_type = 'service_view' AND created_at > NOW() - (days_since || ' days')::interval) INTO match_found;
            WHEN 'searched' THEN
                SELECT EXISTS (SELECT 1 FROM search_history WHERE user_id = user_id AND created_at > NOW() - (days_since || ' days')::interval) INTO match_found;
            ELSE match_found := FALSE;
        END CASE;
        IF match_found THEN RETURN TRUE; END IF;
    END LOOP;
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- ✅ NOUVEAU 2026-01-02: Optimisation critique add_product_to_service_jsonb_v2
-- Problème: FOR UPDATE verrouille la ligne pendant toute la transaction, causant des timeouts
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
    DECLARE
        v_new_produits_valeur JSONB;
        v_new_data JSONB;
    BEGIN
        -- Construire le nouveau tableau produits.valeur
        IF v_current_data->'produits'->'valeur' IS NOT NULL THEN
            v_new_produits_valeur := (v_current_data->'produits'->'valeur') || jsonb_build_array(p_product_json);
        ELSE
            v_new_produits_valeur := jsonb_build_array(p_product_json);
        END IF;
        
        -- Construire le nouveau data JSONB
        IF v_current_data->'produits' IS NOT NULL THEN
            v_new_data := jsonb_set(
                v_current_data,
                '{produits,valeur}',
                v_new_produits_valeur,
                true
            );
        ELSE
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

COMMENT ON FUNCTION add_product_to_service_jsonb_v2 IS 'Fonction optimisée qui évite les verrous longs. Lit les données AVANT le verrou, construit le nouveau JSONB en mémoire, puis fait un UPDATE atomique rapide.';



