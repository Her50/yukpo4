# 📊 Analyse des Index sur la Table `services` - 29 Novembre 2025

## 🔍 Constat

**Total d'index** : **92 index** (pas 11 !)

L'utilisateur a raison de s'interroger : il y a beaucoup d'index, probablement trop.

---

## 📋 Catégorisation des Index

### 1. Index avec `unaccent_immutable()` (NOUVEAUX - 5 index)
- ✅ `idx_services_titre_service_unaccent_trgm`
- ✅ `idx_services_titre_service_unaccent_fts`
- ✅ `idx_services_description_unaccent_trgm`
- ✅ `idx_services_description_unaccent_fts`
- ✅ `idx_services_category_unaccent_trgm`

**Statut** : ✅ **UTILISÉS** (code Rust modifié pour utiliser `unaccent_immutable()`)

---

### 2. Index Produits JSONB (6 index)
- `idx_services_produits_gin`
- `idx_services_produits_gin_optimized`
- `idx_services_produits_jsonb_path_ops`
- `idx_services_produits_characteristic_vector_gin`
- `idx_services_data_produits_gin`
- `idx_services_data_produits_extraction_gin`

**Statut** : ⚠️ **DOUBLONS POTENTIELS** (plusieurs index similaires)

---

### 3. Index Titre Service (15+ index)
- `idx_services_titre_service_fts`
- `idx_services_titre_service_trgm`
- `idx_services_titre_service_trgm_keyword`
- `idx_services_titre_service_tsvector`
- `idx_services_titre_service_unaccent_fts` ✅
- `idx_services_titre_service_unaccent_trgm` ✅
- `idx_services_titre_service_search`
- `idx_services_data_titre_service_gin`
- `idx_services_structured_titre`
- `idx_services_structured_trigram_titre`
- `idx_services_fulltext_titre`
- `idx_services_trgm_titre`
- `idx_services_trigram_titre`
- ... et d'autres

**Statut** : ⚠️ **BEAUCOUP DE DOUBLONS** (même champ, différentes expressions)

---

### 4. Index Description (10+ index)
- `idx_services_description_fts`
- `idx_services_description_trgm`
- `idx_services_description_trgm_keyword`
- `idx_services_description_tsvector`
- `idx_services_description_unaccent_fts` ✅
- `idx_services_description_unaccent_trgm` ✅
- `idx_services_data_description_gin`
- `idx_services_structured_description`
- `idx_services_structured_trigram_description`
- `idx_services_fulltext_description`
- `idx_services_trgm_description`
- `idx_services_trigram_description`
- ... et d'autres

**Statut** : ⚠️ **BEAUCOUP DE DOUBLONS**

---

### 5. Index Category (10+ index)
- `idx_services_category_active`
- `idx_services_category_direct`
- `idx_services_category_search`
- `idx_services_category_trgm`
- `idx_services_category_trgm_keyword`
- `idx_services_category_tsvector`
- `idx_services_category_unaccent_trgm` ✅
- `idx_services_fulltext_category`
- `idx_services_structured_category`
- `idx_services_structured_trigram_category`
- `idx_services_trgm_category`
- `idx_services_trigram_category`
- ... et d'autres

**Statut** : ⚠️ **BEAUCOUP DE DOUBLONS**

---

### 6. Index GPS (8+ index)
- `idx_services_gps_btree`
- `idx_services_gps_gist`
- `idx_services_gps_search`
- `idx_services_gps_trgm`
- `idx_services_gps_trigram`
- `idx_services_gps_fixe_trgm`
- `idx_services_geo_category`
- `idx_services_location_geog`
- `idx_services_location_geom`
- ... et d'autres

**Statut** : ⚠️ **DOUBLONS** (plusieurs types d'index pour GPS)

---

### 7. Index User/Created (10+ index)
- `idx_services_user_active`
- `idx_services_user_active_created`
- `idx_services_user_id_count`
- `idx_services_user_id_created_at`
- `idx_services_user_id_created_at_desc`
- `idx_services_user_id_created_at_desc_count`
- `idx_services_user_id_created_at_desc_optimized`
- `idx_services_user_id_is_active_created_at`
- `idx_services_user_status`
- ... et d'autres

**Statut** : ⚠️ **DOUBLONS** (même combinaison de colonnes)

---

### 8. Index Full-Text Combinés (5+ index)
- `idx_services_fulltext_combined`
- `idx_services_fulltext_optimized`
- `idx_services_search_combined_tsvector`
- `idx_services_trigram_combined`
- ... et d'autres

**Statut** : ⚠️ **DOUBLONS** (même logique, différentes expressions)

---

## ⚠️ Problèmes Identifiés

### 1. **Trop d'Index** (92 index)
- PostgreSQL doit maintenir tous ces index à chaque INSERT/UPDATE/DELETE
- Impact sur les performances d'écriture
- Consommation mémoire importante

### 2. **Doublons**
- Plusieurs index pour le même champ avec des expressions similaires
- Exemple : `idx_services_titre_service_trgm` et `idx_services_titre_service_unaccent_trgm` (le 2ème est meilleur)

### 3. **Index Non Utilisés**
- Certains index créés pour des tests ou migrations anciennes
- Non utilisés par le code actuel

### 4. **Index Redondants**
- Exemple : `idx_services_produits_gin` et `idx_services_produits_gin_optimized` (même logique)

---

## ✅ Recommandations

### 1. **Garder les Index Essentiels**

#### Index avec `unaccent_immutable()` (NOUVEAUX - GARDER)
- ✅ `idx_services_titre_service_unaccent_trgm`
- ✅ `idx_services_titre_service_unaccent_fts`
- ✅ `idx_services_description_unaccent_trgm`
- ✅ `idx_services_description_unaccent_fts`
- ✅ `idx_services_category_unaccent_trgm`

#### Index Produits (GARDER 1-2)
- ✅ `idx_services_produits_jsonb_path_ops` (le plus performant)
- ⚠️ Supprimer les doublons (`idx_services_produits_gin`, `idx_services_produits_gin_optimized`)

#### Index GPS (GARDER 1-2)
- ✅ `idx_services_gps_gist` (pour PostGIS)
- ✅ `idx_services_gps_search` (pour recherche simple)
- ⚠️ Supprimer les doublons (`idx_services_gps_trgm`, `idx_services_gps_trigram`)

#### Index User/Created (GARDER 1-2)
- ✅ `idx_services_user_id_created_at_desc_optimized` (le plus complet)
- ⚠️ Supprimer les doublons

### 2. **Supprimer les Doublons**

**Index à supprimer** (exemples) :
- `idx_services_titre_service_trgm` (remplacé par `idx_services_titre_service_unaccent_trgm`)
- `idx_services_description_trgm` (remplacé par `idx_services_description_unaccent_trgm`)
- `idx_services_category_trgm` (remplacé par `idx_services_category_unaccent_trgm`)
- `idx_services_produits_gin` (doublon de `idx_services_produits_gin_optimized`)
- ... et beaucoup d'autres

### 3. **Script de Nettoyage**

Créer un script SQL pour :
1. Identifier les index non utilisés (via `pg_stat_user_indexes`)
2. Supprimer les doublons (garder le plus récent/performant)
3. Vérifier l'impact avant suppression

---

## 📊 Impact Actuel

### Avantages
- ✅ Beaucoup d'index = requêtes SELECT rapides (si index utilisés)

### Inconvénients
- ❌ INSERT/UPDATE/DELETE lents (doit mettre à jour 92 index)
- ❌ Consommation mémoire importante
- ❌ Maintenance complexe

---

## 🎯 Conclusion

**OUI, il y a trop d'index (92)** :
- Beaucoup de doublons
- Index non utilisés
- Impact négatif sur les performances d'écriture

**Recommandation** : Nettoyer et garder seulement les index essentiels (20-30 index max).

**Les 5 nouveaux index avec `unaccent_immutable()` sont les bons à garder** car ils sont utilisés par le code Rust corrigé.

