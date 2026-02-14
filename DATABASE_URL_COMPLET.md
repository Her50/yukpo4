# 🔑 DATABASE_URL Complet pour AWS RDS

**Date**: 2026-02-13  
**Base de données**: AWS RDS PostgreSQL (eu-west-1)

---

## ✅ **DATABASE_URL COMPLET**

```bash
export DATABASE_URL="postgresql://yukpo_admin:PYvHBVetTuWIKNkXgqJcFiU48D39SLwd@yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com:5432/yukpo"
```

---

## 📋 **DÉTAILS**

- **Utilisateur**: `yukpo_admin`
- **Mot de passe**: `PYvHBVetTuWIKNkXgqJcFiU48D39SLwd`
- **Host**: `yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com`
- **Port**: `5432`
- **Base de données**: `yukpo`
- **Région**: `eu-west-1` (Irlande)

---

## 🚀 **COMMANDES COMPLÈTES POUR APPLIQUER LES CORRECTIONS**

### **Sur EC2 (Session Manager)**

```bash
# 1. Définir DATABASE_URL
export DATABASE_URL="postgresql://yukpo_admin:PYvHBVetTuWIKNkXgqJcFiU48D39SLwd@yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com:5432/yukpo"

# 2. Vérifier
echo "$DATABASE_URL" | head -c 50

# 3. Créer le script de correction
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

# 4. Appliquer le script
psql "$DATABASE_URL" -f /tmp/fix_migrations.sql

# 5. Vérifier
psql "$DATABASE_URL" -c "SELECT table_name FROM information_schema.tables WHERE table_name = 'delivery_proximity_suggestions';"
psql "$DATABASE_URL" -c "SELECT proname, pg_get_function_identity_arguments(oid) as args FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'record_publicite_impression';"
```

---

## ✅ **RÉSULTAT ATTENDU**

Après l'exécution, vous devriez voir :

```
DROP FUNCTION
DROP FUNCTION
DROP FUNCTION
DO
✅ Table delivery_proximity_suggestions créée
CREATE FUNCTION
```

Et lors de la vérification :

```
         table_name
-------------------------------
 delivery_proximity_suggestions
(1 row)

           proname              |              args
-------------------------------+--------------------------------
 record_publicite_impression  | integer, integer, character varying
(1 row)
```

---

**Copiez-collez ces commandes dans votre session EC2 !**

