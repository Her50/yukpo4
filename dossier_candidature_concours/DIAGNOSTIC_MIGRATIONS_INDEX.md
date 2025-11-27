# Diagnostic - Migrations d'Index Non Appliquées

## Date
2025-11-27

## Problème
Les migrations d'index existent déjà mais ne s'exécutent peut-être pas :
- `20251127_120004_optimize_services_queries_indexes.sql`
- `20251126_fix_services_user_id_created_at_index.sql`
- `20251127_optimize_get_services_performance.sql`

## Causes possibles

### 1. Format de nom de fichier incorrect
SQLx attend le format : `YYYYMMDD_HHMMSS_description.sql` ou `YYYYMMDD_NNN_description.sql`

**Vérification :**
- `20251127_120004_optimize_services_queries_indexes.sql` ✅ Format correct
- `20251126_fix_services_user_id_created_at_index.sql` ✅ Format correct
- `20251127_optimize_get_services_performance.sql` ⚠️ Manque le numéro séquentiel

### 2. Migration déjà appliquée mais index non créés
- La migration peut avoir été marquée comme appliquée dans `_sqlx_migrations`
- Mais l'exécution SQL a peut-être échoué silencieusement
- Ou les index ont été supprimés après

### 3. Migration non appliquée
- La migration n'a jamais été exécutée
- Problème de connexion à la base lors du démarrage
- Erreur dans le fichier SQL qui empêche l'exécution

## Solutions

### Solution 1 : Vérifier l'état des migrations

```bash
cd backend

# Vérifier quelles migrations sont appliquées
sqlx migrate info

# Ou directement en SQL
psql $DATABASE_URL -c "
SELECT version, description, installed_on, success 
FROM _sqlx_migrations 
WHERE description LIKE '%index%' OR description LIKE '%optimize%'
ORDER BY installed_on DESC;
"
```

### Solution 2 : Vérifier si les index existent

```bash
# Exécuter le script de diagnostic
psql $DATABASE_URL -f scripts/check_indexes.sql
```

### Solution 3 : Appliquer manuellement les index manquants

Si les migrations ne s'exécutent pas, appliquer manuellement :

```bash
# Option 1 : Via le script SQL
psql $DATABASE_URL -f scripts/apply_missing_indexes.sql

# Option 2 : Via sqlx migrate run (si les migrations ne sont pas appliquées)
cd backend
sqlx migrate run
```

### Solution 4 : Corriger le format de nom si nécessaire

Si `20251127_optimize_get_services_performance.sql` n'est pas reconnu :

```bash
# Renommer avec format correct
mv migrations/20251127_optimize_get_services_performance.sql \
   migrations/20251127_120005_optimize_get_services_performance.sql
```

## Scripts créés

1. **`backend/scripts/check_indexes.sql`** - Diagnostic complet
   - Liste les migrations appliquées
   - Vérifie si les index existent
   - Identifie les index manquants
   - Affiche les statistiques de table

2. **`backend/scripts/apply_missing_indexes.sql`** - Application manuelle
   - Crée tous les index nécessaires
   - Utilise `IF NOT EXISTS` pour éviter les erreurs
   - Exécute `ANALYZE` pour mettre à jour les statistiques

## Commandes de diagnostic

### Vérifier les migrations appliquées
```bash
cd backend
sqlx migrate info
```

### Vérifier les index existants
```sql
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'services' 
  AND indexname LIKE '%user_id%' 
ORDER BY indexname;
```

### Vérifier les index manquants
```sql
-- Index attendus
SELECT 'idx_services_user_id_created_at' as expected_index
WHERE NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'services' 
    AND indexname = 'idx_services_user_id_created_at'
);
```

## Actions recommandées

1. **Exécuter le diagnostic** : `psql $DATABASE_URL -f backend/scripts/check_indexes.sql`
2. **Vérifier les logs** : Chercher les erreurs de migration dans les logs backend
3. **Appliquer manuellement si nécessaire** : `psql $DATABASE_URL -f backend/scripts/apply_missing_indexes.sql`
4. **Vérifier les performances** : Tester `get_services_for_prestataire` après application

## Notes

- Les migrations SQLx s'exécutent au démarrage du backend (voir `main.rs` ligne 138)
- Si une migration échoue, le backend continue quand même (ligne 147)
- Les index peuvent être créés manuellement sans problème (utilisation de `IF NOT EXISTS`)

