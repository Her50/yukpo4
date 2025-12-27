# 🚀 Optimisation Critique Recherche Produits - 2025-12-27

## 🎯 Problème Identifié

La recherche de produits prend **18 secondes** malgré tous les index existants. Analyse des logs :

### Requêtes Lentes Identifiées
1. **Requête WITH autocomplete_matches** : **3.29s** ⚠️
2. **Requête avec ILIKE '%...%'** : **2.22s** ⚠️
3. **EXISTS avec jsonb_array_elements** : **très coûteux** (scan complet de tous les produits)
4. **Pool de connexions saturé** : 2-4s pour acquérir une connexion

### Causes Racines
1. **`ILIKE '%...%'` ne peut pas utiliser d'index B-tree** → Besoin d'index **trigram**
2. **`EXISTS` avec `jsonb_array_elements`** → Scan complet de tous les produits JSONB à chaque requête
3. **Requête trop complexe** avec plusieurs CTE et sous-requêtes corrélées

---

## ✅ Solutions Implémentées

### 1. Index Trigram pour ILIKE

**Migration** : `20251227_critical_fix_product_search_performance.sql`

#### Index sur `autocomplete_characteristics.valeur`
```sql
CREATE INDEX idx_autocomplete_valeur_trgm 
ON autocomplete_characteristics 
USING GIN (valeur gin_trgm_ops)
WHERE identifiant_base = 'produits' AND is_real_product = TRUE;
```

**Bénéfice** : Les requêtes `ac.valeur ILIKE '%...%'` peuvent maintenant utiliser cet index → **3.29s → <300ms**

#### Index sur `services.data->'titre_service'->>'valeur'`
```sql
CREATE INDEX idx_services_titre_service_trgm 
ON services 
USING GIN ((COALESCE(data->'titre_service'->>'valeur', '')) gin_trgm_ops)
WHERE is_active = true;
```

**Bénéfice** : Les requêtes `titre_service ILIKE '%...%'` peuvent utiliser cet index → **2.22s → <200ms**

### 2. Vue Matérialisée pour Produits

**Problème** : `EXISTS` avec `jsonb_array_elements` scanne tous les produits JSONB à chaque requête.

**Solution** : Vue matérialisée pré-calculée avec index :

```sql
CREATE MATERIALIZED VIEW services_products_search_cache AS
SELECT 
    s.id as service_id,
    s.is_active,
    s.category,
    s.gps,
    product->>'nom_produit' as nom_produit,
    product->>'nom' as nom,
    product->>'description_produit' as description_produit,
    product->>'description' as description,
    to_tsvector('french', ...) as product_tsvector,
    ... as product_text
FROM services s,
LATERAL jsonb_array_elements(...) AS product
WHERE s.is_active = true;
```

**Index créés** :
- `idx_services_products_search_cache_service_id` : Recherche par service_id
- `idx_services_products_search_cache_tsvector` : Recherche full-text GIN
- `idx_services_products_search_cache_text_trgm` : Recherche ILIKE avec trigram

**Bénéfice** : `EXISTS` remplacé par recherche dans vue matérialisée indexée → **<100ms** au lieu de scan complet

### 3. Optimisation Requête SQL

**Fichier** : `backend/src/services/native_search_service.rs`

**Changement** : Remplacement de :
```sql
OR EXISTS (
    SELECT 1
    FROM jsonb_array_elements(...) AS product
    WHERE product->>'nom_produit' ILIKE '%' || $1 || '%'
)
```

Par :
```sql
OR EXISTS (
    SELECT 1
    FROM services_products_search_cache psc
    WHERE psc.service_id = s.id
    AND psc.product_text ILIKE '%' || $1 || '%'  -- Utilise index trigram
)
```

---

## 📊 Résultats Attendus

| Requête | Avant | Après | Amélioration |
|---------|-------|-------|--------------|
| WITH autocomplete_matches | 3.29s | <300ms | **91% plus rapide** |
| ILIKE '%...%' | 2.22s | <200ms | **91% plus rapide** |
| EXISTS jsonb_array_elements | Très lent | <100ms | **>95% plus rapide** |
| **Temps total recherche** | **18s** | **<500ms** | **97% plus rapide** |

---

## 🚀 Application des Optimisations

### Étape 1 : Exécuter la Migration

```bash
# Depuis le répertoire backend
sqlx migrate run
```

Ou manuellement :
```sql
\i backend/migrations/20251227_critical_fix_product_search_performance.sql
```

### Étape 2 : Vérifier les Index Créés

```sql
-- Vérifier les index trigram
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename IN ('autocomplete_characteristics', 'services')
AND indexdef LIKE '%trgm%';

-- Vérifier la vue matérialisée
SELECT * FROM pg_matviews WHERE matviewname = 'services_products_search_cache';
```

### Étape 3 : Rafraîchir la Vue Matérialisée

La vue est rafraîchie automatiquement lors de la migration, mais pour les mises à jour futures :

```sql
SELECT refresh_services_products_search_cache();
```

**Recommandation** : Configurer un job cron pour rafraîchir toutes les 15 minutes :
```sql
SELECT cron.schedule('refresh-products-cache', '*/15 * * * *', 
  'SELECT refresh_services_products_search_cache()');
```

### Étape 4 : Tester la Performance

```bash
# Tester une recherche
curl -X POST https://yukpomnang.onrender.com/api/search/direct \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"texte": "Chaussures"}'
```

**Temps attendu** : <500ms au lieu de 18s

---

## 🔧 Maintenance

### Rafraîchir la Vue Matérialisée

Après chaque modification de services (création/modification de produits) :

```sql
SELECT refresh_services_products_search_cache();
```

### Monitoring

Vérifier les requêtes lentes dans les logs :
```sql
-- Activer log des requêtes lentes (>1s)
SET log_min_duration_statement = 1000;
```

### Index Maintenance

Les index trigram peuvent être volumineux. Vérifier la taille :
```sql
SELECT 
    schemaname,
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
WHERE indexname LIKE '%trgm%'
ORDER BY pg_relation_size(indexrelid) DESC;
```

---

## ⚠️ Notes Importantes

1. **Extension pg_trgm** : Doit être activée (fait automatiquement dans la migration)
2. **Taille des index** : Les index trigram peuvent être volumineux (10-20% de la taille de la table)
3. **Rafraîchissement vue** : La vue doit être rafraîchie après chaque modification de produits
4. **Compatibilité** : La requête optimisée utilise la vue matérialisée, mais a un fallback si elle n'existe pas

---

## 📝 Fichiers Modifiés

1. **Migration** : `backend/migrations/20251227_critical_fix_product_search_performance.sql`
2. **Code Rust** : `backend/src/services/native_search_service.rs` (ligne ~509-531)

---

## 🎯 Prochaines Étapes (Optionnel)

1. **Cache Redis** : Ajouter un cache Redis pour les recherches fréquentes
2. **Partitionnement** : Partitionner la table `services` par catégorie si elle devient très grande
3. **Monitoring** : Ajouter des métriques de performance pour surveiller les temps de réponse
4. **Pool de connexions** : Augmenter la taille du pool si les connexions sont encore lentes

---

## ✅ Checklist de Déploiement

- [ ] Exécuter la migration sur la base de données
- [ ] Vérifier que les index sont créés
- [ ] Vérifier que la vue matérialisée est créée et rafraîchie
- [ ] Tester une recherche et vérifier le temps de réponse (<500ms)
- [ ] Configurer le job cron pour rafraîchir la vue toutes les 15 minutes
- [ ] Monitorer les logs pour vérifier l'amélioration

---

**Date** : 2025-12-27  
**Auteur** : Auto (Cursor AI)  
**Impact** : Critique - Performance recherche produits

