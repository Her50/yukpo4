# 🔧 Guide d'Application des Migrations

## 📋 Prérequis

1. **Variable d'environnement `DATABASE_URL`** doit être configurée
2. **SQLx CLI** installé : `cargo install sqlx-cli --features postgres`

## 🚀 Méthodes d'Application

### Option 1 : Application Locale (si base accessible)

1. **Créer un fichier `.env` dans `backend/`** :
```bash
DATABASE_URL=postgresql://user:password@host:port/database?sslmode=require
```

2. **Appliquer les migrations** :
```bash
cd backend
sqlx migrate run
```

### Option 2 : Application sur Render (Production)

Les migrations sont appliquées automatiquement au démarrage du backend via `auto_migrate.rs`.

**Vérification manuelle** :
1. Aller sur Render Dashboard → Votre service backend
2. Ouvrir la console/terminal
3. Exécuter :
```bash
sqlx migrate run
```

### Option 3 : Vérifier l'état des migrations

```bash
cd backend
sqlx migrate info
```

## ✅ Migrations Critiques pour la Configuration de Livraison

Les migrations suivantes sont nécessaires pour la fonctionnalité de configuration de livraison :

1. ✅ `20250120_001_add_order_preparation_system.sql` - Ajoute `preparation_time_minutes`
2. ✅ `20260130_add_storage_location_id_to_product_delivery_config.sql` - Ajoute `storage_location_id`

Ces migrations utilisent `IF NOT EXISTS`, donc elles sont idempotentes et peuvent être exécutées plusieurs fois sans erreur.

## 🔍 Vérification Post-Migration

Pour vérifier que les colonnes existent :

```sql
-- Vérifier preparation_time_minutes
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'product_delivery_config' 
AND column_name = 'preparation_time_minutes';

-- Vérifier storage_location_id
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'product_delivery_config' 
AND column_name = 'storage_location_id';
```

## ⚠️ Notes Importantes

- Les migrations sont appliquées automatiquement au démarrage si `auto_migrate.rs` est actif
- En production (Render), les migrations sont généralement appliquées via le déploiement
- Si vous utilisez `SQLX_OFFLINE=true`, les migrations ne seront pas appliquées automatiquement



