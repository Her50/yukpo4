-- ✅ Migration : Trajets récurrents pour covoiturage
-- Date: 2025-01-29
-- Description: Ajoute support trajets récurrents (quotidien, hebdomadaire)

-- 1. Ajouter colonnes pour récurrence dans table covoiturages
ALTER TABLE covoiturages
ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS recurrence_type TEXT CHECK (recurrence_type IN ('daily', 'weekly', 'monthly', NULL)),
ADD COLUMN IF NOT EXISTS recurrence_days INTEGER[], -- Jours de la semaine (1=lundi, 7=dimanche) pour weekly
ADD COLUMN IF NOT EXISTS recurrence_end_date DATE, -- Date de fin de récurrence
ADD COLUMN IF NOT EXISTS parent_trip_id INTEGER REFERENCES covoiturages(id) ON DELETE CASCADE, -- ID du trajet parent (pour trajets générés)
ADD COLUMN IF NOT EXISTS recurrence_pattern JSONB DEFAULT '{}'::jsonb; -- Pattern flexible (ex: tous les lundi/mercredi)

-- 2. Index pour améliorer performances
CREATE INDEX IF NOT EXISTS idx_covoiturages_is_recurring ON covoiturages(is_recurring) WHERE is_recurring = TRUE;
CREATE INDEX IF NOT EXISTS idx_covoiturages_parent_trip_id ON covoiturages(parent_trip_id) WHERE parent_trip_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_covoiturages_recurrence_end_date ON covoiturages(recurrence_end_date) WHERE recurrence_end_date IS NOT NULL;

-- 3. Table pour suivre les trajets récurrents générés
CREATE TABLE IF NOT EXISTS recurring_trip_instances (
    id SERIAL PRIMARY KEY,
    parent_trip_id INTEGER NOT NULL REFERENCES covoiturages(id) ON DELETE CASCADE,
    instance_date DATE NOT NULL, -- Date du trajet généré
    instance_covoiturage_id INTEGER REFERENCES covoiturages(id) ON DELETE SET NULL, -- ID du trajet généré
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'cancelled', 'completed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(parent_trip_id, instance_date)
);

-- Index pour recurring_trip_instances
CREATE INDEX IF NOT EXISTS idx_recurring_instances_parent ON recurring_trip_instances(parent_trip_id);
CREATE INDEX IF NOT EXISTS idx_recurring_instances_date ON recurring_trip_instances(instance_date);
CREATE INDEX IF NOT EXISTS idx_recurring_instances_status ON recurring_trip_instances(status);
CREATE INDEX IF NOT EXISTS idx_recurring_instances_parent_date ON recurring_trip_instances(parent_trip_id, instance_date);

-- 4. Fonction pour générer automatiquement les trajets récurrents
CREATE OR REPLACE FUNCTION generate_recurring_trips()
RETURNS void AS $$
DECLARE
    trip_record RECORD;
    v_current_date DATE;
    trip_date DATE;
    day_of_week INTEGER;
    days_array INTEGER[];
    days_to_generate INTEGER := 30; -- Générer pour les 30 prochains jours
BEGIN
    -- Parcourir tous les trajets récurrents actifs
    FOR trip_record IN 
        SELECT 
            c.id,
            c.service_id,
            c.user_id,
            c.depart,
            c.destination,
            c.gps_depart,
            c.gps_destination,
            c.date_depart,
            c.heure_depart,
            c.nombre_places,
            c.places_disponibles,
            c.prix_par_place,
            c.devise,
            c.recurrence_type,
            c.recurrence_days,
            c.recurrence_end_date,
            c.recurrence_pattern
        FROM covoiturages c
        INNER JOIN services s ON s.id = c.service_id
        WHERE c.is_recurring = TRUE
        AND c.parent_trip_id IS NULL -- Seulement les trajets parents
        AND s.is_active = TRUE
        AND c.is_active = TRUE
        AND (c.recurrence_end_date IS NULL OR c.recurrence_end_date >= CURRENT_DATE)
    LOOP
        v_current_date := CURRENT_DATE;
        
        -- Générer trajets pour les N prochains jours
        FOR i IN 0..days_to_generate LOOP
            trip_date := v_current_date + (i || ' days')::INTERVAL;
            
            -- Vérifier si on dépasse la date de fin
            IF trip_record.recurrence_end_date IS NOT NULL AND trip_date > trip_record.recurrence_end_date THEN
                EXIT;
            END IF;
            
            -- Vérifier si instance existe déjà
            IF EXISTS (
                SELECT 1 FROM recurring_trip_instances 
                WHERE parent_trip_id = trip_record.id 
                AND instance_date = trip_date
            ) THEN
                CONTINUE;
            END IF;
            
            -- Vérifier selon type de récurrence
            CASE trip_record.recurrence_type
                WHEN 'daily' THEN
                    -- Tous les jours : créer instance
                    INSERT INTO recurring_trip_instances (parent_trip_id, instance_date, status)
                    VALUES (trip_record.id, trip_date, 'pending')
                    ON CONFLICT (parent_trip_id, instance_date) DO NOTHING;
                    
                WHEN 'weekly' THEN
                    -- Vérifier jour de la semaine
                    day_of_week := EXTRACT(DOW FROM trip_date)::INTEGER;
                    -- PostgreSQL: 0=dimanche, 1=lundi, ..., 6=samedi
                    -- Convertir en 1=lundi, 7=dimanche
                    IF day_of_week = 0 THEN
                        day_of_week := 7;
                    END IF;
                    
                    days_array := COALESCE(trip_record.recurrence_days, ARRAY[]::INTEGER[]);
                    
                    -- Si le jour est dans la liste
                    IF day_of_week = ANY(days_array) THEN
                        INSERT INTO recurring_trip_instances (parent_trip_id, instance_date, status)
                        VALUES (trip_record.id, trip_date, 'pending')
                        ON CONFLICT (parent_trip_id, instance_date) DO NOTHING;
                    END IF;
                    
                WHEN 'monthly' THEN
                    -- Même jour du mois
                    IF EXTRACT(DAY FROM trip_date) = EXTRACT(DAY FROM trip_record.date_depart) THEN
                        INSERT INTO recurring_trip_instances (parent_trip_id, instance_date, status)
                        VALUES (trip_record.id, trip_date, 'pending')
                        ON CONFLICT (parent_trip_id, instance_date) DO NOTHING;
                    END IF;
                    
                ELSE
                    -- Pattern personnalisé depuis JSONB
                    -- À implémenter selon besoins spécifiques
                    NULL;
            END CASE;
        END LOOP;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 5. Fonction pour créer un trajet depuis une instance récurrente
CREATE OR REPLACE FUNCTION create_trip_from_recurring_instance(instance_id INTEGER)
RETURNS INTEGER AS $$
DECLARE
    instance_record RECORD;
    parent_record RECORD;
    new_covoiturage_id INTEGER;
    new_service_id INTEGER;
BEGIN
    -- Récupérer l'instance
    SELECT * INTO instance_record
    FROM recurring_trip_instances
    WHERE id = instance_id AND status = 'pending';
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Instance récurrente non trouvée ou déjà traitée';
    END IF;
    
    -- Récupérer le trajet parent
    SELECT * INTO parent_record
    FROM covoiturages
    WHERE id = instance_record.parent_trip_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Trajet parent non trouvé';
    END IF;
    
    -- Créer le service (copie du service parent)
    INSERT INTO services (user_id, type, titre, description, is_active, created_at)
    SELECT 
        user_id,
        'covoiturage',
        titre || ' - ' || instance_record.instance_date::TEXT,
        description,
        TRUE,
        NOW()
    FROM services
    WHERE id = parent_record.service_id
    RETURNING id INTO new_service_id;
    
    -- Créer le trajet
    INSERT INTO covoiturages (
        service_id,
        user_id,
        depart,
        destination,
        gps_depart,
        gps_destination,
        date_depart,
        heure_depart,
        nombre_places,
        places_disponibles,
        prix_par_place,
        devise,
        statut,
        is_active,
        is_recurring,
        parent_trip_id,
        created_at
    )
    VALUES (
        new_service_id,
        parent_record.user_id,
        parent_record.depart,
        parent_record.destination,
        parent_record.gps_depart,
        parent_record.gps_destination,
        instance_record.instance_date,
        parent_record.heure_depart,
        parent_record.nombre_places,
        parent_record.nombre_places, -- Places disponibles = nombre total au départ
        parent_record.prix_par_place,
        parent_record.devise,
        'ouvert',
        TRUE,
        FALSE, -- Les instances ne sont pas récurrentes
        parent_record.id, -- Référence au parent
        NOW()
    )
    RETURNING id INTO new_covoiturage_id;
    
    -- Mettre à jour l'instance
    UPDATE recurring_trip_instances
    SET 
        instance_covoiturage_id = new_covoiturage_id,
        status = 'active',
        updated_at = NOW()
    WHERE id = instance_id;
    
    RETURN new_covoiturage_id;
END;
$$ LANGUAGE plpgsql;

-- 6. Commentaires
COMMENT ON COLUMN covoiturages.is_recurring IS 'Indique si le trajet est récurrent';
COMMENT ON COLUMN covoiturages.recurrence_type IS 'Type de récurrence: daily, weekly, monthly';
COMMENT ON COLUMN covoiturages.recurrence_days IS 'Jours de la semaine pour weekly (1=lundi, 7=dimanche)';
COMMENT ON COLUMN covoiturages.recurrence_end_date IS 'Date de fin de récurrence (NULL = sans fin)';
COMMENT ON COLUMN covoiturages.parent_trip_id IS 'ID du trajet parent pour les instances générées';
COMMENT ON COLUMN covoiturages.recurrence_pattern IS 'Pattern JSONB flexible pour récurrences complexes';
COMMENT ON TABLE recurring_trip_instances IS 'Instances de trajets récurrents à générer';
COMMENT ON FUNCTION generate_recurring_trips() IS 'Génère automatiquement les instances de trajets récurrents pour les 30 prochains jours';
COMMENT ON FUNCTION create_trip_from_recurring_instance(INTEGER) IS 'Crée un trajet réel depuis une instance récurrente';

