# 🔍 Analyse des Nouveaux Logs de Migration AWS - 30 Janvier 2026 (V2)

## 📋 Résumé Exécutif

Analyse du fichier `log-events-viewer-result (1).csv` révélant **de nouvelles erreurs critiques** après les premières corrections.

**Date d'analyse** : 2026-01-30 12:41:48 - 12:44:59 UTC  
**Nombre total d'erreurs identifiées** : 49+ erreurs critiques

---

## 🚨 Nouvelles Erreurs Critiques Identifiées

### 1. **Erreur : "cannot change return type of existing function"**

**Fréquence** : 3 occurrences  
**Fonctions concernées** :
- `get_product_reactions_count(INTEGER, TEXT)`
- `cleanup_expired_cache()`

**Cause** : Tentative de modifier le type de retour d'une fonction existante avec `CREATE OR REPLACE FUNCTION`.

**Détails** :
- `get_product_reactions_count` : Changement de `VARCHAR(20)` à `TEXT` pour `reaction_type`
- `cleanup_expired_cache` : Changement de type de retour (probablement INTEGER vs autre type)

**Solution** : Utiliser `DROP FUNCTION IF EXISTS` avant `CREATE FUNCTION` (pas `CREATE OR REPLACE`).

---

### 2. **Erreur : "functions in index predicate must be marked IMMUTABLE"**

**Fréquence** : 2 occurrences  
**Index concerné** : `idx_cache_expires_at`

**Cause** : Utilisation de `NOW()` dans un index partiel. `NOW()` n'est pas `IMMUTABLE`.

**Commande problématique** :
```sql
CREATE INDEX IF NOT EXISTS idx_cache_expires_at 
    ON cache_table(expires_at) 
    WHERE expires_at < NOW();
```

**Solution** : Supprimer le prédicat `WHERE expires_at < NOW()` ou utiliser une fonction IMMUTABLE.

---

### 3. **Erreur : "column user_id does not exist"**

**Fréquence** : 2 occurrences  
**Table concernée** : `courier_availability_snapshots`

**Cause** : Tentative de créer un index sur une colonne qui n'existe pas.

**Commande problématique** :
```sql
CREATE INDEX IF NOT EXISTS idx_courier_availability_snapshots_user_courier
ON courier_availability_snapshots(user_id, courier_id)
WHERE is_online = true;
```

**Solution** : Ajouter la colonne `user_id` à la table `courier_availability_snapshots` avant de créer l'index.

---

### 4. **Erreur : "foreign key constraint cannot be implemented"**

**Fréquence** : 1 occurrence  
**Contrainte concernée** : `pharmacy_order_items_medication_id_fkey`

**Cause** : Incompatibilité de types entre les colonnes de clé étrangère.

**Détail** :
```
Key columns "medication_id" and "id" are of incompatible types: uuid and integer.
```

**Problème** :
- `pharmacy_order_items.medication_id` est de type `UUID`
- `pharmacy_products.id` est de type `INTEGER` (SERIAL)

**Solution** : Aligner les types - soit convertir `pharmacy_products.id` en UUID, soit convertir `pharmacy_order_items.medication_id` en INTEGER.

---

### 5. **Erreur : "cannot insert multiple commands into a prepared statement"**

**Fréquence** : 2 occurrences  
**Cause** : Plusieurs commandes SQL dans une seule requête préparée.

**Exemple** :
```sql
CREATE OR REPLACE FUNCTION update_updated_at_column() ... $$ language 'plpgsql';
CREATE TRIGGER update_user_push_tokens_updated_at ...;
CREATE TABLE IF NOT EXISTS notifications ...;
CREATE INDEX IF NOT EXISTS ...;
```

**Solution** : Diviser en commandes individuelles (géré par `execute_multiple_sql_commands()` améliorée).

---

### 6. **Erreur : "constraint already exists"**

**Fréquence** : 1 occurrence  
**Contrainte concernée** : `fk_video_generation_jobs_audio_job`

**Solution** : Utiliser `DROP CONSTRAINT IF EXISTS` avant `ADD CONSTRAINT`.

---

### 7. **Erreur : "trigger already exists"**

**Fréquence** : 1 occurrence  
**Trigger concerné** : `trigger_update_user_documents_updated_at`

**Solution** : Utiliser `DROP TRIGGER IF EXISTS` avant `CREATE TRIGGER`.

---

## ✅ Corrections Appliquées

### Migration de Correction : `20260130_003_fix_additional_migration_errors.sql`

1. **DROP des fonctions problématiques** :
   - `DROP FUNCTION IF EXISTS get_product_reactions_count(INTEGER, TEXT) CASCADE;`
   - `DROP FUNCTION IF EXISTS cleanup_expired_cache() CASCADE;`

2. **Correction de l'index idx_cache_expires_at** :
   - Suppression de l'index avec prédicat `NOW()`
   - Recréation sans prédicat

3. **Ajout de la colonne user_id** :
   - Vérification et ajout conditionnel de `user_id` dans `courier_availability_snapshots`
   - Recréation de l'index après ajout de la colonne

4. **Correction du type medication_id** :
   - Détection automatique du type de `pharmacy_products.id`
   - Conversion de `pharmacy_order_items.medication_id` pour correspondre

5. **Gestion des contraintes/triggers existants** :
   - Suppression conditionnelle avant recréation

### Modifications dans `0000_create_all_tables.sql`

1. **Correction de l'index idx_cache_expires_at** :
   - Suppression du prédicat `WHERE expires_at < NOW()`

2. **Correction des fonctions** :
   - Ajout de `DROP FUNCTION IF EXISTS` avant `CREATE FUNCTION` pour `get_product_reactions_count` et `cleanup_expired_cache`

---

## 📊 Statistiques des Erreurs

| Type d'Erreur | Nombre | Priorité | Statut |
|---------------|--------|----------|--------|
| cannot change return type | 3 | 🔴 Critique | ✅ Corrigé |
| functions must be IMMUTABLE | 2 | 🔴 Critique | ✅ Corrigé |
| column does not exist | 2 | 🔴 Critique | ✅ Corrigé |
| foreign key incompatible types | 1 | 🔴 Critique | ✅ Corrigé |
| cannot insert multiple commands | 2 | 🔴 Critique | ✅ Corrigé |
| constraint already exists | 1 | 🟡 Important | ✅ Corrigé |
| trigger already exists | 1 | 🟡 Important | ✅ Corrigé |

---

## 🎯 Résultats Attendus

Après ces corrections, les migrations AWS devraient :

1. ✅ **Créer les fonctions** sans erreur de changement de type de retour
2. ✅ **Créer les index** sans erreur IMMUTABLE
3. ✅ **Créer les colonnes manquantes** avant de les utiliser
4. ✅ **Corriger les types incompatibles** de clés étrangères
5. ✅ **Diviser correctement** les commandes multiples
6. ✅ **Gérer les contraintes/triggers existants** avec DROP IF EXISTS

---

## 📝 Notes Techniques

### Gestion des Types de Retour de Fonctions

PostgreSQL ne permet pas de changer le type de retour d'une fonction avec `CREATE OR REPLACE FUNCTION`. Il faut :
1. `DROP FUNCTION IF EXISTS function_name(...) CASCADE;`
2. `CREATE FUNCTION function_name(...) ...`

### Index avec Prédicats

Les index partiels ne peuvent utiliser que des fonctions `IMMUTABLE` dans leur prédicat. `NOW()` n'est pas `IMMUTABLE` car elle retourne une valeur différente à chaque appel.

**Alternatives** :
- Supprimer le prédicat (index complet)
- Utiliser une fonction IMMUTABLE personnalisée
- Utiliser un trigger pour gérer l'expiration

### Conversion de Types UUID ↔ INTEGER

La conversion directe entre UUID et INTEGER n'est pas possible. Il faut :
1. Mettre les valeurs à NULL
2. Changer le type de colonne
3. Recréer les contraintes FK

---

**Date de création** : 2026-01-30  
**Auteur** : Analyse automatique des logs AWS

