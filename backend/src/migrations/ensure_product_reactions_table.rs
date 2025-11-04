use sqlx::PgPool;
use log::{info, warn};

pub async fn ensure_product_reactions_table(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification de la table product_reactions...");

    sqlx::query(r#"
        CREATE TABLE IF NOT EXISTS product_reactions (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
            product_id TEXT NOT NULL,
            reaction_type VARCHAR(20) NOT NULL CHECK (reaction_type IN (
                'love',
                'like',
                'wow',
                'interested',
                'thinking',
                'disappointed'
            )),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            UNIQUE(user_id, service_id, product_id, reaction_type)
        )
    "#)
    .execute(pool)
    .await?;

    sqlx::query(r#"
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_indexes
                WHERE indexname = 'idx_product_reactions_product'
            ) THEN
                CREATE INDEX idx_product_reactions_product ON product_reactions(service_id, product_id);
            END IF;

            IF NOT EXISTS (
                SELECT 1 FROM pg_indexes
                WHERE indexname = 'idx_product_reactions_user'
            ) THEN
                CREATE INDEX idx_product_reactions_user ON product_reactions(user_id);
            END IF;

            IF NOT EXISTS (
                SELECT 1 FROM pg_indexes
                WHERE indexname = 'idx_product_reactions_type'
            ) THEN
                CREATE INDEX idx_product_reactions_type ON product_reactions(reaction_type);
            END IF;
        END $$;
    "#)
    .execute(pool)
    .await?;

    sqlx::query(r#"
        CREATE OR REPLACE FUNCTION get_product_reactions_count(
            p_service_id INTEGER,
            p_product_id TEXT
        )
        RETURNS TABLE (
            reaction_type VARCHAR(20),
            count BIGINT,
            users_sample TEXT[]
        )
        LANGUAGE SQL
        AS $$
            SELECT
                pr.reaction_type,
                COUNT(*)::BIGINT as count,
                array_agg(u.name ORDER BY pr.created_at DESC)::TEXT[] as users_sample
            FROM product_reactions pr
            LEFT JOIN users u ON pr.user_id = u.id
            WHERE pr.service_id = p_service_id
              AND pr.product_id = p_product_id
            GROUP BY pr.reaction_type
            ORDER BY count DESC;
        $$;
    "#)
    .execute(pool)
    .await?;

    info!("✅ Table product_reactions et ses composants vérifiés/créés avec succès !");

    Ok(())
}
