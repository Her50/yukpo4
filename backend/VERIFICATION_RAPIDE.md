# ⚡ Vérification Rapide des Migrations

## 🎯 Vérification Directe (3 méthodes)

### Méthode 1: Via psql (le plus rapide)

Si vous avez `psql` installé et `DATABASE_URL` défini :

```bash
# Windows PowerShell
$env:DATABASE_URL = "postgresql://user:password@host:5432/database"
psql $env:DATABASE_URL -f backend/scripts/check_migration_status.sql

# Linux/Mac
export DATABASE_URL="postgresql://user:password@host:5432/database"
psql $DATABASE_URL -f backend/scripts/check_migration_status.sql
```

### Méthode 2: Via le script PowerShell

```powershell
# Définir DATABASE_URL d'abord
$env:DATABASE_URL = "postgresql://user:password@host:5432/database"

# Exécuter le script
.\backend\scripts\verify_migrations_direct.ps1
```

### Méthode 3: Vérification rapide (tables seulement)

```bash
psql $DATABASE_URL -f backend/scripts/quick_check_tables.sql
```

## 📋 Ce qui sera vérifié

1. ✅ Existence de la table `_sqlx_migrations`
2. ✅ Nombre de migrations appliquées
3. ✅ État de la migration 0 (create all tables)
4. ✅ Existence des tables critiques :
   - `users`
   - `services`
   - `deliveries`
   - `product_creation_queue`
   - `delivery_matching_queue`
   - `global_promo_events`
   - `live_flash_sales`
   - `product_orders`
   - Et autres tables spécialisées

## ✅ Résultat attendu

Si tout est OK, vous devriez voir :
- ✅ Table _sqlx_migrations EXISTE
- ✅ Toutes les tables critiques avec le statut "✅ EXISTE"
- ✅ Migrations appliquées avec `success = true`

## 🚨 Si des tables manquent

1. Vérifiez les logs de démarrage pour les erreurs de migration
2. Redémarrez l'application (les migrations s'exécutent au démarrage)
3. Vérifiez que le dossier `backend/migrations/` contient les fichiers SQL

## 💡 URL de base de données

D'après les mémoires du projet, l'URL Render est :
```
postgresql://yukpo_db_user:88X47ZWBiLkX5WatFcLU4KQ4rgaHYml4@dpg-d2t7ntbuibrs73eh9tvg-a.frankfurt-postgres.render.com/yukpo_db
```

Pour l'utiliser :
```powershell
$env:DATABASE_URL = "postgresql://yukpo_db_user:88X47ZWBiLkX5WatFcLU4KQ4rgaHYml4@dpg-d2t7ntbuibrs73eh9tvg-a.frankfurt-postgres.render.com/yukpo_db"
```






