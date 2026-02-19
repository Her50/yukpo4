# ✅ Instructions pour Appliquer la Migration delivery_proximity_suggestions

## 📋 Problème Identifié

La table `delivery_proximity_suggestions` n'existe pas dans Cloud SQL, causant des erreurs répétées dans les logs :
```
ERROR: relation "delivery_proximity_suggestions" does not exist
```

## ✅ Solution Créée

### Fichiers Créés

1. **Migration SQL** : `backend/migrations/20260216_create_delivery_proximity_suggestions_table.sql`
2. **Script SQL simple** : `scripts/apply_delivery_proximity_migration_simple.sql`
3. **Script PowerShell automatique** : `scripts/apply_migration_final.ps1`

### Configuration Effectuée

- ✅ IP publique autorisée dans Cloud SQL : `129.0.99.185/32`
- ✅ IP publique Cloud SQL : `34.79.199.41`
- ✅ Instance : `yukpo-postgres`
- ✅ Database : `yukpo_db`
- ✅ User : `yukpo_user`

## 🚀 Exécution de la Migration

### Méthode 1 : Script PowerShell (Recommandé)

```powershell
# Option A : Avec paramètre
.\scripts\apply_migration_final.ps1 -Password "VOTRE_MOT_DE_PASSE"

# Option B : Avec variable d'environnement
$env:DB_PASSWORD="VOTRE_MOT_DE_PASSE"
.\scripts\apply_migration_final.ps1
```

### Méthode 2 : psql Direct

```powershell
$env:PGPASSWORD="VOTRE_MOT_DE_PASSE"
psql -h 34.79.199.41 -U yukpo_user -d yukpo_db -p 5432 -f scripts\apply_delivery_proximity_migration_simple.sql
```

### Méthode 3 : Console Cloud SQL (Sans mot de passe)

1. Ouvrez : https://console.cloud.google.com/sql/instances/yukpo-postgres/overview?project=yukpo-project
2. Cliquez sur "DATABASES" → sélectionnez `yukpo_db`
3. Cliquez sur "Query" ou "SQL Editor"
4. Copiez-collez le contenu de `scripts/apply_delivery_proximity_migration_simple.sql`
5. Exécutez la requête

## 🔍 Vérification

Après exécution, vérifiez que la table existe :

```sql
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'delivery_proximity_suggestions'
);
```

Ou via psql :
```powershell
$env:PGPASSWORD="VOTRE_MOT_DE_PASSE"
psql -h 34.79.199.41 -U yukpo_user -d yukpo_db -p 5432 -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'delivery_proximity_suggestions');"
```

## 📝 Structure de la Table

La table `delivery_proximity_suggestions` sera créée avec :

- `id` : SERIAL PRIMARY KEY
- `delivery_id` : UUID (référence à deliveries)
- `suggested_status` : TEXT
- `location_type` : TEXT ("pickup" ou "dropoff")
- `distance_meters` : FLOAT
- `auto_confirm_after_seconds` : INTEGER
- `status` : TEXT (default: 'pending')
- `created_at` : TIMESTAMPTZ
- `confirmed_at` : TIMESTAMPTZ
- `courier_user_id` : INTEGER (référence à users)
- `metadata` : JSONB

Avec les index nécessaires pour les performances.

## ⚠️ Notes

- La migration utilise `CREATE TABLE IF NOT EXISTS`, elle est donc idempotente
- Vous pouvez l'exécuter plusieurs fois sans problème
- L'IP `129.0.99.185/32` est déjà autorisée dans Cloud SQL
- Si vous changez d'IP, réautorisez-la avec :
  ```powershell
  $newIp = (Invoke-WebRequest -Uri "https://api.ipify.org" -UseBasicParsing).Content.Trim()
  gcloud sql instances patch yukpo-postgres --authorized-networks=$newIp/32 --project=yukpo-project
  ```

## ✅ Après Application

Une fois la migration appliquée, les erreurs dans les logs Cloud SQL devraient disparaître. Vérifiez les logs après quelques minutes :

https://console.cloud.google.com/logs/query?project=yukpo-project&query=resource.type%3D%22cloudsql_database%22%0Aseverity%3E%3DERROR


