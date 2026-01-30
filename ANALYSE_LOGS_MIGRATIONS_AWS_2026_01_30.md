# 🔍 Analyse des Logs de Migration AWS - 30 Janvier 2026

## 📋 Résumé Exécutif

Analyse du fichier `log-events-viewer-result.csv` révélant **plusieurs problèmes critiques** lors de l'exécution des migrations de base de données dans AWS RDS.

**Date d'analyse** : 2026-01-30 11:13:15 - 11:13:24 UTC  
**Nombre total d'erreurs identifiées** : 42+ erreurs critiques

---

## 🚨 Problèmes Critiques Identifiés

### 1. **Erreur : "cannot insert multiple commands into a prepared statement"**

**Fréquence** : 9 occurrences  
**Cause** : SQLx tente d'exécuter plusieurs commandes SQL dans une seule requête préparée, ce qui n'est pas supporté par PostgreSQL.

**Exemples d'erreurs** :
- Ligne 79 : Tentative de créer 4 index en une seule commande
- Ligne 5224 : Tentative de DROP TRIGGER + CREATE TRIGGER en une seule commande
- Ligne 5950 : Tentative de créer 2 index en une seule commande

**Commandes problématiques** :
```sql
-- ❌ ERREUR : Plusieurs CREATE INDEX dans une seule requête
CREATE INDEX IF NOT EXISTS idx_delivery_partners_name ON delivery_partners(name);
CREATE INDEX IF NOT EXISTS idx_delivery_partners_active ON delivery_partners(is_active);
CREATE INDEX IF NOT EXISTS idx_delivery_partners_created_by ON delivery_partners(created_by);
CREATE INDEX IF NOT EXISTS idx_delivery_partners_type ON delivery_partners(partner_type);
```

**Solution** : La fonction `execute_multiple_sql_commands()` doit diviser ces commandes et les exécuter individuellement.

---

### 2. **Erreur : "cannot change data type of view column"**

**Fréquence** : 4 occurrences  
**Cause** : Tentative de modifier le type de colonne d'une vue existante de `VARCHAR` à `TEXT`.

**Vue concernée** : `product_comments_view`  
**Colonne** : `user_name`

**Erreur** :
```
ERROR: cannot change data type of view column "user_name" from character varying to text
```

**Contexte** :
- Ligne 44, 85, 6634 : Tentative de `CREATE OR REPLACE VIEW` avec changement de type
- La vue existante a `user_name` en `VARCHAR`
- La migration tente de la changer en `TEXT`

**Solution** : 
1. D'abord `DROP VIEW IF EXISTS product_comments_view;`
2. Puis `CREATE VIEW product_comments_view AS ...`

---

### 3. **Erreur : "relation does not exist"**

**Fréquence** : 15+ occurrences  
**Cause** : Tentative de créer des contraintes de clé étrangère ou des index sur des tables qui n'existent pas encore.

**Tables manquantes identifiées** :
- `conversations` (ligne 5206)
- `pharmacy_order_items` (lignes 5900, 5902, 5929)
- `pharmacy_reservations` (lignes 5919, 5921, 5923, 5925, 5927, 5931)
- `programmes_scolaires` (lignes 5978, 5980, 5982, 5984)

**Exemple d'erreur** :
```sql
-- ❌ ERREUR : Table conversations n'existe pas
CREATE TABLE IF NOT EXISTS negotiated_prices (
    conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    ...
)
```

**Solution** : Vérifier l'ordre des migrations et s'assurer que les tables référencées sont créées avant.

---

### 4. **Erreur : "column does not exist"**

**Fréquence** : 8+ occurrences  
**Cause** : Tentative d'utiliser des colonnes qui n'existent pas dans les tables.

**Colonnes manquantes identifiées** :
- `user_id` (lignes 203, 5882)
- `retry_at` (ligne 5267)
- `location_point` (ligne 5933)
- `statut` (lignes 5935, 5938, 5941)
- `tags` (ligne 5944)
- `date_limite_candidature` (ligne 5946)
- `entreprise_id` (ligne 5948)

**Solution** : Vérifier que les migrations qui ajoutent ces colonnes sont exécutées avant celles qui les utilisent.

---

### 5. **Erreur : "cannot change return type of existing function"**

**Fréquence** : 4 occurrences  
**Cause** : Tentative de modifier le type de retour d'une fonction existante avec `CREATE OR REPLACE FUNCTION`.

**Lignes** : 119, 190, 5271, 5577

**Solution** : 
1. D'abord `DROP FUNCTION IF EXISTS function_name(...);`
2. Puis `CREATE FUNCTION function_name(...)`

---

### 6. **Erreur : "constraint already exists"**

**Fréquence** : 2 occurrences  
**Cause** : Tentative de créer une contrainte qui existe déjà.

**Exemples** :
- Ligne 182 : `fk_video_generation_jobs_audio_job` existe déjà
- Ligne 207 : `trigger_update_user_documents_updated_at` existe déjà

**Solution** : Utiliser `DROP CONSTRAINT IF EXISTS` avant de créer la contrainte.

---

### 7. **Erreur : "foreign key constraint cannot be implemented"**

**Fréquence** : 3 occurrences  
**Cause** : Incompatibilité de types entre les colonnes de clé étrangère.

**Exemple critique** (ligne 5231) :
```
ERROR: foreign key constraint "delivery_media_parcel_id_fkey" cannot be implemented
DETAIL: Key columns "parcel_id" and "id" are of incompatible types: integer and uuid.
```

**Problème** : 
- `delivery_media.parcel_id` est de type `INTEGER`
- `delivery_parcels.id` est de type `UUID`

**Solution** : Corriger le type de `parcel_id` pour correspondre à `delivery_parcels.id`.

---

### 8. **Erreur : "function name is not unique"**

**Fréquence** : 5 occurrences  
**Cause** : Tentative de créer plusieurs fonctions avec le même nom mais des signatures différentes.

**Fonction concernée** : `hybrid_image_search`

**Lignes** : 5574, 5870, 5873, 5876, 5879

**Solution** : Vérifier qu'il n'y a pas de doublons dans les migrations et supprimer les anciennes versions.

---

### 9. **Erreur : "functions in index predicate must be marked IMMUTABLE"**

**Fréquence** : 2 occurrences  
**Cause** : Utilisation d'une fonction non-IMMUTABLE dans un index partiel.

**Lignes** : 186, 5263

**Solution** : Marquer la fonction comme `IMMUTABLE` ou retirer l'index partiel.

---

## 🔍 Analyse des Causes Racines

### Problème Principal : Exécution de Migrations Multiples Commandes

Le code utilise `execute_multiple_sql_commands()` pour diviser les migrations en commandes individuelles, mais certaines migrations contiennent encore des blocs de plusieurs commandes qui ne sont pas correctement divisés.

**Fonction actuelle** (`backend/src/migrations/auto_migrate.rs`) :
- Divise par `;` mais doit gérer les blocs `$$...$$`
- Peut ne pas détecter correctement toutes les commandes

### Problème Secondaire : Ordre d'Exécution des Migrations

Les migrations sont exécutées dans l'ordre chronologique, mais certaines dépendances ne sont pas respectées :
- Tables référencées créées après les tables qui les référencent
- Colonnes ajoutées après les index/fonctions qui les utilisent

### Problème Tertiaire : Gestion des Objets Existants

Les migrations utilisent `CREATE OR REPLACE` pour les vues et fonctions, mais PostgreSQL ne permet pas toujours de changer le type de retour ou le type de colonne avec `OR REPLACE`.

---

## ✅ Solutions Recommandées

### Solution 1 : Améliorer `execute_multiple_sql_commands()`

**Fichier** : `backend/src/migrations/auto_migrate.rs`

**Améliorations nécessaires** :
1. Meilleure détection des commandes SQL (gérer les commentaires multi-lignes)
2. Gérer les blocs `$$...$$` avec tags personnalisés
3. Ignorer les commandes vides ou commentaires uniquement
4. Logging détaillé pour chaque commande exécutée

### Solution 2 : Corriger les Migrations Problématiques

**Actions immédiates** :

1. **Vue `product_comments_view`** :
   ```sql
   DROP VIEW IF EXISTS product_comments_view CASCADE;
   CREATE VIEW product_comments_view AS ...;
   ```

2. **Table `delivery_media`** :
   ```sql
   -- Corriger le type de parcel_id
   ALTER TABLE delivery_media 
   ALTER COLUMN parcel_id TYPE UUID USING parcel_id::text::uuid;
   ```

3. **Tables manquantes** :
   - Vérifier que `conversations` est créée avant `negotiated_prices`
   - Vérifier que `pharmacy_order_items` et `pharmacy_reservations` sont créées dans le bon ordre

4. **Fonctions dupliquées** :
   - Supprimer les anciennes versions de `hybrid_image_search`
   - Utiliser `DROP FUNCTION IF EXISTS` avant `CREATE OR REPLACE`

### Solution 3 : Ajouter des Vérifications Préalables

**Avant chaque migration** :
1. Vérifier l'existence des tables/colonnes référencées
2. Vérifier l'existence des objets à modifier
3. Logguer les dépendances manquantes

### Solution 4 : Améliorer la Gestion des Erreurs

**Stratégie** :
1. Continuer l'exécution même en cas d'erreur "already exists"
2. Arrêter l'exécution pour les erreurs critiques (table manquante, type incompatible)
3. Logguer toutes les erreurs pour analyse ultérieure

---

## 📊 Statistiques des Erreurs

| Type d'Erreur | Nombre | Priorité |
|---------------|--------|----------|
| cannot insert multiple commands | 9 | 🔴 Critique |
| relation does not exist | 15+ | 🔴 Critique |
| column does not exist | 8+ | 🔴 Critique |
| cannot change data type of view | 4 | 🟡 Important |
| cannot change return type | 4 | 🟡 Important |
| foreign key constraint incompatible | 3 | 🔴 Critique |
| function name not unique | 5 | 🟡 Important |
| constraint already exists | 2 | 🟢 Mineur |
| functions must be IMMUTABLE | 2 | 🟡 Important |

---

## 🎯 Plan d'Action Immédiat

### Priorité 1 : Corriger les Erreurs Critiques

1. ✅ Corriger `execute_multiple_sql_commands()` pour mieux diviser les commandes
2. ✅ Ajouter `DROP VIEW IF EXISTS` avant `CREATE OR REPLACE VIEW`
3. ✅ Corriger le type de `delivery_media.parcel_id` (INTEGER → UUID)
4. ✅ Vérifier l'ordre de création des tables (`conversations`, `pharmacy_*`)

### Priorité 2 : Améliorer la Robustesse

1. ✅ Ajouter des vérifications préalables (tables/colonnes existantes)
2. ✅ Améliorer la gestion des erreurs (continuer vs arrêter)
3. ✅ Logging détaillé pour chaque commande SQL

### Priorité 3 : Nettoyage

1. ✅ Supprimer les fonctions dupliquées (`hybrid_image_search`)
2. ✅ Corriger les fonctions non-IMMUTABLE dans les index
3. ✅ Ajouter les colonnes manquantes (`retry_at`, `location_point`, etc.)

---

## 📝 Notes Techniques

### Contexte d'Exécution

- **Environnement** : AWS RDS PostgreSQL
- **Méthode d'exécution** : `execute_multiple_sql_commands()` + `sqlx::migrate!()`
- **Période** : 2026-01-30 11:13:15 - 11:13:24 UTC (9 secondes)
- **Nombre de connexions** : Plusieurs connexions simultanées (10.0.3.103, 10.0.2.249)

### Observations

1. **Exécution parallèle** : Plusieurs migrations s'exécutent en parallèle, ce qui peut causer des conflits
2. **Timeouts** : Pas de timeout visible dans les logs, mais les erreurs suggèrent des problèmes d'exécution
3. **État partiel** : Certaines migrations réussissent partiellement, créant un état incohérent

---

## 🔗 Références

- Fichier de logs : `log-events-viewer-result.csv`
- Code de migration : `backend/src/migrations/auto_migrate.rs`
- Point d'entrée : `backend/src/main.rs` (lignes 502-584)
- Documentation : `SOLUTION_CAUSE_RACINE_MIGRATIONS_AWS_FINALE.md`

---

**Date de création** : 2026-01-30  
**Auteur** : Analyse automatique des logs AWS

