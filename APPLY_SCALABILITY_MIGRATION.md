# 🚀 Application de la Migration de Scalabilité

## 📋 Étapes pour appliquer la migration

### 1. ✅ Migration SQLx (déjà créée)

Le fichier de migration existe : `backend/migrations/20251201_scalability_indexes.sql`

### 2. ✅ Auto-migration intégrée

La fonction `ensure_scalability_indexes()` a été ajoutée dans `auto_migrate.rs` et sera appelée automatiquement au démarrage.

### 3. 🔧 Application de la migration SQL

**Option A : Via SQLx (recommandé pour migrations versionnées)**

```bash
cd backend

# Définir les variables d'environnement
$env:DATABASE_URL="postgresql://yukpo_db_user:88X47ZWBiLkX5WatFcLU4KQ4rgaHYml4@dpg-d2t7ntbuibrs73eh9tvg-a.frankfurt-postgres.render.com/yukpo_db"

# Appliquer toutes les migrations
sqlx migrate run
```

**Option B : Via auto_migration (automatique au démarrage)**

La migration sera appliquée automatiquement au démarrage du serveur via `run_auto_migrations()`.

**Option C : Manuellement via psql**

```bash
# Se connecter à la base
psql "postgresql://yukpo_db_user:88X47ZWBiLkX5WatFcLU4KQ4rgaHYml4@dpg-d2t7ntbuibrs73eh9tvg-a.frankfurt-postgres.render.com/yukpo_db"

# Exécuter le fichier SQL
\i backend/migrations/20251201_scalability_indexes.sql
```

### 4. 🔍 Vérification

**Vérifier que les index sont créés :**

```sql
-- Vérifier les index de scalabilité
SELECT indexname, tablename 
FROM pg_indexes 
WHERE indexname LIKE '%scalability%' 
   OR indexname LIKE 'idx_services_products%'
   OR indexname LIKE 'idx_delivery_requests_status%'
ORDER BY tablename, indexname;

-- Vérifier les vues matérialisées
SELECT schemaname, matviewname 
FROM pg_matviews 
WHERE matviewname IN ('services_search_cache', 'active_products_cache');
```

**Vérifier que les fonctions sont créées :**

```sql
SELECT proname, prosrc 
FROM pg_proc 
WHERE proname = 'refresh_scalability_materialized_views';
```

### 5. ✅ Refresh automatique configuré

Le refresh automatique des vues matérialisées a été configuré dans `main.rs` :
- `services_search_cache` : Refresh toutes les 5 minutes
- `active_products_cache` : Refresh toutes les 10 minutes (alterné)

### 6. 📊 Monitoring

**Vérifier la dernière refresh :**

```sql
SELECT schemaname, matviewname, 
       pg_size_pretty(pg_total_relation_size(schemaname||'.'||matviewname)) as size
FROM pg_matviews 
WHERE matviewname IN ('services_search_cache', 'active_products_cache');
```

**Vérifier les métriques de performance :**

Le service de scalabilité expose des métriques via `ScalabilityService::get_metrics()`.

---

## 🐛 Dépannage

### Erreur : "relation does not exist"

Si les vues matérialisées n'existent pas :
1. Vérifier que la migration a été appliquée
2. Vérifier les logs du serveur pour les erreurs d'auto-migration

### Erreur : "cannot refresh materialized view concurrently"

Les vues doivent avoir des index UNIQUE pour un refresh CONCURRENTLY.
Vérifier que les index sont créés :

```sql
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'services_search_cache';
```

### Performance lente après création

Les vues matérialisées sont initialement vides. Attendre le premier refresh (5-10 minutes) ou forcer un refresh :

```sql
REFRESH MATERIALIZED VIEW services_search_cache;
REFRESH MATERIALIZED VIEW active_products_cache;
```

---

## ✅ Checklist finale

- [ ] Migration SQL appliquée (`sqlx migrate run` ou auto-migration)
- [ ] Index créés (vérifier avec requête SQL)
- [ ] Vues matérialisées créées
- [ ] Fonction `refresh_scalability_materialized_views()` créée
- [ ] Refresh automatique démarré (logs serveur)
- [ ] Métriques de performance vérifiées

---

**Note** : La migration sera appliquée automatiquement au prochain démarrage du serveur si elle n'a pas été appliquée manuellement.

