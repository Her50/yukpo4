# Analyse des erreurs de migrations - Log 25

**Date d'analyse**: 2026-02-02  
**Fichier analysé**: `log-events-viewer-result (25).csv`

## 📊 Vue d'ensemble - Comparaison Log 24 → Log 25

### Statistiques globales

| Métrique | Log 24 | Log 25 | Évolution |
|----------|--------|--------|-----------|
| **Erreurs totales (ERROR:)** | 65 | **678** | ⚠️ **+943%** (+613) |
| **CREATE TABLE** | 15 | **639** | ✅ **+4160%** (beaucoup de tables créées) |
| **CREATE INDEX** | ? | **1368** | ✅ Beaucoup d'index créés |
| **CREATE FUNCTION** | ? | **306** | ✅ Beaucoup de fonctions créées |
| **"syntax error at end of input"** | 43 | **447** | ⚠️ **+940%** (+404) |
| **"unterminated dollar-quoted string"** | 8 | **159** | ⚠️ **+1888%** (+151) |
| **"cannot insert multiple commands"** | 5 | **21** | ⚠️ **+320%** (+16) |
| **"already exists"** | 0 | **18** | ⚠️ Réapparition (+18) |
| **"does not exist"** | 1 | **33** | ⚠️ **+3200%** (+32) |
| **"missing FROM-clause"** | 0 | **3** | ⚠️ Nouvelle erreur (+3) |
| **"column must appear in GROUP BY"** | 1 | **6** | ⚠️ **+500%** (+5) |

## 🎯 Analyse de l'évolution

### ⚠️ Régression significative

**Augmentation importante des erreurs** : 65 → 678 (+943%)

**Causes probables** :
1. **Nouveau déploiement** : Les migrations sont réexécutées depuis le début
2. **Blocs DO $$ mal parsés** : 159 erreurs "unterminated dollar-quoted string"
3. **Fragments augmentés** : 447 erreurs "syntax error at end of input"
4. **Vue product_comments_view** : 3 erreurs "missing FROM-clause" (JOIN manquant)

### ✅ Points positifs

1. **Beaucoup de tables créées** : **639 CREATE TABLE** détectés
2. **Beaucoup d'index créés** : **1368 CREATE INDEX** détectés
3. **Beaucoup de fonctions créées** : **306 CREATE FUNCTION** détectés
4. **Tables uniques créées** : **~180 tables** (sans doublons)

## 🔍 Analyse détaillée des erreurs

### 1. Erreurs "unterminated dollar-quoted string" (159 occurrences)

**Augmentation** : 8 → 159 (+1888%)

**Cause** : Les blocs DO $$ sont coupés avant leur fin `END $$;`

**Exemples** :
- `DO $$ BEGIN ... ALTER TABLE courier_availability_snapshots` (sans `END $$;`)
- `DO $$ BEGIN ... ALTER TABLE video_generation_jobs` (sans `END $$;`)

**Impact** : ⚠️ **Critique** - Les blocs DO $$ ne sont pas exécutés correctement

**Solution** : Améliorer la détection de la fin des blocs DO $$ dans le parser

### 2. Erreurs "syntax error at end of input" (447 occurrences)

**Augmentation** : 43 → 447 (+940%)

**Types de fragments** :
- `CREATE INDEX IF NOT EXISTS idx_cache_expires_at` (sans `ON ...`)
- `CREATE INDEX IF NOT EXISTS idx_products_lifecycle_service_product` (sans `ON ...`)
- `COMMENT ON INDEX idx_products_lifecycle_active IS` (sans la chaîne)

**Cause** : Les améliorations du parsing ne fonctionnent pas correctement pour tous les cas

**Impact** : ⚠️ **Moyen** - Fragments ignorés automatiquement mais indiquent un problème de parsing

### 3. Erreurs "missing FROM-clause entry for table 'u'" (3 occurrences)

**Nouvelle erreur** : 0 → 3

**Problème** : La vue `product_comments_view` utilise `u.nom_complet` et `u.avatar_url` mais le `LEFT JOIN users u ON u.id = pc.user_id` est manquant dans la requête exécutée.

**Fichier concerné** : `backend/migrations/00000007_create_review_tables.sql`

**Solution** : Vérifier que le JOIN est présent dans la migration

### 4. Erreurs "cannot insert multiple commands" (21 occurrences)

**Augmentation** : 5 → 21 (+320%)

**Cause** : Certains blocs DO $$ avec plusieurs commandes ne sont pas encore bien détectés

**Impact** : ⚠️ **Moyen** - À améliorer

### 5. Erreurs "column must appear in GROUP BY" (6 occurrences)

**Augmentation** : 1 → 6 (+500%)

**Cause** : Probablement des vues matérialisées non corrigées ou nouvelles

**Impact** : ⚠️ **Moyen** - À corriger

## 📊 Vérification de la création des objets de base de données

### Tables créées (sans doublons)

**Total** : **~180 tables uniques** détectées dans les logs

**Liste des tables principales** :
- `users`, `user_documents`, `services`, `media`
- `autocomplete_characteristics`, `autocomplete_combinations`
- `service_products`, `products_lifecycle`, `service_reviews`
- `product_comments`, `product_comment_reactions`, `product_reactions`
- `deliveries`, `delivery_tracking_points`, `delivery_matching_queue`
- `couriers`, `courier_availability_snapshots`, `courier_ratings`
- `videos`, `video_generation_jobs`, `video_templates`
- `publicites`, `publicite_versions`, `publicite_impressions`
- `notifications`, `user_push_tokens`
- `cache_table`, `payment_transactions`, `token_transactions`
- Et beaucoup d'autres...

**Statut** : ✅ **La plupart des tables sont créées**

### Index créés

**Total** : **1368 CREATE INDEX** détectés dans les logs

**Statut** : ✅ **Beaucoup d'index sont créés** (certains peuvent être des doublons ou des tentatives multiples)

### Fonctions créées

**Total** : **306 CREATE FUNCTION** détectés dans les logs

**Statut** : ✅ **Beaucoup de fonctions sont créées**

## 🔍 Analyse des erreurs critiques

### Erreurs critiques réelles

1. **"unterminated dollar-quoted string"** : 159 occurrences
   - **Impact** : Critique - Les blocs DO $$ ne sont pas exécutés
   - **Action** : Améliorer la détection de la fin des blocs DO $$

2. **"missing FROM-clause"** : 3 occurrences
   - **Impact** : Critique - La vue product_comments_view ne peut pas être créée
   - **Action** : Corriger la vue pour inclure le JOIN manquant

3. **"column must appear in GROUP BY"** : 6 occurrences
   - **Impact** : Moyen - Vues matérialisées avec GROUP BY incorrect
   - **Action** : Corriger les vues matérialisées

4. **"cannot insert multiple commands"** : 21 occurrences
   - **Impact** : Moyen - Commandes multiples non détectées
   - **Action** : Améliorer la détection des commandes multiples

**Total erreurs critiques réelles** : ~189 sur 678 (28%)

## 🎯 Recommandations

### Priorité 1: Corriger la détection des blocs DO $$

**Problème** : 159 erreurs "unterminated dollar-quoted string"

**Solution** : Améliorer la détection de la fin des blocs DO $$ pour ne pas les couper avant `END $$;`

### Priorité 2: Corriger la vue product_comments_view

**Problème** : 3 erreurs "missing FROM-clause entry for table 'u'"

**Solution** : Vérifier que le `LEFT JOIN users u ON u.id = pc.user_id` est présent dans la migration

### Priorité 3: Améliorer le parsing des CREATE INDEX et COMMENT ON

**Problème** : 447 fragments "syntax error at end of input"

**Solution** : Améliorer encore la détection de la fin de ces commandes multi-lignes

### Priorité 4: Corriger les vues matérialisées avec GROUP BY

**Problème** : 6 erreurs "column must appear in GROUP BY"

**Solution** : Identifier et corriger les vues matérialisées problématiques

## 📝 Conclusion

**Évolution** : ⚠️ **Régression significative** après le nouveau déploiement

**Causes** :
- Nouveau déploiement réexécutant toutes les migrations
- Blocs DO $$ mal parsés (159 erreurs)
- Fragments augmentés (447 erreurs)
- Vue product_comments_view avec JOIN manquant (3 erreurs)

**Points positifs** :
- ✅ **~180 tables créées** (sans doublons)
- ✅ **1368 index créés**
- ✅ **306 fonctions créées**
- ✅ La plupart des objets de base de données sont créés

**Statut global** : 🟡 **Régression mais objets créés**

**Erreurs critiques réelles** : ~189 sur 678 (28%)

**Recommandation** : 
- ⚠️ Corriger la détection des blocs DO $$ (priorité 1)
- ⚠️ Corriger la vue product_comments_view (priorité 2)
- ⚠️ Améliorer le parsing des CREATE INDEX/COMMENT ON (priorité 3)

