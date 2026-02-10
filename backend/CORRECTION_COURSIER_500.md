# ✅ Correction de l'erreur 500 lors de la création d'un coursier

## 🔍 Problème identifié

**Problème** : Erreur 500 persistante lors de l'enregistrement d'un coursier dans le mobile.

**Cause probable** : La colonne `partner_id` n'existe peut-être pas encore dans la table `courier_applications` sur la base de données AWS, ce qui cause une erreur SQL lors de l'INSERT ou UPDATE.

## ✅ Corrections appliquées

### 1. Vérification dynamique de l'existence de la colonne partner_id

**Fichier** : `backend/src/services/delivery_repository.rs`

**Avant** : Les requêtes SQL utilisaient directement `partner_id` sans vérifier si la colonne existe.

**Après** : Vérification dynamique de l'existence de la colonne `partner_id` avant de l'utiliser dans les requêtes SQL.

### 2. Correction de `create_courier_application`

**Avant** :
```rust
INSERT INTO courier_applications (
    user_id,
    status,
    submitted_at,
    profile_data,
    documents,
    notes,
    partner_id  // ❌ Erreur si la colonne n'existe pas
)
VALUES ($1, $2, $3, $4, $5, $6, $7)
```

**Après** :
```rust
// Vérifier si partner_id existe
let has_partner_id_column = sqlx::query_scalar::<_, bool>(
    "SELECT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'courier_applications' 
        AND column_name = 'partner_id'
    )"
)
.fetch_one(&self.pool)
.await
.unwrap_or(false);

// Utiliser la requête appropriée selon l'existence de la colonne
if has_partner_id_column {
    // Requête avec partner_id
} else {
    // Requête sans partner_id (fallback)
}
```

### 3. Correction de `update_courier_application`

**Avant** :
```rust
UPDATE courier_applications
SET ...
    partner_id = COALESCE($6, partner_id),  // ❌ Erreur si la colonne n'existe pas
    ...
```

**Après** : Même logique de vérification dynamique avec fallback si la colonne n'existe pas.

## 📋 Migration nécessaire

Pour que la colonne `partner_id` soit disponible, exécuter la migration :

```sql
-- backend/migrations/20260210_fix_courier_applications_partner_id.sql
ALTER TABLE courier_applications 
ADD COLUMN IF NOT EXISTS partner_id INTEGER REFERENCES delivery_partners(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_courier_applications_partner ON courier_applications(partner_id);
```

**Commande pour appliquer la migration** :
```bash
sqlx migrate run
```

## 🎯 Résultat attendu

1. ✅ Si la colonne `partner_id` existe, elle est utilisée normalement
2. ✅ Si la colonne `partner_id` n'existe pas, la requête fonctionne sans elle (fallback)
3. ✅ Plus d'erreur 500 lors de la création/mise à jour d'un coursier
4. ✅ Logs d'avertissement si la colonne n'existe pas pour faciliter le diagnostic

## 📝 Fichiers modifiés

- ✅ `backend/src/services/delivery_repository.rs`
  - `create_courier_application` : Vérification dynamique de `partner_id`
  - `update_courier_application` : Vérification dynamique de `partner_id`

## 🔍 Vérification

Pour vérifier que la correction fonctionne :

1. Vérifier les logs du backend pour voir si un avertissement est affiché concernant `partner_id`
2. Tester la création d'un coursier depuis le mobile
3. Vérifier que l'erreur 500 n'apparaît plus
4. Si la colonne n'existe pas, appliquer la migration `20260210_fix_courier_applications_partner_id.sql`

## ⚠️ Note importante

La solution utilise un fallback temporaire pour éviter l'erreur 500. Pour une solution permanente, il est recommandé d'appliquer la migration `20260210_fix_courier_applications_partner_id.sql` sur la base de données AWS.

