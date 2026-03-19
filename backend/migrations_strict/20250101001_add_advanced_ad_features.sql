-- Migration: Ajout des fonctionnalités avancées pour 100% parité avec les géants
-- Date: 2025-01-01
-- Description: Ajoute les colonnes JSON pour ciblage avancé, A/B testing, planification, placements, bid strategy, retargeting

-- ✅ Ajouter les colonnes JSON pour les nouvelles fonctionnalités
ALTER TABLE publicites
ADD COLUMN IF NOT EXISTS targeting JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS ab_testing JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS schedule JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS placements JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS bid_strategy JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS retargeting JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS variant_performance JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS frequency_config JSONB DEFAULT '{}';

-- ✅ Index GIN pour recherche dans les colonnes JSONB
CREATE INDEX IF NOT EXISTS idx_publicites_targeting_gin ON publicites USING GIN(targeting);
CREATE INDEX IF NOT EXISTS idx_publicites_ab_testing_gin ON publicites USING GIN(ab_testing);
CREATE INDEX IF NOT EXISTS idx_publicites_placements_gin ON publicites USING GIN(placements);
CREATE INDEX IF NOT EXISTS idx_publicites_retargeting_gin ON publicites USING GIN(retargeting);

-- ✅ Index pour planification (schedule)
CREATE INDEX IF NOT EXISTS idx_publicites_schedule_start ON publicites((schedule->>'start_date')) WHERE schedule IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_publicites_schedule_end ON publicites((schedule->>'end_date')) WHERE schedule IS NOT NULL;

-- ✅ Fonction pour vérifier si une publicité doit être active selon la planification
CREATE OR REPLACE FUNCTION is_publicite_scheduled_active(pub_id INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
    pub_schedule JSONB;
    start_date TIMESTAMPTZ;
    end_date TIMESTAMPTZ;
    pause_weekends BOOLEAN;
    current_day INTEGER;
BEGIN
    -- Récupérer le schedule
    SELECT schedule INTO pub_schedule
    FROM publicites
    WHERE id = pub_id;
    
    -- Si pas de schedule, la publicité est active selon date_debut/date_fin
    IF pub_schedule IS NULL OR pub_schedule = '{}'::jsonb THEN
        RETURN TRUE;
    END IF;
    
    -- Vérifier les dates de début/fin
    IF pub_schedule->>'start_date' IS NOT NULL THEN
        start_date := (pub_schedule->>'start_date')::timestamptz;
        IF NOW() < start_date THEN
            RETURN FALSE;
        END IF;
    END IF;
    
    IF pub_schedule->>'end_date' IS NOT NULL THEN
        end_date := (pub_schedule->>'end_date')::timestamptz;
        IF NOW() > end_date THEN
            RETURN FALSE;
        END IF;
    END IF;
    
    -- Vérifier pause weekends
    pause_weekends := COALESCE((pub_schedule->>'pause_on_weekends')::boolean, FALSE);
    IF pause_weekends THEN
        current_day := EXTRACT(DOW FROM NOW())::integer;
        -- 0 = dimanche, 6 = samedi
        IF current_day = 0 OR current_day = 6 THEN
            RETURN FALSE;
        END IF;
    END IF;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- ✅ Fonction pour filtrer par ciblage avancé
CREATE OR REPLACE FUNCTION matches_targeting(pub_targeting JSONB, user_age INTEGER, user_gender TEXT, user_interests TEXT[], user_behaviors TEXT[])
RETURNS BOOLEAN AS $$
DECLARE
    target_age_min INTEGER;
    target_age_max INTEGER;
    target_gender TEXT;
    target_interests JSONB;
    target_behaviors JSONB;
BEGIN
    -- Si pas de ciblage, accepter tout
    IF pub_targeting IS NULL OR pub_targeting = '{}'::jsonb THEN
        RETURN TRUE;
    END IF;
    
    -- Vérifier l'âge
    IF pub_targeting->'age_range' IS NOT NULL THEN
        target_age_min := COALESCE((pub_targeting->'age_range'->>'min')::integer, 0);
        target_age_max := COALESCE((pub_targeting->'age_range'->>'max')::integer, 999);
        IF user_age < target_age_min OR user_age > target_age_max THEN
            RETURN FALSE;
        END IF;
    END IF;
    
    -- Vérifier le genre
    target_gender := pub_targeting->>'gender';
    IF target_gender IS NOT NULL AND target_gender != 'all' THEN
        IF target_gender != user_gender THEN
            RETURN FALSE;
        END IF;
    END IF;
    
    -- Vérifier les intérêts (au moins un match)
    target_interests := pub_targeting->'interests';
    IF target_interests IS NOT NULL AND jsonb_array_length(target_interests) > 0 THEN
        IF NOT EXISTS (
            SELECT 1 FROM jsonb_array_elements_text(target_interests) AS interest
            WHERE interest = ANY(user_interests)
        ) THEN
            RETURN FALSE;
        END IF;
    END IF;
    
    -- Vérifier les comportements (au moins un match)
    target_behaviors := pub_targeting->'behaviors';
    IF target_behaviors IS NOT NULL AND jsonb_array_length(target_behaviors) > 0 THEN
        IF NOT EXISTS (
            SELECT 1 FROM jsonb_array_elements_text(target_behaviors) AS behavior
            WHERE behavior = ANY(user_behaviors)
        ) THEN
            RETURN FALSE;
        END IF;
    END IF;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- ✅ Fonction pour vérifier le retargeting
CREATE OR REPLACE FUNCTION matches_retargeting(pub_retargeting JSONB, user_id INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
    retargeting_rules JSONB;
    rule JSONB;
    rule_type TEXT;
    days_since INTEGER;
    match_found BOOLEAN := FALSE;
BEGIN
    -- Si pas de retargeting, accepter
    IF pub_retargeting IS NULL OR pub_retargeting = '{}'::jsonb THEN
        RETURN TRUE;
    END IF;
    
    retargeting_rules := pub_retargeting->'rules';
    IF retargeting_rules IS NULL OR jsonb_array_length(retargeting_rules) = 0 THEN
        RETURN TRUE;
    END IF;
    
    -- Vérifier chaque règle
    FOR rule IN SELECT * FROM jsonb_array_elements(retargeting_rules)
    LOOP
        rule_type := rule->>'type';
        days_since := COALESCE((rule->>'days_since')::integer, 7);
        
        CASE rule_type
            WHEN 'viewed_product' THEN
                -- Vérifier si l'utilisateur a vu un produit dans les X derniers jours
                SELECT EXISTS (
                    SELECT 1 FROM user_behavior
                    WHERE user_id = user_id
                    AND behavior_type = 'product_view'
                    AND created_at > NOW() - (days_since || ' days')::interval
                ) INTO match_found;
                
            WHEN 'abandoned_cart' THEN
                -- Vérifier si l'utilisateur a abandonné un panier
                SELECT EXISTS (
                    SELECT 1 FROM shopping_baskets
                    WHERE user_id = user_id
                    AND status = 'abandoned'
                    AND updated_at > NOW() - (days_since || ' days')::interval
                ) INTO match_found;
                
            WHEN 'visited_service' THEN
                -- Vérifier si l'utilisateur a visité un service
                SELECT EXISTS (
                    SELECT 1 FROM user_behavior
                    WHERE user_id = user_id
                    AND behavior_type = 'service_view'
                    AND created_at > NOW() - (days_since || ' days')::interval
                ) INTO match_found;
                
            WHEN 'searched' THEN
                -- Vérifier si l'utilisateur a recherché des mots-clés liés
                SELECT EXISTS (
                    SELECT 1 FROM search_history
                    WHERE user_id = user_id
                    AND created_at > NOW() - (days_since || ' days')::interval
                ) INTO match_found;
                
            ELSE
                match_found := FALSE;
        END CASE;
        
        -- Si une règle match, retourner TRUE
        IF match_found THEN
            RETURN TRUE;
        END IF;
    END LOOP;
    
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- ✅ Commentaires pour documentation
COMMENT ON COLUMN publicites.targeting IS 'Ciblage avancé: âge, genre, intérêts, comportements';
COMMENT ON COLUMN publicites.ab_testing IS 'A/B Testing: variantes de la publicité';
COMMENT ON COLUMN publicites.schedule IS 'Planification: dates/heures de début/fin, pauses';
COMMENT ON COLUMN publicites.placements IS 'Placements: où afficher (feed, stories, etc.)';
COMMENT ON COLUMN publicites.bid_strategy IS 'Stratégie d''enchères: CPC, CPM, CPA, auto';
COMMENT ON COLUMN publicites.retargeting IS 'Retargeting: règles pour cibler les utilisateurs précédents';
COMMENT ON COLUMN publicites.variant_performance IS 'Performances des variantes A/B pour optimisation';

