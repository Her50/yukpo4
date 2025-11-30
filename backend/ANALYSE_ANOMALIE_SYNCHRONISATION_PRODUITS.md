# 🚨 Analyse : Anomalie de Synchronisation des Produits

## Problème Identifié

**Symptôme** : Un produit existe dans `services.data->produits` mais n'est pas dans `products_lifecycle`, nécessitant une création manuelle via `ensure_product_in_lifecycle`.

**Cause Racine** : Le trigger `trigger_sync_products` ne gère qu'un seul format de stockage des produits, alors que le système en utilise deux.

---

## Formats de Stockage des Produits

### Format 1 : Array Direct ✅ (Géré par le trigger)
```json
{
  "data": {
    "produits": [
      {"nom": "Produit 1", "type": "autre"},
      {"nom": "Produit 2", "type": "autre"}
    ]
  }
}
```
**Chemin SQL** : `data->'produits'` (array)

### Format 2 : Array dans Objet avec type_donnee ❌ (NON géré par le trigger)
```json
{
  "data": {
    "produits": {
      "type_donnee": "listeproduit",
      "valeur": [
        {"nom": "Produit 1", "type": "autre"},
        {"nom": "Produit 2", "type": "autre"}
      ]
    }
  }
}
```
**Chemin SQL** : `data->'produits'->'valeur'` (array dans objet)

---

## Code du Trigger Actuel (Défectueux)

```sql
CREATE OR REPLACE FUNCTION sync_product_on_service_update()
RETURNS TRIGGER AS $$
DECLARE
    product_record JSONB;
    product_idx INTEGER;
BEGIN
    -- ❌ PROBLÈME: Ne vérifie que le format 1
    IF jsonb_typeof(NEW.data->'produits') = 'array' THEN
        product_idx := 0;
        
        FOR product_record IN 
            SELECT * FROM jsonb_array_elements(NEW.data->'produits')
        LOOP
            -- ... insertion dans products_lifecycle ...
        END LOOP;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_sync_products
    AFTER INSERT OR UPDATE ON services
    FOR EACH ROW
    WHEN (jsonb_typeof(NEW.data->'produits') = 'array')  -- ❌ Ne détecte que le format 1
    EXECUTE FUNCTION sync_product_on_service_update();
```

**Problème** : Le trigger ne se déclenche jamais pour les services utilisant le format 2 (`type_donnee: "listeproduit"`).

---

## Impact

1. **Services créés avec format 2** : Les produits ne sont jamais synchronisés automatiquement
2. **Services migrés vers format 2** : Les produits disparaissent de `products_lifecycle` lors des mises à jour
3. **Dépendances** : 
   - Génération de vidéos échoue (`ProductConnectorSnapshot` nécessite `products_lifecycle`)
   - Désactivation automatique ne fonctionne pas
   - Réactivation payante ne fonctionne pas

---

## Solution : Corriger le Trigger

### Option 1 : Fonction Corrigée (Recommandée)

```sql
CREATE OR REPLACE FUNCTION sync_product_on_service_update()
RETURNS TRIGGER AS $$
DECLARE
    product_record JSONB;
    product_idx INTEGER;
    produits_array JSONB;
BEGIN
    -- ✅ Détecter le format 1 : array direct
    IF jsonb_typeof(NEW.data->'produits') = 'array' THEN
        produits_array := NEW.data->'produits';
    -- ✅ Détecter le format 2 : array dans objet avec type_donnee
    ELSIF jsonb_typeof(NEW.data->'produits') = 'object' 
        AND jsonb_typeof(NEW.data->'produits'->'valeur') = 'array' THEN
        produits_array := NEW.data->'produits'->'valeur';
    ELSE
        -- Aucun produit à synchroniser
        RETURN NEW;
    END IF;
    
    -- Synchroniser tous les produits
    product_idx := 0;
    FOR product_record IN 
        SELECT * FROM jsonb_array_elements(produits_array)
    LOOP
        INSERT INTO products_lifecycle (
            service_id,
            product_index,
            product_nom,
            product_type,
            is_active,
            auto_deactivate_at
        ) VALUES (
            NEW.id,
            product_idx,
            COALESCE(
                product_record->>'nom', 
                product_record->>'name', 
                'Produit'
            ),
            COALESCE(product_record->>'type', 'autre'),
            TRUE,
            NOW() + INTERVAL '30 days'
        )
        ON CONFLICT (service_id, product_index) 
        DO UPDATE SET
            product_nom = EXCLUDED.product_nom,
            product_type = EXCLUDED.product_type,
            updated_at = NOW();
        
        product_idx := product_idx + 1;
    END LOOP;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ✅ Trigger corrigé pour détecter les deux formats
DROP TRIGGER IF EXISTS trigger_sync_products ON services;
CREATE TRIGGER trigger_sync_products
    AFTER INSERT OR UPDATE ON services
    FOR EACH ROW
    WHEN (
        -- Format 1 : array direct
        jsonb_typeof(NEW.data->'produits') = 'array'
        OR 
        -- Format 2 : array dans objet
        (
            jsonb_typeof(NEW.data->'produits') = 'object' 
            AND jsonb_typeof(NEW.data->'produits'->'valeur') = 'array'
        )
    )
    EXECUTE FUNCTION sync_product_on_service_update();
```

### Option 2 : Migration de Données

Synchroniser tous les produits existants qui n'ont pas été synchronisés :

```sql
-- Fonction pour synchroniser les produits manquants
CREATE OR REPLACE FUNCTION sync_missing_products()
RETURNS TABLE(
    service_id INTEGER,
    products_synced INTEGER
) AS $$
DECLARE
    service_record RECORD;
    product_record JSONB;
    product_idx INTEGER;
    produits_array JSONB;
    synced_count INTEGER;
BEGIN
    FOR service_record IN 
        SELECT id, data 
        FROM services 
        WHERE is_active = TRUE
    LOOP
        synced_count := 0;
        
        -- Détecter le format
        IF jsonb_typeof(service_record.data->'produits') = 'array' THEN
            produits_array := service_record.data->'produits';
        ELSIF jsonb_typeof(service_record.data->'produits') = 'object' 
            AND jsonb_typeof(service_record.data->'produits'->'valeur') = 'array' THEN
            produits_array := service_record.data->'produits'->'valeur';
        ELSE
            CONTINUE;
        END IF;
        
        -- Synchroniser chaque produit
        product_idx := 0;
        FOR product_record IN 
            SELECT * FROM jsonb_array_elements(produits_array)
        LOOP
            INSERT INTO products_lifecycle (
                service_id,
                product_index,
                product_nom,
                product_type,
                is_active,
                auto_deactivate_at
            ) VALUES (
                service_record.id,
                product_idx,
                COALESCE(
                    product_record->>'nom', 
                    product_record->>'name', 
                    'Produit'
                ),
                COALESCE(product_record->>'type', 'autre'),
                TRUE,
                NOW() + INTERVAL '30 days'
            )
            ON CONFLICT (service_id, product_index) 
            DO UPDATE SET
                product_nom = EXCLUDED.product_nom,
                product_type = EXCLUDED.product_type,
                updated_at = NOW();
            
            synced_count := synced_count + 1;
            product_idx := product_idx + 1;
        END LOOP;
        
        IF synced_count > 0 THEN
            service_id := service_record.id;
            products_synced := synced_count;
            RETURN NEXT;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Exécuter la synchronisation
SELECT * FROM sync_missing_products();
```

---

## Actions Recommandées

1. **Immédiat** : Corriger le trigger pour gérer les deux formats
2. **Court terme** : Exécuter `sync_missing_products()` pour synchroniser les produits existants
3. **Moyen terme** : Standardiser sur un seul format (recommandé : format 2 avec `type_donnee`)
4. **Long terme** : Retirer `ensure_product_in_lifecycle` (workaround) une fois le trigger corrigé

---

## Vérification

```sql
-- Vérifier les services avec produits non synchronisés
SELECT 
    s.id as service_id,
    s.user_id,
    jsonb_typeof(s.data->'produits') as produits_type,
    CASE 
        WHEN jsonb_typeof(s.data->'produits') = 'array' THEN 'format_1'
        WHEN jsonb_typeof(s.data->'produits') = 'object' 
            AND jsonb_typeof(s.data->'produits'->'valeur') = 'array' THEN 'format_2'
        ELSE 'autre'
    END as format_detecte,
    (
        SELECT COUNT(*) 
        FROM jsonb_array_elements(
            CASE 
                WHEN jsonb_typeof(s.data->'produits') = 'array' 
                    THEN s.data->'produits'
                WHEN jsonb_typeof(s.data->'produits') = 'object' 
                    THEN s.data->'produits'->'valeur'
                ELSE '[]'::jsonb
            END
        )
    ) as produits_count,
    (
        SELECT COUNT(*) 
        FROM products_lifecycle pl 
        WHERE pl.service_id = s.id
    ) as produits_synchronises
FROM services s
WHERE s.is_active = TRUE
    AND (
        jsonb_typeof(s.data->'produits') = 'array'
        OR jsonb_typeof(s.data->'produits'->'valeur') = 'array'
    )
HAVING (
    SELECT COUNT(*) 
    FROM jsonb_array_elements(
        CASE 
            WHEN jsonb_typeof(s.data->'produits') = 'array' 
                THEN s.data->'produits'
            ELSE s.data->'produits'->'valeur'
        END
    )
) != (
    SELECT COUNT(*) 
    FROM products_lifecycle pl 
    WHERE pl.service_id = s.id
)
ORDER BY s.id;
```

---

## Conclusion

**C'est bien une anomalie** : Le trigger de synchronisation automatique est incomplet et ne gère pas tous les formats de stockage des produits. Cela explique pourquoi `ensure_product_in_lifecycle` est nécessaire comme workaround.

**Solution** : Corriger le trigger pour gérer les deux formats, puis synchroniser les produits manquants.

