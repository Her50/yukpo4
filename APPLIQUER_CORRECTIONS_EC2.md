# 🔧 Appliquer les Corrections de Migrations sur EC2

**Date**: 2026-02-13  
**Problème**: L'instance EC2 n'a pas les permissions pour Secrets Manager

---

## ✅ **SOLUTION: Appliquer le Script Directement**

Puisque vous avez déjà appliqué les migrations directement avec `psql` précédemment, vous pouvez appliquer le script de correction de la même manière.

---

## 📋 **ÉTAPES**

### 1. Cloner le Repo (si pas déjà fait)

```bash
cd /tmp
rm -rf yukpomnang2
git clone https://github.com/Her50/yukpo4.git yukpomnang2
cd yukpomnang2
```

### 2. Récupérer le DATABASE_URL (Méthode Alternative)

**Option A**: Si vous avez déjà le DATABASE_URL en mémoire, utilisez-le directement :

```bash
export DATABASE_URL="postgresql://user:password@host:5432/database"
```

**Option B**: Utiliser le DATABASE_URL depuis les variables d'environnement ECS (si accessible)

**Option C**: Créer le script de correction directement dans un fichier temporaire

### 3. Appliquer le Script de Correction

**Option A**: Si le script existe dans le repo cloné :

```bash
cd /tmp/yukpomnang2
psql "$DATABASE_URL" -f scripts/fix_migration_errors_from_logs.sql
```

**Option B**: Créer le script directement sur EC2 :

```bash
cat > /tmp/fix_migrations.sql << 'EOF'
-- DROP la fonction record_publicite_impression
DROP FUNCTION IF EXISTS record_publicite_impression(INTEGER, INTEGER, VARCHAR(50));
DROP FUNCTION IF EXISTS record_publicite_impression(INTEGER, INTEGER, VARCHAR(50), VARCHAR(50));
DROP FUNCTION IF EXISTS record_publicite_impression(INTEGER, INTEGER);

-- Créer la table delivery_proximity_suggestions
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'delivery_proximity_suggestions'
    ) THEN
        CREATE TABLE delivery_proximity_suggestions (
            id SERIAL PRIMARY KEY,
            delivery_id INTEGER NOT NULL,
            suggested_courier_id INTEGER,
            proximity_score DOUBLE PRECISION,
            status VARCHAR(50) NOT NULL DEFAULT 'pending',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_delivery_proximity_suggestions_delivery 
            ON delivery_proximity_suggestions(delivery_id);
        
        CREATE INDEX IF NOT EXISTS idx_delivery_proximity_suggestions_status_created 
            ON delivery_proximity_suggestions(status, created_at);

        RAISE NOTICE '✅ Table delivery_proximity_suggestions créée';
    END IF;
END $$;

-- Recréer la fonction record_publicite_impression
CREATE OR REPLACE FUNCTION record_publicite_impression(
    p_publicite_id INTEGER,
    p_user_id INTEGER,
    p_placement VARCHAR(50) DEFAULT 'feed'
) RETURNS INTEGER AS $$
DECLARE
    v_impression_id INTEGER;
BEGIN
    INSERT INTO publicite_impressions (publicite_id, user_id, placement)
    VALUES (p_publicite_id, p_user_id, p_placement)
    RETURNING id INTO v_impression_id;
    
    RETURN v_impression_id;
END;
$$ LANGUAGE plpgsql;
EOF

# Puis appliquer
psql "$DATABASE_URL" -f /tmp/fix_migrations.sql
```

---

## 🔍 **VÉRIFICATION**

Après avoir appliqué le script, vérifiez que tout est correct :

```bash
# Vérifier que la table existe
psql "$DATABASE_URL" -c "
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_name = 'delivery_proximity_suggestions';
"

# Vérifier que la fonction existe avec la bonne signature
psql "$DATABASE_URL" -c "
    SELECT proname, pg_get_function_identity_arguments(oid) as args, prorettype::regtype as return_type
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
    AND p.proname = 'record_publicite_impression';
"
```

---

## 🚀 **PROCHAINES ÉTAPES**

Une fois les corrections appliquées :

1. **Redémarrer le service ECS** (depuis votre machine locale ou AWS Console)
2. **Vérifier les logs** pour confirmer que l'application démarre correctement
3. **Vérifier que les health checks réussissent**

---

**Note**: Si vous n'avez pas le `DATABASE_URL`, vous pouvez le récupérer depuis AWS Console → Secrets Manager → `yukpo/backend/secrets` → Copier la valeur de `DATABASE_URL`.

