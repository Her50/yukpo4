# 📊 Évaluation des 43 Index Restants - 29 Novembre 2025

## 🎯 Question : Les 43 index sont-ils tous nécessaires et utiles ?

### ⚠️ Important : Analyse des Statistiques

**Note** : `pg_stat_user_indexes` montre l'utilisation depuis le dernier redémarrage de PostgreSQL ou depuis la dernière réinitialisation des statistiques.

**Si `idx_scan = 0`**, cela peut signifier :
1. ❌ L'index n'a jamais été utilisé (non nécessaire)
2. ⚠️ L'index vient d'être créé (pas encore utilisé - normal)
3. ⚠️ Les statistiques n'ont pas été mises à jour

---

## 📋 Catégorisation des 43 Index

### ✅ Index ESSENTIELS (15-20 index) - À GARDER ABSOLUMENT

#### 1. Index avec unaccent_immutable() (5 index) - NOUVEAUX
- ✅ `idx_services_titre_service_unaccent_trgm` (40 kB)
- ✅ `idx_services_titre_service_unaccent_fts` (16 kB)
- ✅ `idx_services_description_unaccent_trgm` (56 kB)
- ✅ `idx_services_description_unaccent_fts` (16 kB)
- ✅ `idx_services_category_unaccent_trgm` (16 kB)

**Statut** : ✅ **ESSENTIELS** - Utilisés par le code Rust corrigé
**Utilisation** : Même si `idx_scan = 0` maintenant, ils seront utilisés dès que les requêtes avec `unaccent_immutable()` seront exécutées.

#### 2. Index produits (7 index)
- ✅ `idx_services_produits_jsonb_path_ops` (16 kB) - Le plus performant
- ✅ `idx_services_produits_gin_optimized` (32 kB) - Optimisé
- ✅ `idx_services_produits_characteristic_vector_gin` (24 kB)
- ✅ `idx_services_products_fulltext_all` (24 kB)
- ✅ `idx_services_products_tsvector` (16 kB)
- ✅ `idx_services_products_nom_optimized` (24 kB)
- ✅ `idx_services_products_type_optimized` (24 kB)

**Statut** : ✅ **ESSENTIELS** - Pour recherche dans produits JSONB
**Utilisation** : Utilisés par `search_products_optimized()` et `search_services_gps_final()`

#### 3. Index GPS (5 index)
- ✅ `idx_services_gps_gist` (8 kB) - PostGIS (le plus performant)
- ✅ `idx_services_gps_search` (16 kB) - Recherche simple
- ✅ `idx_services_location_geog` (8 kB) - PostGIS
- ✅ `idx_services_location_geom` (8 kB) - PostGIS
- ✅ `idx_services_geo_category` (8 kB)

**Statut** : ✅ **ESSENTIELS** - Pour recherches géographiques
**Utilisation** : Utilisés par `search_services_gps_final()` et recherches GPS

#### 4. Index user/created (2 index)
- ✅ `idx_services_user_id_created_at_desc_optimized` (16 kB)
- ✅ `idx_services_user_id_count` (16 kB)

**Statut** : ✅ **ESSENTIELS** - Pour requêtes par utilisateur

#### 5. Index recherche (3 index)
- ✅ `idx_services_search_combined_tsvector` (16 kB)
- ✅ `idx_services_search_composite` (16 kB)
- ✅ `idx_services_search_optimized` (16 kB)

**Statut** : ✅ **ESSENTIELS** - Pour recherches full-text combinées

#### 6. Index clé primaire (1 index)
- ✅ `services_pkey` (16 kB)

**Statut** : ✅ **ESSENTIEL** - Clé primaire (obligatoire)

---

### ⚠️ Index POTENTIELLEMENT NON NÉCESSAIRES (10-15 index)

#### 1. Index spécialisés (peu utilisés ?)
- ⚠️ `idx_services_pharmacy_scheduling` (16 kB)
- ⚠️ `idx_services_hospital_scheduling` (16 kB)
- ⚠️ `idx_services_specialized_type` (16 kB)

**Statut** : ⚠️ **À ÉVALUER** - Utilisés seulement pour recherches spécialisées

#### 2. Index autres champs (peu utilisés ?)
- ⚠️ `idx_services_embedding_status` (16 kB)
- ⚠️ `idx_services_interaction_count` (16 kB)
- ⚠️ `idx_services_rating_avg` (16 kB)
- ⚠️ `idx_services_rating_count` (16 kB)
- ⚠️ `idx_services_promotion` (24 kB)
- ⚠️ `idx_services_tarissable_reactivation` (8 kB)
- ⚠️ `idx_services_search_radius` (8 kB)
- ⚠️ `idx_services_has_media` (8 kB)
- ⚠️ `idx_services_logo` (8 kB)
- ⚠️ `idx_services_banniere` (8 kB)
- ⚠️ `idx_services_id_for_update` (16 kB)

**Statut** : ⚠️ **À ÉVALUER** - Utilisés seulement pour requêtes spécifiques

#### 3. Index autres (peu utilisés ?)
- ⚠️ `idx_services_active_created` (16 kB)
- ⚠️ `idx_services_is_active_created_at` (16 kB)
- ⚠️ `idx_services_category_active` (8 kB)
- ⚠️ `idx_services_category_search` (16 kB)
- ⚠️ `idx_services_titre_service_search` (16 kB)
- ⚠️ `idx_services_data_search_gin` (56 kB)

**Statut** : ⚠️ **À ÉVALUER** - Peuvent être redondants avec d'autres index

---

## 🔍 Analyse Recommandée

### Étape 1: Vérifier l'Utilisation Réelle

Exécuter le script `ANALYSE_UTILISATION_INDEX_43.sql` pour voir :
- Quels index ont `idx_scan = 0` (jamais utilisés)
- Quels index ont `idx_scan < 10` (peu utilisés)
- Quels index sont très utilisés

### Étape 2: Identifier les Index à Supprimer

**Candidats pour suppression** :
1. Index avec `idx_scan = 0` ET qui ne sont pas essentiels
2. Index redondants (même fonction qu'un autre index)
3. Index pour fonctionnalités non utilisées

### Étape 3: Garder les Index Essentiels

**À garder absolument** :
- ✅ 5 index avec `unaccent_immutable()` (nouveaux, utilisés par code Rust)
- ✅ 7 index produits (utilisés par recherche produits)
- ✅ 5 index GPS (utilisés par recherche GPS)
- ✅ 2 index user/created (utilisés par requêtes utilisateur)
- ✅ 3 index recherche (utilisés par full-text search)
- ✅ 1 clé primaire

**Total essentiels** : ~23 index

---

## 📊 Estimation Finale

### Index Essentiels : ~23 index
- 5 unaccent_immutable()
- 7 produits
- 5 GPS
- 2 user/created
- 3 recherche
- 1 clé primaire

### Index à Évaluer : ~20 index
- 10-15 index peuvent être supprimés si non utilisés
- 5-10 index peuvent être gardés si utilisés

### Objectif Final : ~25-30 index
- Réduction supplémentaire possible de 13-18 index
- Mais seulement si les statistiques montrent qu'ils ne sont pas utilisés

---

## ⚠️ Précautions

1. **Ne pas supprimer trop vite** : Les index peuvent être utilisés pour des requêtes rares mais importantes
2. **Vérifier les statistiques** : Attendre que les requêtes soient exécutées pour avoir des statistiques fiables
3. **Tester avant suppression** : Vérifier l'impact sur les performances

---

## ✅ Recommandation

**Pour l'instant** : Garder les 43 index car :
1. ✅ Les 5 index avec `unaccent_immutable()` sont essentiels (nouveaux)
2. ✅ Les index produits/GPS/user sont essentiels
3. ⚠️ Les autres index peuvent être utilisés pour des requêtes rares

**Après quelques jours/semaines** :
1. Exécuter `ANALYSE_UTILISATION_INDEX_43.sql`
2. Identifier les index avec `idx_scan = 0` depuis longtemps
3. Supprimer seulement ceux qui sont vraiment non utilisés

**Objectif** : Réduire de 43 à ~25-30 index (si statistiques le confirment)

