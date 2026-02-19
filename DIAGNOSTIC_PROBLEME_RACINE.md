# 🔍 Diagnostic du Problème Racine

## ❌ Le Vrai Problème

### Conflit entre Migrations SQL et Code Rust

1. **Migration SQL `00000016_create_promotion_tables.sql`** crée `global_promo_events` avec :
   ```sql
   name VARCHAR(255)
   event_type VARCHAR(50)
   is_active BOOLEAN
   -- ❌ PAS de status
   -- ❌ PAS de slug, theme, display_name
   ```

2. **Code Rust `auto_migrate.rs`** crée `global_promo_events` avec :
   ```rust
   slug TEXT
   theme TEXT
   display_name TEXT
   status VARCHAR(32)
   -- ❌ PAS de name, event_type, is_active
   ```

3. **Résultat** : 
   - Si la table est créée par la migration SQL → elle n'a pas `status`
   - Si la table est créée par le code Rust → elle n'a pas `name`, `event_type`, `is_active`
   - `CREATE TABLE IF NOT EXISTS` ne modifie pas une table existante
   - Les fonctions `ensure_*_columns()` sont appelées APRÈS, mais ne couvrent pas tous les cas

### Pourquoi on Tourne en Rond

1. ✅ On corrige manuellement sur EC2 → les colonnes sont ajoutées
2. ❌ Nouveau build ECS → `auto_migrate.rs` s'exécute
3. ❌ `CREATE TABLE IF NOT EXISTS` ne fait rien (table existe déjà)
4. ❌ Les fonctions `ensure_*_columns()` ne sont pas toujours appelées au bon moment
5. ❌ OU elles ne vérifient pas toutes les colonnes nécessaires
6. 🔄 Le problème revient

## ✅ Solution Définitive

### Option 1 : Aligner les Migrations SQL avec le Code Rust (RECOMMANDÉ)

Modifier les migrations SQL pour qu'elles correspondent exactement au code Rust :

1. **`00000016_create_promotion_tables.sql`** :
   - Ajouter `status`, `slug`, `theme`, `display_name`
   - Garder `name`, `event_type`, `is_active` (pour compatibilité)

2. **`00000017_create_social_media_tables.sql`** :
   - Vérifier que toutes les colonnes sont présentes

### Option 2 : Désactiver les Migrations Automatiques

Utiliser uniquement les migrations SQL, désactiver `auto_migrate.rs` pour ces tables.

### Option 3 : Améliorer `ensure_*_columns()` pour TOUTES les Colonnes

S'assurer que les fonctions `ensure_*_columns()` vérifient TOUTES les colonnes nécessaires, pas seulement celles qui manquent.

## 🎯 Recommandation

**Option 1** : Aligner les migrations SQL avec le code Rust pour éviter les conflits futurs.



