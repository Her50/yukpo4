# Vérification de la fonction run_audio_cache_cleanup()

## 🔍 Problème identifié

Les logs AWS montrent l'erreur :
```
ERROR: function run_audio_cache_cleanup() does not exist
```

## 📋 Points de vérification

### 1. Vérifier si ENABLE_AUTO_MIGRATIONS est activé

**Dans les logs AWS, chercher :**
```
🔍 ENABLE_AUTO_MIGRATIONS: raw='...', parsed=...
```

**Si vous voyez :**
- `parsed=false` → Les migrations automatiques sont **désactivées**
- `parsed=true` → Les migrations automatiques sont **activées**

**Action :** Si désactivé, définir `ENABLE_AUTO_MIGRATIONS=true` dans les variables d'environnement AWS ECS.

### 2. Vérifier si run_auto_migrations() a été appelée

**Dans les logs AWS, chercher :**
```
🚀 Démarrage des migrations automatiques...
```

**Si ce message n'apparaît PAS :**
- Soit `ENABLE_AUTO_MIGRATIONS=false`
- Soit les tables `users` ou `services` n'existent pas (vérification ligne 1106-1122 de main.rs)

### 3. Vérifier si ensure_audio_search_cache_optimization() a été exécutée

**Dans les logs AWS, chercher :**
```
🔍 Application migration audio search cache optimization...
✅ Migration audio search cache optimization appliquée
🔧 Correction de la fonction run_audio_cache_cleanup avec gestion NULL...
✅ Fonction run_audio_cache_cleanup corrigée avec gestion NULL
✅ Migration auto: audio search cache optimization OK
```

**Si ces messages n'apparaissent PAS :**
- La fonction n'a pas été créée car `ensure_audio_search_cache_optimization()` n'a pas été appelée
- Ou elle a échoué silencieusement (vérifier les erreurs dans les logs)

### 4. Vérifier directement dans la base de données PostgreSQL

**Requête SQL à exécuter sur AWS RDS :**
```sql
-- Vérifier si la fonction existe
SELECT proname, prosrc 
FROM pg_proc 
WHERE proname = 'run_audio_cache_cleanup';

-- Si aucun résultat → La fonction n'existe pas
```

**Vérifier les migrations SQLx appliquées :**
```sql
SELECT version, description, success, applied_at 
FROM _sqlx_migrations 
ORDER BY version DESC 
LIMIT 20;
```

### 5. Vérifier l'ordre d'exécution dans le code

**Ordre d'exécution attendu (dans main.rs) :**
1. Ligne 474-505 : Application migration 0 via `execute_multiple_sql_commands()`
2. Ligne 511-530 : Application migration consolidée `20260129_create_missing_tables_aws.sql`
3. Ligne 535-850 : Application migrations SQLx standard via `sqlx::migrate!()`
4. Ligne 1065-1129 : Vérification `ENABLE_AUTO_MIGRATIONS` et appel `run_auto_migrations()`
5. Dans `run_auto_migrations()` ligne 8467 : Appel `ensure_audio_search_cache_optimization()`

## 🔧 Solutions

### Solution 1 : Activer ENABLE_AUTO_MIGRATIONS (si désactivé)

**Dans AWS ECS Task Definition, ajouter/modifier :**
```json
{
  "name": "ENABLE_AUTO_MIGRATIONS",
  "value": "true"
}
```

### Solution 2 : Créer la fonction manuellement

**Exécuter le script SQL directement sur AWS RDS :**
```bash
# Via psql
psql $DATABASE_URL -f backend/apply_audio_fix_direct.sql

# Ou via AWS RDS Query Editor
# Copier-coller le contenu de backend/apply_audio_fix_direct.sql
```

### Solution 3 : Vérifier pourquoi run_auto_migrations() n'a pas été appelée

**Vérifier dans les logs :**
- Si les tables `users` et `services` existent
- Si `ENABLE_AUTO_MIGRATIONS` est bien défini
- Si une erreur s'est produite avant l'appel de `run_auto_migrations()`

## 📊 Script de diagnostic

Un script PowerShell a été créé pour automatiser la vérification :
```powershell
.\backend\scripts\diagnose_audio_cache_function.ps1
```

Ce script vérifie :
- L'existence de la fonction dans PostgreSQL
- Les migrations SQLx appliquées
- L'extension pgvector
- Fournit des recommandations

## ✅ Résultat attendu

Après correction, les logs devraient montrer :
```
🔍 Application migration audio search cache optimization...
✅ Migration audio search cache optimization appliquée
🔧 Correction de la fonction run_audio_cache_cleanup avec gestion NULL...
✅ Fonction run_audio_cache_cleanup corrigée avec gestion NULL
✅ Migration auto: audio search cache optimization OK
```

Et la tâche `audio_cache_cleanup` devrait fonctionner sans erreur.

