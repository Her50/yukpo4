# 🔧 Application de la Migration delivery_proximity_suggestions

## 📋 Problème
La table `delivery_proximity_suggestions` n'existe pas dans Cloud SQL, causant des erreurs répétées dans les logs.

## ✅ Solution

### Méthode 1: Via la Console Cloud SQL (RECOMMANDÉ)

1. **Accédez à la console Cloud SQL** :
   ```
   https://console.cloud.google.com/sql/instances/yukpo-postgres?project=yukpo-project
   ```

2. **Ouvrez l'éditeur SQL** :
   - Cliquez sur "DATABASES" dans le menu latéral
   - Sélectionnez la base `yukpo_db`
   - Cliquez sur "Query" ou "SQL Editor"

3. **Copiez et exécutez le contenu** de :
   ```
   scripts/apply_delivery_proximity_migration_simple.sql
   ```

4. **Vérifiez que la table est créée** :
   ```sql
   SELECT EXISTS (
       SELECT FROM information_schema.tables 
       WHERE table_schema = 'public' 
       AND table_name = 'delivery_proximity_suggestions'
   );
   ```

### Méthode 2: Via gcloud CLI

Si vous avez `gcloud` installé et configuré :

```powershell
# Lire le fichier SQL
$sql = Get-Content "scripts\apply_delivery_proximity_migration_simple.sql" -Raw

# Appliquer via gcloud
gcloud sql execute-sql yukpo-postgres `
    --database=yukpo_db `
    --project=yukpo-project `
    --sql="$sql"
```

### Méthode 3: Via psql (si Cloud SQL Proxy est configuré)

```powershell
# Si vous avez Cloud SQL Proxy configuré
psql "host=127.0.0.1 port=5432 dbname=yukpo_db user=yukpo_user" -f scripts\apply_delivery_proximity_migration_simple.sql
```

## 🔍 Vérification

Après application, vérifiez que les erreurs ont disparu :

1. **Vérifier les logs Cloud SQL** :
   ```
   https://console.cloud.google.com/logs/query?project=yukpo-project&query=resource.type%3D%22cloudsql_database%22%0Aseverity%3E%3DERROR%0AtextPayload%3D~%22delivery_proximity_suggestions%22
   ```

2. **Vérifier que la table existe** :
   ```sql
   \d delivery_proximity_suggestions
   ```

## 📝 Fichiers créés

- ✅ `backend/migrations/20260216_create_delivery_proximity_suggestions_table.sql` - Migration complète
- ✅ `scripts/apply_delivery_proximity_migration_simple.sql` - Script SQL simple à exécuter
- ✅ `scripts/apply_delivery_proximity_migration.ps1` - Script PowerShell (optionnel)

## ⚠️ Note

Cette migration utilise `CREATE TABLE IF NOT EXISTS`, donc elle est idempotente et peut être exécutée plusieurs fois sans problème.


