# 🔄 PROMPT DE CONTINUATION - Correction Problèmes PostgreSQL

## 📋 Contexte du Projet

**Projet** : Yukpomnang  
**Repository** : `C:\Users\23767\yukpomnang2`  
**Backend** : Rust avec Axum, SQLx, PostgreSQL  
**Base de données** : AWS RDS PostgreSQL (yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com)  
**Infrastructure** : AWS ECS, RDS, ElastiCache Redis, S3  

---

## 🎯 Objectif de cette Session

**Corriger les ~95 erreurs SQL identifiées dans les logs PostgreSQL** qui empêchent la création correcte de tables, index, et fonctions.

---

## ❌ Problèmes Identifiés

### 1. **Problème Principal : Parsing SQL Défaillant**

**Erreur** : `syntax error at end of input` (~90+ occurrences)

**Cause** : Le parsing SQL dans `backend/src/migrations/auto_migrate.rs` tronque les commandes `CREATE TABLE`, `CREATE INDEX`, `ALTER TABLE`, etc.

**Impact** : 
- ~40 tables non créées correctement
- ~30 index non créés
- ~20 fonctions/vues non créées

**Fichiers affectés** :
- `backend/src/migrations/auto_migrate.rs` - Fonction `execute_migration_sql_safe()` (ligne ~12397)
- Toutes les migrations SQL dans `backend/migrations/`

**Tables affectées** (exemples) :
- `property_views`, `property_shares`, `family_profiles`, `recipes`, `menu_plans`
- `planned_meals`, `recipe_favorites`, `shopping_lists`, `shopping_list_items`
- `nutrition_analytics`, `plugin_marketplace`, `livres_scolaires`
- `troc_livres_scolaires`, `chaines_troc_livres`, `offres_emploi`
- `profils_candidats`, `candidatures`, `matching_offres_candidats`
- `alertes_emploi`, `statistiques_offres`, `etablissements_scolaires`
- `delivery_chat_messages`, `delivery_gamification_stats`, `delivery_badges`
- `delivery_points_history`, `delivery_product_suggestions`, `user_documents`
- `covoiturage_insurance`, `reservation_qr_codes`, `loyalty_transactions`
- `loyalty_rewards`, `chat_support_sessions`, `chat_support_messages`
- `bus_ticket_ratings`, `videos`, `user_preferences`
- `video_generation_metrics`, `rate_limit_tracking`, `message_reactions`
- Et beaucoup d'autres...

### 2. **Erreurs Spécifiques**

#### a) Colonnes Manquantes (2)
- `live_session_analytics.last_synced_at` - Manquante
- `global_promo_products.highlighted` - Manquante

#### b) Index avec CURRENT_DATE (1)
- `idx_offres_date_limite` - Utilise `CURRENT_DATE` (non IMMUTABLE)

#### c) Vue Matérialisée (1)
- `hashtag_stats_materialized` - Manque `GROUP BY tag`

#### d) Multiple Commands (1)
- Fonction `run_audio_cache_cleanup()` - Plusieurs commandes dans un prepared statement

---

## 📊 Analyse des Logs

**Fichier analysé** : `log-events-viewer-result (58).csv`

**Résumé** :
- ~95 erreurs SQL détectées
- Période : 2026-02-14 11:45:46 - 12:03:57 UTC
- Type principal : `syntax error at end of input`

**Documents créés** :
- `ANALYSE_ERREURS_BD_LOG_58.md` - Analyse détaillée
- `EXPLICATION_DIFFERENCE_LOGS_BACKEND_POSTGRES.md` - Pourquoi les erreurs n'apparaissent pas dans les logs backend
- `COMMANDE_CORRIGER_COLONNES_MANQUANTES_LOG_58_EC2.md` - Commandes SQL de correction

---

## 🔧 Solutions à Appliquer

### Solution 1 : Améliorer le Parsing SQL (CRITIQUE)

**Fichier** : `backend/src/migrations/auto_migrate.rs`

**Fonction** : `execute_migration_sql_safe()` (ligne ~12397)

**Problème actuel** :
- Les commandes `CREATE TABLE` multi-lignes sont tronquées
- Les parenthèses imbriquées ne sont pas correctement gérées
- Les blocs `DO $$...$$` sont parfois mal détectés
- Les commandes se terminant par `);` ne sont pas toujours détectées

**Améliorations nécessaires** :
1. ✅ Améliorer la détection de fin de `CREATE TABLE` avec `);`
2. ✅ Mieux gérer les parenthèses imbriquées dans les définitions de colonnes
3. ✅ Améliorer la détection des blocs `DO $$...END $$;`
4. ✅ Gérer les commandes `CREATE INDEX` avec prédicats `WHERE`
5. ✅ Gérer les `CREATE MATERIALIZED VIEW` avec `AS SELECT`
6. ✅ Gérer les `COMMENT ON INDEX` avec chaînes complètes
7. ✅ Séparer correctement les commandes multiples séparées par `;`

**Code actuel problématique** (ligne ~12519-12551) :
```rust
if is_create_table {
    // Vérifier si la commande complète contient ');' (peut être sur plusieurs lignes)
    let has_table_closing = trimmed.contains(");") || cmd_upper.contains(");");
    // ... logique de vérification ...
}
```

**Amélioration suggérée** :
- Vérifier que `);` apparaît après la dernière colonne définie
- Compter correctement les parenthèses même avec des types complexes (ex: `JSONB DEFAULT '{}'::JSONB`)
- Gérer les contraintes `CHECK`, `UNIQUE`, `FOREIGN KEY` qui peuvent être sur plusieurs lignes

### Solution 2 : Corriger les Colonnes Manquantes

**Commande SQL** : Voir `COMMANDE_CORRIGER_COLONNES_MANQUANTES_LOG_58_EC2.md`

**À exécuter sur EC2** :
```bash
PGPASSWORD="PYvHBVetTuWIKNkXgqJcFiU48D39SLwd" psql -h yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com -p 5432 -U yukpo_admin -d yukpo << 'EOFSQL'
-- Ajouter last_synced_at à live_session_analytics
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'live_session_analytics' AND column_name = 'last_synced_at') THEN ALTER TABLE live_session_analytics ADD COLUMN last_synced_at TIMESTAMPTZ; RAISE NOTICE 'Colonne last_synced_at ajoutee'; END IF; END $$;

-- Ajouter highlighted à global_promo_products
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'global_promo_products' AND column_name = 'highlighted') THEN ALTER TABLE global_promo_products ADD COLUMN highlighted BOOLEAN DEFAULT FALSE; RAISE NOTICE 'Colonne highlighted ajoutee'; END IF; END $$;
EOFSQL
```

### Solution 3 : Corriger l'Index avec CURRENT_DATE

**Commande SQL** :
```sql
DROP INDEX IF EXISTS idx_offres_date_limite;
CREATE INDEX IF NOT EXISTS idx_offres_date_limite 
ON offres_emploi(date_limite_candidature, statut) 
WHERE statut = 'active';
```

### Solution 4 : Corriger la Vue Matérialisée

**Commande SQL** :
```sql
DROP MATERIALIZED VIEW IF EXISTS hashtag_stats_materialized;
CREATE MATERIALIZED VIEW IF NOT EXISTS hashtag_stats_materialized AS
SELECT 
    tag,
    COUNT(DISTINCT v.id) as video_count,
    SUM(v.view_count) as total_views,
    SUM(v.like_count) as total_likes,
    SUM(v.save_count) as total_saves,
    (
        SUM(v.like_count * 2 + v.save_count * 1.5 + v.view_count * 0.1) 
        / GREATEST(EXTRACT(EPOCH FROM (NOW() - MIN(v.created_at))) / 3600, 1)
    ) as trend_score,
    MAX(v.created_at) as last_video_at
FROM videos v
CROSS JOIN LATERAL unnest(v.hashtags) tag
WHERE v.is_active = TRUE
GROUP BY tag;  -- ✅ Ajouter GROUP BY
```

### Solution 5 : Séparer les Commandes Multiples

**Pour la fonction `run_audio_cache_cleanup()`** :
- Exécuter `DROP FUNCTION IF EXISTS run_audio_cache_cleanup();` séparément
- Puis exécuter `CREATE OR REPLACE FUNCTION run_audio_cache_cleanup() ...` séparément

---

## 📝 Tâches à Effectuer

### Tâche 1 : Améliorer le Parsing SQL (PRIORITÉ 1)

1. **Lire** `backend/src/migrations/auto_migrate.rs`
2. **Analyser** la fonction `execute_migration_sql_safe()` (ligne ~12397)
3. **Identifier** les cas où les commandes sont tronquées
4. **Améliorer** la logique de détection de fin de commande
5. **Tester** avec des migrations complexes
6. **Vérifier** que les commandes ne sont plus tronquées

**Points d'attention** :
- Les `CREATE TABLE` avec beaucoup de colonnes
- Les contraintes `CHECK` complexes
- Les types JSONB avec valeurs par défaut
- Les blocs `DO $$...END $$;`
- Les `CREATE INDEX` avec prédicats `WHERE`
- Les `CREATE MATERIALIZED VIEW` avec `CROSS JOIN LATERAL`

### Tâche 2 : Exécuter les Corrections SQL (PRIORITÉ 2)

1. **Se connecter à EC2** via SSM Session Manager
2. **Exécuter** les commandes SQL de correction (voir `COMMANDE_CORRIGER_COLONNES_MANQUANTES_LOG_58_EC2.md`)
3. **Vérifier** que les colonnes sont ajoutées
4. **Vérifier** que l'index est recréé
5. **Vérifier** que la vue matérialisée est corrigée

### Tâche 3 : Vérifier les Migrations Manuelles (PRIORITÉ 3)

1. **Vérifier** que toutes les migrations ont été exécutées manuellement sur EC2
2. **Vérifier** qu'aucune table n'est dupliquée
3. **Vérifier** qu'aucun index n'est dupliqué
4. **Vérifier** que les fonctions sont créées correctement

### Tâche 4 : Tester le Nouveau Parsing (PRIORITÉ 4)

1. **Activer** temporairement les auto-migrations dans ECS
2. **Redémarrer** le backend
3. **Vérifier** les logs PostgreSQL pour voir si les erreurs persistent
4. **Vérifier** les logs backend pour voir si les erreurs sont mieux loggées
5. **Désactiver** les auto-migrations si nécessaire

### Tâche 5 : Améliorer le Logging (PRIORITÉ 5)

1. **Modifier** `auto_migrate.rs` pour logger les erreurs `syntax error at end of input` en `error!` au lieu de `warn!`
2. **Ajouter** plus de contexte dans les messages d'erreur
3. **Vérifier** que les erreurs apparaissent dans les logs CloudWatch

---

## 🔗 Fichiers Importants

### Fichiers à Modifier
- `backend/src/migrations/auto_migrate.rs` - Améliorer le parsing SQL
- `backend/src/main.rs` - Vérifier la configuration du logging

### Fichiers de Documentation
- `ANALYSE_ERREURS_BD_LOG_58.md` - Analyse détaillée des erreurs
- `EXPLICATION_DIFFERENCE_LOGS_BACKEND_POSTGRES.md` - Explication de la différence entre logs
- `COMMANDE_CORRIGER_COLONNES_MANQUANTES_LOG_58_EC2.md` - Commandes SQL de correction

### Fichiers de Logs
- `log-events-viewer-result (58).csv` - Logs PostgreSQL avec toutes les erreurs

---

## 🔐 Informations de Connexion

### Base de Données PostgreSQL
- **Host** : `yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com`
- **Port** : `5432`
- **Database** : `yukpo`
- **User** : `yukpo_admin`
- **Password** : `PYvHBVetTuWIKNkXgqJcFiU48D39SLwd`

### AWS
- **Region** : `eu-west-1`
- **Cluster ECS** : `yukpo-cluster`
- **Service ECS** : `yukpo-backend-service`
- **Secret Manager** : `yukpo/backend/secrets`

---

## 📋 Checklist de Vérification

### Avant de Commencer
- [ ] Lire `ANALYSE_ERREURS_BD_LOG_58.md`
- [ ] Lire `EXPLICATION_DIFFERENCE_LOGS_BACKEND_POSTGRES.md`
- [ ] Comprendre le problème de parsing SQL
- [ ] Avoir accès à EC2 via SSM

### Pendant les Corrections
- [ ] Améliorer le parsing SQL dans `auto_migrate.rs`
- [ ] Tester localement avec des migrations complexes
- [ ] Exécuter les corrections SQL sur EC2
- [ ] Vérifier que les colonnes sont ajoutées
- [ ] Vérifier que l'index est recréé
- [ ] Vérifier que la vue matérialisée est corrigée

### Après les Corrections
- [ ] Vérifier les logs PostgreSQL (nouveau fichier CSV)
- [ ] Vérifier les logs backend (CloudWatch)
- [ ] Vérifier que les tables sont créées correctement
- [ ] Vérifier que les index sont créés correctement
- [ ] Vérifier que les fonctions sont créées correctement
- [ ] Commiter et pusher les changements

---

## 🎯 Résultat Attendu

### Après les Corrections

1. **Parsing SQL amélioré** :
   - Plus d'erreurs `syntax error at end of input`
   - Toutes les tables créées correctement
   - Tous les index créés correctement
   - Toutes les fonctions créées correctement

2. **Colonnes manquantes corrigées** :
   - `live_session_analytics.last_synced_at` présente
   - `global_promo_products.highlighted` présente

3. **Index corrigé** :
   - `idx_offres_date_limite` recréé sans `CURRENT_DATE`

4. **Vue matérialisée corrigée** :
   - `hashtag_stats_materialized` avec `GROUP BY tag`

5. **Logging amélioré** :
   - Les erreurs apparaissent en `error!` dans les logs backend
   - Plus de contexte dans les messages d'erreur

---

## 🚨 Points d'Attention

### ⚠️ Ne Pas Faire

1. **Ne pas désactiver les auto-migrations** avant d'avoir corrigé le parsing
2. **Ne pas exécuter les migrations manuellement** si le parsing est corrigé
3. **Ne pas ignorer les erreurs** même si elles sont "bénignes"

### ✅ À Faire

1. **Tester le parsing** avec des migrations complexes avant de déployer
2. **Vérifier les logs** après chaque correction
3. **Documenter** les changements apportés
4. **Commiter** les changements avec des messages clairs

---

## 📞 Commandes Utiles

### Vérifier les Colonnes d'une Table
```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'nom_table'
ORDER BY ordinal_position;
```

### Vérifier les Index d'une Table
```sql
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'nom_table';
```

### Vérifier les Erreurs Récentes dans PostgreSQL
```sql
SELECT * FROM pg_stat_statements 
WHERE query LIKE '%ERROR%' 
ORDER BY calls DESC 
LIMIT 10;
```

### Compter les Tables par Catégorie
```sql
SELECT
    CASE
        WHEN table_name LIKE '%delivery%' THEN 'Livraisons'
        WHEN table_name LIKE '%courier%' THEN 'Coursiers'
        WHEN table_name LIKE '%media%' THEN 'Médias'
        -- ... autres catégories
        ELSE 'Autres'
    END as categorie,
    COUNT(*) as nb_tables
FROM information_schema.tables
WHERE table_schema = 'public'
GROUP BY categorie
ORDER BY nb_tables DESC;
```

---

## 🔄 Prochaines Étapes

1. **Commencer par** améliorer le parsing SQL (Tâche 1)
2. **Tester** localement avec des migrations complexes
3. **Exécuter** les corrections SQL sur EC2 (Tâche 2)
4. **Vérifier** les résultats dans les logs PostgreSQL
5. **Améliorer** le logging si nécessaire (Tâche 5)
6. **Déployer** et vérifier que tout fonctionne

---

## 📚 Références

- **Documentation SQLx** : https://docs.rs/sqlx/
- **Documentation PostgreSQL** : https://www.postgresql.org/docs/
- **Documentation Rust Logging** : https://docs.rs/log/

---

**Date de création** : 2026-02-14  
**Dernière mise à jour** : 2026-02-14  
**Statut** : En attente de correction


