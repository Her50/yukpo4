# 🧹 Exécution du Nettoyage des Index - 29 Novembre 2025

## 📊 Analyse DRY RUN

### Index Identifiés à Supprimer

#### 1. Index titre_service (11 index → garder 2)
**À supprimer** :
- `idx_services_titre_service_trgm` (40 kB)
- `idx_services_titre_service_trgm_keyword` (32 kB)
- `idx_services_titre_service_fts` (24 kB)
- `idx_services_titre_service_tsvector` (16 kB)
- `idx_services_fulltext_titre` (non listé mais existe)
- `idx_services_trgm_titre` (non listé mais existe)
- `idx_services_trigram_titre` (non listé mais existe)
- `idx_services_structured_titre` (24 kB)
- `idx_services_structured_trigram_titre` (non listé mais existe)
- `idx_services_data_titre_service_gin` (16 kB)

**À garder** :
- ✅ `idx_services_titre_service_unaccent_trgm` (40 kB) - NOUVEAU
- ✅ `idx_services_titre_service_unaccent_fts` (16 kB) - NOUVEAU

#### 2. Index description (11 index → garder 2)
**À supprimer** :
- `idx_services_description_trgm` (64 kB)
- `idx_services_description_trgm_keyword` (48 kB)
- `idx_services_description_fts` (24 kB)
- `idx_services_description_tsvector` (16 kB)
- `idx_services_fulltext_description` (40 kB)
- `idx_services_trgm_description` (176 kB)
- `idx_services_trigram_description` (200 kB)
- `idx_services_structured_description` (32 kB)
- `idx_services_structured_trigram_description` (120 kB)
- `idx_services_data_description_gin` (16 kB)

**À garder** :
- ✅ `idx_services_description_unaccent_trgm` (56 kB) - NOUVEAU
- ✅ `idx_services_description_unaccent_fts` (16 kB) - NOUVEAU

#### 3. Index category (10 index → garder 1)
**À supprimer** :
- `idx_services_category_trgm` (24 kB)
- `idx_services_category_trgm_keyword` (16 kB)
- `idx_services_category_tsvector` (16 kB)
- `idx_services_fulltext_category` (32 kB)
- `idx_services_trgm_category` (96 kB)
- `idx_services_trigram_category` (104 kB)
- `idx_services_structured_category` (24 kB)
- `idx_services_structured_trigram_category` (32 kB)
- `idx_services_category_direct` (24 kB)

**À garder** :
- ✅ `idx_services_category_unaccent_trgm` (16 kB) - NOUVEAU

#### 4. Index produits (6 index → garder 2-3)
**À supprimer** :
- `idx_services_produits_gin` (doublon de gin_optimized)
- `idx_services_data_produits_gin`
- `idx_services_data_produits_extraction_gin`

**À garder** :
- ✅ `idx_services_produits_jsonb_path_ops` - Le plus performant
- ✅ `idx_services_produits_gin_optimized` - Optimisé
- ✅ `idx_services_produits_characteristic_vector_gin` (si utilisé)

#### 5. Index GPS (8+ index → garder 2-3)
**À supprimer** :
- `idx_services_gps_trgm`
- `idx_services_gps_trigram`
- `idx_services_gps_fixe_trgm`
- `idx_services_gps_btree` (si gist existe)
- `idx_services_gps` (doublon)

**À garder** :
- ✅ `idx_services_gps_gist` (PostGIS - le plus performant)
- ✅ `idx_services_gps_search` (recherche simple)
- ✅ `idx_services_location_geog`
- ✅ `idx_services_location_geom`

#### 6. Index user_id/created_at (10+ index → garder 1-2)
**À supprimer** :
- `idx_services_user_id_created_at`
- `idx_services_user_id_created_at_desc`
- `idx_services_user_id_created_at_desc_count`
- `idx_services_user_id_is_active_created_at`
- `idx_services_user_active`
- `idx_services_user_active_created`
- `idx_services_user_status`

**À garder** :
- ✅ `idx_services_user_id_created_at_desc_optimized` - Le plus complet
- ✅ `idx_services_user_id_count` (si utilisé)

#### 7. Index full-text combinés (3+ index → garder 1)
**À supprimer** :
- `idx_services_fulltext_combined`
- `idx_services_fulltext_optimized`
- `idx_services_trigram_combined`

**À garder** :
- ✅ `idx_services_search_combined_tsvector`

#### 8. Index autres
**À supprimer** :
- `idx_services_intention` (si non utilisé)
- `idx_services_tags_jsonb` (si non utilisé)

---

## 📋 Total des Index à Supprimer

**Estimation** : ~50-60 index à supprimer sur 92

**Résultat attendu** : ~25-30 index essentiels

---

## 🚀 Exécution

### Étape 1: Vérification (DRY RUN)
```bash
# Voir ce qui sera supprimé
psql -h dpg-d2t7ntbuibrs73eh9tvg-a.frankfurt-postgres.render.com \
     -U yukpo_db_user -d yukpo_db \
     -f CLEANUP_INDEXES_SERVICES.sql
```

### Étape 2: Exécution Réelle
```bash
# ⚠️ ATTENTION: Ceci supprime réellement les index
psql -h dpg-d2t7ntbuibrs73eh9tvg-a.frankfurt-postgres.render.com \
     -U yukpo_db_user -d yukpo_db \
     -f DROP_INDEXES_SERVICES.sql
```

### Étape 3: Vérification Finale
```bash
# Vérifier le nombre d'index restants
psql -h dpg-d2t7ntbuibrs73eh9tvg-a.frankfurt-postgres.render.com \
     -U yukpo_db_user -d yukpo_db \
     -c "SELECT COUNT(*) as total_indexes FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'services';"
```

---

## ✅ Index à Garder (Essentiels)

### Index avec unaccent_immutable() (5 index)
- ✅ `idx_services_titre_service_unaccent_trgm`
- ✅ `idx_services_titre_service_unaccent_fts`
- ✅ `idx_services_description_unaccent_trgm`
- ✅ `idx_services_description_unaccent_fts`
- ✅ `idx_services_category_unaccent_trgm`

### Index produits (2-3 index)
- ✅ `idx_services_produits_jsonb_path_ops`
- ✅ `idx_services_produits_gin_optimized`
- ✅ `idx_services_produits_characteristic_vector_gin` (si utilisé)

### Index GPS (2-4 index)
- ✅ `idx_services_gps_gist`
- ✅ `idx_services_gps_search`
- ✅ `idx_services_location_geog`
- ✅ `idx_services_location_geom`

### Index user/created (1-2 index)
- ✅ `idx_services_user_id_created_at_desc_optimized`
- ✅ `idx_services_user_id_count` (si utilisé)

### Index autres (10-15 index)
- ✅ `services_pkey` (clé primaire)
- ✅ `idx_services_is_active_created_at`
- ✅ `idx_services_search_combined_tsvector`
- ✅ `idx_services_active_created`
- ✅ `idx_services_category_active`
- ✅ `idx_services_category_search`
- ✅ `idx_services_titre_service_search`
- ✅ `idx_services_products_tsvector` (si utilisé)
- ✅ `idx_services_products_fulltext_all` (si utilisé)
- ✅ Et autres index essentiels...

---

## 📊 Impact Attendu

### Avant
- **92 index**
- INSERT/UPDATE/DELETE lents (doit mettre à jour 92 index)
- Consommation mémoire élevée

### Après
- **~25-30 index**
- INSERT/UPDATE/DELETE plus rapides (doit mettre à jour 25-30 index)
- Consommation mémoire réduite
- Requêtes SELECT toujours rapides (index essentiels conservés)

---

## ⚠️ Précautions

1. **Sauvegarder la base** avant d'exécuter
2. **Exécuter en mode DRY RUN** d'abord
3. **Vérifier les résultats** avant suppression réelle
4. **Monitorer les performances** après nettoyage

---

## ✅ Conclusion

Le script `DROP_INDEXES_SERVICES.sql` est prêt à être exécuté.

**Recommandation** : Exécuter d'abord en mode DRY RUN, vérifier les résultats, puis exécuter réellement.

