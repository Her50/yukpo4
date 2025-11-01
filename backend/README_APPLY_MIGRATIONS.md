# 🔧 Instructions pour appliquer les migrations manquantes en production

## Problème identifié

Les erreurs suivantes apparaissent en production :
1. `function hybrid_image_search(...) does not exist`
2. `relation "image_analyses" does not exist`
3. `relation "search_history" does not exist`

## Migrations à appliquer

### Ordre d'application (IMPORTANT)

1. **20251026_create_image_analyses_table.sql** - Crée la table `image_analyses`
   - ✅ Crée uniquement la table et la fonction helper `calculate_image_match_score`
   - ✅ La fonction `hybrid_image_search` incorrecte a été supprimée de cette migration

2. **20251027_create_hybrid_image_search_function.sql** - Crée la fonction `hybrid_image_search` CORRECTE
   - ✅ Utilise `search_query_semantic` (compatible avec le code Rust)
   - ✅ Renommée depuis `20250122` pour être appliquée APRÈS la création de la table
   - ✅ Sera appliquée automatiquement par `sqlx migrate run` dans le bon ordre

3. **20251031_002_create_search_history.sql** - Crée la table `search_history`

## Méthode 1 : Via Render Shell (Recommandé)

```bash
# Se connecter au shell Render de votre service backend
# Puis exécuter :

cd /opt/render/project/src/backend

# Appliquer les migrations dans l'ordre
psql $DATABASE_URL -f migrations/20251026_create_image_analyses_table.sql
psql $DATABASE_URL -f migrations/20250122_create_hybrid_image_search_function.sql
psql $DATABASE_URL -f migrations/20251031_002_create_search_history.sql

# Vérifier que tout est créé
psql $DATABASE_URL -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'image_analyses');"
psql $DATABASE_URL -c "SELECT EXISTS (SELECT FROM pg_proc WHERE proname = 'hybrid_image_search');"
psql $DATABASE_URL -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'search_history');"
```

## Méthode 2 : Via script PowerShell (Local avec DATABASE_URL)

```powershell
# Définir DATABASE_URL
$env:DATABASE_URL = "postgresql://user:password@host:port/database"

# Exécuter le script
cd backend
.\apply_missing_migrations.ps1
```

## Méthode 3 : Via script Bash (Local ou Render)

```bash
# Définir DATABASE_URL
export DATABASE_URL="postgresql://user:password@host:port/database"

# Exécuter le script
cd backend
chmod +x apply_missing_migrations.sh
./apply_missing_migrations.sh
```

## Vérification post-migration

```sql
-- Vérifier la table image_analyses
SELECT COUNT(*) FROM image_analyses;

-- Vérifier la fonction hybrid_image_search (doit avoir search_query_semantic)
SELECT 
    proname, 
    pg_get_function_arguments(oid) as arguments
FROM pg_proc 
WHERE proname = 'hybrid_image_search';

-- Vérifier la table search_history
SELECT COUNT(*) FROM search_history;
```

## Note importante

La migration `20251026_create_image_analyses_table.sql` crée une version de `hybrid_image_search` avec le paramètre `search_description`, mais le code Rust utilise `search_query_semantic`. La migration `20250122_create_hybrid_image_search_function.sql` corrige cela en créant la bonne version avec `search_query_semantic`.

## Dépannage

Si vous obtenez une erreur "function already exists" :
```sql
-- Supprimer l'ancienne version incorrecte
DROP FUNCTION IF EXISTS hybrid_image_search(text[], text, text, text, text, double precision, double precision, integer, integer);

-- Réappliquer la bonne migration
\i migrations/20250122_create_hybrid_image_search_function.sql
```

