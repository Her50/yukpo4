# 🔧 Commande SQL Directe pour EC2

## ✅ **Si la connexion PostgreSQL échoue depuis Windows**

Exécutez cette commande directement depuis EC2 (via SSM) :

```bash
PGPASSWORD="PYvHBVetTuWIKNkXgqJcFiU48D39SLwd" psql -h yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com -p 5432 -U yukpo_admin -d yukpo << 'EOFSQL'
-- 1. Renommer start_date → starts_at
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'global_promo_events' AND column_name = 'start_date') THEN
        ALTER TABLE global_promo_events RENAME COLUMN start_date TO starts_at;
        RAISE NOTICE 'start_date renomme en starts_at';
    END IF;
END $$;

-- 2. Renommer end_date → ends_at
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'global_promo_events' AND column_name = 'end_date') THEN
        ALTER TABLE global_promo_events RENAME COLUMN end_date TO ends_at;
        RAISE NOTICE 'end_date renomme en ends_at';
    END IF;
END $$;

-- 3. Ajouter ending_notification_sent_at
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'live_flash_sales' AND column_name = 'ending_notification_sent_at') THEN
        ALTER TABLE live_flash_sales ADD COLUMN ending_notification_sent_at TIMESTAMPTZ;
        RAISE NOTICE 'ending_notification_sent_at ajoute';
    END IF;
END $$;

-- 4. Ajouter platform
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'social_publication_jobs' AND column_name = 'platform') THEN
        ALTER TABLE social_publication_jobs ADD COLUMN platform TEXT NOT NULL DEFAULT 'unknown';
        RAISE NOTICE 'platform ajoute';
    END IF;
END $$;

-- Vérification
SELECT 
    'global_promo_events.starts_at' as colonne,
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'global_promo_events' AND column_name = 'starts_at') as existe
UNION ALL 
SELECT 'global_promo_events.ends_at', EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'global_promo_events' AND column_name = 'ends_at')
UNION ALL 
SELECT 'live_flash_sales.ending_notification_sent_at', EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'live_flash_sales' AND column_name = 'ending_notification_sent_at')
UNION ALL 
SELECT 'social_publication_jobs.platform', EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'social_publication_jobs' AND column_name = 'platform');
EOFSQL
```

---

## ✅ **Pour vérifier le statut Redis**

```bash
# Vérifier le statut du cluster
aws elasticache describe-replication-groups \
  --replication-group-id yukpo-redis \
  --region eu-west-1 \
  --query 'ReplicationGroups[0].[Status,PrimaryEndpoint.Address]' \
  --output table
```

Si le statut est `creating` ou `modifying`, attendez quelques minutes puis réessayez.



