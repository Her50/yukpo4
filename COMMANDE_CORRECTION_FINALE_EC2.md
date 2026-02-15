# 🔧 Commande de Correction Finale pour EC2

## ✅ **Résultats Actuels**

D'après votre exécution :
- ✅ `suggested_status` ajoutée avec succès
- ✅ `promo_price_cfa` ajoutée avec succès
- ⚠️ `display_name` : erreur car la colonne `theme` n'existe pas

---

## 🔍 **Vérification des Colonnes Existantes**

D'abord, vérifions quelles colonnes existent dans `global_promo_events` :

```bash
PGPASSWORD="PYvHBVetTuWIKNkXgqJcFiU48D39SLwd" psql -h yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com -p 5432 -U yukpo_admin -d yukpo -c "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'global_promo_events' ORDER BY column_name;"
```

---

## 🔧 **Commande Corrigée pour Ajouter display_name**

Si `display_name` n'existe pas encore, utilisez cette commande corrigée (sans référence à `theme`) :

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
        ADD COLUMN display_name TEXT NOT NULL DEFAULT '';
        
        -- Mettre à jour avec slug si disponible, sinon 'Event'
        UPDATE global_promo_events 
        SET display_name = COALESCE(slug, 'Event') 
        WHERE display_name = '';
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
- ⏳ `display_name` : **À ajouter avec la commande corrigée ci-dessus**


