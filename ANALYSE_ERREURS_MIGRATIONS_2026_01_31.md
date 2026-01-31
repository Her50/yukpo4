# 🔍 Analyse des Erreurs de Migration - 2026-01-31

## 📋 Résumé

Analyse des logs de migration (`log-events-viewer-result (11).csv`) pour identifier et corriger les erreurs.

---

## ❌ Erreurs Identifiées

### 1. **Erreur de Type Incompatible - CRITIQUE** ✅ CORRIGÉ

**Erreur** :
```
DETAIL: Key columns "parcel_id" and "id" are of incompatible types: integer and uuid.
```

**Fichier** : `backend/src/migrations/auto_migrate.rs` ligne 6437

**Problème** : `parcel_id` était défini comme `INTEGER` alors que `delivery_parcels.id` est de type `UUID`.

**Correction** : ✅ Changé `parcel_id INTEGER` en `parcel_id UUID`

**Fichier corrigé** :
- `backend/src/migrations/auto_migrate.rs` ligne 6437

---

### 2. **Erreurs de Syntaxe SQL - Requêtes Incomplètes**

**Erreurs** :
- `syntax error at or near ";"` pour de nombreuses requêtes SQL
- Requêtes qui se terminent par `;` sans contenu :
  - `CREATE TABLE IF NOT EXISTS duets (;`
  - `CREATE MATERIALIZED VIEW mv_user_stats AS;`
  - `CREATE INDEX IF NOT EXISTS idx_...;` (sans définition)
  - `CREATE OR REPLACE FUNCTION ...(;` (sans paramètres ni corps)

**Cause probable** : Problème de parsing/division des requêtes SQL lors de l'exécution. Les requêtes sont peut-être coupées ou mal formatées.

**Fichiers à vérifier** :
- `backend/migrations/0000_create_all_tables.sql`
- `backend/migrations/20251211_fix_user_stats_errors.sql`
- `backend/migrations/20251207_create_social_video_tables.sql`
- `backend/migrations/20251212_optimize_delivery_matching_queue_index.sql`

---

### 3. **Erreur "no language specified"**

**Erreurs** :
- `ERROR: no language specified` pour `check_specialized_type_consistency()`
- `ERROR: no language specified` pour `match_return_trip_requests()`

**Cause** : Fonctions PostgreSQL créées sans `LANGUAGE plpgsql` à la fin.

**Fichiers à vérifier** : Rechercher les fonctions qui n'ont pas `$$ LANGUAGE plpgsql;` à la fin.

---

### 4. **Erreur "syntax error at or near RETURNS"**

**Erreur** :
- `ERROR: syntax error at or near "RETURNS" at character 1`

**Cause** : Fonction qui commence par `RETURNS TRIGGER AS $$` sans `CREATE FUNCTION` avant.

**Exemple** :
```sql
RETURNS TRIGGER AS $$
BEGIN
    ...
END;
$$ LANGUAGE plpgsql;
```

**Correction** : Ajouter `CREATE OR REPLACE FUNCTION nom_fonction()` avant `RETURNS`.

---

### 5. **Erreur "cannot insert multiple commands into a prepared statement"**

**Erreurs** :
- Plusieurs migrations tentent d'exécuter plusieurs commandes SQL dans une seule requête préparée.

**Cause** : SQLx ne permet pas d'exécuter plusieurs commandes SQL séparées par `;` dans une seule requête préparée.

**Solution** : Diviser les migrations en plusieurs requêtes séparées ou utiliser `sqlx::query_file!` pour exécuter des fichiers SQL complets.

**Fichiers concernés** :
- Migrations qui contiennent plusieurs commandes SQL séparées par `;`

---

## ✅ Corrections Appliquées

### 1. Correction du type `parcel_id`

**Fichier** : `backend/src/migrations/auto_migrate.rs`

**Avant** :
```rust
parcel_id INTEGER REFERENCES delivery_parcels(id) ON DELETE SET NULL,
```

**Après** :
```rust
parcel_id UUID REFERENCES delivery_parcels(id) ON DELETE SET NULL,
```

---

## 🔧 Actions Requises

### 1. Vérifier les fichiers de migration avec requêtes incomplètes

Rechercher et corriger :
- `CREATE TABLE IF NOT EXISTS duets (;` → Compléter la définition
- `CREATE MATERIALIZED VIEW mv_user_stats AS;` → Ajouter la requête SELECT
- `CREATE INDEX IF NOT EXISTS idx_...;` → Ajouter la définition de l'index
- `CREATE OR REPLACE FUNCTION ...(;` → Ajouter les paramètres et le corps

### 2. Vérifier les fonctions sans LANGUAGE

Rechercher toutes les fonctions qui n'ont pas `$$ LANGUAGE plpgsql;` à la fin et les corriger.

### 3. Vérifier les fonctions qui commencent par RETURNS

Rechercher les fonctions qui commencent directement par `RETURNS` sans `CREATE FUNCTION` et ajouter la déclaration.

### 4. Diviser les migrations multi-commandes

Pour les migrations qui contiennent plusieurs commandes SQL, les diviser en plusieurs requêtes ou utiliser `sqlx::query_file!`.

---

## 📝 Notes

- Les erreurs de syntaxe SQL avec `;` sans contenu suggèrent un problème de parsing ou de formatage des requêtes.
- Le problème "cannot insert multiple commands" indique que certaines migrations doivent être divisées en plusieurs requêtes.
- La correction du type `parcel_id` devrait résoudre l'erreur de type incompatible.

---

**Date** : 2026-01-31  
**Statut** : ✅ Erreur principale corrigée, autres erreurs à vérifier

