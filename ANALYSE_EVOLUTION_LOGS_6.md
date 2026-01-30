# 📊 Analyse de l'Évolution - Logs (6)

## 📋 Résumé

Analyse des nouveaux logs pour vérifier l'évolution et l'exécution des migrations de correction.

---

## 🔍 Vérification de l'Exécution des Migrations

### ❌ Migrations de Correction NON Exécutées

**Recherche dans les logs** :
- ❌ Aucun message `MIGRATION CORRECTION 002`
- ❌ Aucun message `MIGRATION CORRECTION 003`
- ❌ Aucun message `MIGRATION CORRECTION 004`
- ❌ Aucun message `MIGRATION 0`
- ❌ Aucun message `MIGRATION CONSOLIDÉE`
- ❌ Aucun message `MIGRATIONS SQLX`

**Conclusion** : ⚠️ **Les migrations de correction ne s'exécutent PAS dans AWS**

**Cause probable** : Le code modifié dans `main.rs` n'est **pas encore déployé** dans AWS.

---

## 📊 Comparaison des Erreurs

### Fichier 5 (log-events-viewer-result (5).csv)
- `cannot insert multiple commands`: **2 erreurs**
- `already exists` (constraint/trigger): **1 erreur** (`trigger_update_effects_updated_at`)
- `does not exist` (column/relation): **~12 erreurs**
- `foreign key constraint cannot be implemented`: **1 erreur**
- `must be marked IMMUTABLE`: **1 erreur**
- `cannot change return type`: **2 erreurs**
- `function name not unique`: **4 erreurs**
- `syntax error`: **1 erreur** (`programmes_scolaires`)

**Total estimé**: ~24 erreurs

---

### Fichier 6 (log-events-viewer-result (6).csv)
- `cannot insert multiple commands`: **6 erreurs** ⚠️ **+4 erreurs**
- `already exists` (constraint/trigger): **1 erreur** (`trigger_update_templates_updated_at`) - **NOUVEAU**
- `does not exist` (column/relation): **~12 erreurs** (stable)
- `foreign key constraint cannot be implemented`: **0 erreur** ✅ **-1 erreur**
- `must be marked IMMUTABLE`: **0 erreur** ✅ **-1 erreur**
- `cannot change return type`: **3 erreurs** ⚠️ **+1 erreur**
- `function name not unique`: **3 erreurs** ✅ **-1 erreur**
- `syntax error`: **1 erreur** (`programmes_scolaires`) (stable)
- `array_agg is an aggregate function`: **1 erreur** ❌ **NOUVEAU**

**Total estimé**: ~27 erreurs ⚠️ **+3 erreurs**

---

## 📈 Évolution Détaillée

| Erreur | Fichier 5 | Fichier 6 | Évolution |
|--------|-----------|-----------|-----------|
| **Total erreurs** | ~24 | ~27 | ⚠️ **+3 (+12%)** |
| **cannot insert multiple** | 2 | 6 | ❌ **+4 (+200%)** |
| **already exists** | 1 | 1 | ⚠️ Stable (différent) |
| **does not exist** | ~12 | ~12 | ⚠️ Stable |
| **foreign key** | 1 | 0 | ✅ **-1 (-100%)** |
| **IMMUTABLE** | 1 | 0 | ✅ **-1 (-100%)** |
| **cannot change return type** | 2 | 3 | ❌ **+1 (+50%)** |
| **function not unique** | 4 | 3 | ✅ **-1 (-25%)** |
| **syntax error** | 1 | 1 | ⚠️ Stable |
| **array_agg** | 0 | 1 | ❌ **+1 (NOUVEAU)** |

---

## ✅ Améliorations

1. **`foreign key constraint cannot be implemented`**: 
   - Fichier 5: 1 erreur
   - Fichier 6: 0 erreur
   - **Évolution**: ✅ **-1 erreur** (amélioration de 100%)

2. **`functions in index predicate must be marked IMMUTABLE`**: 
   - Fichier 5: 1 erreur
   - Fichier 6: 0 erreur
   - **Évolution**: ✅ **-1 erreur** (amélioration de 100%)

3. **`function name not unique`**: 
   - Fichier 5: 4 erreurs
   - Fichier 6: 3 erreurs
   - **Évolution**: ✅ **-1 erreur** (amélioration de 25%)

---

## ❌ Régressions

1. **`cannot insert multiple commands`**: 
   - Fichier 5: 2 erreurs
   - Fichier 6: 6 erreurs
   - **Évolution**: ❌ **+4 erreurs** (régression de 200%)
   - **Cause**: La fonction `execute_multiple_sql_commands()` ne divise toujours pas correctement toutes les commandes

2. **`cannot change return type`**: 
   - Fichier 5: 2 erreurs
   - Fichier 6: 3 erreurs
   - **Évolution**: ❌ **+1 erreur** (régression de 50%)

3. **`array_agg is an aggregate function`**: 
   - Fichier 5: 0 erreur
   - Fichier 6: 1 erreur
   - **Évolution**: ❌ **+1 erreur** (NOUVEAU)

4. **`trigger_update_templates_updated_at already exists`**: 
   - Fichier 5: 0 erreur (avait `trigger_update_effects_updated_at`)
   - Fichier 6: 1 erreur (nouveau trigger)
   - **Évolution**: ❌ **+1 erreur** (NOUVEAU)

---

## 🔍 Analyse des Erreurs Nouvelles

### 1. `cannot insert multiple commands` (6 erreurs)

**Problème** : La fonction `execute_multiple_sql_commands()` ne divise toujours pas correctement toutes les commandes.

**Erreurs spécifiques** :
- Ligne 645: `cannot insert multiple commands` (programmes_scolaires)
- Ligne 781: `cannot insert multiple commands`
- Ligne 1059: `cannot insert multiple commands`
- Ligne 1294: `cannot insert multiple commands`
- Ligne 1340: `cannot insert multiple commands`
- Ligne 1383: `cannot insert multiple commands`

**Cause** : La fonction ne détecte pas correctement toutes les fins de commandes, notamment pour les blocs DO $$...END $$;

---

### 2. `programmes_scolaires` - Colonnes Manquantes

**Erreurs** :
- `column "etablissement_id" does not exist`
- `column "type_etablissement" does not exist`
- `column "annee_scolaire" does not exist`
- `relation "programmes_scolaires" does not exist`

**Problème** : La table `programmes_scolaires` est créée dans la migration 004, mais :
1. Elle n'est pas créée (les migrations de correction ne s'exécutent pas)
2. OU elle est créée avec une structure incomplète

**Solution** : Vérifier que la migration 004 crée la table avec toutes les colonnes nécessaires (déjà fait ✅)

---

### 3. `pharmacy_order_items` et `pharmacy_reservations` - Colonnes Manquantes

**Erreurs** :
- `column "order_id" does not exist`
- `column "medication_id" does not exist`
- `column "pharmacy_id" does not exist`
- `column "user_id" does not exist`
- `column "status" does not exist`

**Problème** : Les colonnes sont créées dans la migration 004, mais les migrations de correction ne s'exécutent pas.

**Solution** : Les migrations de correction doivent s'exécuter AVANT la migration 0 (déjà fait dans le code ✅, mais pas déployé)

---

### 4. `trigger_update_templates_updated_at already exists`

**Problème** : Nouveau trigger qui n'a pas de `DROP TRIGGER IF EXISTS` avant `CREATE TRIGGER`.

**Solution** : Ajouter `DROP TRIGGER IF EXISTS` dans `0000_create_all_tables.sql` ou dans la migration 004.

---

### 5. `array_agg is an aggregate function`

**Problème** : Utilisation incorrecte de `array_agg` dans un contexte où il ne peut pas être utilisé.

**Solution** : Corriger l'utilisation de `array_agg` dans la migration concernée.

---

## 🎯 Conclusion

### ⚠️ Problème Principal

**Les migrations de correction ne s'exécutent PAS dans AWS** :
- ❌ Aucun log de migration de correction
- ❌ Aucun log de migration 0
- ❌ Aucun log de migration consolidée
- ❌ Aucun log de migrations SQLx

**Cause** : Le code modifié dans `main.rs` n'est **pas encore déployé** dans AWS.

---

### 📊 Évolution Globale

**Améliorations** :
- ✅ `foreign key constraint`: -1 erreur (100% amélioration)
- ✅ `IMMUTABLE`: -1 erreur (100% amélioration)
- ✅ `function not unique`: -1 erreur (25% amélioration)

**Régressions** :
- ❌ `cannot insert multiple`: +4 erreurs (200% régression)
- ❌ `cannot change return type`: +1 erreur (50% régression)
- ❌ Nouvelles erreurs: `array_agg`, `trigger_update_templates_updated_at`

**Total** : ⚠️ **+3 erreurs** (12% régression)

---

### 🔧 Actions Requises

1. **Déployer le nouveau code** dans AWS
   - Le code avec l'ordre d'exécution amélioré est prêt
   - Mais il n'est pas encore déployé

2. **Corriger les nouvelles erreurs** :
   - Ajouter `DROP TRIGGER IF EXISTS` pour `trigger_update_templates_updated_at`
   - Corriger l'utilisation de `array_agg`
   - Améliorer `execute_multiple_sql_commands()` pour mieux diviser les commandes

3. **Vérifier que les migrations de correction s'exécutent** :
   - Chercher les logs `MIGRATION CORRECTION` dans AWS
   - Vérifier que les fichiers de migration sont présents dans le build Docker

---

**Date d'analyse**: 2026-01-30  
**Statut**: ⚠️ Régression légère (+3 erreurs), mais améliorations sur certaines erreurs. **Les migrations de correction ne s'exécutent pas** (code non déployé).

