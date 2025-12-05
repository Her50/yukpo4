# 📋 Instructions pour ajouter la migration effects dans auto_migrate.rs et 0000_create_all_tables.sql

## ✅ Fichier SQL créé

Le fichier `APPLY_EFFECTS_MIGRATION_RENDER.sql` a été créé et peut être appliqué directement sur la base Render avec :

```bash
psql "postgresql://yukpo_db_user:88X47ZWBiLkX5WatFcLU4KQ4rgaHYml4@dpg-d2t7ntbuibrs73eh9tvg-a.frankfurt-postgres.render.com/yukpo_db" -f APPLY_EFFECTS_MIGRATION_RENDER.sql
```

## 📝 Ajout dans auto_migrate.rs

À ajouter **juste avant** la fonction `pub async fn run_auto_migrations(pool: &PgPool)` (ligne 6421) :

```rust
/// ✅ NOUVEAU 2025-01-27: Vérifie et crée la table effects si elle n'existe pas
pub async fn ensure_effects_table(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification de la table effects...");

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS effects (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) NOT NULL UNIQUE,
            category VARCHAR(50) NOT NULL CHECK (category IN ('transitions', 'visual_effects', 'animations', 'special')),
            description TEXT NOT NULL,
            ffmpeg_filter TEXT NOT NULL,
            parameters JSONB NOT NULL DEFAULT '{}'::jsonb,
            tags TEXT[] NOT NULL DEFAULT '{}',
            is_premium BOOLEAN NOT NULL DEFAULT FALSE,
            popularity_score DOUBLE PRECISION NOT NULL DEFAULT 0.0,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        "#,
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_effects_category ON effects(category)",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_effects_tags ON effects USING GIN(tags)",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_effects_popularity ON effects(popularity_score DESC)",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_effects_name ON effects(name)",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_effects_category_popularity ON effects(category, popularity_score DESC)",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        r#"
        CREATE OR REPLACE FUNCTION update_effects_updated_at()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
        "#,
    )
    .execute(pool)
    .await?;

    sqlx::query(
        r#"
        DROP TRIGGER IF EXISTS trigger_update_effects_updated_at ON effects;
        CREATE TRIGGER trigger_update_effects_updated_at
            BEFORE UPDATE ON effects
            FOR EACH ROW
            EXECUTE FUNCTION update_effects_updated_at();
        "#,
    )
    .execute(pool)
    .await?;

    Ok(())
}
```

Puis ajouter l'appel dans `run_auto_migrations` (après `ensure_global_promo_tables`) :

```rust
    match ensure_effects_table(pool).await {
        Ok(_) => info!("✅ Migration auto: effects table OK"),
        Err(e) => error!("❌ Erreur migration auto effects table: {}", e),
    }
```

## 📝 Ajout dans 0000_create_all_tables.sql

À ajouter à la **fin** du fichier (après la ligne 4578) :

```sql
-- ✅ NOUVEAU 2025-01-27: Table pour bibliothèque d'effets vidéo étendue (50+)
CREATE TABLE IF NOT EXISTS effects (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    category VARCHAR(50) NOT NULL CHECK (category IN ('transitions', 'visual_effects', 'animations', 'special')),
    description TEXT NOT NULL,
    ffmpeg_filter TEXT NOT NULL,
    parameters JSONB NOT NULL DEFAULT '{}'::jsonb,
    tags TEXT[] NOT NULL DEFAULT '{}',
    is_premium BOOLEAN NOT NULL DEFAULT FALSE,
    popularity_score DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_effects_category ON effects(category);
CREATE INDEX IF NOT EXISTS idx_effects_tags ON effects USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_effects_popularity ON effects(popularity_score DESC);
CREATE INDEX IF NOT EXISTS idx_effects_name ON effects(name);
CREATE INDEX IF NOT EXISTS idx_effects_category_popularity ON effects(category, popularity_score DESC);

CREATE OR REPLACE FUNCTION update_effects_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_effects_updated_at
    BEFORE UPDATE ON effects
    FOR EACH ROW
    EXECUTE FUNCTION update_effects_updated_at();
```

**Note** : Les INSERT des 50+ effets seront exécutés uniquement via la migration SQLx normale (`20250127_001_create_effects_library.sql`) ou via le script `APPLY_EFFECTS_MIGRATION_RENDER.sql` pour éviter de ralentir le démarrage avec auto_migrate.


