# 🔧 Commandes Complètes pour Appliquer les Corrections sur EC2

**Date**: 2026-02-13  
**Problème**: `$DATABASE_URL` n'est pas défini dans la session

---

## ⚠️ **PROBLÈME IDENTIFIÉ**

La variable `$DATABASE_URL` n'est pas définie dans votre session EC2. Vous devez la définir avant d'utiliser `psql`.

---

## ✅ **SOLUTION: Définir DATABASE_URL puis Appliquer les Corrections**

### **Étape 1: Définir DATABASE_URL**

**Option A**: Si vous avez la valeur en mémoire, utilisez-la directement :

```bash
export DATABASE_URL="postgresql://yukpo_admin:VOTRE_PASSWORD@yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com:5432/yukpo"
```

**Option B**: Récupérer depuis AWS Console (recommandé) :
1. Allez dans **AWS Console** → **Secrets Manager**
2. Sélectionnez `yukpo/backend/secrets`
3. Cliquez sur **"Retrieve secret value"**
4. Copiez la valeur de `DATABASE_URL`
5. Collez-la dans la commande :

```bash
export DATABASE_URL="postgresql://..."
```

**Option C**: Si vous avez utilisé cette valeur précédemment, elle devrait être similaire à :
```bash
export DATABASE_URL="postgresql://yukpo_admin:XXXXX@yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com:5432/yukpo"
```

---

### **Étape 2: Vérifier que DATABASE_URL est défini**

```bash
echo "$DATABASE_URL" | head -c 50
# Devrait afficher: postgresql://yukpo_admin:...
```

---

### **Étape 3: Créer le Script de Correction**

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

        COMMENT ON TABLE delivery_proximity_suggestions IS 
            'Suggestions de proximité pour les livraisons - utilisée pour le monitoring toutes les 30s';

        RAISE NOTICE '✅ Table delivery_proximity_suggestions créée avec succès';
    ELSE
        RAISE NOTICE 'ℹ️ Table delivery_proximity_suggestions existe déjà';
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

COMMENT ON FUNCTION record_publicite_impression IS 
    'Enregistre une impression publicitaire et retourne l''ID de l''impression';
EOF
```

---

### **Étape 4: Appliquer le Script**

```bash
psql "$DATABASE_URL" -f /tmp/fix_migrations.sql
```

**Résultat attendu**:
```
DROP FUNCTION
DROP FUNCTION
DROP FUNCTION
DO
✅ Table delivery_proximity_suggestions créée avec succès
CREATE FUNCTION
COMMENT
```

---

### **Étape 5: Vérifier les Corrections**

```bash
# Vérifier que la table existe
psql "$DATABASE_URL" -c "
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_name = 'delivery_proximity_suggestions';
"

# Devrait afficher:
#         table_name
# --------------------------------
#  delivery_proximity_suggestions
# (1 row)

# Vérifier que la fonction existe avec la bonne signature
psql "$DATABASE_URL" -c "
    SELECT proname, pg_get_function_identity_arguments(oid) as args, prorettype::regtype as return_type
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
    AND p.proname = 'record_publicite_impression';
"

# Devrait afficher:
#           proname              |              args              | return_type
# ------------------------------+--------------------------------+-------------
#  record_publicite_impression  | integer, integer, character varying | integer
# (1 row)
```

---

## 🚀 **PROCHAINES ÉTAPES**

Une fois les corrections appliquées :

1. **Redémarrer le service ECS** (depuis votre machine locale ou AWS Console)
2. **Vérifier les logs** pour confirmer que l'application démarre correctement
3. **Vérifier que les health checks réussissent**

---

## 📝 **COMMANDES COMPLÈTES (Copier-Coller)**

```bash
# 1. Définir DATABASE_URL (remplacez par votre valeur)
export DATABASE_URL="postgresql://yukpo_admin:VOTRE_PASSWORD@yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com:5432/yukpo"

# 2. Vérifier
echo "$DATABASE_URL" | head -c 50

# 3. Créer le script
cat > /tmp/fix_migrations.sql << 'EOF'
DROP FUNCTION IF EXISTS record_publicite_impression(INTEGER, INTEGER, VARCHAR(50));
DROP FUNCTION IF EXISTS record_publicite_impression(INTEGER, INTEGER, VARCHAR(50), VARCHAR(50));
DROP FUNCTION IF EXISTS record_publicite_impression(INTEGER, INTEGER);

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

# 4. Appliquer
psql "$DATABASE_URL" -f /tmp/fix_migrations.sql

# 5. Vérifier
psql "$DATABASE_URL" -c "SELECT table_name FROM information_schema.tables WHERE table_name = 'delivery_proximity_suggestions';"
psql "$DATABASE_URL" -c "SELECT proname, pg_get_function_identity_arguments(oid) as args FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'record_publicite_impression';"
```

---

**Important**: Remplacez `VOTRE_PASSWORD` dans `DATABASE_URL` par le mot de passe réel que vous avez utilisé précédemment, ou récupérez-le depuis AWS Console → Secrets Manager.

