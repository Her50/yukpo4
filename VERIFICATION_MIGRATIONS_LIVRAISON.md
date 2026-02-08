# Vérification des Migrations de Livraison/Coursier dans AWS

## Migrations à vérifier

### 1. Migration `20260130_add_storage_location_id_to_product_delivery_config.sql`
- **Colonne**: `storage_location_id` dans la table `product_delivery_config`
- **Index**: `idx_product_delivery_config_storage_location`

### 2. Migration `20260127_add_courier_specializations.sql`
- **Colonne**: `specializations` (JSONB) dans la table `courier_assets`
- **Index**: `idx_courier_assets_specializations` (GIN)

### 3. Migration `00000033_create_missing_delivery_tables.sql`
- **Tables**:
  - `product_delivery_config`
  - `client_delivery_preferences`
  - `external_delivery_providers`
  - `delivery_payment_reservations`
- **Colonnes**:
  - `client_payment_method` dans `delivery_payment_reservations`
  - `payment_methods` dans `users`

## Script de vérification

Un script PowerShell a été créé : `scripts/check_delivery_migrations_simple.ps1`

Ce script exécute une requête SQL via une tâche ECS pour vérifier l'existence de :
1. La colonne `storage_location_id` dans `product_delivery_config`
2. La colonne `specializations` dans `courier_assets`
3. Les tables de livraison
4. Les index associés
5. Les colonnes de paiement

## Commandes SQL de vérification

Pour vérifier manuellement dans la base de données :

```sql
-- Vérifier storage_location_id
SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'product_delivery_config' 
    AND column_name = 'storage_location_id'
);

-- Vérifier specializations
SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'courier_assets' 
    AND column_name = 'specializations'
);

-- Vérifier les tables
SELECT table_name 
FROM information_schema.tables 
WHERE table_name IN (
    'product_delivery_config',
    'client_delivery_preferences',
    'external_delivery_providers',
    'delivery_payment_reservations'
);

-- Vérifier les index
SELECT indexname 
FROM pg_indexes 
WHERE tablename IN ('product_delivery_config', 'courier_assets')
AND indexname IN (
    'idx_product_delivery_config_storage_location',
    'idx_courier_assets_specializations'
);
```

## Prochaines étapes

1. Exécuter le script `scripts/check_delivery_migrations_simple.ps1` et attendre les résultats
2. Si des migrations manquent, vérifier les logs du backend ECS pour voir si elles ont été appliquées
3. Si nécessaire, forcer un redéploiement du backend pour appliquer les migrations



