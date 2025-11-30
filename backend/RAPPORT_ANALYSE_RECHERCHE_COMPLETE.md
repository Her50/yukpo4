# Rapport d'analyse complète de la recherche

## Date : 2025-12-01

## Termes testés
- chaussures
- plombier
- photographe
- restaurant
- électricien

## Résultats des tests

### 1. Chaussures ✅

**Autocomplete :**
- Temps : 325.49 ms
- Résultats : 2 services (58, 157)
- ✅ Fonctionne correctement

**Recherche directe :**
- Temps : 1075.31 ms
- Résultats : 3 services (2, 58, 157)
- ✅ Fonctionne mais trouve 1 service supplémentaire (service 2)

**Analyse :**
- Service 2 : "Chaussures pour femmes - Vente" n'a pas d'entrée dans `autocomplete_characteristics`
- La recherche directe le trouve car elle cherche aussi dans `titre_service`
- Performance : Autocomplete 3.3x plus rapide

### 2. Plombier ❌

**Autocomplete :**
- Temps : 163.87 ms
- Résultats : 0
- ❌ Ne trouve pas le service 5

**Recherche directe :**
- Temps : 925.87 ms
- Résultats : 0
- ❌ Ne trouve pas le service 5

**Service existant :**
- Service 5 : "Services de plomberie à domicile"
- Problème : Le titre contient "plomberie" mais la recherche cherche "plombier"
- Pas d'entrée dans `autocomplete_characteristics`
- Pas de produits dans `services.data->'produits'`

**Solution nécessaire :**
- Utiliser la similarité (pg_trgm) au lieu de `ILIKE` pour le titre_service
- Ou enrichir avec des variations (plombier → plomberie)

### 3. Photographe ❌

**Autocomplete :**
- Temps : 171.03 ms
- Résultats : 0
- ❌ Ne trouve pas le service 13

**Recherche directe :**
- Temps : 967.04 ms
- Résultats : 0
- ❌ Ne trouve pas le service 13

**Service existant :**
- Service 13 : "Services de photographie professionnelle"
- Problème : Le titre contient "photographie" mais la recherche cherche "photographe"
- A des produits dans `autocomplete_characteristics` mais le full_vector ne contient pas "photographe"

**Solution nécessaire :**
- Utiliser la similarité pour le titre_service
- Enrichir autocomplete_characteristics.full_vector avec des variations

### 4. Restaurant ❌

**Autocomplete :**
- Temps : 161.90 ms
- Résultats : 0
- ❌ Aucun service trouvé

**Recherche directe :**
- Temps : 1024.31 ms
- Résultats : 0
- ❌ Aucun service trouvé

**Analyse :**
- Aucun service avec "restaurant" dans la base de données
- L'utilisateur dit que ces produits existent, peut-être avec un nom différent

### 5. Électricien ❌

**Autocomplete :**
- Temps : 172.78 ms
- Résultats : 0
- ❌ Ne trouve pas le service 155

**Recherche directe :**
- Temps : 1023.39 ms
- Résultats : 0
- ❌ Ne trouve pas le service 155

**Service existant :**
- Service 155 : "Services d'électricité à Douala"
- Problème : Le titre contient "électricité" mais la recherche cherche "électricien"
- A des produits dans `autocomplete_characteristics` mais le full_vector ne contient pas "électricien"

**Solution nécessaire :**
- Utiliser la similarité pour le titre_service
- Enrichir autocomplete_characteristics.full_vector avec des variations

## Problèmes identifiés

### 1. Recherche dans titre_service utilise ILIKE au lieu de similarité

**Problème :**
- La recherche directe utilise `ILIKE '%terme%'` pour le titre_service
- Cela ne trouve pas "plomberie" quand on cherche "plombier"
- Cela ne trouve pas "photographie" quand on cherche "photographe"
- Cela ne trouve pas "électricité" quand on cherche "électricien"

**Solution :**
- Utiliser `similarity()` avec pg_trgm pour le titre_service
- Seuil de similarité : > 0.3 ou > 0.4

### 2. Autocomplete ne trouve pas les services sans produits

**Problème :**
- L'autocomplete cherche uniquement dans `autocomplete_characteristics`
- Les services sans produits (comme service 5) ne sont pas dans `autocomplete_characteristics`
- Donc l'autocomplete ne les trouve pas

**Solution :**
- Enrichir l'autocomplete pour aussi chercher dans `services.data->'titre_service'`
- Ou créer des entrées dans `autocomplete_characteristics` pour tous les services

### 3. Performance

**Observations :**
- Autocomplete : ~160-325 ms (moyenne : 199 ms)
- Recherche directe : ~925-1075 ms (moyenne : 1003 ms)
- Autocomplete est **5x plus rapide** en moyenne

**Raisons :**
- Autocomplete : Requête simple sur `autocomplete_characteristics` avec index GIN
- Recherche directe : Requête complexe avec CTE, extract_all_product_text, plusieurs jointures

## Recommandations

### 1. Correction immédiate : Utiliser similarité pour titre_service

Modifier `fulltext_search_with_gps` pour utiliser `similarity()` au lieu de `ILIKE` pour le titre_service :

```sql
-- Au lieu de :
OR COALESCE(ape.data->>'titre_service', ape.data->'titre_service'->>'valeur', '') ILIKE '%' || $1 || '%'

-- Utiliser :
OR similarity(LOWER(COALESCE(ape.data->'titre_service'->>'valeur', '')), LOWER($1)) > 0.3
```

### 2. Enrichir autocomplete avec titre_service

Modifier l'autocomplete pour aussi chercher dans `services.data->'titre_service'` pour les services sans produits.

### 3. Optimisation performance

- Ajouter des index sur `services.data->'titre_service'` avec tsvector
- Utiliser des index GIN pour la similarité

## Statistiques globales

- **Temps moyen autocomplete :** 199.02 ms
- **Temps moyen recherche directe :** 1003.18 ms
- **Ratio performance :** Autocomplete 5x plus rapide
- **Services trouvés autocomplete :** 2
- **Services trouvés recherche directe :** 3
- **Services manquants :** 3 (plombier, photographe, électricien) - existent mais pas trouvés à cause de variations de mots

