// Module de configuration de la base de données
// Ce module s'assure que toutes les tables nécessaires existent

use sqlx::PgPool;

pub async fn ensure_payment_tables_exist(pool: &PgPool) -> Result<(), sqlx::Error> {
    println!("Vérification de l'existence des tables de paiement...");

    // Vérifier si payment_transactions existe
    let payment_table_exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_name = 'payment_transactions'
        )",
    )
    .fetch_one(pool)
    .await?;

    if !payment_table_exists {
        println!("Création de la table payment_transactions...");
        sqlx::query(
            r#"
            CREATE TABLE payment_transactions (
                id SERIAL PRIMARY KEY,
                transaction_id VARCHAR(255) UNIQUE NOT NULL,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                amount DECIMAL(10,2) NOT NULL,
                currency VARCHAR(10) NOT NULL DEFAULT 'XAF',
                payment_method JSONB NOT NULL,
                status VARCHAR(50) NOT NULL DEFAULT 'pending',
                gateway_response JSONB,
                reference VARCHAR(255),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
            "#,
        )
        .execute(pool)
        .await?;

        // Créer les index
        sqlx::query(
            "CREATE INDEX idx_payment_transactions_user_id ON payment_transactions(user_id)",
        )
        .execute(pool)
        .await?;
        sqlx::query("CREATE INDEX idx_payment_transactions_status ON payment_transactions(status)")
            .execute(pool)
            .await?;
        sqlx::query(
            "CREATE INDEX idx_payment_transactions_created_at ON payment_transactions(created_at)",
        )
        .execute(pool)
        .await?;

        println!("✓ Table payment_transactions créée");
    } else {
        println!("✓ Table payment_transactions existe déjà");
    }

    // Vérifier si token_transactions existe
    let token_table_exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_name = 'token_transactions'
        )",
    )
    .fetch_one(pool)
    .await?;

    if !token_table_exists {
        println!("Création de la table token_transactions...");
        sqlx::query(
            r#"
            CREATE TABLE token_transactions (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                transaction_id VARCHAR(255) REFERENCES payment_transactions(transaction_id),
                amount INTEGER NOT NULL DEFAULT 0,
                bonus INTEGER NOT NULL DEFAULT 0,
                total INTEGER NOT NULL DEFAULT 0,
                transaction_type VARCHAR(50) NOT NULL,
                description TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
            "#,
        )
        .execute(pool)
        .await?;

        // Créer les index
        sqlx::query("CREATE INDEX idx_token_transactions_user_id ON token_transactions(user_id)")
            .execute(pool)
            .await?;
        sqlx::query(
            "CREATE INDEX idx_token_transactions_type ON token_transactions(transaction_type)",
        )
        .execute(pool)
        .await?;

        println!("✓ Table token_transactions créée");
    } else {
        println!("✓ Table token_transactions existe déjà");
    }

    println!("✓ Toutes les tables de paiement sont prêtes");
    Ok(())
}
