-- Migration de correction pour user_push_tokens
-- Date: 2025-12-01
-- Problème: Incohérence entre migrations (20250126002 vs 20251017002)
-- Solution: Aligner le schéma sur celui attendu par le code Rust

DO $$
BEGIN
    -- Vérifier si la table existe
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'user_push_tokens') THEN
        -- Vérifier si la colonne 'platform' existe (ancien schéma)
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'user_push_tokens' AND column_name = 'platform'
        ) THEN
            RAISE NOTICE 'Migration: Ancien schéma détecté (platform), conversion en cours...';
            
            -- Renommer platform en device_type
            ALTER TABLE user_push_tokens RENAME COLUMN platform TO device_type;
            RAISE NOTICE 'Colonne platform renommée en device_type';
        END IF;
        
        -- Vérifier si device_id n'existe pas et l'ajouter
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'user_push_tokens' AND column_name = 'device_id'
        ) THEN
            ALTER TABLE user_push_tokens ADD COLUMN device_id VARCHAR(255);
            RAISE NOTICE 'Colonne device_id ajoutée';
        END IF;
        
        -- Vérifier si last_used_at n'existe pas et l'ajouter
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'user_push_tokens' AND column_name = 'last_used_at'
        ) THEN
            ALTER TABLE user_push_tokens 
            ADD COLUMN last_used_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
            RAISE NOTICE 'Colonne last_used_at ajoutée';
        END IF;
        
        -- Vérifier si id est TEXT et le convertir en SERIAL
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'user_push_tokens' 
            AND column_name = 'id' 
            AND data_type = 'text'
        ) THEN
            RAISE NOTICE 'Migration: Conversion id TEXT vers SERIAL...';
            
            -- Créer une nouvelle table avec le bon schéma
            CREATE TABLE IF NOT EXISTS user_push_tokens_new (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                push_token VARCHAR(500) NOT NULL UNIQUE,
                device_type VARCHAR(20) NOT NULL,
                device_id VARCHAR(255),
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                last_used_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
            
            -- Migrer les données (si possible, en générant de nouveaux IDs)
            INSERT INTO user_push_tokens_new (user_id, push_token, device_type, device_id, is_active, created_at, updated_at, last_used_at)
            SELECT 
                user_id,
                push_token,
                COALESCE(device_type, 'unknown') as device_type,
                device_id,
                COALESCE(is_active, TRUE) as is_active,
                COALESCE(created_at, CURRENT_TIMESTAMP) as created_at,
                COALESCE(updated_at, CURRENT_TIMESTAMP) as updated_at,
                COALESCE(last_used_at, CURRENT_TIMESTAMP) as last_used_at
            FROM user_push_tokens
            ON CONFLICT (push_token) DO NOTHING;
            
            -- Remplacer l'ancienne table
            DROP TABLE user_push_tokens CASCADE;
            ALTER TABLE user_push_tokens_new RENAME TO user_push_tokens;
            
            -- Recréer les index
            CREATE INDEX IF NOT EXISTS idx_user_push_tokens_user_id ON user_push_tokens(user_id);
            CREATE INDEX IF NOT EXISTS idx_user_push_tokens_push_token ON user_push_tokens(push_token);
            CREATE INDEX IF NOT EXISTS idx_user_push_tokens_is_active ON user_push_tokens(is_active);
            CREATE INDEX IF NOT EXISTS idx_user_push_tokens_device ON user_push_tokens(device_id);
            
            RAISE NOTICE 'Table user_push_tokens migrée avec succès (id TEXT -> SERIAL)';
        ELSE
            -- Vérifier que id est bien INTEGER/SERIAL
            IF EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'user_push_tokens' 
                AND column_name = 'id' 
                AND data_type IN ('integer', 'bigint')
            ) THEN
                RAISE NOTICE 'Schéma id correct (INTEGER/SERIAL)';
            END IF;
        END IF;
        
        -- Vérifier que device_type existe et est correct
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'user_push_tokens' AND column_name = 'device_type'
        ) THEN
            RAISE EXCEPTION 'Colonne device_type manquante après migration';
        END IF;
        
        RAISE NOTICE '✅ Migration user_push_tokens terminée avec succès';
    ELSE
        -- Créer la table si elle n'existe pas
        CREATE TABLE user_push_tokens (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            push_token VARCHAR(500) NOT NULL UNIQUE,
            device_type VARCHAR(20) NOT NULL,
            device_id VARCHAR(255),
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            last_used_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE INDEX idx_user_push_tokens_user_id ON user_push_tokens(user_id);
        CREATE INDEX idx_user_push_tokens_push_token ON user_push_tokens(push_token);
        CREATE INDEX idx_user_push_tokens_is_active ON user_push_tokens(is_active);
        CREATE INDEX idx_user_push_tokens_device ON user_push_tokens(device_id);
        
        RAISE NOTICE 'Table user_push_tokens créée avec le bon schéma';
    END IF;
END $$;

-- Recréer le trigger pour updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_user_push_tokens_updated_at') THEN
        CREATE TRIGGER update_user_push_tokens_updated_at 
            BEFORE UPDATE ON user_push_tokens 
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        RAISE NOTICE 'Trigger update_user_push_tokens_updated_at créé';
    END IF;
END $$;

