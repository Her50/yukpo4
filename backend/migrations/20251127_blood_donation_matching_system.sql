-- Migration: Système Intelligent de Matching Banque de Sang
-- Date: 2025-11-27
-- Description: Tables et fonctions pour matching intelligent donneurs/demandes avec GPS temps réel
-- Note: Compatible SQLx offline mode

-- ============================================================================
-- 1. TABLE : Groupes sanguins des utilisateurs
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_blood_groups (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    groupe_sanguin VARCHAR(5) NOT NULL CHECK (groupe_sanguin IN ('O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-')),
    is_available_for_donation BOOLEAN NOT NULL DEFAULT TRUE,
    last_donation_date DATE,
    next_donation_available_date DATE, -- Calculé: last_donation_date + 8 semaines
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_user_blood_group UNIQUE (user_id, groupe_sanguin)
);

CREATE INDEX IF NOT EXISTS idx_user_blood_groups_user ON user_blood_groups(user_id);
CREATE INDEX IF NOT EXISTS idx_user_blood_groups_groupe ON user_blood_groups(groupe_sanguin);
CREATE INDEX IF NOT EXISTS idx_user_blood_groups_available ON user_blood_groups(is_available_for_donation) WHERE is_available_for_donation = TRUE;
CREATE INDEX IF NOT EXISTS idx_user_blood_groups_next_donation ON user_blood_groups(next_donation_available_date) WHERE next_donation_available_date IS NOT NULL;

-- ============================================================================
-- 2. TABLE : Demandes de don de sang
-- ============================================================================
CREATE TABLE IF NOT EXISTS blood_donation_requests (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    banque_sang_id INTEGER NOT NULL REFERENCES banques_sang(id) ON DELETE CASCADE,
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    requested_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    
    -- Groupe sanguin demandé
    groupe_sanguin_requis VARCHAR(5) NOT NULL CHECK (groupe_sanguin_requis IN ('O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-')),
    quantite_requise INTEGER NOT NULL DEFAULT 1, -- Nombre de poches
    unite VARCHAR(20) DEFAULT 'poches',
    
    -- Urgence
    is_urgent BOOLEAN NOT NULL DEFAULT FALSE,
    urgence_level VARCHAR(20) DEFAULT 'normal' CHECK (urgence_level IN ('normal', 'urgent', 'critique')),
    deadline_date DATE, -- Date limite si urgente
    
    -- Position GPS au moment de la demande (CRITIQUE: pas stockée, capturée au moment de la demande)
    request_latitude DOUBLE PRECISION,
    request_longitude DOUBLE PRECISION,
    request_location_address TEXT, -- Adresse géocodée
    
    -- Statut
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'fulfilled', 'cancelled', 'expired')),
    fulfilled_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    cancelled_reason TEXT,
    
    -- Notes
    notes TEXT,
    patient_name TEXT, -- Nom du patient si connu
    hospital_name TEXT, -- Nom de l'hôpital si applicable
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_blood_donation_requests_banque ON blood_donation_requests(banque_sang_id);
CREATE INDEX IF NOT EXISTS idx_blood_donation_requests_groupe ON blood_donation_requests(groupe_sanguin_requis);
CREATE INDEX IF NOT EXISTS idx_blood_donation_requests_status ON blood_donation_requests(status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_blood_donation_requests_urgent ON blood_donation_requests(is_urgent) WHERE is_urgent = TRUE;
CREATE INDEX IF NOT EXISTS idx_blood_donation_requests_created ON blood_donation_requests(created_at DESC);

-- Index pour recherche géographique (si extension PostGIS disponible)
-- CREATE INDEX IF NOT EXISTS idx_blood_donation_requests_gps ON blood_donation_requests USING GIST(ST_Point(request_longitude, request_latitude));

-- ============================================================================
-- 3. TABLE : Matches donneurs/demandes
-- ============================================================================
CREATE TABLE IF NOT EXISTS blood_donation_matches (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    request_id TEXT NOT NULL REFERENCES blood_donation_requests(id) ON DELETE CASCADE,
    donor_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    donor_blood_group_id INTEGER NOT NULL REFERENCES user_blood_groups(id) ON DELETE CASCADE,
    
    -- Position GPS du donneur au moment du match (CRITIQUE: temps réel)
    donor_latitude DOUBLE PRECISION,
    donor_longitude DOUBLE PRECISION,
    distance_km DOUBLE PRECISION, -- Distance calculée entre demande et donneur
    
    -- Statut du match
    match_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (match_status IN ('pending', 'notified', 'accepted', 'declined', 'completed', 'expired')),
    notified_at TIMESTAMPTZ,
    notification_sent BOOLEAN NOT NULL DEFAULT FALSE,
    accepted_at TIMESTAMPTZ,
    declined_at TIMESTAMPTZ,
    declined_reason TEXT,
    completed_at TIMESTAMPTZ,
    
    -- Score de pertinence (pour tri)
    relevance_score DOUBLE PRECISION DEFAULT 0.0, -- Basé sur distance, disponibilité, historique
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_request_donor_match UNIQUE (request_id, donor_user_id)
);

CREATE INDEX IF NOT EXISTS idx_blood_donation_matches_request ON blood_donation_matches(request_id);
CREATE INDEX IF NOT EXISTS idx_blood_donation_matches_donor ON blood_donation_matches(donor_user_id);
CREATE INDEX IF NOT EXISTS idx_blood_donation_matches_status ON blood_donation_matches(match_status) WHERE match_status IN ('pending', 'notified', 'accepted');
CREATE INDEX IF NOT EXISTS idx_blood_donation_matches_relevance ON blood_donation_matches(relevance_score DESC);
CREATE INDEX IF NOT EXISTS idx_blood_donation_matches_distance ON blood_donation_matches(distance_km) WHERE distance_km IS NOT NULL;

-- ============================================================================
-- 4. FONCTION : Trouver donneurs potentiels pour une demande
-- ============================================================================
CREATE OR REPLACE FUNCTION find_potential_blood_donors(
    p_request_id TEXT,
    p_groupe_sanguin_requis VARCHAR(5),
    p_request_lat DOUBLE PRECISION,
    p_request_lng DOUBLE PRECISION,
    p_max_distance_km DOUBLE PRECISION DEFAULT 50.0,
    p_max_results INTEGER DEFAULT 20
)
RETURNS JSONB AS $$
DECLARE
    v_compatible_groups VARCHAR(5)[];
    v_donor RECORD;
    v_distance_km DOUBLE PRECISION;
    v_relevance_score DOUBLE PRECISION;
    v_results JSONB := '[]'::jsonb;
    v_count INTEGER := 0;
BEGIN
    -- Déterminer les groupes sanguins compatibles
    -- Règles de compatibilité :
    -- O- peut donner à tous
    -- O+ peut donner à O+, A+, B+, AB+
    -- A- peut donner à A-, A+, AB-, AB+
    -- A+ peut donner à A+, AB+
    -- B- peut donner à B-, B+, AB-, AB+
    -- B+ peut donner à B+, AB+
    -- AB- peut donner à AB-, AB+
    -- AB+ peut donner à AB+ uniquement
    
    v_compatible_groups := CASE p_groupe_sanguin_requis
        WHEN 'O-' THEN ARRAY['O-']::VARCHAR(5)[]
        WHEN 'O+' THEN ARRAY['O-', 'O+']::VARCHAR(5)[]
        WHEN 'A-' THEN ARRAY['O-', 'A-']::VARCHAR(5)[]
        WHEN 'A+' THEN ARRAY['O-', 'O+', 'A-', 'A+']::VARCHAR(5)[]
        WHEN 'B-' THEN ARRAY['O-', 'B-']::VARCHAR(5)[]
        WHEN 'B+' THEN ARRAY['O-', 'O+', 'B-', 'B+']::VARCHAR(5)[]
        WHEN 'AB-' THEN ARRAY['O-', 'A-', 'B-', 'AB-']::VARCHAR(5)[]
        WHEN 'AB+' THEN ARRAY['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+']::VARCHAR(5)[]
        ELSE ARRAY[]::VARCHAR(5)[]
    END;
    
    -- Trouver les donneurs compatibles disponibles
    FOR v_donor IN
        SELECT 
            ubg.id as blood_group_id,
            ubg.user_id,
            ubg.groupe_sanguin,
            ubg.is_available_for_donation,
            ubg.next_donation_available_date,
            u.gps,
            u.nom_complet,
            u.telephone,
            u.whatsapp,
            -- Extraire latitude/longitude du GPS si disponible
            CASE 
                WHEN u.gps IS NOT NULL AND u.gps LIKE '%,%' THEN
                    SPLIT_PART(u.gps, ',', 1)::DOUBLE PRECISION
                ELSE NULL
            END as donor_lat,
            CASE 
                WHEN u.gps IS NOT NULL AND u.gps LIKE '%,%' THEN
                    SPLIT_PART(u.gps, ',', 2)::DOUBLE PRECISION
                ELSE NULL
            END as donor_lng
        FROM user_blood_groups ubg
        JOIN users u ON u.id = ubg.user_id
        WHERE ubg.groupe_sanguin = ANY(v_compatible_groups)
            AND ubg.is_available_for_donation = TRUE
            AND (ubg.next_donation_available_date IS NULL OR ubg.next_donation_available_date <= CURRENT_DATE)
            AND u.is_active = TRUE
            -- Exclure les utilisateurs déjà matchés pour cette demande
            AND NOT EXISTS (
                SELECT 1 FROM blood_donation_matches bdm
                WHERE bdm.request_id = p_request_id
                    AND bdm.donor_user_id = ubg.user_id
                    AND bdm.match_status IN ('pending', 'notified', 'accepted')
            )
        ORDER BY 
            -- Prioriser donneurs disponibles immédiatement
            CASE WHEN ubg.next_donation_available_date IS NULL OR ubg.next_donation_available_date <= CURRENT_DATE THEN 0 ELSE 1 END,
            -- Prioriser groupes exacts (même groupe)
            CASE WHEN ubg.groupe_sanguin = p_groupe_sanguin_requis THEN 0 ELSE 1 END
        LIMIT p_max_results
    LOOP
        -- Calculer distance si GPS disponible
        v_distance_km := NULL;
        IF p_request_lat IS NOT NULL AND p_request_lng IS NOT NULL 
           AND v_donor.donor_lat IS NOT NULL AND v_donor.donor_lng IS NOT NULL THEN
            -- Formule Haversine simplifiée (approximation)
            v_distance_km := (
                6371.0 * acos(
                    LEAST(1.0, 
                        sin(radians(p_request_lat)) * sin(radians(v_donor.donor_lat)) +
                        cos(radians(p_request_lat)) * cos(radians(v_donor.donor_lat)) *
                        cos(radians(p_request_lng - v_donor.donor_lng))
                    )
                )
            );
        END IF;
        
        -- Filtrer par distance maximale
        IF v_distance_km IS NULL OR v_distance_km <= p_max_distance_km THEN
            -- Calculer score de pertinence
            v_relevance_score := 100.0;
            
            -- Réduire score si distance élevée
            IF v_distance_km IS NOT NULL THEN
                v_relevance_score := v_relevance_score - (v_distance_km * 0.5);
            END IF;
            
            -- Bonus si groupe exact
            IF v_donor.groupe_sanguin = p_groupe_sanguin_requis THEN
                v_relevance_score := v_relevance_score + 20.0;
            END IF;
            
            -- Bonus si disponible immédiatement
            IF v_donor.next_donation_available_date IS NULL OR v_donor.next_donation_available_date <= CURRENT_DATE THEN
                v_relevance_score := v_relevance_score + 10.0;
            END IF;
            
            -- Ajouter au résultat
            v_results := v_results || jsonb_build_object(
                'blood_group_id', v_donor.blood_group_id,
                'user_id', v_donor.user_id,
                'groupe_sanguin', v_donor.groupe_sanguin,
                'nom_complet', v_donor.nom_complet,
                'telephone', v_donor.telephone,
                'whatsapp', v_donor.whatsapp,
                'donor_latitude', v_donor.donor_lat,
                'donor_longitude', v_donor.donor_lng,
                'distance_km', v_distance_km,
                'relevance_score', v_relevance_score,
                'is_available_now', (v_donor.next_donation_available_date IS NULL OR v_donor.next_donation_available_date <= CURRENT_DATE)
            );
            
            v_count := v_count + 1;
        END IF;
    END LOOP;
    
    RETURN jsonb_build_object(
        'success', TRUE,
        'count', v_count,
        'donors', v_results,
        'compatible_groups', v_compatible_groups
    );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION find_potential_blood_donors IS 'Trouve les donneurs potentiels pour une demande de sang avec matching GPS et compatibilité groupes sanguins';

-- ============================================================================
-- 5. FONCTION : Créer une demande de don et trouver les matches
-- ============================================================================
CREATE OR REPLACE FUNCTION create_blood_donation_request(
    p_banque_sang_id INTEGER,
    p_service_id INTEGER,
    p_requested_by_user_id INTEGER,
    p_groupe_sanguin_requis VARCHAR(5),
    p_quantite_requise INTEGER DEFAULT 1,
    p_unite VARCHAR(20) DEFAULT 'poches',
    p_is_urgent BOOLEAN DEFAULT FALSE,
    p_urgence_level VARCHAR(20) DEFAULT 'normal',
    p_deadline_date DATE DEFAULT NULL,
    p_request_lat DOUBLE PRECISION DEFAULT NULL,
    p_request_lng DOUBLE PRECISION DEFAULT NULL,
    p_request_location_address TEXT DEFAULT NULL,
    p_notes TEXT DEFAULT NULL,
    p_patient_name TEXT DEFAULT NULL,
    p_hospital_name TEXT DEFAULT NULL,
    p_max_distance_km DOUBLE PRECISION DEFAULT 50.0
)
RETURNS JSONB AS $$
DECLARE
    v_request_id TEXT;
    v_matches JSONB;
    v_match_count INTEGER;
    v_match RECORD;
BEGIN
    -- Créer la demande
    INSERT INTO blood_donation_requests (
        banque_sang_id,
        service_id,
        requested_by_user_id,
        groupe_sanguin_requis,
        quantite_requise,
        unite,
        is_urgent,
        urgence_level,
        deadline_date,
        request_latitude,
        request_longitude,
        request_location_address,
        notes,
        patient_name,
        hospital_name,
        status
    ) VALUES (
        p_banque_sang_id,
        p_service_id,
        p_requested_by_user_id,
        p_groupe_sanguin_requis,
        p_quantite_requise,
        p_unite,
        p_is_urgent,
        p_urgence_level,
        p_deadline_date,
        p_request_lat,
        p_request_lng,
        p_request_location_address,
        p_notes,
        p_patient_name,
        p_hospital_name,
        'active'
    ) RETURNING id INTO v_request_id;
    
    -- Trouver les donneurs potentiels
    v_matches := find_potential_blood_donors(
        v_request_id,
        p_groupe_sanguin_requis,
        p_request_lat,
        p_request_lng,
        p_max_distance_km,
        50 -- Limite de résultats pour création de matches
    );
    
    v_match_count := (v_matches->>'count')::INTEGER;
    
    -- Créer les enregistrements de match
    IF v_match_count > 0 THEN
        FOR v_match IN SELECT * FROM jsonb_array_elements(v_matches->'donors')
        LOOP
            INSERT INTO blood_donation_matches (
                request_id,
                donor_user_id,
                donor_blood_group_id,
                donor_latitude,
                donor_longitude,
                distance_km,
                relevance_score,
                match_status
            ) VALUES (
                v_request_id,
                (v_match->>'user_id')::INTEGER,
                (v_match->>'blood_group_id')::INTEGER,
                (v_match->>'donor_latitude')::DOUBLE PRECISION,
                (v_match->>'donor_longitude')::DOUBLE PRECISION,
                (v_match->>'distance_km')::DOUBLE PRECISION,
                (v_match->>'relevance_score')::DOUBLE PRECISION,
                'pending'
            ) ON CONFLICT (request_id, donor_user_id) DO NOTHING;
        END LOOP;
    END IF;
    
    RETURN jsonb_build_object(
        'success', TRUE,
        'request_id', v_request_id,
        'matches_found', v_match_count,
        'message', format('Demande créée avec %s donneur(s) potentiel(s)', v_match_count)
    );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION create_blood_donation_request IS 'Crée une demande de don de sang et trouve automatiquement les donneurs compatibles';

-- ============================================================================
-- 6. FONCTION : Mettre à jour le statut d'un match (accepté/refusé)
-- ============================================================================
CREATE OR REPLACE FUNCTION update_blood_donation_match_status(
    p_match_id TEXT,
    p_new_status VARCHAR(20),
    p_declined_reason TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_match RECORD;
    v_request RECORD;
BEGIN
    -- Récupérer le match
    SELECT * INTO v_match FROM blood_donation_matches WHERE id = p_match_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Match non trouvé');
    END IF;
    
    -- Mettre à jour le statut
    UPDATE blood_donation_matches
    SET 
        match_status = p_new_status,
        declined_reason = p_declined_reason,
        notified_at = CASE WHEN p_new_status = 'notified' THEN NOW() ELSE notified_at END,
        accepted_at = CASE WHEN p_new_status = 'accepted' THEN NOW() ELSE accepted_at END,
        declined_at = CASE WHEN p_new_status = 'declined' THEN NOW() ELSE declined_at END,
        completed_at = CASE WHEN p_new_status = 'completed' THEN NOW() ELSE completed_at END,
        updated_at = NOW()
    WHERE id = p_match_id;
    
    -- Si accepté, vérifier si la demande est complète
    IF p_new_status = 'accepted' THEN
        SELECT * INTO v_request FROM blood_donation_requests WHERE id = v_match.request_id;
        
        -- Compter les matches acceptés
        IF EXISTS (
            SELECT 1 FROM blood_donation_matches
            WHERE request_id = v_match.request_id
                AND match_status = 'accepted'
            GROUP BY request_id
            HAVING COUNT(*) >= v_request.quantite_requise
        ) THEN
            -- Marquer la demande comme fulfilled
            UPDATE blood_donation_requests
            SET status = 'fulfilled', fulfilled_at = NOW(), updated_at = NOW()
            WHERE id = v_match.request_id;
        END IF;
    END IF;
    
    RETURN jsonb_build_object('success', TRUE, 'match_id', p_match_id, 'new_status', p_new_status);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_blood_donation_match_status IS 'Met à jour le statut d''un match donneur/demande';

-- ============================================================================
-- 7. FONCTION : Mettre à jour date de dernier don (après don effectué)
-- ============================================================================
CREATE OR REPLACE FUNCTION update_donor_last_donation(
    p_user_id INTEGER,
    p_groupe_sanguin VARCHAR(5),
    p_donation_date DATE DEFAULT CURRENT_DATE
)
RETURNS JSONB AS $$
DECLARE
    v_next_available_date DATE;
BEGIN
    -- Calculer date prochaine disponibilité (8 semaines = 56 jours)
    v_next_available_date := p_donation_date + INTERVAL '56 days';
    
    -- Mettre à jour ou créer l'enregistrement
    INSERT INTO user_blood_groups (user_id, groupe_sanguin, last_donation_date, next_donation_available_date, is_available_for_donation, updated_at)
    VALUES (p_user_id, p_groupe_sanguin, p_donation_date, v_next_available_date, FALSE, NOW())
    ON CONFLICT (user_id, groupe_sanguin)
    DO UPDATE SET
        last_donation_date = p_donation_date,
        next_donation_available_date = v_next_available_date,
        is_available_for_donation = FALSE,
        updated_at = NOW();
    
    RETURN jsonb_build_object(
        'success', TRUE,
        'next_donation_available_date', v_next_available_date,
        'message', format('Prochain don possible le %s', v_next_available_date)
    );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_donor_last_donation IS 'Met à jour la date de dernier don et calcule la prochaine disponibilité (8 semaines minimum)';

-- ============================================================================
-- 8. VUE : Demandes actives avec statistiques
-- ============================================================================
CREATE OR REPLACE VIEW blood_donation_requests_active AS
SELECT 
    bdr.id,
    bdr.banque_sang_id,
    bs.nom as banque_sang_nom,
    bdr.service_id,
    bdr.requested_by_user_id,
    bdr.groupe_sanguin_requis,
    bdr.quantite_requise,
    bdr.unite,
    bdr.is_urgent,
    bdr.urgence_level,
    bdr.deadline_date,
    bdr.request_latitude,
    bdr.request_longitude,
    bdr.request_location_address,
    bdr.status,
    bdr.patient_name,
    bdr.hospital_name,
    bdr.created_at,
    COUNT(DISTINCT CASE WHEN bdm.match_status IN ('pending', 'notified', 'accepted') THEN bdm.id END) as matches_count,
    COUNT(DISTINCT CASE WHEN bdm.match_status = 'accepted' THEN bdm.id END) as accepted_matches_count,
    COUNT(DISTINCT CASE WHEN bdm.match_status = 'notified' THEN bdm.id END) as notified_matches_count
FROM blood_donation_requests bdr
JOIN banques_sang bs ON bs.id = bdr.banque_sang_id
LEFT JOIN blood_donation_matches bdm ON bdm.request_id = bdr.id
WHERE bdr.status = 'active'
GROUP BY bdr.id, bs.nom;

COMMENT ON VIEW blood_donation_requests_active IS 'Vue des demandes actives avec statistiques de matches';

