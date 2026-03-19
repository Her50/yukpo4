-- Migration: Amélioration du matching retour avec prise en compte de l'heure
-- Date: 2025-11-27
-- Description: Modifie la fonction match_return_trip_requests pour inclure le matching par heure de retour

-- ✅ CORRIGÉ: DROP la fonction avant de la recréer si le type de retour change
DROP FUNCTION IF EXISTS match_return_trip_requests(TEXT);

-- Fonction améliorée pour matcher automatiquement les demandes de retour avec prise en compte de l'heure
CREATE OR REPLACE FUNCTION match_return_trip_requests(p_product_id TEXT)
RETURNS TABLE(
    request_id TEXT,
    user_id INTEGER,
    passenger_names TEXT[],
    number_of_seats INTEGER,
    preferred_return_time TEXT
) AS $$
BEGIN
    -- Trouver les demandes de retour correspondantes
    -- Quand un nouveau bus est créé, on check s'il match des demandes
    RETURN QUERY
    SELECT 
        rtr.id as request_id,
        rtr.user_id,
        rtr.passenger_names,
        rtr.number_of_seats,
        rtr.preferred_return_time
    FROM return_trip_requests rtr
    JOIN products p ON p.id::text = p_product_id
    JOIN services s ON s.id = p.service_id
    LEFT JOIN bus_ticket_payments btp_outbound ON btp_outbound.id = rtr.outbound_payment_id
    WHERE rtr.status = 'pending'
        -- ✅ CRITIQUE: Match agence (le bus retour doit appartenir à la même agence que le bus aller)
        AND (
            -- Si outbound_payment_id existe, vérifier que l'agence du bus retour = agence du bus aller
            rtr.outbound_payment_id IS NULL
            OR btp_outbound.agency_user_id = s.user_id
        )
        -- Match route (inverse du voyage)
        AND rtr.return_from = p.depart
        AND rtr.return_to = p.destination
        -- Match date (avec flexibilité)
        AND p.date_depart BETWEEN 
            (rtr.preferred_return_date::date - INTERVAL '1 day' * rtr.date_flexibility_days)
            AND (rtr.preferred_return_date::date + INTERVAL '1 day' * rtr.date_flexibility_days)
        -- ✅ NOUVEAU: Match heure (si spécifiée, avec tolérance ±1h)
        AND (
            -- Si aucune heure préférée n'est spécifiée, on accepte tous les horaires
            rtr.preferred_return_time IS NULL 
            -- Si le bus n'a pas d'heure dans metadata, on accepte
            OR p.metadata->>'departure_time' IS NULL
            -- Sinon, on vérifie que l'heure du bus est dans la tolérance (±1h)
            OR ABS(
                EXTRACT(EPOCH FROM (
                    (p.metadata->>'departure_time')::TIME - rtr.preferred_return_time::TIME
                ))
            ) / 3600 <= 1  -- Tolérance de 1 heure (3600 secondes)
        )
        -- Vérifier qu'il y a assez de places
        AND p.total_seats >= rtr.number_of_seats;
END;
$$ LANGUAGE plpgsql;

-- Commentaire
COMMENT ON FUNCTION match_return_trip_requests IS 'Match les demandes de retour avec les nouveaux bus créés. Prend en compte la route, la date (avec flexibilité) et l''heure (tolérance ±1h)';

