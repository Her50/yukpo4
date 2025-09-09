-- Migration : Ajout d'améliorations à la table `media`

-- 1. Ajout d'une colonne `media_type` si elle n'existe pas
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'media' AND column_name = 'media_type') THEN
        ALTER TABLE media ADD COLUMN media_type TEXT;
    END IF;
END $$;

-- 2. Ajout d'une contrainte pour limiter les valeurs possibles de `type`
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints
        WHERE constraint_name = 'media_type_check'
    ) THEN
        ALTER TABLE media
        ADD CONSTRAINT media_type_check CHECK (media_type IN ('image', 'video', 'audio'));
    END IF;
END $$;

-- 3. Ajout de colonnes pour les métadonnées
-- Vérification conditionnelle pour ajouter les colonnes `file_size` et `file_format`
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'media' AND column_name = 'file_size') THEN
        ALTER TABLE media ADD COLUMN file_size BIGINT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'media' AND column_name = 'file_format') THEN
        ALTER TABLE media ADD COLUMN file_format TEXT;
    END IF;
END $$;

-- 4. Ajout d'un index sur `service_id` pour améliorer les performances
-- Vérification conditionnelle pour ajouter l'index `idx_media_service_id`
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relname = 'idx_media_service_id' AND n.nspname = 'public'
    ) THEN
        CREATE INDEX idx_media_service_id ON media (service_id);
    END IF;
END $$;