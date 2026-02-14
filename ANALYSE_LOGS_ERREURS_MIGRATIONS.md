# 🔍 Analyse des Erreurs de Migrations - Logs (36).csv

**Date**: 2026-02-13  
**Fichier analysé**: `log-events-viewer-result (36).csv`

---

## ❌ **ERREURS IDENTIFIÉES**

### 1. **Erreur Critique dans Migration Correction 002**

**Erreur**:
```
❌ [MIGRATION CORRECTION 002] Erreur lors de l'application: 
error returned from database: missing FROM-clause entry for table "u"
```

**Cause**:
- La migration de correction 002 essaie de créer la vue `product_comments_view` avec `JOIN users u`
- **PROBLÈME**: Cette migration de correction est exécutée **AVANT** la migration 0
- La table `users` n'existe **PAS ENCORE** au moment où cette migration de correction est exécutée
- La vue ne peut pas référencer une table qui n'existe pas

**Fichier concerné**: `backend/migrations/20260130_002_fix_critical_migration_errors.sql`

**Ligne problématique**:
```sql
FROM product_comments pc
JOIN users u ON u.id = pc.user_id;  -- ❌ Table users n'existe pas encore
```

---

### 2. **Erreur Critique dans Migration 0**

**Erreur**:
```
❌ ERREUR DÉTAILLÉE lors de l'application des migrations SQLx standard:
Type: ExecuteMigration(Database(PgDatabaseError { 
  severity: Error, 
  code: "42P13", 
  message: "cannot change return type of existing function", 
  detail: None, 
  hint: Some("Use DROP FUNCTION record_publicite_impression(integer,integer,character varying) first.")
```

**Cause**:
- La fonction `record_publicite_impression` existe déjà avec une signature différente
- **Conflit de signatures**:
  - Dans `00000013_create_advertising_tables.sql`: `RETURNS BOOLEAN` (3 paramètres, sans DEFAULT)
  - Dans `0000_create_all_tables.sql`: `RETURNS INTEGER` (3 paramètres, avec DEFAULT sur `p_placement`)
- PostgreSQL ne peut pas changer le type de retour d'une fonction existante
- Il faut **DROP** la fonction avant de la recréer

**Fichiers concernés**:
- `backend/migrations/00000013_create_advertising_tables.sql` (ligne 298-323)
- `backend/migrations/0000_create_all_tables.sql` (ligne 1385-1398)

**Signatures en conflit**:
```sql
-- Version 1 (00000013): RETURNS BOOLEAN, pas de DEFAULT
CREATE OR REPLACE FUNCTION record_publicite_impression(
    p_publicite_id INTEGER,
    p_user_id INTEGER,
    p_placement VARCHAR(50)  -- ❌ Pas de DEFAULT
) RETURNS BOOLEAN AS $$

-- Version 2 (0000): RETURNS INTEGER, avec DEFAULT
CREATE OR REPLACE FUNCTION record_publicite_impression(
    p_publicite_id INTEGER,
    p_user_id INTEGER,
    p_placement VARCHAR(50) DEFAULT 'feed'  -- ✅ DEFAULT
) RETURNS INTEGER AS $$
```

---

### 3. **Table Manquante: delivery_proximity_suggestions**

**Erreur**:
```
❌ ERREUR CRITIQUE: 1 table(s) critique(s) manquante(s) après échec SQLx:
    - delivery_proximity_suggestions
```

**Cause**:
- La table `delivery_proximity_suggestions` n'est **PAS créée** dans la migration 0
- Elle est référencée dans `20251128_004_optimize_monitoring_queries.sql` (ligne 128) pour créer un index
- Mais la table elle-même n'existe pas dans `0000_create_all_tables.sql`

**Impact**:
- L'application s'arrête avec le code 1
- Les workers et services ne peuvent pas fonctionner sans cette table

---

## 🔧 **SOLUTIONS**

### Solution 1: Corriger la Migration Correction 002

**Problème**: La vue `product_comments_view` est créée avant que la table `users` n'existe.

**Solution**: 
1. **Option A**: Retarder la création de la vue jusqu'après la migration 0
2. **Option B**: Utiliser `LEFT JOIN` et vérifier que la table existe avant de créer la vue
3. **Option C**: Supprimer cette vue de la migration de correction 002 (elle sera créée dans la migration 0)

**Recommandation**: **Option C** - Supprimer la création de la vue de la migration de correction 002, car elle est déjà créée dans la migration 0.

---

### Solution 2: Corriger le Conflit de Fonction record_publicite_impression

**Problème**: Conflit de signature entre deux migrations.

**Solution**:
1. **DROP** la fonction avant de la recréer dans la migration 0
2. Utiliser la signature la plus récente (INTEGER avec DEFAULT)

**Code à ajouter dans `0000_create_all_tables.sql`** (avant la création de la fonction):
```sql
-- ✅ CORRECTION: DROP la fonction si elle existe avec l'ancienne signature
DROP FUNCTION IF EXISTS record_publicite_impression(INTEGER, INTEGER, VARCHAR(50));
DROP FUNCTION IF EXISTS record_publicite_impression(INTEGER, INTEGER, VARCHAR(50), VARCHAR(50));
```

---

### Solution 3: Créer la Table delivery_proximity_suggestions

**Problème**: La table n'existe pas dans la migration 0.

**Solution**: Ajouter la création de la table dans `0000_create_all_tables.sql`.

**Code à ajouter**:
```sql
-- ✅ Table pour les suggestions de proximité de livraison
CREATE TABLE IF NOT EXISTS delivery_proximity_suggestions (
    id SERIAL PRIMARY KEY,
    delivery_id INTEGER NOT NULL,
    suggested_courier_id INTEGER,
    proximity_score DOUBLE PRECISION,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_delivery_proximity_suggestions_delivery 
    ON delivery_proximity_suggestions(delivery_id);
CREATE INDEX IF NOT EXISTS idx_delivery_proximity_suggestions_status_created 
    ON delivery_proximity_suggestions(status, created_at);
```

---

## 📋 **PLAN D'ACTION**

1. ✅ **Corriger la migration de correction 002** : Supprimer la création de `product_comments_view`
2. ✅ **Corriger la migration 0** : Ajouter DROP FUNCTION avant la création de `record_publicite_impression`
3. ✅ **Créer la table delivery_proximity_suggestions** : Ajouter dans la migration 0
4. ✅ **Tester les corrections** : Appliquer les migrations et vérifier qu'elles passent
5. ✅ **Redéployer** : Redémarrer le service ECS

---

## 🚨 **PRIORITÉ**

- **CRITIQUE**: Solution 2 (conflit de fonction) - Bloque la migration 0
- **CRITIQUE**: Solution 3 (table manquante) - Bloque le démarrage de l'application
- **MOYEN**: Solution 1 (vue) - Erreur non bloquante mais à corriger

---

**Prochaine étape**: Créer un script de correction SQL pour appliquer ces corrections directement sur la base de données.

