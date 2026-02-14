# 🔧 Corrections SQL Directes - Log 58

**Pour exécuter directement sur EC2 via psql**

## 📋 Commande Complète

Copiez-collez cette commande complète dans votre terminal sur EC2 :

```bash
PGPASSWORD="PYvHBVetTuWIKNkXgqJcFiU48D39SLwd" psql -h yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com -p 5432 -U yukpo_admin -d yukpo << 'EOFSQL'
-- ============================================================================
-- CORRECTIONS SQL - Log 58
-- Date: 2026-02-14
-- ============================================================================

-- CORRECTION 1 : Ajouter last_synced_at à live_session_analytics
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'live_session_analytics' 
        AND column_name = 'last_synced_at'
    ) THEN 
        ALTER TABLE live_session_analytics ADD COLUMN last_synced_at TIMESTAMPTZ; 
        RAISE NOTICE '✅ Colonne last_synced_at ajoutée à live_session_analytics'; 
    ELSE 
        RAISE NOTICE 'ℹ️ Colonne last_synced_at existe déjà dans live_session_analytics'; 
    END IF; 
END $$;

-- CORRECTION 2 : Ajouter highlighted à global_promo_products
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'global_promo_products' 
        AND column_name = 'highlighted'
    ) THEN 
        ALTER TABLE global_promo_products ADD COLUMN highlighted BOOLEAN DEFAULT FALSE; 
        RAISE NOTICE '✅ Colonne highlighted ajoutée à global_promo_products'; 
    ELSE 
        RAISE NOTICE 'ℹ️ Colonne highlighted existe déjà dans global_promo_products'; 
    END IF; 
END $$;

-- CORRECTION 3 : Corriger l'index avec CURRENT_DATE
DO $$ 
BEGIN 
    IF EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'idx_offres_date_limite'
    ) THEN 
        DROP INDEX IF EXISTS idx_offres_date_limite; 
        RAISE NOTICE '✅ Index idx_offres_date_limite supprimé'; 
    END IF; 
    
    CREATE INDEX IF NOT EXISTS idx_offres_date_limite 
    ON offres_emploi(date_limite_candidature, statut) 
    WHERE statut = 'active'; 
    
    RAISE NOTICE '✅ Index idx_offres_date_limite recréé sans CURRENT_DATE'; 
END $$;

-- CORRECTION 4 : Corriger la vue matérialisée hashtag_stats_materialized
DROP MATERIALIZED VIEW IF EXISTS hashtag_stats_materialized;

CREATE MATERIALIZED VIEW IF NOT EXISTS hashtag_stats_materialized AS
SELECT 
    tag,
    COUNT(DISTINCT v.id) as video_count,
    SUM(v.view_count) as total_views,
    SUM(v.like_count) as total_likes,
    SUM(v.save_count) as total_saves,
    (
        SUM(v.like_count * 2 + v.save_count * 1.5 + v.view_count * 0.1) 
        / GREATEST(EXTRACT(EPOCH FROM (NOW() - MIN(v.created_at))) / 3600, 1)
    ) as trend_score,
    MAX(v.created_at) as last_video_at
FROM videos v
CROSS JOIN LATERAL unnest(v.hashtags) tag
WHERE v.is_active = TRUE
GROUP BY tag;

-- VÉRIFICATIONS
SELECT 'live_session_analytics' as table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'live_session_analytics' 
AND column_name = 'last_synced_at';

SELECT 'global_promo_products' as table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'global_promo_products' 
AND column_name = 'highlighted';

SELECT indexname, indexdef 
FROM pg_indexes 
WHERE indexname = 'idx_offres_date_limite';

SELECT COUNT(*) as video_count 
FROM hashtag_stats_materialized;
EOFSQL
```

---

## 🔄 Alternative : Commandes Individuelles

Si vous préférez exécuter les commandes une par une, voici chaque correction séparément :

### 1. Ajouter last_synced_at

```sql
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'live_session_analytics' 
        AND column_name = 'last_synced_at'
    ) THEN 
        ALTER TABLE live_session_analytics ADD COLUMN last_synced_at TIMESTAMPTZ; 
        RAISE NOTICE '✅ Colonne last_synced_at ajoutée'; 
    ELSE 
        RAISE NOTICE 'ℹ️ Colonne last_synced_at existe déjà'; 
    END IF; 
END $$;
```

### 2. Ajouter highlighted

```sql
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'global_promo_products' 
        AND column_name = 'highlighted'
    ) THEN 
        ALTER TABLE global_promo_products ADD COLUMN highlighted BOOLEAN DEFAULT FALSE; 
        RAISE NOTICE '✅ Colonne highlighted ajoutée'; 
    ELSE 
        RAISE NOTICE 'ℹ️ Colonne highlighted existe déjà'; 
    END IF; 
END $$;
```

### 3. Corriger l'index

```sql
DO $$ 
BEGIN 
    IF EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'idx_offres_date_limite'
    ) THEN 
        DROP INDEX IF EXISTS idx_offres_date_limite; 
        RAISE NOTICE '✅ Index supprimé'; 
    END IF; 
    
    CREATE INDEX IF NOT EXISTS idx_offres_date_limite 
    ON offres_emploi(date_limite_candidature, statut) 
    WHERE statut = 'active'; 
    
    RAISE NOTICE '✅ Index recréé sans CURRENT_DATE'; 
END $$;
```

### 4. Corriger la vue matérialisée

```sql
DROP MATERIALIZED VIEW IF EXISTS hashtag_stats_materialized;

CREATE MATERIALIZED VIEW IF NOT EXISTS hashtag_stats_materialized AS
SELECT 
    tag,
    COUNT(DISTINCT v.id) as video_count,
    SUM(v.view_count) as total_views,
    SUM(v.like_count) as total_likes,
    SUM(v.save_count) as total_saves,
    (
        SUM(v.like_count * 2 + v.save_count * 1.5 + v.view_count * 0.1) 
        / GREATEST(EXTRACT(EPOCH FROM (NOW() - MIN(v.created_at))) / 3600, 1)
    ) as trend_score,
    MAX(v.created_at) as last_video_at
FROM videos v
CROSS JOIN LATERAL unnest(v.hashtags) tag
WHERE v.is_active = TRUE
GROUP BY tag;
```

---

## ✅ Résultat Attendu

Après exécution, vous devriez voir :
- ✅ Messages de confirmation pour chaque correction
- ✅ Résultats des vérifications montrant les colonnes/index créés

