# 🚀 Commande Simple - Alignement Tables EC2

## Commande à Copier-Coller (Version Simplifiée)

```bash
PGPASSWORD="PYvHBVetTuWIKNkXgqJcFiU48D39SLwd" psql -h yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com -p 5432 -U yukpo_admin -d yukpo << 'EOFSQL'
-- 1. global_promo_events : Ajouter slug
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'global_promo_events' AND column_name = 'slug') THEN ALTER TABLE global_promo_events ADD COLUMN slug TEXT; UPDATE global_promo_events SET slug = 'event-' || id::text WHERE slug IS NULL; ALTER TABLE global_promo_events ALTER COLUMN slug SET NOT NULL; CREATE UNIQUE INDEX IF NOT EXISTS idx_global_promo_events_slug_unique ON global_promo_events(slug); RAISE NOTICE 'slug ajoute'; END IF; END $$;

-- 2. global_promo_events : Ajouter theme
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'global_promo_events' AND column_name = 'theme') THEN ALTER TABLE global_promo_events ADD COLUMN theme TEXT NOT NULL DEFAULT 'general'; RAISE NOTICE 'theme ajoute'; END IF; END $$;

-- 3. global_promo_events : Ajouter display_name
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'global_promo_events' AND column_name = 'display_name') THEN ALTER TABLE global_promo_events ADD COLUMN display_name TEXT NOT NULL DEFAULT 'Event'; RAISE NOTICE 'display_name ajoute'; END IF; END $$;

-- 4. global_promo_events : Ajouter status
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'global_promo_events' AND column_name = 'status') THEN ALTER TABLE global_promo_events ADD COLUMN status VARCHAR(32) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'live', 'archived')); RAISE NOTICE 'status ajoute'; END IF; END $$;

-- 5. global_promo_events : Ajouter recurrence_rule
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'global_promo_events' AND column_name = 'recurrence_rule') THEN ALTER TABLE global_promo_events ADD COLUMN recurrence_rule TEXT; RAISE NOTICE 'recurrence_rule ajoute'; END IF; END $$;

-- 6. global_promo_events : Ajouter config
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'global_promo_events' AND column_name = 'config') THEN ALTER TABLE global_promo_events ADD COLUMN config JSONB NOT NULL DEFAULT '{}'::JSONB; RAISE NOTICE 'config ajoute'; END IF; END $$;

-- 7. global_promo_events : Ajouter created_by_user_id
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'global_promo_events' AND column_name = 'created_by_user_id') THEN ALTER TABLE global_promo_events ADD COLUMN created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL; RAISE NOTICE 'created_by_user_id ajoute'; END IF; END $$;

-- 8. social_publication_jobs : Ajouter attempt
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'social_publication_jobs' AND column_name = 'attempt') THEN ALTER TABLE social_publication_jobs ADD COLUMN attempt INTEGER NOT NULL DEFAULT 0; RAISE NOTICE 'attempt ajoute'; END IF; END $$;

-- Verification
SELECT 'global_promo_events' as table_name, column_name FROM information_schema.columns WHERE table_name = 'global_promo_events' AND column_name IN ('slug', 'theme', 'display_name', 'status', 'recurrence_rule', 'config', 'created_by_user_id') ORDER BY column_name;
SELECT 'social_publication_jobs' as table_name, column_name FROM information_schema.columns WHERE table_name = 'social_publication_jobs' AND column_name = 'attempt';
EOFSQL
```

