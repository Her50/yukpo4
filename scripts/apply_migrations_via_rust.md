# Application des migrations via Rust

Si vous préférez utiliser le backend Rust pour appliquer les migrations (plus sûr et intégré):

## Option 1: Migrations automatiques au démarrage

Les migrations sont automatiquement appliquées au démarrage du serveur via `auto_migrate.rs`.

```bash
# Démarrer le serveur (applique automatiquement les migrations)
cargo run
```

## Option 2: Utiliser sqlx-cli

```bash
# Installer sqlx-cli si pas déjà fait
cargo install sqlx-cli

# Configurer la base de données
export DATABASE_URL="postgresql://yukpo_db_user:88X47ZWBiLkX5WatFcLU4KQ4rgaHYml4@dpg-d2t7ntbuibrs73eh9tvg-a.frankfurt-postgres.render.com/yukpo_db"

# Appliquer toutes les migrations
sqlx migrate run

# Ou vérifier l'état
sqlx migrate info
```

## Option 3: Script Rust dédié

Créer un binaire dédié dans `backend/src/bin/apply_menu_planning_migration.rs`:

```rust
use sqlx::{PgPool, postgres::PgPoolOptions};
use std::env;

#[tokio::main]
async fn main() -> Result<(), sqlx::Error> {
    let database_url = env::var("DATABASE_URL")
        .expect("DATABASE_URL must be set");
    
    let pool = PgPoolOptions::new()
        .max_connections(5)
        .connect(&database_url)
        .await?;
    
    // Lire le fichier de migration
    let migration_sql = include_str!("../../migrations/20250127_create_menu_planning_tables.sql");
    
    // Exécuter la migration
    sqlx::raw_sql(migration_sql).execute(&pool).await?;
    
    println!("✅ Migration appliquée avec succès!");
    
    Ok(())
}
```

Puis exécuter:
```bash
cargo run --bin apply_menu_planning_migration
```

