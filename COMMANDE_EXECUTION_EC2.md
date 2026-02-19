# 🚀 Commande pour Exécuter le Script de Correction sur EC2

## 📋 **DATABASE_URL Complète**

```bash
export DATABASE_URL="postgresql://yukpo_admin:PYvHBVetTuWIKNkXgqJcFiU48D39SLwd@yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com:5432/yukpo"
```

---

## 🔧 **Commandes pour Exécuter sur EC2 (sh-5.2$)**

### **Option 1 : Commande Directe (Recommandée)**

Copiez-collez cette commande complète dans votre session EC2 :

```bash
export DATABASE_URL="postgresql://yukpo_admin:PYvHBVetTuWIKNkXgqJcFiU48D39SLwd@yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com:5432/yukpo" && \
export PGPASSWORD=$(echo "$DATABASE_URL" | sed -n 's|.*://[^:]*:\([^@]*\)@.*|\1|p') && \
psql "$DATABASE_URL" << 'EOFSQL'
-- 1. Vérifier et ajouter display_name à global_promo_events si manquante
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'global_promo_events' 
        AND column_name = 'display_name'
    ) THEN
        ALTER TABLE global_promo_events 
        ADD COLUMN display_name TEXT NOT NULL DEFAULT '';
        UPDATE global_promo_events 
        SET display_name = COALESCE(theme, slug, 'Event') 
        WHERE display_name = '';
    END IF;
END $$;

-- 2. Vérifier et ajouter promo_price_cfa à live_flash_sales si manquante
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'live_flash_sales' 
        AND column_name = 'promo_price_cfa'
    ) THEN
        ALTER TABLE live_flash_sales 
        ADD COLUMN promo_price_cfa NUMERIC(14,2) NOT NULL DEFAULT 0 
        CHECK (promo_price_cfa >= 0);
    END IF;
END $$;

-- 3. Vérifier et ajouter suggested_status à delivery_proximity_suggestions si manquante
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'delivery_proximity_suggestions' 
        AND column_name = 'suggested_status'
    ) THEN
        ALTER TABLE delivery_proximity_suggestions 
        ADD COLUMN suggested_status TEXT;
    END IF;
END $$;

-- 4. Vérifier et ajouter awaiting_courier_confirmation à l'enum delivery_status si manquante
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'awaiting_courier_confirmation' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'delivery_status')
    ) THEN
        ALTER TYPE delivery_status ADD VALUE IF NOT EXISTS 'awaiting_courier_confirmation';
    END IF;
END $$;
EOFSQL
```

---

### **Option 2 : Via Script Bash (Si le fichier est disponible)**

Si vous avez accès au fichier `scripts/fix_missing_columns.sql` :

```bash
# 1. Définir DATABASE_URL
export DATABASE_URL="postgresql://yukpo_admin:PYvHBVetTuWIKNkXgqJcFiU48D39SLwd@yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com:5432/yukpo"

# 2. Extraire le mot de passe
export PGPASSWORD=$(echo "$DATABASE_URL" | sed -n 's|.*://[^:]*:\([^@]*\)@.*|\1|p')

# 3. Exécuter le script SQL
psql "$DATABASE_URL" -f scripts/fix_missing_columns.sql
```

---

### **Option 3 : Commande Simple avec psql Direct**

```bash
PGPASSWORD="PYvHBVetTuWIKNkXgqJcFiU48D39SLwd" psql -h yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com -p 5432 -U yukpo_admin -d yukpo << 'EOFSQL'
-- Script de correction
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'global_promo_events' 
        AND column_name = 'display_name'
    ) THEN
        ALTER TABLE global_promo_events 
        ADD COLUMN display_name TEXT NOT NULL DEFAULT '';
        UPDATE global_promo_events 
        SET display_name = COALESCE(theme, slug, 'Event') 
        WHERE display_name = '';
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'live_flash_sales' 
        AND column_name = 'promo_price_cfa'
    ) THEN
        ALTER TABLE live_flash_sales 
        ADD COLUMN promo_price_cfa NUMERIC(14,2) NOT NULL DEFAULT 0 
        CHECK (promo_price_cfa >= 0);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'delivery_proximity_suggestions' 
        AND column_name = 'suggested_status'
    ) THEN
        ALTER TABLE delivery_proximity_suggestions 
        ADD COLUMN suggested_status TEXT;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'awaiting_courier_confirmation' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'delivery_status')
    ) THEN
        ALTER TYPE delivery_status ADD VALUE IF NOT EXISTS 'awaiting_courier_confirmation';
    END IF;
END $$;
EOFSQL
```

---

## ✅ **Vérification Après Exécution**

Pour vérifier que les colonnes ont été ajoutées :

```bash
PGPASSWORD="PYvHBVetTuWIKNkXgqJcFiU48D39SLwd" psql -h yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com -p 5432 -U yukpo_admin -d yukpo -c "
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name IN ('global_promo_events', 'live_flash_sales', 'delivery_proximity_suggestions')
AND column_name IN ('display_name', 'promo_price_cfa', 'suggested_status')
ORDER BY table_name, column_name;
"
```

---

## 📝 **Détails de Connexion**

- **Host**: `yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com`
- **Port**: `5432`
- **User**: `yukpo_admin`
- **Password**: `PYvHBVetTuWIKNkXgqJcFiU48D39SLwd`
- **Database**: `yukpo`
- **Région**: `eu-west-1` (Irlande)

---

**Note**: Si `psql` n'est pas installé sur l'instance EC2, installez-le avec :
```bash
sudo yum install postgresql15 -y
```



