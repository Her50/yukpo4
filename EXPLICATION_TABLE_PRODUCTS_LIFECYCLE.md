# 📦 Explication de la Table `products_lifecycle`

## 🎯 Rôle de la Table

La table `products_lifecycle` est une **table de métadonnées** qui gère le **cycle de vie des produits**, notamment :
- Le statut actif/inactif de chaque produit
- Les dates de désactivation automatique
- Le coût de réactivation
- Le nombre de désactivations
- Le montant total payé pour les réactivations

## 🏗️ Architecture du Système

### ❓ Où sont stockés les produits réels ?

Les produits **ne sont PAS stockés dans une table séparée** `products`. Ils sont stockés dans :

```sql
services.data->'produits'  -- JSONB array
```

**Exemple de structure :**
```json
{
  "titre_service": {"valeur": "Mon magasin"},
  "produits": [
    {
      "nom": "iPhone 15",
      "prix": 500000,
      "description": "...",
      ...
    },
    {
      "nom": "Samsung Galaxy",
      "prix": 450000,
      ...
    }
  ]
}
```

### 📊 Table `products_lifecycle` : Table de Métadonnées

Cette table **track uniquement les métadonnées** de chaque produit :

```sql
CREATE TABLE products_lifecycle (
    id SERIAL PRIMARY KEY,
    service_id INTEGER NOT NULL,              -- Référence au service
    product_index INTEGER NOT NULL,            -- Index du produit dans data->'produits'
    product_nom TEXT NOT NULL,                 -- Nom du produit (copie pour recherche)
    product_type TEXT NOT NULL,                -- Type du produit
    is_active BOOLEAN DEFAULT TRUE,            -- ✅ PRODUIT ACTIF OU INACTIF
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    auto_deactivate_at TIMESTAMPTZ,            -- Date de désactivation automatique
    last_reactivated_at TIMESTAMPTZ,           -- Dernière réactivation
    reactivation_cost INTEGER DEFAULT 1000,    -- Coût de réactivation (1000 FCFA)
    deactivation_count INTEGER DEFAULT 0,      -- Nombre de désactivations
    total_reactivation_paid INTEGER DEFAULT 0, -- Total payé pour réactivations
    
    UNIQUE(service_id, product_index)          -- Un seul enregistrement par produit
);
```

## 🔄 Synchronisation Automatique

### Trigger Automatique

Chaque fois qu'un service est créé ou modifié, un **trigger** synchronise automatiquement les produits dans `products_lifecycle` :

```sql
CREATE TRIGGER trigger_sync_products
    AFTER INSERT OR UPDATE ON services
    FOR EACH ROW
    WHEN (jsonb_typeof(NEW.data->'produits') = 'array')
    EXECUTE FUNCTION sync_product_on_service_update();
```

**Ce que fait le trigger :**
1. Détecte quand un service contient des produits (`data->'produits'` est un array)
2. Pour chaque produit dans le array, crée ou met à jour une entrée dans `products_lifecycle`
3. Utilise `product_index` pour identifier la position du produit dans le array

## 🎯 Pourquoi cette Architecture ?

### ✅ Avantages

1. **Flexibilité** : Les produits peuvent avoir des structures différentes selon le type de service
2. **Performance** : Les données produits sont dans le même JSONB que le service (pas de JOINs complexes)
3. **Métadonnées séparées** : Le cycle de vie (actif/inactif) est géré séparément pour optimisation
4. **Rétrocompatibilité** : Les produits existants continuent de fonctionner sans modification

### ❓ Pourquoi pas une table `products` séparée ?

Il existe effectivement une table `products` dans le système, mais elle est utilisée pour des **fonctionnalités spécifiques** :

- **Réservations de bus** (`20250124001_create_products_table.sql`)
- **Produits structurés** avec plan de sièges, configuration, etc.
- **Produits différents** de ceux stockés dans `services.data->'produits'`

**Cette table `products` n'est PAS utilisée pour les produits généraux des services.**

## 📋 Workflow Complet

### 1. Création d'un Service avec Produits

```sql
INSERT INTO services (user_id, data) VALUES (
    8,
    '{
      "titre_service": {"valeur": "Magasin"},
      "produits": [
        {"nom": "iPhone", "prix": 500000},
        {"nom": "Samsung", "prix": 450000}
      ]
    }'::jsonb
);
```

**Résultat automatique :**
- Le trigger crée 2 entrées dans `products_lifecycle` :
  - `service_id=2, product_index=0, product_nom="iPhone", is_active=TRUE`
  - `service_id=2, product_index=1, product_nom="Samsung", is_active=TRUE`

### 2. Recherche de Produits

La recherche utilise `products_lifecycle` pour filtrer les produits actifs :

```sql
-- Fonction helper
SELECT get_active_products(service_data, service_id)
-- Retourne uniquement les produits où is_active = TRUE

-- Recherche
SELECT * FROM search_services_gps_final('iPhone', '4.05,9.71', 50, 20)
-- Ne retourne que les services avec des produits ACTIFS qui matchent
```

### 3. Désactivation Automatique

Après 30 jours, un produit est automatiquement désactivé :

```sql
-- Cron job exécute
SELECT deactivate_expired_products();

-- Résultat : is_active = FALSE pour les produits expirés
```

### 4. Réactivation Payante

Le prestataire paie 1000 FCFA pour réactiver un produit :

```sql
SELECT reactivate_product(service_id, product_index, user_id);
-- Débite 1000 FCFA du solde utilisateur
-- Met is_active = TRUE
-- Met auto_deactivate_at = NOW() + 30 jours
```

## 🔍 Recherche et Filtrage

### Avant (Sans products_lifecycle)

```sql
-- Recherchait dans TOUS les produits, même ceux désactivés
SELECT * FROM services 
WHERE data->'produits'->0->>'nom' ILIKE '%iPhone%'
```

### Après (Avec products_lifecycle)

```sql
-- Recherche UNIQUEMENT dans les produits actifs
SELECT * FROM services s
WHERE EXISTS (
    SELECT 1 FROM products_lifecycle pl
    WHERE pl.service_id = s.id
    AND pl.is_active = TRUE
    AND pl.product_index = 0
)
AND data->'produits'->0->>'nom' ILIKE '%iPhone%'
```

**La fonction `get_active_products()` fait ce filtrage automatiquement.**

## 📝 Résumé

| Élément | Où c'est stocké | Rôle |
|---------|----------------|------|
| **Données produit** | `services.data->'produits'` (JSONB array) | Données complètes du produit (nom, prix, description, images, etc.) |
| **Métadonnées produit** | `products_lifecycle` (table) | Cycle de vie : actif/inactif, dates, coûts |
| **Produits structurés** | `products` (table séparée) | Pour fonctionnalités spécifiques (bus, etc.) |

## ✅ Conclusion

- **Les produits réels** sont dans `services.data->'produits'` (JSONB)
- **La table `products_lifecycle`** track uniquement le cycle de vie (actif/inactif)
- **La table `products`** existe mais est pour des cas spécifiques (bus, etc.)
- **La recherche** filtre automatiquement via `get_active_products()` qui utilise `products_lifecycle`

