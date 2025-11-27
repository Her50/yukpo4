# Analyse : Pourquoi les migrations n'ont pas été appliquées

## 🔍 Problème identifié

Les migrations suivantes n'ont pas été appliquées :
1. `20251127_fix_geo_hierarchy_unique_constraint.sql`
2. `20251127_optimize_services_queries_indexes.sql`

## 📋 Format de nommage SQLx

SQLx extrait le **numéro de version** depuis le **début du nom de fichier** jusqu'au premier underscore `_`.

### Format attendu
```
VERSION_DESCRIPTION.sql
```

Où `VERSION` est un nombre (timestamp Unix ou numéro séquentiel).

### Exemples de migrations existantes qui fonctionnent

1. **Format avec numéro séquentiel** :
   - `20251127_120002_optimize_slow_queries.sql` → Version: `20251127`
   - `20251127_120001_fix_search_services_gps_final.sql` → Version: `20251127`
   - `20251127_120000_create_get_product_reactions_count.sql` → Version: `20251127`

2. **Format avec date seulement** :
   - `20251127_optimize_get_services_performance.sql` → Version: `20251127`
   - `20251127_add_blood_group_to_users.sql` → Version: `20251127`
   - `20251126_optimize_search_indexes.sql` → Version: `20251126`

## ⚠️ Problème potentiel

**Conflit de version** : Si plusieurs migrations ont la même date (20251127), SQLx peut avoir des problèmes d'ordre d'exécution.

SQLx trie les migrations par **version numérique croissante**. Si deux migrations ont la même version (20251127), l'ordre d'exécution dépend de l'ordre alphabétique du nom de fichier.

## ✅ Solution recommandée

### Option 1 : Utiliser un numéro séquentiel unique (RECOMMANDÉ)

Renommer les migrations avec un numéro séquentiel unique :

```bash
# Migration 1
20251127_120003_fix_geo_hierarchy_unique_constraint.sql

# Migration 2  
20251127_120004_optimize_services_queries_indexes.sql
```

**Avantages** :
- Ordre d'exécution garanti
- Pas de conflit de version
- Compatible avec SQLx

### Option 2 : Utiliser un timestamp plus précis

```bash
# Migration 1
20251127120003_fix_geo_hierarchy_unique_constraint.sql

# Migration 2
20251127120004_optimize_services_queries_indexes.sql
```

## 🔧 Vérification de l'application

Pour vérifier si les migrations ont été appliquées :

```sql
-- Vérifier dans la table _sqlx_migrations
SELECT version, description, installed_on, success 
FROM _sqlx_migrations 
WHERE description LIKE '%geo_hierarchy%' 
   OR description LIKE '%optimize_services%'
ORDER BY installed_on DESC;
```

## 📝 Actions à prendre

1. **Vérifier l'ordre alphabétique** : Les migrations actuelles sont peut-être appliquées mais dans le mauvais ordre
2. **Renommer avec numéros séquentiels** : Pour garantir l'ordre d'exécution
3. **Vérifier les logs** : Regarder les logs du backend au démarrage pour voir si les migrations sont appliquées
4. **Tester localement** : Exécuter `sqlx migrate run` pour voir les erreurs éventuelles

## 🎯 Format final recommandé

Pour les nouvelles migrations, utiliser :

```
YYYYMMDD_NNNNNN_description.sql
```

Où :
- `YYYYMMDD` = Date (20251127)
- `NNNNNN` = Numéro séquentiel à 6 chiffres (120003, 120004, etc.)
- `description` = Description claire en snake_case

Exemple :
- `20251127_120003_fix_geo_hierarchy_unique_constraint.sql`
- `20251127_120004_optimize_services_queries_indexes.sql`

