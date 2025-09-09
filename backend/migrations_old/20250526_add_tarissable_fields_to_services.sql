-- Migration : Ajout des champs pour gérer les services tarissables et spécifiques
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'services' AND column_name = 'is_tarissable') THEN
        ALTER TABLE services ADD COLUMN is_tarissable BOOLEAN;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'services' AND column_name = 'vitesse_tarissement') THEN
        ALTER TABLE services ADD COLUMN vitesse_tarissement VARCHAR(255);
    END IF;
END $$;