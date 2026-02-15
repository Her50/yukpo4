# 🔧 Correction Colonnes Manquantes - Log 54

## Erreurs Identifiées

1. ❌ `column e.status does not exist` → `global_promo_events.status` manquant
2. ❌ `column "attempt" does not exist` → `social_publication_jobs.attempt` manquant
3. ⚠️ Redis timeout toujours à 3s (nouveau build pas encore déployé)

## Commande SQL à Exécuter sur EC2

```bash
PGPASSWORD="PYvHBVetTuWIKNkXgqJcFiU48D39SLwd" psql -h yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com -p 5432 -U yukpo_admin -d yukpo << 'EOFSQL'
-- 1. Ajouter status à global_promo_events
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'global_promo_events' AND column_name = 'status'
    ) THEN
        ALTER TABLE global_promo_events
        ADD COLUMN status VARCHAR(32) NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'scheduled', 'live', 'archived'));
        RAISE NOTICE '✅ status ajouté';
    END IF;
END $$;

-- 2. Ajouter attempt à social_publication_jobs
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'social_publication_jobs' AND column_name = 'attempt'
    ) THEN
        ALTER TABLE social_publication_jobs
        ADD COLUMN attempt INTEGER NOT NULL DEFAULT 0;
        RAISE NOTICE '✅ attempt ajouté';
    END IF;
END $$;

-- Vérification
SELECT 
    'global_promo_events.status' as colonne,
    EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'global_promo_events' AND column_name = 'status'
    ) as existe
UNION ALL
SELECT 
    'social_publication_jobs.attempt' as colonne,
    EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'social_publication_jobs' AND column_name = 'attempt'
    ) as existe;
EOFSQL
```

## Note sur Redis

Le timeout Redis est toujours à 3s dans les logs car le nouveau build (avec timeout 10s) n'a pas encore été déployé. Il faut attendre que le service ECS redémarre avec le nouveau code commité.


