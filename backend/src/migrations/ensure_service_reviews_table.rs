use sqlx::PgPool;
use log::{info, warn};

pub async fn ensure_service_reviews_table(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification de la table service_reviews...");

    // Créer la table si elle n'existe pas
    sqlx::query(r#"
        CREATE TABLE IF NOT EXISTS service_reviews (
            id SERIAL PRIMARY KEY,
            service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            rating INTEGER CHECK (rating >= 0 AND rating <= 5) NOT NULL,
            comment TEXT,
            reply_to_review_id INTEGER REFERENCES service_reviews(id) ON DELETE CASCADE,
            is_helpful_count INTEGER DEFAULT 0,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
    "#)
    .execute(pool)
    .await?;

    // Créer les index de manière conditionnelle (SQLx offline compatible)
    sqlx::query(r#"
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_indexes
                WHERE indexname = 'idx_service_reviews_service'
            ) THEN
                CREATE INDEX idx_service_reviews_service ON service_reviews(service_id);
            END IF;

            IF NOT EXISTS (
                SELECT 1 FROM pg_indexes
                WHERE indexname = 'idx_service_reviews_user'
            ) THEN
                CREATE INDEX idx_service_reviews_user ON service_reviews(user_id);
            END IF;

            IF NOT EXISTS (
                SELECT 1 FROM pg_indexes
                WHERE indexname = 'idx_service_reviews_reply_to'
            ) THEN
                CREATE INDEX idx_service_reviews_reply_to ON service_reviews(reply_to_review_id);
            END IF;
        END $$;
    "#)
    .execute(pool)
    .await?;

    // Ajouter la colonne reply_to_review_id si elle n'existe pas (migration progressive)
    sqlx::query(r#"
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'service_reviews' AND column_name = 'reply_to_review_id'
            ) THEN
                ALTER TABLE service_reviews
                ADD COLUMN reply_to_review_id INTEGER REFERENCES service_reviews(id) ON DELETE CASCADE;
                
                -- Créer l'index pour la nouvelle colonne
                CREATE INDEX idx_service_reviews_reply_to ON service_reviews(reply_to_review_id);
            END IF;
        END $$;
    "#)
    .execute(pool)
    .await?;

    info!("✅ Table service_reviews vérifiée/créée avec succès !");

    Ok(())
}
