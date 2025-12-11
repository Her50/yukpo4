# 📊 Rapport de Vérification de la Base de Données Render

## ✅ Informations de Connexion

- **Hostname**: `dpg-d2t7ntbuibrs73eh9tvg-a.frankfurt-postgres.render.com`
- **Port**: `5432`
- **Database**: `yukpo_db`
- **Username**: `yukpo_db_user` ✅
- **URL Format**: `postgresql://yukpo_db_user:password@dpg-d2t7ntbuibrs73eh9tvg-a.frankfurt-postgres.render.com/yukpo_db`

## 🔍 Vérifications à Effectuer

### 1. ✅ Configuration DATABASE_URL
**Statut**: ✅ **CORRECT**
- L'URL utilise `yukpo_db_user` (pas `postgres`)
- Format correct : `postgresql://user:password@host:port/database`

**⚠️ Problème identifié dans les logs** :
- Les logs montrent des connexions avec `user=postgres`
- Mais l'URL fournie utilise `yukpo_db_user`
- **Hypothèse** : Il y a peut-être plusieurs services qui se connectent, ou une configuration différente sur Render

### 2. 🔍 Vérifications à Exécuter

#### A. Test de Connexion
```sql
SELECT version();
SELECT current_user;
SELECT current_database();
```

#### B. Connexions Actives
```sql
SELECT 
    usename, 
    datname, 
    state, 
    COUNT(*) as count,
    MAX(state_change) as last_state_change
FROM pg_stat_activity 
WHERE datname = 'yukpo_db' 
GROUP BY usename, datname, state 
ORDER BY count DESC;
```

#### C. Migrations Appliquées
```sql
SELECT 
    version, 
    description, 
    installed_on, 
    success,
    execution_time
FROM _sqlx_migrations 
ORDER BY installed_on DESC 
LIMIT 20;
```

#### D. Tables Principales
```sql
SELECT 
    table_name,
    table_type
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_type = 'BASE TABLE'
ORDER BY table_name;
```

#### E. Extensions PostgreSQL
```sql
SELECT 
    extname, 
    extversion 
FROM pg_extension 
ORDER BY extname;
```

**Extensions attendues** :
- ✅ `uuid-ossp`
- ✅ `pg_trgm`
- ✅ `unaccent`
- ✅ `pgcrypto`
- ✅ `postgis`

#### F. Permissions de l'Utilisateur
```sql
SELECT 
    grantee, 
    table_schema,
    table_name,
    privilege_type 
FROM information_schema.role_table_grants 
WHERE grantee = 'yukpo_db_user'
ORDER BY table_name, privilege_type
LIMIT 50;
```

#### G. Taille de la Base de Données
```sql
SELECT 
    pg_size_pretty(pg_database_size('yukpo_db')) as database_size,
    pg_size_pretty(pg_database_size(current_database())) as current_db_size;
```

#### H. Statistiques des Tables
```sql
SELECT 
    schemaname,
    tablename,
    n_live_tup as row_count,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_stat_user_tables
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
LIMIT 20;
```

#### I. Index Manquants (Requêtes Lentes)
```sql
SELECT 
    schemaname,
    tablename,
    attname,
    n_distinct,
    correlation
FROM pg_stats
WHERE schemaname = 'public'
  AND n_distinct > 100
  AND correlation < 0.1
ORDER BY n_distinct DESC
LIMIT 20;
```

#### J. Transactions Longues (Problèmes Potentiels)
```sql
SELECT 
    pid,
    usename,
    datname,
    state,
    query_start,
    state_change,
    NOW() - query_start as duration,
    LEFT(query, 100) as query_preview
FROM pg_stat_activity
WHERE datname = 'yukpo_db'
  AND state != 'idle'
  AND NOW() - query_start > interval '5 seconds'
ORDER BY duration DESC;
```

#### K. Locks Actifs
```sql
SELECT 
    locktype,
    relation::regclass,
    mode,
    granted,
    pid
FROM pg_locks
WHERE relation IS NOT NULL
ORDER BY granted, pid;
```

## 🚨 Problèmes Potentiels à Vérifier

### 1. Utilisateur `postgres` dans les Logs
**Problème** : Les logs montrent des connexions avec `user=postgres`
**Cause possible** :
- Service différent qui utilise `postgres`
- Configuration Render qui utilise `postgres` pour certaines opérations
- Scripts de migration qui utilisent `postgres`

**Action** : Vérifier toutes les variables d'environnement sur Render

### 2. Connexions Multiples
**Observation** : Beaucoup de connexions/déconnexions
**Vérification** : S'assurer que le pool réutilise les connexions

### 3. Migrations en Échec
**Vérification** : Vérifier `success = false` dans `_sqlx_migrations`

### 4. Tables Manquantes
**Vérification** : Comparer avec les migrations pour s'assurer que toutes les tables existent

## 📝 Commandes de Vérification Rapide

### Via psql (si installé)
```powershell
$env:DATABASE_URL = "postgresql://yukpo_db_user:88X47ZWBiLkX5WatFcLU4KQ4rgaHYml4@dpg-d2t7ntbuibrs73eh9tvg-a.frankfurt-postgres.render.com/yukpo_db"

# Test de connexion
psql $env:DATABASE_URL -c "SELECT version();"

# Utilisateur actuel
psql $env:DATABASE_URL -c "SELECT current_user;"

# Connexions actives
psql $env:DATABASE_URL -c "SELECT usename, COUNT(*) FROM pg_stat_activity WHERE datname = 'yukpo_db' GROUP BY usename;"
```

### Via Script PowerShell
```powershell
.\backend\scripts\verify_database_connection.ps1
```

## ✅ Checklist de Vérification

- [ ] Connexion réussie
- [ ] Utilisateur correct (`yukpo_db_user`)
- [ ] Toutes les extensions installées
- [ ] Toutes les migrations appliquées avec succès
- [ ] Toutes les tables principales existent
- [ ] Permissions correctes sur les tables
- [ ] Pas de transactions longues
- [ ] Pas de locks bloquants
- [ ] Taille de la base raisonnable
- [ ] Index présents sur les colonnes importantes

## 📊 Résultats Attendus

Après exécution du script, on devrait avoir :
1. ✅ Connexion réussie
2. ✅ Utilisateur : `yukpo_db_user`
3. ✅ Extensions : postgis, pg_trgm, unaccent, pgcrypto, uuid-ossp
4. ✅ Migrations : Toutes avec `success = true`
5. ✅ Tables : users, services, products, etc.
6. ✅ Permissions : SELECT, INSERT, UPDATE, DELETE sur les tables

