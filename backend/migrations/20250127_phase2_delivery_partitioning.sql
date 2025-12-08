-- ============================================================================
-- Phase 2: Partitionnement et Optimisations Avancées
-- Date: 2025-01-27
-- Objectif: Scalabilité long terme pour millions de livraisons
-- ============================================================================

-- ============================================================================
-- 1. PARTITIONNEMENT TABLE deliveries PAR MOIS
-- ============================================================================

-- Créer la table parent si elle n'est pas déjà partitionnée
-- NOTE: ALTER TABLE ... PARTITION BY ne peut pas être utilisé sur une table existante avec des données
-- Cette migration est désactivée pour éviter les erreurs. Le partitionnement doit être fait manuellement
-- ou lors de la création initiale de la table.
DO $$
BEGIN
    -- Vérifier si deliveries est déjà partitionnée
    IF NOT EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relname = 'deliveries' 
        AND c.relkind = 'p'
    ) THEN
        -- Ne pas essayer de convertir une table existante en partitionnée
        -- Cela nécessite une migration complexe avec création d'une nouvelle table
        RAISE NOTICE 'Table deliveries existe déjà - partitionnement désactivé (nécessite migration manuelle)';
    ELSE
        RAISE NOTICE 'Table deliveries déjà partitionnée';
    END IF;
END $$;

-- Créer les partitions pour les 12 prochains mois
-- ⚠️ IMPORTANT: Ne créer des partitions que si la table deliveries est déjà partitionnée
DO $$
DECLARE
    start_date DATE;
    end_date DATE;
    partition_name TEXT;
    i INTEGER;
    is_partitioned BOOLEAN;
BEGIN
    -- Vérifier si deliveries est partitionnée
    SELECT EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relname = 'deliveries' 
        AND c.relkind = 'p'
    ) INTO is_partitioned;
    
    -- Ne créer des partitions que si la table est partitionnée
    IF NOT is_partitioned THEN
        RAISE NOTICE 'Table deliveries n''est pas partitionnée - création de partitions ignorée';
        RETURN;
    END IF;
    
    start_date := DATE_TRUNC('month', CURRENT_DATE);
    
    FOR i IN 0..11 LOOP
        end_date := start_date + INTERVAL '1 month';
        partition_name := 'deliveries_' || TO_CHAR(start_date, 'YYYY_MM');
        
        -- Créer la partition si elle n'existe pas
        BEGIN
            EXECUTE format('
                CREATE TABLE IF NOT EXISTS %I PARTITION OF deliveries
                FOR VALUES FROM (%L) TO (%L)',
                partition_name,
                start_date,
                end_date
            );
            RAISE NOTICE 'Partition créée: %', partition_name;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Erreur lors de la création de la partition %: %', partition_name, SQLERRM;
        END;
        
        start_date := end_date;
    END LOOP;
END $$;

-- ============================================================================
-- 2. PARTITIONNEMENT TABLE delivery_tracking_points PAR HASH
-- ============================================================================

-- Créer la table parent si elle n'est pas déjà partitionnée
-- ⚠️ IMPORTANT: ALTER TABLE ... PARTITION BY ne peut pas être utilisé sur une table existante avec des données
-- Cette opération nécessite une migration complexe avec création d'une nouvelle table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relname = 'delivery_tracking_points' 
        AND c.relkind = 'p'
    ) THEN
        -- Vérifier si la table existe et contient des données
        IF EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_name = 'delivery_tracking_points'
        ) THEN
            -- La table existe déjà, on ne peut pas la convertir en partitionnée
            -- Cette opération nécessite une migration manuelle complexe
            RAISE NOTICE 'Table delivery_tracking_points existe déjà - partitionnement désactivé (nécessite migration manuelle)';
        ELSE
            -- La table n'existe pas, on peut la créer comme partitionnée
            RAISE NOTICE 'Table delivery_tracking_points n''existe pas - création comme table partitionnée ignorée (créée ailleurs)';
        END IF;
    ELSE
        RAISE NOTICE 'Table delivery_tracking_points déjà partitionnée';
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Erreur lors de la vérification de delivery_tracking_points: %', SQLERRM;
END $$;

-- Créer 10 partitions par hash
DO $$
DECLARE
    i INTEGER;
    partition_name TEXT;
BEGIN
    FOR i IN 0..9 LOOP
        partition_name := 'delivery_tracking_points_' || i;
        
        EXECUTE format('
            CREATE TABLE IF NOT EXISTS %I PARTITION OF delivery_tracking_points
            FOR VALUES WITH (MODULUS 10, REMAINDER %s)',
            partition_name,
            i
        );
        
        RAISE NOTICE 'Partition créée: %', partition_name;
    END LOOP;
END $$;

-- ============================================================================
-- 3. PARTITIONNEMENT TABLE delivery_status_events PAR MOIS
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relname = 'delivery_status_events' 
        AND c.relkind = 'p'
    ) THEN
        -- Vérifier si la table existe et contient des données
        IF EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_name = 'delivery_status_events'
        ) THEN
            -- La table existe déjà, on ne peut pas la convertir en partitionnée
            RAISE NOTICE 'Table delivery_status_events existe déjà - partitionnement désactivé (nécessite migration manuelle)';
        ELSE
            RAISE NOTICE 'Table delivery_status_events n''existe pas - création comme table partitionnée ignorée (créée ailleurs)';
        END IF;
    ELSE
        RAISE NOTICE 'Table delivery_status_events déjà partitionnée';
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Erreur lors de la vérification de delivery_status_events: %', SQLERRM;
END $$;

-- Créer les partitions pour les 6 prochains mois
DO $$
DECLARE
    start_date DATE;
    end_date DATE;
    partition_name TEXT;
    i INTEGER;
BEGIN
    start_date := DATE_TRUNC('month', CURRENT_DATE);
    
    FOR i IN 0..5 LOOP
        end_date := start_date + INTERVAL '1 month';
        partition_name := 'delivery_status_events_' || TO_CHAR(start_date, 'YYYY_MM');
        
        EXECUTE format('
            CREATE TABLE IF NOT EXISTS %I PARTITION OF delivery_status_events
            FOR VALUES FROM (%L) TO (%L)',
            partition_name,
            start_date,
            end_date
        );
        
        RAISE NOTICE 'Partition créée: %', partition_name;
        
        start_date := end_date;
    END LOOP;
END $$;

-- ============================================================================
-- 4. TABLE D'ARCHIVE POUR LIVRAISONS COMPLÉTÉES
-- ============================================================================

CREATE TABLE IF NOT EXISTS deliveries_archive (
    LIKE deliveries INCLUDING ALL
);

-- Index pour l'archive
CREATE INDEX IF NOT EXISTS idx_deliveries_archive_creator_date
ON deliveries_archive (creator_id, completed_at DESC)
WHERE completed_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_deliveries_archive_completed_at
ON deliveries_archive (completed_at DESC)
WHERE completed_at IS NOT NULL;

-- ============================================================================
-- 5. FONCTION D'ARCHIVAGE AUTOMATIQUE
-- ============================================================================

CREATE OR REPLACE FUNCTION archive_old_deliveries()
RETURNS TABLE (
    archived_count BIGINT,
    deleted_count BIGINT
) 
LANGUAGE plpgsql
AS $$
DECLARE
    v_archived BIGINT;
    v_deleted BIGINT;
BEGIN
    -- Archiver les livraisons complétées depuis plus de 90 jours
    WITH archived AS (
        INSERT INTO deliveries_archive
        SELECT * FROM deliveries
        WHERE status = 'completed'
          AND completed_at IS NOT NULL
          AND completed_at < NOW() - INTERVAL '90 days'
        RETURNING id
    )
    SELECT COUNT(*) INTO v_archived FROM archived;
    
    -- Supprimer les livraisons archivées
    WITH deleted AS (
        DELETE FROM deliveries
        WHERE status = 'completed'
          AND completed_at IS NOT NULL
          AND completed_at < NOW() - INTERVAL '90 days'
        RETURNING id
    )
    SELECT COUNT(*) INTO v_deleted FROM deleted;
    
    RETURN QUERY SELECT v_archived, v_deleted;
END;
$$;

COMMENT ON FUNCTION archive_old_deliveries IS 
'Archive automatiquement les livraisons complétées depuis plus de 90 jours.
Retourne le nombre de livraisons archivées et supprimées.';

-- ============================================================================
-- 6. FONCTION POUR CRÉER PARTITIONS FUTURES (À APPELER MENSUELLEMENT)
-- ============================================================================

CREATE OR REPLACE FUNCTION create_future_delivery_partitions()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    start_date DATE;
    end_date DATE;
    partition_name TEXT;
    max_partition_date DATE;
BEGIN
    -- Trouver la date de la dernière partition
    SELECT MAX(upper_bound::date) INTO max_partition_date
    FROM (
        SELECT 
            pg_get_expr(relpartbound, oid) AS partition_expr
        FROM pg_class
        WHERE relname LIKE 'deliveries_%'
          AND relkind = 'r'
    ) sub,
    LATERAL (
        SELECT 
            (regexp_match(partition_expr, 'TO \(''([^'']+)'''))[1]::date AS upper_bound
    ) bounds;
    
    -- Si aucune partition, commencer à partir d'aujourd'hui
    IF max_partition_date IS NULL THEN
        max_partition_date := DATE_TRUNC('month', CURRENT_DATE);
    END IF;
    
    -- Créer les partitions manquantes (jusqu'à 3 mois à l'avance)
    start_date := max_partition_date;
    
    WHILE start_date < CURRENT_DATE + INTERVAL '3 months' LOOP
        end_date := start_date + INTERVAL '1 month';
        partition_name := 'deliveries_' || TO_CHAR(start_date, 'YYYY_MM');
        
        BEGIN
            EXECUTE format('
                CREATE TABLE IF NOT EXISTS %I PARTITION OF deliveries
                FOR VALUES FROM (%L) TO (%L)',
                partition_name,
                start_date,
                end_date
            );
            
            RAISE NOTICE 'Partition créée: %', partition_name;
        EXCEPTION
            WHEN duplicate_table THEN
                RAISE NOTICE 'Partition existe déjà: %', partition_name;
        END;
        
        start_date := end_date;
    END LOOP;
END;
$$;

COMMENT ON FUNCTION create_future_delivery_partitions IS 
'Crée automatiquement les partitions futures pour la table deliveries.
À appeler mensuellement via cron ou scheduler.';

-- ============================================================================
-- FIN DE LA MIGRATION PHASE 2 - PARTITIONNEMENT
-- ============================================================================

