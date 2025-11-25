-- Migration: Fonctions SQL de recherche spécialisées avec moment (NOW())
-- Date: 2025-11-26
-- Description: Fonctions de recherche pour tables spécialisées avec prise en compte systématique du moment
-- Note: Compatible avec SQLx offline mode

-- ============================================================================
-- RECHERCHE PHARMACIES AVEC MOMENT
-- ============================================================================

CREATE OR REPLACE FUNCTION search_pharmacies_with_moment(
    search_query TEXT,
    user_gps TEXT DEFAULT NULL, -- Format: "lat,lng"
    radius_km INTEGER DEFAULT 50,
    on_duty_only BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
    pharmacy_id INTEGER,
    service_id INTEGER,
    nom VARCHAR,
    adresse TEXT,
    quartier VARCHAR,
    ville VARCHAR,
    gps VARCHAR,
    telephone VARCHAR,
    whatsapp VARCHAR,
    is_on_duty_now BOOLEAN,
    distance_km DOUBLE PRECISION,
    relevance_score DOUBLE PRECISION
) AS $$
DECLARE
    user_lat DOUBLE PRECISION;
    user_lng DOUBLE PRECISION;
BEGIN
    -- Extraire coordonnées GPS utilisateur si fourni
    IF user_gps IS NOT NULL AND user_gps != '' THEN
        user_lat := SPLIT_PART(user_gps, ',', 1)::DOUBLE PRECISION;
        user_lng := SPLIT_PART(user_gps, ',', 2)::DOUBLE PRECISION;
    END IF;

    RETURN QUERY
    WITH pharmacy_data AS (
        SELECT 
            p.id,
            p.service_id,
            p.nom,
            p.adresse,
            p.quartier,
            p.ville,
            p.gps,
            p.telephone,
            p.whatsapp,
            -- ✅ MOMENT : Calculer is_on_duty_now avec NOW()
            is_pharmacy_on_duty(
                jsonb_build_object(
                    'joursGarde', p.jours_garde,
                    'heuresOuverture', p.heures_ouverture::TEXT,
                    'heuresFermeture', p.heures_fermeture::TEXT
                ),
                NOW()
            ) AS is_on_duty_now,
            -- Calculer distance si GPS fourni
            CASE 
                WHEN user_lat IS NOT NULL AND user_lng IS NOT NULL AND p.gps IS NOT NULL AND p.gps != '' THEN
                    calculate_distance_km(
                        user_lat,
                        user_lng,
                        SPLIT_PART(p.gps, ',', 1)::DOUBLE PRECISION,
                        SPLIT_PART(p.gps, ',', 2)::DOUBLE PRECISION
                    )
                ELSE NULL
            END AS distance_km,
            -- Score de pertinence (nom, quartier, ville, services)
            (
                CASE WHEN p.nom ILIKE '%' || search_query || '%' THEN 10 ELSE 0 END +
                CASE WHEN p.quartier ILIKE '%' || search_query || '%' THEN 5 ELSE 0 END +
                CASE WHEN p.ville ILIKE '%' || search_query || '%' THEN 3 ELSE 0 END +
                CASE WHEN EXISTS (
                    SELECT 1 FROM unnest(p.services) AS service 
                    WHERE service ILIKE '%' || search_query || '%'
                ) THEN 7 ELSE 0 END
            )::DOUBLE PRECISION AS relevance_score
        FROM pharmacies p
        WHERE p.is_active = TRUE
        AND (
            search_query = '' OR
            p.nom ILIKE '%' || search_query || '%' OR
            p.quartier ILIKE '%' || search_query || '%' OR
            p.ville ILIKE '%' || search_query || '%' OR
            EXISTS (
                SELECT 1 FROM unnest(p.services) AS service 
                WHERE service ILIKE '%' || search_query || '%'
            )
        )
    )
    SELECT 
        pd.id,
        pd.service_id,
        pd.nom,
        pd.adresse,
        pd.quartier,
        pd.ville,
        pd.gps,
        pd.telephone,
        pd.whatsapp,
        pd.is_on_duty_now,
        pd.distance_km,
        pd.relevance_score
    FROM pharmacy_data pd
    WHERE 
        (NOT on_duty_only OR pd.is_on_duty_now = TRUE)
        AND (
            user_gps IS NULL OR 
            pd.distance_km IS NULL OR 
            pd.distance_km <= radius_km
        )
    ORDER BY 
        pd.is_on_duty_now DESC, -- Priorité aux pharmacies de garde
        pd.relevance_score DESC,
        pd.distance_km ASC NULLS LAST
    LIMIT 50;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- RECHERCHE HÔPITAUX AVEC MOMENT
-- ============================================================================

CREATE OR REPLACE FUNCTION search_hospitals_with_moment(
    search_query TEXT,
    user_gps TEXT DEFAULT NULL,
    radius_km INTEGER DEFAULT 50,
    available_now_only BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
    hospital_id INTEGER,
    service_id INTEGER,
    nom VARCHAR,
    type_etablissement VARCHAR,
    adresse TEXT,
    quartier VARCHAR,
    ville VARCHAR,
    gps VARCHAR,
    telephone VARCHAR,
    whatsapp VARCHAR,
    is_available_now BOOLEAN,
    distance_km DOUBLE PRECISION,
    relevance_score DOUBLE PRECISION
) AS $$
DECLARE
    user_lat DOUBLE PRECISION;
    user_lng DOUBLE PRECISION;
BEGIN
    IF user_gps IS NOT NULL AND user_gps != '' THEN
        user_lat := SPLIT_PART(user_gps, ',', 1)::DOUBLE PRECISION;
        user_lng := SPLIT_PART(user_gps, ',', 2)::DOUBLE PRECISION;
    END IF;

    RETURN QUERY
    WITH hospital_data AS (
        SELECT 
            h.id,
            h.service_id,
            h.nom,
            h.type_etablissement,
            h.adresse,
            h.quartier,
            h.ville,
            h.gps,
            h.telephone,
            h.whatsapp,
            -- ✅ MOMENT : Calculer is_available_now avec NOW()
            is_medical_service_available(
                jsonb_build_object(
                    'planningHebdomadaire', h.planning_hebdomadaire,
                    'prestationsMedicales', h.prestations_medicales
                ),
                NOW(),
                NULL
            ) AS is_available_now,
            CASE 
                WHEN user_lat IS NOT NULL AND user_lng IS NOT NULL AND h.gps IS NOT NULL AND h.gps != '' THEN
                    calculate_distance_km(
                        user_lat,
                        user_lng,
                        SPLIT_PART(h.gps, ',', 1)::DOUBLE PRECISION,
                        SPLIT_PART(h.gps, ',', 2)::DOUBLE PRECISION
                    )
                ELSE NULL
            END AS distance_km,
            (
                CASE WHEN h.nom ILIKE '%' || search_query || '%' THEN 10 ELSE 0 END +
                CASE WHEN h.type_etablissement ILIKE '%' || search_query || '%' THEN 8 ELSE 0 END +
                CASE WHEN h.quartier ILIKE '%' || search_query || '%' THEN 5 ELSE 0 END +
                CASE WHEN EXISTS (
                    SELECT 1 FROM unnest(h.prestations_medicales) AS prestation 
                    WHERE prestation ILIKE '%' || search_query || '%'
                ) THEN 7 ELSE 0 END
            )::DOUBLE PRECISION AS relevance_score
        FROM hopitaux_cliniques h
        WHERE h.is_active = TRUE
        AND (
            search_query = '' OR
            h.nom ILIKE '%' || search_query || '%' OR
            h.type_etablissement ILIKE '%' || search_query || '%' OR
            h.quartier ILIKE '%' || search_query || '%' OR
            EXISTS (
                SELECT 1 FROM unnest(h.prestations_medicales) AS prestation 
                WHERE prestation ILIKE '%' || search_query || '%'
            )
        )
    )
    SELECT 
        hd.id,
        hd.service_id,
        hd.nom,
        hd.type_etablissement,
        hd.adresse,
        hd.quartier,
        hd.ville,
        hd.gps,
        hd.telephone,
        hd.whatsapp,
        hd.is_available_now,
        hd.distance_km,
        hd.relevance_score
    FROM hospital_data hd
    WHERE 
        (NOT available_now_only OR hd.is_available_now = TRUE)
        AND (
            user_gps IS NULL OR 
            hd.distance_km IS NULL OR 
            hd.distance_km <= radius_km
        )
    ORDER BY 
        hd.is_available_now DESC,
        hd.relevance_score DESC,
        hd.distance_km ASC NULLS LAST
    LIMIT 50;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- RECHERCHE LABORATOIRES AVEC MOMENT
-- ============================================================================

CREATE OR REPLACE FUNCTION search_laboratories_with_moment(
    search_query TEXT,
    user_gps TEXT DEFAULT NULL,
    radius_km INTEGER DEFAULT 50
)
RETURNS TABLE (
    laboratory_id INTEGER,
    service_id INTEGER,
    nom VARCHAR,
    type_laboratoire VARCHAR,
    adresse TEXT,
    quartier VARCHAR,
    ville VARCHAR,
    gps VARCHAR,
    telephone VARCHAR,
    whatsapp VARCHAR,
    is_available_now BOOLEAN,
    distance_km DOUBLE PRECISION,
    relevance_score DOUBLE PRECISION
) AS $$
DECLARE
    user_lat DOUBLE PRECISION;
    user_lng DOUBLE PRECISION;
BEGIN
    IF user_gps IS NOT NULL AND user_gps != '' THEN
        user_lat := SPLIT_PART(user_gps, ',', 1)::DOUBLE PRECISION;
        user_lng := SPLIT_PART(user_gps, ',', 2)::DOUBLE PRECISION;
    END IF;

    RETURN QUERY
    WITH laboratory_data AS (
        SELECT 
            l.id,
            l.service_id,
            l.nom,
            l.type_laboratoire,
            l.adresse,
            l.quartier,
            l.ville,
            l.gps,
            l.telephone,
            l.whatsapp,
            -- ✅ MOMENT : Vérifier disponibilité avec planning_hebdomadaire et NOW()
            CASE 
                WHEN l.planning_hebdomadaire IS NOT NULL THEN
                    is_medical_service_available(
                        jsonb_build_object('planningHebdomadaire', l.planning_hebdomadaire),
                        NOW(),
                        NULL
                    )
                ELSE TRUE -- Si pas de planning, considéré disponible
            END AS is_available_now,
            CASE 
                WHEN user_lat IS NOT NULL AND user_lng IS NOT NULL AND l.gps IS NOT NULL AND l.gps != '' THEN
                    calculate_distance_km(
                        user_lat,
                        user_lng,
                        SPLIT_PART(l.gps, ',', 1)::DOUBLE PRECISION,
                        SPLIT_PART(l.gps, ',', 2)::DOUBLE PRECISION
                    )
                ELSE NULL
            END AS distance_km,
            (
                CASE WHEN l.nom ILIKE '%' || search_query || '%' THEN 10 ELSE 0 END +
                CASE WHEN l.type_laboratoire ILIKE '%' || search_query || '%' THEN 8 ELSE 0 END +
                CASE WHEN EXISTS (
                    SELECT 1 FROM unnest(l.analyses_disponibles) AS analyse 
                    WHERE analyse ILIKE '%' || search_query || '%'
                ) THEN 7 ELSE 0 END +
                CASE WHEN EXISTS (
                    SELECT 1 FROM unnest(l.imagerie_disponible) AS imagerie 
                    WHERE imagerie ILIKE '%' || search_query || '%'
                ) THEN 7 ELSE 0 END
            )::DOUBLE PRECISION AS relevance_score
        FROM laboratoires_imagerie l
        WHERE l.is_active = TRUE
        AND (
            search_query = '' OR
            l.nom ILIKE '%' || search_query || '%' OR
            l.type_laboratoire ILIKE '%' || search_query || '%' OR
            EXISTS (
                SELECT 1 FROM unnest(l.analyses_disponibles) AS analyse 
                WHERE analyse ILIKE '%' || search_query || '%'
            ) OR
            EXISTS (
                SELECT 1 FROM unnest(l.imagerie_disponible) AS imagerie 
                WHERE imagerie ILIKE '%' || search_query || '%'
            )
        )
    )
    SELECT 
        ld.id,
        ld.service_id,
        ld.nom,
        ld.type_laboratoire,
        ld.adresse,
        ld.quartier,
        ld.ville,
        ld.gps,
        ld.telephone,
        ld.whatsapp,
        ld.is_available_now,
        ld.distance_km,
        ld.relevance_score
    FROM laboratory_data ld
    WHERE 
        (user_gps IS NULL OR ld.distance_km IS NULL OR ld.distance_km <= radius_km)
    ORDER BY 
        ld.is_available_now DESC,
        ld.relevance_score DESC,
        ld.distance_km ASC NULLS LAST
    LIMIT 50;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- RECHERCHE AGENCES VOYAGE AVEC MOMENT
-- ============================================================================

CREATE OR REPLACE FUNCTION search_travel_agencies_with_moment(
    search_query TEXT,
    user_gps TEXT DEFAULT NULL,
    radius_km INTEGER DEFAULT 50
)
RETURNS TABLE (
    agency_id INTEGER,
    service_id INTEGER,
    nom_agence VARCHAR,
    adresse TEXT,
    quartier VARCHAR,
    ville VARCHAR,
    gps VARCHAR,
    telephone VARCHAR,
    whatsapp VARCHAR,
    peut_emettre_tickets_bus BOOLEAN,
    distance_km DOUBLE PRECISION,
    relevance_score DOUBLE PRECISION
) AS $$
DECLARE
    user_lat DOUBLE PRECISION;
    user_lng DOUBLE PRECISION;
    current_time TIME;
    current_dow INTEGER;
BEGIN
    IF user_gps IS NOT NULL AND user_gps != '' THEN
        user_lat := SPLIT_PART(user_gps, ',', 1)::DOUBLE PRECISION;
        user_lng := SPLIT_PART(user_gps, ',', 2)::DOUBLE PRECISION;
    END IF;

    current_time := CURRENT_TIME;
    current_dow := EXTRACT(DOW FROM NOW());

    RETURN QUERY
    WITH agency_data AS (
        SELECT 
            a.id,
            a.service_id,
            a.nom_agence,
            a.adresse,
            a.quartier,
            a.ville,
            a.gps,
            a.telephone,
            a.whatsapp,
            a.peut_emettre_tickets_bus,
            CASE 
                WHEN user_lat IS NOT NULL AND user_lng IS NOT NULL AND a.gps IS NOT NULL AND a.gps != '' THEN
                    calculate_distance_km(
                        user_lat,
                        user_lng,
                        SPLIT_PART(a.gps, ',', 1)::DOUBLE PRECISION,
                        SPLIT_PART(a.gps, ',', 2)::DOUBLE PRECISION
                    )
                ELSE NULL
            END AS distance_km,
            (
                CASE WHEN a.nom_agence ILIKE '%' || search_query || '%' THEN 10 ELSE 0 END +
                CASE WHEN EXISTS (
                    SELECT 1 FROM unnest(a.services_voyage) AS service 
                    WHERE service ILIKE '%' || search_query || '%'
                ) THEN 8 ELSE 0 END +
                CASE WHEN EXISTS (
                    SELECT 1 FROM unnest(a.compagnies_bus) AS compagnie 
                    WHERE compagnie ILIKE '%' || search_query || '%'
                ) THEN 7 ELSE 0 END +
                CASE WHEN EXISTS (
                    SELECT 1 FROM unnest(a.destinations) AS destination 
                    WHERE destination ILIKE '%' || search_query || '%'
                ) THEN 7 ELSE 0 END +
                -- Bonus si peut émettre tickets bus et recherche contient "bus" ou "ticket"
                CASE WHEN a.peut_emettre_tickets_bus AND (
                    search_query ILIKE '%bus%' OR search_query ILIKE '%ticket%'
                ) THEN 5 ELSE 0 END
            )::DOUBLE PRECISION AS relevance_score
        FROM agences_voyage a
        WHERE a.is_active = TRUE
        AND (
            search_query = '' OR
            a.nom_agence ILIKE '%' || search_query || '%' OR
            EXISTS (
                SELECT 1 FROM unnest(a.services_voyage) AS service 
                WHERE service ILIKE '%' || search_query || '%'
            ) OR
            EXISTS (
                SELECT 1 FROM unnest(a.compagnies_bus) AS compagnie 
                WHERE compagnie ILIKE '%' || search_query || '%'
            ) OR
            EXISTS (
                SELECT 1 FROM unnest(a.destinations) AS destination 
                WHERE destination ILIKE '%' || search_query || '%'
            )
        )
        -- ✅ MOMENT : Filtrer par horaires d'ouverture si disponibles
        AND (
            a.heures_ouverture IS NULL OR
            a.heures_fermeture IS NULL OR
            (current_time >= a.heures_ouverture AND current_time <= a.heures_fermeture)
        )
    )
    SELECT 
        ad.id,
        ad.service_id,
        ad.nom_agence,
        ad.adresse,
        ad.quartier,
        ad.ville,
        ad.gps,
        ad.telephone,
        ad.whatsapp,
        ad.peut_emettre_tickets_bus,
        ad.distance_km,
        ad.relevance_score
    FROM agency_data ad
    WHERE 
        (user_gps IS NULL OR ad.distance_km IS NULL OR ad.distance_km <= radius_km)
    ORDER BY 
        ad.relevance_score DESC,
        ad.distance_km ASC NULLS LAST
    LIMIT 50;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- RECHERCHE COVOITURAGES AVEC MOMENT
-- ============================================================================

CREATE OR REPLACE FUNCTION search_covoiturages_with_moment(
    search_query TEXT,
    user_gps TEXT DEFAULT NULL,
    radius_km INTEGER DEFAULT 50,
    date_depart_min TIMESTAMPTZ DEFAULT NULL -- Si NULL, utilise NOW()
)
RETURNS TABLE (
    covoiturage_id INTEGER,
    service_id INTEGER,
    depart VARCHAR,
    destination VARCHAR,
    gps_depart VARCHAR,
    date_depart TIMESTAMPTZ,
    heure_depart TIME,
    nombre_places INTEGER,
    places_disponibles INTEGER,
    prix_par_place INTEGER,
    devise VARCHAR,
    distance_km DOUBLE PRECISION,
    relevance_score DOUBLE PRECISION
) AS $$
DECLARE
    user_lat DOUBLE PRECISION;
    user_lng DOUBLE PRECISION;
    search_time TIMESTAMPTZ;
BEGIN
    IF user_gps IS NOT NULL AND user_gps != '' THEN
        user_lat := SPLIT_PART(user_gps, ',', 1)::DOUBLE PRECISION;
        user_lng := SPLIT_PART(user_gps, ',', 2)::DOUBLE PRECISION;
    END IF;

    -- ✅ MOMENT : Utiliser NOW() si date_depart_min non fournie
    search_time := COALESCE(date_depart_min, NOW());

    RETURN QUERY
    WITH covoiturage_data AS (
        SELECT 
            c.id,
            c.service_id,
            c.depart,
            c.destination,
            c.gps_depart,
            c.date_depart,
            c.heure_depart,
            c.nombre_places,
            c.places_disponibles,
            c.prix_par_place,
            c.devise,
            CASE 
                WHEN user_lat IS NOT NULL AND user_lng IS NOT NULL AND c.gps_depart IS NOT NULL AND c.gps_depart != '' THEN
                    calculate_distance_km(
                        user_lat,
                        user_lng,
                        SPLIT_PART(c.gps_depart, ',', 1)::DOUBLE PRECISION,
                        SPLIT_PART(c.gps_depart, ',', 2)::DOUBLE PRECISION
                    )
                ELSE NULL
            END AS distance_km,
            (
                CASE WHEN c.depart ILIKE '%' || search_query || '%' THEN 10 ELSE 0 END +
                CASE WHEN c.destination ILIKE '%' || search_query || '%' THEN 10 ELSE 0 END +
                -- Bonus si places disponibles
                CASE WHEN c.places_disponibles > 0 THEN 5 ELSE 0 END
            )::DOUBLE PRECISION AS relevance_score
        FROM covoiturages c
        WHERE c.is_active = TRUE
        AND c.statut = 'ouvert'
        AND c.places_disponibles > 0
        -- ✅ MOMENT : Filtrer par date_depart (maintenant ou futur)
        AND c.date_depart >= search_time
        AND (
            search_query = '' OR
            c.depart ILIKE '%' || search_query || '%' OR
            c.destination ILIKE '%' || search_query || '%'
        )
    )
    SELECT 
        cd.id,
        cd.service_id,
        cd.depart,
        cd.destination,
        cd.gps_depart,
        cd.date_depart,
        cd.heure_depart,
        cd.nombre_places,
        cd.places_disponibles,
        cd.prix_par_place,
        cd.devise,
        cd.distance_km,
        cd.relevance_score
    FROM covoiturage_data cd
    WHERE 
        (user_gps IS NULL OR cd.distance_km IS NULL OR cd.distance_km <= radius_km)
    ORDER BY 
        cd.date_depart ASC, -- Plus proche départ en premier
        cd.relevance_score DESC,
        cd.distance_km ASC NULLS LAST
    LIMIT 50;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- RECHERCHE TAXIS AVEC MOMENT
-- ============================================================================

CREATE OR REPLACE FUNCTION search_taxis_with_moment(
    search_query TEXT,
    user_gps TEXT DEFAULT NULL,
    radius_km INTEGER DEFAULT 10, -- Rayon plus petit pour taxis
    available_now_only BOOLEAN DEFAULT TRUE
)
RETURNS TABLE (
    taxi_id INTEGER,
    service_id INTEGER,
    nom_chauffeur VARCHAR,
    telephone VARCHAR,
    whatsapp VARCHAR,
    zone_intervention TEXT[],
    gps_actuel VARCHAR,
    is_available_now BOOLEAN,
    is_on_duty BOOLEAN,
    distance_km DOUBLE PRECISION,
    relevance_score DOUBLE PRECISION
) AS $$
DECLARE
    user_lat DOUBLE PRECISION;
    user_lng DOUBLE PRECISION;
BEGIN
    IF user_gps IS NOT NULL AND user_gps != '' THEN
        user_lat := SPLIT_PART(user_gps, ',', 1)::DOUBLE PRECISION;
        user_lng := SPLIT_PART(user_gps, ',', 2)::DOUBLE PRECISION;
    END IF;

    RETURN QUERY
    WITH taxi_data AS (
        SELECT 
            t.id,
            t.service_id,
            t.nom_chauffeur,
            t.telephone,
            t.whatsapp,
            t.zone_intervention,
            t.gps_actuel,
            t.is_available_now,
            t.is_on_duty,
            CASE 
                WHEN user_lat IS NOT NULL AND user_lng IS NOT NULL AND t.gps_actuel IS NOT NULL AND t.gps_actuel != '' THEN
                    calculate_distance_km(
                        user_lat,
                        user_lng,
                        SPLIT_PART(t.gps_actuel, ',', 1)::DOUBLE PRECISION,
                        SPLIT_PART(t.gps_actuel, ',', 2)::DOUBLE PRECISION
                    )
                ELSE NULL
            END AS distance_km,
            (
                CASE WHEN t.nom_chauffeur ILIKE '%' || search_query || '%' THEN 5 ELSE 0 END +
                CASE WHEN t.telephone ILIKE '%' || search_query || '%' THEN 3 ELSE 0 END +
                CASE WHEN EXISTS (
                    SELECT 1 FROM unnest(t.zone_intervention) AS zone 
                    WHERE zone ILIKE '%' || search_query || '%'
                ) THEN 8 ELSE 0 END +
                -- Bonus si disponible maintenant
                CASE WHEN t.is_available_now THEN 10 ELSE 0 END
            )::DOUBLE PRECISION AS relevance_score
        FROM taxis_ville t
        WHERE t.is_active = TRUE
        AND (
            NOT available_now_only OR t.is_available_now = TRUE
        )
        AND (
            search_query = '' OR
            t.nom_chauffeur ILIKE '%' || search_query || '%' OR
            t.telephone ILIKE '%' || search_query || '%' OR
            EXISTS (
                SELECT 1 FROM unnest(t.zone_intervention) AS zone 
                WHERE zone ILIKE '%' || search_query || '%'
            )
        )
    )
    SELECT 
        td.id,
        td.service_id,
        td.nom_chauffeur,
        td.telephone,
        td.whatsapp,
        td.zone_intervention,
        td.gps_actuel,
        td.is_available_now,
        td.is_on_duty,
        td.distance_km,
        td.relevance_score
    FROM taxi_data td
    WHERE 
        (user_gps IS NULL OR td.distance_km IS NULL OR td.distance_km <= radius_km)
    ORDER BY 
        td.is_available_now DESC,
        td.distance_km ASC NULLS LAST, -- Plus proche en premier
        td.relevance_score DESC
    LIMIT 50;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- RECHERCHE BANQUES DE SANG AVEC MOMENT
-- ============================================================================

CREATE OR REPLACE FUNCTION search_banques_sang_with_moment(
    search_query TEXT,
    user_gps TEXT DEFAULT NULL,
    radius_km INTEGER DEFAULT 50,
    groupe_sanguin TEXT DEFAULT NULL, -- "O+", "AB-", etc.
    urgence BOOLEAN DEFAULT FALSE,
    available_now_only BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
    banque_id INTEGER,
    service_id INTEGER,
    hopital_id INTEGER,
    nom VARCHAR,
    adresse TEXT,
    quartier VARCHAR,
    ville VARCHAR,
    gps VARCHAR,
    telephone VARCHAR,
    telephone_urgence VARCHAR,
    whatsapp VARCHAR,
    stocks_groupes_sanguins JSONB,
    accepte_dons BOOLEAN,
    accepte_demandes BOOLEAN,
    urgence_24h BOOLEAN,
    is_available_now BOOLEAN,
    distance_km DOUBLE PRECISION,
    relevance_score DOUBLE PRECISION
) AS $$
DECLARE
    user_lat DOUBLE PRECISION;
    user_lng DOUBLE PRECISION;
BEGIN
    IF user_gps IS NOT NULL AND user_gps != '' THEN
        user_lat := SPLIT_PART(user_gps, ',', 1)::DOUBLE PRECISION;
        user_lng := SPLIT_PART(user_gps, ',', 2)::DOUBLE PRECISION;
    END IF;

    RETURN QUERY
    WITH banque_data AS (
        SELECT 
            b.id,
            b.service_id,
            b.hopital_id,
            b.nom,
            b.adresse,
            b.quartier,
            b.ville,
            b.gps,
            b.telephone,
            b.telephone_urgence,
            b.whatsapp,
            b.stocks_groupes_sanguins,
            b.accepte_dons,
            b.accepte_demandes,
            b.urgence_24h,
            -- ✅ MOMENT : Calculer is_available_now avec planning_hebdomadaire et NOW()
            CASE 
                WHEN b.planning_hebdomadaire IS NOT NULL THEN
                    is_medical_service_available(
                        jsonb_build_object('planningHebdomadaire', b.planning_hebdomadaire),
                        NOW(),
                        NULL
                    )
                WHEN b.urgence_24h THEN TRUE
                ELSE TRUE -- Par défaut disponible si pas de planning
            END AS is_available_now,
            CASE 
                WHEN user_lat IS NOT NULL AND user_lng IS NOT NULL AND b.gps IS NOT NULL AND b.gps != '' THEN
                    calculate_distance_km(
                        user_lat,
                        user_lng,
                        SPLIT_PART(b.gps, ',', 1)::DOUBLE PRECISION,
                        SPLIT_PART(b.gps, ',', 2)::DOUBLE PRECISION
                    )
                ELSE NULL
            END AS distance_km,
            (
                CASE WHEN b.nom ILIKE '%' || search_query || '%' THEN 10 ELSE 0 END +
                CASE WHEN b.quartier ILIKE '%' || search_query || '%' THEN 5 ELSE 0 END +
                CASE WHEN b.ville ILIKE '%' || search_query || '%' THEN 3 ELSE 0 END +
                -- Bonus si groupe sanguin recherché est disponible
                CASE 
                    WHEN groupe_sanguin IS NOT NULL 
                    AND b.stocks_groupes_sanguins ? groupe_sanguin
                    AND (b.stocks_groupes_sanguins->groupe_sanguin->>'quantite')::INTEGER > 0
                    THEN 15 
                    ELSE 0 
                END +
                -- Bonus si urgence 24h
                CASE WHEN b.urgence_24h AND urgence THEN 10 ELSE 0 END +
                -- Bonus si accepte dons et recherche contient "don"
                CASE WHEN b.accepte_dons AND search_query ILIKE '%don%' THEN 8 ELSE 0 END
            )::DOUBLE PRECISION AS relevance_score
        FROM banques_sang b
        WHERE b.is_active = TRUE
        AND (
            search_query = '' OR
            b.nom ILIKE '%' || search_query || '%' OR
            b.quartier ILIKE '%' || search_query || '%' OR
            b.ville ILIKE '%' || search_query || '%' OR
            search_query ILIKE '%banque%' OR
            search_query ILIKE '%sang%' OR
            search_query ILIKE '%don%'
        )
        -- Filtrer par groupe sanguin si spécifié
        AND (
            groupe_sanguin IS NULL OR
            (b.stocks_groupes_sanguins ? groupe_sanguin
             AND (b.stocks_groupes_sanguins->groupe_sanguin->>'quantite')::INTEGER > 0)
        )
        -- Filtrer par urgence si spécifié
        AND (
            NOT urgence OR b.urgence_24h = TRUE
        )
    )
    SELECT 
        bd.id,
        bd.service_id,
        bd.hopital_id,
        bd.nom,
        bd.adresse,
        bd.quartier,
        bd.ville,
        bd.gps,
        bd.telephone,
        bd.telephone_urgence,
        bd.whatsapp,
        bd.stocks_groupes_sanguins,
        bd.accepte_dons,
        bd.accepte_demandes,
        bd.urgence_24h,
        bd.is_available_now,
        bd.distance_km,
        bd.relevance_score
    FROM banque_data bd
    WHERE 
        (NOT available_now_only OR bd.is_available_now = TRUE)
        AND (
            user_gps IS NULL OR 
            bd.distance_km IS NULL OR 
            bd.distance_km <= radius_km
        )
    ORDER BY 
        bd.urgence_24h DESC, -- Priorité aux urgences 24h
        bd.relevance_score DESC,
        bd.distance_km ASC NULLS LAST
    LIMIT 50;
END;
$$ LANGUAGE plpgsql;

