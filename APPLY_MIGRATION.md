# Application de la Migration optimize_vector_matching_vectorial

## Migration créée

✅ **Fichier** : `backend/migrations/20260113_optimize_vector_matching_vectorial.sql`

Cette migration remplace l'itération séquentielle par un **test vectoriel unique** (équivalent à `%in%` en R) dans la fonction `calculate_vector_match_score_optimized`.

## Méthodes d'application

### Méthode 1 : Script PowerShell (Recommandé)

```powershell
cd backend
.\apply_vector_matching_migration.ps1
```

Le script :
- Lit `DATABASE_URL` depuis `.env` ou les variables d'environnement
- Applique la migration via `psql`
- Vérifie le succès de l'application

### Méthode 2 : Via psql directement

Si vous avez `psql` installé et `DATABASE_URL` configuré :

```powershell
# Définir DATABASE_URL si nécessaire
$env:DATABASE_URL = "postgresql://user:password@host:port/database"

# Extraire les informations de connexion
$dbUrl = $env:DATABASE_URL
if ($dbUrl -match "postgresql://([^:]+):([^@]+)@([^:]+):(\d+)/(.+)") {
    $user = $matches[1]
    $password = $matches[2]
    $host = $matches[3]
    $port = $matches[4]
    $database = $matches[5]
    
    $env:PGPASSWORD = $password
    psql -h $host -p $port -U $user -d $database -f backend\migrations\20260113_optimize_vector_matching_vectorial.sql
    Remove-Item Env:\PGPASSWORD
}
```

### Méthode 3 : Via un client PostgreSQL (pgAdmin, DBeaver, etc.)

1. Ouvrez votre client PostgreSQL
2. Connectez-vous à votre base de données
3. Ouvrez le fichier `backend/migrations/20260113_optimize_vector_matching_vectorial.sql`
4. Exécutez le script SQL complet

### Méthode 4 : Via sqlx migrate (si le problème de migrations 0 est résolu)

```powershell
cd backend
sqlx migrate run
```

**Note** : Il y a actuellement un problème avec les migrations numérotées `0`, donc cette méthode peut ne pas fonctionner.

## Vérification

Après l'application, vérifiez que la fonction a été mise à jour :

```sql
-- Vérifier que la fonction existe
SELECT EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'calculate_vector_match_score_optimized'
);

-- Voir la définition de la fonction
\df+ calculate_vector_match_score_optimized
```

## Contenu de la migration

La migration remplace :
- **Avant** : Itération séquentielle avec `unnest()` et `ANY()`
- **Après** : Test vectoriel unique avec `INTERSECT` (équivalent à `%in%` en R)

```sql
-- Score exact (100%) : Test vectoriel avec intersection
SELECT array_length(
    ARRAY(
        SELECT unnest(search_keywords_normalized)
        INTERSECT
        SELECT unnest(product_vector_normalized)
    ),
    1
)::REAL
```

## Notes importantes

- ✅ La migration est **idempotente** (peut être exécutée plusieurs fois sans problème)
- ✅ Elle utilise `CREATE OR REPLACE FUNCTION` pour éviter les erreurs
- ✅ La fonction sera mise à jour avec le nouveau test vectoriel


