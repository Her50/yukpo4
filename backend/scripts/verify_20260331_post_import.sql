DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'agency_departure_schedules'
          AND column_name = 'bus_model_id'
    ) THEN
        RAISE EXCEPTION 'Missing column agency_departure_schedules.bus_model_id';
    END IF;
END
$$;
