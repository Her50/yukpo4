# 🔧 Commande Finale pour Ajouter display_name

## 🔍 **Étape 1 : Vérifier les Colonnes Existantes**

D'abord, vérifions quelles colonnes existent dans `global_promo_events` :

```bash
PGPASSWORD="PYvHBVetTuWIKNkXgqJcFiU48D39SLwd" psql -h yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com -p 5432 -U yukpo_admin -d yukpo -c "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'global_promo_events' ORDER BY column_name;"
```

---

## ✅ **Étape 2 : Ajouter display_name (Sans UPDATE)**

Puisque ni `theme` ni `slug` n'existent, ajoutons simplement la colonne sans UPDATE :

```bash
PGPASSWORD="PYvHBVetTuWIKNkXgqJcFiU48D39SLwd" psql -h yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com -p 5432 -U yukpo_admin -d yukpo << 'EOFSQL'
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'global_promo_events' 
        AND column_name = 'display_name'
    ) THEN
        ALTER TABLE global_promo_events 
        ADD COLUMN display_name TEXT NOT NULL DEFAULT 'Event';
    END IF;
END $$;
EOFSQL
```

---

## ✅ **Vérification Finale**

Pour vérifier que toutes les colonnes sont présentes :

```bash
PGPASSWORD="PYvHBVetTuWIKNkXgqJcFiU48D39SLwd" psql -h yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com -p 5432 -U yukpo_admin -d yukpo -c "SELECT table_name, column_name, data_type FROM information_schema.columns WHERE table_name IN ('global_promo_events', 'live_flash_sales', 'delivery_proximity_suggestions') AND column_name IN ('display_name', 'promo_price_cfa', 'suggested_status') ORDER BY table_name, column_name;"
```

---

## 📋 **Résumé**

- ✅ `suggested_status` : **Ajoutée**
- ✅ `promo_price_cfa` : **Ajoutée**
- ⏳ `display_name` : **À ajouter avec la commande ci-dessus (sans UPDATE)**


