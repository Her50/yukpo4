// Fonction pour assurer que la table service_reviews existe avec toutes les colonnes nécessaires
use sqlx::PgPool;
use log::{info, warn};

pub async fn ensure_service_reviews_table(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification de la table service_reviews...");
    
    // Créer la table si elle n'existe pas
    sqlx::query(r#"
        CREATE TABLE IF NOT EXISTS service_reviews (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            service_id INTEGER REFERENCES services(id) ON DELETE CASCADE,
            rating INTEGER CHECK (rating >= 0 AND rating <= 5) NOT NULL,
            review_text TEXT,
            reply_to_review_id INTEGER REFERENCES service_reviews(id) ON DELETE CASCADE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
    "#)
    .execute(pool)
    .await?;
    
    // Vérifier si la colonne reply_to_review_id existe, sinon la créer
    let column_exists = sqlx::query_scalar::<_, bool>(
        r#"
        SELECT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'service_reviews' 
            AND column_name = 'reply_to_review_id'
        )
        "#
    )
    .fetch_one(pool)
    .await?;
    
    if !column_exists {
        warn!("⚠️ Colonne reply_to_review_id manquante, ajout en cours...");
        sqlx::query(
            "ALTER TABLE service_reviews ADD COLUMN reply_to_review_id INTEGER REFERENCES service_reviews(id) ON DELETE CASCADE"
        )
        .execute(pool)
        .await?;
        info!("✅ Colonne reply_to_review_id ajoutée");
    }
    
    // Créer les index de base
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_service_reviews_user_id ON service_reviews(user_id)")
        .execute(pool)
        .await?;
    
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_service_reviews_service_id ON service_reviews(service_id)")
        .execute(pool)
        .await?;
    
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_service_reviews_rating ON service_reviews(rating)")
        .execute(pool)
        .await?;
    
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_service_reviews_created_at ON service_reviews(created_at)")
        .execute(pool)
        .await?;
    
    // Créer l'index conditionnel pour les réponses (SQLx offline mode compatible)
    let index_exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_service_reviews_reply_to')"
    )
    .fetch_one(pool)
    .await?;
    
    if !index_exists {
        sqlx::query(
            "CREATE INDEX idx_service_reviews_reply_to ON service_reviews(reply_to_review_id) WHERE reply_to_review_id IS NOT NULL"
        )
        .execute(pool)
        .await?;
        info!("✅ Index idx_service_reviews_reply_to créé");
    }
    
    // Créer la fonction de mise à jour updated_at
    sqlx::query(r#"
        CREATE OR REPLACE FUNCTION update_service_reviews_updated_at()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql
    "#)
    .execute(pool)
    .await?;
    
    // Créer le trigger
    sqlx::query(r#"
        DROP TRIGGER IF EXISTS trigger_update_service_reviews_updated_at ON service_reviews;
        CREATE TRIGGER trigger_update_service_reviews_updated_at
            BEFORE UPDATE ON service_reviews
            FOR EACH ROW
            EXECUTE FUNCTION update_service_reviews_updated_at()
    "#)
    .execute(pool)
    .await?;
    
    info!("✅ Table service_reviews vérifiée et configurée avec succès !");
    
    Ok(())
}

