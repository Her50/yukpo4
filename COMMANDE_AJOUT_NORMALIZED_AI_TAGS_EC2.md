# 🔧 Commande pour Ajouter normalized_ai_tags - EC2

## ⚠️ **Problème Identifié**

La colonne `normalized_ai_tags` est manquante dans la table `media`. Elle a été tronquée lors de la migration (erreur "syntax error at end of input").

---

## ✅ **Commande pour Ajouter normalized_ai_tags**

```bash
PGPASSWORD="PYvHBVetTuWIKNkXgqJcFiU48D39SLwd" psql -h yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com -p 5432 -U yukpo_admin -d yukpo << 'EOFSQL'
-- Vérifier que la fonction normalize_word_array existe
DO $$
BEGIN
    -- Créer la fonction normalize_word si elle n'existe pas
    IF NOT EXISTS (
        SELECT 1 FROM pg_proc 
        WHERE proname = 'normalize_word'
    ) THEN
        CREATE OR REPLACE FUNCTION normalize_word(word TEXT)
        RETURNS TEXT AS $$
        BEGIN
            IF word IS NULL OR word = '' THEN
                RETURN '';
            END IF;
            RETURN LOWER(
                translate(
                    word,
                    'àâäéèêëîïôöùûüÿç',
                    'aaaeeeeiiioouuuyc'
                )
            );
        END;
        $$ LANGUAGE plpgsql IMMUTABLE;
    END IF;

    -- Créer la fonction normalize_word_array si elle n'existe pas
    IF NOT EXISTS (
        SELECT 1 FROM pg_proc 
        WHERE proname = 'normalize_word_array'
    ) THEN
        CREATE OR REPLACE FUNCTION normalize_word_array(word_array TEXT[])
        RETURNS TEXT[] AS $$
        BEGIN
            IF word_array IS NULL OR array_length(word_array, 1) IS NULL THEN
                RETURN ARRAY[]::TEXT[];
            END IF;
            RETURN ARRAY(
                SELECT normalize_word(unnest(word_array))
            );
        END;
        $$ LANGUAGE plpgsql IMMUTABLE;
    END IF;
END $$;

-- Ajouter normalized_ai_tags si elle n'existe pas
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'media' 
        AND column_name = 'normalized_ai_tags'
    ) THEN
        ALTER TABLE media 
        ADD COLUMN normalized_ai_tags TEXT[] 
        GENERATED ALWAYS AS (
            CASE 
                WHEN ai_tags IS NULL OR array_length(ai_tags, 1) IS NULL 
                THEN ARRAY[]::TEXT[]
                ELSE normalize_word_array(ai_tags)
            END
        ) STORED;
        
        -- Créer l'index GIN pour la recherche
        CREATE INDEX IF NOT EXISTS idx_media_normalized_ai_tags_gin 
        ON media USING GIN (normalized_ai_tags);
    END IF;
END $$;
EOFSQL
```

---

## ✅ **Vérification Après Ajout**

```bash
PGPASSWORD="PYvHBVetTuWIKNkXgqJcFiU48D39SLwd" psql -h yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com -p 5432 -U yukpo_admin -d yukpo -c "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'media' AND column_name = 'normalized_ai_tags') as normalized_ai_tags_exists;"
```

---

## 📊 **Résumé des Résultats de Vérification**

D'après votre vérification :

### ✅ **Tables Complètes**
- ✅ `product_delivery_config` : **25 colonnes** (dont `storage_location_id`)
- ✅ `courier_applications` : **13 colonnes** (dont `partner_id`)
- ✅ `couriers` : **11 colonnes**
- ✅ `courier_assets` : **14 colonnes** (dont `vehicle_image_url`, `specializations`)
- ✅ `media_engagement` : **9 colonnes**
- ✅ `media_distribution` : **8 colonnes**
- ✅ `delivery_media` : **21 colonnes**
- ✅ `delivery_proof_media` : **9 colonnes**

### ⚠️ **Colonnes Manquantes**
- ⚠️ `media.normalized_ai_tags` : **MANQUANTE** (à ajouter avec la commande ci-dessus)
- ✅ `media.normalized_ai_description` : **PRÉSENTE**

### 📋 **Table media : 24 colonnes** (devrait être 25 avec `normalized_ai_tags`)

---

## 🎯 **Prochaines Étapes**

1. Exécuter la commande pour ajouter `normalized_ai_tags`
2. Vérifier que toutes les colonnes sont présentes
3. Redémarrer le backend pour que les changements prennent effet



