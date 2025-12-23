# Changelog - Corrections Recherche par Image et Timeouts - 2025-12-23

## 🔍 Problème Principal Identifié

La recherche par image n'utilisait **PAS** `autocomplete_characteristics` (source principale pour recherche textuelle/audio), causant un manque de pertinence. Les résultats retournés ne correspondaient pas à l'objet recherché.

## ✅ Corrections Appliquées

### 1. Migration SQL : Utilisation de `autocomplete_characteristics` pour recherche par image

**Fichier** : `backend/migrations/20251223_improve_hybrid_image_search_relevance.sql`

**Changements** :
- ✅ Utilise `autocomplete_characteristics` comme **SOURCE PRINCIPALE** (cohérent avec recherche textuelle/audio)
- ✅ Utilise `ac.valeur`, `ac.characteristic_vector`, `ac.full_vector` (même logique que recherche textuelle)
- ✅ Scoring amélioré avec poids plus élevés :
  - Full-text sur valeur : ×400 (au lieu de ×50)
  - Full-text sur characteristic_vector : ×300
  - Full-text sur full_vector : ×250
  - ILIKE correspondance exacte : +500
  - ILIKE correspondance début : +350
  - ILIKE correspondance partielle : +200
  - Tags communs : +60 par tag
  - Marque exacte : +250
  - Couleur : +100
  - Catégorie : +150
  - Bonus usage_count : +2 par usage
- ✅ Seuil strict à 30.0 (au lieu de 5.0) pour filtrer les résultats non pertinents
- ✅ Fallback vers `image_analyses` et `media.ai_*` si pas trouvé dans `autocomplete_characteristics`

**Application** : Migration appliquée directement via `cargo run --bin apply_migration_relevance`

### 2. Intégration automatique de la migration

**Fichier** : `backend/src/migrations/auto_migrate.rs`

**Changements** :
- ✅ Ajout de `ensure_hybrid_image_search_relevance()` (ligne 10361)
- ✅ Appel automatique dans `run_auto_migrations()` (ligne 7004)
- ✅ La migration sera appliquée automatiquement au prochain démarrage du backend

### 3. Script d'application directe de la migration

**Fichier** : `backend/scripts/apply_migration_relevance.rs`
**Fichier** : `backend/Cargo.toml` (ajout binaire)

**Changements** :
- ✅ Script pour appliquer la migration directement sans redémarrer le backend
- ✅ Utilise `ensure_hybrid_image_search_relevance()` publique

### 4. Correction des timeouts côté mobile

**Fichier** : `mobile/src/services/api.ts`

**Changements** :
- ✅ Timeout pour `/api/search/direct` : 15s → **30s** (recherche par image peut prendre 20-25s avec analyse IA)
- ✅ Timeout pour `/api/mobile-logs` : 15s → **30s** (traitement batch peut prendre du temps)
- ✅ Timeout pour `/api/services/*/reviews` et `/stats` : 15s → **30s** (peuvent être lents)

### 5. Optimisation traitement logs mobiles

**Fichier** : `backend/src/controllers/mobile_logs_controller.rs`

**Changements** :
- ✅ `MAX_LOGS_PER_BATCH` : 100 → **50** (pour accélérer le traitement et éviter les timeouts)

## 📊 Résultats Attendus

1. **Pertinence améliorée** : La recherche par image utilise maintenant les mêmes données que la recherche textuelle (`autocomplete_characteristics`)
2. **Moins de timeouts** : Timeouts augmentés pour les endpoints lents (recherche par image, logs, reviews/stats)
3. **Cohérence** : Toutes les recherches (textuelle, audio, image) utilisent maintenant `autocomplete_characteristics`

## 🔄 Cohérence Vérifiée

- ✅ **Recherche textuelle** : Utilise `autocomplete_characteristics` (lignes 339-373 de `native_search_service.rs`)
- ✅ **Recherche audio** : Transcrit en texte → utilise recherche textuelle → utilise `autocomplete_characteristics`
- ✅ **Recherche par image** : Utilise maintenant `autocomplete_characteristics` comme source principale

## 📝 Fichiers Modifiés

1. `backend/migrations/20251223_improve_hybrid_image_search_relevance.sql` (NOUVEAU)
2. `backend/src/migrations/auto_migrate.rs` (MODIFIÉ)
3. `backend/scripts/apply_migration_relevance.rs` (NOUVEAU)
4. `backend/Cargo.toml` (MODIFIÉ - ajout binaire)
5. `mobile/src/services/api.ts` (MODIFIÉ - timeouts)
6. `backend/src/controllers/mobile_logs_controller.rs` (MODIFIÉ - MAX_LOGS_PER_BATCH)

## ✅ Migration Appliquée

La migration SQL a été appliquée directement avec succès :
```
✅ Migration appliquée avec succès !
```

