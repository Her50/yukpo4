# 🔧 EXPLICATIONS : Migrations Automatiques & Données Existantes

**Date** : 2025-11-02  
**Contexte** : SQLx offline mode + auto_migrate.rs

---

## ❓ VOS QUESTIONS

### 1. Toutes les tables sont-elles dans auto_migrate.rs ?
### 2. Les migrations écrasent-elles les données existantes ?

---

## 📊 ÉTAT ACTUEL DES TABLES

### ✅ Tables dans `auto_migrate.rs` (créées au démarrage)

| Table | Source | Statut | Notes |
|-------|--------|--------|-------|
| `products_lifecycle` | Existant | ✅ OK | Gestion cycle de vie produits |
| `publicites` | Existant | ✅ OK | Publicités des prestataires |
| `notifications` | Existant | ✅ OK | Notifications utilisateurs |
| `token_usage_logs` | **NOUVEAU** | ✅ OK | Historique tokens (structure simplifiée) |
| `autocomplete_combinations` | **NOUVEAU** | ✅ OK | Vecteurs complets produit+lieu |
| `geo_hierarchy` | **NOUVEAU** | ✅ OK | Cache hiérarchie géographique |
| `image_analyses` | **NOUVEAU** | ✅ OK | Analyses IA d'images |

### ⚠️ Tables dans `migrations/*.sql` (mode offline = NON EXÉCUTÉES)

| Fichier | Tables Créées | Problème |
|---------|---------------|----------|
| `0000_create_all_tables.sql` | `users`, `services`, `media`, etc. | ❌ Non exécuté en offline |
| `20251101_002_create_token_usage_logs.sql` | `token_usage_logs` (version différente) | ❌ Non exécuté |
| `20251101_create_autocomplete_characteristics.sql` | `autocomplete_characteristics` | ❌ Non exécuté |
| `20251026_create_image_analyses_table.sql` | `image_analyses` (version différente) | ❌ Non exécuté |

**🚨 IMPORTANT** : En mode offline SQLx, les fichiers `.sql` dans `migrations/` ne sont PAS exécutés automatiquement.

---

## 🔍 VÉRIFICATION : Tables Manquantes à Migrer

### Tables Critiques Utilisées dans le Code

| Table | Utilisée dans | Existe dans auto_migrate ? | Action Requise |
|-------|---------------|----------------------------|----------------|
| `users` | Partout | ❌ NON | ⚠️ À AJOUTER |
| `services` | Partout | ❌ NON | ⚠️ À AJOUTER |
| `media` | creer_service.rs | ❌ NON | ⚠️ À AJOUTER |
| `echanges` | echange_controller.rs | ❌ NON | ⚠️ À AJOUTER |
| `messages` | chat_routes.rs | ❌ NON | ⚠️ À AJOUTER |
| `conversations` | chat_routes.rs | ❌ NON | ⚠️ À AJOUTER |
| `autocomplete_characteristics` | Recherche | ❌ NON | ℹ️ Optionnel (différent de combinations) |

### 🎯 Recommandation

**Option A** : Copier la structure de `0000_create_all_tables.sql` dans `auto_migrate.rs`  
**Option B** : Garder les tables existantes si déjà créées manuellement en production

---

## 💡 RÉPONSE : Les Migrations Écrasent-elles les Données ?

### ✅ NON ! Les données sont PRÉSERVÉES

Voici comment fonctionne `CREATE TABLE IF NOT EXISTS` :

```sql
CREATE TABLE IF NOT EXISTS ma_table (
    id SERIAL PRIMARY KEY,
    nom VARCHAR(255) NOT NULL
);
```

**Comportement** :
1. ✅ **Si la table N'EXISTE PAS** : Elle est créée vide
2. ✅ **Si la table EXISTE DÉJÀ** : Rien ne se passe (structure ET données préservées)

### Exemple Concret

```rust
pub async fn ensure_users_table(pool: &PgPool) -> Result<(), sqlx::Error> {
    // Vérifie d'abord si la table existe
    let exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'users')"
    )
    .fetch_one(pool)
    .await?;
    
    if exists {
        info!("✅ Table users déjà présente");
        return Ok(()); // ⬅️ Sort immédiatement, rien n'est touché
    }
    
    warn!("⚠️ Table users manquante, création en cours...");
    
    // Crée SEULEMENT si elle n'existe pas
    sqlx::query(r#"
        CREATE TABLE IF NOT EXISTS users (...)
    "#)
    .execute(pool)
    .await?;
    
    Ok(())
}
```

### 🔒 Garanties de Sécurité

**Ce qui est PRÉSERVÉ** :
- ✅ Toutes les lignes de données existantes
- ✅ Tous les index existants
- ✅ Toutes les contraintes existantes
- ✅ Tous les triggers existants

**Ce qui POURRAIT POSER PROBLÈME** :
- ⚠️ Si la structure de la table a changé (nouvelles colonnes dans le code vs BDD)
- ⚠️ Si les types de colonnes sont différents

### 🛡️ Stratégie de Migration Sécurisée

```rust
pub async fn ensure_autocomplete_combinations_table(pool: &PgPool) -> Result<(), sqlx::Error> {
    // Étape 1 : Vérifier si table existe
    let exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM information_schema.tables 
         WHERE table_name = 'autocomplete_combinations')"
    ).fetch_one(pool).await?;
    
    if exists {
        info!("✅ Table autocomplete_combinations déjà présente");
        
        // Étape 2 : Vérifier si nouvelles colonnes manquent
        // (optionnel, pour migration progressive)
        
        return Ok(());
    }
    
    // Étape 3 : Créer SEULEMENT si absente
    sqlx::query(r#"
        CREATE TABLE autocomplete_combinations (
            id SERIAL PRIMARY KEY,
            -- ... colonnes ...
        )
    "#).execute(pool).await?;
    
    // Étape 4 : Créer les index
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_full_vector_gin ...")
        .execute(pool).await?;
    
    Ok(())
}
```

---

## 📋 CAS PRATIQUES

### Cas 1 : Première Installation (BDD Vide)

**Scénario** : Nouveau développeur clone le projet

```bash
cargo run
```

**Résultat** :
- ✅ Toutes les tables dans `auto_migrate.rs` sont créées
- ⚠️ Tables dans `migrations/*.sql` NE SONT PAS créées (offline mode)
- ❌ Erreur si le code utilise `users` ou `services` (pas dans auto_migrate)

**Solution** : Ajouter TOUTES les tables principales dans `auto_migrate.rs`

---

### Cas 2 : Production avec Données Existantes

**Scénario** : Votre serveur a déjà 10 000 utilisateurs et 5 000 services

```bash
cargo run
```

**Résultat** :
- ✅ `users` existe → Rien ne se passe, 10 000 users préservés
- ✅ `services` existe → Rien ne se passe, 5 000 services préservés
- ✅ `autocomplete_combinations` n'existe pas → Créée vide
- ✅ `geo_hierarchy` n'existe pas → Créée vide

**Aucune perte de données !**

---

### Cas 3 : Migration avec Nouvelle Colonne

**Problème** : Vous ajoutez une colonne `email_verified BOOLEAN` dans le code, mais pas dans la BDD

```rust
// Code attend email_verified
let user = sqlx::query!("SELECT email_verified FROM users WHERE id = $1", user_id)
    .fetch_one(pool).await?;
```

**Erreur** : 
```
❌ column "email_verified" does not exist
```

**Solution** : Migration ALTER TABLE

```rust
pub async fn ensure_users_email_verified_column(pool: &PgPool) -> Result<(), sqlx::Error> {
    // Vérifie si colonne existe
    let exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM information_schema.columns 
         WHERE table_name = 'users' AND column_name = 'email_verified')"
    ).fetch_one(pool).await?;
    
    if !exists {
        warn!("⚠️ Colonne email_verified manquante, ajout en cours...");
        
        // Ajoute la colonne SANS toucher aux données existantes
        sqlx::query("ALTER TABLE users ADD COLUMN email_verified BOOLEAN DEFAULT FALSE")
            .execute(pool).await?;
        
        info!("✅ Colonne email_verified ajoutée");
    }
    
    Ok(())
}
```

---

## 🎯 CONCLUSION

### Questions Répondues

**Q1 : Les migrations écrasent-elles les données ?**  
✅ **NON** - `CREATE TABLE IF NOT EXISTS` préserve TOUTES les données existantes

**Q2 : Toutes les tables sont dans auto_migrate ?**  
❌ **NON** - Seules 7 tables sont gérées, il manque `users`, `services`, `media`, etc.

### 🚨 ACTIONS REQUISES

1. **Ajouter les tables principales** dans `auto_migrate.rs` :
   - `users`
   - `services`
   - `media`
   - `echanges`
   - `messages`
   - `conversations`

2. **OU** accepter que ces tables soient créées manuellement en production

3. **Tester** : Lancer `cargo run` sur BDD vide pour vérifier

---

## 📝 EXEMPLE COMPLET : Ajouter Table `users`

```rust
/// Vérifie et crée la table users si elle n'existe pas
pub async fn ensure_users_table(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification de la table users...");
    
    let exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'users')"
    )
    .fetch_one(pool)
    .await?;
    
    if exists {
        info!("✅ Table users déjà présente");
        return Ok(());
    }
    
    warn!("⚠️ Table users manquante, création en cours...");
    
    sqlx::query(r#"
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL,
            is_provider BOOLEAN NOT NULL DEFAULT FALSE,
            tokens_balance BIGINT NOT NULL DEFAULT 0,
            nom_complet VARCHAR(255),
            telephone VARCHAR(20),
            gps VARCHAR(255),
            gps_consent BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    "#)
    .execute(pool)
    .await?;
    
    // Créer les index
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)")
        .execute(pool)
        .await?;
    
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)")
        .execute(pool)
        .await?;
    
    info!("✅ Table users créée avec succès !");
    
    Ok(())
}
```

---

**Voulez-vous que j'ajoute les tables manquantes (`users`, `services`, `media`) dans `auto_migrate.rs` ?**



