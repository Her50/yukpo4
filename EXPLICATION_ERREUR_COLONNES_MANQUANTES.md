# 🔍 Explication de l'Erreur Persistante des Colonnes Manquantes

## ❌ **Le Problème**

Vous avez raison d'être confus ! Voici ce qui s'est passé :

### 1. **Incohérence entre les Migrations**

Il existe **deux migrations différentes** qui créent la table `global_promo_events` avec des **noms de colonnes différents** :

#### Migration 00000016 (ancienne) :
```sql
CREATE TABLE IF NOT EXISTS global_promo_events (
    ...
    start_date TIMESTAMPTZ NOT NULL,  -- ❌ Utilise start_date
    end_date TIMESTAMPTZ NOT NULL,     -- ❌ Utilise end_date
    ...
);
```

#### Migration 0000_create_all_tables.sql (récente) :
```sql
CREATE TABLE IF NOT EXISTS global_promo_events (
    ...
    starts_at TIMESTAMPTZ NOT NULL,    -- ✅ Utilise starts_at
    ends_at TIMESTAMPTZ NOT NULL,      -- ✅ Utilise ends_at
    ...
);
```

### 2. **Ce qui s'est passé lors de l'exécution sur EC2**

1. La migration `00000016_create_promotion_tables.sql` a été exécutée **en premier**
2. Elle a créé `global_promo_events` avec `start_date` et `end_date`
3. Ensuite, `0000_create_all_tables.sql` a été exécutée
4. Mais comme la table existait déjà, `CREATE TABLE IF NOT EXISTS` n'a **rien fait**
5. La table est restée avec `start_date` au lieu de `starts_at`

### 3. **Le Code Rust utilise `starts_at`**

Le code Rust dans `auto_migrate.rs` et les services utilisent `starts_at` :
```rust
WHERE status = 'scheduled' AND starts_at <= $1  // ❌ Erreur car la colonne s'appelle start_date
```

### 4. **Même problème pour les autres colonnes**

- `live_flash_sales.ending_notification_sent_at` : peut-être créée dans une migration mais pas dans une autre
- `social_publication_jobs.platform` : même problème

---

## ✅ **Solution : Renommer les Colonnes**

Il faut **renommer** les colonnes dans la base pour correspondre au schéma attendu par le code Rust.

---

## 📋 **Commande de Correction Complète**

```bash
PGPASSWORD="PYvHBVetTuWIKNkXgqJcFiU48D39SLwd" psql -h yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com -p 5432 -U yukpo_admin -d yukpo << 'EOFSQL'
-- 1. Renommer start_date → starts_at dans global_promo_events
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'global_promo_events'
        AND column_name = 'start_date'
    ) THEN
        ALTER TABLE global_promo_events
        RENAME COLUMN start_date TO starts_at;
        RAISE NOTICE '✅ Colonne start_date renommée en starts_at';
    ELSIF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'global_promo_events'
        AND column_name = 'starts_at'
    ) THEN
        RAISE NOTICE 'ℹ️ Colonne starts_at existe déjà';
    ELSE
        -- Créer starts_at si aucune des deux n'existe
        ALTER TABLE global_promo_events
        ADD COLUMN starts_at TIMESTAMPTZ;
        RAISE NOTICE '✅ Colonne starts_at créée';
    END IF;
END $$;

-- 2. Renommer end_date → ends_at dans global_promo_events
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'global_promo_events'
        AND column_name = 'end_date'
    ) THEN
        ALTER TABLE global_promo_events
        RENAME COLUMN end_date TO ends_at;
        RAISE NOTICE '✅ Colonne end_date renommée en ends_at';
    ELSIF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'global_promo_events'
        AND column_name = 'ends_at'
    ) THEN
        RAISE NOTICE 'ℹ️ Colonne ends_at existe déjà';
    ELSE
        ALTER TABLE global_promo_events
        ADD COLUMN ends_at TIMESTAMPTZ;
        RAISE NOTICE '✅ Colonne ends_at créée';
    END IF;
END $$;

-- 3. Ajouter ending_notification_sent_at à live_flash_sales
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'live_flash_sales'
        AND column_name = 'ending_notification_sent_at'
    ) THEN
        ALTER TABLE live_flash_sales
        ADD COLUMN ending_notification_sent_at TIMESTAMPTZ;
        RAISE NOTICE '✅ Colonne ending_notification_sent_at ajoutée à live_flash_sales';
    ELSE
        RAISE NOTICE 'ℹ️ Colonne ending_notification_sent_at existe déjà';
    END IF;
END $$;

-- 4. Ajouter platform à social_publication_jobs
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'social_publication_jobs'
        AND column_name = 'platform'
    ) THEN
        ALTER TABLE social_publication_jobs
        ADD COLUMN platform TEXT NOT NULL DEFAULT 'unknown';
        RAISE NOTICE '✅ Colonne platform ajoutée à social_publication_jobs';
    ELSE
        RAISE NOTICE 'ℹ️ Colonne platform existe déjà';
    END IF;
END $$;

-- Vérification finale
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

## 🎯 **Pourquoi ça n'a pas été détecté avant ?**

Les migrations utilisent `CREATE TABLE IF NOT EXISTS`, donc :
- Si la table existe déjà, elle n'est **pas modifiée**
- Les colonnes manquantes ne sont **pas ajoutées automatiquement**
- Il faut utiliser `ALTER TABLE ADD COLUMN IF NOT EXISTS` pour ajouter des colonnes

---

## ✅ **Solution Long Terme**

1. **Unifier les migrations** : Supprimer les doublons et garder un seul schéma
2. **Utiliser `ALTER TABLE`** au lieu de `CREATE TABLE IF NOT EXISTS` pour les colonnes
3. **Vérifier la cohérence** : Script de vérification après chaque migration



