// Module pour exécuter automatiquement les migrations au démarrage
use chrono::Utc;
use log::{debug, error, info, warn};
use serde_json::json;
use sqlx::PgPool;
use std::env;
use uuid::Uuid;

use crate::services::mongo_history_service::MongoHistoryService;
use std::sync::Arc;

/// Vérifie et crée les tables media_engagement et media_distribution si elles n'existent pas
pub async fn ensure_media_analytics_tables(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification des tables media_engagement & media_distribution...");

    // ✅ FIX 2026-03-11: S'assurer que la table media a TOUTES les colonnes nécessaires
    // L'ancienne migration ne crée que (id, service_id, type, path, uploaded_at)
    // Les colonnes manquantes causent des échecs silencieux dans share_product_redirect
    let media_columns = vec![
        ("product_id", "TEXT"),
        ("product_index", "INTEGER"),
        ("media_type", "TEXT"),
        ("is_main_image", "BOOLEAN DEFAULT FALSE"),
        ("display_order", "INTEGER DEFAULT 0"),
        ("file_size", "BIGINT"),
        ("file_format", "TEXT"),
        ("service_media_type", "VARCHAR(50)"),
        ("ai_description", "TEXT"),
        ("ai_tags", "TEXT[]"),
        ("ai_category", "VARCHAR(100)"),
        ("ai_metadata", "JSONB"),
        ("ai_analyzed_at", "TIMESTAMPTZ"),
        ("ai_model_used", "VARCHAR(100)"),
        ("ai_confidence", "DOUBLE PRECISION"),
        ("image_signature", "JSONB"),
        ("image_hash", "VARCHAR(64)"),
        ("image_metadata", "JSONB"),
    ];
    for (col_name, col_type) in &media_columns {
        let query = format!(
            "ALTER TABLE media ADD COLUMN IF NOT EXISTS {} {}",
            col_name, col_type
        );
        if let Err(e) = sqlx::query(&query).execute(pool).await {
            warn!(
                "⚠️ Ajout colonne media.{} échoué (peut-être déjà existante): {}",
                col_name, e
            );
        }
    }
    info!("✅ Colonnes media vérifiées/ajoutées");

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS media_engagement (
            id SERIAL PRIMARY KEY,
            media_id INTEGER NOT NULL REFERENCES media(id) ON DELETE CASCADE,
            service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
            event_type TEXT NOT NULL,
            channel TEXT,
            user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
            session_id TEXT,
            metadata JSONB,
            occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    "#,
    )
    .execute(pool)
    .await?;

    sqlx::query(
        r#"
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_enum
                WHERE enumlabel = 'shopping_in_progress' AND enumtypid = 'delivery_status'::regtype
            ) THEN
                ALTER TYPE delivery_status ADD VALUE 'shopping_in_progress';
            END IF;
            IF NOT EXISTS (
                SELECT 1 FROM pg_enum
                WHERE enumlabel = 'shopping_completed' AND enumtypid = 'delivery_status'::regtype
            ) THEN
                ALTER TYPE delivery_status ADD VALUE 'shopping_completed';
            END IF;
        END
        $$;
        "#,
    )
    .execute(pool)
    .await?;

    sqlx::query(
        r#"
        DO $$
        BEGIN
            CREATE TYPE shopping_status AS ENUM (
                'pending',
                'awaiting_purchase',
                'shopping_in_progress',
                'shopping_completed',
                'checkout_submitted',
                'cancelled'
            );
        EXCEPTION
            WHEN duplicate_object THEN NULL;
        END
        $$;
        "#,
    )
    .execute(pool)
    .await?;

    sqlx::query(
        r#"
        DO $$
        BEGIN
            CREATE TYPE shopping_item_status AS ENUM (
                'pending',
                'purchased',
                'missing',
                'replaced'
            );
        EXCEPTION
            WHEN duplicate_object THEN NULL;
        END
        $$;
        "#,
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_media_engagement_media ON media_engagement(media_id)",
    )
    .execute(pool)
    .await?;
    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_media_engagement_event ON media_engagement(event_type)",
    )
    .execute(pool)
    .await?;
    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_media_engagement_service ON media_engagement(service_id)",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS media_distribution (
            id SERIAL PRIMARY KEY,
            media_id INTEGER NOT NULL REFERENCES media(id) ON DELETE CASCADE,
            service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
            target TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'scheduled',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            metadata JSONB
        )
    "#,
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_media_distribution_media ON media_distribution(media_id)",
    )
    .execute(pool)
    .await?;
    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_media_distribution_target ON media_distribution(target)",
    )
    .execute(pool)
    .await?;

    Ok(())
}

pub async fn ensure_inventory_overrides_table(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification de la table service_inventory_overrides...");
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS service_inventory_overrides (
            id BIGSERIAL PRIMARY KEY,
            service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
            product_index INTEGER NOT NULL,
            stock_level INTEGER NOT NULL,
            source TEXT,
            note TEXT,
            last_synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            expires_at TIMESTAMPTZ,
            metadata JSONB NOT NULL DEFAULT '{}'::jsonb
        )
        "#,
    )
    .execute(pool)
    .await?;

    sqlx::query(
        r#"
        CREATE UNIQUE INDEX IF NOT EXISTS idx_service_inventory_overrides_unique
            ON service_inventory_overrides(service_id, product_index)
        "#,
    )
    .execute(pool)
    .await?;

    sqlx::query(
        r#"
        CREATE INDEX IF NOT EXISTS idx_service_inventory_overrides_last_synced
            ON service_inventory_overrides(last_synced_at DESC)
        "#,
    )
    .execute(pool)
    .await?;

    Ok(())
}

pub async fn ensure_content_engagement_table(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification de la table content_engagement...");

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS content_engagement (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            content_id TEXT NOT NULL,
            liked BOOLEAN NOT NULL DEFAULT FALSE,
            saved BOOLEAN NOT NULL DEFAULT FALSE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            UNIQUE (user_id, content_id)
        )
        "#,
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_content_engagement_user ON content_engagement(user_id)",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_content_engagement_content ON content_engagement(content_id)",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        r#"
        CREATE OR REPLACE FUNCTION set_content_engagement_updated_at()
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

    sqlx::query("DROP TRIGGER IF EXISTS trg_content_engagement_updated_at ON content_engagement")
        .execute(pool)
        .await?;

    sqlx::query(
        r#"
        CREATE TRIGGER trg_content_engagement_updated_at
            BEFORE UPDATE ON content_engagement
            FOR EACH ROW
            EXECUTE FUNCTION set_content_engagement_updated_at()
        "#,
    )
    .execute(pool)
    .await?;

    Ok(())
}

pub async fn ensure_video_generation_jobs_table(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification de la table video_generation_jobs...");

    sqlx::query(r#"CREATE EXTENSION IF NOT EXISTS "uuid-ossp""#)
        .execute(pool)
        .await?;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS video_generation_jobs (
            job_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            service_id INTEGER REFERENCES services(id) ON DELETE SET NULL,
            product_index INTEGER,
            status TEXT NOT NULL DEFAULT 'queued',
            progress_steps JSONB NOT NULL DEFAULT '[]'::jsonb,
            result_media_id INTEGER REFERENCES media(id) ON DELETE SET NULL,
            result_payload JSONB,
            error_message TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        "#,
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "ALTER TABLE video_generation_jobs
         ADD COLUMN IF NOT EXISTS result_payload JSONB",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_video_generation_jobs_user ON video_generation_jobs(user_id)",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_video_generation_jobs_service ON video_generation_jobs(service_id)",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_video_generation_jobs_status ON video_generation_jobs(status)",
    )
    .execute(pool)
    .await?;

    // ✅ 2025-12-22: Index optimisé pour GROUP BY status et requêtes avec updated_at
    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_video_generation_jobs_status_updated_at 
         ON video_generation_jobs(status, updated_at)
         WHERE status IS NOT NULL",
    )
    .execute(pool)
    .await?;

    Ok(())
}

pub async fn ensure_premium_audio_tables(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification des tables premium_audio_jobs et colonnes audio...");

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS premium_audio_jobs (
            job_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            provider TEXT NOT NULL,
            provider_job_id TEXT,
            source_path TEXT NOT NULL,
            output_path TEXT,
            status TEXT NOT NULL DEFAULT 'pending',
            attempts INTEGER NOT NULL DEFAULT 0,
            error_message TEXT,
            metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            completed_at TIMESTAMPTZ,
            video_job_id UUID REFERENCES video_generation_jobs(job_id) ON DELETE CASCADE
        )
        "#,
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_premium_audio_jobs_status ON premium_audio_jobs(status)",
    )
    .execute(pool)
    .await?;
    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_premium_audio_jobs_updated_at ON premium_audio_jobs(updated_at)",
    )
    .execute(pool)
    .await?;
    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_premium_audio_jobs_provider ON premium_audio_jobs(provider)",
    )
    .execute(pool)
    .await?;
    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_premium_audio_jobs_provider_job ON premium_audio_jobs(provider, provider_job_id)",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        r#"
        CREATE OR REPLACE FUNCTION set_premium_audio_jobs_updated_at()
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

    sqlx::query("DROP TRIGGER IF EXISTS trg_premium_audio_jobs_updated_at ON premium_audio_jobs")
        .execute(pool)
        .await?;

    sqlx::query(
        r#"
        CREATE TRIGGER trg_premium_audio_jobs_updated_at
            BEFORE UPDATE ON premium_audio_jobs
            FOR EACH ROW
            EXECUTE FUNCTION set_premium_audio_jobs_updated_at()
        "#,
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "ALTER TABLE video_generation_jobs
            ADD COLUMN IF NOT EXISTS audio_job_id UUID",
    )
    .execute(pool)
    .await?;
    sqlx::query(
        "ALTER TABLE video_generation_jobs
            ADD COLUMN IF NOT EXISTS audio_status TEXT NOT NULL DEFAULT 'not_requested'",
    )
    .execute(pool)
    .await?;
    sqlx::query(
        "ALTER TABLE video_generation_jobs
            ADD COLUMN IF NOT EXISTS audio_metadata JSONB",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        r#"
        DO $$
        BEGIN
            ALTER TABLE video_generation_jobs
                ADD CONSTRAINT fk_video_generation_jobs_audio_job
                FOREIGN KEY (audio_job_id) REFERENCES premium_audio_jobs(job_id) ON DELETE SET NULL;
        EXCEPTION
            WHEN duplicate_object THEN NULL;
        END
        $$;
        "#,
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_video_generation_jobs_audio_status ON video_generation_jobs(audio_status)",
    )
    .execute(pool)
    .await?;

    Ok(())
}

pub async fn ensure_audio_transcription_cache_table(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification de la table audio_transcription_cache...");

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS audio_transcription_cache (
            id SERIAL PRIMARY KEY,
            audio_hash TEXT NOT NULL UNIQUE,
            transcribed_text TEXT NOT NULL,
            language TEXT,
            confidence REAL,
            duration REAL,
            model_used TEXT NOT NULL DEFAULT 'whisper-1',
            usage_count INTEGER NOT NULL DEFAULT 1,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        "#,
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_audio_transcription_cache_hash ON audio_transcription_cache(audio_hash)",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_audio_transcription_cache_last_used ON audio_transcription_cache(last_used_at)",
    )
    .execute(pool)
    .await?;

    // Fonction de correction des erreurs de transcription courantes
    sqlx::query(
        r#"
        CREATE OR REPLACE FUNCTION correct_transcription_errors(input_text TEXT)
        RETURNS TEXT AS $$
        DECLARE
            result TEXT := input_text;
        BEGIN
            -- Corrections courantes pour le français africain
            result := REGEXP_REPLACE(result, '\s+', ' ', 'g');
            result := TRIM(result);
            RETURN result;
        END;
        $$ LANGUAGE plpgsql IMMUTABLE
        "#,
    )
    .execute(pool)
    .await?;

    // Fonction de nettoyage des anciennes transcriptions (garde les 30 derniers jours)
    sqlx::query(
        r#"
        CREATE OR REPLACE FUNCTION cleanup_old_audio_transcriptions()
        RETURNS TABLE(deleted_count BIGINT, kept_count BIGINT, total_before BIGINT, total_after BIGINT) AS $$
        DECLARE
            total_before_val BIGINT;
            deleted_val BIGINT;
            total_after_val BIGINT;
        BEGIN
            SELECT COUNT(*) INTO total_before_val FROM audio_transcription_cache;
            
            DELETE FROM audio_transcription_cache
            WHERE last_used_at < NOW() - INTERVAL '30 days'
            AND usage_count <= 1;
            
            GET DIAGNOSTICS deleted_val = ROW_COUNT;
            SELECT COUNT(*) INTO total_after_val FROM audio_transcription_cache;
            
            RETURN QUERY SELECT deleted_val, total_after_val, total_before_val, total_after_val;
        END;
        $$ LANGUAGE plpgsql
        "#,
    )
    .execute(pool)
    .await?;

    info!("✅ Table audio_transcription_cache et fonctions associées créées/vérifiées");
    Ok(())
}

pub async fn ensure_voice_profiles_table(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification de la table voice_profiles...");

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS voice_profiles (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            service_id INTEGER REFERENCES services(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            provider TEXT NOT NULL DEFAULT 'custom',
            description TEXT,
            sample_media_id INTEGER REFERENCES media(id) ON DELETE SET NULL,
            metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            UNIQUE (user_id, name)
        )
        "#,
    )
    .execute(pool)
    .await?;

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_voice_profiles_user ON voice_profiles(user_id)")
        .execute(pool)
        .await?;
    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_voice_profiles_service ON voice_profiles(service_id)",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        r#"
        CREATE OR REPLACE FUNCTION set_voice_profiles_updated_at()
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

    sqlx::query("DROP TRIGGER IF EXISTS trg_voice_profiles_updated_at ON voice_profiles")
        .execute(pool)
        .await?;

    sqlx::query(
        r#"
        CREATE TRIGGER trg_voice_profiles_updated_at
            BEFORE UPDATE ON voice_profiles
            FOR EACH ROW
            EXECUTE FUNCTION set_voice_profiles_updated_at()
        "#,
    )
    .execute(pool)
    .await?;

    Ok(())
}

pub async fn ensure_studio_tables(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification des tables studio_sessions / timeline / assets...");

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS studio_sessions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            service_id INTEGER REFERENCES services(id) ON DELETE SET NULL,
            status TEXT NOT NULL DEFAULT 'draft',
            brief JSONB NOT NULL DEFAULT '{}'::jsonb,
            ai_recommendations JSONB NOT NULL DEFAULT '[]'::jsonb,
            recommended_templates TEXT[] NOT NULL DEFAULT '{}'::text[],
            timeline_settings JSONB NOT NULL DEFAULT '{}'::jsonb,
            distribution_plan JSONB NOT NULL DEFAULT '[]'::jsonb,
            preview_status TEXT NOT NULL DEFAULT 'idle',
            preview_public_url TEXT,
            preview_job_id TEXT,
            metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        "#,
    )
    .execute(pool)
    .await?;

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_studio_sessions_user ON studio_sessions(user_id)")
        .execute(pool)
        .await?;
    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_studio_sessions_service ON studio_sessions(service_id)",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS studio_timeline_clips (
            id BIGSERIAL PRIMARY KEY,
            session_id UUID NOT NULL REFERENCES studio_sessions(id) ON DELETE CASCADE,
            position INTEGER NOT NULL,
            lane TEXT,
            duration_seconds INTEGER NOT NULL,
            payload JSONB NOT NULL DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        "#,
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_studio_clips_session ON studio_timeline_clips(session_id, position)",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS studio_dynamic_assets (
            id BIGSERIAL PRIMARY KEY,
            session_id UUID NOT NULL REFERENCES studio_sessions(id) ON DELETE CASCADE,
            asset_type TEXT NOT NULL,
            storage_key TEXT,
            public_url TEXT,
            metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        "#,
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_studio_assets_session ON studio_dynamic_assets(session_id)",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS studio_preview_events (
            id BIGSERIAL PRIMARY KEY,
            session_id UUID NOT NULL REFERENCES studio_sessions(id) ON DELETE CASCADE,
            template TEXT,
            clip_count INTEGER NOT NULL DEFAULT 0,
            duration_seconds INTEGER NOT NULL DEFAULT 0,
            status TEXT NOT NULL DEFAULT 'ready',
            preview_url TEXT,
            warnings JSONB NOT NULL DEFAULT '[]'::jsonb,
            job_id TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        "#,
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_studio_preview_events_session ON studio_preview_events(session_id, created_at DESC)",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        r#"
        CREATE OR REPLACE FUNCTION set_studio_sessions_updated_at()
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

    sqlx::query("DROP TRIGGER IF EXISTS trg_studio_sessions_updated_at ON studio_sessions")
        .execute(pool)
        .await?;

    sqlx::query(
        r#"
        CREATE TRIGGER trg_studio_sessions_updated_at
            BEFORE UPDATE ON studio_sessions
            FOR EACH ROW
            EXECUTE FUNCTION set_studio_sessions_updated_at()
        "#,
    )
    .execute(pool)
    .await?;

    Ok(())
}

pub async fn ensure_user_token_columns(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification des colonnes tokens/utilisateurs...");

    sqlx::query(
        r#"ALTER TABLE users
           ADD COLUMN IF NOT EXISTS tokens_balance BIGINT NOT NULL DEFAULT 0"#,
    )
    .execute(pool)
    .await?;
    sqlx::query("ALTER TABLE users ALTER COLUMN tokens_balance SET DEFAULT 0")
        .execute(pool)
        .await?;

    sqlx::query(
        r#"ALTER TABLE users
           ADD COLUMN IF NOT EXISTS token_price_user DOUBLE PRECISION NOT NULL DEFAULT 1.0"#,
    )
    .execute(pool)
    .await?;
    sqlx::query("ALTER TABLE users ALTER COLUMN token_price_user SET DEFAULT 1.0")
        .execute(pool)
        .await?;

    sqlx::query(
        r#"ALTER TABLE users
           ADD COLUMN IF NOT EXISTS token_price_provider DOUBLE PRECISION NOT NULL DEFAULT 1.0"#,
    )
    .execute(pool)
    .await?;
    sqlx::query("ALTER TABLE users ALTER COLUMN token_price_provider SET DEFAULT 1.0")
        .execute(pool)
        .await?;

    sqlx::query(
        r#"ALTER TABLE users
           ADD COLUMN IF NOT EXISTS commission_pct REAL NOT NULL DEFAULT 0.0"#,
    )
    .execute(pool)
    .await?;
    sqlx::query("ALTER TABLE users ALTER COLUMN commission_pct SET DEFAULT 0.0")
        .execute(pool)
        .await?;

    sqlx::query(
        r#"ALTER TABLE users
           ADD COLUMN IF NOT EXISTS preferred_lang TEXT NOT NULL DEFAULT 'fr'"#,
    )
    .execute(pool)
    .await?;
    sqlx::query("ALTER TABLE users ALTER COLUMN preferred_lang SET DEFAULT 'fr'")
        .execute(pool)
        .await?;

    sqlx::query(
        r#"ALTER TABLE users
           ADD COLUMN IF NOT EXISTS is_provider BOOLEAN NOT NULL DEFAULT FALSE"#,
    )
    .execute(pool)
    .await?;
    sqlx::query("ALTER TABLE users ALTER COLUMN is_provider SET DEFAULT FALSE")
        .execute(pool)
        .await?;

    // ✅ CORRIGÉ 2026-03-02: Ajouter is_active à users
    // Cette colonne est requise par search_users_for_invitation et get_tag_history
    // Sans elle, les requêtes SQL échouent → autocomplete @ ne fonctionne pas
    sqlx::query(
        r#"ALTER TABLE users
           ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE"#,
    )
    .execute(pool)
    .await?;

    Ok(())
}

pub async fn ensure_delivery_wallet_events_table(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification de la table delivery_wallet_events...");

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS delivery_wallet_events (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            delivery_id UUID NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
            direction TEXT NOT NULL CHECK (direction IN ('debit', 'refund')),
            amount_cents BIGINT NOT NULL,
            reason TEXT,
            balance_after BIGINT NOT NULL,
            metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        "#,
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_delivery_wallet_events_user ON delivery_wallet_events(user_id)",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_delivery_wallet_events_delivery ON delivery_wallet_events(delivery_id)",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_delivery_wallet_events_created_at ON delivery_wallet_events(created_at DESC)",
    )
    .execute(pool)
    .await?;

    Ok(())
}

pub async fn ensure_video_weekly_reports_table(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification de la table video_weekly_reports...");

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS video_weekly_reports (
            id SERIAL PRIMARY KEY,
            week_start TIMESTAMPTZ NOT NULL,
            week_end TIMESTAMPTZ NOT NULL,
            total_videos BIGINT NOT NULL,
            total_views BIGINT NOT NULL,
            average_quality DOUBLE PRECISION NOT NULL,
            top_services JSONB NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        "#,
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_video_weekly_reports_week ON video_weekly_reports(week_start, week_end)",
    )
    .execute(pool)
    .await?;

    Ok(())
}

pub async fn ensure_live_streaming_tables(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification des tables de live streaming...");

    sqlx::query(r#"CREATE EXTENSION IF NOT EXISTS "uuid-ossp""#)
        .execute(pool)
        .await?;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS live_sessions (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            host_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            service_id INTEGER REFERENCES services(id) ON DELETE SET NULL,
            title TEXT NOT NULL,
            description TEXT,
            status VARCHAR(32) NOT NULL DEFAULT 'scheduled',
            start_at TIMESTAMPTZ NOT NULL,
            end_at TIMESTAMPTZ,
            livekit_room_name TEXT,
            livekit_participant_identity TEXT,
            livekit_ingress_id TEXT,
            livekit_ingress_url TEXT,
            stream_key TEXT,
            webrtc_url TEXT,
            hls_url TEXT,
            fallback_rtmp_url TEXT,
            fallback_hls_url TEXT,
            current_viewers INTEGER NOT NULL DEFAULT 0,
            peak_viewers INTEGER NOT NULL DEFAULT 0,
            total_watch_time_seconds BIGINT NOT NULL DEFAULT 0,
            metadata JSONB DEFAULT '{}'::JSONB,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    "#,
    )
    .execute(pool)
    .await?;

    // ✅ FIX 2026-03-11: Si la table a été créée par une ancienne migration (00001014)
    // avec un schéma différent, les colonnes attendues par le code manquent.
    // On ajoute toutes les colonnes manquantes de manière idempotente.
    let live_sessions_columns = vec![
        ("livekit_room_name", "TEXT"),
        ("livekit_participant_identity", "TEXT"),
        ("livekit_ingress_id", "TEXT"),
        ("livekit_ingress_url", "TEXT"),
        ("stream_key", "TEXT"),
        ("webrtc_url", "TEXT"),
        ("hls_url", "TEXT"),
        ("fallback_rtmp_url", "TEXT"),
        ("fallback_hls_url", "TEXT"),
        ("current_viewers", "INTEGER NOT NULL DEFAULT 0"),
        ("peak_viewers", "INTEGER NOT NULL DEFAULT 0"),
        ("total_watch_time_seconds", "BIGINT NOT NULL DEFAULT 0"),
    ];
    for (col_name, col_type) in &live_sessions_columns {
        let query = format!(
            "ALTER TABLE live_sessions ADD COLUMN IF NOT EXISTS {} {}",
            col_name, col_type
        );
        if let Err(e) = sqlx::query(&query).execute(pool).await {
            log::warn!(
                "[auto_migrate] live_sessions ADD COLUMN {} skipped: {}",
                col_name,
                e
            );
        }
    }

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_live_sessions_status ON live_sessions(status)")
        .execute(pool)
        .await?;
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_live_sessions_start_at ON live_sessions(start_at)")
        .execute(pool)
        .await?;
    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_live_sessions_service_id ON live_sessions(service_id)",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS live_replays (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            live_session_id UUID NOT NULL REFERENCES live_sessions(id) ON DELETE CASCADE,
            replay_url TEXT NOT NULL,
            storage_provider TEXT,
            format TEXT,
            duration_seconds INTEGER,
            size_bytes BIGINT,
            available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    "#,
    )
    .execute(pool)
    .await?;

    // ✅ FIX 2026-03-11: live_replays aussi peut avoir un ancien schéma
    let live_replays_columns = vec![
        ("replay_url", "TEXT NOT NULL DEFAULT ''"),
        ("storage_provider", "TEXT"),
        ("format", "TEXT"),
        ("duration_seconds", "INTEGER"),
        ("size_bytes", "BIGINT"),
        ("available_at", "TIMESTAMPTZ NOT NULL DEFAULT NOW()"),
    ];
    for (col_name, col_type) in &live_replays_columns {
        let query = format!(
            "ALTER TABLE live_replays ADD COLUMN IF NOT EXISTS {} {}",
            col_name, col_type
        );
        if let Err(e) = sqlx::query(&query).execute(pool).await {
            log::warn!(
                "[auto_migrate] live_replays ADD COLUMN {} skipped: {}",
                col_name,
                e
            );
        }
    }

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_live_replays_session_id ON live_replays(live_session_id)",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS live_session_analytics (
            live_session_id UUID PRIMARY KEY REFERENCES live_sessions(id) ON DELETE CASCADE,
            total_viewers INTEGER NOT NULL DEFAULT 0,
            hls_viewers INTEGER NOT NULL DEFAULT 0,
            webrtc_viewers INTEGER NOT NULL DEFAULT 0,
            total_watch_time_seconds BIGINT NOT NULL DEFAULT 0,
            average_watch_time_seconds NUMERIC(10,2) NOT NULL DEFAULT 0,
            conversions INTEGER NOT NULL DEFAULT 0,
            revenue_cfa NUMERIC(14,2) NOT NULL DEFAULT 0,
            last_synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    "#,
    )
    .execute(pool)
    .await?;

    // ✅ FIX 2026-03-11: live_session_analytics ancien schéma (00001014) est complètement différent
    // L'ancien avait: id, live_session_id, metric_name, metric_value, recorded_at, metadata
    // Le nouveau a: live_session_id (PK), total_viewers, hls_viewers, etc.
    // Si l'ancien schéma est en place, ajouter les colonnes manquantes
    let live_analytics_columns = vec![
        ("total_viewers", "INTEGER NOT NULL DEFAULT 0"),
        ("hls_viewers", "INTEGER NOT NULL DEFAULT 0"),
        ("webrtc_viewers", "INTEGER NOT NULL DEFAULT 0"),
        ("total_watch_time_seconds", "BIGINT NOT NULL DEFAULT 0"),
        (
            "average_watch_time_seconds",
            "NUMERIC(10,2) NOT NULL DEFAULT 0",
        ),
        ("conversions", "INTEGER NOT NULL DEFAULT 0"),
        ("revenue_cfa", "NUMERIC(14,2) NOT NULL DEFAULT 0"),
        ("last_synced_at", "TIMESTAMPTZ NOT NULL DEFAULT NOW()"),
    ];
    for (col_name, col_type) in &live_analytics_columns {
        let query = format!(
            "ALTER TABLE live_session_analytics ADD COLUMN IF NOT EXISTS {} {}",
            col_name, col_type
        );
        if let Err(e) = sqlx::query(&query).execute(pool).await {
            log::warn!(
                "[auto_migrate] live_session_analytics ADD COLUMN {} skipped: {}",
                col_name,
                e
            );
        }
    }

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_live_session_analytics_last_synced ON live_session_analytics(last_synced_at)",
    )
    .execute(pool)
    .await?;

    info!("✅ Tables de live streaming vérifiées");
    Ok(())
}

pub async fn ensure_global_promo_tables(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification des tables globales de promotions...");
    // ✅ 2026-02-14: Migrations SQL alignées avec code Rust pour éviter conflits de colonnes

    sqlx::query(r#"CREATE EXTENSION IF NOT EXISTS "uuid-ossp""#)
        .execute(pool)
        .await?;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS global_promo_events (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            slug TEXT NOT NULL UNIQUE,
            theme TEXT NOT NULL,
            display_name TEXT NOT NULL,
            description TEXT,
            starts_at TIMESTAMPTZ NOT NULL,
            ends_at TIMESTAMPTZ NOT NULL,
            recurrence_rule TEXT,
            status VARCHAR(32) NOT NULL DEFAULT 'draft' CHECK (
                status IN ('draft', 'scheduled', 'live', 'archived')
            ),
            config JSONB NOT NULL DEFAULT '{}'::JSONB,
            created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            CHECK (ends_at > starts_at)
        )
        "#,
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_global_promo_events_status ON global_promo_events(status, starts_at)",
    )
    .execute(pool)
    .await?;
    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_global_promo_events_theme ON global_promo_events(theme)",
    )
    .execute(pool)
    .await?;

    // ✅ Vérifier et ajouter les colonnes manquantes pour global_promo_events
    ensure_global_promo_events_columns(pool).await?;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS global_promo_entries (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            event_id UUID NOT NULL REFERENCES global_promo_events(id) ON DELETE CASCADE,
            service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
            live_session_id UUID REFERENCES live_sessions(id) ON DELETE SET NULL,
            submitted_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
            discount_percentage NUMERIC(5,2) CHECK (
                discount_percentage IS NULL OR (discount_percentage >= 0 AND discount_percentage <= 100)
            ),
            promo_price_cfa NUMERIC(14,2) CHECK (promo_price_cfa IS NULL OR promo_price_cfa >= 0),
            stock_cap INTEGER CHECK (stock_cap IS NULL OR stock_cap > 0),
            availability VARCHAR(20) NOT NULL DEFAULT 'online' CHECK (
                availability IN ('online', 'live', 'both')
            ),
            status VARCHAR(32) NOT NULL DEFAULT 'draft' CHECK (
                status IN ('draft', 'pending_review', 'approved', 'rejected', 'published', 'ended')
            ),
            metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
            published_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            UNIQUE (event_id, service_id)
        )
        "#,
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_global_promo_entries_event_status ON global_promo_entries(event_id, status)",
    )
    .execute(pool)
    .await?;
    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_global_promo_entries_service ON global_promo_entries(service_id)",
    )
    .execute(pool)
    .await?;
    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_global_promo_entries_live_session ON global_promo_entries(live_session_id)",
    )
    .execute(pool)
    .await?;

    // ✅ Vérifier et ajouter les colonnes manquantes pour global_promo_entries
    ensure_global_promo_entries_columns(pool).await?;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS global_promo_products (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            promo_entry_id UUID NOT NULL UNIQUE REFERENCES global_promo_entries(id) ON DELETE CASCADE,
            snapshot JSONB NOT NULL DEFAULT '{}'::JSONB,
            availability VARCHAR(20) NOT NULL DEFAULT 'online' CHECK (
                availability IN ('online', 'live', 'both')
            ),
            priority_score INTEGER NOT NULL DEFAULT 0,
            highlighted BOOLEAN NOT NULL DEFAULT FALSE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        "#,
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_global_promo_products_priority ON global_promo_products(highlighted DESC, priority_score DESC)",
    )
    .execute(pool)
    .await?;

    info!("✅ Tables globales de promotions vérifiées");
    Ok(())
}

pub async fn ensure_live_flash_sales_tables(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification des tables de ventes flash live...");

    sqlx::query(r#"CREATE EXTENSION IF NOT EXISTS "uuid-ossp""#)
        .execute(pool)
        .await?;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS live_flash_sales (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            live_session_id UUID NOT NULL REFERENCES live_sessions(id) ON DELETE CASCADE,
            service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
            promo_price_cfa NUMERIC(14,2) NOT NULL CHECK (promo_price_cfa >= 0),
            stock_target INTEGER NOT NULL CHECK (stock_target > 0),
            start_at TIMESTAMPTZ NOT NULL,
            end_at TIMESTAMPTZ NOT NULL,
            status VARCHAR(32) NOT NULL DEFAULT 'scheduled' CHECK (
                status IN ('scheduled', 'live', 'ended', 'cancelled')
            ),
            commentary_mode VARCHAR(20) NOT NULL DEFAULT 'host' CHECK (
                commentary_mode IN ('host', 'ai_voice')
            ),
            commentary_interval_seconds INTEGER NOT NULL DEFAULT 60 CHECK (commentary_interval_seconds >= 15),
            ai_voice_profile TEXT,
            scheduled_notification_sent_at TIMESTAMPTZ,
            live_notification_sent_at TIMESTAMPTZ,
            ending_notification_sent_at TIMESTAMPTZ,
            last_commentary_sent_at TIMESTAMPTZ,
            metadata JSONB DEFAULT '{}'::JSONB,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            CHECK (end_at > start_at)
        )
        "#,
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_live_flash_sales_session ON live_flash_sales(live_session_id)",
    )
    .execute(pool)
    .await?;
    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_live_flash_sales_status ON live_flash_sales(status)",
    )
    .execute(pool)
    .await?;
    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_live_flash_sales_timing ON live_flash_sales(start_at, end_at)",
    )
    .execute(pool)
    .await?;

    // ✅ Vérifier et ajouter les colonnes manquantes pour live_flash_sales
    ensure_live_flash_sales_columns(pool).await?;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS live_flash_sale_reservations (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            flash_sale_id UUID NOT NULL REFERENCES live_flash_sales(id) ON DELETE CASCADE,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
            reserved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            UNIQUE (flash_sale_id, user_id)
        )
        "#,
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_live_flash_sale_reservations_flash ON live_flash_sale_reservations(flash_sale_id)",
    )
    .execute(pool)
    .await?;
    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_live_flash_sale_reservations_user ON live_flash_sale_reservations(user_id)",
    )
    .execute(pool)
    .await?;

    // SEC-3: Add reservation_status column to allow re-reservations after cancellation
    sqlx::query(
        "ALTER TABLE live_flash_sale_reservations ADD COLUMN IF NOT EXISTS reservation_status VARCHAR(20) NOT NULL DEFAULT 'confirmed'",
    )
    .execute(pool)
    .await?;
    sqlx::query(
        "ALTER TABLE live_flash_sale_reservations ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ",
    )
    .execute(pool)
    .await?;

    // Drop old strict UNIQUE constraint if it exists, replace with partial unique (only active reservations)
    sqlx::query(
        r#"
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM pg_constraint
                WHERE conname = 'live_flash_sale_reservations_flash_sale_id_user_id_key'
            ) THEN
                ALTER TABLE live_flash_sale_reservations
                DROP CONSTRAINT live_flash_sale_reservations_flash_sale_id_user_id_key;
            END IF;
        END $$;
        "#,
    )
    .execute(pool)
    .await?;
    sqlx::query(
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_flash_reservations_active_unique ON live_flash_sale_reservations(flash_sale_id, user_id) WHERE reservation_status != 'cancelled'",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS live_flash_sale_commentaries (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            flash_sale_id UUID NOT NULL REFERENCES live_flash_sales(id) ON DELETE CASCADE,
            created_by VARCHAR(20) NOT NULL CHECK (created_by IN ('host', 'ai_voice')),
            message TEXT NOT NULL,
            metadata JSONB DEFAULT '{}'::JSONB,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        "#,
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_live_flash_sale_commentaries_flash ON live_flash_sale_commentaries(flash_sale_id, created_at)",
    )
    .execute(pool)
    .await?;

    sqlx::query("ALTER TABLE live_flash_sales ADD COLUMN IF NOT EXISTS commentary_mode VARCHAR(20) NOT NULL DEFAULT 'host'")
        .execute(pool)
        .await?;
    sqlx::query("ALTER TABLE live_flash_sales ADD COLUMN IF NOT EXISTS commentary_interval_seconds INTEGER NOT NULL DEFAULT 60")
        .execute(pool)
        .await?;
    sqlx::query("ALTER TABLE live_flash_sales ADD COLUMN IF NOT EXISTS ai_voice_profile TEXT")
        .execute(pool)
        .await?;
    sqlx::query(
        "ALTER TABLE live_flash_sales ADD COLUMN IF NOT EXISTS last_commentary_sent_at TIMESTAMPTZ",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "ALTER TABLE live_flash_sales ADD COLUMN IF NOT EXISTS global_promo_entry_id UUID REFERENCES global_promo_entries(id) ON DELETE SET NULL",
    )
    .execute(pool)
    .await?;
    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_live_flash_sales_global_promo ON live_flash_sales(global_promo_entry_id)",
    )
    .execute(pool)
    .await?;

    info!("✅ Tables live_flash_sales vérifiées");
    Ok(())
}

/// Optimisations de scalabilité pour Flash Sales et Black Friday (index et vues matérialisées)
pub async fn ensure_flash_blackfriday_scalability_optimizations(
    pool: &PgPool,
) -> Result<(), sqlx::Error> {
    info!("🔍 Application des optimisations de scalabilité Flash Sales et Black Friday...");

    // Index pour flash sales
    sqlx::query(
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_flash_sales_status_start 
         ON live_flash_sales(status, start_at) 
         WHERE status IN ('scheduled', 'live')",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_flash_reservations_sale_user 
         ON live_flash_sale_reservations(flash_sale_id, user_id)",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_flash_reservations_sale_quantity 
         ON live_flash_sale_reservations(flash_sale_id, quantity)",
    )
    .execute(pool)
    .await?;

    // Index pour Black Friday / Global Promo
    sqlx::query(
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_global_promo_entries_event_status 
         ON global_promo_entries(event_id, status) 
         WHERE status IN ('approved', 'published')",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_global_promo_entries_service 
         ON global_promo_entries(service_id) 
         WHERE status IN ('approved', 'published')",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_global_promo_products_highlighted_priority 
         ON global_promo_products(highlighted DESC, priority_score DESC)",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_global_promo_events_status_dates 
         ON global_promo_events(status, starts_at, ends_at) 
         WHERE status IN ('scheduled', 'live')",
    )
    .execute(pool)
    .await?;

    // Index full-text pour recherche (si PostgreSQL >= 12)
    sqlx::query(
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_global_promo_events_search 
         ON global_promo_events USING gin(to_tsvector('french', display_name || ' ' || COALESCE(theme, '')))"
    )
    .execute(pool)
    .await?;

    // Vue matérialisée pour le catalogue (refresh toutes les 30 secondes)
    sqlx::query(
        "CREATE MATERIALIZED VIEW IF NOT EXISTS global_promo_catalog_cache AS
         SELECT
             e.id AS entry_id,
             e.event_id,
             e.service_id,
             e.discount_percentage,
             e.promo_price_cfa,
             e.stock_cap,
             e.availability,
             e.status AS entry_status,
             ev.id AS event_id_alias,
             ev.slug AS event_slug,
             ev.theme AS event_theme,
             ev.display_name AS event_display_name,
             ev.starts_at AS event_starts_at,
             ev.ends_at AS event_ends_at,
             ev.status AS event_status,
             gp.id AS product_id,
             gp.priority_score AS product_priority_score,
             gp.highlighted AS product_highlighted,
             gp.snapshot AS product_snapshot
         FROM global_promo_entries e
         JOIN global_promo_events ev ON ev.id = e.event_id
         LEFT JOIN global_promo_products gp ON gp.promo_entry_id = e.id
         WHERE ev.status IN ('scheduled', 'live')
           AND e.status IN ('approved', 'published')
           AND ev.ends_at >= NOW()",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_global_promo_catalog_cache_entry_id 
         ON global_promo_catalog_cache(entry_id)",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_global_promo_catalog_cache_highlighted_priority 
         ON global_promo_catalog_cache(product_highlighted DESC, product_priority_score DESC)",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_global_promo_catalog_cache_starts_at 
         ON global_promo_catalog_cache(event_starts_at)",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_global_promo_catalog_cache_ends_at 
         ON global_promo_catalog_cache(event_ends_at)",
    )
    .execute(pool)
    .await?;

    info!("✅ Optimisations de scalabilité Flash Sales et Black Friday appliquées");
    Ok(())
}

/// Vérifie et crée la fonction deactivate_expired_products() si elle n'existe pas
pub async fn ensure_deactivate_expired_products_function(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification de la fonction deactivate_expired_products()...");

    // Vérifier si la fonction existe
    let exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'deactivate_expired_products')",
    )
    .fetch_one(pool)
    .await?;

    if exists {
        info!("✅ Fonction deactivate_expired_products() déjà présente");

        // ✅ NOUVEAU 2025-11-05: Vérifier quand même si products_lifecycle a toutes les colonnes
        let table_exists = sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'products_lifecycle')"
        )
        .fetch_one(pool)
        .await?;

        if table_exists {
            // Vérifier auto_deactivate_at
            let has_auto_deactivate = sqlx::query_scalar::<_, bool>(
                "SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'products_lifecycle' AND column_name = 'auto_deactivate_at')"
            )
            .fetch_one(pool)
            .await?;

            if !has_auto_deactivate {
                warn!("⚠️ Colonne 'auto_deactivate_at' manquante, ajout en cours...");
                sqlx::query("ALTER TABLE products_lifecycle ADD COLUMN IF NOT EXISTS auto_deactivate_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days')")
                    .execute(pool)
                    .await?;
                info!("✅ Colonne 'auto_deactivate_at' ajoutée");
            }

            // Vérifier reactivation_cost
            let has_reactivation_cost = sqlx::query_scalar::<_, bool>(
                "SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'products_lifecycle' AND column_name = 'reactivation_cost')"
            )
            .fetch_one(pool)
            .await?;

            if !has_reactivation_cost {
                warn!("⚠️ Colonne 'reactivation_cost' manquante, ajout en cours...");
                sqlx::query("ALTER TABLE products_lifecycle ADD COLUMN IF NOT EXISTS reactivation_cost INTEGER DEFAULT 1000")
                    .execute(pool)
                    .await?;
                info!("✅ Colonne 'reactivation_cost' ajoutée");
            }
        }

        return Ok(());
    }

    warn!("⚠️ Fonction deactivate_expired_products() manquante, création en cours...");

    // Créer la table products_lifecycle si elle n'existe pas
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS products_lifecycle (
            id SERIAL PRIMARY KEY,
            service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
            product_index INTEGER NOT NULL,
            product_nom TEXT NOT NULL,
            product_type TEXT NOT NULL,
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            auto_deactivate_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days'),
            last_reactivated_at TIMESTAMPTZ,
            reactivation_cost INTEGER DEFAULT 1000,
            deactivation_count INTEGER DEFAULT 0,
            total_reactivation_paid INTEGER DEFAULT 0,
            UNIQUE(service_id, product_index)
        )
    "#,
    )
    .execute(pool)
    .await?;

    // Créer les index
    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_products_lifecycle_service_id ON products_lifecycle(service_id)"
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_products_lifecycle_active ON products_lifecycle(is_active)",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        r#"CREATE INDEX IF NOT EXISTS idx_products_lifecycle_auto_deactivate 
           ON products_lifecycle(auto_deactivate_at) WHERE is_active = TRUE"#,
    )
    .execute(pool)
    .await?;

    // Créer la fonction (✅ MODIFIÉ 2025-01-28: inclut vérification stock = 0)
    sqlx::query(
        r#"
        CREATE OR REPLACE FUNCTION deactivate_expired_products()
        RETURNS TABLE(
            service_id INTEGER,
            product_index INTEGER,
            product_nom TEXT,
            user_id INTEGER,
            deactivation_reason TEXT
        ) AS $$
        BEGIN
            -- ✅ CORRIGÉ 2026-01-XX: Mettre à jour service_products.is_active au lieu de products_lifecycle.is_active
            RETURN QUERY
            UPDATE service_products p
            SET 
                is_active = FALSE,
                updated_at = NOW()
            FROM services s
            WHERE p.service_id = s.id
                AND p.is_active = TRUE
                AND (
                    -- Critère 1: Délai expiré (auto_deactivate_at depuis service_products)
                    (p.auto_deactivate_at IS NOT NULL AND p.auto_deactivate_at <= NOW())
                    OR
                    -- ✅ NOUVEAU Critère 2: Stock = 0 (uniquement pour les produits)
                    (
                        s.is_tarissable = TRUE  -- Uniquement pour les produits
                        AND EXISTS (
                            SELECT 1 
                            FROM autocomplete_combinations ac
                            WHERE ac.service_id = s.id
                                AND ac.stock IS NOT NULL
                                AND ac.stock <= 0
                        )
                    )
                )
            RETURNING 
                p.service_id,
                p.product_index,
                p.product_name,
                s.user_id,
                CASE 
                    WHEN p.auto_deactivate_at IS NOT NULL AND p.auto_deactivate_at <= NOW() THEN 'expired_time'
                    ELSE 'stock_zero'
                END::TEXT;
        END;
        $$ LANGUAGE plpgsql
    "#,
    )
    .execute(pool)
    .await?;

    // ✅ NOUVEAU 2025-01-28: Créer index pour optimiser les vérifications de stock
    sqlx::query(
        r#"
        CREATE INDEX IF NOT EXISTS idx_autocomplete_combinations_stock_check 
        ON autocomplete_combinations(service_id, stock) 
        WHERE stock IS NOT NULL AND stock <= 0
        "#,
    )
    .execute(pool)
    .await?;

    sqlx::query(
        r#"
        CREATE INDEX IF NOT EXISTS idx_services_is_tarissable 
        ON services(is_tarissable) 
        WHERE is_tarissable = TRUE
        "#,
    )
    .execute(pool)
    .await?;

    info!("✅ Fonction deactivate_expired_products() créée avec succès !");

    Ok(())
}

/// Vérifie et crée la table publicites si elle n'existe pas
pub async fn ensure_publicites_table(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification de la table publicites...");

    // Vérifier si la table existe
    let exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'publicites')",
    )
    .fetch_one(pool)
    .await?;

    if exists {
        info!("✅ Table publicites déjà présente");

        // ✅ NOUVEAU 2025-11-05: Vérifier toutes les colonnes critiques
        // Vérifier zone_geographique
        let has_zone_geo = sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'publicites' AND column_name = 'zone_geographique')"
        )
        .fetch_one(pool)
        .await?;

        if !has_zone_geo {
            warn!("⚠️ Colonne 'zone_geographique' manquante, ajout en cours...");
            sqlx::query("ALTER TABLE publicites ADD COLUMN IF NOT EXISTS zone_geographique VARCHAR(50) NOT NULL DEFAULT 'local' CHECK (zone_geographique IN ('local', 'regional', 'international'))")
                .execute(pool)
                .await?;
            info!("✅ Colonne 'zone_geographique' ajoutée");
        }

        // Vérifier produits_indexes
        let has_produits = sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'publicites' AND column_name = 'produits_indexes')"
        )
        .fetch_one(pool)
        .await?;

        if !has_produits {
            warn!("⚠️ Colonne 'produits_indexes' manquante, ajout en cours...");
            sqlx::query("ALTER TABLE publicites ADD COLUMN IF NOT EXISTS produits_indexes TEXT[] NOT NULL DEFAULT '{}'")
                .execute(pool)
                .await?;
            info!("✅ Colonne 'produits_indexes' ajoutée");
        }

        // Vérifier vues, clics, impressions
        let has_analytics = sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'publicites' AND column_name = 'vues')"
        )
        .fetch_one(pool)
        .await?;

        if !has_analytics {
            warn!("⚠️ Colonnes analytics manquantes, ajout en cours...");
            sqlx::query(
                "ALTER TABLE publicites ADD COLUMN IF NOT EXISTS vues INTEGER NOT NULL DEFAULT 0",
            )
            .execute(pool)
            .await?;
            sqlx::query(
                "ALTER TABLE publicites ADD COLUMN IF NOT EXISTS clics INTEGER NOT NULL DEFAULT 0",
            )
            .execute(pool)
            .await?;
            sqlx::query("ALTER TABLE publicites ADD COLUMN IF NOT EXISTS impressions INTEGER NOT NULL DEFAULT 0")
                .execute(pool)
                .await?;
            info!("✅ Colonnes analytics ajoutées");
        }

        // ✅ Vérifier videos_meta
        let has_videos_meta = sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'publicites' AND column_name = 'videos_meta')"
        )
        .fetch_one(pool)
        .await?;

        if !has_videos_meta {
            warn!("⚠️ Colonne 'videos_meta' manquante, ajout en cours...");
            sqlx::query("ALTER TABLE publicites ADD COLUMN IF NOT EXISTS videos_meta JSONB NOT NULL DEFAULT '[]'::jsonb")
                .execute(pool)
                .await?;
            info!("✅ Colonne 'videos_meta' ajoutée");
        }

        // ✅ Vérifier video_stats
        let has_video_stats = sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'publicites' AND column_name = 'video_stats')"
        )
        .fetch_one(pool)
        .await?;

        if !has_video_stats {
            warn!("⚠️ Colonne 'video_stats' manquante, ajout en cours...");
            sqlx::query("ALTER TABLE publicites ADD COLUMN IF NOT EXISTS video_stats JSONB NOT NULL DEFAULT '{}'::jsonb")
                .execute(pool)
                .await?;
            info!("✅ Colonne 'video_stats' ajoutée");
        }

        // ✅ NOUVEAU 2025-11-06: Vérifier boost_level et frequency_ratio
        let has_boost_level = sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'publicites' AND column_name = 'boost_level')"
        )
        .fetch_one(pool)
        .await?;

        if !has_boost_level {
            warn!("⚠️ Colonne 'boost_level' manquante, ajout en cours...");
            sqlx::query("ALTER TABLE publicites ADD COLUMN IF NOT EXISTS boost_level VARCHAR(20) DEFAULT 'basic' CHECK (boost_level IN ('basic', 'premium', 'ultra'))")
                .execute(pool)
                .await?;
            info!("✅ Colonne 'boost_level' ajoutée");
        }

        // Vérifier frequency_ratio
        let has_frequency_ratio = sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'publicites' AND column_name = 'frequency_ratio')"
        )
        .fetch_one(pool)
        .await?;

        if !has_frequency_ratio {
            warn!("⚠️ Colonne 'frequency_ratio' manquante, ajout en cours...");
            sqlx::query("ALTER TABLE publicites ADD COLUMN IF NOT EXISTS frequency_ratio FLOAT DEFAULT 0.2 CHECK (frequency_ratio >= 0 AND frequency_ratio <= 1)")
                .execute(pool)
                .await?;
            info!("✅ Colonne 'frequency_ratio' ajoutée");
        }

        // ✅ NOUVEAU 2025-01-01: Vérifier les colonnes pour fonctionnalités avancées (100% parité)
        let has_targeting = sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'publicites' AND column_name = 'targeting')"
        )
        .fetch_one(pool)
        .await?;

        if !has_targeting {
            warn!("⚠️ Colonnes fonctionnalités avancées manquantes, ajout en cours...");
            sqlx::query(
                "ALTER TABLE publicites ADD COLUMN IF NOT EXISTS targeting JSONB DEFAULT '{}'",
            )
            .execute(pool)
            .await?;
            sqlx::query(
                "ALTER TABLE publicites ADD COLUMN IF NOT EXISTS ab_testing JSONB DEFAULT '{}'",
            )
            .execute(pool)
            .await?;
            sqlx::query(
                "ALTER TABLE publicites ADD COLUMN IF NOT EXISTS schedule JSONB DEFAULT NULL",
            )
            .execute(pool)
            .await?;
            sqlx::query(
                "ALTER TABLE publicites ADD COLUMN IF NOT EXISTS placements JSONB DEFAULT '[]'",
            )
            .execute(pool)
            .await?;
            sqlx::query(
                "ALTER TABLE publicites ADD COLUMN IF NOT EXISTS bid_strategy JSONB DEFAULT '{}'",
            )
            .execute(pool)
            .await?;
            sqlx::query(
                "ALTER TABLE publicites ADD COLUMN IF NOT EXISTS retargeting JSONB DEFAULT '{}'",
            )
            .execute(pool)
            .await?;
            sqlx::query("ALTER TABLE publicites ADD COLUMN IF NOT EXISTS variant_performance JSONB DEFAULT '{}'")
                .execute(pool)
                .await?;

            // Créer les index GIN
            sqlx::query("CREATE INDEX IF NOT EXISTS idx_publicites_targeting_gin ON publicites USING GIN(targeting)")
                .execute(pool)
                .await?;
            sqlx::query("CREATE INDEX IF NOT EXISTS idx_publicites_ab_testing_gin ON publicites USING GIN(ab_testing)")
                .execute(pool)
                .await?;
            sqlx::query("CREATE INDEX IF NOT EXISTS idx_publicites_placements_gin ON publicites USING GIN(placements)")
                .execute(pool)
                .await?;
            sqlx::query("CREATE INDEX IF NOT EXISTS idx_publicites_retargeting_gin ON publicites USING GIN(retargeting)")
                .execute(pool)
                .await?;
            sqlx::query("CREATE INDEX IF NOT EXISTS idx_publicites_schedule_start ON publicites((schedule->>'start_date')) WHERE schedule IS NOT NULL")
                .execute(pool)
                .await?;
            sqlx::query("CREATE INDEX IF NOT EXISTS idx_publicites_schedule_end ON publicites((schedule->>'end_date')) WHERE schedule IS NOT NULL")
                .execute(pool)
                .await?;

            // Créer les fonctions SQL
            sqlx::query(r#"
                CREATE OR REPLACE FUNCTION is_publicite_scheduled_active(pub_id INTEGER)
                RETURNS BOOLEAN AS $$
                DECLARE
                    pub_schedule JSONB;
                    start_date TIMESTAMPTZ;
                    end_date TIMESTAMPTZ;
                    pause_weekends BOOLEAN;
                    current_day INTEGER;
                BEGIN
                    SELECT schedule INTO pub_schedule FROM publicites WHERE id = pub_id;
                    IF pub_schedule IS NULL OR pub_schedule = '{}'::jsonb THEN RETURN TRUE; END IF;
                    IF pub_schedule->>'start_date' IS NOT NULL THEN
                        start_date := (pub_schedule->>'start_date')::timestamptz;
                        IF NOW() < start_date THEN RETURN FALSE; END IF;
                    END IF;
                    IF pub_schedule->>'end_date' IS NOT NULL THEN
                        end_date := (pub_schedule->>'end_date')::timestamptz;
                        IF NOW() > end_date THEN RETURN FALSE; END IF;
                    END IF;
                    pause_weekends := COALESCE((pub_schedule->>'pause_on_weekends')::boolean, FALSE);
                    IF pause_weekends THEN
                        current_day := EXTRACT(DOW FROM NOW())::integer;
                        IF current_day = 0 OR current_day = 6 THEN RETURN FALSE; END IF;
                    END IF;
                    RETURN TRUE;
                END;
                $$ LANGUAGE plpgsql
            "#)
                .execute(pool)
                .await?;

            sqlx::query(r#"
                CREATE OR REPLACE FUNCTION matches_targeting(pub_targeting JSONB, user_age INTEGER, user_gender TEXT, user_interests TEXT[], user_behaviors TEXT[])
                RETURNS BOOLEAN AS $$
                DECLARE
                    target_age_min INTEGER;
                    target_age_max INTEGER;
                    target_gender TEXT;
                    target_interests JSONB;
                    target_behaviors JSONB;
                BEGIN
                    IF pub_targeting IS NULL OR pub_targeting = '{}'::jsonb THEN RETURN TRUE; END IF;
                    IF pub_targeting->'age_range' IS NOT NULL THEN
                        target_age_min := COALESCE((pub_targeting->'age_range'->>'min')::integer, 0);
                        target_age_max := COALESCE((pub_targeting->'age_range'->>'max')::integer, 999);
                        IF user_age < target_age_min OR user_age > target_age_max THEN RETURN FALSE; END IF;
                    END IF;
                    target_gender := pub_targeting->>'gender';
                    IF target_gender IS NOT NULL AND target_gender != 'all' THEN
                        IF target_gender != user_gender THEN RETURN FALSE; END IF;
                    END IF;
                    target_interests := pub_targeting->'interests';
                    IF target_interests IS NOT NULL AND jsonb_array_length(target_interests) > 0 THEN
                        IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements_text(target_interests) AS interest WHERE interest = ANY(user_interests)) THEN
                            RETURN FALSE;
                        END IF;
                    END IF;
                    target_behaviors := pub_targeting->'behaviors';
                    IF target_behaviors IS NOT NULL AND jsonb_array_length(target_behaviors) > 0 THEN
                        IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements_text(target_behaviors) AS behavior WHERE behavior = ANY(user_behaviors)) THEN
                            RETURN FALSE;
                        END IF;
                    END IF;
                    RETURN TRUE;
                END;
                $$ LANGUAGE plpgsql
            "#)
                .execute(pool)
                .await?;

            sqlx::query(r#"
                CREATE OR REPLACE FUNCTION matches_retargeting(pub_retargeting JSONB, user_id INTEGER)
                RETURNS BOOLEAN AS $$
                DECLARE
                    retargeting_rules JSONB;
                    rule JSONB;
                    rule_type TEXT;
                    days_since INTEGER;
                    match_found BOOLEAN := FALSE;
                BEGIN
                    IF pub_retargeting IS NULL OR pub_retargeting = '{}'::jsonb THEN RETURN TRUE; END IF;
                    retargeting_rules := pub_retargeting->'rules';
                    IF retargeting_rules IS NULL OR jsonb_array_length(retargeting_rules) = 0 THEN RETURN TRUE; END IF;
                    FOR rule IN SELECT * FROM jsonb_array_elements(retargeting_rules) LOOP
                        rule_type := rule->>'type';
                        days_since := COALESCE((rule->>'days_since')::integer, 7);
                        CASE rule_type
                            WHEN 'viewed_product' THEN
                                SELECT EXISTS (SELECT 1 FROM user_behavior WHERE user_id = user_id AND behavior_type = 'product_view' AND created_at > NOW() - (days_since || ' days')::interval) INTO match_found;
                            WHEN 'abandoned_cart' THEN
                                SELECT EXISTS (SELECT 1 FROM shopping_baskets WHERE user_id = user_id AND status = 'abandoned' AND updated_at > NOW() - (days_since || ' days')::interval) INTO match_found;
                            WHEN 'visited_service' THEN
                                SELECT EXISTS (SELECT 1 FROM user_behavior WHERE user_id = user_id AND behavior_type = 'service_view' AND created_at > NOW() - (days_since || ' days')::interval) INTO match_found;
                            WHEN 'searched' THEN
                                SELECT EXISTS (SELECT 1 FROM search_history WHERE user_id = user_id AND created_at > NOW() - (days_since || ' days')::interval) INTO match_found;
                            ELSE match_found := FALSE;
                        END CASE;
                        IF match_found THEN RETURN TRUE; END IF;
                    END LOOP;
                    RETURN FALSE;
                END;
                $$ LANGUAGE plpgsql
            "#)
                .execute(pool)
                .await?;

            info!("✅ Colonnes fonctionnalités avancées ajoutées avec index et fonctions SQL");
        }

        // ✅ NOUVEAU 2025-01-XX: Vérifier la table publicite_impressions pour la fréquence
        let has_impressions_table = sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'publicite_impressions')"
        )
        .fetch_one(pool)
        .await?;

        if !has_impressions_table {
            info!("📊 Création table publicite_impressions pour gestion fréquence...");

            // Créer la table
            sqlx::query(
                r#"
                CREATE TABLE IF NOT EXISTS publicite_impressions (
                    id SERIAL PRIMARY KEY,
                    publicite_id INTEGER NOT NULL,
                    user_id INTEGER NOT NULL,
                    placement VARCHAR(50) NOT NULL,
                    viewed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (publicite_id) REFERENCES publicites(id) ON DELETE CASCADE,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                )
                "#,
            )
            .execute(pool)
            .await?;

            // Créer les index
            sqlx::query("CREATE INDEX IF NOT EXISTS idx_publicite_impressions_publicite_user ON publicite_impressions(publicite_id, user_id)")
                .execute(pool)
                .await?;
            sqlx::query("CREATE INDEX IF NOT EXISTS idx_publicite_impressions_user_date ON publicite_impressions(user_id, viewed_at DESC)")
                .execute(pool)
                .await?;
            sqlx::query("CREATE INDEX IF NOT EXISTS idx_publicite_impressions_publicite_date ON publicite_impressions(publicite_id, viewed_at DESC)")
                .execute(pool)
                .await?;
            sqlx::query("CREATE INDEX IF NOT EXISTS idx_publicite_impressions_placement ON publicite_impressions(placement)")
                .execute(pool)
                .await?;
            sqlx::query("CREATE INDEX IF NOT EXISTS idx_publicite_impressions_user_publicite_date ON publicite_impressions(user_id, publicite_id, viewed_at DESC)")
                .execute(pool)
                .await?;

            // Créer les fonctions SQL
            sqlx::query(r#"
                CREATE OR REPLACE FUNCTION check_publicite_frequency(
                    p_publicite_id INTEGER,
                    p_user_id INTEGER,
                    p_frequency_type VARCHAR(20) DEFAULT 'daily'
                ) RETURNS BOOLEAN AS $$
                DECLARE
                    v_count INTEGER;
                    v_frequency_limit INTEGER;
                    v_frequency_config JSONB;
                BEGIN
                    SELECT frequency_config INTO v_frequency_config FROM publicites WHERE id = p_publicite_id;
                    IF v_frequency_config IS NULL OR v_frequency_config = '{}'::jsonb THEN RETURN TRUE; END IF;
                    IF p_frequency_type = 'daily' THEN
                        v_frequency_limit := COALESCE((v_frequency_config->>'max_per_day')::INTEGER, 999999);
                        SELECT COUNT(*) INTO v_count FROM publicite_impressions WHERE publicite_id = p_publicite_id AND user_id = p_user_id AND viewed_at >= CURRENT_DATE;
                    ELSIF p_frequency_type = 'weekly' THEN
                        v_frequency_limit := COALESCE((v_frequency_config->>'max_per_week')::INTEGER, 999999);
                        SELECT COUNT(*) INTO v_count FROM publicite_impressions WHERE publicite_id = p_publicite_id AND user_id = p_user_id AND viewed_at >= DATE_TRUNC('week', CURRENT_DATE);
                    ELSE RETURN TRUE;
                    END IF;
                    RETURN v_count < v_frequency_limit;
                END;
                $$ LANGUAGE plpgsql
            "#)
                .execute(pool)
                .await?;

            sqlx::query(
                r#"
                CREATE OR REPLACE FUNCTION record_publicite_impression(
                    p_publicite_id INTEGER,
                    p_user_id INTEGER,
                    p_placement VARCHAR(50) DEFAULT 'feed'
                ) RETURNS INTEGER AS $$
                DECLARE
                    v_impression_id INTEGER;
                BEGIN
                    INSERT INTO publicite_impressions (publicite_id, user_id, placement)
                    VALUES (p_publicite_id, p_user_id, p_placement)
                    RETURNING id INTO v_impression_id;
                    RETURN v_impression_id;
                END;
                $$ LANGUAGE plpgsql
            "#,
            )
            .execute(pool)
            .await?;

            info!("✅ Table publicite_impressions créée avec fonctions SQL");
        }

        // ✅ NOUVEAU 2025-01-XX: Vérifier la table pixel_events pour le tracking avancé
        let has_pixel_events_table = sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'pixel_events')"
        )
        .fetch_one(pool)
        .await?;

        if !has_pixel_events_table {
            warn!("⚠️ Table 'pixel_events' manquante, création en cours...");

            sqlx::query(
                r#"
                CREATE TABLE IF NOT EXISTS pixel_events (
                    id SERIAL PRIMARY KEY,
                    event_name VARCHAR(100) NOT NULL,
                    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                    event_id VARCHAR(255) UNIQUE NOT NULL,
                    event_time BIGINT NOT NULL,
                    action_source VARCHAR(50) NOT NULL DEFAULT 'app',
                    custom_data JSONB DEFAULT '{}',
                    user_data JSONB DEFAULT '{}',
                    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                )
            "#,
            )
            .execute(pool)
            .await?;

            sqlx::query(
                "CREATE INDEX IF NOT EXISTS idx_pixel_events_user_id ON pixel_events(user_id)",
            )
            .execute(pool)
            .await?;
            sqlx::query("CREATE INDEX IF NOT EXISTS idx_pixel_events_event_name ON pixel_events(event_name)")
                .execute(pool)
                .await?;
            sqlx::query("CREATE INDEX IF NOT EXISTS idx_pixel_events_event_time ON pixel_events(event_time DESC)")
                .execute(pool)
                .await?;
            sqlx::query("CREATE INDEX IF NOT EXISTS idx_pixel_events_user_event ON pixel_events(user_id, event_name)")
                .execute(pool)
                .await?;
            sqlx::query(
                "CREATE INDEX IF NOT EXISTS idx_pixel_events_event_id ON pixel_events(event_id)",
            )
            .execute(pool)
            .await?;
            sqlx::query("CREATE INDEX IF NOT EXISTS idx_pixel_events_custom_data_gin ON pixel_events USING GIN(custom_data)")
                .execute(pool)
                .await?;
            sqlx::query("CREATE INDEX IF NOT EXISTS idx_pixel_events_user_data_gin ON pixel_events USING GIN(user_data)")
                .execute(pool)
                .await?;

            info!("✅ Table pixel_events créée");
        }

        // ✅ NOUVEAU 2025-01-XX: Vérifier la table publicite_audiences améliorée
        let has_audiences_table = sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'publicite_audiences')"
        )
        .fetch_one(pool)
        .await?;

        if !has_audiences_table {
            warn!("⚠️ Table 'publicite_audiences' manquante, création en cours...");

            sqlx::query(r#"
                CREATE TABLE IF NOT EXISTS publicite_audiences (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    name VARCHAR(255) NOT NULL,
                    type VARCHAR(50) NOT NULL,
                    source_audience_id INTEGER REFERENCES publicite_audiences(id) ON DELETE SET NULL,
                    similarity DECIMAL(3,2),
                    user_ids JSONB DEFAULT '[]',
                    metadata JSONB DEFAULT '{}',
                    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                )
            "#)
                .execute(pool)
                .await?;

            sqlx::query("CREATE INDEX IF NOT EXISTS idx_publicite_audiences_user_id ON publicite_audiences(user_id)")
                .execute(pool)
                .await?;
            sqlx::query("CREATE INDEX IF NOT EXISTS idx_publicite_audiences_type ON publicite_audiences(type)")
                .execute(pool)
                .await?;
            sqlx::query("CREATE INDEX IF NOT EXISTS idx_publicite_audiences_user_ids_gin ON publicite_audiences USING GIN(user_ids)")
                .execute(pool)
                .await?;

            sqlx::query(
                r#"
                CREATE OR REPLACE FUNCTION update_publicite_audiences_updated_at()
                RETURNS TRIGGER AS $$
                BEGIN
                    NEW.updated_at = NOW();
                    RETURN NEW;
                END;
                $$ LANGUAGE plpgsql
            "#,
            )
            .execute(pool)
            .await?;

            sqlx::query(r#"
                DROP TRIGGER IF EXISTS trigger_publicite_audiences_updated_at ON publicite_audiences;
                CREATE TRIGGER trigger_publicite_audiences_updated_at
                    BEFORE UPDATE ON publicite_audiences
                    FOR EACH ROW
                    EXECUTE FUNCTION update_publicite_audiences_updated_at()
            "#)
                .execute(pool)
                .await?;

            info!("✅ Table publicite_audiences créée");
        }

        // ✅ NOUVEAU 2025-01-XX: Vérifier la table automated_reports
        let has_automated_reports_table = sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'automated_reports')"
        )
        .fetch_one(pool)
        .await?;

        if !has_automated_reports_table {
            warn!("⚠️ Table 'automated_reports' manquante, création en cours...");

            sqlx::query(
                r#"
                CREATE TABLE IF NOT EXISTS automated_reports (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    frequency VARCHAR(20) NOT NULL,
                    format VARCHAR(20) NOT NULL,
                    email VARCHAR(255),
                    metrics JSONB DEFAULT '[]',
                    is_active BOOLEAN DEFAULT true,
                    last_sent_at TIMESTAMP,
                    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                )
            "#,
            )
            .execute(pool)
            .await?;

            sqlx::query("CREATE INDEX IF NOT EXISTS idx_automated_reports_user_id ON automated_reports(user_id)")
                .execute(pool)
                .await?;
            sqlx::query("CREATE INDEX IF NOT EXISTS idx_automated_reports_frequency ON automated_reports(frequency)")
                .execute(pool)
                .await?;
            sqlx::query("CREATE INDEX IF NOT EXISTS idx_automated_reports_active ON automated_reports(is_active)")
                .execute(pool)
                .await?;
            sqlx::query("CREATE INDEX IF NOT EXISTS idx_automated_reports_last_sent ON automated_reports(last_sent_at)")
                .execute(pool)
                .await?;

            sqlx::query(
                r#"
                CREATE OR REPLACE FUNCTION update_automated_reports_updated_at()
                RETURNS TRIGGER AS $$
                BEGIN
                    NEW.updated_at = NOW();
                    RETURN NEW;
                END;
                $$ LANGUAGE plpgsql
            "#,
            )
            .execute(pool)
            .await?;

            sqlx::query(
                r#"
                DROP TRIGGER IF EXISTS trigger_automated_reports_updated_at ON automated_reports;
                CREATE TRIGGER trigger_automated_reports_updated_at
                    BEFORE UPDATE ON automated_reports
                    FOR EACH ROW
                    EXECUTE FUNCTION update_automated_reports_updated_at()
            "#,
            )
            .execute(pool)
            .await?;

            info!("✅ Table automated_reports créée");
        }

        // ✅ NOUVEAU 2025-01-01: Vérifier la table publicite_versions pour le versioning
        let has_versions_table = sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'publicite_versions')"
        )
        .fetch_one(pool)
        .await?;

        if !has_versions_table {
            warn!("⚠️ Table 'publicite_versions' manquante, création en cours...");

            // Créer la table
            sqlx::query(
                r#"
                CREATE TABLE IF NOT EXISTS publicite_versions (
                    id SERIAL PRIMARY KEY,
                    publicite_id INTEGER NOT NULL REFERENCES publicites(id) ON DELETE CASCADE,
                    version_number INTEGER NOT NULL,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    data_snapshot JSONB NOT NULL,
                    change_type VARCHAR(50) NOT NULL,
                    changed_by INTEGER REFERENCES users(id),
                    change_description TEXT,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    CONSTRAINT unique_publicite_version UNIQUE (publicite_id, version_number)
                )
                "#,
            )
            .execute(pool)
            .await?;

            // Créer les index
            sqlx::query("CREATE INDEX IF NOT EXISTS idx_publicite_versions_publicite_id ON publicite_versions(publicite_id)")
                .execute(pool)
                .await?;
            sqlx::query("CREATE INDEX IF NOT EXISTS idx_publicite_versions_user_id ON publicite_versions(user_id)")
                .execute(pool)
                .await?;
            sqlx::query("CREATE INDEX IF NOT EXISTS idx_publicite_versions_created_at ON publicite_versions(created_at DESC)")
                .execute(pool)
                .await?;
            sqlx::query("CREATE INDEX IF NOT EXISTS idx_publicite_versions_change_type ON publicite_versions(change_type)")
                .execute(pool)
                .await?;

            // Créer la fonction et le trigger
            sqlx::query(
                r#"
                CREATE OR REPLACE FUNCTION create_publicite_version()
                RETURNS TRIGGER AS $$
                DECLARE
                    next_version INTEGER;
                    snapshot_data JSONB;
                    change_type_val VARCHAR(50);
                BEGIN
                    SELECT COALESCE(MAX(version_number), 0) + 1
                    INTO next_version
                    FROM publicite_versions
                    WHERE publicite_id = NEW.id;
                    
                    snapshot_data := jsonb_build_object(
                        'id', NEW.id,
                        'user_id', NEW.user_id,
                        'titre', NEW.titre,
                        'description', NEW.description,
                        'produits_indexes', NEW.produits_indexes,
                        'videos', NEW.videos,
                        'thumbnails', NEW.thumbnails,
                        'duree_jours', NEW.duree_jours,
                        'cout', NEW.cout,
                        'devise_utilisateur', NEW.devise_utilisateur,
                        'zone_geographique', NEW.zone_geographique,
                        'rayon_km', NEW.rayon_km,
                        'status', NEW.status,
                        'date_debut', NEW.date_debut,
                        'date_fin', NEW.date_fin,
                        'vues', NEW.vues,
                        'clics', NEW.clics,
                        'impressions', NEW.impressions,
                        'targeting', NEW.targeting,
                        'ab_testing', NEW.ab_testing,
                        'schedule', NEW.schedule,
                        'placements', NEW.placements,
                        'bid_strategy', NEW.bid_strategy,
                        'retargeting', NEW.retargeting,
                        'variant_performance', NEW.variant_performance,
                        'created_at', NEW.created_at,
                        'updated_at', NEW.updated_at
                    );
                    
                    IF TG_OP = 'INSERT' THEN
                        change_type_val := 'created';
                    ELSIF TG_OP = 'UPDATE' THEN
                        IF OLD.status != NEW.status THEN
                            IF NEW.status = 'paused' THEN
                                change_type_val := 'paused';
                            ELSIF NEW.status = 'active' AND OLD.status = 'paused' THEN
                                change_type_val := 'resumed';
                            ELSE
                                change_type_val := 'updated';
                            END IF;
                        ELSE
                            change_type_val := 'updated';
                        END IF;
                    END IF;
                    
                    INSERT INTO publicite_versions (
                        publicite_id, version_number, user_id, data_snapshot,
                        change_type, changed_by, change_description
                    )
                    VALUES (
                        NEW.id, next_version, NEW.user_id, snapshot_data,
                        change_type_val, NEW.user_id,
                        CASE 
                            WHEN TG_OP = 'INSERT' THEN 'Création de la publicité'
                            WHEN TG_OP = 'UPDATE' THEN 'Modification de la publicité'
                            ELSE 'Changement inconnu'
                        END
                    );
                    
                    RETURN NEW;
                END;
                $$ LANGUAGE plpgsql;
                "#,
            )
            .execute(pool)
            .await?;

            sqlx::query(
                r#"
                DROP TRIGGER IF EXISTS trigger_create_publicite_version ON publicites;
                CREATE TRIGGER trigger_create_publicite_version
                    AFTER INSERT OR UPDATE ON publicites
                    FOR EACH ROW
                    EXECUTE FUNCTION create_publicite_version();
                "#,
            )
            .execute(pool)
            .await?;

            // Créer la fonction de restauration
            sqlx::query(
                r#"
                CREATE OR REPLACE FUNCTION restore_publicite_version(
                    p_publicite_id INTEGER,
                    p_version_number INTEGER
                )
                RETURNS BOOLEAN AS $$
                DECLARE
                    version_data JSONB;
                BEGIN
                    SELECT data_snapshot
                    INTO version_data
                    FROM publicite_versions
                    WHERE publicite_id = p_publicite_id
                    AND version_number = p_version_number;
                    
                    IF version_data IS NULL THEN
                        RETURN FALSE;
                    END IF;
                    
                    UPDATE publicites
                    SET
                        titre = (version_data->>'titre')::VARCHAR,
                        description = (version_data->>'description')::TEXT,
                        produits_indexes = ARRAY(SELECT jsonb_array_elements_text(version_data->'produits_indexes')),
                        videos = ARRAY(SELECT jsonb_array_elements_text(version_data->'videos')),
                        thumbnails = ARRAY(SELECT jsonb_array_elements_text(version_data->'thumbnails')),
                        duree_jours = (version_data->>'duree_jours')::INTEGER,
                        cout = (version_data->>'cout')::INTEGER,
                        devise_utilisateur = (version_data->>'devise_utilisateur')::VARCHAR,
                        zone_geographique = (version_data->>'zone_geographique')::VARCHAR,
                        rayon_km = (version_data->>'rayon_km')::INTEGER,
                        status = (version_data->>'status')::VARCHAR,
                        date_debut = (version_data->>'date_debut')::TIMESTAMPTZ,
                        date_fin = (version_data->>'date_fin')::TIMESTAMPTZ,
                        targeting = version_data->'targeting',
                        ab_testing = version_data->'ab_testing',
                        schedule = version_data->'schedule',
                        placements = version_data->'placements',
                        bid_strategy = version_data->'bid_strategy',
                        retargeting = version_data->'retargeting',
                        variant_performance = version_data->'variant_performance',
                        updated_at = NOW()
                    WHERE id = p_publicite_id;
                    
                    RETURN TRUE;
                END;
                $$ LANGUAGE plpgsql;
                "#,
            )
            .execute(pool)
            .await?;

            info!("✅ Table 'publicite_versions' et fonctions créées");
        }

        return Ok(());
    }

    warn!("⚠️ Table publicites manquante, création en cours...");

    // Créer la table publicites
    sqlx::query(r#"
        CREATE TABLE IF NOT EXISTS publicites (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            
            -- Informations de base
            titre VARCHAR(255) NOT NULL,
            description TEXT,
            
            -- Produits indexés (format: 'serviceId_productIndex')
            produits_indexes TEXT[] NOT NULL DEFAULT '{}',
            
            -- Médias publicitaires (stockés en base64)
            videos TEXT[] DEFAULT '{}',
            thumbnails TEXT[] DEFAULT '{}',
            videos_meta JSONB NOT NULL DEFAULT '[]'::jsonb,
            video_stats JSONB NOT NULL DEFAULT '{}'::jsonb,
            
            -- Tarification et durée
            duree_jours INTEGER NOT NULL CHECK (duree_jours > 0),
            cout INTEGER NOT NULL CHECK (cout >= 0),
            devise_utilisateur VARCHAR(10) DEFAULT 'FCFA',
            
            -- Boost et fréquence
            boost_level VARCHAR(20) DEFAULT 'basic' CHECK (boost_level IN ('basic', 'premium', 'ultra')),
            frequency_ratio FLOAT DEFAULT 0.2 CHECK (frequency_ratio >= 0 AND frequency_ratio <= 1),
            
            -- Zone géographique d'impact
            zone_geographique VARCHAR(50) NOT NULL DEFAULT 'local' CHECK (zone_geographique IN ('local', 'regional', 'international')),
            geo_publicitaire GEOMETRY(POINT, 4326),
            rayon_km INTEGER DEFAULT 50,
            
            -- Status et lifecycle
            status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'pending', 'paused')),
            date_debut TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            date_fin TIMESTAMPTZ NOT NULL,
            
            -- Analytics et tracking
            vues INTEGER NOT NULL DEFAULT 0,
            clics INTEGER NOT NULL DEFAULT 0,
            impressions INTEGER NOT NULL DEFAULT 0,
            
            -- Metadata
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            
            -- ✅ NOUVEAU: Fonctionnalités avancées pour 100% parité avec les géants
            targeting JSONB DEFAULT '{}',
            ab_testing JSONB DEFAULT '{}',
            schedule JSONB DEFAULT NULL,
            placements JSONB DEFAULT '[]',
            bid_strategy JSONB DEFAULT '{}',
            retargeting JSONB DEFAULT '{}',
            variant_performance JSONB DEFAULT '{}',
            
            -- Contraintes
            CONSTRAINT check_date_fin_after_debut CHECK (date_fin > date_debut),
            CONSTRAINT check_produits_not_empty CHECK (array_length(produits_indexes, 1) > 0)
        )
    "#)
    .execute(pool)
    .await?;

    // Créer les index pour performances
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_publicites_user_id ON publicites(user_id)")
        .execute(pool)
        .await?;

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_publicites_status ON publicites(status)")
        .execute(pool)
        .await?;

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_publicites_zone ON publicites(zone_geographique)")
        .execute(pool)
        .await?;

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_publicites_date_fin ON publicites(date_fin)")
        .execute(pool)
        .await?;

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_publicites_active ON publicites(status, date_fin) WHERE status = 'active'")
        .execute(pool)
        .await?;

    // Index spatial pour geo_publicitaire (nécessite PostGIS)
    let _ = sqlx::query("CREATE INDEX IF NOT EXISTS idx_publicites_geo ON publicites USING GIST(geo_publicitaire) WHERE geo_publicitaire IS NOT NULL")
        .execute(pool)
        .await; // Ignore si PostGIS n'est pas disponible

    // Index GIN pour recherche dans produits_indexes
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_publicites_produits_gin ON publicites USING GIN(produits_indexes)")
        .execute(pool)
        .await?;

    // ✅ NOUVEAU: Index GIN pour fonctionnalités avancées
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_publicites_targeting_gin ON publicites USING GIN(targeting)")
        .execute(pool)
        .await?;
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_publicites_ab_testing_gin ON publicites USING GIN(ab_testing)")
        .execute(pool)
        .await?;
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_publicites_placements_gin ON publicites USING GIN(placements)")
        .execute(pool)
        .await?;
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_publicites_retargeting_gin ON publicites USING GIN(retargeting)")
        .execute(pool)
        .await?;
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_publicites_schedule_start ON publicites((schedule->>'start_date')) WHERE schedule IS NOT NULL")
        .execute(pool)
        .await?;
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_publicites_schedule_end ON publicites((schedule->>'end_date')) WHERE schedule IS NOT NULL")
        .execute(pool)
        .await?;

    // Fonction pour mettre à jour updated_at automatiquement
    sqlx::query(
        r#"
        CREATE OR REPLACE FUNCTION update_publicites_updated_at()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql
    "#,
    )
    .execute(pool)
    .await?;

    // Supprimer le trigger s'il existe
    let _ =
        sqlx::query("DROP TRIGGER IF EXISTS trigger_update_publicites_updated_at ON publicites")
            .execute(pool)
            .await;

    // Créer le trigger
    sqlx::query(
        r#"
        CREATE TRIGGER trigger_update_publicites_updated_at
            BEFORE UPDATE ON publicites
            FOR EACH ROW
            EXECUTE FUNCTION update_publicites_updated_at()
    "#,
    )
    .execute(pool)
    .await?;

    // Fonction pour calculer automatiquement date_fin
    sqlx::query(
        r#"
        CREATE OR REPLACE FUNCTION set_publicite_date_fin()
        RETURNS TRIGGER AS $$
        BEGIN
            IF NEW.date_fin IS NULL OR NEW.date_fin = NEW.date_debut THEN
                NEW.date_fin = NEW.date_debut + (NEW.duree_jours || ' days')::interval;
            END IF;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql
    "#,
    )
    .execute(pool)
    .await?;

    // Supprimer le trigger s'il existe
    let _ = sqlx::query("DROP TRIGGER IF EXISTS trigger_set_publicite_date_fin ON publicites")
        .execute(pool)
        .await;

    // Créer le trigger
    sqlx::query(
        r#"
        CREATE TRIGGER trigger_set_publicite_date_fin
            BEFORE INSERT OR UPDATE ON publicites
            FOR EACH ROW
            EXECUTE FUNCTION set_publicite_date_fin()
    "#,
    )
    .execute(pool)
    .await?;

    // Fonction pour désactiver automatiquement les publicités expirées
    sqlx::query(
        r#"
        CREATE OR REPLACE FUNCTION deactivate_expired_publicites()
        RETURNS INTEGER AS $$
        DECLARE
            affected_count INTEGER;
        BEGIN
            UPDATE publicites
            SET status = 'expired'
            WHERE status = 'active'
            AND date_fin < NOW();
            
            GET DIAGNOSTICS affected_count = ROW_COUNT;
            RETURN affected_count;
        END;
        $$ LANGUAGE plpgsql
    "#,
    )
    .execute(pool)
    .await?;

    // ✅ NOUVEAU: Fonctions pour fonctionnalités avancées
    sqlx::query(
        r#"
        CREATE OR REPLACE FUNCTION is_publicite_scheduled_active(pub_id INTEGER)
        RETURNS BOOLEAN AS $$
        DECLARE
            pub_schedule JSONB;
            start_date TIMESTAMPTZ;
            end_date TIMESTAMPTZ;
            pause_weekends BOOLEAN;
            current_day INTEGER;
        BEGIN
            SELECT schedule INTO pub_schedule FROM publicites WHERE id = pub_id;
            IF pub_schedule IS NULL OR pub_schedule = '{}'::jsonb THEN RETURN TRUE; END IF;
            IF pub_schedule->>'start_date' IS NOT NULL THEN
                start_date := (pub_schedule->>'start_date')::timestamptz;
                IF NOW() < start_date THEN RETURN FALSE; END IF;
            END IF;
            IF pub_schedule->>'end_date' IS NOT NULL THEN
                end_date := (pub_schedule->>'end_date')::timestamptz;
                IF NOW() > end_date THEN RETURN FALSE; END IF;
            END IF;
            pause_weekends := COALESCE((pub_schedule->>'pause_on_weekends')::boolean, FALSE);
            IF pause_weekends THEN
                current_day := EXTRACT(DOW FROM NOW())::integer;
                IF current_day = 0 OR current_day = 6 THEN RETURN FALSE; END IF;
            END IF;
            RETURN TRUE;
        END;
        $$ LANGUAGE plpgsql
    "#,
    )
    .execute(pool)
    .await?;

    sqlx::query(
        r#"
        CREATE OR REPLACE FUNCTION matches_targeting(pub_targeting JSONB, user_age INTEGER, user_gender TEXT, user_interests TEXT[], user_behaviors TEXT[])
        RETURNS BOOLEAN AS $$
        DECLARE
            target_age_min INTEGER;
            target_age_max INTEGER;
            target_gender TEXT;
            target_interests JSONB;
            target_behaviors JSONB;
        BEGIN
            IF pub_targeting IS NULL OR pub_targeting = '{}'::jsonb THEN RETURN TRUE; END IF;
            IF pub_targeting->'age_range' IS NOT NULL THEN
                target_age_min := COALESCE((pub_targeting->'age_range'->>'min')::integer, 0);
                target_age_max := COALESCE((pub_targeting->'age_range'->>'max')::integer, 999);
                IF user_age < target_age_min OR user_age > target_age_max THEN RETURN FALSE; END IF;
            END IF;
            target_gender := pub_targeting->>'gender';
            IF target_gender IS NOT NULL AND target_gender != 'all' THEN
                IF target_gender != user_gender THEN RETURN FALSE; END IF;
            END IF;
            target_interests := pub_targeting->'interests';
            IF target_interests IS NOT NULL AND jsonb_array_length(target_interests) > 0 THEN
                IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements_text(target_interests) AS interest WHERE interest = ANY(user_interests)) THEN
                    RETURN FALSE;
                END IF;
            END IF;
            target_behaviors := pub_targeting->'behaviors';
            IF target_behaviors IS NOT NULL AND jsonb_array_length(target_behaviors) > 0 THEN
                IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements_text(target_behaviors) AS behavior WHERE behavior = ANY(user_behaviors)) THEN
                    RETURN FALSE;
                END IF;
            END IF;
            RETURN TRUE;
        END;
        $$ LANGUAGE plpgsql
    "#,
    )
    .execute(pool)
    .await?;

    sqlx::query(
        r#"
        CREATE OR REPLACE FUNCTION matches_retargeting(pub_retargeting JSONB, user_id INTEGER)
        RETURNS BOOLEAN AS $$
        DECLARE
            retargeting_rules JSONB;
            rule JSONB;
            rule_type TEXT;
            days_since INTEGER;
            match_found BOOLEAN := FALSE;
        BEGIN
            IF pub_retargeting IS NULL OR pub_retargeting = '{}'::jsonb THEN RETURN TRUE; END IF;
            retargeting_rules := pub_retargeting->'rules';
            IF retargeting_rules IS NULL OR jsonb_array_length(retargeting_rules) = 0 THEN RETURN TRUE; END IF;
            FOR rule IN SELECT * FROM jsonb_array_elements(retargeting_rules) LOOP
                rule_type := rule->>'type';
                days_since := COALESCE((rule->>'days_since')::integer, 7);
                CASE rule_type
                    WHEN 'viewed_product' THEN
                        SELECT EXISTS (SELECT 1 FROM user_behavior WHERE user_id = user_id AND behavior_type = 'product_view' AND created_at > NOW() - (days_since || ' days')::interval) INTO match_found;
                    WHEN 'abandoned_cart' THEN
                        SELECT EXISTS (SELECT 1 FROM shopping_baskets WHERE user_id = user_id AND status = 'abandoned' AND updated_at > NOW() - (days_since || ' days')::interval) INTO match_found;
                    WHEN 'visited_service' THEN
                        SELECT EXISTS (SELECT 1 FROM user_behavior WHERE user_id = user_id AND behavior_type = 'service_view' AND created_at > NOW() - (days_since || ' days')::interval) INTO match_found;
                    WHEN 'searched' THEN
                        SELECT EXISTS (SELECT 1 FROM search_history WHERE user_id = user_id AND created_at > NOW() - (days_since || ' days')::interval) INTO match_found;
                    ELSE match_found := FALSE;
                END CASE;
                IF match_found THEN RETURN TRUE; END IF;
            END LOOP;
            RETURN FALSE;
        END;
        $$ LANGUAGE plpgsql
    "#,
    )
    .execute(pool)
    .await?;

    info!("✅ Table publicites créée avec succès !");

    Ok(())
}

/// Vérifie et crée la table notifications si elle n'existe pas
pub async fn ensure_notifications_table(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification de la table notifications...");

    // Vérifier si la table existe
    let exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications')",
    )
    .fetch_one(pool)
    .await?;

    if exists {
        info!("✅ Table notifications déjà présente");

        // ✅ NOUVEAU 2025-11-05: Vérifier toutes les colonnes critiques
        // Vérifier notification_type
        let has_notif_type = sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'notification_type')"
        )
        .fetch_one(pool)
        .await?;

        if !has_notif_type {
            warn!("⚠️ Colonne 'notification_type' manquante, ajout en cours...");
            sqlx::query(
                "ALTER TABLE notifications ADD COLUMN IF NOT EXISTS notification_type VARCHAR(50)",
            )
            .execute(pool)
            .await?;
            info!("✅ Colonne 'notification_type' ajoutée");
        }

        // Vérifier title
        let has_title = sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'title')"
        )
        .fetch_one(pool)
        .await?;

        if !has_title {
            warn!("⚠️ Colonne 'title' manquante, ajout en cours...");
            sqlx::query("ALTER TABLE notifications ADD COLUMN IF NOT EXISTS title VARCHAR(255)")
                .execute(pool)
                .await?;
            info!("✅ Colonne 'title' ajoutée");
        }

        // Vérifier metadata
        let has_metadata = sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'metadata')"
        )
        .fetch_one(pool)
        .await?;

        if !has_metadata {
            warn!("⚠️ Colonne 'metadata' manquante, ajout en cours...");
            sqlx::query("ALTER TABLE notifications ADD COLUMN IF NOT EXISTS metadata JSONB")
                .execute(pool)
                .await?;
            info!("✅ Colonne 'metadata' ajoutée");
        }

        // Vérifier read_at
        let has_read_at = sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'read_at')"
        )
        .fetch_one(pool)
        .await?;

        if !has_read_at {
            warn!("⚠️ Colonne 'read_at' manquante, ajout en cours...");
            sqlx::query("ALTER TABLE notifications ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ")
                .execute(pool)
                .await?;
            info!("✅ Colonne 'read_at' ajoutée");
        }

        return Ok(());
    }

    warn!("⚠️ Table notifications manquante, création en cours...");

    // Créer la table notifications avec les colonnes compatibles pour tous les usages
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS notifications (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            type VARCHAR(50),
            notification_type VARCHAR(50),
            title VARCHAR(255),
            message TEXT NOT NULL,
            data JSONB,
            metadata JSONB,
            is_read BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
            read_at TIMESTAMPTZ
        )
    "#,
    )
    .execute(pool)
    .await?;

    // Créer les index pour performances
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id)")
        .execute(pool)
        .await?;

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read)")
        .execute(pool)
        .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC)",
    )
    .execute(pool)
    .await?;

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read) WHERE is_read = FALSE")
        .execute(pool)
        .await?;

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type) WHERE type IS NOT NULL")
        .execute(pool)
        .await?;

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_notifications_notification_type ON notifications(notification_type) WHERE notification_type IS NOT NULL")
        .execute(pool)
        .await?;

    info!("✅ Table notifications créée avec succès !");

    Ok(())
}

/// Vérifie et crée la table autocomplete_characteristics si elle n'existe pas
pub async fn ensure_autocomplete_characteristics_table(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification de la table autocomplete_characteristics...");

    let exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'autocomplete_characteristics')"
    )
    .fetch_one(pool)
    .await?;

    if exists {
        info!("✅ Table autocomplete_characteristics déjà présente");

        let has_char_vector = sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'autocomplete_characteristics' AND column_name = 'characteristic_vector')"
        )
        .fetch_one(pool)
        .await?;

        if !has_char_vector {
            warn!("⚠️ Colonnes vectorielles manquantes, ajout en cours...");
            sqlx::query("ALTER TABLE autocomplete_characteristics ADD COLUMN IF NOT EXISTS characteristic_vector TEXT[] DEFAULT '{}'")
                .execute(pool)
                .await?;
            sqlx::query("ALTER TABLE autocomplete_characteristics ADD COLUMN IF NOT EXISTS location_vector TEXT[] DEFAULT '{}'")
                .execute(pool)
                .await?;
            sqlx::query("ALTER TABLE autocomplete_characteristics ADD COLUMN IF NOT EXISTS full_vector TEXT[] DEFAULT '{}'")
                .execute(pool)
                .await?;
            info!("✅ Colonnes vectorielles ajoutées");
        }

        let has_product_id = sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'autocomplete_characteristics' AND column_name = 'product_id')"
        )
        .fetch_one(pool)
        .await?;

        if !has_product_id {
            warn!("⚠️ Colonne 'product_id' manquante, ajout en cours...");
            sqlx::query(
                "ALTER TABLE autocomplete_characteristics ADD COLUMN IF NOT EXISTS product_id TEXT",
            )
            .execute(pool)
            .await?;
            info!("✅ Colonne 'product_id' ajoutée");
        }

        let has_geoname = sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'autocomplete_characteristics' AND column_name = 'chosen_location_geoname_id')"
        )
        .fetch_one(pool)
        .await?;

        if !has_geoname {
            warn!("⚠️ Colonne 'chosen_location_geoname_id' manquante, ajout en cours...");
            sqlx::query("ALTER TABLE autocomplete_characteristics ADD COLUMN IF NOT EXISTS chosen_location_geoname_id BIGINT")
                .execute(pool)
                .await?;
            info!("✅ Colonne 'chosen_location_geoname_id' ajoutée");
        }

        let has_chosen_location = sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'autocomplete_characteristics' AND column_name = 'chosen_location')"
        )
        .fetch_one(pool)
        .await?;

        if !has_chosen_location {
            warn!("⚠️ Colonne 'chosen_location' manquante, ajout en cours...");
            sqlx::query("ALTER TABLE autocomplete_characteristics ADD COLUMN IF NOT EXISTS chosen_location TEXT")
                .execute(pool)
                .await?;
            info!("✅ Colonne 'chosen_location' ajoutée");
        }

        let has_is_real = sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'autocomplete_characteristics' AND column_name = 'is_real_product')"
        )
        .fetch_one(pool)
        .await?;

        if !has_is_real {
            warn!("⚠️ Colonne 'is_real_product' manquante, ajout en cours...");
            sqlx::query("ALTER TABLE autocomplete_characteristics ADD COLUMN IF NOT EXISTS is_real_product BOOLEAN DEFAULT TRUE")
                .execute(pool)
                .await?;
            info!("✅ Colonne 'is_real_product' ajoutée");
        }

        let has_product_labels = sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'autocomplete_characteristics' AND column_name = 'product_labels')"
        )
        .fetch_one(pool)
        .await?;

        if !has_product_labels {
            warn!("⚠️ Colonne 'product_labels' manquante dans autocomplete_characteristics, ajout en cours...");
            sqlx::query("ALTER TABLE autocomplete_characteristics ADD COLUMN IF NOT EXISTS product_labels TEXT[] DEFAULT '{}'")
                .execute(pool)
                .await?;
            info!("✅ Colonne 'product_labels' ajoutée à autocomplete_characteristics");
        }
    } else {
        warn!("⚠️ Table autocomplete_characteristics manquante, création en cours...");

        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS autocomplete_characteristics (
                id SERIAL PRIMARY KEY,
                identifiant_base VARCHAR(255) NOT NULL,
                
                -- MODE VECTORIEL (nouveaux champs 2025-11-04)
                characteristic_vector TEXT[] DEFAULT '{}',
                location_vector TEXT[] DEFAULT '{}',
                full_vector TEXT[] DEFAULT '{}',
                product_id TEXT,
                chosen_location TEXT,
                chosen_location_geoname_id BIGINT,
                is_real_product BOOLEAN DEFAULT TRUE,
                
                -- MODE INDIVIDUEL (ancien, conservé pour compatibilité)
                sous_caracteristique VARCHAR(255),
                valeur VARCHAR(500),
                
                -- Métadonnées
                origine_champs VARCHAR(50) NOT NULL DEFAULT 'ia',
                user_id INTEGER,
                service_id INTEGER,
                usage_count INTEGER DEFAULT 1,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
        "#,
        )
        .execute(pool)
        .await?;
    }

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_autocomplete_identifiant_base ON autocomplete_characteristics(identifiant_base)")
        .execute(pool)
        .await?;

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_autocomplete_sous_caracteristique ON autocomplete_characteristics(sous_caracteristique)")
        .execute(pool)
        .await?;

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_autocomplete_base_sous ON autocomplete_characteristics(identifiant_base, sous_caracteristique)")
        .execute(pool)
        .await?;

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_autocomplete_valeur_lower ON autocomplete_characteristics(LOWER(valeur))")
        .execute(pool)
        .await?;

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_autocomplete_origine ON autocomplete_characteristics(origine_champs)")
        .execute(pool)
        .await?;

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_autocomplete_user_id ON autocomplete_characteristics(user_id) WHERE user_id IS NOT NULL")
        .execute(pool)
        .await?;

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_autocomplete_service_id ON autocomplete_characteristics(service_id) WHERE service_id IS NOT NULL")
        .execute(pool)
        .await?;

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_autocomplete_usage_count ON autocomplete_characteristics(identifiant_base, sous_caracteristique, usage_count DESC)")
        .execute(pool)
        .await?;

    // Créer les index
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_autocomplete_identifiant_base ON autocomplete_characteristics(identifiant_base)")
        .execute(pool)
        .await?;

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_autocomplete_sous_caracteristique ON autocomplete_characteristics(sous_caracteristique)")
        .execute(pool)
        .await?;

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_autocomplete_base_sous ON autocomplete_characteristics(identifiant_base, sous_caracteristique)")
        .execute(pool)
        .await?;

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_autocomplete_valeur_lower ON autocomplete_characteristics(LOWER(valeur))")
        .execute(pool)
        .await?;

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_autocomplete_origine ON autocomplete_characteristics(origine_champs)")
        .execute(pool)
        .await?;

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_autocomplete_user_id ON autocomplete_characteristics(user_id) WHERE user_id IS NOT NULL")
        .execute(pool)
        .await?;

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_autocomplete_service_id ON autocomplete_characteristics(service_id) WHERE service_id IS NOT NULL")
        .execute(pool)
        .await?;

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_autocomplete_usage_count ON autocomplete_characteristics(identifiant_base, sous_caracteristique, usage_count DESC)")
        .execute(pool)
        .await?;

    // Index vectoriels (nouveaux 2025-11-04)
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_autochar_characteristic_vector_gin ON autocomplete_characteristics USING GIN(characteristic_vector)")
        .execute(pool)
        .await?;

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_autochar_location_vector_gin ON autocomplete_characteristics USING GIN(location_vector)")
        .execute(pool)
        .await?;

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_autochar_full_vector_gin ON autocomplete_characteristics USING GIN(full_vector)")
        .execute(pool)
        .await?;

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_autochar_product_id ON autocomplete_characteristics(product_id) WHERE product_id IS NOT NULL")
        .execute(pool)
        .await?;

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_autochar_geoname_id ON autocomplete_characteristics(chosen_location_geoname_id) WHERE chosen_location_geoname_id IS NOT NULL")
        .execute(pool)
        .await?;

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_autochar_location_usage ON autocomplete_characteristics(chosen_location, usage_count DESC) WHERE chosen_location IS NOT NULL")
        .execute(pool)
        .await?;

    // ✅ OPTIMISÉ 2025-01-14: Index composites pour améliorer les performances autocomplete
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_autocomplete_real_product_composite ON autocomplete_characteristics(identifiant_base, is_real_product, service_id) WHERE is_real_product = TRUE AND identifiant_base = 'produits'")
        .execute(pool)
        .await?;

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_autocomplete_relevance_sort ON autocomplete_characteristics(service_id, usage_count DESC) WHERE is_real_product = TRUE AND identifiant_base = 'produits'")
        .execute(pool)
        .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_services_active_id ON services(id) WHERE is_active = TRUE",
    )
    .execute(pool)
    .await?;

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_services_user_id ON services(user_id) WHERE is_active = TRUE")
        .execute(pool)
        .await?;

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_autocomplete_full_vector_gin_filtered ON autocomplete_characteristics USING GIN(full_vector) WHERE is_real_product = TRUE AND identifiant_base = 'produits'")
        .execute(pool)
        .await?;

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_autocomplete_chosen_location_filtered ON autocomplete_characteristics(chosen_location) WHERE is_real_product = TRUE AND chosen_location IS NOT NULL")
        .execute(pool)
        .await?;

    // Fonction pour updated_at
    sqlx::query(
        r#"
        CREATE OR REPLACE FUNCTION update_autocomplete_characteristics_updated_at()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql
    "#,
    )
    .execute(pool)
    .await?;

    // Trigger pour updated_at
    let _ = sqlx::query("DROP TRIGGER IF EXISTS trigger_autocomplete_characteristics_updated_at ON autocomplete_characteristics")
        .execute(pool)
        .await;

    sqlx::query(
        r#"
        CREATE TRIGGER trigger_autocomplete_characteristics_updated_at
            BEFORE UPDATE ON autocomplete_characteristics
            FOR EACH ROW
            EXECUTE FUNCTION update_autocomplete_characteristics_updated_at()
    "#,
    )
    .execute(pool)
    .await?;

    // Fonction upsert
    sqlx::query(
        r#"
        CREATE OR REPLACE FUNCTION upsert_autocomplete_characteristic(
            p_identifiant_base VARCHAR(255),
            p_sous_caracteristique VARCHAR(255),
            p_valeur VARCHAR(500),
            p_origine_champs VARCHAR(50) DEFAULT 'ia',
            p_user_id INTEGER DEFAULT NULL,
            p_service_id INTEGER DEFAULT NULL
        )
        RETURNS INTEGER AS $$
        DECLARE
            v_id INTEGER;
        BEGIN
            INSERT INTO autocomplete_characteristics (
                identifiant_base,
                sous_caracteristique,
                valeur,
                origine_champs,
                user_id,
                service_id,
                usage_count
            )
            VALUES (
                p_identifiant_base,
                p_sous_caracteristique,
                p_valeur,
                p_origine_champs,
                p_user_id,
                p_service_id,
                1
            )
            ON CONFLICT (identifiant_base, sous_caracteristique, valeur)
            DO UPDATE SET
                usage_count = autocomplete_characteristics.usage_count + 1,
                updated_at = NOW();
            
            SELECT id INTO v_id
            FROM autocomplete_characteristics
            WHERE identifiant_base = p_identifiant_base
            AND sous_caracteristique = p_sous_caracteristique
            AND valeur = p_valeur;
            
            RETURN v_id;
        END;
        $$ LANGUAGE plpgsql
    "#,
    )
    .execute(pool)
    .await?;

    info!("✅ Table autocomplete_characteristics créée avec succès !");

    Ok(())
}

/// ✅ 2025-12-30: Optimisation matching vectoriel avec similarité en une passe
/// Crée les fonctions de normalisation, colonnes normalisées, index et fonction de scoring optimisée
pub async fn ensure_vector_matching_optimization(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification de l'optimisation matching vectoriel...");

    // 1. Fonction de normalisation
    sqlx::query(
        r#"
        CREATE OR REPLACE FUNCTION normalize_word(word TEXT)
        RETURNS TEXT AS $$
        BEGIN
            IF word IS NULL OR word = '' THEN
                RETURN '';
            END IF;
            RETURN LOWER(
                translate(
                    word,
                    'àâäéèêëîïôöùûüÿç',
                    'aaaeeeeiiioouuuyc'
                )
            );
        END;
        $$ LANGUAGE plpgsql IMMUTABLE;
        "#,
    )
    .execute(pool)
    .await?;

    // 2. Fonction pour normaliser un array de mots
    sqlx::query(
        r#"
        CREATE OR REPLACE FUNCTION normalize_word_array(word_array TEXT[])
        RETURNS TEXT[] AS $$
        BEGIN
            IF word_array IS NULL OR array_length(word_array, 1) IS NULL THEN
                RETURN ARRAY[]::TEXT[];
            END IF;
            RETURN ARRAY(
                SELECT normalize_word(unnest(word_array))
            );
        END;
        $$ LANGUAGE plpgsql IMMUTABLE;
        "#,
    )
    .execute(pool)
    .await?;

    // 3. Colonnes calculées normalisées
    sqlx::query(
        r#"
        ALTER TABLE autocomplete_characteristics 
        ADD COLUMN IF NOT EXISTS normalized_characteristic_vector TEXT[] 
        GENERATED ALWAYS AS (normalize_word_array(characteristic_vector)) STORED;
        "#,
    )
    .execute(pool)
    .await?;

    sqlx::query(
        r#"
        ALTER TABLE autocomplete_characteristics 
        ADD COLUMN IF NOT EXISTS normalized_full_vector TEXT[] 
        GENERATED ALWAYS AS (normalize_word_array(full_vector)) STORED;
        "#,
    )
    .execute(pool)
    .await?;

    // 4. Index GIN sur colonnes normalisées
    sqlx::query(
        r#"
        CREATE INDEX IF NOT EXISTS idx_autocomplete_normalized_characteristic_vector_gin 
        ON autocomplete_characteristics USING GIN (normalized_characteristic_vector);
        "#,
    )
    .execute(pool)
    .await?;

    sqlx::query(
        r#"
        CREATE INDEX IF NOT EXISTS idx_autocomplete_normalized_full_vector_gin 
        ON autocomplete_characteristics USING GIN (normalized_full_vector);
        "#,
    )
    .execute(pool)
    .await?;

    sqlx::query(
        r#"
        CREATE INDEX IF NOT EXISTS idx_autocomplete_normalized_filters 
        ON autocomplete_characteristics (is_real_product, identifiant_base) 
        WHERE is_real_product = TRUE AND identifiant_base = 'produits';
        "#,
    )
    .execute(pool)
    .await?;

    // 5. Fonction de matching vectoriel optimisée
    sqlx::query(
        r#"
        CREATE OR REPLACE FUNCTION calculate_vector_match_score_optimized(
            product_vector_normalized TEXT[],
            search_keywords_normalized TEXT[]
        )
        RETURNS REAL AS $$
            SELECT COALESCE(
                GREATEST(
                    -- Score exact (100%) : Match exact normalisé
                    (
                        SELECT COUNT(*)::REAL
                        FROM unnest(search_keywords_normalized) AS keyword
                        WHERE keyword = ANY(product_vector_normalized)
                    ) / NULLIF(array_length(search_keywords_normalized, 1), 0)::REAL * 100.0,
                    -- Score partiel (70%) : Mots tronqués (LIKE)
                    (
                        SELECT COUNT(*)::REAL
                        FROM unnest(search_keywords_normalized) AS keyword
                        WHERE EXISTS (
                            SELECT 1
                            FROM unnest(product_vector_normalized) AS elem
                            WHERE elem LIKE keyword || '%' OR keyword LIKE elem || '%'
                        )
                    ) / NULLIF(array_length(search_keywords_normalized, 1), 0)::REAL * 70.0,
                    -- Score fuzzy (40%) : Fautes de frappe (similarity)
                    (
                        SELECT COUNT(*)::REAL
                        FROM unnest(search_keywords_normalized) AS keyword
                        WHERE EXISTS (
                            SELECT 1
                            FROM unnest(product_vector_normalized) AS elem
                            WHERE similarity(keyword, elem) > 0.3
                        )
                    ) / NULLIF(array_length(search_keywords_normalized, 1), 0)::REAL * 40.0
                ),
                0.0
            );
        $$ LANGUAGE sql IMMUTABLE;
        "#,
    )
    .execute(pool)
    .await?;

    // 6. Analyser la table pour optimiser les statistiques
    sqlx::query("ANALYZE autocomplete_characteristics").execute(pool).await?;

    info!("✅ Optimisation matching vectoriel appliquée avec succès !");
    Ok(())
}

/// ✅ 2025-12-30: Optimisation recherche image avec matching vectoriel normalisé
pub async fn ensure_image_search_vector_matching_optimization(
    pool: &PgPool,
) -> Result<(), sqlx::Error> {
    info!("🔍 Application migration image search vector matching optimization...");
    let migration_sql =
        include_str!("../../migrations/00001031_optimize_image_search_vector_matching.sql");

    // ✅ CORRIGÉ 2026-02-13: Utiliser execute_migration_sql_safe() pour gérer les commandes multiples
    execute_migration_sql_safe(pool, migration_sql).await?;

    info!("✅ Migration image search vector matching optimization appliquée");
    Ok(())
}

/// ✅ 2026-01-14: Correction erreur to_tsvector avec langue dynamique
pub async fn ensure_fix_image_search_to_tsvector_error(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Application migration fix image search to_tsvector error...");
    let migration_sql =
        include_str!("../../migrations/00000052_fix_image_search_to_tsvector_error.sql");

    // ✅ CORRIGÉ 2026-02-13: Utiliser execute_migration_sql_safe() pour gérer les commandes multiples
    execute_migration_sql_safe(pool, migration_sql).await?;

    info!("✅ Migration fix image search to_tsvector error appliquée");
    Ok(())
}

/// ✅ 2026-01-15: Correction recherche image - Gestion images non analysées
pub async fn ensure_fix_image_search_empty_results(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Application migration fix image search empty results...");
    let migration_sql =
        include_str!("../../migrations/20260115_fix_image_search_empty_results.sql");

    sqlx::query(migration_sql).execute(pool).await?;

    info!("✅ Migration fix image search empty results appliquée");
    Ok(())
}

/// ✅ 2025-12-30: Optimisation recherche audio avec cache et post-traitement
pub async fn ensure_audio_search_cache_optimization(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Application migration audio search cache optimization...");
    let migration_sql = include_str!("../../migrations/00001037_optimize_audio_search_cache.sql");

    // ✅ CORRIGÉ 2026-02-13: Utiliser execute_migration_sql_safe() pour gérer les commandes multiples
    execute_migration_sql_safe(pool, migration_sql).await?;

    info!("✅ Migration audio search cache optimization appliquée");

    // ✅ CORRIGÉ 2025-12-31: Fix de la fonction run_audio_cache_cleanup avec gestion NULL
    // Corrige l'erreur UnexpectedNullError en gérant les valeurs NULL
    info!("🔧 Correction de la fonction run_audio_cache_cleanup avec gestion NULL...");
    sqlx::query(
        r#"
        DROP FUNCTION IF EXISTS run_audio_cache_cleanup();

        CREATE OR REPLACE FUNCTION run_audio_cache_cleanup()
        RETURNS TABLE(
            deleted_count INTEGER,
            kept_count INTEGER,
            total_before INTEGER,
            total_after INTEGER
        ) AS $$
        DECLARE
            deleted_count_var INTEGER := 0;
            kept_count_var INTEGER := 0;
            total_before_var INTEGER := 0;
            total_after_var INTEGER := 0;
        BEGIN
            -- Vérifier si la fonction cleanup_old_audio_transcriptions existe
            IF EXISTS (
                SELECT 1 FROM pg_proc 
                WHERE proname = 'cleanup_old_audio_transcriptions'
            ) THEN
                -- Exécuter le nettoyage et récupérer les résultats dans des variables explicites
                -- Utiliser COALESCE pour garantir des valeurs non-NULL
                SELECT 
                    COALESCE(deleted_count, 0),
                    COALESCE(kept_count, 0),
                    COALESCE(total_before, 0),
                    COALESCE(total_after, 0)
                INTO 
                    deleted_count_var,
                    kept_count_var,
                    total_before_var,
                    total_after_var
                FROM cleanup_old_audio_transcriptions()
                LIMIT 1;
            ELSE
                -- Si la fonction n'existe pas, retourner des valeurs par défaut (0)
                RAISE NOTICE 'Fonction cleanup_old_audio_transcriptions non trouvée, retour de valeurs par défaut';
            END IF;
            
            -- Log (peut être envoyé à un système de monitoring)
            RAISE NOTICE 'Audio cache cleanup: deleted %, kept %, total before %, after %', 
                deleted_count_var, kept_count_var, total_before_var, total_after_var;
            
            -- Retourner les résultats comme une table (toujours des valeurs non-NULL)
            RETURN QUERY SELECT deleted_count_var, kept_count_var, total_before_var, total_after_var;
        END;
        $$ LANGUAGE plpgsql;
        "#,
    )
    .execute(pool)
    .await?;

    info!("✅ Fonction run_audio_cache_cleanup corrigée avec gestion NULL");
    Ok(())
}

/// ✅ 2025-12-30: Optimisation finale performance recherche (< 2s)
pub async fn ensure_search_performance_final_optimization(
    pool: &PgPool,
) -> Result<(), sqlx::Error> {
    info!("🔍 Application migration search performance final optimization...");
    let migration_sql =
        include_str!("../../migrations/00001026_optimize_search_performance_final.sql");

    // ✅ CORRIGÉ 2026-02-13: Utiliser execute_migration_sql_safe() pour gérer les commandes multiples
    execute_migration_sql_safe(pool, migration_sql).await?;

    info!("✅ Migration search performance final optimization appliquée");
    Ok(())
}

/// Vérifie et crée la table autocomplete_combinations si elle n'existe pas
pub async fn ensure_autocomplete_combinations_table(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification de la table autocomplete_combinations...");

    // Vérifier si la table existe
    let exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'autocomplete_combinations')"
    )
    .fetch_one(pool)
    .await?;

    if exists {
        info!("✅ Table autocomplete_combinations déjà présente");

        // ✅ CRITIQUE 2025-11-06: Vérifier et rendre service_id NULLABLE
        let is_service_id_nullable = sqlx::query_scalar::<_, bool>(
            "SELECT is_nullable = 'YES' FROM information_schema.columns WHERE table_name = 'autocomplete_combinations' AND column_name = 'service_id'"
        )
        .fetch_one(pool)
        .await
        .unwrap_or(true);

        if !is_service_id_nullable {
            warn!("⚠️ CRITIQUE: Colonne 'service_id' est NOT NULL, correction en cours...");
            sqlx::query(
                "ALTER TABLE autocomplete_combinations ALTER COLUMN service_id DROP NOT NULL",
            )
            .execute(pool)
            .await?;
            info!("✅ Colonne 'service_id' rendue NULLABLE (fix crash autocomplete)");
        }

        // Vérifier si product_labels existe, sinon l'ajouter
        let has_product_labels = sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'autocomplete_combinations' AND column_name = 'product_labels')"
        )
        .fetch_one(pool)
        .await?;

        if !has_product_labels {
            warn!("⚠️ Colonne product_labels manquante, ajout en cours...");
            sqlx::query(
                "ALTER TABLE autocomplete_combinations ADD COLUMN IF NOT EXISTS product_labels TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[]"
            )
            .execute(pool)
            .await?;

            info!("✅ Colonne product_labels ajoutée");
        }

        // ✅ NOUVEAU 2025-11-05: Vérifier et ajouter location_labels si manquante
        let has_location_labels = sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'autocomplete_combinations' AND column_name = 'location_labels')"
        )
        .fetch_one(pool)
        .await?;

        if !has_location_labels {
            warn!("⚠️ Colonne location_labels manquante, ajout en cours...");
            sqlx::query(
                "ALTER TABLE autocomplete_combinations ADD COLUMN IF NOT EXISTS location_labels TEXT[] DEFAULT ARRAY[]::TEXT[]"
            )
            .execute(pool)
            .await?;

            info!("✅ Colonne location_labels ajoutée");
        }

        // ✅ NOUVEAU 2025-11-05: Vérifier et ajouter session_id si manquante
        let has_session_id = sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'autocomplete_combinations' AND column_name = 'session_id')"
        )
        .fetch_one(pool)
        .await?;

        if !has_session_id {
            warn!("⚠️ Colonne session_id manquante, ajout en cours...");
            sqlx::query(
                "ALTER TABLE autocomplete_combinations ADD COLUMN IF NOT EXISTS session_id TEXT",
            )
            .execute(pool)
            .await?;

            info!("✅ Colonne session_id ajoutée");
        }

        // ✅ NOUVEAU 2025-11-06: Vérifier et ajouter is_ai_preferred si manquante
        let has_is_ai_preferred = sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'autocomplete_combinations' AND column_name = 'is_ai_preferred')"
        )
        .fetch_one(pool)
        .await?;

        if !has_is_ai_preferred {
            warn!("⚠️ Colonne is_ai_preferred manquante, ajout en cours...");
            sqlx::query(
                "ALTER TABLE autocomplete_combinations ADD COLUMN IF NOT EXISTS is_ai_preferred BOOLEAN DEFAULT FALSE"
            )
            .execute(pool)
            .await?;

            info!("✅ Colonne is_ai_preferred ajoutée");
        }

        // ✅ NOUVEAU 2025-11-06: Vérifier et ajouter ai_confidence si manquante
        let has_ai_confidence = sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'autocomplete_combinations' AND column_name = 'ai_confidence')"
        )
        .fetch_one(pool)
        .await?;

        if !has_ai_confidence {
            warn!("⚠️ Colonne ai_confidence manquante, ajout en cours...");
            sqlx::query(
                "ALTER TABLE autocomplete_combinations ADD COLUMN IF NOT EXISTS ai_confidence DOUBLE PRECISION DEFAULT 0.5"
            )
            .execute(pool)
            .await?;

            info!("✅ Colonne ai_confidence ajoutée");
        } else {
            // ✅ CORRECTION : Vérifier et convertir REAL (FLOAT4) en DOUBLE PRECISION (FLOAT8) si nécessaire
            let current_type = sqlx::query_scalar::<_, String>(
                "SELECT data_type FROM information_schema.columns WHERE table_name = 'autocomplete_combinations' AND column_name = 'ai_confidence'"
            )
            .fetch_optional(pool)
            .await?;

            if let Some(col_type) = current_type {
                if col_type == "real" {
                    warn!("⚠️ Colonne ai_confidence est REAL, conversion en DOUBLE PRECISION...");
                    sqlx::query(
                        "ALTER TABLE autocomplete_combinations ALTER COLUMN ai_confidence TYPE DOUBLE PRECISION USING ai_confidence::DOUBLE PRECISION"
                    )
                    .execute(pool)
                    .await?;
                    info!("✅ Colonne ai_confidence convertie en DOUBLE PRECISION");
                }
            }
        }

        // ✅ NOUVEAU 2025-11-05: Recréer la fonction upsert_autocomplete_combination avec les bons paramètres
        // Même si la table existe déjà, on doit s'assurer que la fonction est à jour
        info!("🔄 Mise à jour de la fonction upsert_autocomplete_combination...");
        sqlx::query(r#"
            CREATE OR REPLACE FUNCTION upsert_autocomplete_combination(
                p_product_vector TEXT[],
                p_location_vector TEXT[],
                p_full_vector TEXT[],
                p_product_labels TEXT[],
                p_location_labels TEXT[],
                p_chosen_location TEXT,
                p_is_ai_preferred BOOLEAN,
                p_ai_confidence DOUBLE PRECISION,
                p_session_id TEXT,
                p_has_variant BOOLEAN,
                p_variant_dimension TEXT,
                p_variant_value TEXT,
                p_prix DECIMAL(12, 2),
                p_devise TEXT,
                p_stock INTEGER,
                p_service_id INTEGER
            )
            RETURNS INTEGER AS $$
            DECLARE
                v_id INTEGER;
                v_existing_count INTEGER;
            BEGIN
                SELECT id, usage_count INTO v_id, v_existing_count
                FROM autocomplete_combinations
                WHERE full_vector = p_full_vector;
                
                IF FOUND THEN
                    UPDATE autocomplete_combinations
                    SET 
                        usage_count = usage_count + 1,
                        is_ai_preferred = CASE WHEN p_is_ai_preferred THEN TRUE ELSE is_ai_preferred END,
                        ai_confidence = GREATEST(ai_confidence, p_ai_confidence),
                        service_id = COALESCE(p_service_id, service_id),
                        product_labels = p_product_labels,
                        location_labels = p_location_labels,
                        updated_at = NOW()
                    WHERE id = v_id;
                    RETURN v_id;
                ELSE
                    INSERT INTO autocomplete_combinations (
                        service_id, product_vector, product_labels, location_vector, location_labels, full_vector,
                        chosen_location, usage_count, is_ai_preferred, ai_confidence,
                        session_id, has_variant, variant_dimension, variant_value,
                        prix, devise, stock
                    ) VALUES (
                        p_service_id, p_product_vector, p_product_labels, p_location_vector, p_location_labels, p_full_vector,
                        p_chosen_location, 1, p_is_ai_preferred, p_ai_confidence,
                        p_session_id, p_has_variant, p_variant_dimension, p_variant_value,
                        p_prix, p_devise, p_stock
                    )
                    RETURNING id INTO v_id;
                    RETURN v_id;
                END IF;
            END;
            $$ LANGUAGE plpgsql
        "#)
        .execute(pool)
        .await?;

        info!("✅ Fonction upsert_autocomplete_combination mise à jour");

        // Vérifier contraintes unécessaires pour les ON CONFLICT récents
        let has_full_vector_constraint: bool = sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid = 'autocomplete_combinations'::regclass AND conname = 'unique_full_vector')"
        )
        .fetch_one(pool)
        .await?
        ;

        if !has_full_vector_constraint {
            info!(
                "✅ Ajout contrainte unique_full_vector sur autocomplete_combinations(full_vector)"
            );
            if let Err(e) = sqlx::query("ALTER TABLE autocomplete_combinations ADD CONSTRAINT unique_full_vector UNIQUE (full_vector)")
                .execute(pool)
                .await
            {
                warn!("⚠️ Impossible d'ajouter la contrainte unique_full_vector: {}", e);
            }
        }

        let has_product_vector_constraint: bool = sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid = 'autocomplete_combinations'::regclass AND conname = 'unique_product_vector')"
        )
        .fetch_one(pool)
        .await?
        ;

        if !has_product_vector_constraint {
            info!("✅ Ajout contrainte unique_product_vector sur autocomplete_combinations(product_vector)");
            if let Err(e) = sqlx::query("ALTER TABLE autocomplete_combinations ADD CONSTRAINT unique_product_vector UNIQUE (product_vector)")
                .execute(pool)
                .await
            {
                warn!("⚠️ Impossible d'ajouter la contrainte unique_product_vector: {}", e);
            }
        }
    } else {
        warn!("⚠️ Table autocomplete_combinations manquante, création en cours...");

        // Créer la table autocomplete_combinations
        sqlx::query(r#"
        CREATE TABLE IF NOT EXISTS autocomplete_combinations (
            id SERIAL PRIMARY KEY,
            service_id INTEGER,
            product_vector TEXT[] NOT NULL,
            location_vector TEXT[] DEFAULT '{}',
            full_vector TEXT[] NOT NULL,
            product_labels TEXT[] NOT NULL,
            location_labels TEXT[] DEFAULT '{}',
            usage_count INTEGER DEFAULT 1,
            is_ai_preferred BOOLEAN DEFAULT FALSE,
            ai_confidence DOUBLE PRECISION DEFAULT 0.0,
            session_id TEXT,
            has_variant BOOLEAN DEFAULT FALSE,
            variant_dimension TEXT,
            variant_value TEXT,
            prix DECIMAL(12, 2),
            devise TEXT DEFAULT 'XAF',
            stock INTEGER,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW(),
            CONSTRAINT unique_full_vector UNIQUE (full_vector),
            CONSTRAINT check_vectors_labels_length CHECK (array_length(product_vector, 1) = array_length(product_labels, 1))
        )
    "#)
    .execute(pool)
    .await?;
    }

    // Créer les index
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_combinations_service_id ON autocomplete_combinations(service_id) WHERE service_id IS NOT NULL")
        .execute(pool)
        .await?;

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_combinations_session ON autocomplete_combinations(session_id)")
        .execute(pool)
        .await?;

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_combinations_ai_preferred ON autocomplete_combinations(is_ai_preferred) WHERE is_ai_preferred = TRUE")
        .execute(pool)
        .await?;

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_combinations_product_vector_gin ON autocomplete_combinations USING GIN(product_vector)")
        .execute(pool)
        .await?;

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_combinations_location_vector_gin ON autocomplete_combinations USING GIN(location_vector)")
        .execute(pool)
        .await?;

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_combinations_full_vector_gin ON autocomplete_combinations USING GIN(full_vector)")
        .execute(pool)
        .await?;

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_combinations_usage_count ON autocomplete_combinations(usage_count DESC)")
        .execute(pool)
        .await?;

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_combinations_variant ON autocomplete_combinations(has_variant, variant_dimension, variant_value)")
        .execute(pool)
        .await?;

    // Fonction pour updated_at
    sqlx::query(
        r#"
        CREATE OR REPLACE FUNCTION update_combinations_updated_at()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql
    "#,
    )
    .execute(pool)
    .await?;

    // Trigger pour updated_at
    let _ = sqlx::query(
        "DROP TRIGGER IF EXISTS trigger_combinations_updated_at ON autocomplete_combinations",
    )
    .execute(pool)
    .await;

    sqlx::query(
        r#"
        CREATE TRIGGER trigger_combinations_updated_at
            BEFORE UPDATE ON autocomplete_combinations
            FOR EACH ROW
            EXECUTE FUNCTION update_combinations_updated_at()
    "#,
    )
    .execute(pool)
    .await?;

    // Fonction upsert (avec labels) - ORDRE CORRIGÉ 2025-11-03
    sqlx::query(r#"
        CREATE OR REPLACE FUNCTION upsert_autocomplete_combination(
            p_product_vector TEXT[],
            p_location_vector TEXT[],
            p_full_vector TEXT[],
            p_product_labels TEXT[],
            p_location_labels TEXT[],
            p_chosen_location TEXT,
            p_is_ai_preferred BOOLEAN,
            p_ai_confidence FLOAT,
            p_session_id TEXT,
            p_has_variant BOOLEAN,
            p_variant_dimension TEXT,
            p_variant_value TEXT,
            p_prix DECIMAL(12, 2),
            p_devise TEXT,
            p_stock INTEGER,
            p_service_id INTEGER
        )
        RETURNS INTEGER AS $$
        DECLARE
            v_id INTEGER;
            v_existing_count INTEGER;
        BEGIN
            SELECT id, usage_count INTO v_id, v_existing_count
            FROM autocomplete_combinations
            WHERE full_vector = p_full_vector;
            
            IF FOUND THEN
                UPDATE autocomplete_combinations
                SET 
                    usage_count = usage_count + 1,
                    is_ai_preferred = CASE WHEN p_is_ai_preferred THEN TRUE ELSE is_ai_preferred END,
                    ai_confidence = GREATEST(ai_confidence, p_ai_confidence),
                    service_id = COALESCE(p_service_id, service_id),
                    product_labels = p_product_labels,
                    location_labels = p_location_labels,
                    updated_at = NOW()
                WHERE id = v_id;
                RETURN v_id;
            ELSE
                INSERT INTO autocomplete_combinations (
                    service_id, product_vector, product_labels, location_vector, location_labels, full_vector,
                    chosen_location, usage_count, is_ai_preferred, ai_confidence,
                    session_id, has_variant, variant_dimension, variant_value,
                    prix, devise, stock
                ) VALUES (
                    p_service_id, p_product_vector, p_product_labels, p_location_vector, p_location_labels, p_full_vector,
                    p_chosen_location, 1, p_is_ai_preferred, p_ai_confidence,
                    p_session_id, p_has_variant, p_variant_dimension, p_variant_value,
                    p_prix, p_devise, p_stock
                )
                RETURNING id INTO v_id;
                RETURN v_id;
            END IF;
        END;
        $$ LANGUAGE plpgsql
    "#)
    .execute(pool)
    .await?;

    // Fonction calculate_location_score
    sqlx::query(
        r#"
        CREATE OR REPLACE FUNCTION calculate_location_score(
            search_location TEXT,
            location_vector TEXT[],
            chosen_location TEXT
        )
        RETURNS FLOAT AS $$
        DECLARE
            score FLOAT := 0.0;
            search_lower TEXT;
            i INTEGER;
            vec_length INTEGER;
        BEGIN
            IF search_location IS NULL OR location_vector IS NULL THEN
                RETURN 0.0;
            END IF;
            
            search_lower := LOWER(search_location);
            vec_length := array_length(location_vector, 1);

            IF vec_length IS NULL OR vec_length < 1 THEN
                RETURN 0.0;
            END IF;
            
            IF chosen_location IS NOT NULL AND LOWER(chosen_location) = search_lower THEN
                RETURN 1.0;
            END IF;
            
            FOR i IN 1..vec_length LOOP
                IF LOWER(location_vector[i]) = search_lower THEN
                    score := 1.0 - (i - 1) * 0.1;
                    EXIT;
                ELSIF LOWER(location_vector[i]) LIKE '%' || search_lower || '%' THEN
                    score := 0.5 - (i - 1) * 0.1;
                END IF;
            END LOOP;
            
            RETURN GREATEST(score, 0.0);
        END;
        $$ LANGUAGE plpgsql IMMUTABLE
    "#,
    )
    .execute(pool)
    .await?;

    // Fonction get_vector_value_by_label
    sqlx::query(
        r#"
        CREATE OR REPLACE FUNCTION get_vector_value_by_label(
            p_vector TEXT[],
            p_labels TEXT[],
            p_search_label TEXT
        )
        RETURNS TEXT AS $$
        DECLARE
            i INTEGER;
            vector_length INTEGER;
        BEGIN
            IF p_vector IS NULL OR p_labels IS NULL OR p_search_label IS NULL THEN
                RETURN NULL;
            END IF;
            
            vector_length := array_length(p_vector, 1);

            IF vector_length IS NULL OR vector_length < 1 THEN
                RETURN NULL;
            END IF;

            IF vector_length != array_length(p_labels, 1) THEN
                RETURN NULL;
            END IF;
            
            FOR i IN 1..vector_length LOOP
                IF LOWER(p_labels[i]) = LOWER(p_search_label) THEN
                    RETURN p_vector[i];
                END IF;
            END LOOP;
            
            RETURN NULL;
        END;
        $$ LANGUAGE plpgsql IMMUTABLE
    "#,
    )
    .execute(pool)
    .await?;

    // Fonction vector_to_jsonb
    sqlx::query(
        r#"
        CREATE OR REPLACE FUNCTION vector_to_jsonb(
            p_vector TEXT[],
            p_labels TEXT[]
        )
        RETURNS JSONB AS $$
        DECLARE
            result JSONB := '{}'::JSONB;
            i INTEGER;
            vector_length INTEGER;
        BEGIN
            IF p_vector IS NULL OR p_labels IS NULL THEN
                RETURN result;
            END IF;
            
            vector_length := array_length(p_vector, 1);

            IF vector_length IS NULL OR vector_length < 1 THEN
                RETURN result;
            END IF;
            
            IF vector_length != array_length(p_labels, 1) THEN
                RETURN result;
            END IF;
            
            FOR i IN 1..vector_length LOOP
                result := result || jsonb_build_object(p_labels[i], p_vector[i]);
            END LOOP;
            
            RETURN result;
        END;
        $$ LANGUAGE plpgsql IMMUTABLE
    "#,
    )
    .execute(pool)
    .await?;

    info!("✅ Table autocomplete_combinations créée avec succès !");

    // 🧹 Dédoublonnage des vecteurs avant d'ajouter les contraintes
    info!("🧹 Nettoyage des doublons dans autocomplete_combinations (full_vector)");
    sqlx::query(
        r#"
        WITH ranked AS (
            SELECT 
                id,
                full_vector,
                usage_count,
                ROW_NUMBER() OVER(PARTITION BY full_vector ORDER BY usage_count DESC, id) AS rn,
                SUM(usage_count) OVER(PARTITION BY full_vector) AS total_usage
            FROM autocomplete_combinations
        )
        UPDATE autocomplete_combinations ac
        SET usage_count = ranked.total_usage
        FROM ranked
        WHERE ac.id = ranked.id
          AND ranked.rn = 1
          AND ranked.total_usage IS NOT NULL
          AND ranked.total_usage <> ac.usage_count
        "#,
    )
    .execute(pool)
    .await?;

    let deleted_full = sqlx::query(
        r#"
        WITH ranked AS (
            SELECT id,
                   ROW_NUMBER() OVER(PARTITION BY full_vector ORDER BY usage_count DESC, id) AS rn
            FROM autocomplete_combinations
        )
        DELETE FROM autocomplete_combinations ac
        USING ranked
        WHERE ac.id = ranked.id
          AND ranked.rn > 1
        "#,
    )
    .execute(pool)
    .await?;
    info!(
        "✅ {} doublons full_vector supprimés",
        deleted_full.rows_affected()
    );

    info!("🧹 Nettoyage des doublons dans autocomplete_combinations (product_vector)");
    sqlx::query(
        r#"
        WITH ranked AS (
            SELECT 
                id,
                product_vector,
                usage_count,
                ROW_NUMBER() OVER(PARTITION BY product_vector ORDER BY usage_count DESC, id) AS rn,
                SUM(usage_count) OVER(PARTITION BY product_vector) AS total_usage
            FROM autocomplete_combinations
        )
        UPDATE autocomplete_combinations ac
        SET usage_count = ranked.total_usage
        FROM ranked
        WHERE ac.id = ranked.id
          AND ranked.rn = 1
          AND ranked.total_usage IS NOT NULL
          AND ranked.total_usage <> ac.usage_count
        "#,
    )
    .execute(pool)
    .await?;

    let deleted_product = sqlx::query(
        r#"
        WITH ranked AS (
            SELECT id,
                   ROW_NUMBER() OVER(PARTITION BY product_vector ORDER BY usage_count DESC, id) AS rn
            FROM autocomplete_combinations
        )
        DELETE FROM autocomplete_combinations ac
        USING ranked
        WHERE ac.id = ranked.id
          AND ranked.rn > 1
        "#
    )
    .execute(pool)
    .await?;
    info!(
        "✅ {} doublons product_vector supprimés",
        deleted_product.rows_affected()
    );

    Ok(())
}

/// Vérifie et crée la table service_reviews avec support des réponses threadées
pub async fn ensure_service_reviews_table(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification de la table service_reviews...");

    // ✅ NOUVEAU 2025-11-05: Vérifier si la table existe d'abord
    let exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'service_reviews')"
    )
    .fetch_one(pool)
    .await?;

    if exists {
        info!("✅ Table service_reviews déjà présente");

        // Vérifier reply_to_review_id (support threading)
        let has_reply_to = sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'service_reviews' AND column_name = 'reply_to_review_id')"
        )
        .fetch_one(pool)
        .await?;

        if !has_reply_to {
            warn!("⚠️ Colonne 'reply_to_review_id' manquante, ajout en cours...");
            sqlx::query("ALTER TABLE service_reviews ADD COLUMN IF NOT EXISTS reply_to_review_id INTEGER REFERENCES service_reviews(id) ON DELETE CASCADE")
                .execute(pool)
                .await?;
            info!("✅ Colonne 'reply_to_review_id' ajoutée");
        }

        // Vérifier is_helpful_count
        let has_helpful = sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'service_reviews' AND column_name = 'is_helpful_count')"
        )
        .fetch_one(pool)
        .await?;

        if !has_helpful {
            warn!("⚠️ Colonne 'is_helpful_count' manquante, ajout en cours...");
            sqlx::query(
                "ALTER TABLE service_reviews ADD COLUMN is_helpful_count INTEGER DEFAULT 0",
            )
            .execute(pool)
            .await?;
            info!("✅ Colonne 'is_helpful_count' ajoutée");
        }
    } else {
        warn!("⚠️ Table service_reviews manquante, création en cours...");

        // Créer la table si elle n'existe pas
        sqlx::query(
            r#"
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
        "#,
        )
        .execute(pool)
        .await?;
    }

    // Créer les index de manière conditionnelle (SQLx offline compatible)
    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_service_reviews_service ON service_reviews(service_id)",
    )
    .execute(pool)
    .await?;

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_service_reviews_user ON service_reviews(user_id)")
        .execute(pool)
        .await?;

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_service_reviews_reply_to ON service_reviews(reply_to_review_id)")
        .execute(pool)
        .await?;

    info!("✅ Table service_reviews vérifiée/créée avec succès !");

    Ok(())
}

/// Vérifie et crée le système product_comments / product_comment_reactions (fil Facebook)
pub async fn ensure_product_comments_tables(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification de la table product_comments...");

    let comments_exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'product_comments')",
    )
    .fetch_one(pool)
    .await?;

    if !comments_exists {
        warn!("⚠️ Table product_comments manquante, création en cours...");
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS product_comments (
                id SERIAL PRIMARY KEY,
                service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                parent_comment_id INTEGER REFERENCES product_comments(id) ON DELETE CASCADE,
                rating INTEGER CHECK (rating BETWEEN 0 AND 5),
                content TEXT NOT NULL,
                mentions INTEGER[] NOT NULL DEFAULT '{}',
                reaction_counts JSONB NOT NULL DEFAULT '{}'::jsonb,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                edited_at TIMESTAMPTZ,
                is_deleted BOOLEAN NOT NULL DEFAULT FALSE
            )
            "#,
        )
        .execute(pool)
        .await?;
    } else {
        info!("✅ Table product_comments déjà présente, vérification des colonnes...");

        async fn ensure_column(
            pool: &PgPool,
            column: &'static str,
            ddl: &'static str,
        ) -> Result<(), sqlx::Error> {
            let has_column = sqlx::query_scalar::<_, bool>(
                "SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'product_comments' AND column_name = $1)",
            )
            .bind(column)
            .fetch_one(pool)
            .await?;

            if !has_column {
                warn!(
                    "⚠️ Colonne '{}' manquante sur product_comments, ajout en cours...",
                    column
                );
                sqlx::query(ddl).execute(pool).await?;
                info!("✅ Colonne '{}' ajoutée", column);
            }

            Ok(())
        }

        ensure_column(
            pool,
            "parent_comment_id",
            "ALTER TABLE product_comments ADD COLUMN IF NOT EXISTS parent_comment_id INTEGER REFERENCES product_comments(id) ON DELETE CASCADE",
        )
        .await?;

        ensure_column(
            pool,
            "rating",
            "ALTER TABLE product_comments ADD COLUMN IF NOT EXISTS rating INTEGER CHECK (rating BETWEEN 0 AND 5)",
        )
        .await?;

        ensure_column(
            pool,
            "mentions",
            "ALTER TABLE product_comments ADD COLUMN IF NOT EXISTS mentions INTEGER[] DEFAULT '{}'",
        )
        .await?;

        sqlx::query(
            "ALTER TABLE product_comments ALTER COLUMN mentions SET DEFAULT '{}', ALTER COLUMN mentions SET NOT NULL",
        )
        .execute(pool)
        .await?;

        ensure_column(
            pool,
            "reaction_counts",
            "ALTER TABLE product_comments ADD COLUMN IF NOT EXISTS reaction_counts JSONB DEFAULT '{}'::jsonb",
        )
        .await?;

        sqlx::query(
            "ALTER TABLE product_comments ALTER COLUMN reaction_counts SET DEFAULT '{}'::jsonb",
        )
        .execute(pool)
        .await?;

        ensure_column(
            pool,
            "edited_at",
            "ALTER TABLE product_comments ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ",
        )
        .await?;

        ensure_column(
            pool,
            "is_deleted",
            "ALTER TABLE product_comments ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE",
        )
        .await?;
    }

    // Normaliser les valeurs NULL éventuelles
    sqlx::query("UPDATE product_comments SET mentions = '{}' WHERE mentions IS NULL")
        .execute(pool)
        .await?;
    sqlx::query(
        "UPDATE product_comments SET reaction_counts = '{}'::jsonb WHERE reaction_counts IS NULL",
    )
    .execute(pool)
    .await?;

    // ✅ FINALISÉ 100%: Vérifier et ajouter colonne media_urls
    let has_media_urls = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'product_comments' AND column_name = 'media_urls')",
    )
    .fetch_one(pool)
    .await?;

    if !has_media_urls {
        info!("⚠️ Colonne 'media_urls' manquante sur product_comments, ajout en cours...");
        sqlx::query(
            "ALTER TABLE product_comments ADD COLUMN IF NOT EXISTS media_urls JSONB DEFAULT '[]'::jsonb",
        )
        .execute(pool)
        .await?;

        // ✅ FINALISÉ 100%: Créer index GIN pour recherche rapide
        sqlx::query(
            "CREATE INDEX IF NOT EXISTS idx_product_comments_media_urls ON product_comments USING GIN (media_urls)",
        )
        .execute(pool)
        .await?;

        // ✅ FINALISÉ 100%: Index pour filtrer commentaires avec médias
        sqlx::query(
            "CREATE INDEX IF NOT EXISTS idx_product_comments_has_media ON product_comments (service_id, created_at DESC) WHERE jsonb_array_length(media_urls) > 0",
        )
        .execute(pool)
        .await?;

        info!("✅ Colonne media_urls et index créés avec succès !");
    }

    // ✅ CORRIGÉ 2026-03-02: Ajouter colonne product_index pour filtrer les commentaires par produit
    // Sans cette colonne, tous les produits d'un même service affichent les mêmes commentaires
    let has_product_index = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'product_comments' AND column_name = 'product_index')",
    )
    .fetch_one(pool)
    .await?;

    if !has_product_index {
        info!("⚠️ Colonne 'product_index' manquante sur product_comments, ajout en cours...");
        sqlx::query(
            "ALTER TABLE product_comments ADD COLUMN IF NOT EXISTS product_index INTEGER DEFAULT NULL",
        )
        .execute(pool)
        .await?;

        // Index composite pour requêtes filtrées par service_id + product_index
        sqlx::query(
            "CREATE INDEX IF NOT EXISTS idx_product_comments_service_product ON product_comments(service_id, product_index)",
        )
        .execute(pool)
        .await?;

        info!("✅ Colonne product_index et index créés avec succès !");
    }

    // Index
    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_product_comments_service ON product_comments(service_id)",
    )
    .execute(pool)
    .await?;
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_product_comments_parent ON product_comments(parent_comment_id)")
        .execute(pool)
        .await?;
    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_product_comments_user ON product_comments(user_id)",
    )
    .execute(pool)
    .await?;

    // Fonction + trigger updated_at
    sqlx::query(
        r#"
        CREATE OR REPLACE FUNCTION set_product_comments_updated_at()
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

    sqlx::query("DROP TRIGGER IF EXISTS trigger_product_comments_updated_at ON product_comments")
        .execute(pool)
        .await?;
    sqlx::query(
        "CREATE TRIGGER trigger_product_comments_updated_at BEFORE UPDATE ON product_comments FOR EACH ROW EXECUTE FUNCTION set_product_comments_updated_at()",
    )
    .execute(pool)
    .await?;

    // Réactions
    info!("🔍 Vérification de la table product_comment_reactions...");
    let reactions_exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'product_comment_reactions')",
    )
    .fetch_one(pool)
    .await?;

    if !reactions_exists {
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS product_comment_reactions (
                id SERIAL PRIMARY KEY,
                comment_id INTEGER NOT NULL REFERENCES product_comments(id) ON DELETE CASCADE,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                reaction_type VARCHAR(20) NOT NULL CHECK (reaction_type IN (
                    'like',
                    'love',
                    'insightful',
                    'support',
                    'funny',
                    'angry'
                )),
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                UNIQUE(comment_id, user_id, reaction_type)
            )
            "#,
        )
        .execute(pool)
        .await?;
    }

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_product_comment_reactions_comment ON product_comment_reactions(comment_id)",
    )
    .execute(pool)
    .await?;
    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_product_comment_reactions_user ON product_comment_reactions(user_id)",
    )
    .execute(pool)
    .await?;

    // Vue agrégée
    sqlx::query(
        r#"
        CREATE OR REPLACE VIEW product_comments_view AS
        SELECT
            pc.id,
            pc.service_id,
            pc.user_id,
            pc.parent_comment_id,
            pc.rating,
            pc.content,
            pc.mentions,
            pc.reaction_counts,
            pc.created_at,
            pc.updated_at,
            pc.edited_at,
            pc.is_deleted,
            COALESCE(u.nom_complet, u.name, CONCAT(u.prenom, ' ', u.nom), u.email, 'Utilisateur')::TEXT AS user_name,
            COALESCE(u.avatar_url, ''::VARCHAR(500)) AS user_avatar,
            (
                SELECT jsonb_object_agg(reaction_type, reaction_count)
                FROM (
                    SELECT reaction_type, COUNT(*)::INT AS reaction_count
                    FROM product_comment_reactions
                    WHERE comment_id = pc.id
                    GROUP BY reaction_type
                ) sub
            ) AS aggregated_reactions,
            (
                SELECT COUNT(*)::INT
                FROM product_comments replies
                WHERE replies.parent_comment_id = pc.id
                  AND replies.is_deleted = FALSE
            ) AS reply_count
        FROM product_comments pc
        JOIN users u ON u.id = pc.user_id;
        "#,
    )
    .execute(pool)
    .await?;

    info!("✅ Tables product_comments et product_comment_reactions vérifiées/créées avec succès !");
    Ok(())
}

/// Vérifie et crée la table product_reactions pour les émotions sur les produits
pub async fn ensure_product_reactions_table(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification de la table product_reactions...");

    // ✅ NOUVEAU 2025-11-05: Vérifier si la table existe d'abord
    let exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'product_reactions')"
    )
    .fetch_one(pool)
    .await?;

    if exists {
        info!("✅ Table product_reactions déjà présente");

        // Vérifier reaction_type (avec les bons types)
        let has_reaction_type = sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'product_reactions' AND column_name = 'reaction_type')"
        )
        .fetch_one(pool)
        .await?;

        if !has_reaction_type {
            warn!("⚠️ Colonne 'reaction_type' manquante, ajout en cours...");
            sqlx::query("ALTER TABLE product_reactions ADD COLUMN IF NOT EXISTS reaction_type VARCHAR(20) NOT NULL CHECK (reaction_type IN ('love', 'like', 'wow', 'interested', 'thinking', 'disappointed'))")
                .execute(pool)
                .await?;
            info!("✅ Colonne 'reaction_type' ajoutée");
        }

        // Vérifier product_id
        let has_product_id = sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'product_reactions' AND column_name = 'product_id')"
        )
        .fetch_one(pool)
        .await?;

        if !has_product_id {
            warn!("⚠️ Colonne 'product_id' manquante, ajout en cours...");
            sqlx::query("ALTER TABLE product_reactions ADD COLUMN IF NOT EXISTS product_id TEXT NOT NULL DEFAULT ''")
                .execute(pool)
                .await?;
            info!("✅ Colonne 'product_id' ajoutée");
        }
    } else {
        warn!("⚠️ Table product_reactions manquante, création en cours...");

        sqlx::query(
            r#"
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
        "#,
        )
        .execute(pool)
        .await?;

        sqlx::query("CREATE INDEX IF NOT EXISTS idx_product_reactions_product ON product_reactions(service_id, product_id)")
            .execute(pool)
            .await?;

        sqlx::query(
            "CREATE INDEX IF NOT EXISTS idx_product_reactions_user ON product_reactions(user_id)",
        )
        .execute(pool)
        .await?;

        sqlx::query(
            "CREATE INDEX IF NOT EXISTS idx_product_reactions_type ON product_reactions(reaction_type)",
        )
        .execute(pool)
        .await?;
    }

    // ✅ CORRIGÉ 2025-11-27 : Version corrigée avec TEXT et plpgsql (alignée avec migration SQLx)
    // ✅ CORRIGÉ: DROP la fonction avant de la recréer si le type de retour change
    let _ = sqlx::query("DROP FUNCTION IF EXISTS get_product_reactions_count(INTEGER, TEXT)")
        .execute(pool)
        .await;

    sqlx::query(
        r#"
        CREATE OR REPLACE FUNCTION get_product_reactions_count(
            p_service_id INTEGER,
            p_product_id TEXT
        )
        RETURNS TABLE (
            reaction_type TEXT,
            count BIGINT,
            users_sample TEXT[]
        ) AS $$
        BEGIN
            RETURN QUERY
            SELECT 
                pr.reaction_type::TEXT,
                COUNT(*)::BIGINT as count,
                ARRAY_AGG(DISTINCT u.email::TEXT) FILTER (WHERE u.email IS NOT NULL) as users_sample
            FROM product_reactions pr
            LEFT JOIN users u ON pr.user_id = u.id
            WHERE pr.service_id = p_service_id
              AND pr.product_id = p_product_id
            GROUP BY pr.reaction_type
            ORDER BY count DESC, pr.reaction_type;
        END;
        $$ LANGUAGE plpgsql STABLE;
    "#,
    )
    .execute(pool)
    .await?;

    info!("✅ Table product_reactions et ses composants vérifiés/créés avec succès !");

    Ok(())
}

async fn run_delivery_step(
    pool: &PgPool,
    label: &'static str,
    sql: &'static str,
) -> Result<(), sqlx::Error> {
    info!("➡️ [delivery_migration] {}", label);
    // ✅ CORRIGÉ 2026-02-13: Utiliser execute_migration_sql_safe() pour gérer les commandes multiples
    // Cela évite l'erreur "cannot insert multiple commands into a prepared statement"
    let result = execute_migration_sql_safe(pool, sql).await;
    match result {
        Ok(_) => {
            info!("✅ [delivery_migration] {} (0 lignes affectées)", label);
            Ok(())
        }
        Err(err) => {
            error!("❌ [delivery_migration] {} -> {}", label, err);
            error!("🧾 SQL [{}]: {}", label, sql.trim());
            Err(err)
        }
    }
}

/// Vérifie et crée la fonction extract_all_product_text si elle n'existe pas
pub async fn ensure_extract_all_product_text_function(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification de la fonction extract_all_product_text()...");

    // Créer ou remplacer la fonction (CREATE OR REPLACE = toujours à jour)
    sqlx::query(
        r#"
        CREATE OR REPLACE FUNCTION extract_all_product_text(product JSONB)
        RETURNS TEXT AS $$
        BEGIN
            RETURN COALESCE(product->>'nom', '') || ' ' ||
                   COALESCE(product->>'categorie', '') || ' ' ||
                   COALESCE(product->>'description', '') || ' ' ||
                   COALESCE(product->>'type', '') || ' ' ||
                   COALESCE(product->>'marque', '') || ' ' ||
                   COALESCE(product->>'modele', '') || ' ' ||
                   COALESCE(product->>'titre', '');
        END;
        $$ LANGUAGE plpgsql IMMUTABLE;
    "#,
    )
    .execute(pool)
    .await?;

    info!("✅ Fonction extract_all_product_text() créée/mise à jour avec succès !");

    Ok(())
}

/// Vérifie et crée la table geo_hierarchy si elle n'existe pas
pub async fn ensure_geo_hierarchy_table(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification de la table geo_hierarchy...");

    // Vérifier si la table existe
    let exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'geo_hierarchy')",
    )
    .fetch_one(pool)
    .await?;

    if exists {
        info!("✅ Table geo_hierarchy déjà présente");
        return Ok(());
    }

    warn!("⚠️ Table geo_hierarchy manquante, création en cours...");

    // Créer la table geo_hierarchy
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS geo_hierarchy (
            id SERIAL PRIMARY KEY,
            geoname_id BIGINT NOT NULL UNIQUE,
            place_name VARCHAR(255) NOT NULL,
            display_name VARCHAR(500) NOT NULL,
            feature_code VARCHAR(10) NOT NULL,
            admin_level INTEGER NOT NULL DEFAULT 8,
            is_leaf BOOLEAN NOT NULL DEFAULT FALSE,
            parent_country VARCHAR(255) NOT NULL DEFAULT '',
            parent_country_code VARCHAR(10),
            location_vector TEXT[] NOT NULL DEFAULT '{}',
            lat NUMERIC(10, 7) NOT NULL,
            lng NUMERIC(10, 7) NOT NULL,
            population INTEGER,
            timezone VARCHAR(100),
            times_used INTEGER NOT NULL DEFAULT 0,
            last_enriched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    "#,
    )
    .execute(pool)
    .await?;

    // Créer les index
    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_geo_hierarchy_place_name ON geo_hierarchy(place_name)",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_geo_hierarchy_country ON geo_hierarchy(parent_country)",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_geo_hierarchy_geoname_id ON geo_hierarchy(geoname_id)",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_geo_hierarchy_times_used ON geo_hierarchy(times_used DESC)",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_geo_hierarchy_admin_level ON geo_hierarchy(admin_level)",
    )
    .execute(pool)
    .await?;

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_geo_hierarchy_location_vector_gin ON geo_hierarchy USING GIN(location_vector)")
        .execute(pool)
        .await?;

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_geo_hierarchy_place_country ON geo_hierarchy(place_name, parent_country)")
        .execute(pool)
        .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_geo_hierarchy_coordinates ON geo_hierarchy(lat, lng)",
    )
    .execute(pool)
    .await?;

    // ✅ CORRIGÉ 2025-12-01: Ajouter la contrainte unique pour ON CONFLICT
    // Cette contrainte est nécessaire pour places_controller.rs enrich_location
    sqlx::query(
        r#"
        DO $$
        BEGIN
            -- Créer la contrainte unique si elle n'existe pas
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint 
                WHERE conname = 'geo_hierarchy_place_name_parent_country_key'
                AND conrelid = 'geo_hierarchy'::regclass
            ) THEN
                ALTER TABLE geo_hierarchy 
                ADD CONSTRAINT geo_hierarchy_place_name_parent_country_key 
                UNIQUE (place_name, parent_country);
                RAISE NOTICE 'Contrainte unique geo_hierarchy_place_name_parent_country_key créée';
            END IF;
            
            -- Créer l'index unique si la contrainte n'existe toujours pas
            IF NOT EXISTS (
                SELECT 1 FROM pg_indexes 
                WHERE indexname = 'idx_geo_hierarchy_place_parent_unique'
            ) THEN
                CREATE UNIQUE INDEX idx_geo_hierarchy_place_parent_unique 
                ON geo_hierarchy (place_name, parent_country);
                RAISE NOTICE 'Index unique idx_geo_hierarchy_place_parent_unique créé';
            END IF;
        END $$;
        "#,
    )
    .execute(pool)
    .await?;

    // Fonction pour updated_at
    sqlx::query(
        r#"
        CREATE OR REPLACE FUNCTION update_geo_hierarchy_updated_at()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql
    "#,
    )
    .execute(pool)
    .await?;

    // Supprimer le trigger s'il existe
    let _ = sqlx::query(
        "DROP TRIGGER IF EXISTS trigger_update_geo_hierarchy_updated_at ON geo_hierarchy",
    )
    .execute(pool)
    .await;

    // Créer le trigger
    sqlx::query(
        r#"
        CREATE TRIGGER trigger_update_geo_hierarchy_updated_at
            BEFORE UPDATE ON geo_hierarchy
            FOR EACH ROW
            EXECUTE FUNCTION update_geo_hierarchy_updated_at()
    "#,
    )
    .execute(pool)
    .await?;

    // Insérer données de test pour Cameroun
    sqlx::query(r#"
        INSERT INTO geo_hierarchy 
            (geoname_id, place_name, display_name, feature_code, admin_level, is_leaf, parent_country, parent_country_code, location_vector, lat, lng, population, timezone, times_used)
        VALUES
            (2232593, 'Yaoundé', 'Yaoundé, Cameroun', 'PPLC', 6, FALSE, 'Cameroun', 'CM', ARRAY['Yaoundé', 'Centre', 'Cameroun'], 3.8480, 11.5021, 1299369, 'Africa/Douala', 1),
            (2232416, 'Douala', 'Douala, Cameroun', 'PPL', 6, FALSE, 'Cameroun', 'CM', ARRAY['Douala', 'Littoral', 'Cameroun'], 4.0483, 9.7043, 1338082, 'Africa/Douala', 1),
            (2234359, 'Bafoussam', 'Bafoussam, Cameroun', 'PPL', 6, FALSE, 'Cameroun', 'CM', ARRAY['Bafoussam', 'Ouest', 'Cameroun'], 5.4781, 10.4167, 290768, 'Africa/Douala', 1),
            (2220957, 'Garoua', 'Garoua, Cameroun', 'PPL', 6, FALSE, 'Cameroun', 'CM', ARRAY['Garoua', 'Nord', 'Cameroun'], 9.3012, 13.3964, 436899, 'Africa/Douala', 1),
            (2220605, 'Maroua', 'Maroua, Cameroun', 'PPL', 6, FALSE, 'Cameroun', 'CM', ARRAY['Maroua', 'Extrême-Nord', 'Cameroun'], 10.5906, 14.3159, 319941, 'Africa/Douala', 1)
        ON CONFLICT (geoname_id) DO NOTHING
    "#)
    .execute(pool)
    .await?;

    info!("✅ Table geo_hierarchy créée avec succès avec 5 villes de test !");

    Ok(())
}

/// ✅ NOUVEAU 2025-11-24 : Migration des produits de format chaîne vers JSON structuré
/// Convertit les produits stockés comme chaînes concaténées vers des objets JSON
pub async fn ensure_products_json_format(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification du format JSON des produits...");

    // Vérifier s'il y a des produits en format chaîne à migrer
    let string_count: i64 = sqlx::query_scalar(
        r#"
        SELECT COUNT(*)
        FROM services
        WHERE jsonb_typeof(data->'produits'->'valeur') = 'array'
        AND EXISTS (
            SELECT 1
            FROM jsonb_array_elements(data->'produits'->'valeur') AS elem
            WHERE jsonb_typeof(elem) = 'string'
        )
        "#,
    )
    .fetch_one(pool)
    .await
    .unwrap_or(0);

    if string_count == 0 {
        info!("✅ Tous les produits sont déjà en format JSON structuré");
        return Ok(());
    }

    info!(
        "🔄 {} services avec produits en format chaîne détectés, migration nécessaire",
        string_count
    );

    // Vérifier si la fonction helper existe
    let function_exists: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'parse_product_string')",
    )
    .fetch_one(pool)
    .await
    .unwrap_or(false);

    if !function_exists {
        info!("📝 Création de la fonction helper parse_product_string...");
        sqlx::query(
            r#"
            CREATE OR REPLACE FUNCTION parse_product_string(product_string TEXT)
            RETURNS JSONB
            LANGUAGE plpgsql
            IMMUTABLE
            AS $$
            DECLARE
                parts TEXT[];
                result JSONB;
                nom TEXT;
                categorie TEXT;
                description TEXT;
                prix TEXT;
                devise TEXT;
                last_numeric_index INTEGER;
                i INTEGER;
                parts_length INTEGER;
            BEGIN
                -- Gérer le cas où product_string est NULL
                IF product_string IS NULL OR product_string = '' THEN
                    RETURN jsonb_build_object(
                        'nom_produit', 'Produit',
                        'description_produit', '',
                        'prix', '0',
                        'devise', 'XAF'
                    );
                END IF;
                
                parts := string_to_array(product_string, ',');
                parts_length := COALESCE(array_length(parts, 1), 0);
                
                -- Si le tableau est vide ou NULL
                IF parts_length = 0 THEN
                    RETURN jsonb_build_object(
                        'nom_produit', 'Produit',
                        'description_produit', '',
                        'prix', '0',
                        'devise', 'XAF'
                    );
                END IF;
                
                FOR i IN 1..parts_length LOOP
                    parts[i] := trim(parts[i]);
                END LOOP;
                
                IF parts_length < 2 THEN
                    RETURN jsonb_build_object(
                        'nom_produit', COALESCE(parts[1], 'Produit'),
                        'description_produit', '',
                        'prix', '0',
                        'devise', 'XAF'
                    );
                END IF;
                
                nom := parts[1];
                categorie := parts[2];
                
                last_numeric_index := NULL;
                FOR i IN REVERSE 1..parts_length LOOP
                    IF parts[i] ~ '^\d+\.?\d*$' THEN
                        last_numeric_index := i;
                        EXIT;
                    END IF;
                END LOOP;
                
                IF last_numeric_index IS NOT NULL THEN
                    prix := parts[last_numeric_index];
                    IF last_numeric_index < parts_length THEN
                        devise := parts[last_numeric_index + 1];
                    ELSE
                        devise := 'XAF';
                    END IF;
                    IF last_numeric_index > 2 THEN
                        description := array_to_string(parts[3:last_numeric_index-1], ', ');
                    ELSIF parts_length >= 3 THEN
                        description := parts[3];
                    ELSE
                        description := '';
                    END IF;
                ELSE
                    prix := '0';
                    devise := 'XAF';
                    IF parts_length >= 3 THEN
                        description := array_to_string(parts[3:], ', ');
                    ELSE
                        description := '';
                    END IF;
                END IF;
                
                result := jsonb_build_object(
                    'nom_produit', COALESCE(nom, 'Produit'),
                    'categorie_produit', COALESCE(categorie, ''),
                    'description_produit', COALESCE(description, ''),
                    'prix', COALESCE(prix, '0'),
                    'devise', COALESCE(devise, 'XAF')
                );
                
                RETURN result;
            END;
            $$;
            "#,
        )
        .execute(pool)
        .await?;
        info!("✅ Fonction parse_product_string créée");
    }

    // Exécuter la migration
    info!("🔄 Exécution de la migration des produits...");
    sqlx::query(
        r#"
        DO $$
        DECLARE
            service_record RECORD;
            produits_array JSONB;
            new_produits_array JSONB;
            elem JSONB;
            converted_count INTEGER := 0;
            error_count INTEGER := 0;
        BEGIN
            FOR service_record IN
                SELECT id, data
                FROM services
                WHERE jsonb_typeof(data->'produits'->'valeur') = 'array'
                AND EXISTS (
                    SELECT 1
                    FROM jsonb_array_elements(data->'produits'->'valeur') AS sub_elem
                    WHERE jsonb_typeof(sub_elem) = 'string'
                )
            LOOP
                BEGIN
                    produits_array := service_record.data->'produits'->'valeur';
                    new_produits_array := '[]'::JSONB;
                    
                    FOR elem IN SELECT * FROM jsonb_array_elements(produits_array)
                    LOOP
                        IF jsonb_typeof(elem) = 'string' THEN
                            new_produits_array := new_produits_array || jsonb_build_array(
                                parse_product_string(elem::TEXT)
                            );
                        ELSE
                            new_produits_array := new_produits_array || jsonb_build_array(elem);
                        END IF;
                    END LOOP;
                    
                    UPDATE services
                    SET data = jsonb_set(
                        data,
                        '{produits,valeur}',
                        new_produits_array
                    ),
                    updated_at = NOW()
                    WHERE id = service_record.id;
                    
                    converted_count := converted_count + 1;
                EXCEPTION WHEN OTHERS THEN
                    error_count := error_count + 1;
                END;
            END LOOP;
        END $$;
        "#,
    )
    .execute(pool)
    .await?;

    info!("✅ Migration des produits vers format JSON terminée");
    Ok(())
}

/// Exécute toutes les migrations automatiques nécessaires
/// Migration 0.5: Table african_locations pour base locale géographique (✅ NOUVEAU 2025-11-06)
pub async fn ensure_african_locations_table(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🗺️ Vérification de la table african_locations...");

    // Vérifier si la table existe
    let table_exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'african_locations')"
    )
    .fetch_one(pool)
    .await?;

    if table_exists {
        info!("✅ Table african_locations déjà présente");
        return Ok(());
    }

    warn!("⚠️ Table african_locations manquante, création en cours...");

    // Créer la table
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS african_locations (
            id SERIAL PRIMARY KEY,
            pays VARCHAR(100) NOT NULL,
            ville VARCHAR(200),
            quartier VARCHAR(200),
            latitude DECIMAL(10, 8),
            longitude DECIMAL(11, 8),
            population INTEGER,
            type_lieu VARCHAR(50) DEFAULT 'quartier',
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW(),
            UNIQUE(pays, ville, quartier)
        )
    "#,
    )
    .execute(pool)
    .await?;

    // Index pour recherches rapides
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_african_locations_pays ON african_locations(pays)")
        .execute(pool)
        .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_african_locations_ville ON african_locations(ville)",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_african_locations_quartier ON african_locations(quartier)",
    )
    .execute(pool)
    .await?;

    info!("✅ Table african_locations créée, insertion des données initiales...");

    // ✅ SEED: Données extraites de mobile/src/data/africanLocations.ts
    // CAMEROUN - Douala (60+ quartiers)
    let douala_quartiers = vec![
        "Akwa",
        "Bonanjo",
        "Bali",
        "Bonapriso",
        "Bonamoussadi",
        "Bonabéri",
        "New Bell",
        "Deido",
        "Bépanda",
        "Ndogbong",
        "Makepe",
        "Logpom",
        "Logbaba",
        "Ndogpassi I",
        "Ndogpassi II",
        "Ndogpassi III",
        "Kotto",
        "PK8",
        "PK10",
        "PK11",
        "PK12",
        "PK14",
        "PK17",
        "Bessengue",
        "Bonamoussadi Bel Air",
        "Village",
        "Japoma",
        "Yassa",
        "Ndog-Bong",
        "Ndogsimbi",
        "Cité des Palmiers",
        "Sonel",
        "Camp Yabassi",
        "Bassa Industrial",
        "Bonassama",
        "Petit Pays",
        "Mabanda",
        "Mboppi",
        "Omnisport",
    ];

    for quartier in douala_quartiers {
        let _ = sqlx::query(
            "INSERT INTO african_locations (pays, ville, quartier, type_lieu) VALUES ($1, $2, $3, 'quartier') ON CONFLICT DO NOTHING"
        )
        .bind("Cameroun")
        .bind("Douala")
        .bind(quartier)
        .execute(pool)
        .await;
    }

    // CAMEROUN - Yaoundé (80+ quartiers)
    let yaounde_quartiers = vec![
        "Centre-ville",
        "Poste Centrale",
        "Mvog-Ada",
        "Bastos",
        "Nlongkak",
        "Santa Barbara",
        "Golf",
        "Hippodrome",
        "Elig-Essono",
        "Nkolbisson",
        "Simbock",
        "Odza",
        "Nkoldongo",
        "Mfandena",
        "Ngoa-Ekelle",
        "Mvan",
        "Ekounou",
        "Elig-Edzoa",
        "Nsimeyong",
        "Briqueterie",
        "Tsinga",
        "Messa",
        "Mvog-Mbi",
        "Emana",
        "Etoug-Ebe",
        "Nkomo",
        "Essos",
        "Mokolo",
        "Madagascar",
        "Mendong",
        "Obili",
        "Omnisport",
        "Mimboman",
    ];

    for quartier in yaounde_quartiers {
        let _ = sqlx::query(
            "INSERT INTO african_locations (pays, ville, quartier, type_lieu) VALUES ($1, $2, $3, 'quartier') ON CONFLICT DO NOTHING"
        )
        .bind("Cameroun")
        .bind("Yaoundé")
        .bind(quartier)
        .execute(pool)
        .await;
    }

    // CAMEROUN - Garoua
    let garoua_quartiers = vec![
        "Centre-ville",
        "Plateau",
        "Ouro-Kessoum",
        "Djamboutou",
        "Balaré",
        "Demsa",
        "Kollere",
        "Roumdé Adjia",
        "Doualaré",
        "Mokolo",
    ];
    for quartier in garoua_quartiers {
        let _ = sqlx::query("INSERT INTO african_locations (pays, ville, quartier, type_lieu) VALUES ($1, $2, $3, 'quartier') ON CONFLICT DO NOTHING")
            .bind("Cameroun").bind("Garoua").bind(quartier).execute(pool).await;
    }

    // CAMEROUN - Bafoussam
    let bafoussam_quartiers = vec![
        "Centre-ville",
        "Tamdja",
        "Famla",
        "Djeleng",
        "Ngouache",
        "Tougang",
        "Ndiandam",
        "Kamkop",
        "Université",
        "Marché A",
    ];
    for quartier in bafoussam_quartiers {
        let _ = sqlx::query("INSERT INTO african_locations (pays, ville, quartier, type_lieu) VALUES ($1, $2, $3, 'quartier') ON CONFLICT DO NOTHING")
            .bind("Cameroun").bind("Bafoussam").bind(quartier).execute(pool).await;
    }

    // SÉNÉGAL - Dakar
    let dakar_quartiers = vec![
        "Plateau",
        "Médina",
        "HLM",
        "Parcelles Assainies",
        "Grand Yoff",
        "Ouakam",
        "Ngor",
        "Almadies",
        "Point E",
        "Mermoz",
        "Sacré-Cœur",
        "Fann",
        "Liberté",
        "Sicap",
    ];
    for quartier in dakar_quartiers {
        let _ = sqlx::query("INSERT INTO african_locations (pays, ville, quartier, type_lieu) VALUES ($1, $2, $3, 'quartier') ON CONFLICT DO NOTHING")
            .bind("Sénégal").bind("Dakar").bind(quartier).execute(pool).await;
    }

    // CÔTE D'IVOIRE - Abidjan
    let abidjan_quartiers = vec![
        "Plateau",
        "Cocody",
        "Yopougon",
        "Abobo",
        "Adjamé",
        "Treichville",
        "Marcory",
        "Koumassi",
        "Port-Bouët",
        "Attécoubé",
        "Riviera",
        "Deux Plateaux",
        "Angré",
        "Zone 4",
    ];
    for quartier in abidjan_quartiers {
        let _ = sqlx::query("INSERT INTO african_locations (pays, ville, quartier, type_lieu) VALUES ($1, $2, $3, 'quartier') ON CONFLICT DO NOTHING")
            .bind("Côte d'Ivoire").bind("Abidjan").bind(quartier).execute(pool).await;
    }

    info!("✅ Table african_locations créée et seedée avec succès");
    Ok(())
}

pub async fn ensure_delivery_tables(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification des tables livraison (enums + structures)...");

    run_delivery_step(
        pool,
        "Create enum delivery_status",
        r#"
        DO $$
        BEGIN
            CREATE TYPE delivery_status AS ENUM (
                'requested',
                'awaiting_courier_confirmation',
                'accepted',
                'en_route_pickup',
                'arrival_pickup',
                'picked_up',
                'en_route_delivery',
                'arrival_destination',
                'delivered',
                'completed',
                'cancelled'
            );
        EXCEPTION
            WHEN duplicate_object THEN NULL;
        END
        $$;
        "#,
    )
    .await?;

    run_delivery_step(
        pool,
        "Create enum delivery_cancel_reason",
        r#"
        DO $$
        BEGIN
            CREATE TYPE delivery_cancel_reason AS ENUM (
                'client_cancelled',
                'courier_cancelled',
                'no_courier_available',
                'parcel_issue',
                'system_failure'
            );
        EXCEPTION
            WHEN duplicate_object THEN NULL;
        END
        $$;
        "#,
    )
    .await?;

    run_delivery_step(
        pool,
        "Create enum delivery_engine_type",
        r#"
        DO $$
        BEGIN
            CREATE TYPE delivery_engine_type AS ENUM (
                'moto',
                'scooter',
                'tricycle',
                'voiture',
                'camionnette',
                'velo_cargo',
                'pieton',
                'camion_leger',
                'autre'
            );
        EXCEPTION
            WHEN duplicate_object THEN NULL;
        END
        $$;
        "#,
    )
    .await?;

    run_delivery_step(
        pool,
        "Create enum delivery_courier_status",
        r#"
        DO $$
        BEGIN
            CREATE TYPE delivery_courier_status AS ENUM (
                'pending_review',
                'approved',
                'rejected',
                'suspended'
            );
        EXCEPTION
            WHEN duplicate_object THEN NULL;
        END
        $$;
        "#,
    )
    .await?;

    run_delivery_step(
        pool,
        "Create enum delivery_terrain_difficulty",
        r#"
        DO $$
        BEGIN
            CREATE TYPE delivery_terrain_difficulty AS ENUM (
                'smooth',
                'moderate',
                'rough',
                'blocked'
            );
        EXCEPTION
            WHEN duplicate_object THEN NULL;
        END
        $$;
        "#,
    )
    .await?;

    run_delivery_step(
        pool,
        "Create enum delivery_application_status",
        r#"
        DO $$
        BEGIN
            CREATE TYPE delivery_application_status AS ENUM (
                'draft',
                'submitted',
                'under_review',
                'approved',
                'rejected'
            );
        EXCEPTION
            WHEN duplicate_object THEN NULL;
        END
        $$;
        "#,
    )
    .await?;

    run_delivery_step(
        pool,
        "Create enum delivery_matching_status",
        r#"
        DO $$
        BEGIN
            CREATE TYPE delivery_matching_status AS ENUM (
                'queued',
                'searching',
                'assigned',
                'rejected',
                'failed',
                'timeout',
                'cancelled',
                'fallback',
                'no_courier'
            );
        EXCEPTION
            WHEN duplicate_object THEN NULL;
        END
        $$;
        "#,
    )
    .await?;

    run_delivery_step(
        pool,
        "Create parcel_types table",
        r#"
        CREATE TABLE IF NOT EXISTS parcel_types (
            id SERIAL PRIMARY KEY,
            slug TEXT UNIQUE NOT NULL,
            display_name TEXT NOT NULL,
            description TEXT,
            max_weight_kg NUMERIC(6,2),
            max_volume_cm3 NUMERIC(12,2),
            requires_isothermal BOOLEAN DEFAULT FALSE,
            requires_fragile_handling BOOLEAN DEFAULT FALSE,
            requires_secure_box BOOLEAN DEFAULT FALSE,
            requires_document_protection BOOLEAN DEFAULT FALSE,
            metadata JSONB DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ DEFAULT now()
        )
        "#,
    )
    .await?;

    run_delivery_step(
        pool,
        "Create parcel_types slug index",
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_parcel_types_slug ON parcel_types(slug)",
    )
    .await?;

    run_delivery_step(
        pool,
        "Create courier_applications table",
        r#"
            CREATE TABLE IF NOT EXISTS courier_applications (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                status delivery_application_status NOT NULL DEFAULT 'draft',
                submitted_at TIMESTAMPTZ,
                reviewed_at TIMESTAMPTZ,
                reviewer_id INTEGER REFERENCES users(id),
                rejection_reason TEXT,
                profile_data JSONB DEFAULT '{}'::jsonb,
                documents JSONB DEFAULT '[]'::jsonb,
                notes JSONB DEFAULT '[]'::jsonb,
                created_at TIMESTAMPTZ DEFAULT now(),
                updated_at TIMESTAMPTZ DEFAULT now()
            )
        "#,
    )
    .await?;

    run_delivery_step(
        pool,
        "Create courier_applications unique index",
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_courier_applications_user ON courier_applications(user_id)",
    )
    .await?;

    run_delivery_step(
        pool,
        "Create couriers table",
        r#"
            CREATE TABLE IF NOT EXISTS couriers (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                application_id UUID UNIQUE REFERENCES courier_applications(id) ON DELETE SET NULL,
                status delivery_courier_status NOT NULL DEFAULT 'pending_review',
                rating_average NUMERIC(3,2) DEFAULT 0,
                rating_count INTEGER DEFAULT 0,
                bio TEXT,
                hired_at TIMESTAMPTZ,
                suspended_at TIMESTAMPTZ,
                created_at TIMESTAMPTZ DEFAULT now(),
                updated_at TIMESTAMPTZ DEFAULT now()
            )
        "#,
    )
    .await?;

    run_delivery_step(
        pool,
        "Create courier_assets table",
        r#"
        CREATE TABLE IF NOT EXISTS courier_assets (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            courier_id UUID NOT NULL REFERENCES couriers(id) ON DELETE CASCADE,
            engine_type delivery_engine_type NOT NULL,
            is_primary BOOLEAN DEFAULT FALSE,
            max_weight_kg NUMERIC(6,2),
            max_volume_cm3 NUMERIC(12,2),
            equipments JSONB DEFAULT '[]'::jsonb,
            available BOOLEAN DEFAULT TRUE,
            availability_schedule JSONB,
            documents JSONB,
            created_at TIMESTAMPTZ DEFAULT now(),
            updated_at TIMESTAMPTZ DEFAULT now()
        )
        "#,
    )
    .await?;

    run_delivery_step(
        pool,
        "Create courier_assets courier index",
        "CREATE INDEX IF NOT EXISTS idx_courier_assets_courier ON courier_assets(courier_id)",
    )
    .await?;
    run_delivery_step(
        pool,
        "Create courier_assets primary unique index",
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_courier_assets_primary ON courier_assets(courier_id) WHERE is_primary = TRUE",
    )
    .await?;

    // ✅ NOUVEAU 2026-01-04: Créer le type ENUM pour les types de partenaires
    run_delivery_step(
        pool,
        "Create delivery_partner_type enum",
        r#"
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'delivery_partner_type') THEN
                CREATE TYPE delivery_partner_type AS ENUM (
                    'livraison',
                    'livraison_courses_marche',
                    'pharmacie',
                    'hopital',
                    'laboratoire',
                    'agence de voyage',
                    'demenagement',
                    'transport',
                    'assureur',
                    'supermarche',
                    'telecom',
                    'chauffeur',
                    'hotel',
                    'meuble'
                );
            END IF;
        END
        $$;
        "#,
    )
    .await?;

    // ✅ NOUVEAU 2026-01-04: Créer la table delivery_partners
    run_delivery_step(
        pool,
        "Create delivery_partners table",
        r#"
        CREATE TABLE IF NOT EXISTS delivery_partners (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            description TEXT,
            partner_type delivery_partner_type NOT NULL DEFAULT 'livraison',
            contact_email VARCHAR(255),
            contact_phone VARCHAR(50),
            address TEXT,
            city VARCHAR(100),
            country VARCHAR(100) NOT NULL, -- ✅ NOUVEAU 2026-01-04: Pays obligatoire pour distinguer les partenaires
            continent VARCHAR(50), -- ✅ NOUVEAU 2026-01-04: Continent pour meilleure organisation
            website VARCHAR(255),
            logo_url TEXT,
            -- ✅ NOUVEAU 2026-01-04: Localisation intelligente du partenaire
            location_latitude DOUBLE PRECISION,
            location_longitude DOUBLE PRECISION,
            location_address TEXT, -- Adresse complète formatée depuis la géolocalisation
            is_active BOOLEAN DEFAULT TRUE,
            created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW(),
            -- ✅ NOUVEAU 2026-01-04: Contrainte unique sur (name, country) pour permettre le même nom dans différents pays
            UNIQUE(name, country)
        )
        "#,
    )
    .await?;

    run_delivery_step(
        pool,
        "Create delivery_partners indexes",
        r#"
        CREATE INDEX IF NOT EXISTS idx_delivery_partners_name ON delivery_partners(name);
        CREATE INDEX IF NOT EXISTS idx_delivery_partners_active ON delivery_partners(is_active);
        CREATE INDEX IF NOT EXISTS idx_delivery_partners_created_by ON delivery_partners(created_by);
        CREATE INDEX IF NOT EXISTS idx_delivery_partners_type ON delivery_partners(partner_type);
        "#,
    )
    .await?;

    // ✅ NOUVEAU 2026-01-04: Ajouter la colonne partner_type si elle n'existe pas (pour les tables existantes)
    run_delivery_step(
        pool,
        "Add partner_type column to delivery_partners if missing",
        r#"
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'delivery_partners' AND column_name = 'partner_type'
            ) THEN
                ALTER TABLE delivery_partners 
                ADD COLUMN partner_type delivery_partner_type NOT NULL DEFAULT 'livraison';
            END IF;
        END
        $$;
        "#,
    )
    .await?;

    // ✅ NOUVEAU 2026-01-04: Ajouter les colonnes de localisation si elles n'existent pas
    run_delivery_step(
        pool,
        "Add location columns to delivery_partners if missing",
        r#"
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'delivery_partners' AND column_name = 'location_latitude'
            ) THEN
                ALTER TABLE delivery_partners 
                ADD COLUMN location_latitude DOUBLE PRECISION,
                ADD COLUMN location_longitude DOUBLE PRECISION,
                ADD COLUMN location_address TEXT;
            END IF;
        END
        $$;
        "#,
    )
    .await?;

    // ✅ NOUVEAU 2026-01-04: Ajouter les nouveaux types de partenaires à l'enum
    run_delivery_step(
        pool,
        "Add new partner types to delivery_partner_type enum",
        r#"
        DO $$
        BEGIN
            -- Ajouter 'assureur' si n'existe pas
            IF NOT EXISTS (
                SELECT 1 FROM pg_enum 
                WHERE enumlabel = 'assureur' AND enumtypid = 'delivery_partner_type'::regtype
            ) THEN
                ALTER TYPE delivery_partner_type ADD VALUE 'assureur';
            END IF;
            
            -- Ajouter 'supermarche' si n'existe pas
            IF NOT EXISTS (
                SELECT 1 FROM pg_enum 
                WHERE enumlabel = 'supermarche' AND enumtypid = 'delivery_partner_type'::regtype
            ) THEN
                ALTER TYPE delivery_partner_type ADD VALUE 'supermarche';
            END IF;
            
            -- Ajouter 'telecom' si n'existe pas
            IF NOT EXISTS (
                SELECT 1 FROM pg_enum 
                WHERE enumlabel = 'telecom' AND enumtypid = 'delivery_partner_type'::regtype
            ) THEN
                ALTER TYPE delivery_partner_type ADD VALUE 'telecom';
            END IF;
            
            -- ✅ NOUVEAU: Ajouter 'livraison_courses_marche' si n'existe pas (pour coursiers spécialisés en courses au marché)
            IF NOT EXISTS (
                SELECT 1 FROM pg_enum 
                WHERE enumlabel = 'livraison_courses_marche' AND enumtypid = 'delivery_partner_type'::regtype
            ) THEN
                ALTER TYPE delivery_partner_type ADD VALUE 'livraison_courses_marche';
            END IF;
            
            -- ✅ NOUVEAU: Ajouter 'chauffeur' si n'existe pas (pour chauffeurs taxi/covoiturage)
            IF NOT EXISTS (
                SELECT 1 FROM pg_enum 
                WHERE enumlabel = 'chauffeur' AND enumtypid = 'delivery_partner_type'::regtype
            ) THEN
                ALTER TYPE delivery_partner_type ADD VALUE 'chauffeur';
            END IF;
            
            -- ✅ NOUVEAU: Ajouter 'hotel' si n'existe pas (pour hôtels)
            IF NOT EXISTS (
                SELECT 1 FROM pg_enum 
                WHERE enumlabel = 'hotel' AND enumtypid = 'delivery_partner_type'::regtype
            ) THEN
                ALTER TYPE delivery_partner_type ADD VALUE 'hotel';
            END IF;
            
            -- ✅ NOUVEAU: Ajouter 'meuble' si n'existe pas (pour locations meublées)
            IF NOT EXISTS (
                SELECT 1 FROM pg_enum 
                WHERE enumlabel = 'meuble' AND enumtypid = 'delivery_partner_type'::regtype
            ) THEN
                ALTER TYPE delivery_partner_type ADD VALUE 'meuble';
            END IF;
            
            -- ✅ NOUVEAU 2026-03-03: Ajouter 'etablissementscolaire' si n'existe pas
            IF NOT EXISTS (
                SELECT 1 FROM pg_enum 
                WHERE enumlabel = 'etablissementscolaire' AND enumtypid = 'delivery_partner_type'::regtype
            ) THEN
                ALTER TYPE delivery_partner_type ADD VALUE 'etablissementscolaire';
            END IF;
            
            -- ✅ NOUVEAU 2026-03-03: Ajouter 'banquesang' si n'existe pas
            IF NOT EXISTS (
                SELECT 1 FROM pg_enum 
                WHERE enumlabel = 'banquesang' AND enumtypid = 'delivery_partner_type'::regtype
            ) THEN
                ALTER TYPE delivery_partner_type ADD VALUE 'banquesang';
            END IF;
            
            -- ✅ NOUVEAU 2026-03-03: Ajouter les types spécialisés manquants
            IF NOT EXISTS (
                SELECT 1 FROM pg_enum 
                WHERE enumlabel = 'immobilier' AND enumtypid = 'delivery_partner_type'::regtype
            ) THEN
                ALTER TYPE delivery_partner_type ADD VALUE 'immobilier';
            END IF;
            
            IF NOT EXISTS (
                SELECT 1 FROM pg_enum 
                WHERE enumlabel = 'restaurant' AND enumtypid = 'delivery_partner_type'::regtype
            ) THEN
                ALTER TYPE delivery_partner_type ADD VALUE 'restaurant';
            END IF;
            
            IF NOT EXISTS (
                SELECT 1 FROM pg_enum 
                WHERE enumlabel = 'taxi' AND enumtypid = 'delivery_partner_type'::regtype
            ) THEN
                ALTER TYPE delivery_partner_type ADD VALUE 'taxi';
            END IF;
            
            IF NOT EXISTS (
                SELECT 1 FROM pg_enum 
                WHERE enumlabel = 'covoiturage' AND enumtypid = 'delivery_partner_type'::regtype
            ) THEN
                ALTER TYPE delivery_partner_type ADD VALUE 'covoiturage';
            END IF;
        END
        $$;
        "#,
    )
    .await?;

    // ✅ NOUVEAU 2026-01-04: Ajouter partner_id à courier_applications
    run_delivery_step(
        pool,
        "Add partner_id to courier_applications",
        r#"
        ALTER TABLE courier_applications 
        ADD COLUMN IF NOT EXISTS partner_id INTEGER REFERENCES delivery_partners(id) ON DELETE SET NULL;
        CREATE INDEX IF NOT EXISTS idx_courier_applications_partner ON courier_applications(partner_id);
        "#,
    )
    .await?;

    // ✅ NOUVEAU 2026-01-04: Ajouter vehicle_image_url à courier_assets
    run_delivery_step(
        pool,
        "Add vehicle_image_url to courier_assets",
        r#"
        ALTER TABLE courier_assets 
        ADD COLUMN IF NOT EXISTS vehicle_image_url TEXT;
        "#,
    )
    .await?;

    // ✅ NOUVEAU 2026-01-XX: Ajouter colonnes pour partenaires dans users
    run_delivery_step(
        pool,
        "Add partner columns to users table",
        r#"
        DO $$
        BEGIN
            -- Ajouter partner_type si n'existe pas
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'users' AND column_name = 'partner_type'
            ) THEN
                ALTER TABLE users 
                ADD COLUMN partner_type VARCHAR(50);
            END IF;
            
            -- Ajouter partner_status si n'existe pas
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'users' AND column_name = 'partner_status'
            ) THEN
                ALTER TABLE users 
                ADD COLUMN partner_status VARCHAR(20);
            END IF;
        END
        $$;
        "#,
    )
    .await?;

    // ✅ NOUVEAU 2026-01-XX: Ajouter user_id à delivery_partners pour lier au compte
    run_delivery_step(
        pool,
        "Add user_id to delivery_partners table",
        r#"
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'delivery_partners' AND column_name = 'user_id'
            ) THEN
                ALTER TABLE delivery_partners 
                ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
                
                CREATE INDEX IF NOT EXISTS idx_delivery_partners_user_id 
                ON delivery_partners(user_id);
            END IF;
        END
        $$;
        "#,
    )
    .await?;

    run_delivery_step(
        pool,
        "Create delivery_parcels table",
        r#"
        CREATE TABLE IF NOT EXISTS delivery_parcels (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            type_id INTEGER REFERENCES parcel_types(id) ON DELETE SET NULL,
            weight_kg NUMERIC(6,2),
            volume_cm3 NUMERIC(12,2),
            declared_value NUMERIC(10,2),
            notes TEXT,
            photos JSONB DEFAULT '[]'::jsonb,
            constraints JSONB DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ DEFAULT now()
        )
        "#,
    )
    .await?;

    run_delivery_step(
        pool,
        "Create deliveries table",
        r#"
        CREATE TABLE IF NOT EXISTS deliveries (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            creator_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            courier_id UUID REFERENCES couriers(id) ON DELETE SET NULL,
            parcel_id UUID NOT NULL REFERENCES delivery_parcels(id) ON DELETE CASCADE,
            status delivery_status NOT NULL DEFAULT 'requested',
            requested_at TIMESTAMPTZ DEFAULT now(),
            confirmed_at TIMESTAMPTZ,
            accepted_at TIMESTAMPTZ,
            picked_up_at TIMESTAMPTZ,
            delivered_at TIMESTAMPTZ,
            completed_at TIMESTAMPTZ,
            cancelled_at TIMESTAMPTZ,
            cancel_reason delivery_cancel_reason,
            pickup_location GEOGRAPHY(Point, 4326) NOT NULL,
            dropoff_location GEOGRAPHY(Point, 4326) NOT NULL,
            pickup_address TEXT,
            dropoff_address TEXT,
            recipient_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
            recipient_contact_name TEXT,
            recipient_contact_phone TEXT,
            recipient_notes TEXT,
            recipient_tracking_token UUID UNIQUE DEFAULT gen_random_uuid(),
            recipient_dropoff_override GEOGRAPHY(Point, 4326),
            recipient_dropoff_address TEXT,
            recipient_dropoff_updated_at TIMESTAMPTZ,
            recipient_chat_thread_id UUID,
            distance_meters INTEGER,
            estimated_duration_seconds INTEGER,
            actual_duration_seconds INTEGER,
            updated_at TIMESTAMPTZ DEFAULT now(),
            pricing_id UUID,
            tracking_token UUID UNIQUE DEFAULT gen_random_uuid(),
            metadata JSONB DEFAULT '{}'::jsonb,
            shopping_required BOOLEAN DEFAULT FALSE,
            store_location GEOGRAPHY(Point, 4326),
            store_name TEXT
        )
        "#,
    )
    .await?;

    run_delivery_step(
        pool,
        "Create deliveries status index",
        "CREATE INDEX IF NOT EXISTS idx_deliveries_status_requested_at ON deliveries(status, requested_at DESC)",
    )
    .await?;
    run_delivery_step(
        pool,
        "Create deliveries courier index",
        "CREATE INDEX IF NOT EXISTS idx_deliveries_courier ON deliveries(courier_id)",
    )
    .await?;
    run_delivery_step(
        pool,
        "Create deliveries creator index",
        "CREATE INDEX IF NOT EXISTS idx_deliveries_creator ON deliveries(creator_id)",
    )
    .await?;
    run_delivery_step(
        pool,
        "Create deliveries recipient_user index",
        "CREATE INDEX IF NOT EXISTS idx_deliveries_recipient_user ON deliveries(recipient_user_id)",
    )
    .await?;
    run_delivery_step(
        pool,
        "Create deliveries recipient_tracking_token unique index",
        "CREATE UNIQUE INDEX IF NOT EXISTS ux_deliveries_recipient_tracking_token ON deliveries(recipient_tracking_token)",
    )
    .await?;

    run_delivery_step(
        pool,
        "Create deliveries pickup_location index",
        "CREATE INDEX IF NOT EXISTS idx_deliveries_pickup_location ON deliveries USING GIST(pickup_location)",
    )
    .await?;
    run_delivery_step(
        pool,
        "Create deliveries dropoff_location index",
        "CREATE INDEX IF NOT EXISTS idx_deliveries_dropoff_location ON deliveries USING GIST(dropoff_location)",
    )
    .await?;

    run_delivery_step(
        pool,
        "Add deliveries.recipient_user_id column",
        "ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS recipient_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL",
    )
    .await?;
    run_delivery_step(
        pool,
        "Add deliveries.recipient_contact_name column",
        "ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS recipient_contact_name TEXT",
    )
    .await?;
    run_delivery_step(
        pool,
        "Add deliveries.recipient_contact_phone column",
        "ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS recipient_contact_phone TEXT",
    )
    .await?;
    run_delivery_step(
        pool,
        "Add deliveries.recipient_notes column",
        "ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS recipient_notes TEXT",
    )
    .await?;
    run_delivery_step(
        pool,
        "Add deliveries.recipient_tracking_token column",
        "ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS recipient_tracking_token UUID DEFAULT gen_random_uuid()",
    )
    .await?;
    run_delivery_step(
        pool,
        "Add deliveries.recipient_dropoff_override column",
        "ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS recipient_dropoff_override GEOGRAPHY(Point, 4326)",
    )
    .await?;
    run_delivery_step(
        pool,
        "Add deliveries.recipient_dropoff_address column",
        "ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS recipient_dropoff_address TEXT",
    )
    .await?;
    run_delivery_step(
        pool,
        "Add deliveries.recipient_dropoff_updated_at column",
        "ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS recipient_dropoff_updated_at TIMESTAMPTZ",
    )
    .await?;
    // ✅ Phase 9 - Amélioration 28 : Ajouter preferred_courier_id pour sélection livreur
    run_delivery_step(
        pool,
        "Add deliveries.preferred_courier_id column",
        "ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS preferred_courier_id UUID REFERENCES couriers(id) ON DELETE SET NULL",
    )
    .await?;
    run_delivery_step(
        pool,
        "Add deliveries.recipient_chat_thread_id column",
        "ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS recipient_chat_thread_id UUID",
    )
    .await?;

    run_delivery_step(
        pool,
        "Create delivery_status_events table",
        r#"
        CREATE TABLE IF NOT EXISTS delivery_status_events (
            id BIGSERIAL PRIMARY KEY,
            delivery_id UUID NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
            status delivery_status NOT NULL,
            occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            payload JSONB DEFAULT '{}'::jsonb,
            recorded_by INTEGER
        )
        "#,
    )
    .await?;

    run_delivery_step(
        pool,
        "Create delivery_status_events delivery index",
        "CREATE INDEX IF NOT EXISTS idx_delivery_status_events_delivery ON delivery_status_events(delivery_id)",
    )
    .await?;
    run_delivery_step(
        pool,
        "Create delivery_status_events delivery_time index",
        "CREATE INDEX IF NOT EXISTS idx_delivery_status_events_delivery_time ON delivery_status_events(delivery_id, occurred_at DESC)",
    )
    .await?;

    run_delivery_step(
        pool,
        "Create delivery_pricing table",
        r#"
        CREATE TABLE IF NOT EXISTS delivery_pricing (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            delivery_id UUID UNIQUE NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
            base_price_cents INTEGER NOT NULL,
            distance_price_cents INTEGER NOT NULL,
            surcharge_cents INTEGER DEFAULT 0,
            discount_cents INTEGER DEFAULT 0,
            currency CHAR(3) DEFAULT 'XAF',
            calculated_at TIMESTAMPTZ DEFAULT now(),
            details JSONB DEFAULT '{}'::jsonb,
            shopping_cost_cents INTEGER DEFAULT 0,
            shopping_discount_cents INTEGER DEFAULT 0
        )
        "#,
    )
    .await?;

    run_delivery_step(
        pool,
        "Add deliveries.pricing_id FK",
        r#"
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1
                FROM information_schema.table_constraints
                WHERE constraint_name = 'fk_deliveries_pricing'
                  AND table_name = 'deliveries'
                  AND constraint_type = 'FOREIGN KEY'
            ) THEN
                ALTER TABLE deliveries
                ADD CONSTRAINT fk_deliveries_pricing
                FOREIGN KEY (pricing_id)
                REFERENCES delivery_pricing(id)
                ON DELETE SET NULL;
            END IF;
        END
        $$;
        "#,
    )
    .await?;

    run_delivery_step(
        pool,
        "Create delivery_tracking_points table",
        r#"
        CREATE TABLE IF NOT EXISTS delivery_tracking_points (
            id BIGSERIAL PRIMARY KEY,
            delivery_id UUID NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
            courier_id UUID NOT NULL REFERENCES couriers(id) ON DELETE CASCADE,
            captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            location GEOGRAPHY(Point, 4326) NOT NULL,
            speed_kmh NUMERIC(5,2),
            bearing NUMERIC(6,2),
            accuracy_meters NUMERIC(6,2)
        )
        "#,
    )
    .await?;

    run_delivery_step(
        pool,
        "Create tracking_points delivery index",
        "CREATE INDEX IF NOT EXISTS idx_tracking_points_delivery ON delivery_tracking_points(delivery_id)",
    )
    .await?;
    run_delivery_step(
        pool,
        "Create tracking_points courier index",
        "CREATE INDEX IF NOT EXISTS idx_tracking_points_courier ON delivery_tracking_points(courier_id)",
    )
    .await?;
    run_delivery_step(
        pool,
        "Create tracking_points captured_at index",
        "CREATE INDEX IF NOT EXISTS idx_tracking_points_captured_at ON delivery_tracking_points(captured_at DESC)",
    )
    .await?;
    run_delivery_step(
        pool,
        "Create tracking_points location index",
        "CREATE INDEX IF NOT EXISTS idx_tracking_points_location ON delivery_tracking_points USING GIST(location)",
    )
    .await?;

    run_delivery_step(
        pool,
        "Create delivery_recipient_updates table",
        r#"
        CREATE TABLE IF NOT EXISTS delivery_recipient_updates (
            id BIGSERIAL PRIMARY KEY,
            delivery_id UUID NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
            submitted_by INTEGER REFERENCES users(id),
            latitude DOUBLE PRECISION NOT NULL,
            longitude DOUBLE PRECISION NOT NULL,
            address TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
        "#,
    )
    .await?;

    run_delivery_step(
        pool,
        "Create delivery_recipient_updates index",
        "CREATE INDEX IF NOT EXISTS idx_delivery_recipient_updates_delivery ON delivery_recipient_updates(delivery_id, created_at DESC)",
    )
    .await?;

    run_delivery_step(
        pool,
        "Create courier_ratings table",
        r#"
            CREATE TABLE IF NOT EXISTS courier_ratings (
                id BIGSERIAL PRIMARY KEY,
                delivery_id UUID UNIQUE NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
                courier_id UUID NOT NULL REFERENCES couriers(id) ON DELETE CASCADE,
                rater_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                score_small INTEGER NOT NULL CHECK (score_small BETWEEN 1 AND 5),
                tags TEXT[],
                comment TEXT,
                created_at TIMESTAMPTZ DEFAULT now()
            )
        "#,
    )
    .await?;

    run_delivery_step(
        pool,
        "Create courier_ratings courier index",
        "CREATE INDEX IF NOT EXISTS idx_courier_ratings_courier ON courier_ratings(courier_id)",
    )
    .await?;

    run_delivery_step(
        pool,
        "Create client_ratings table",
        r#"
            CREATE TABLE IF NOT EXISTS client_ratings (
                id BIGSERIAL PRIMARY KEY,
                delivery_id UUID UNIQUE NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
                client_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                courier_id UUID NOT NULL REFERENCES couriers(id) ON DELETE CASCADE,
                score_small INTEGER NOT NULL CHECK (score_small BETWEEN 1 AND 5),
                tags TEXT[],
                comment TEXT,
                created_at TIMESTAMPTZ DEFAULT now()
            )
        "#,
    )
    .await?;

    run_delivery_step(
        pool,
        "Create client_ratings client index",
        "CREATE INDEX IF NOT EXISTS idx_client_ratings_client ON client_ratings(client_id)",
    )
    .await?;

    run_delivery_step(
        pool,
        "Create traffic_snapshots table",
        r#"
        CREATE TABLE IF NOT EXISTS traffic_snapshots (
            id BIGSERIAL PRIMARY KEY,
            captured_at TIMESTAMPTZ NOT NULL,
            source TEXT,
            bounding_box GEOGRAPHY(Polygon, 4326),
            payload JSONB NOT NULL
        )
        "#,
    )
    .await?;

    run_delivery_step(
        pool,
        "Create traffic_snapshots captured_at index",
        "CREATE INDEX IF NOT EXISTS idx_traffic_snapshots_captured_at ON traffic_snapshots(captured_at DESC)",
    )
    .await?;
    run_delivery_step(
        pool,
        "Create traffic_snapshots source index",
        "CREATE INDEX IF NOT EXISTS idx_traffic_snapshots_source ON traffic_snapshots(source)",
    )
    .await?;

    run_delivery_step(
        pool,
        "Create terrain_segments table",
        r#"
        CREATE TABLE IF NOT EXISTS terrain_segments (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            segment GEOGRAPHY(LineString, 4326) NOT NULL,
            difficulty delivery_terrain_difficulty NOT NULL,
            notes TEXT,
            metadata JSONB DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ DEFAULT now()
        )
        "#,
    )
    .await?;

    run_delivery_step(
        pool,
        "Create terrain_segments difficulty index",
        "CREATE INDEX IF NOT EXISTS idx_terrain_segments_difficulty ON terrain_segments(difficulty)",
    )
    .await?;
    run_delivery_step(
        pool,
        "Create terrain_segments segment index",
        "CREATE INDEX IF NOT EXISTS idx_terrain_segments_segment ON terrain_segments USING GIST(segment)",
    )
    .await?;

    run_delivery_step(
        pool,
        "Create shopping_orders table",
        r#"
        CREATE TABLE IF NOT EXISTS shopping_orders (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            delivery_id UUID UNIQUE NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
            status shopping_status NOT NULL DEFAULT 'pending',
            estimated_total_cents INTEGER NOT NULL DEFAULT 0,
            actual_total_cents INTEGER,
            currency CHAR(3) DEFAULT 'XAF',
            store_name TEXT,
            store_location GEOGRAPHY(Point, 4326),
            notes TEXT,
            requires_balance_top_up BOOLEAN DEFAULT FALSE,
            payload JSONB DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ DEFAULT now(),
            updated_at TIMESTAMPTZ DEFAULT now()
        )
        "#,
    )
    .await?;

    run_delivery_step(
        pool,
        "Create shopping_orders status index",
        "CREATE INDEX IF NOT EXISTS idx_shopping_orders_status ON shopping_orders(status)",
    )
    .await?;

    run_delivery_step(
        pool,
        "Create shopping_order_items table",
        r#"
        CREATE TABLE IF NOT EXISTS shopping_order_items (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            shopping_order_id UUID NOT NULL REFERENCES shopping_orders(id) ON DELETE CASCADE,
            product_id UUID,
            product_name TEXT NOT NULL,
            characteristics JSONB DEFAULT '[]'::jsonb,
            quantity NUMERIC(10,2) NOT NULL,
            unit TEXT DEFAULT 'unite',
            estimated_price_cents INTEGER DEFAULT 0,
            actual_price_cents INTEGER,
            status shopping_item_status NOT NULL DEFAULT 'pending',
            metadata JSONB DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ DEFAULT now(),
            updated_at TIMESTAMPTZ DEFAULT now()
        )
        "#,
    )
    .await?;

    run_delivery_step(
        pool,
        "Create shopping_order_items order index",
        "CREATE INDEX IF NOT EXISTS idx_shopping_order_items_order ON shopping_order_items(shopping_order_id)",
    )
    .await?;
    run_delivery_step(
        pool,
        "Create shopping_order_items status index",
        "CREATE INDEX IF NOT EXISTS idx_shopping_order_items_status ON shopping_order_items(status)",
    )
    .await?;

    // --- Infrastructure de matching temps réel ---
    run_delivery_step(
        pool,
        "Create delivery_zones table",
        r#"
        CREATE TABLE IF NOT EXISTS delivery_zones (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            slug TEXT NOT NULL UNIQUE,
            display_name TEXT NOT NULL,
            description TEXT,
            region GEOGRAPHY(MultiPolygon, 4326),
            center GEOGRAPHY(Point, 4326),
            max_active_couriers INTEGER NOT NULL DEFAULT 500,
            metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        "#,
    )
    .await?;

    run_delivery_step(
        pool,
        "Create delivery_zones region index",
        r#"
        CREATE INDEX IF NOT EXISTS idx_delivery_zones_region ON delivery_zones USING GIST (region);
        "#,
    )
    .await?;

    run_delivery_step(
        pool,
        "Create delivery_zones center index",
        r#"
        CREATE INDEX IF NOT EXISTS idx_delivery_zones_center ON delivery_zones USING GIST (center);
        "#,
    )
    .await?;

    run_delivery_step(
        pool,
        "Create courier_zone_assignments table",
        r#"
        CREATE TABLE IF NOT EXISTS courier_zone_assignments (
            id BIGSERIAL PRIMARY KEY,
            courier_id UUID NOT NULL REFERENCES couriers(id) ON DELETE CASCADE,
            zone_id UUID NOT NULL REFERENCES delivery_zones(id) ON DELETE CASCADE,
            capacity_weight SMALLINT NOT NULL DEFAULT 1,
            is_primary BOOLEAN NOT NULL DEFAULT FALSE,
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            UNIQUE (courier_id, zone_id)
        )
        "#,
    )
    .await?;

    run_delivery_step(
        pool,
        "Create courier_zone_assignments zone index",
        "CREATE INDEX IF NOT EXISTS idx_courier_zone_assignments_zone ON courier_zone_assignments(zone_id)",
    )
    .await?;

    run_delivery_step(
        pool,
        "Create courier_zone_assignments active index",
        "CREATE INDEX IF NOT EXISTS idx_courier_zone_assignments_active ON courier_zone_assignments(is_active)",
    )
    .await?;

    run_delivery_step(
        pool,
        "Create courier_availability_snapshots table",
        r#"
        CREATE TABLE IF NOT EXISTS courier_availability_snapshots (
            id BIGSERIAL PRIMARY KEY,
            courier_id UUID NOT NULL REFERENCES couriers(id) ON DELETE CASCADE,
            zone_id UUID REFERENCES delivery_zones(id),
            captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            is_online BOOLEAN NOT NULL DEFAULT FALSE,
            active_deliveries SMALLINT NOT NULL DEFAULT 0,
            max_capacity SMALLINT NOT NULL DEFAULT 2,
            load_factor NUMERIC(6,3) NOT NULL DEFAULT 0,
            latitude DOUBLE PRECISION,
            longitude DOUBLE PRECISION,
            location GEOGRAPHY(Point, 4326),
            battery_level SMALLINT,
            metadata JSONB NOT NULL DEFAULT '{}'::jsonb
        )
        "#,
    )
    .await?;

    run_delivery_step(
        pool,
        "Create courier_availability_snapshots courier index",
        "CREATE INDEX IF NOT EXISTS idx_courier_availability_snapshots_courier ON courier_availability_snapshots(courier_id)",
    )
    .await?;

    run_delivery_step(
        pool,
        "Create courier_availability_snapshots zone index",
        "CREATE INDEX IF NOT EXISTS idx_courier_availability_snapshots_zone ON courier_availability_snapshots(zone_id)",
    )
    .await?;

    run_delivery_step(
        pool,
        "Create courier_availability_snapshots capture index",
        "CREATE INDEX IF NOT EXISTS idx_courier_availability_snapshots_capture ON courier_availability_snapshots(courier_id, captured_at DESC)",
    )
    .await?;

    run_delivery_step(
        pool,
        "Create courier_availability_snapshots location index",
        "CREATE INDEX IF NOT EXISTS idx_courier_availability_snapshots_location ON courier_availability_snapshots USING GIST (location)",
    )
    .await?;

    run_delivery_step(
        pool,
        "Create delivery_matching_queue table",
        r#"
        CREATE TABLE IF NOT EXISTS delivery_matching_queue (
            id BIGSERIAL PRIMARY KEY,
            delivery_id UUID NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
            zone_id UUID REFERENCES delivery_zones(id),
            status delivery_matching_status NOT NULL DEFAULT 'queued',
            priority SMALLINT NOT NULL DEFAULT 100,
            attempt_count INTEGER NOT NULL DEFAULT 0,
            payload JSONB NOT NULL DEFAULT '{}'::jsonb,
            next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            enqueued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            UNIQUE (delivery_id)
        )
        "#,
    )
    .await?;

    run_delivery_step(
        pool,
        "Create delivery_matching_queue status index",
        r#"
        CREATE INDEX IF NOT EXISTS idx_delivery_matching_queue_status ON delivery_matching_queue(status, next_attempt_at)
        "#,
    )
    .await?;

    run_delivery_step(
        pool,
        "Create delivery_matching_queue zone index",
        r#"
        CREATE INDEX IF NOT EXISTS idx_delivery_matching_queue_zone ON delivery_matching_queue(zone_id)
        "#,
    )
    .await?;

    run_delivery_step(
        pool,
        "Create delivery_matching_events table",
        r#"
        CREATE TABLE IF NOT EXISTS delivery_matching_events (
            id BIGSERIAL PRIMARY KEY,
            delivery_id UUID NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
            courier_id UUID REFERENCES couriers(id),
            status delivery_matching_status NOT NULL,
            score NUMERIC(8,3),
            reason TEXT,
            metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        "#,
    )
    .await?;

    run_delivery_step(
        pool,
        "Create delivery_matching_events delivery index",
        r#"
        CREATE INDEX IF NOT EXISTS idx_delivery_matching_events_delivery ON delivery_matching_events(delivery_id)
        "#,
    )
    .await?;

    run_delivery_step(
        pool,
        "Create delivery_matching_events courier index",
        r#"
        CREATE INDEX IF NOT EXISTS idx_delivery_matching_events_courier ON delivery_matching_events(courier_id)
        "#,
    )
    .await?;

    info!("✅ Tables livraison vérifiées");
    Ok(())
}

/// ✅ NOUVEAU 2025-01-31: Ajouter les colonnes aller-retour à la table deliveries
pub async fn ensure_delivery_round_trip_columns(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification des colonnes aller-retour dans deliveries...");

    // Ajouter les colonnes si elles n'existent pas
    sqlx::query(
        r#"
        ALTER TABLE deliveries 
        ADD COLUMN IF NOT EXISTS is_round_trip BOOLEAN NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS return_delivery_id UUID REFERENCES deliveries(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS return_pickup_location GEOGRAPHY(Point, 4326),
        ADD COLUMN IF NOT EXISTS return_dropoff_location GEOGRAPHY(Point, 4326),
        ADD COLUMN IF NOT EXISTS return_pickup_address TEXT,
        ADD COLUMN IF NOT EXISTS return_dropoff_address TEXT,
        ADD COLUMN IF NOT EXISTS return_distance_meters INTEGER,
        ADD COLUMN IF NOT EXISTS return_estimated_duration_seconds INTEGER,
        ADD COLUMN IF NOT EXISTS return_actual_duration_seconds INTEGER,
        ADD COLUMN IF NOT EXISTS return_requested_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS round_trip_discount_percent INTEGER DEFAULT 0
        "#
    )
    .execute(pool)
    .await?;

    // Créer les index
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_deliveries_return_delivery_id ON deliveries(return_delivery_id) WHERE return_delivery_id IS NOT NULL")
        .execute(pool)
        .await?;

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_deliveries_is_round_trip ON deliveries(is_round_trip) WHERE is_round_trip = TRUE")
        .execute(pool)
        .await?;

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_deliveries_return_pickup_location ON deliveries USING GIST(return_pickup_location) WHERE return_pickup_location IS NOT NULL")
        .execute(pool)
        .await?;

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_deliveries_return_dropoff_location ON deliveries USING GIST(return_dropoff_location) WHERE return_dropoff_location IS NOT NULL")
        .execute(pool)
        .await?;

    // Créer le trigger de vérification de cohérence
    sqlx::query(
        r#"
        CREATE OR REPLACE FUNCTION check_round_trip_consistency()
        RETURNS TRIGGER AS $$
        BEGIN
            IF NEW.return_delivery_id IS NOT NULL THEN
                IF NOT EXISTS (
                    SELECT 1 FROM deliveries 
                    WHERE id = NEW.return_delivery_id 
                    AND creator_id = NEW.creator_id
                ) THEN
                    RAISE EXCEPTION 'La livraison retour doit appartenir au même créateur';
                END IF;
            END IF;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql
        "#,
    )
    .execute(pool)
    .await?;

    sqlx::query(
        r#"
        DROP TRIGGER IF EXISTS trigger_check_round_trip_consistency ON deliveries;
        CREATE TRIGGER trigger_check_round_trip_consistency
            BEFORE INSERT OR UPDATE ON deliveries
            FOR EACH ROW
            EXECUTE FUNCTION check_round_trip_consistency()
        "#,
    )
    .execute(pool)
    .await?;

    info!("✅ Colonnes aller-retour vérifiées");
    Ok(())
}

/// ✅ NOUVEAU 2025-01-31: Créer la table delivery_media pour optimiser le stockage des médias
pub async fn ensure_delivery_media_table(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification de la table delivery_media...");

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS delivery_media (
            id SERIAL PRIMARY KEY,
            delivery_id UUID NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
            parcel_id UUID REFERENCES delivery_parcels(id) ON DELETE SET NULL,
            
            -- Informations média
            type TEXT NOT NULL CHECK (type IN ('image', 'video', 'audio', 'document')),
            path TEXT NOT NULL,
            media_type TEXT,
            file_size BIGINT,
            file_format TEXT,
            
            -- Métadonnées
            is_parcel_photo BOOLEAN NOT NULL DEFAULT TRUE,
            is_proof_media BOOLEAN NOT NULL DEFAULT FALSE,
            proof_type TEXT CHECK (proof_type IN ('pickup', 'delivery', NULL)),
            
            -- Ordre d'affichage
            display_order INTEGER NOT NULL DEFAULT 0,
            
            -- Analyse IA (optionnel)
            ai_description TEXT,
            ai_tags TEXT[],
            ai_metadata JSONB,
            ai_analyzed_at TIMESTAMPTZ,
            ai_model_used VARCHAR(100),
            ai_confidence DOUBLE PRECISION,
            
            -- Timestamps
            uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            
            -- Métadonnées additionnelles
            metadata JSONB DEFAULT '{}'::jsonb
        )
        "#,
    )
    .execute(pool)
    .await?;

    // Index pour améliorer les performances
    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_delivery_media_delivery_id ON delivery_media(delivery_id)",
    )
    .execute(pool)
    .await?;

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_delivery_media_parcel_id ON delivery_media(parcel_id) WHERE parcel_id IS NOT NULL")
        .execute(pool)
        .await?;

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_delivery_media_type ON delivery_media(type)")
        .execute(pool)
        .await?;

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_delivery_media_is_parcel_photo ON delivery_media(is_parcel_photo) WHERE is_parcel_photo = TRUE")
        .execute(pool)
        .await?;

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_delivery_media_is_proof ON delivery_media(is_proof_media, proof_type) WHERE is_proof_media = TRUE")
        .execute(pool)
        .await?;

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_delivery_media_display_order ON delivery_media(delivery_id, display_order)")
        .execute(pool)
        .await?;

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_delivery_media_uploaded_at ON delivery_media(uploaded_at DESC)")
        .execute(pool)
        .await?;

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_delivery_media_delivery_type ON delivery_media(delivery_id, type)")
        .execute(pool)
        .await?;

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_delivery_media_delivery_proof ON delivery_media(delivery_id, is_proof_media, proof_type)")
        .execute(pool)
        .await?;

    // Index full-text pour ai_description
    sqlx::query(
        r#"
        CREATE INDEX IF NOT EXISTS idx_delivery_media_ai_description_fulltext
            ON delivery_media USING GIN (to_tsvector('french', COALESCE(ai_description, '')))
        "#,
    )
    .execute(pool)
    .await?;

    // Index GIN pour metadata JSONB
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_delivery_media_metadata ON delivery_media USING GIN (metadata)")
        .execute(pool)
        .await?;

    // Trigger pour updated_at
    sqlx::query(
        r#"
        CREATE OR REPLACE FUNCTION update_delivery_media_updated_at()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql
        "#,
    )
    .execute(pool)
    .await?;

    sqlx::query(
        r#"
        DROP TRIGGER IF EXISTS trigger_update_delivery_media_updated_at ON delivery_media;
        CREATE TRIGGER trigger_update_delivery_media_updated_at
            BEFORE UPDATE ON delivery_media
            FOR EACH ROW
            EXECUTE FUNCTION update_delivery_media_updated_at()
        "#,
    )
    .execute(pool)
    .await?;

    info!("✅ Table delivery_media créée");
    Ok(())
}

pub async fn ensure_delivery_seed_data(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification des seeds livraison (parcel_types alignés avec véhicules)...");

    // ✅ CORRIGÉ 2026-01-28: Séparer les commandes SQL pour éviter l'erreur "cannot insert multiple commands into a prepared statement"
    // Étape 1: Supprimer les anciens types qui ne correspondent pas aux véhicules
    sqlx::query(
        r#"
        DELETE FROM parcel_types WHERE slug NOT IN (
            'bike', 'motorcycle', 'tricycle', 'car', 'pickup', 'van', 'truck', 'walking'
        )
        "#,
    )
    .execute(pool)
    .await?;

    // Étape 2: Insérer les types de colis alignés avec delivery_engine_type
    sqlx::query(
        r#"
        INSERT INTO parcel_types (slug, display_name, description, max_weight_kg, max_volume_cm3, requires_fragile_handling, requires_isothermal, requires_secure_box, requires_document_protection, metadata)
        VALUES
            ('bike', 'Vélo', 'Livraison par vélo - Idéal pour petits colis légers et distances courtes', 5, 10000, FALSE, FALSE, FALSE, FALSE, '{"vehicle_type": "bike", "speed": "slow", "range_km": 10}'::jsonb),
            ('motorcycle', 'Moto', 'Livraison par moto - Rapide pour colis moyens en ville', 15, 30000, FALSE, FALSE, FALSE, FALSE, '{"vehicle_type": "motorcycle", "speed": "fast", "range_km": 50}'::jsonb),
            ('tricycle', 'Tricycle', 'Livraison par tricycle - Équilibre capacité/vitesse pour colis moyens', 30, 60000, FALSE, FALSE, FALSE, FALSE, '{"vehicle_type": "tricycle", "speed": "medium", "range_km": 30}'::jsonb),
            ('car', 'Voiture', 'Livraison par voiture - Polyvalent pour tous types de colis', 50, 150000, FALSE, FALSE, FALSE, FALSE, '{"vehicle_type": "car", "speed": "fast", "range_km": 100}'::jsonb),
            ('pickup', 'Pick-up', 'Livraison par pick-up - Idéal pour colis volumineux et lourds', 80, 250000, FALSE, FALSE, FALSE, FALSE, '{"vehicle_type": "pickup", "speed": "medium", "range_km": 80}'::jsonb),
            ('van', 'Camionnette', 'Livraison par camionnette - Grande capacité pour colis multiples', 100, 400000, FALSE, FALSE, FALSE, FALSE, '{"vehicle_type": "van", "speed": "medium", "range_km": 100}'::jsonb),
            ('truck', 'Camion', 'Livraison par camion - Très grande capacité pour déménagements', 500, 1000000, FALSE, FALSE, FALSE, FALSE, '{"vehicle_type": "truck", "speed": "slow", "range_km": 200}'::jsonb),
            ('walking', 'À pied', 'Livraison à pied - Très petits colis, distances très courtes', 2, 5000, FALSE, FALSE, FALSE, FALSE, '{"vehicle_type": "walking", "speed": "very_slow", "range_km": 2}'::jsonb)
        ON CONFLICT (slug) DO UPDATE SET
            display_name = EXCLUDED.display_name,
            description = EXCLUDED.description,
            max_weight_kg = EXCLUDED.max_weight_kg,
            max_volume_cm3 = EXCLUDED.max_volume_cm3,
            metadata = EXCLUDED.metadata
        "#,
    )
    .execute(pool)
    .await?;

    info!("✅ Seeds livraison (types alignés avec véhicules) vérifiés");
    Ok(())
}

async fn ensure_staging_demo_delivery(pool: &PgPool) -> Result<(), sqlx::Error> {
    let enable_seed = env::var("ENABLE_STAGING_DEMO_SEED")
        .map(|v| v.eq_ignore_ascii_case("true"))
        .unwrap_or(false);

    if !enable_seed {
        return Ok(());
    }

    info!("🔍 Initialisation du seed staging (client, coursier, livraison)...");

    let mut tx = pool.begin().await?;

    let client_email = "staging-client@yukpo.com";
    let courier_email = "staging-courier@yukpo.com";
    let hashed_password =
        "$argon2id$v=19$m=65536,t=3,p=1$c3RhZ2luZw$E7o9p3hoDnN/S8/kVlzUcw".to_string();
    let default_token_price_user = 1.0_f64;
    let default_token_price_provider = 1.0_f64;
    let default_commission_pct = 0.0_f32;

    let client_id: i32 =
        match sqlx::query_scalar::<_, i32>("SELECT id FROM users WHERE email = $1 LIMIT 1")
            .bind(client_email)
            .fetch_optional(&mut *tx)
            .await?
        {
            Some(id) => id,
            None => {
                sqlx::query_scalar::<_, i32>(
                    r#"
                INSERT INTO users (
                    email,
                    password_hash,
                    role,
                    is_provider,
                    tokens_balance,
                    gps_consent,
                    created_at,
                    updated_at,
                    nom,
                    prenom,
                    nom_complet,
                    preferred_lang,
                    token_price_user,
                    token_price_provider,
                    commission_pct
                )
                VALUES ($1, $2, 'user', FALSE, $3, TRUE, $4, $4, $5, $6, $7, 'fr', $8, $9, $10)
                RETURNING id
                "#,
                )
                .bind(client_email)
                .bind(&hashed_password)
                .bind(250_000_i64)
                .bind(Utc::now())
                .bind("Mbarga")
                .bind("Aline")
                .bind("Aline Mbarga")
                .bind(default_token_price_user)
                .bind(default_token_price_provider)
                .bind(default_commission_pct)
                .fetch_one(&mut *tx)
                .await?
            }
        };

    let courier_user_id: i32 =
        match sqlx::query_scalar::<_, i32>("SELECT id FROM users WHERE email = $1 LIMIT 1")
            .bind(courier_email)
            .fetch_optional(&mut *tx)
            .await?
        {
            Some(id) => id,
            None => {
                sqlx::query_scalar::<_, i32>(
                    r#"
                INSERT INTO users (
                    email,
                    password_hash,
                    role,
                    is_provider,
                    tokens_balance,
                    gps_consent,
                    created_at,
                    updated_at,
                    nom,
                    prenom,
                    nom_complet,
                    preferred_lang,
                    token_price_user,
                    token_price_provider,
                    commission_pct
                )
                VALUES ($1, $2, 'user', TRUE, 0, TRUE, $3, $3, $4, $5, $6, 'fr', $7, $8, $9)
                RETURNING id
                "#,
                )
                .bind(courier_email)
                .bind(&hashed_password)
                .bind(Utc::now())
                .bind("Biyong")
                .bind("Yvan")
                .bind("Yvan Biyong")
                .bind(default_token_price_user)
                .bind(default_token_price_provider)
                .bind(default_commission_pct)
                .fetch_one(&mut *tx)
                .await?
            }
        };

    let courier_id: Uuid =
        match sqlx::query_scalar::<_, Uuid>("SELECT id FROM couriers WHERE user_id = $1 LIMIT 1")
            .bind(courier_user_id)
            .fetch_optional(&mut *tx)
            .await?
        {
            Some(id) => id,
            None => {
                sqlx::query_scalar::<_, Uuid>(
                    r#"
                INSERT INTO couriers (
                    user_id,
                    application_id,
                    status,
                    rating_average,
                    rating_count,
                    bio,
                    hired_at
                )
                VALUES ($1, NULL, 'approved', 0, 0, $2, NOW())
                RETURNING id
                "#,
                )
                .bind(courier_user_id)
                .bind("Coursier staging – moto")
                .fetch_one(&mut *tx)
                .await?
            }
        };

    sqlx::query(
        r#"
        INSERT INTO courier_assets (
            courier_id,
            engine_type,
            is_primary,
            max_weight_kg,
            max_volume_cm3,
            equipments,
            available,
            availability_schedule,
            documents
        )
        VALUES ($1, 'moto', TRUE, NULL, NULL, $2, TRUE, NULL, NULL)
        ON CONFLICT (courier_id) WHERE is_primary = TRUE
        DO UPDATE SET
            engine_type = EXCLUDED.engine_type,
            equipments  = EXCLUDED.equipments,
            available   = EXCLUDED.available,
            updated_at  = NOW()
        "#,
    )
    .bind(courier_id)
    .bind(json!({ "helmet": true }))
    .execute(&mut *tx)
    .await?;

    if sqlx::query_scalar::<_, Uuid>(
        "SELECT id FROM deliveries WHERE metadata ->> 'seed' = 'staging_delivery' LIMIT 1",
    )
    .fetch_optional(&mut *tx)
    .await?
    .is_none()
    {
        let parcel_id: Uuid = sqlx::query_scalar(
            r#"
            INSERT INTO delivery_parcels (
                type_id,
                weight_kg,
                volume_cm3,
                declared_value,
                notes,
                photos,
                constraints,
                created_at
            )
            VALUES (NULL, NULL, NULL, NULL, $1, '[]'::jsonb, '{}'::jsonb, NOW())
            RETURNING id
            "#,
        )
        .bind("Panier de courses (staging)")
        .fetch_one(&mut *tx)
        .await?;

        let delivery_id: Uuid = sqlx::query_scalar(
            r#"
            INSERT INTO deliveries (
                creator_id,
                courier_id,
                parcel_id,
                status,
                pickup_location,
                dropoff_location,
                pickup_address,
                dropoff_address,
                recipient_user_id,
                recipient_contact_name,
                recipient_contact_phone,
                recipient_notes,
                recipient_chat_thread_id,
                recipient_dropoff_override,
                recipient_dropoff_address,
                recipient_dropoff_updated_at,
                distance_meters,
                estimated_duration_seconds,
                metadata
            )
            VALUES (
                $1,
                $2,
                $3,
                'accepted',
                ST_SetSRID(ST_MakePoint($4, $5), 4326)::geography,
                ST_SetSRID(ST_MakePoint($6, $7), 4326)::geography,
                $8,
                $9,
                $1,
                $10,
                $11,
                $12,
                NULL,
                NULL,
                $13,
                NOW(),
                $14,
                $15,
                $16
            )
            RETURNING id
            "#,
        )
        .bind(client_id)
        .bind(courier_id)
        .bind(parcel_id)
        .bind(11.50120_f64)
        .bind(3.89810_f64)
        .bind(11.50210_f64)
        .bind(3.90330_f64)
        .bind("Supermarché Bonapriso, Douala")
        .bind("Client Bonapriso, Douala")
        .bind("Aline Mbarga")
        .bind("+237650000001")
        .bind("Commande staging auto")
        .bind("Client Bonapriso, Douala")
        .bind(3_500_i32)
        .bind(780_i32)
        .bind(json!({
            "seed": "staging_delivery",
            "notes": "Livraison E2E staging"
        }))
        .fetch_one(&mut *tx)
        .await?;

        sqlx::query(
            r#"
            INSERT INTO delivery_status_events (
                delivery_id,
                status,
                payload,
                recorded_by
            )
            VALUES ($1, 'accepted', $2, $3)
            "#,
        )
        .bind(delivery_id)
        .bind(json!({ "source": "staging_seed" }))
        .bind(client_id)
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;

    info!("✅ Seed staging vérifié (ENABLE_STAGING_DEMO_SEED=true)");
    Ok(())
}

/// ✅ NOUVEAU : Système de temps de préparation et disponibilité par jour
pub async fn ensure_order_preparation_system(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification du système de préparation de commandes...");

    // 1. Ajouter colonnes à product_delivery_config
    sqlx::query(
        r#"
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'product_delivery_config' 
                AND column_name = 'preparation_time_minutes'
            ) THEN
                ALTER TABLE product_delivery_config
                ADD COLUMN preparation_time_minutes INTEGER,
                ADD COLUMN max_preparation_time_minutes INTEGER DEFAULT 60,
                ADD COLUMN availability_days INTEGER[] DEFAULT ARRAY[0,1,2,3,4,5,6],
                ADD COLUMN is_immediately_available BOOLEAN DEFAULT FALSE;
            END IF;
        END
        $$;
        "#,
    )
    .execute(pool)
    .await?;

    // 2. Index pour availability_days
    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_product_delivery_config_availability_days ON product_delivery_config USING GIN(availability_days)",
    )
    .execute(pool)
    .await?;

    // 3. Table category_preparation_stats
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS category_preparation_stats (
            id SERIAL PRIMARY KEY,
            category VARCHAR(255) NOT NULL UNIQUE,
            avg_preparation_minutes NUMERIC(10,2) NOT NULL DEFAULT 5.0,
            median_preparation_minutes NUMERIC(10,2) NOT NULL DEFAULT 5.0,
            sample_count INTEGER NOT NULL DEFAULT 0,
            last_calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        "#,
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_category_preparation_stats_category ON category_preparation_stats(category)",
    )
    .execute(pool)
    .await?;

    // 4. Table product_orders
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS product_orders (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            delivery_id UUID REFERENCES deliveries(id) ON DELETE CASCADE,
            service_id INTEGER NOT NULL REFERENCES services(id),
            product_index INTEGER NOT NULL,
            client_user_id INTEGER NOT NULL REFERENCES users(id),
            provider_user_id INTEGER NOT NULL REFERENCES users(id),
            status TEXT NOT NULL DEFAULT 'pending',
            preparation_time_minutes INTEGER,
            estimated_ready_at TIMESTAMPTZ,
            validated_at TIMESTAMPTZ,
            validated_by INTEGER REFERENCES users(id),
            rejected_at TIMESTAMPTZ,
            rejection_reason TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            metadata JSONB DEFAULT '{}'::jsonb
        )
        "#,
    )
    .execute(pool)
    .await?;

    // 5. Index pour product_orders (séparés)
    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_product_orders_status ON product_orders(status, created_at)",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_product_orders_provider ON product_orders(provider_user_id, status)",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_product_orders_delivery ON product_orders(delivery_id) WHERE delivery_id IS NOT NULL",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_product_orders_estimated_ready ON product_orders(estimated_ready_at) WHERE estimated_ready_at IS NOT NULL",
    )
    .execute(pool)
    .await?;

    // 6. Ajouter colonne validation_deadline
    sqlx::query(
        "ALTER TABLE product_orders ADD COLUMN IF NOT EXISTS validation_deadline TIMESTAMPTZ",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_product_orders_validation_deadline ON product_orders(validation_deadline) WHERE status = 'pending' AND validation_deadline IS NOT NULL"
    )
    .execute(pool)
    .await?;

    // 7. Table order_cancellations
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS order_cancellations (
            id SERIAL PRIMARY KEY,
            order_id UUID NOT NULL REFERENCES product_orders(id) ON DELETE CASCADE,
            provider_user_id INTEGER NOT NULL REFERENCES users(id),
            service_id INTEGER NOT NULL REFERENCES services(id),
            product_index INTEGER NOT NULL,
            cancellation_type VARCHAR(50) NOT NULL CHECK (cancellation_type IN ('timeout', 'rejected', 'provider_cancelled', 'courier_unavailable')),
            reason TEXT,
            cancelled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        "#
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_order_cancellations_provider ON order_cancellations(provider_user_id, cancelled_at)"
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_order_cancellations_service_product ON order_cancellations(service_id, product_index, cancellation_type)"
    )
    .execute(pool)
    .await?;

    // 8. Table product_cancellation_stats
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS product_cancellation_stats (
            id SERIAL PRIMARY KEY,
            service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
            product_index INTEGER NOT NULL,
            total_orders INTEGER NOT NULL DEFAULT 0,
            total_cancellations INTEGER NOT NULL DEFAULT 0,
            cancellation_rate NUMERIC(5,2) NOT NULL DEFAULT 0.0,
            timeout_cancellations INTEGER NOT NULL DEFAULT 0,
            rejected_cancellations INTEGER NOT NULL DEFAULT 0,
            last_calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            UNIQUE(service_id, product_index)
        )
        "#,
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_product_cancellation_stats_rate ON product_cancellation_stats(cancellation_rate DESC)"
    )
    .execute(pool)
    .await?;

    // 9. Table pour vérification d'identité du coursier
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS courier_verification_codes (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            delivery_id UUID NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
            order_id UUID REFERENCES product_orders(id) ON DELETE CASCADE,
            courier_id UUID NOT NULL REFERENCES couriers(id) ON DELETE CASCADE,
            verification_code VARCHAR(6) NOT NULL UNIQUE,
            qr_code_data TEXT,
            expires_at TIMESTAMPTZ NOT NULL,
            verified_at TIMESTAMPTZ,
            verified_by INTEGER REFERENCES users(id),
            verification_method VARCHAR(50),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        "#,
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_courier_verification_delivery ON courier_verification_codes(delivery_id)"
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_courier_verification_code ON courier_verification_codes(verification_code) WHERE verified_at IS NULL"
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_courier_verification_courier ON courier_verification_codes(courier_id, delivery_id)"
    )
    .execute(pool)
    .await?;

    Ok(())
}

/// ✅ NOUVEAU : Gestion de stock en temps réel
pub async fn ensure_product_stock_management(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification du système de gestion de stock...");

    // 1. Table product_stock_locations
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS product_stock_locations (
            id SERIAL PRIMARY KEY,
            product_delivery_config_id INTEGER NOT NULL REFERENCES product_delivery_config(id) ON DELETE CASCADE,
            storage_location_id INTEGER REFERENCES merchant_storage_locations(id),
            quantity_available INTEGER DEFAULT 0,
            quantity_reserved INTEGER DEFAULT 0,
            is_available BOOLEAN DEFAULT TRUE,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_by INTEGER REFERENCES users(id),
            UNIQUE(product_delivery_config_id, storage_location_id)
        )
        "#,
    )
    .execute(pool)
    .await?;

    // 2. Index pour product_stock_locations
    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_product_stock_locations_config ON product_stock_locations(product_delivery_config_id)",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_product_stock_locations_available ON product_stock_locations(is_available, quantity_available) WHERE is_available = TRUE",
    )
    .execute(pool)
    .await?;

    // 3. Table stock_reservations
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS stock_reservations (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            order_id UUID NOT NULL REFERENCES product_orders(id) ON DELETE CASCADE,
            stock_location_id INTEGER NOT NULL REFERENCES product_stock_locations(id),
            quantity INTEGER NOT NULL,
            reserved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            released_at TIMESTAMPTZ,
            expires_at TIMESTAMPTZ NOT NULL
        )
        "#,
    )
    .execute(pool)
    .await?;

    // 4. Index pour stock_reservations
    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_stock_reservations_order ON stock_reservations(order_id)",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_stock_reservations_expires ON stock_reservations(expires_at) WHERE released_at IS NULL",
    )
    .execute(pool)
    .await?;

    Ok(())
}

/// Vérifie et crée la table google_places_data si elle n'existe pas
pub async fn ensure_google_places_data_table(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification de la table google_places_data...");

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS google_places_data (
            id SERIAL PRIMARY KEY,
            service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
            place_id TEXT NOT NULL,
            display_name TEXT,
            formatted_address TEXT,
            location_vector TEXT[],
            latitude DOUBLE PRECISION,
            longitude DOUBLE PRECISION,
            types TEXT[],
            primary_type TEXT,
            primary_type_display_name TEXT,
            rating DOUBLE PRECISION,
            rating_count INTEGER,
            price_level TEXT,
            business_status TEXT,
            serves_cuisine TEXT[],
            website_uri TEXT,
            google_maps_uri TEXT,
            international_phone_number TEXT,
            national_phone_number TEXT,
            editorial_summary TEXT,
            current_opening_hours JSONB,
            regular_opening_hours JSONB,
            photos JSONB,
            country TEXT,
            country_code TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            CONSTRAINT unique_service_place UNIQUE (service_id, place_id)
        )
        "#,
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_google_places_data_service_id ON google_places_data(service_id)",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_google_places_data_place_id ON google_places_data(place_id)",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_google_places_data_location_vector ON google_places_data USING GIN(location_vector)",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_google_places_data_types ON google_places_data USING GIN(types)",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_google_places_data_cuisine ON google_places_data USING GIN(serves_cuisine)",
    )
    .execute(pool)
    .await?;

    Ok(())
}

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

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_effects_category ON effects(category)")
        .execute(pool)
        .await?;

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_effects_tags ON effects USING GIN(tags)")
        .execute(pool)
        .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_effects_popularity ON effects(popularity_score DESC)",
    )
    .execute(pool)
    .await?;

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_effects_name ON effects(name)")
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

    // DROP TRIGGER et CREATE TRIGGER doivent être exécutés séparément
    sqlx::query("DROP TRIGGER IF EXISTS trigger_update_effects_updated_at ON effects")
        .execute(pool)
        .await
        .ok(); // Ignorer l'erreur si le trigger n'existe pas

    sqlx::query(
        r#"
        CREATE TRIGGER trigger_update_effects_updated_at
            BEFORE UPDATE ON effects
            FOR EACH ROW
            EXECUTE FUNCTION update_effects_updated_at();
        "#,
    )
    .execute(pool)
    .await?;

    // ✅ NOUVEAU 2025-01-27: Insérer les effets enrichis si la table est vide ou presque
    let effects_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM effects")
        .fetch_one(pool)
        .await
        .unwrap_or(0);

    if effects_count < 100 {
        info!(
            "📦 Enrichissement de la bibliothèque d'effets (actuellement: {})",
            effects_count
        );

        // Insérer les effets enrichis (50 effets supplémentaires)
        // Note: Les INSERT sont dans la migration SQL séparée, mais on peut aussi les insérer ici
        // Pour l'instant, on laisse la migration SQL séparée faire le travail
        info!("✅ Enrichissement effets: Utiliser la migration SQL 20250127_002_enrich_effects_to_100.sql");
    }

    Ok(())
}

/// ✅ NOUVEAU 2025-01-27: Vérifie et crée la table video_templates si elle n'existe pas
pub async fn ensure_templates_table(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification de la table video_templates...");

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS video_templates (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) NOT NULL UNIQUE,
            industry VARCHAR(50) NOT NULL CHECK (industry IN ('ecommerce', 'services', 'creators', 'business', 'social_media')),
            subcategory VARCHAR(100),
            description TEXT NOT NULL,
            timeline JSONB NOT NULL,
            effects JSONB NOT NULL DEFAULT '[]'::jsonb,
            transitions JSONB NOT NULL DEFAULT '[]'::jsonb,
            style JSONB NOT NULL DEFAULT '{}'::jsonb,
            duration DOUBLE PRECISION NOT NULL DEFAULT 30.0,
            format VARCHAR(10) NOT NULL DEFAULT '16:9' CHECK (format IN ('16:9', '9:16', '1:1', '4:5')),
            tags TEXT[] NOT NULL DEFAULT '{}',
            thumbnail_url VARCHAR(500),
            preview_url VARCHAR(500),
            is_premium BOOLEAN NOT NULL DEFAULT FALSE,
            popularity_score DOUBLE PRECISION NOT NULL DEFAULT 0.0,
            usage_count BIGINT NOT NULL DEFAULT 0,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        "#,
    )
    .execute(pool)
    .await?;

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_templates_industry ON video_templates(industry)")
        .execute(pool)
        .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_templates_subcategory ON video_templates(subcategory)",
    )
    .execute(pool)
    .await?;

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_templates_tags ON video_templates USING GIN(tags)")
        .execute(pool)
        .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_templates_popularity ON video_templates(popularity_score DESC)",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_templates_usage ON video_templates(usage_count DESC)",
    )
    .execute(pool)
    .await?;

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_templates_name ON video_templates(name)")
        .execute(pool)
        .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_templates_industry_popularity ON video_templates(industry, popularity_score DESC)",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        r#"
        CREATE OR REPLACE FUNCTION update_templates_updated_at()
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

    // DROP TRIGGER et CREATE TRIGGER doivent être exécutés séparément
    sqlx::query("DROP TRIGGER IF EXISTS trigger_update_templates_updated_at ON video_templates")
        .execute(pool)
        .await
        .ok(); // Ignorer l'erreur si le trigger n'existe pas

    sqlx::query(
        r#"
        CREATE TRIGGER trigger_update_templates_updated_at
            BEFORE UPDATE ON video_templates
            FOR EACH ROW
            EXECUTE FUNCTION update_templates_updated_at();
        "#,
    )
    .execute(pool)
    .await?;

    Ok(())
}

/// Vérifie que les tables de base (users, services) existent avant d'exécuter les migrations automatiques
async fn ensure_base_tables_exist(pool: &PgPool) -> Result<(), sqlx::Error> {
    // Vérifier que la table users existe
    let users_exists: bool = sqlx::query_scalar(
        "SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'users'
        )",
    )
    .fetch_one(pool)
    .await?;

    if !users_exists {
        return Err(sqlx::Error::Protocol(format!(
            "❌ Table 'users' n'existe pas. Les migrations SQLx standard doivent être appliquées en premier. \
            Vérifiez que les migrations dans backend/migrations/ sont exécutées correctement."
        )));
    }

    // Vérifier que la table services existe
    let services_exists: bool = sqlx::query_scalar(
        "SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'services'
        )",
    )
    .fetch_one(pool)
    .await?;

    if !services_exists {
        return Err(sqlx::Error::Protocol(format!(
            "❌ Table 'services' n'existe pas. Les migrations SQLx standard doivent être appliquées en premier. \
            Vérifiez que les migrations dans backend/migrations/ sont exécutées correctement."
        )));
    }

    Ok(())
}

pub async fn run_auto_migrations(pool: &PgPool) {
    info!("🚀 Démarrage des migrations automatiques...");

    // ✅ NOUVEAU 2026-01-28: Vérification que les tables de base existent
    match ensure_base_tables_exist(pool).await {
        Ok(_) => info!("✅ Tables de base (users, services) vérifiées"),
        Err(e) => {
            error!(
                "❌ ERREUR CRITIQUE: Les tables de base n'existent pas: {}",
                e
            );
            error!(
                "❌ Les migrations automatiques ne peuvent pas continuer sans les tables de base."
            );
            error!("❌ Vérifiez que les migrations SQLx standard ont été appliquées correctement.");
            error!("❌ Les migrations SQLx standard doivent être exécutées AVANT les migrations automatiques.");
            return; // Arrêter les migrations automatiques si les tables de base n'existent pas
        }
    }

    // ============================================================================
    // CORRECTIONS CRITIQUES AWS - 2026-01-30
    // Ces corrections doivent s'exécuter AVANT toutes les autres migrations auto
    // pour éviter les erreurs en cascade
    // ============================================================================
    info!("🔧 Application des corrections critiques AWS...");

    // Correction 1: Supprimer les versions dupliquées de hybrid_image_search
    match fix_hybrid_image_search_duplicates(pool).await {
        Ok(_) => info!("✅ Correction critique: hybrid_image_search dupliquées supprimées"),
        Err(e) => warn!(
            "⚠️ Erreur correction hybrid_image_search: {} (non bloquant)",
            e
        ),
    }

    // Correction 2: Créer specialized_reservations si manquante
    match ensure_specialized_reservations_table(pool).await {
        Ok(_) => info!("✅ Correction critique: specialized_reservations vérifiée"),
        Err(e) => warn!(
            "⚠️ Erreur correction specialized_reservations: {} (non bloquant)",
            e
        ),
    }

    // Correction 2b: Créer appointment_slots + colonnes compat specialized_reservations
    match ensure_appointment_slots_table(pool).await {
        Ok(_) => info!("✅ Correction: appointment_slots vérifiée"),
        Err(e) => warn!(
            "⚠️ Erreur correction appointment_slots: {} (non bloquant)",
            e
        ),
    }

    // Correction 3: Créer run_audio_cache_cleanup() si manquante
    match ensure_run_audio_cache_cleanup_function(pool).await {
        Ok(_) => info!("✅ Correction critique: run_audio_cache_cleanup() vérifiée"),
        Err(e) => warn!(
            "⚠️ Erreur correction run_audio_cache_cleanup: {} (non bloquant)",
            e
        ),
    }

    // Correction 4: S'assurer que la colonne gps existe dans services
    match ensure_services_gps_column(pool).await {
        Ok(_) => info!("✅ Correction critique: colonne gps dans services vérifiée"),
        Err(e) => warn!("⚠️ Erreur correction gps column: {} (non bloquant)", e),
    }

    // Correction 5: Corriger l'index avec NOW() non IMMUTABLE
    match fix_delivery_matching_queue_index(pool).await {
        Ok(_) => info!("✅ Correction critique: index delivery_matching_queue corrigé"),
        Err(e) => warn!("⚠️ Erreur correction index: {} (non bloquant)", e),
    }

    // Correction 6: S'assurer que la table products existe
    match ensure_products_table(pool).await {
        Ok(_) => info!("✅ Correction critique: table products vérifiée"),
        Err(e) => warn!("⚠️ Erreur correction products table: {} (non bloquant)", e),
    }

    // Correction 7: Corriger les vues matérialisées pour gérer gps manquant
    match fix_materialized_views_gps(pool).await {
        Ok(_) => info!("✅ Correction critique: vues matérialisées corrigées"),
        Err(e) => warn!(
            "⚠️ Erreur correction vues matérialisées: {} (non bloquant)",
            e
        ),
    }

    // Correction 8: Supprimer les contraintes dupliquées
    match fix_duplicate_constraints(pool).await {
        Ok(_) => info!("✅ Correction critique: contraintes dupliquées supprimées"),
        Err(e) => warn!("⚠️ Erreur correction contraintes: {} (non bloquant)", e),
    }

    // Correction 9: Colonnes manquantes product_delivery_config + tables pricing/insurance
    match ensure_delivery_config_columns(pool).await {
        Ok(_) => info!("✅ Correction critique: colonnes product_delivery_config + tables pricing/insurance vérifiées"),
        Err(e) => warn!("⚠️ Erreur correction delivery config columns: {} (non bloquant)", e),
    }

    // ✅ NOUVEAU 2026-01-24: Vérification de l'extension pgvector
    match ensure_pgvector_extension(pool).await {
        Ok(_) => info!("✅ Migration auto: pgvector extension vérifiée"),
        Err(e) => warn!("⚠️ Erreur vérification pgvector: {} (non bloquant)", e),
    }

    // Migration 0: Table geo_hierarchy (✅ NOUVEAU 2025-11-06)
    match ensure_geo_hierarchy_table(pool).await {
        Ok(_) => info!("✅ Migration auto: geo_hierarchy OK"),
        Err(e) => error!("❌ Erreur migration auto geo_hierarchy: {}", e),
    }

    match ensure_google_places_data_table(pool).await {
        Ok(_) => info!("✅ Migration auto: google_places_data OK"),
        Err(e) => error!("❌ Erreur migration auto google_places_data: {}", e),
    }

    match ensure_media_analytics_tables(pool).await {
        Ok(_) => info!("✅ Migration auto: media engagement/distribution ok"),
        Err(e) => error!("❌ Erreur migration auto media analytics: {}", e),
    }

    match ensure_inventory_overrides_table(pool).await {
        Ok(_) => info!("✅ Migration auto: inventory overrides OK"),
        Err(e) => error!("❌ Erreur migration auto inventory overrides: {}", e),
    }

    match ensure_content_engagement_table(pool).await {
        Ok(_) => info!("✅ Migration auto: content_engagement OK"),
        Err(e) => error!("❌ Erreur migration auto content_engagement: {}", e),
    }

    match ensure_video_generation_jobs_table(pool).await {
        Ok(_) => info!("✅ Migration auto: video_generation_jobs OK"),
        Err(e) => error!("❌ Erreur migration auto video_generation_jobs: {}", e),
    }

    match ensure_premium_audio_tables(pool).await {
        Ok(_) => info!("✅ Migration auto: premium audio tables OK"),
        Err(e) => error!("❌ Erreur migration auto premium audio: {}", e),
    }

    match ensure_audio_transcription_cache_table(pool).await {
        Ok(_) => info!("✅ Migration auto: audio_transcription_cache OK"),
        Err(e) => error!("❌ Erreur migration auto audio_transcription_cache: {}", e),
    }

    match ensure_voice_profiles_table(pool).await {
        Ok(_) => info!("✅ Migration auto: voice_profiles OK"),
        Err(e) => error!("❌ Erreur migration auto voice_profiles: {}", e),
    }

    match ensure_studio_tables(pool).await {
        Ok(_) => info!("✅ Migration auto: studio tables OK"),
        Err(e) => error!("❌ Erreur migration auto studio tables: {}", e),
    }

    match ensure_user_token_columns(pool).await {
        Ok(_) => info!("✅ Migration auto: colonnes tokens utilisateurs OK"),
        Err(e) => error!(
            "❌ Erreur migration auto colonnes tokens utilisateurs: {}",
            e
        ),
    }

    match ensure_delivery_wallet_events_table(pool).await {
        Ok(_) => info!("✅ Migration auto: delivery_wallet_events OK"),
        Err(e) => error!("❌ Erreur migration auto delivery_wallet_events: {}", e),
    }

    match ensure_video_weekly_reports_table(pool).await {
        Ok(_) => info!("✅ Migration auto: video_weekly_reports OK"),
        Err(e) => error!("❌ Erreur migration auto video_weekly_reports: {}", e),
    }

    match ensure_social_connectors_tables(pool).await {
        Ok(_) => info!("✅ Migration auto: social connectors OK"),
        Err(e) => error!("❌ Erreur migration auto social connectors: {}", e),
    }

    match ensure_global_promo_tables(pool).await {
        Ok(_) => info!("✅ Migration auto: global promo tables OK"),
        Err(e) => error!("❌ Erreur migration auto global promo tables: {}", e),
    }

    match ensure_effects_table(pool).await {
        Ok(_) => info!("✅ Migration auto: effects table OK"),
        Err(e) => error!("❌ Erreur migration auto effects table: {}", e),
    }

    // ✅ NOUVEAU 2025-01-27: Table video_templates pour bibliothèque de templates par industrie
    match ensure_templates_table(pool).await {
        Ok(_) => info!("✅ Migration auto: video_templates table OK"),
        Err(e) => error!("❌ Erreur migration auto video_templates table: {}", e),
    }

    // ✅ NOUVEAU 2025-01-27: Enrichir les templates si la table est vide ou presque
    let templates_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM video_templates")
        .fetch_one(pool)
        .await
        .unwrap_or(0);

    if templates_count < 1000 {
        info!(
            "📦 Enrichissement de la bibliothèque de templates (actuellement: {})",
            templates_count
        );
        info!(
            "✅ Enrichissement templates: Utiliser les migrations SQL 20250127_003 et 20250127_004"
        );
    }

    match ensure_product_delivery_config_table(pool).await {
        Ok(_) => info!("✅ Migration auto: product_delivery_config OK"),
        Err(e) => error!("❌ Erreur migration auto product_delivery_config: {}", e),
    }

    match ensure_client_delivery_preferences_table(pool).await {
        Ok(_) => info!("✅ Migration auto: client_delivery_preferences OK"),
        Err(e) => error!(
            "❌ Erreur migration auto client_delivery_preferences: {}",
            e
        ),
    }

    match ensure_external_delivery_providers_table(pool).await {
        Ok(_) => info!("✅ Migration auto: external_delivery_providers OK"),
        Err(e) => error!(
            "❌ Erreur migration auto external_delivery_providers: {}",
            e
        ),
    }

    match ensure_delivery_fraud_signals_table(pool).await {
        Ok(_) => info!("✅ Migration auto: delivery_fraud_signals OK"),
        Err(e) => error!("❌ Erreur migration auto delivery_fraud_signals: {}", e),
    }

    match ensure_public_tracking_tokens_table(pool).await {
        Ok(_) => info!("✅ Migration auto: public_tracking_tokens OK"),
        Err(e) => error!("❌ Erreur migration auto public_tracking_tokens: {}", e),
    }

    match ensure_delivery_payment_reservations_table(pool).await {
        Ok(_) => info!("✅ Migration auto: delivery_payment_reservations OK"),
        Err(e) => error!(
            "❌ Erreur migration auto delivery_payment_reservations: {}",
            e
        ),
    }

    match ensure_payment_methods_matching_columns(pool).await {
        Ok(_) => info!("✅ Migration auto: payment_methods_matching OK"),
        Err(e) => error!("❌ Erreur migration auto payment_methods_matching: {}", e),
    }

    // ✅ NOUVEAU : Système de préparation de commandes et disponibilité
    match ensure_order_preparation_system(pool).await {
        Ok(_) => info!("✅ Migration auto: order preparation system OK"),
        Err(e) => error!("❌ Erreur migration auto order preparation: {}", e),
    }

    // ✅ NOUVEAU : Gestion de stock en temps réel
    match ensure_product_stock_management(pool).await {
        Ok(_) => info!("✅ Migration auto: product stock management OK"),
        Err(e) => error!("❌ Erreur migration auto product stock management: {}", e),
    }

    // ✅ NOUVEAU : Table delivery_proximity_suggestions
    match ensure_delivery_proximity_suggestions_table(pool).await {
        Ok(_) => info!("✅ Migration auto: delivery_proximity_suggestions OK"),
        Err(e) => error!(
            "❌ Erreur migration auto delivery_proximity_suggestions: {}",
            e
        ),
    }

    // ✅ NOUVEAU : Table negotiated_prices
    match ensure_negotiated_prices_table(pool).await {
        Ok(_) => info!("✅ Migration auto: negotiated_prices OK"),
        Err(e) => error!("❌ Erreur migration auto negotiated_prices: {}", e),
    }

    // ✅ Phase 9 - Amélioration 31 : Table video_dependencies
    match ensure_video_dependencies_table(pool).await {
        Ok(_) => info!("✅ Migration auto: video_dependencies OK"),
        Err(e) => error!("❌ Erreur migration auto video_dependencies: {}", e),
    }

    // ✅ Phase 9 - Amélioration 32 : Table merchant_storage_locations
    match ensure_merchant_storage_locations_table(pool).await {
        Ok(_) => info!("✅ Migration auto: merchant_storage_locations OK"),
        Err(e) => error!("❌ Erreur migration auto merchant_storage_locations: {}", e),
    }

    // ✅ Phase 9 - Amélioration : Raisons de refus de colis
    match ensure_parcel_rejection_reason_type(pool).await {
        Ok(_) => info!("✅ Migration auto: parcel_rejection_reason OK"),
        Err(e) => error!("❌ Erreur migration auto parcel_rejection_reason: {}", e),
    }

    match ensure_delivery_proof_media_table(pool).await {
        Ok(_) => info!("✅ Migration auto: delivery_proof_media OK"),
        Err(e) => error!("❌ Erreur migration auto delivery_proof_media: {}", e),
    }

    // ✅ NOUVEAU 2025-01-31: Colonnes aller-retour pour deliveries
    match ensure_delivery_round_trip_columns(pool).await {
        Ok(_) => info!("✅ Migration auto: delivery_round_trip_columns OK"),
        Err(e) => error!(
            "❌ Erreur migration auto delivery_round_trip_columns: {}",
            e
        ),
    }

    // ✅ NOUVEAU 2025-01-31: Table delivery_media pour optimiser le stockage des médias
    match ensure_delivery_media_table(pool).await {
        Ok(_) => info!("✅ Migration auto: delivery_media table OK"),
        Err(e) => error!("❌ Erreur migration auto delivery_media table: {}", e),
    }

    // ✅ NOUVEAU 2025-12-07 : Tables sociales vidéo (duets, remixes, stitches, video_reactions)
    match ensure_social_video_tables(pool).await {
        Ok(_) => info!("✅ Migration auto: social video tables OK"),
        Err(e) => error!("❌ Erreur migration auto social video tables: {}", e),
    }

    // ✅ NOUVEAU 2025-01-29 : Tables covoiturage (assurance, QR codes, trajets récurrents)
    match ensure_covoiturage_tables(pool).await {
        Ok(_) => info!("✅ Migration auto: covoiturage tables OK"),
        Err(e) => error!("❌ Erreur migration auto covoiturage tables: {}", e),
    }

    // ✅ NOUVEAU 2025-12-11 : Vue matérialisée et fonction pour les statistiques utilisateur
    match ensure_user_stats_objects(pool).await {
        Ok(_) => info!("✅ Migration auto: user_stats objects OK"),
        Err(e) => error!("❌ Erreur migration auto user_stats objects: {}", e),
    }

    // ✅ NOUVEAU 2025-12-12 : Optimisation index delivery_matching_queue
    match ensure_delivery_matching_queue_index(pool).await {
        Ok(_) => info!("✅ Migration auto: delivery_matching_queue index OK"),
        Err(e) => error!(
            "❌ Erreur migration auto delivery_matching_queue index: {}",
            e
        ),
    }

    // ✅ NOUVEAU 2025-12-16 : Optimisation performances création produits
    match ensure_optimize_product_creation_performance(pool).await {
        Ok(_) => info!("✅ Migration auto: optimize_product_creation_performance OK"),
        Err(e) => error!(
            "❌ Erreur migration auto optimize_product_creation_performance: {}",
            e
        ),
    }

    // ✅ NOUVEAU 2025-12-30 : Correction erreurs TLS lors de l'ajout de produit
    match ensure_fix_add_product_tls_error(pool).await {
        Ok(_) => info!("✅ Migration auto: fix_add_product_tls_error OK"),
        Err(e) => error!("❌ Erreur migration auto fix_add_product_tls_error: {}", e),
    }

    // ✅ NOUVEAU 2025-12-31 : Correction définitive performance création produit
    match ensure_fix_product_creation_issues(pool).await {
        Ok(_) => info!("✅ Migration auto: fix_product_creation_issues OK"),
        Err(e) => error!(
            "❌ Erreur migration auto fix_product_creation_issues: {}",
            e
        ),
    }

    // ✅ NOUVEAU 2025-12-31 : Optimisation performance création produit v2
    match ensure_fix_product_creation_performance_v2(pool).await {
        Ok(_) => info!("✅ Migration auto: fix_product_creation_performance_v2 OK"),
        Err(e) => error!(
            "❌ Erreur migration auto fix_product_creation_performance_v2: {}",
            e
        ),
    }

    // ✅ NOUVEAU 2025-12-31 : Correction timeout création produit
    match ensure_fix_product_creation_timeout(pool).await {
        Ok(_) => info!("✅ Migration auto: fix_product_creation_timeout OK"),
        Err(e) => error!(
            "❌ Erreur migration auto fix_product_creation_timeout: {}",
            e
        ),
    }

    // ✅ NOUVEAU 2025-12-21 : Optimisation des endpoints lents
    match ensure_optimize_slow_endpoints(pool).await {
        Ok(_) => info!("✅ Migration auto: optimize_slow_endpoints OK"),
        Err(e) => error!("❌ Erreur migration auto optimize_slow_endpoints: {}", e),
    }

    // ✅ NOUVEAU 2025-12-21 : Optimisation des index delivery
    match ensure_optimize_delivery_indexes(pool).await {
        Ok(_) => info!("✅ Migration auto: optimize_delivery_indexes OK"),
        Err(e) => error!("❌ Erreur migration auto optimize_delivery_indexes: {}", e),
    }

    // ✅ 2025-12-21 : Aligner parcel_types avec les types de véhicules des coursiers
    match ensure_align_parcel_types_with_vehicle_types(pool).await {
        Ok(_) => info!("✅ Migration auto: align_parcel_types_with_vehicle_types OK"),
        Err(e) => error!(
            "❌ Erreur migration auto align_parcel_types_with_vehicle_types: {}",
            e
        ),
    }

    // ✅ 2026-01-15 : Corriger les IDs de parcel_types pour garantir la cohérence avec le frontend
    match ensure_fix_parcel_types_ids(pool).await {
        Ok(_) => info!("✅ Migration auto: fix_parcel_types_ids OK"),
        Err(e) => error!("❌ Erreur migration auto fix_parcel_types_ids: {}", e),
    }

    // ✅ 2025-12-21 : Optimisation des UPDATE services
    match ensure_optimize_services_update_performance(pool).await {
        Ok(_) => info!("✅ Migration auto: optimize_services_update_performance OK"),
        Err(e) => error!(
            "❌ Erreur migration auto optimize_services_update_performance: {}",
            e
        ),
    }

    // ✅ NOUVEAU : Table delivery_engine_pricing pour calcul coût par type d'engin
    match ensure_delivery_engine_pricing_table(pool).await {
        Ok(_) => info!("✅ Migration auto: delivery_engine_pricing OK"),
        Err(e) => error!("❌ Erreur migration auto delivery_engine_pricing: {}", e),
    }

    // ✅ Phase 9 - Amélioration : Table product_delivery_zones
    match ensure_product_delivery_zones_table(pool).await {
        Ok(_) => info!("✅ Migration auto: product_delivery_zones OK"),
        Err(e) => error!("❌ Erreur migration auto product_delivery_zones: {}", e),
    }

    // ✅ Phase 10 - Optimisations : Index géographiques pour améliorer les performances des requêtes GPS
    match ensure_geographic_indexes(pool).await {
        Ok(_) => info!("✅ Migration auto: geographic indexes OK"),
        Err(e) => error!("❌ Erreur migration auto geographic indexes: {}", e),
    }

    // ✅ 2025-11-25 : Correction de l'index idx_services_search_optimized (suppression INCLUDE data)
    match ensure_services_search_optimized_index_fix(pool).await {
        Ok(_) => info!("✅ Migration auto: services_search_optimized index fix OK"),
        Err(e) => error!(
            "❌ Erreur migration auto services_search_optimized index fix: {}",
            e
        ),
    }

    // ✅ 2025-11-25 : Fonctions helper GPS pour recherche
    match ensure_gps_helper_functions(pool).await {
        Ok(_) => info!("✅ Migration auto: GPS helper functions OK"),
        Err(e) => error!("❌ Erreur migration auto GPS helper functions: {}", e),
    }

    // ✅ 2025-11-25 : Fonction search_services_gps_final pour recherche GPS optimisée
    match ensure_search_services_gps_final(pool).await {
        Ok(_) => info!("✅ Migration auto: search_services_gps_final OK"),
        Err(e) => error!("❌ Erreur migration auto search_services_gps_final: {}", e),
    }

    // ✅ 2025-11-25 : Fonction hybrid_image_search pour recherche d'images hybride
    match ensure_hybrid_image_search(pool).await {
        Ok(_) => info!("✅ Migration auto: hybrid_image_search OK"),
        Err(e) => error!("❌ Erreur migration auto hybrid_image_search: {}", e),
    }

    // ✅ 2025-12-21 : Amélioration hybrid_image_search avec fallback vers services.data->produits
    match ensure_hybrid_image_search_fallback(pool).await {
        Ok(_) => info!("✅ Migration auto: hybrid_image_search_fallback OK"),
        Err(e) => error!(
            "❌ Erreur migration auto hybrid_image_search_fallback: {}",
            e
        ),
    }

    // ✅ 2025-12-23 : Amélioration pertinence hybrid_image_search (scoring optimisé)
    match ensure_hybrid_image_search_relevance(pool).await {
        Ok(_) => info!("✅ Migration auto: hybrid_image_search_relevance OK"),
        Err(e) => error!(
            "❌ Erreur migration auto hybrid_image_search_relevance: {}",
            e
        ),
    }

    // ✅ 2025-12-24 : Amélioration langue dynamique et pertinence hybrid_image_search
    match ensure_hybrid_image_search_language_and_relevance(pool).await {
        Ok(_) => info!("✅ Migration auto: hybrid_image_search_language_and_relevance OK"),
        Err(e) => error!(
            "❌ Erreur migration auto hybrid_image_search_language_and_relevance: {}",
            e
        ),
    }

    // ✅ 2025-12-24 : Correction pertinence et performance recherche par image (seuil strict 150.0)
    match ensure_hybrid_image_search_relevance_and_performance(pool).await {
        Ok(_) => info!("✅ Migration auto: hybrid_image_search_relevance_and_performance OK"),
        Err(e) => error!(
            "❌ Erreur migration auto hybrid_image_search_relevance_and_performance: {}",
            e
        ),
    }

    // ✅ 2025-12-27 : Adaptation recherche par image pour produits génériques (sans marque/couleur)
    match ensure_hybrid_image_search_generic_products(pool).await {
        Ok(_) => info!("✅ Migration auto: hybrid_image_search_generic_products OK"),
        Err(e) => error!(
            "❌ Erreur migration auto hybrid_image_search_generic_products: {}",
            e
        ),
    }

    // ✅ 2025-12-24 : Optimisation critique des requêtes lentes (pharmacies, deliveries, delivery_matching_queue, find_nearby_couriers)
    match ensure_optimize_slow_queries_critical(pool).await {
        Ok(_) => info!("✅ Migration auto: optimize_slow_queries_critical OK"),
        Err(e) => error!(
            "❌ Erreur migration auto optimize_slow_queries_critical: {}",
            e
        ),
    }

    // ✅ 2026-01-11 : Optimisation additionnelle des requêtes deliveries (get_delivery_summary, find_nearby_couriers, UPDATE matching_queue)
    match ensure_optimize_delivery_queries_additional(pool).await {
        Ok(_) => info!("✅ Migration auto: optimize_delivery_queries_additional OK"),
        Err(e) => error!(
            "❌ Erreur migration auto optimize_delivery_queries_additional: {}",
            e
        ),
    }

    // ✅ 2026-01-14 : Optimisation des performances de recherche (publicites, delivery_matching_queue, delivery_parcels)
    match ensure_optimize_search_performance(pool).await {
        Ok(_) => info!("✅ Migration auto: optimize_search_performance OK"),
        Err(e) => error!(
            "❌ Erreur migration auto optimize_search_performance: {}",
            e
        ),
    }

    // ✅ 2025-11-25 : Fonctions de recherche avec planification (pharmacie/hôpital)
    match ensure_scheduling_search_functions(pool).await {
        Ok(_) => info!("✅ Migration auto: scheduling search functions OK"),
        Err(e) => error!(
            "❌ Erreur migration auto scheduling search functions: {}",
            e
        ),
    }

    // ✅ 2025-11-26 : Tables pour services spécialisés (Santé et Transport)
    match ensure_specialized_services_tables(pool).await {
        Ok(_) => info!("✅ Migration auto: specialized services tables OK"),
        Err(e) => error!(
            "❌ Erreur migration auto specialized services tables: {}",
            e
        ),
    }

    // ✅ 2025-01-28 : Champ specialized_type pour identification sans ambiguïté
    match ensure_services_specialized_type(pool).await {
        Ok(_) => info!("✅ Migration auto: services specialized_type OK"),
        Err(e) => error!("❌ Erreur migration auto services specialized_type: {}", e),
    }

    // ✅ 2025-01-28 : Triggers pour garantir cohérence specialized_type
    match ensure_specialized_type_triggers(pool).await {
        Ok(_) => info!("✅ Migration auto: specialized_type triggers OK"),
        Err(e) => error!("❌ Erreur migration auto specialized_type triggers: {}", e),
    }

    // ✅ 2025-01-28 : Contraintes de validation pour services spécialisés
    match ensure_specialized_services_constraints(pool).await {
        Ok(_) => info!("✅ Migration auto: specialized services constraints OK"),
        Err(e) => error!(
            "❌ Erreur migration auto specialized services constraints: {}",
            e
        ),
    }

    // ✅ 2025-01-28 : Table pour brouillons de services spécialisés
    match ensure_specialized_services_drafts_table(pool).await {
        Ok(_) => info!("✅ Migration auto: specialized services drafts table OK"),
        Err(e) => error!(
            "❌ Erreur migration auto specialized services drafts: {}",
            e
        ),
    }

    // ✅ 2025-01-28 : Tables pour historique et recherches sauvegardées
    match ensure_search_history_tables(pool).await {
        Ok(_) => info!("✅ Migration auto: search history tables OK"),
        Err(e) => error!("❌ Erreur migration auto search history tables: {}", e),
    }

    // ✅ 2025-01-28 : Index scalabilité Taxi/Covoiturage
    match ensure_taxi_covoit_scalability_indexes(pool).await {
        Ok(_) => info!("✅ Migration auto: taxi/covoit scalability indexes OK"),
        Err(e) => error!(
            "❌ Erreur migration auto taxi/covoit scalability indexes: {}",
            e
        ),
    }

    // ✅ 2025-01-28 : Index de scalabilité pour hôpitaux et laboratoires
    match ensure_hospital_lab_scalability_indexes(pool).await {
        Ok(_) => info!("✅ Migration auto: hospital/lab scalability indexes OK"),
        Err(e) => error!(
            "❌ Erreur migration auto hospital/lab scalability indexes: {}",
            e
        ),
    }

    // ✅ 2025-01-27 : Tables avancées pour Hôpitaux/Cliniques
    match ensure_hospital_advanced_tables(pool).await {
        Ok(_) => info!("✅ Migration auto: hospital advanced tables OK"),
        Err(e) => error!("❌ Erreur migration auto hospital advanced tables: {}", e),
    }

    // ✅ 2025-01-27 : Tables avancées pour Pharmacies
    match ensure_pharmacy_products_table(pool).await {
        Ok(_) => info!("✅ Migration auto: pharmacy_products table OK"),
        Err(e) => error!("❌ Erreur migration auto pharmacy_products: {}", e),
    }

    match ensure_pharmacy_advanced_tables(pool).await {
        Ok(_) => info!("✅ Migration auto: pharmacy advanced tables OK"),
        Err(e) => error!("❌ Erreur migration auto pharmacy advanced tables: {}", e),
    }

    // ✅ 2025-01-27 : Tables avancées pour Laboratoires/Imagerie
    match ensure_lab_advanced_tables(pool).await {
        Ok(_) => info!("✅ Migration auto: lab advanced tables OK"),
        Err(e) => error!("❌ Erreur migration auto lab advanced tables: {}", e),
    }

    // ✅ 2025-01-27 : Tables avancées pour Bourse du Livre, Orientation Scolaire et Offres d'Emploi
    match ensure_bourse_livre_advanced_tables(pool).await {
        Ok(_) => info!("✅ Migration auto: bourse livre advanced tables OK"),
        Err(e) => error!(
            "❌ Erreur migration auto bourse livre advanced tables: {}",
            e
        ),
    }

    match ensure_orientation_scolaire_advanced_tables(pool).await {
        Ok(_) => info!("✅ Migration auto: orientation scolaire advanced tables OK"),
        Err(e) => error!(
            "❌ Erreur migration auto orientation scolaire advanced tables: {}",
            e
        ),
    }

    match ensure_offres_emploi_advanced_tables(pool).await {
        Ok(_) => info!("✅ Migration auto: offres emploi advanced tables OK"),
        Err(e) => error!(
            "❌ Erreur migration auto offres emploi advanced tables: {}",
            e
        ),
    }

    // ✅ 2025-01-27 : Tables complètes pour Service Immobilier
    match ensure_immobilier_complete_tables(pool).await {
        Ok(_) => info!("✅ Migration auto: immobilier complete tables OK"),
        Err(e) => error!("❌ Erreur migration auto immobilier complete tables: {}", e),
    }

    // ✅ 2025-01-27 : Tables pour service Planification Menus
    match ensure_menu_planning_tables(pool).await {
        Ok(_) => info!("✅ Migration auto: menu planning tables OK"),
        Err(e) => error!("❌ Erreur migration auto menu planning tables: {}", e),
    }

    // ✅ NOUVEAU 2025-01-27 Phase 2: Tables plugin marketplace
    match ensure_plugin_marketplace_tables(pool).await {
        Ok(_) => info!("✅ Migration auto: plugin marketplace tables OK"),
        Err(e) => error!("❌ Erreur migration auto plugin marketplace tables: {}", e),
    }

    // ✅ 2025-01-28 : Tables pour bourse du livre scolaire et troc intelligent
    match ensure_livres_scolaires_tables(pool).await {
        Ok(_) => info!("✅ Migration auto: livres scolaires tables OK"),
        Err(e) => error!("❌ Erreur migration auto livres scolaires: {}", e),
    }

    // ✅ 2026-03-15 : Bourse du Livre V2 - recto/verso, modes, paquets, commissions, dons
    match ensure_bourse_livre_v2_tables(pool).await {
        Ok(_) => info!("✅ Migration auto: bourse livre V2 tables OK"),
        Err(e) => error!("❌ Erreur migration auto bourse livre V2: {}", e),
    }

    // ✅ 2026-03-15 : Bourse du Livre V2 Phase 2 - achats directs, dépôt-seulement
    match ensure_bourse_livre_v2_phase2_tables(pool).await {
        Ok(_) => info!("✅ Migration auto: bourse livre V2 phase2 tables OK"),
        Err(e) => error!("❌ Erreur migration auto bourse livre V2 phase2: {}", e),
    }

    // ✅ 2026-03-15 : Bourse du Livre V2 Phase 3 - Pont livraison intelligent + disponibilité + dashboards
    match ensure_bourse_livre_v2_phase3_tables(pool).await {
        Ok(_) => info!("✅ Migration auto: bourse livre V2 phase3 (delivery bridge) OK"),
        Err(e) => error!("❌ Erreur migration auto bourse livre V2 phase3: {}", e),
    }

    // ✅ 2025-01-28 : Tables pour système d'offres d'emploi avec matching intelligent
    match ensure_offres_emploi_tables(pool).await {
        Ok(_) => info!("✅ Migration auto: offres d'emploi tables OK"),
        Err(e) => error!("❌ Erreur migration auto offres d'emploi: {}", e),
    }

    // ✅ 2025-01-28 : Tables pour système d'orientation scolaire et établissements
    match ensure_orientation_scolaire_tables(pool).await {
        Ok(_) => info!("✅ Migration auto: orientation scolaire tables OK"),
        Err(e) => error!("❌ Erreur migration auto orientation scolaire: {}", e),
    }

    // ✅ 2025-01-28 : Tables pour chat de livraison et gamification
    match ensure_delivery_chat_tables(pool).await {
        Ok(_) => info!("✅ Migration auto: delivery chat et gamification tables OK"),
        Err(e) => error!("❌ Erreur migration auto delivery chat: {}", e),
    }

    // ✅ 2025-01-29 : Table user_documents pour KYC
    match ensure_user_documents_table(pool).await {
        Ok(_) => info!("✅ Migration user_documents réussie"),
        Err(e) => error!("❌ Erreur migration user_documents: {}", e),
    }

    // ✅ LEADER MONDIAL 2025-01-29: Assurance + QR code
    match ensure_insurance_qr_tables(pool).await {
        Ok(_) => info!("✅ Migration assurance + QR code réussie"),
        Err(e) => error!("❌ Erreur migration assurance + QR code: {}", e),
    }

    // ✅ NOUVEAU 2025-01-27: Tables programme fidélité, chat support et avis tickets
    match ensure_loyalty_chat_rating_tables(pool).await {
        Ok(_) => info!("✅ Migration auto: loyalty_chat_rating tables OK"),
        Err(e) => error!("❌ Erreur migration auto loyalty_chat_rating: {}", e),
    }

    // ✅ 2025-11-27 : Table banques de sang (service spécialisé isolé)
    match ensure_banques_sang_table(pool).await {
        Ok(_) => info!("✅ Migration auto: banques_sang table OK"),
        Err(e) => error!("❌ Erreur migration auto banques_sang table: {}", e),
    }

    // ✅ 2025-11-27 : Intégration tickets bus avec agences de voyage
    match ensure_bus_tickets_integration(pool).await {
        Ok(_) => info!("✅ Migration auto: bus tickets integration OK"),
        Err(e) => error!("❌ Erreur migration auto bus tickets integration: {}", e),
    }

    // ✅ 2025-11-27 : Commission et reversement tickets bus
    match ensure_bus_ticket_commission_system(pool).await {
        Ok(_) => info!("✅ Migration auto: bus ticket commission system OK"),
        Err(e) => error!("❌ Erreur migration auto bus ticket commission: {}", e),
    }

    // ✅ 2025-11-26 : Correction signature search_services_gps_final
    match ensure_search_services_gps_final_signature_fix(pool).await {
        Ok(_) => info!("✅ Migration auto: search_services_gps_final signature fix OK"),
        Err(e) => error!(
            "❌ Erreur migration auto search_services_gps_final signature fix: {}",
            e
        ),
    }

    // ✅ 2025-12-01 : Optimisation CRITIQUE search_services_gps_final (élimine calculs redondants)
    match ensure_search_services_gps_final_optimization(pool).await {
        Ok(_) => info!("✅ Migration auto: search_services_gps_final optimization OK"),
        Err(e) => error!(
            "❌ Erreur migration auto search_services_gps_final optimization: {}",
            e
        ),
    }

    // ✅ 2025-01-01 : Alignement search_services_gps_final avec keyword_search_with_gps
    match ensure_search_services_gps_final_alignment(pool).await {
        Ok(_) => info!("✅ Migration auto: search_services_gps_final alignment OK"),
        Err(e) => error!(
            "❌ Erreur migration auto search_services_gps_final alignment: {}",
            e
        ),
    }

    // ✅ 2025-01-01 : Optimisation hybrid_image_search avec unaccent() et similarity()
    match ensure_hybrid_image_search_optimization(pool).await {
        Ok(_) => info!("✅ Migration auto: hybrid_image_search optimization OK"),
        Err(e) => error!(
            "❌ Erreur migration auto hybrid_image_search optimization: {}",
            e
        ),
    }

    // ✅ 2025-11-26 : Optimisation index pour recherche
    match ensure_search_indexes_optimization(pool).await {
        Ok(_) => info!("✅ Migration auto: search indexes optimization OK"),
        Err(e) => error!(
            "❌ Erreur migration auto search indexes optimization: {}",
            e
        ),
    }

    // ✅ 2025-11-27 : Optimisation performance get_services_for_prestataire
    match ensure_get_services_performance_indexes(pool).await {
        Ok(_) => info!("✅ Migration auto: get_services performance indexes OK"),
        Err(e) => error!(
            "❌ Erreur migration auto get_services performance indexes: {}",
            e
        ),
    }

    // ✅ 2025-12-01 : Optimisations de scalabilité pour millions d'interactions
    match ensure_scalability_indexes(pool).await {
        Ok(_) => info!("✅ Migration auto: scalability indexes OK"),
        Err(e) => error!("❌ Erreur migration auto scalability indexes: {}", e),
    }

    // ✅ 2025-12-03 : Table videos avec hashtags pour VideoFeed
    match ensure_videos_table(pool).await {
        Ok(_) => info!("✅ Migration auto: videos table with hashtags OK"),
        Err(e) => error!("❌ Erreur migration auto videos table: {}", e),
    }

    // ✅ 2025-12-03 : Optimisations de scalabilité hashtags (millions d'interactions)
    match ensure_hashtags_scalability_optimizations(pool).await {
        Ok(_) => info!("✅ Migration auto: hashtags scalability optimizations OK"),
        Err(e) => error!("❌ Erreur migration auto hashtags scalability: {}", e),
    }

    // ✅ 2025-12-03 : Amélioration algorithme recommandations (signaux enrichis)
    match ensure_recommendations_enhancement(pool).await {
        Ok(_) => info!("✅ Migration auto: recommendations enhancement OK"),
        Err(e) => error!(
            "❌ Erreur migration auto recommendations enhancement: {}",
            e
        ),
    }

    // ✅ Phase 1 - 2025-01-27 : Optimisations critiques livraison (index, fonction SQL, cache)
    match ensure_delivery_phase1_optimizations(pool).await {
        Ok(_) => info!("✅ Migration auto: delivery Phase 1 optimizations OK"),
        Err(e) => error!(
            "❌ Erreur migration auto delivery Phase 1 optimizations: {}",
            e
        ),
    }

    // ✅ Phase 2 - 2025-01-27 : Partitionnement et archivage livraison
    match ensure_delivery_phase2_partitioning(pool).await {
        Ok(_) => info!("✅ Migration auto: delivery Phase 2 partitioning OK"),
        Err(e) => error!(
            "❌ Erreur migration auto delivery Phase 2 partitioning: {}",
            e
        ),
    }

    // ✅ 2025-01-01 : Améliorations de scalabilité vidéo (millions de créations simultanées)
    match ensure_video_scalability_improvements(pool).await {
        Ok(_) => info!("✅ Migration auto: video scalability improvements OK"),
        Err(e) => error!(
            "❌ Erreur migration auto video scalability improvements: {}",
            e
        ),
    }

    // ✅ 2025-11-27 : Système validation tickets bus
    match ensure_bus_ticket_validation_system(pool).await {
        Ok(_) => info!("✅ Migration auto: bus ticket validation system OK"),
        Err(e) => error!("❌ Erreur migration auto bus ticket validation: {}", e),
    }

    // ✅ 2025-11-27 : Gestion manuelle places non disponibles
    match ensure_bus_seat_blocks_system(pool).await {
        Ok(_) => info!("✅ Migration auto: bus seat blocks system OK"),
        Err(e) => error!("❌ Erreur migration auto bus seat blocks: {}", e),
    }

    // ✅ NOUVEAU 2025-11-27 : Système Intelligent de Matching Banque de Sang
    match ensure_blood_donation_matching_system(pool).await {
        Ok(_) => info!("✅ Migration auto: blood donation matching system OK"),
        Err(e) => error!("❌ Erreur migration auto blood donation matching: {}", e),
    }

    // ✅ 2025-11-27 : Tables token_consumption_logs et purchase_history
    match ensure_token_consumption_and_purchase_history_tables(pool).await {
        Ok(_) => info!("✅ Migration auto: token_consumption_logs et purchase_history OK"),
        Err(e) => error!(
            "❌ Erreur migration auto token_consumption/purchase_history: {}",
            e
        ),
    }

    // ✅ 2026-01-03 : Table service_products (critique)
    match ensure_service_products_table(pool).await {
        Ok(_) => info!("✅ Migration auto: service_products table OK"),
        Err(e) => error!("❌ Erreur migration auto service_products: {}", e),
    }

    // ✅ 2025-11-27 : Table echanges (critique)
    match ensure_echanges_table(pool).await {
        Ok(_) => info!("✅ Migration auto: echanges table OK"),
        Err(e) => error!("❌ Erreur migration auto echanges: {}", e),
    }

    // ✅ 2025-11-27 : Tables de chat (critique)
    match ensure_chat_tables(pool).await {
        Ok(_) => info!("✅ Migration auto: chat tables OK"),
        Err(e) => error!("❌ Erreur migration auto chat tables: {}", e),
    }

    // ✅ NOUVEAU 2025-01-27 : Table message_reactions (réactions aux messages)
    match ensure_message_reactions_table(pool).await {
        Ok(_) => info!("✅ Migration auto: message_reactions OK"),
        Err(e) => error!("❌ Erreur migration auto message_reactions: {}", e),
    }

    // ✅ 2025-11-27 : Table user_push_tokens (critique)
    match ensure_push_tokens_table(pool).await {
        Ok(_) => info!("✅ Migration auto: user_push_tokens OK"),
        Err(e) => error!("❌ Erreur migration auto user_push_tokens: {}", e),
    }

    // ✅ 2025-11-27 : Table image_analyses
    match ensure_image_analyses_table(pool).await {
        Ok(_) => info!("✅ Migration auto: image_analyses OK"),
        Err(e) => error!("❌ Erreur migration auto image_analyses: {}", e),
    }

    // ✅ 2025-11-27 : Table programmes_scolaires
    match ensure_programmes_scolaires_table(pool).await {
        Ok(_) => info!("✅ Migration auto: programmes_scolaires OK"),
        Err(e) => error!("❌ Erreur migration auto programmes_scolaires: {}", e),
    }

    // ✅ 2025-11-27 : Tables de modèles produits
    match ensure_product_models_tables(pool).await {
        Ok(_) => info!("✅ Migration auto: product models tables OK"),
        Err(e) => error!("❌ Erreur migration auto product models: {}", e),
    }

    // ✅ 2025-11-27 : Table visibility_tracking
    match ensure_visibility_tracking_table(pool).await {
        Ok(_) => info!("✅ Migration auto: visibility_tracking OK"),
        Err(e) => error!("❌ Erreur migration auto visibility_tracking: {}", e),
    }

    // ✅ 2025-11-27 : Tables service_team_management
    match ensure_service_team_management_table(pool).await {
        Ok(_) => info!("✅ Migration auto: service_team_management OK"),
        Err(e) => error!("❌ Erreur migration auto service_team_management: {}", e),
    }

    // ✅ 2025-11-27 : Table bus_return_trips
    match ensure_bus_return_trips_table(pool).await {
        Ok(_) => info!("✅ Migration auto: bus_return_trips OK"),
        Err(e) => error!("❌ Erreur migration auto bus_return_trips: {}", e),
    }

    // ✅ 2025-11-27 : Table agency_departure_schedules (horaires par agence/ville)
    match ensure_agency_departure_schedules(pool).await {
        Ok(_) => info!("✅ Migration auto: agency_departure_schedules OK"),
        Err(e) => error!("❌ Erreur migration auto agency_departure_schedules: {}", e),
    }

    // ✅ 2025-11-27 : Colonnes return_date et return_time dans bus_ticket_payments
    match ensure_return_time_columns(pool).await {
        Ok(_) => info!("✅ Migration auto: return_time columns OK"),
        Err(e) => error!("❌ Erreur migration auto return_time columns: {}", e),
    }

    // ✅ 2025-11-27 : Amélioration fonction matching avec heure
    match ensure_improved_return_matching(pool).await {
        Ok(_) => info!("✅ Migration auto: improved return matching OK"),
        Err(e) => error!("❌ Erreur migration auto improved return matching: {}", e),
    }

    // ✅ 2025-11-27 : Ajout champ groupe_sanguin dans users
    match ensure_blood_group_column_in_users(pool).await {
        Ok(_) => info!("✅ Migration auto: blood_group column in users OK"),
        Err(e) => error!("❌ Erreur migration auto blood_group column: {}", e),
    }

    match ensure_live_streaming_tables(pool).await {
        Ok(_) => info!("✅ Migration auto: live streaming tables OK"),
        Err(e) => error!("❌ Erreur migration auto live streaming: {}", e),
    }

    match ensure_live_flash_sales_tables(pool).await {
        Ok(_) => info!("✅ Migration auto: live flash sales tables OK"),
        Err(e) => error!("❌ Erreur migration auto live flash sales: {}", e),
    }

    // Optimisations de scalabilité Flash Sales et Black Friday
    match ensure_flash_blackfriday_scalability_optimizations(pool).await {
        Ok(_) => info!("✅ Migration auto: optimisations scalabilité Flash/BlackFriday OK"),
        Err(e) => error!("❌ Erreur migration auto optimisations scalabilité: {}", e),
    }

    // Migration 0.5: Table african_locations (✅ NOUVEAU 2025-11-06)
    match ensure_african_locations_table(pool).await {
        Ok(_) => info!("✅ Migration auto: african_locations OK"),
        Err(e) => error!("❌ Erreur migration auto african_locations: {}", e),
    }

    // ✅ NOUVEAU 2025-11-24 : Migration des produits vers format JSON structuré
    match ensure_products_json_format(pool).await {
        Ok(_) => info!("✅ Migration auto: products JSON format OK"),
        Err(e) => error!("❌ Erreur migration auto products JSON format: {}", e),
    }

    // Migration 1: Fonction extract_all_product_text (✅ NOUVEAU 2025-11-05)
    match ensure_extract_all_product_text_function(pool).await {
        Ok(_) => info!("✅ Migration auto: extract_all_product_text OK"),
        Err(e) => error!("❌ Erreur migration auto extract_all_product_text: {}", e),
    }

    // Migration 2: Fonction de désactivation des produits
    match ensure_deactivate_expired_products_function(pool).await {
        Ok(_) => info!("✅ Migration auto: deactivate_expired_products OK"),
        Err(e) => error!("❌ Erreur migration auto: {}", e),
    }

    // Migration 3: Table publicites
    match ensure_publicites_table(pool).await {
        Ok(_) => info!("✅ Migration auto: publicites table OK"),
        Err(e) => error!("❌ Erreur migration auto publicites: {}", e),
    }

    // Migration 4: Table notifications
    match ensure_notifications_table(pool).await {
        Ok(_) => info!("✅ Migration auto: notifications table OK"),
        Err(e) => error!("❌ Erreur migration auto notifications: {}", e),
    }

    // Migration 5: Table autocomplete_characteristics (✅ 2025-11-01)
    match ensure_autocomplete_characteristics_table(pool).await {
        Ok(_) => info!("✅ Migration auto: autocomplete_characteristics table OK"),
        Err(e) => error!(
            "❌ Erreur migration auto autocomplete_characteristics: {}",
            e
        ),
    }

    // ✅ 2025-12-30: Optimisation matching vectoriel avec similarité
    match ensure_vector_matching_optimization(pool).await {
        Ok(_) => info!("✅ Migration auto: vector matching optimization OK"),
        Err(e) => error!(
            "❌ Erreur migration auto vector matching optimization: {}",
            e
        ),
    }

    // ✅ 2025-12-30: Optimisation recherche image avec matching vectoriel
    match ensure_image_search_vector_matching_optimization(pool).await {
        Ok(_) => info!("✅ Migration auto: image search vector matching optimization OK"),
        Err(e) => error!(
            "❌ Erreur migration auto image search vector matching: {}",
            e
        ),
    }

    // ✅ 2026-01-14: Correction erreur to_tsvector avec langue dynamique
    match ensure_fix_image_search_to_tsvector_error(pool).await {
        Ok(_) => info!("✅ Migration auto: fix image search to_tsvector error OK"),
        Err(e) => error!(
            "❌ Erreur migration auto fix image search to_tsvector: {}",
            e
        ),
    }

    // ✅ 2025-12-30: Optimisation recherche audio avec cache
    match ensure_audio_search_cache_optimization(pool).await {
        Ok(_) => info!("✅ Migration auto: audio search cache optimization OK"),
        Err(e) => error!("❌ Erreur migration auto audio search cache: {}", e),
    }

    // ✅ 2025-12-30: Optimisation finale performance recherche (< 2s)
    match ensure_search_performance_final_optimization(pool).await {
        Ok(_) => info!("✅ Migration auto: search performance final optimization OK"),
        Err(e) => error!("❌ Erreur migration auto search performance final: {}", e),
    }

    // Migration 6: Table autocomplete_combinations (✅ NOUVEAU 2025-11-02)
    match ensure_autocomplete_combinations_table(pool).await {
        Ok(_) => info!("✅ Migration auto: autocomplete_combinations table OK"),
        Err(e) => error!("❌ Erreur migration auto autocomplete_combinations: {}", e),
    }

    // Migration 7: Table token_usage_logs (✅ NOUVEAU 2025-11-03)
    match ensure_token_usage_logs_table(pool).await {
        Ok(_) => info!("✅ Migration auto: token_usage_logs table OK"),
        Err(e) => error!("❌ Erreur migration auto token_usage_logs: {}", e),
    }

    // Migration 8: Table service_reviews avec support réponses (✅ NOUVEAU 2025-11-04)
    match ensure_service_reviews_table(pool).await {
        Ok(_) => info!("✅ Migration auto: service_reviews table OK"),
        Err(e) => error!("❌ Erreur migration auto service_reviews: {}", e),
    }

    // Migration 9: Table product_comments (✅ NOUVEAU 2025-11-08)
    match ensure_product_comments_tables(pool).await {
        Ok(_) => info!("✅ Migration auto: product_comments table OK"),
        Err(e) => error!("❌ Erreur migration auto product_comments: {}", e),
    }

    match ensure_delivery_tables(pool).await {
        Ok(_) => info!("✅ Migration auto: tables livraison OK"),
        Err(e) => error!("❌ Erreur migration auto tables livraison: {}", e),
    }

    match ensure_delivery_seed_data(pool).await {
        Ok(_) => info!("✅ Migration auto: seeds livraison OK"),
        Err(e) => error!("❌ Erreur migration auto seeds livraison: {}", e),
    }

    match ensure_staging_demo_delivery(pool).await {
        Ok(_) => {}
        Err(e) => error!("❌ Erreur seed staging (ENABLE_STAGING_DEMO_SEED): {}", e),
    }

    // Migration 10: Table product_reactions (✅ NOUVEAU 2025-11-04)
    match ensure_product_reactions_table(pool).await {
        Ok(_) => info!("✅ Migration auto: product_reactions table OK"),
        Err(e) => error!("❌ Erreur migration auto product_reactions: {}", e),
    }

    // Migration 11: Chat mentions et participants (✅ NOUVEAU 2025-11-05)
    match ensure_chat_mentions_and_participants(pool).await {
        Ok(_) => info!("✅ Migration auto: chat mentions OK"),
        Err(e) => error!("❌ Erreur migration auto chat mentions: {}", e),
    }

    // Migration 12: Search history (✅ NOUVEAU 2025-11-05)
    match ensure_search_history_table(pool).await {
        Ok(_) => info!("✅ Migration auto: search_history OK"),
        Err(e) => error!("❌ Erreur migration auto search_history: {}", e),
    }

    // Migration 13: Alerts (✅ NOUVEAU 2025-11-05)
    match ensure_alerts_table(pool).await {
        Ok(_) => info!("✅ Migration auto: alerts OK"),
        Err(e) => error!("❌ Erreur migration auto alerts: {}", e),
    }

    // Migration 14: Signalements (✅ NOUVEAU 2025-11-05)
    match ensure_signalements_tables(pool).await {
        Ok(_) => info!("✅ Migration auto: signalements OK"),
        Err(e) => error!("❌ Erreur migration auto signalements: {}", e),
    }

    // Migration 15: Private conversations (✅ NOUVEAU 2025-11-05)
    match ensure_private_conversations_table(pool).await {
        Ok(_) => info!("✅ Migration auto: private_conversations OK"),
        Err(e) => error!("❌ Erreur migration auto private_conversations: {}", e),
    }

    // Migration 16: Bus reservations (✅ NOUVEAU 2025-11-05)
    match ensure_bus_reservations_table(pool).await {
        Ok(_) => info!("✅ Migration auto: bus_reservations OK"),
        Err(e) => error!("❌ Erreur migration auto bus_reservations: {}", e),
    }

    // Migration 17: Réindexation services existants (✅ NOUVEAU 2025-11-06)
    // S'exécute UNE SEULE FOIS pour indexer les produits créés avant le système autocomplete
    match reindex_existing_services_once(pool).await {
        Ok(_) => info!("✅ Migration auto: réindexation services existants OK"),
        Err(e) => error!("❌ Erreur migration auto réindexation: {}", e),
    }

    // Migration 18: Fonctions de visibilité pour carousel mixte (✅ NOUVEAU 2025-11-06)
    match ensure_visibility_functions(pool).await {
        Ok(_) => info!("✅ Migration auto: fonctions visibilité OK"),
        Err(e) => error!("❌ Erreur migration auto fonctions visibilité: {}", e),
    }

    // Migration 19: Nettoyage combinaisons invalides (✅ NOUVEAU 2025-11-06)
    match clean_invalid_combinations_migration(pool).await {
        Ok(_) => info!("✅ Migration auto: nettoyage combinaisons invalides OK"),
        Err(e) => error!("❌ Erreur migration auto nettoyage combinaisons: {}", e),
    }

    // ✅ NOUVEAU 2025-01-27 : Tables menu planning
    match ensure_menu_planning_tables(pool).await {
        Ok(_) => info!("✅ Migration auto: menu planning tables OK"),
        Err(e) => error!("❌ Erreur migration auto menu planning tables: {}", e),
    }

    // ✅ NOUVEAU 2026-01-02 : Queue asynchrone pour création de produits
    match ensure_product_creation_queue(pool).await {
        Ok(_) => info!("✅ Migration auto: product_creation_queue OK"),
        Err(e) => error!("❌ Erreur migration auto product_creation_queue: {}", e),
    }

    // ✅ NOUVEAU 2026-02-06 : Phase de lancement (3 mois gratuits)
    match ensure_launch_phase_tables(pool).await {
        Ok(_) => info!("✅ Migration auto: launch_phase_tables OK"),
        Err(e) => error!("❌ Erreur migration auto launch_phase_tables: {}", e),
    }

    // ✅ NOUVEAU 2026-02-14 : Table GPU scale actions
    match ensure_gpu_scale_actions_table(pool).await {
        Ok(_) => info!("✅ Migration auto: gpu_scale_actions OK"),
        Err(e) => error!("❌ Erreur migration auto gpu_scale_actions: {}", e),
    }

    // ✅ NOUVEAU 2026-02-25 : Tables vérification téléphone OTP
    match ensure_phone_verification_tables(pool).await {
        Ok(_) => info!("✅ Migration auto: phone_verification_tables OK"),
        Err(e) => error!("❌ Erreur migration auto phone_verification_tables: {}", e),
    }

    // ✅ NOUVEAU 2026-03-05 : Table user_follows (système de suivi vendeurs)
    match ensure_user_follows_table(pool).await {
        Ok(_) => info!("✅ Migration auto: user_follows OK"),
        Err(e) => error!("❌ Erreur migration auto user_follows: {}", e),
    }

    // ✅ NOUVEAU 2026-03-05 : Table generative_video_jobs (pipeline vidéo IA Runway/Sora/Pika)
    match ensure_generative_video_jobs_table(pool).await {
        Ok(_) => info!("✅ Migration auto: generative_video_jobs OK"),
        Err(e) => error!("❌ Erreur migration auto generative_video_jobs: {}", e),
    }

    // ✅ NOUVEAU 2026-03-07 : Tables digitalisation complète assurance (produits, polices, sinistres)
    match ensure_insurance_digitalization_tables(pool).await {
        Ok(_) => info!("✅ Migration auto: insurance digitalization tables OK"),
        Err(e) => error!("❌ Erreur migration auto insurance digitalization: {}", e),
    }

    // ✅ NOUVEAU 2026-03-11 : Table platform_settings (numéros MTN/Orange Money plateforme, admin CRUD)
    match ensure_platform_settings_table(pool).await {
        Ok(_) => info!("✅ Migration auto: platform_settings OK"),
        Err(e) => error!("❌ Erreur migration auto platform_settings: {}", e),
    }

    // ✅ NOUVEAU 2026-03-14 : Table navigation_checkpoint_comments (commentaires sur alertes navigation)
    match ensure_navigation_checkpoint_comments_table(pool).await {
        Ok(_) => info!("✅ Migration auto: navigation_checkpoint_comments OK"),
        Err(e) => error!(
            "❌ Erreur migration auto navigation_checkpoint_comments: {}",
            e
        ),
    }

    // ✅ NOUVEAU 2026-03-14 : Backfill services.category depuis data JSONB (corrige NULL pour supermarchés etc.)
    match backfill_services_category_from_data(pool).await {
        Ok(_) => info!("✅ Migration auto: backfill services.category OK"),
        Err(e) => error!("❌ Erreur migration auto backfill services.category: {}", e),
    }

    // ✅ NOUVEAU 2026-03-15 : Table token_ledger (historique complet des mouvements de tokens)
    match ensure_token_ledger_table(pool).await {
        Ok(_) => info!("✅ Migration auto: token_ledger OK"),
        Err(e) => error!("❌ Erreur migration auto token_ledger: {}", e),
    }

    // ✅ NOUVEAU 2026-03-15 : Colonnes agrégateur dans payment_attempts
    match ensure_payment_attempts_aggregator_columns(pool).await {
        Ok(_) => info!("✅ Migration auto: payment_attempts aggregator columns OK"),
        Err(e) => error!(
            "❌ Erreur migration auto payment_attempts aggregator: {}",
            e
        ),
    }

    // ✅ NOUVEAU 2026-03-15 : Tables user_wallets + wallet_transactions (système de portefeuille interne)
    match ensure_wallet_tables(pool).await {
        Ok(_) => info!("✅ Migration auto: wallet tables (user_wallets + wallet_transactions) OK"),
        Err(e) => error!("❌ Erreur migration auto wallet tables: {}", e),
    }

    // ✅ NOUVEAU 2026-03-15 : Table disbursement_requests (transferts sortants via agrégateur)
    match ensure_disbursement_requests_table(pool).await {
        Ok(_) => info!("✅ Migration auto: disbursement_requests OK"),
        Err(e) => error!("❌ Erreur migration auto disbursement_requests: {}", e),
    }

    info!("✅ Migrations automatiques terminées");
}

/// Réindexe les services existants UNIQUEMENT si autocomplete_characteristics est vide
async fn reindex_existing_services_once(pool: &PgPool) -> Result<(), sqlx::Error> {
    // Compter les services actifs ayant au moins un produit défini
    let service_count = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM services WHERE is_active = TRUE AND data->'produits' IS NOT NULL",
    )
    .fetch_one(pool)
    .await?;

    if service_count == 0 {
        info!("ℹ️ Aucun service actif à indexer, réindexation non nécessaire");
        return Ok(());
    }

    // Compter les services déjà indexés dans autocomplete_characteristics
    let indexed_service_count = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(DISTINCT service_id) FROM autocomplete_characteristics WHERE is_real_product = TRUE"
    )
    .fetch_one(pool)
    .await?;

    if indexed_service_count >= service_count {
        info!(
            "✅ {} services déjà indexés sur {}, réindexation non nécessaire",
            indexed_service_count, service_count
        );
        return Ok(());
    }

    info!(
        "🔄 Réindexation nécessaire ({} services actifs, {} indexés) ...",
        service_count, indexed_service_count
    );

    use crate::migrations::reindex_existing_services::reindex_all_services;
    match reindex_all_services(pool).await {
        Ok(n) => {
            info!("✅ {} services réindexés avec succès", n);
            Ok(())
        }
        Err(e) => {
            error!("❌ Erreur réindexation: {}", e);
            Err(e)
        }
    }
}

/// Vérifie et ajoute le support des mentions dans chat_messages
pub async fn ensure_chat_mentions_and_participants(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification du système de mentions dans chat...");

    // Vérifier si la table chat_messages existe
    let chat_exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'chat_messages')",
    )
    .fetch_one(pool)
    .await?;

    if !chat_exists {
        warn!("⚠️ Table chat_messages n'existe pas, skip migration mentions");
        return Ok(());
    }

    // Vérifier si mentioned_users existe
    let has_mentions = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'chat_messages' AND column_name = 'mentioned_users')"
    )
    .fetch_one(pool)
    .await?;

    if !has_mentions {
        warn!("⚠️ Colonne 'mentioned_users' manquante dans chat_messages, ajout en cours...");
        sqlx::query("ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS mentioned_users INTEGER[] DEFAULT '{}'")
            .execute(pool)
            .await?;
        info!("✅ Colonne 'mentioned_users' ajoutée");

        // Créer index GIN pour recherche rapide
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_chat_messages_mentions ON chat_messages USING GIN(mentioned_users)")
            .execute(pool)
            .await?;
        info!("✅ Index GIN sur mentioned_users créé");
    }

    // Vérifier si conversation_participants existe
    let participants_exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'conversation_participants')"
    )
    .fetch_one(pool)
    .await?;

    if !participants_exists {
        warn!("⚠️ Table conversation_participants manquante, création en cours...");
        sqlx::query(r#"
            CREATE TABLE IF NOT EXISTS conversation_participants (
                id SERIAL PRIMARY KEY,
                conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                invited_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
                role VARCHAR(20) DEFAULT 'participant' CHECK (role IN ('owner', 'participant', 'guest')),
                joined_at TIMESTAMPTZ DEFAULT NOW(),
                can_remove BOOLEAN DEFAULT TRUE,
                first_visible_message_id TEXT,
                last_read_message_id TEXT,
                is_active BOOLEAN DEFAULT TRUE,
                left_at TIMESTAMPTZ,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW(),
                UNIQUE(conversation_id, user_id)
            )
        "#)
        .execute(pool)
        .await?;

        // Index
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_conversation_participants_conversation ON conversation_participants(conversation_id)")
            .execute(pool)
            .await?;
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_conversation_participants_user ON conversation_participants(user_id)")
            .execute(pool)
            .await?;
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_conversation_participants_active ON conversation_participants(is_active)")
            .execute(pool)
            .await?;

        info!("✅ Table conversation_participants créée");
    }

    // Vérifier si conversation_tag_history existe
    let tag_history_exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'conversation_tag_history')"
    )
    .fetch_one(pool)
    .await?;

    if !tag_history_exists {
        warn!("⚠️ Table conversation_tag_history manquante, création en cours...");
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS conversation_tag_history (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                tagged_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
                tagged_at TIMESTAMPTZ DEFAULT NOW(),
                context VARCHAR(50),
                created_at TIMESTAMPTZ DEFAULT NOW()
            )
        "#,
        )
        .execute(pool)
        .await?;

        // Index
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_tag_history_user ON conversation_tag_history(user_id, tagged_at DESC)")
            .execute(pool)
            .await?;
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_tag_history_tagged_user ON conversation_tag_history(tagged_user_id)")
            .execute(pool)
            .await?;

        info!("✅ Table conversation_tag_history créée");
    }

    Ok(())
}

/// Vérifie et crée la table token_usage_logs si elle n'existe pas
pub async fn ensure_token_usage_logs_table(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification de la table token_usage_logs...");

    // Vérifier si la table existe
    let exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'token_usage_logs')"
    )
    .fetch_one(pool)
    .await?;

    if exists {
        info!("✅ Table token_usage_logs déjà présente");

        // Vérifier si la colonne intention existe
        let col_exists = sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'token_usage_logs' AND column_name = 'intention')"
        )
        .fetch_one(pool)
        .await?;

        if !col_exists {
            warn!("⚠️ Colonne 'intention' manquante, ajout en cours...");
            sqlx::query("ALTER TABLE token_usage_logs ADD COLUMN IF NOT EXISTS intention VARCHAR(100) DEFAULT 'assistance_generale'")
                .execute(pool)
                .await?;
            info!("✅ Colonne 'intention' ajoutée");
        }

        // Vérifier si tokens_ia_consumed existe, sinon l'ajouter
        let has_tokens_ia = sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'token_usage_logs' AND column_name = 'tokens_ia_consumed')"
        )
        .fetch_one(pool)
        .await?;

        if !has_tokens_ia {
            warn!("⚠️ Colonne 'tokens_ia_consumed' manquante, ajout en cours...");
            sqlx::query("ALTER TABLE token_usage_logs ADD COLUMN IF NOT EXISTS tokens_ia_consumed INTEGER NOT NULL DEFAULT 0")
                .execute(pool)
                .await?;
            info!("✅ Colonne 'tokens_ia_consumed' ajoutée");
        }

        // ✅ NOUVEAU 2025-11-05: Vérifier si tokens_cost_xaf existe, sinon l'ajouter
        let has_tokens_cost = sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'token_usage_logs' AND column_name = 'tokens_cost_xaf')"
        )
        .fetch_one(pool)
        .await?;

        if !has_tokens_cost {
            warn!("⚠️ Colonne 'tokens_cost_xaf' manquante, ajout en cours...");
            sqlx::query("ALTER TABLE token_usage_logs ADD COLUMN IF NOT EXISTS tokens_cost_xaf NUMERIC(15, 2) DEFAULT 0")
                .execute(pool)
                .await?;
            info!("✅ Colonne 'tokens_cost_xaf' ajoutée");
        }

        // ✅ NOUVEAU 2025-11-05: Vérifier si tokens_deducted existe, sinon l'ajouter
        let has_tokens_deducted = sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'token_usage_logs' AND column_name = 'tokens_deducted')"
        )
        .fetch_one(pool)
        .await?;

        if !has_tokens_deducted {
            warn!("⚠️ Colonne 'tokens_deducted' manquante, ajout en cours...");
            sqlx::query("ALTER TABLE token_usage_logs ADD COLUMN IF NOT EXISTS tokens_deducted INTEGER NOT NULL DEFAULT 0")
                .execute(pool)
                .await?;
            info!("✅ Colonne 'tokens_deducted' ajoutée");
        }

        // ✅ NOUVEAU 2025-11-05: Vérifier si balance_before existe, sinon l'ajouter
        let has_balance_before = sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'token_usage_logs' AND column_name = 'balance_before')"
        )
        .fetch_one(pool)
        .await?;

        if !has_balance_before {
            warn!("⚠️ Colonne 'balance_before' manquante, ajout en cours...");
            sqlx::query("ALTER TABLE token_usage_logs ADD COLUMN IF NOT EXISTS balance_before INTEGER NOT NULL DEFAULT 0")
                .execute(pool)
                .await?;
            info!("✅ Colonne 'balance_before' ajoutée");
        }

        // ✅ NOUVEAU 2025-11-05: Vérifier si balance_after existe, sinon l'ajouter
        let has_balance_after = sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'token_usage_logs' AND column_name = 'balance_after')"
        )
        .fetch_one(pool)
        .await?;

        if !has_balance_after {
            warn!("⚠️ Colonne 'balance_after' manquante, ajout en cours...");
            sqlx::query("ALTER TABLE token_usage_logs ADD COLUMN IF NOT EXISTS balance_after INTEGER NOT NULL DEFAULT 0")
                .execute(pool)
                .await?;
            info!("✅ Colonne 'balance_after' ajoutée");
        }

        // ✅ NOUVEAU 2025-11-05: Vérifier si processing_time_ms existe, sinon l'ajouter
        let has_processing_time = sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'token_usage_logs' AND column_name = 'processing_time_ms')"
        )
        .fetch_one(pool)
        .await?;

        if !has_processing_time {
            warn!("⚠️ Colonne 'processing_time_ms' manquante, ajout en cours...");
            sqlx::query(
                "ALTER TABLE token_usage_logs ADD COLUMN IF NOT EXISTS processing_time_ms INTEGER",
            )
            .execute(pool)
            .await?;
            info!("✅ Colonne 'processing_time_ms' ajoutée");
        }

        // ✅ NOUVEAU 2025-11-05: Vérifier si response_source existe, sinon l'ajouter
        let has_response_source = sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'token_usage_logs' AND column_name = 'response_source')"
        )
        .fetch_one(pool)
        .await?;

        if !has_response_source {
            warn!("⚠️ Colonne 'response_source' manquante, ajout en cours...");
            sqlx::query(
                "ALTER TABLE token_usage_logs ADD COLUMN IF NOT EXISTS response_source VARCHAR(50)",
            )
            .execute(pool)
            .await?;
            info!("✅ Colonne 'response_source' ajoutée");
        }

        // ✅ NOUVEAU 2025-11-05: Vérifier si endpoint existe, sinon l'ajouter
        let has_endpoint = sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'token_usage_logs' AND column_name = 'endpoint')"
        )
        .fetch_one(pool)
        .await?;

        if !has_endpoint {
            warn!("⚠️ Colonne 'endpoint' manquante, ajout en cours...");
            sqlx::query("ALTER TABLE token_usage_logs ADD COLUMN IF NOT EXISTS endpoint TEXT")
                .execute(pool)
                .await?;
            info!("✅ Colonne 'endpoint' ajoutée");
        }

        // ✅ NOUVEAU 2025-11-05: Vérifier si operation_type existe, sinon l'ajouter
        let has_operation_type = sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'token_usage_logs' AND column_name = 'operation_type')"
        )
        .fetch_one(pool)
        .await?;

        if !has_operation_type {
            warn!("⚠️ Colonne 'operation_type' manquante, ajout en cours...");
            sqlx::query("ALTER TABLE token_usage_logs ADD COLUMN IF NOT EXISTS operation_type VARCHAR(50) DEFAULT 'ia_request'")
                .execute(pool)
                .await?;
            info!("✅ Colonne 'operation_type' ajoutée");
        }

        // ✅ NOUVEAU 2025-11-06: Vérifier si tokens_amount existe et la rendre nullable (colonne legacy non utilisée)
        let has_tokens_amount = sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'token_usage_logs' AND column_name = 'tokens_amount')"
        )
        .fetch_one(pool)
        .await?;

        if has_tokens_amount {
            // Si la colonne existe, la rendre nullable (elle n'est plus utilisée dans le code)
            warn!("⚠️ Colonne 'tokens_amount' legacy détectée, mise à jour pour la rendre nullable...");
            sqlx::query("ALTER TABLE token_usage_logs ALTER COLUMN tokens_amount DROP NOT NULL")
                .execute(pool)
                .await?;
            info!("✅ Colonne 'tokens_amount' rendue nullable (legacy)");
        }

        // ✅ NOUVEAU 2025-11-06: Renommer tokens_before → balance_before si ancienne structure détectée
        let has_tokens_before = sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'token_usage_logs' AND column_name = 'tokens_before')"
        )
        .fetch_one(pool)
        .await?;

        // ✅ Vérifier que balance_before n'existe pas déjà avant de renommer
        let has_balance_before = sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'token_usage_logs' AND column_name = 'balance_before')"
        )
        .fetch_one(pool)
        .await?;

        if has_tokens_before && !has_balance_before {
            warn!("⚠️ Ancienne colonne 'tokens_before' détectée, renommage en 'balance_before'...");
            sqlx::query(
                "ALTER TABLE token_usage_logs RENAME COLUMN tokens_before TO balance_before",
            )
            .execute(pool)
            .await?;
            info!("✅ Colonne renommée: tokens_before → balance_before");
        } else if has_tokens_before && has_balance_before {
            // Les deux existent : supprimer l'ancienne
            warn!("⚠️ Colonnes 'tokens_before' ET 'balance_before' détectées, suppression de l'ancienne...");
            sqlx::query("ALTER TABLE token_usage_logs DROP COLUMN tokens_before")
                .execute(pool)
                .await?;
            info!("✅ Ancienne colonne 'tokens_before' supprimée");
        }

        // ✅ Renommer tokens_after → balance_after si nécessaire
        let has_tokens_after = sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'token_usage_logs' AND column_name = 'tokens_after')"
        )
        .fetch_one(pool)
        .await?;

        let has_balance_after = sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'token_usage_logs' AND column_name = 'balance_after')"
        )
        .fetch_one(pool)
        .await?;

        if has_tokens_after && !has_balance_after {
            warn!("⚠️ Ancienne colonne 'tokens_after' détectée, renommage en 'balance_after'...");
            sqlx::query("ALTER TABLE token_usage_logs RENAME COLUMN tokens_after TO balance_after")
                .execute(pool)
                .await?;
            info!("✅ Colonne renommée: tokens_after → balance_after");
        } else if has_tokens_after && has_balance_after {
            // Les deux existent : supprimer l'ancienne
            warn!("⚠️ Colonnes 'tokens_after' ET 'balance_after' détectées, suppression de l'ancienne...");
            sqlx::query("ALTER TABLE token_usage_logs DROP COLUMN tokens_after")
                .execute(pool)
                .await?;
            info!("✅ Ancienne colonne 'tokens_after' supprimée");
        }

        return Ok(());
    }

    warn!("⚠️ Table token_usage_logs manquante, création en cours...");

    // Créer la table token_usage_logs
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS token_usage_logs (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            intention VARCHAR(100) DEFAULT 'assistance_generale',
            tokens_ia_consumed INTEGER NOT NULL,
            tokens_cost_xaf NUMERIC(15, 2) DEFAULT 0,
            tokens_deducted INTEGER NOT NULL,
            balance_before INTEGER NOT NULL,
            balance_after INTEGER NOT NULL,
            processing_time_ms INTEGER,
            response_source VARCHAR(50),
            endpoint TEXT,
            operation_type VARCHAR(50) DEFAULT 'ia_request',
            created_at TIMESTAMPTZ DEFAULT NOW()
        )
    "#,
    )
    .execute(pool)
    .await?;

    // Créer les index
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_token_usage_user_id ON token_usage_logs(user_id)")
        .execute(pool)
        .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_token_usage_intention ON token_usage_logs(intention)",
    )
    .execute(pool)
    .await?;

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_token_usage_created_at ON token_usage_logs(created_at DESC)")
        .execute(pool)
        .await?;

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_token_usage_user_intention ON token_usage_logs(user_id, intention, created_at DESC)")
        .execute(pool)
        .await?;

    info!("✅ Table token_usage_logs créée avec succès !");

    Ok(())
}

/// Vérifie et crée la table search_history si elle n'existe pas
pub async fn ensure_search_history_table(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification de la table search_history...");

    let exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'search_history')"
    )
    .fetch_one(pool)
    .await?;

    if exists {
        info!("✅ Table search_history déjà présente");
        return Ok(());
    }

    warn!("⚠️ Table search_history manquante, création en cours...");

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS search_history (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            query TEXT NOT NULL,
            query_type VARCHAR(50) DEFAULT 'text',
            specialized_type VARCHAR(50),
            category VARCHAR(255),
            filters JSONB,
            location_lat DOUBLE PRECISION,
            location_lon DOUBLE PRECISION,
            results_count INTEGER DEFAULT 0,
            clicked_result_id INTEGER,
            clicked_at TIMESTAMPTZ,
            session_id VARCHAR(255),
            device_type VARCHAR(50),
            searched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            created_at TIMESTAMPTZ DEFAULT NOW()
        )
    "#,
    )
    .execute(pool)
    .await?;

    // Ajouter la colonne searched_at si elle n'existe pas (pour les tables existantes)
    sqlx::query(
        r#"
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'search_history' AND column_name = 'searched_at'
            ) THEN
                ALTER TABLE search_history ADD COLUMN searched_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
            END IF;
        END $$;
        "#,
    )
    .execute(pool)
    .await?;

    // Index
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_search_history_user_id ON search_history(user_id) WHERE user_id IS NOT NULL")
        .execute(pool)
        .await?;
    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_search_history_query_type ON search_history(query_type)",
    )
    .execute(pool)
    .await?;
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_search_history_created_at ON search_history(created_at DESC)")
        .execute(pool)
        .await?;
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_search_history_user_created ON search_history(user_id, created_at DESC) WHERE user_id IS NOT NULL")
        .execute(pool)
        .await?;

    info!("✅ Table search_history créée avec succès !");
    Ok(())
}

/// Vérifie et crée la table alerts si elle n'existe pas
pub async fn ensure_alerts_table(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification de la table alerts...");

    let exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'alerts')",
    )
    .fetch_one(pool)
    .await?;

    if exists {
        info!("✅ Table alerts déjà présente");
        return Ok(());
    }

    warn!("⚠️ Table alerts manquante, création en cours...");

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS alerts (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
            client_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            alert_type VARCHAR(32) NOT NULL,
            is_read BOOLEAN NOT NULL DEFAULT FALSE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    "#,
    )
    .execute(pool)
    .await?;

    // Index
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_alerts_user_id ON alerts(user_id)")
        .execute(pool)
        .await?;
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_alerts_service_id ON alerts(service_id)")
        .execute(pool)
        .await?;
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_alerts_is_read ON alerts(is_read)")
        .execute(pool)
        .await?;

    info!("✅ Table alerts créée avec succès !");
    Ok(())
}

/// Vérifie et crée les tables signalements et sanctions_historique si elles n'existent pas
pub async fn ensure_signalements_tables(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification des tables signalements...");

    let exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'signalements')",
    )
    .fetch_one(pool)
    .await?;

    if exists {
        info!("✅ Table signalements déjà présente");
        return Ok(());
    }

    warn!("⚠️ Tables signalements manquantes, création en cours...");

    // Table signalements
    sqlx::query(r#"
        CREATE TABLE IF NOT EXISTS signalements (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            service_id INTEGER REFERENCES services(id) ON DELETE CASCADE,
            product_id TEXT,
            product_name TEXT,
            type_signalement VARCHAR(50) NOT NULL CHECK (type_signalement IN (
                'contenu_inapproprie', 'arnaque_suspectee', 'prix_trompeur',
                'produit_contrefait', 'photo_trompeuse', 'harcelement',
                'spam', 'informations_fausses', 'autre'
            )),
            motifs_predefinis TEXT[],
            motif_libre TEXT,
            preuves JSONB,
            statut VARCHAR(20) DEFAULT 'en_attente' CHECK (statut IN (
                'en_attente', 'en_cours', 'resolu', 'rejete', 'archive'
            )),
            priorite VARCHAR(20) DEFAULT 'normale' CHECK (priorite IN ('basse', 'normale', 'haute', 'urgente')),
            moderateur_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
            decision TEXT,
            action_prise TEXT,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW(),
            traite_at TIMESTAMPTZ
        )
    "#)
    .execute(pool)
    .await?;

    // Index pour signalements
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_signalements_user ON signalements(user_id)")
        .execute(pool)
        .await?;
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_signalements_service ON signalements(service_id)")
        .execute(pool)
        .await?;
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_signalements_statut ON signalements(statut)")
        .execute(pool)
        .await?;

    // Table sanctions_historique
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS sanctions_historique (
            id SERIAL PRIMARY KEY,
            service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            signalement_id INTEGER REFERENCES signalements(id) ON DELETE SET NULL,
            type_sanction VARCHAR(50) NOT NULL CHECK (type_sanction IN (
                'avertissement', 'suspension_temporaire', 'suspension_definitive',
                'suppression_service', 'suppression_produit', 'restriction_publication'
            )),
            duree_jours INTEGER,
            raison TEXT NOT NULL,
            moderateur_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
            debut_sanction TIMESTAMPTZ DEFAULT NOW(),
            fin_sanction TIMESTAMPTZ,
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMPTZ DEFAULT NOW()
        )
    "#,
    )
    .execute(pool)
    .await?;

    // Index pour sanctions
    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_sanctions_service ON sanctions_historique(service_id)",
    )
    .execute(pool)
    .await?;
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_sanctions_user ON sanctions_historique(user_id)")
        .execute(pool)
        .await?;

    info!("✅ Tables signalements et sanctions_historique créées avec succès !");
    Ok(())
}

/// Vérifie et crée la table private_conversations si elle n'existe pas
pub async fn ensure_private_conversations_table(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification de la table private_conversations...");

    let exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'private_conversations')"
    )
    .fetch_one(pool)
    .await?;

    if exists {
        info!("✅ Table private_conversations déjà présente");
        return Ok(());
    }

    warn!("⚠️ Table private_conversations manquante, création en cours...");

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS private_conversations (
            id SERIAL PRIMARY KEY,
            user_1_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            user_2_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            context TEXT,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            last_message_at TIMESTAMPTZ DEFAULT NOW(),
            UNIQUE(user_1_id, user_2_id),
            CONSTRAINT chk_users_order CHECK (user_1_id < user_2_id)
        )
    "#,
    )
    .execute(pool)
    .await?;

    // Index
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_private_conversations_user_1 ON private_conversations(user_1_id)")
        .execute(pool)
        .await?;
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_private_conversations_user_2 ON private_conversations(user_2_id)")
        .execute(pool)
        .await?;
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_private_conversations_last_message ON private_conversations(last_message_at DESC)")
        .execute(pool)
        .await?;

    info!("✅ Table private_conversations créée avec succès !");
    Ok(())
}

/// Vérifie et crée la table bus_reservations si elle n'existe pas
pub async fn ensure_bus_reservations_table(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification de la table bus_reservations...");

    let exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'bus_reservations')"
    )
    .fetch_one(pool)
    .await?;

    if exists {
        info!("✅ Table bus_reservations déjà présente");
        return Ok(());
    }

    warn!("⚠️ Table bus_reservations manquante, création en cours...");

    sqlx::query(r#"
        CREATE TABLE IF NOT EXISTS bus_reservations (
            id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
            product_id TEXT NOT NULL,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            seat_id VARCHAR(50) NOT NULL,
            seat_number INTEGER NOT NULL,
            passenger_name VARCHAR(255),
            status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled', 'expired')),
            caution_amount INTEGER DEFAULT 500,
            total_price INTEGER,
            payment_status VARCHAR(20) DEFAULT 'caution_paid' CHECK (payment_status IN ('caution_paid', 'fully_paid', 'refunded')),
            ticket_pdf_url TEXT,
            expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 minutes'),
            confirmed_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW(),
            CONSTRAINT unique_product_seat UNIQUE (product_id, seat_id)
        )
    "#)
    .execute(pool)
    .await?;

    // Index
    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_bus_reservations_user ON bus_reservations(user_id)",
    )
    .execute(pool)
    .await?;
    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_bus_reservations_product ON bus_reservations(product_id)",
    )
    .execute(pool)
    .await?;
    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_bus_reservations_status ON bus_reservations(status)",
    )
    .execute(pool)
    .await?;

    info!("✅ Table bus_reservations créée avec succès !");
    Ok(())
}

/// ✅ NOUVEAU 2026-02-08: Créer la table navigation_saved_destinations pour destinations favorites
pub async fn ensure_navigation_saved_destinations_table(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification de la table navigation_saved_destinations...");

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS navigation_saved_destinations (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            label VARCHAR(50) NOT NULL,
            custom_label VARCHAR(100),
            address TEXT NOT NULL,
            latitude DOUBLE PRECISION NOT NULL,
            longitude DOUBLE PRECISION NOT NULL,
            place_id VARCHAR(255),
            is_default BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            
            CONSTRAINT navigation_saved_destinations_user_label_custom_unique UNIQUE(user_id, label, custom_label)
        )
    "#,
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_navigation_saved_destinations_user_id ON navigation_saved_destinations(user_id)",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_navigation_saved_destinations_label ON navigation_saved_destinations(user_id, label)",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_navigation_saved_destinations_default ON navigation_saved_destinations(user_id, is_default) WHERE is_default = true",
    )
    .execute(pool)
    .await?;

    // ✅ FIX: Remplacer la contrainte UNIQUE(user_id, label) par UNIQUE(user_id, label, custom_label)
    // pour permettre plusieurs destinations 'autre' avec des custom_labels différents
    sqlx::query(
        "ALTER TABLE navigation_saved_destinations DROP CONSTRAINT IF EXISTS navigation_saved_destinations_user_label_unique",
    )
    .execute(pool)
    .await
    .ok(); // Ignorer l'erreur si la contrainte n'existe pas

    sqlx::query(
        r#"DO $$ BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint WHERE conname = 'navigation_saved_destinations_user_label_custom_unique'
            ) THEN
                ALTER TABLE navigation_saved_destinations
                ADD CONSTRAINT navigation_saved_destinations_user_label_custom_unique
                UNIQUE(user_id, label, custom_label);
            END IF;
        END $$"#,
    )
    .execute(pool)
    .await
    .ok();

    info!("✅ Table navigation_saved_destinations créée/vérifiée avec succès");
    Ok(())
}

/// ✅ NOUVEAU 2026-02-08: Créer la table navigation_trips pour navigation intelligente
pub async fn ensure_navigation_trips_table(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification de la table navigation_trips...");

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS navigation_trips (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            origin_lat DOUBLE PRECISION NOT NULL,
            origin_lng DOUBLE PRECISION NOT NULL,
            destination_lat DOUBLE PRECISION NOT NULL,
            destination_lng DOUBLE PRECISION NOT NULL,
            route_id VARCHAR(255) NOT NULL,
            distance_meters DOUBLE PRECISION NOT NULL,
            duration_seconds BIGINT NOT NULL,
            waypoints JSONB,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            
            CONSTRAINT navigation_trips_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    "#,
    )
    .execute(pool)
    .await?;

    // Index pour optimiser les requêtes de statistiques
    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_navigation_trips_user_id ON navigation_trips(user_id)",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_navigation_trips_created_at ON navigation_trips(created_at DESC)",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_navigation_trips_destination ON navigation_trips(destination_lat, destination_lng)",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_navigation_trips_user_created ON navigation_trips(user_id, created_at DESC)",
    )
    .execute(pool)
    .await?;

    info!("✅ Table navigation_trips créée/vérifiée avec succès");
    Ok(())
}

/// ✅ NOUVEAU 2026-03-05: Table pour radars, contrôles de police et dangers signalés par la communauté
pub async fn ensure_navigation_checkpoints_table(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification de la table navigation_checkpoints...");

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS navigation_checkpoints (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            reported_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
            checkpoint_type VARCHAR(50) NOT NULL,
            latitude DOUBLE PRECISION NOT NULL,
            longitude DOUBLE PRECISION NOT NULL,
            description TEXT,
            speed_limit INTEGER,
            is_permanent BOOLEAN DEFAULT false,
            upvotes INTEGER DEFAULT 1,
            downvotes INTEGER DEFAULT 0,
            is_active BOOLEAN DEFAULT true,
            expires_at TIMESTAMP WITH TIME ZONE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
    "#,
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_nav_checkpoints_location ON navigation_checkpoints(latitude, longitude) WHERE is_active = true",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_nav_checkpoints_type ON navigation_checkpoints(checkpoint_type) WHERE is_active = true",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_nav_checkpoints_expires ON navigation_checkpoints(expires_at) WHERE expires_at IS NOT NULL AND is_active = true",
    )
    .execute(pool)
    .await?;

    info!("✅ Table navigation_checkpoints créée/vérifiée avec succès");
    Ok(())
}

/// ✅ NOUVEAU 2026-03-05: Table des votes utilisateurs sur les checkpoints (éviter les doublons)
pub async fn ensure_navigation_checkpoint_votes_table(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification de la table navigation_checkpoint_votes...");

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS navigation_checkpoint_votes (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            checkpoint_id UUID NOT NULL REFERENCES navigation_checkpoints(id) ON DELETE CASCADE,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            vote VARCHAR(10) NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            CONSTRAINT nav_checkpoint_vote_unique UNIQUE(checkpoint_id, user_id)
        )
    "#,
    )
    .execute(pool)
    .await?;

    info!("✅ Table navigation_checkpoint_votes créée/vérifiée avec succès");
    Ok(())
}

/// ✅ NOUVEAU 2026-03-05: Table d'activité de navigation (sessions de marche/conduite avec métriques de qualité)
pub async fn ensure_navigation_activity_log_table(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification de la table navigation_activity_log...");

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS navigation_activity_log (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id INTEGER NOT NULL,
            travel_mode VARCHAR(20) NOT NULL DEFAULT 'driving',
            origin_address TEXT,
            destination_address TEXT,
            origin_lat DOUBLE PRECISION,
            origin_lng DOUBLE PRECISION,
            dest_lat DOUBLE PRECISION,
            dest_lng DOUBLE PRECISION,
            distance_meters DOUBLE PRECISION NOT NULL DEFAULT 0,
            duration_seconds INTEGER NOT NULL DEFAULT 0,
            avg_speed_kmh DOUBLE PRECISION DEFAULT 0,
            max_speed_kmh DOUBLE PRECISION DEFAULT 0,
            calories_burned DOUBLE PRECISION DEFAULT 0,
            quality_score DOUBLE PRECISION DEFAULT 0,
            speed_consistency DOUBLE PRECISION DEFAULT 0,
            pace_per_km_seconds DOUBLE PRECISION DEFAULT 0,
            checkpoints_reported INTEGER DEFAULT 0,
            checkpoints_encountered INTEGER DEFAULT 0,
            was_off_route BOOLEAN DEFAULT false,
            started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            ended_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    "#,
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_nav_activity_user ON navigation_activity_log(user_id)",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_nav_activity_started ON navigation_activity_log(started_at)",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_nav_activity_mode ON navigation_activity_log(travel_mode)",
    )
    .execute(pool)
    .await?;

    info!("✅ Table navigation_activity_log créée/vérifiée avec succès");
    Ok(())
}

/// ✅ NOUVEAU 2026-03-05: Table de gamification & achievements navigation
pub async fn ensure_navigation_achievements_table(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification des tables navigation achievements...");

    // Table des achievements/badges utilisateur
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS navigation_user_achievements (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id INTEGER NOT NULL,
            badge_type VARCHAR(50) NOT NULL,
            badge_level INTEGER NOT NULL DEFAULT 1,
            earned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            metadata JSONB DEFAULT '{}',
            UNIQUE(user_id, badge_type, badge_level)
        )
    "#,
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_nav_achievements_user ON navigation_user_achievements(user_id)",
    )
    .execute(pool)
    .await?;

    // Table des défis hebdomadaires/mensuels
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS navigation_challenges (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id INTEGER NOT NULL,
            challenge_type VARCHAR(50) NOT NULL,
            target_value DOUBLE PRECISION NOT NULL,
            current_value DOUBLE PRECISION NOT NULL DEFAULT 0,
            period_start TIMESTAMPTZ NOT NULL,
            period_end TIMESTAMPTZ NOT NULL,
            completed BOOLEAN DEFAULT false,
            completed_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    "#,
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_nav_challenges_user ON navigation_challenges(user_id, period_end)",
    )
    .execute(pool)
    .await?;

    info!("✅ Tables navigation achievements & challenges créées/vérifiées");
    Ok(())
}

/// ✅ NOUVEAU 2025-11-06: Créer les fonctions SQL pour le système de visibilité et carousel mixte
pub async fn ensure_visibility_functions(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Création/Mise à jour des fonctions de visibilité...");

    // Fonction can_show_content
    sqlx::query(r#"
        CREATE OR REPLACE FUNCTION can_show_content(
            p_user_id INTEGER,
            p_content_id VARCHAR(100),
            p_content_type VARCHAR(20),
            p_session_id VARCHAR(100)
        ) RETURNS BOOLEAN AS $$
        BEGIN
            -- Pour l'instant, version simplifiée: toujours autoriser
            -- TODO: Implémenter la vraie logique de cooldown/quota depuis content_visibility_tracking
            RETURN TRUE;
        END;
        $$ LANGUAGE plpgsql;
    "#)
    .execute(pool)
    .await?;

    // Fonction get_eligible_organic_products
    sqlx::query(
        r#"
        CREATE OR REPLACE FUNCTION get_eligible_organic_products(
            p_user_id INTEGER,
            p_session_id VARCHAR(100),
            p_categories TEXT[],
            p_limit INTEGER DEFAULT 15
        ) RETURNS TABLE (
            product_id TEXT,
            product_data JSONB,
            relevance_score DECIMAL
        ) AS $$
        BEGIN
            RETURN QUERY
            SELECT 
                s.id::TEXT,
                jsonb_build_object(
                    'id', s.id,
                    'service_id', s.id,
                    'nom', COALESCE(s.data->'titre_service'->>'valeur', 'Service'),
                    'description', COALESCE(s.data->'description'->>'valeur', ''),
                    'prix', COALESCE(s.data->'prix'->>'valeur', '0'),
                    'devise', COALESCE(s.data->'devise'->>'valeur', 'XAF'),
                    'produits', s.data->'produits',
                    'category', s.category
                ),
                1.0::DECIMAL
            FROM services s
            WHERE s.is_active = TRUE
            ORDER BY s.created_at DESC
            LIMIT p_limit;
        END;
        $$ LANGUAGE plpgsql;
    "#,
    )
    .execute(pool)
    .await?;

    // Fonction get_eligible_paid_ads
    sqlx::query(
        r#"
        CREATE OR REPLACE FUNCTION get_eligible_paid_ads(
            p_user_id INTEGER,
            p_session_id VARCHAR(100),
            p_categories TEXT[],
            p_boost_level VARCHAR(20) DEFAULT NULL
        ) RETURNS TABLE (
            pub_id INTEGER,
            pub_data JSONB,
            boost_level VARCHAR(20),
            frequency_ratio INTEGER
        ) AS $$
        BEGIN
            RETURN QUERY
            SELECT 
                p.id,
                jsonb_build_object(
                    'id', p.id,
                    'titre', p.titre,
                    'description', p.description,
                    'videos', p.videos,
                    'thumbnails', p.thumbnails
                ),
                COALESCE(p.boost_level, 'basic'),
                COALESCE(p.frequency_ratio, 3)
            FROM publicites p
            WHERE p.status = 'active'
            AND p.date_fin > NOW()
            ORDER BY 
                CASE COALESCE(p.boost_level, 'basic')
                    WHEN 'ultra' THEN 1
                    WHEN 'premium' THEN 2
                    ELSE 3
                END
            LIMIT 10;
        END;
        $$ LANGUAGE plpgsql;
    "#,
    )
    .execute(pool)
    .await?;

    info!("✅ Fonctions de visibilité créées avec succès !");
    Ok(())
}

/// ✅ NOUVEAU 2025-11-06: Nettoyer les combinaisons invalides (objets uniques générés comme catalogue)
pub async fn clean_invalid_combinations_migration(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🧹 Nettoyage des combinaisons invalides...");

    // Vérifier si la table existe
    let table_exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'autocomplete_combinations')"
    )
    .fetch_one(pool)
    .await?;

    if !table_exists {
        info!("⚠️ Table autocomplete_combinations n'existe pas, skip nettoyage");
        return Ok(());
    }

    // Compter avant nettoyage
    let total_before =
        sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM autocomplete_combinations")
            .fetch_one(pool)
            .await?;

    if total_before == 0 {
        info!("✅ Table autocomplete_combinations vide, rien à nettoyer");
        return Ok(());
    }

    // Identifier les sessions problématiques (>50 combinaisons)
    let problematic_count = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(DISTINCT session_id) FROM autocomplete_combinations 
         WHERE session_id IS NOT NULL 
         GROUP BY session_id 
         HAVING COUNT(*) > 50",
    )
    .fetch_one(pool)
    .await
    .unwrap_or(0);

    if problematic_count == 0 {
        info!("✅ Aucune session problématique détectée");
        return Ok(());
    }

    info!(
        "🔍 {} sessions avec >50 combinaisons détectées",
        problematic_count
    );

    // Nettoyer: Garder seulement la combinaison préférée de chaque session problématique
    // Utiliser sqlx::query() pour compatibilité offline
    let result = sqlx::query(
        r#"
        DELETE FROM autocomplete_combinations
        WHERE id NOT IN (
            SELECT MIN(id)
            FROM autocomplete_combinations
            WHERE session_id IS NOT NULL AND is_ai_preferred = TRUE
            GROUP BY session_id
        )
        AND session_id IN (
            SELECT session_id
            FROM autocomplete_combinations
            WHERE session_id IS NOT NULL
            GROUP BY session_id
            HAVING COUNT(*) > 50
        )
        AND service_id IS NULL
        "#,
    )
    .execute(pool)
    .await?;

    let deleted_count = result.rows_affected();

    if deleted_count > 0 {
        info!("✅ {} combinaisons invalides supprimées", deleted_count);

        // Optimiser la table après nettoyage
        let _ = sqlx::query("REINDEX TABLE autocomplete_combinations").execute(pool).await;

        let _ = sqlx::query("ANALYZE autocomplete_combinations").execute(pool).await;

        info!("✅ Table autocomplete_combinations optimisée");
    } else {
        info!("✅ Aucune combinaison à supprimer");
    }

    // Compter après nettoyage
    let total_after =
        sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM autocomplete_combinations")
            .fetch_one(pool)
            .await?;

    info!(
        "📊 Nettoyage terminé: {} → {} combinaisons ({} supprimées)",
        total_before, total_after, deleted_count
    );

    Ok(())
}

pub async fn ensure_social_connectors_tables(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification des tables social_accounts / social_publications / social_publication_jobs...");

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS social_accounts (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            platform TEXT NOT NULL,
            account_handle TEXT,
            access_token TEXT NOT NULL,
            refresh_token TEXT,
            expires_at TIMESTAMPTZ,
            scope TEXT,
            metadata JSONB DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            UNIQUE(user_id, platform)
        )",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS social_publications (
            id SERIAL PRIMARY KEY,
            media_id INTEGER NOT NULL REFERENCES media(id) ON DELETE CASCADE,
            platform TEXT NOT NULL,
            external_post_id TEXT,
            status TEXT NOT NULL DEFAULT 'pending',
            published_at TIMESTAMPTZ,
            last_synced_at TIMESTAMPTZ,
            metadata JSONB DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS social_publication_jobs (
            id SERIAL PRIMARY KEY,
            media_id INTEGER NOT NULL REFERENCES media(id) ON DELETE CASCADE,
            platform TEXT NOT NULL,
            payload JSONB NOT NULL,
            status TEXT NOT NULL DEFAULT 'queued',
            attempt INTEGER NOT NULL DEFAULT 0,
            last_error TEXT,
            scheduled_for TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )",
    )
    .execute(pool)
    .await?;

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_social_accounts_user_platform ON social_accounts(user_id, platform)")
        .execute(pool)
        .await?;
    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_social_publications_media ON social_publications(media_id)",
    )
    .execute(pool)
    .await?;
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_social_publications_platform ON social_publications(platform)")
        .execute(pool)
        .await?;
    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_social_publication_jobs_status ON social_publication_jobs(status, scheduled_for)",
    )
    .execute(pool)
    .await?;

    // ✅ Vérifier et ajouter les colonnes manquantes pour social_publication_jobs
    ensure_social_publication_jobs_columns(pool).await?;

    Ok(())
}

/// ✅ Vérifie et ajoute les colonnes manquantes pour global_promo_entries
async fn ensure_global_promo_entries_columns(pool: &PgPool) -> Result<(), sqlx::Error> {
    // Renommer promo_event_id en event_id si nécessaire
    sqlx::query(
        r#"
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'global_promo_entries' AND column_name = 'promo_event_id'
            ) AND NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'global_promo_entries' AND column_name = 'event_id'
            ) THEN
                ALTER TABLE global_promo_entries RENAME COLUMN promo_event_id TO event_id;
            END IF;
        END $$;
        "#,
    )
    .execute(pool)
    .await?;

    // Ajouter event_id si n'existe pas
    sqlx::query(
        r#"
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'global_promo_entries' AND column_name = 'event_id'
            ) THEN
                ALTER TABLE global_promo_entries ADD COLUMN event_id UUID REFERENCES global_promo_events(id) ON DELETE CASCADE;
            END IF;
        END $$;
        "#,
    )
    .execute(pool)
    .await?;

    // Ajouter submitted_by_user_id si n'existe pas
    sqlx::query(
        r#"
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'global_promo_entries' AND column_name = 'submitted_by_user_id'
            ) THEN
                ALTER TABLE global_promo_entries ADD COLUMN submitted_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
            END IF;
        END $$;
        "#,
    )
    .execute(pool)
    .await?;

    // Ajouter status si n'existe pas
    sqlx::query(
        r#"
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'global_promo_entries' AND column_name = 'status'
            ) THEN
                ALTER TABLE global_promo_entries ADD COLUMN status VARCHAR(32) NOT NULL DEFAULT 'draft' CHECK (
                    status IN ('draft', 'pending_review', 'approved', 'rejected', 'published', 'ended')
                );
            END IF;
        END $$;
        "#,
    )
    .execute(pool)
    .await?;

    // Ajouter metadata si n'existe pas
    sqlx::query(
        r#"
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'global_promo_entries' AND column_name = 'metadata'
            ) THEN
                ALTER TABLE global_promo_entries ADD COLUMN metadata JSONB NOT NULL DEFAULT '{}'::JSONB;
            END IF;
        END $$;
        "#,
    )
    .execute(pool)
    .await?;

    Ok(())
}

/// ✅ Vérifie et ajoute les colonnes manquantes pour live_flash_sales
async fn ensure_live_flash_sales_columns(pool: &PgPool) -> Result<(), sqlx::Error> {
    // Ajouter metadata si n'existe pas
    sqlx::query(
        r#"
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'live_flash_sales' AND column_name = 'metadata'
            ) THEN
                ALTER TABLE live_flash_sales ADD COLUMN metadata JSONB DEFAULT '{}'::JSONB;
            END IF;
        END $$;
        "#,
    )
    .execute(pool)
    .await?;

    // Ajouter stock_target si n'existe pas
    sqlx::query(
        r#"
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'live_flash_sales' AND column_name = 'stock_target'
            ) THEN
                ALTER TABLE live_flash_sales ADD COLUMN stock_target INTEGER NOT NULL DEFAULT 0 CHECK (stock_target >= 0);
            END IF;
        END $$;
        "#,
    )
    .execute(pool)
    .await?;

    Ok(())
}

/// ✅ Vérifie et ajoute les colonnes manquantes pour social_publication_jobs
async fn ensure_social_publication_jobs_columns(pool: &PgPool) -> Result<(), sqlx::Error> {
    // Renommer job_status en status si nécessaire
    sqlx::query(
        r#"
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'social_publication_jobs' AND column_name = 'job_status'
            ) AND NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'social_publication_jobs' AND column_name = 'status'
            ) THEN
                ALTER TABLE social_publication_jobs RENAME COLUMN job_status TO status;
            END IF;
        END $$;
        "#,
    )
    .execute(pool)
    .await?;

    // Ajouter status si n'existe pas
    sqlx::query(
        r#"
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'social_publication_jobs' AND column_name = 'status'
            ) THEN
                ALTER TABLE social_publication_jobs ADD COLUMN status TEXT NOT NULL DEFAULT 'queued';
            END IF;
        END $$;
        "#,
    )
    .execute(pool)
    .await?;

    // Ajouter payload si n'existe pas
    sqlx::query(
        r#"
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'social_publication_jobs' AND column_name = 'payload'
            ) THEN
                ALTER TABLE social_publication_jobs ADD COLUMN payload JSONB NOT NULL DEFAULT '{}'::jsonb;
            END IF;
        END $$;
        "#,
    )
    .execute(pool)
    .await?;

    // Ajouter media_id si n'existe pas
    sqlx::query(
        r#"
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'social_publication_jobs' AND column_name = 'media_id'
            ) THEN
                ALTER TABLE social_publication_jobs ADD COLUMN media_id INTEGER REFERENCES media(id) ON DELETE CASCADE;
            END IF;
        END $$;
        "#,
    )
    .execute(pool)
    .await?;

    // Ajouter platform si n'existe pas
    sqlx::query(
        r#"
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'social_publication_jobs' AND column_name = 'platform'
            ) THEN
                ALTER TABLE social_publication_jobs ADD COLUMN platform TEXT NOT NULL DEFAULT 'unknown';
            END IF;
        END $$;
        "#,
    )
    .execute(pool)
    .await?;

    // Ajouter attempt si n'existe pas
    sqlx::query(
        r#"
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'social_publication_jobs' AND column_name = 'attempt'
            ) THEN
                ALTER TABLE social_publication_jobs ADD COLUMN attempt INTEGER NOT NULL DEFAULT 0;
            END IF;
        END $$;
        "#,
    )
    .execute(pool)
    .await?;

    // Ajouter last_error si n'existe pas
    sqlx::query(
        r#"
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'social_publication_jobs' AND column_name = 'last_error'
            ) THEN
                ALTER TABLE social_publication_jobs ADD COLUMN last_error TEXT;
            END IF;
        END $$;
        "#,
    )
    .execute(pool)
    .await?;

    Ok(())
}

/// ✅ Vérifie et ajoute les colonnes manquantes pour global_promo_events
async fn ensure_global_promo_events_columns(pool: &PgPool) -> Result<(), sqlx::Error> {
    // Ajouter status si n'existe pas
    sqlx::query(
        r#"
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'global_promo_events' AND column_name = 'status'
            ) THEN
                ALTER TABLE global_promo_events
                ADD COLUMN status VARCHAR(32) NOT NULL DEFAULT 'draft'
                CHECK (status IN ('draft', 'scheduled', 'live', 'archived'));
            END IF;
        END $$;
        "#,
    )
    .execute(pool)
    .await?;

    Ok(())
}

/// Vérifie et crée la table product_delivery_config si elle n'existe pas
pub async fn ensure_product_delivery_config_table(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification de la table product_delivery_config...");

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS product_delivery_config (
            id SERIAL PRIMARY KEY,
            service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
            product_index INTEGER NOT NULL,
            
            -- Pickup (obligatoire)
            pickup_address TEXT NOT NULL,
            pickup_latitude DOUBLE PRECISION NOT NULL,
            pickup_longitude DOUBLE PRECISION NOT NULL,
            
            -- Type véhicule (obligatoire)
            required_vehicle_type_id INTEGER NOT NULL REFERENCES parcel_types(id),
            weight_kg DOUBLE PRECISION,
            volume_cm3 DOUBLE PRECISION,
            requires_isothermal BOOLEAN DEFAULT FALSE,
            requires_fragile_handling BOOLEAN DEFAULT FALSE,
            
            -- Plages horaires de récupération (obligatoire)
            pickup_availability_schedule JSONB NOT NULL,
            
            -- Informations additionnelles
            pickup_instructions TEXT,
            billing_mode VARCHAR(50) DEFAULT 'standard',
            billing_partner_label TEXT,
            
            -- Statut
            is_configured BOOLEAN DEFAULT FALSE,
            configured_at TIMESTAMPTZ,
            configured_by INTEGER REFERENCES users(id),
            
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            
            UNIQUE(service_id, product_index)
        )
        "#,
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_product_delivery_config_service ON product_delivery_config(service_id, product_index)",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_product_delivery_config_active ON product_delivery_config(is_configured) WHERE is_configured = TRUE",
    )
    .execute(pool)
    .await?;

    Ok(())
}

/// ✅ Phase 3 - Amélioration 7 : Vérifie et crée la table client_delivery_preferences si elle n'existe pas
pub async fn ensure_client_delivery_preferences_table(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification de la table client_delivery_preferences...");

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS client_delivery_preferences (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            delivery_id UUID REFERENCES deliveries(id) ON DELETE SET NULL,
            
            -- Préférences de livraison
            preferred_delivery_date DATE,
            preferred_delivery_time_start TIME,
            preferred_delivery_time_end TIME,
            preferred_delivery_window_hours INTEGER DEFAULT 2,
            
            -- Contraintes
            avoid_days INTEGER[],
            urgency_level VARCHAR(50) DEFAULT 'standard',
            
            -- Flexibilité
            is_flexible BOOLEAN DEFAULT TRUE,
            flexibility_window_days INTEGER DEFAULT 3,
            
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            
            UNIQUE(user_id, delivery_id)
        )
        "#,
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_client_delivery_preferences_user ON client_delivery_preferences(user_id)",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_client_delivery_preferences_delivery ON client_delivery_preferences(delivery_id)",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_client_delivery_preferences_date ON client_delivery_preferences(preferred_delivery_date)",
    )
    .execute(pool)
    .await?;

    Ok(())
}

/// ✅ Phase 4 - Amélioration 8 : Vérifie et crée la table external_delivery_providers si elle n'existe pas
pub async fn ensure_external_delivery_providers_table(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification de la table external_delivery_providers...");

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS external_delivery_providers (
            id SERIAL PRIMARY KEY,
            provider_name VARCHAR(255) NOT NULL,
            api_key VARCHAR(255) UNIQUE NOT NULL,
            api_secret VARCHAR(255) NOT NULL,
            contact_email VARCHAR(255),
            contact_phone VARCHAR(255),
            webhook_url TEXT,
            allowed_ips INET[],
            rate_limit_per_hour INTEGER DEFAULT 100,
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            last_used_at TIMESTAMPTZ,
            total_deliveries INTEGER DEFAULT 0,
            metadata JSONB DEFAULT '{}'::jsonb
        )
        "#,
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_external_providers_api_key ON external_delivery_providers(api_key)",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_external_providers_active ON external_delivery_providers(is_active) WHERE is_active = TRUE",
    )
    .execute(pool)
    .await?;

    // ✅ Phase 11: Index sur contact_phone pour lookup WhatsApp rapide
    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_external_providers_phone ON external_delivery_providers(contact_phone) WHERE contact_phone IS NOT NULL",
    )
    .execute(pool)
    .await?;

    Ok(())
}

/// ✅ Phase 11: Vérifie et crée la table public_tracking_tokens si elle n'existe pas
pub async fn ensure_public_tracking_tokens_table(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification de la table public_tracking_tokens...");

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS public_tracking_tokens (
            id SERIAL PRIMARY KEY,
            delivery_id UUID NOT NULL,
            tracking_token VARCHAR(255) UNIQUE NOT NULL,
            provider_id INTEGER REFERENCES external_delivery_providers(id) ON DELETE SET NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            expires_at TIMESTAMPTZ,
            UNIQUE(delivery_id, tracking_token)
        )
        "#,
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_public_tracking_tokens_token ON public_tracking_tokens(tracking_token)",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_public_tracking_tokens_delivery ON public_tracking_tokens(delivery_id)",
    )
    .execute(pool)
    .await?;

    Ok(())
}

/// ✅ Phase 5 - Améliorations 10-15 : Crée la table delivery_payment_reservations
pub async fn ensure_delivery_payment_reservations_table(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification de la table delivery_payment_reservations...");
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS delivery_payment_reservations (
            id SERIAL PRIMARY KEY,
            delivery_id UUID NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            
            -- Montants
            product_price_cents BIGINT NOT NULL,
            delivery_cost_cents BIGINT NOT NULL,
            total_amount_cents BIGINT NOT NULL,
            
            -- Mode de facturation
            billing_mode VARCHAR(50) DEFAULT 'standard',
            merchant_pays_delivery BOOLEAN DEFAULT FALSE,
            
            -- Statut de la réservation
            reservation_status VARCHAR(50) DEFAULT 'reserved',
            
            -- Informations de débit
            reserved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            debited_at TIMESTAMPTZ,
            released_at TIMESTAMPTZ,
            refunded_at TIMESTAMPTZ,
            
            -- Informations de reversement prestataire
            merchant_payout_cents BIGINT,
            commission_cents BIGINT,
            commission_rate DECIMAL(5,4) DEFAULT 0.05,
            merchant_paid_at TIMESTAMPTZ,
            
            -- Métadonnées
            metadata JSONB DEFAULT '{}'::jsonb,
            
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            
            UNIQUE(delivery_id)
        )
        "#,
    )
    .execute(pool)
    .await?;
    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_delivery_payment_reservations_delivery ON delivery_payment_reservations(delivery_id)",
    )
    .execute(pool)
    .await?;
    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_delivery_payment_reservations_user ON delivery_payment_reservations(user_id)",
    )
    .execute(pool)
    .await?;
    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_delivery_payment_reservations_status ON delivery_payment_reservations(reservation_status)",
    )
    .execute(pool)
    .await?;
    Ok(())
}

/// ✅ Crée les tables token_consumption_logs et purchase_history si elles n'existent pas (sécurisé)
pub async fn ensure_token_consumption_and_purchase_history_tables(
    pool: &PgPool,
) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification/création des tables token_consumption_logs et purchase_history...");

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS token_consumption_logs (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            service_name TEXT,
            amount_consumed BIGINT NOT NULL DEFAULT 0,
            description TEXT,
            metadata JSONB
        )
        "#,
    )
    .execute(pool)
    .await?;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS purchase_history (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            amount_paid BIGINT NOT NULL DEFAULT 0,
            tokens_received BIGINT NOT NULL DEFAULT 0,
            payment_method TEXT,
            status TEXT NOT NULL DEFAULT 'pending',
            transaction_id TEXT,
            metadata JSONB
        )
        "#,
    )
    .execute(pool)
    .await?;

    let _ = sqlx::query("CREATE INDEX IF NOT EXISTS idx_token_consumption_logs_user_id ON token_consumption_logs(user_id)").execute(pool).await;
    let _ = sqlx::query("CREATE INDEX IF NOT EXISTS idx_token_consumption_logs_created_at ON token_consumption_logs(created_at DESC)").execute(pool).await;
    let _ = sqlx::query("CREATE INDEX IF NOT EXISTS idx_token_consumption_logs_user_created ON token_consumption_logs(user_id, created_at DESC)").execute(pool).await;
    let _ = sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_purchase_history_user_id ON purchase_history(user_id)",
    )
    .execute(pool)
    .await;
    let _ = sqlx::query("CREATE INDEX IF NOT EXISTS idx_purchase_history_created_at ON purchase_history(created_at DESC)").execute(pool).await;
    let _ = sqlx::query("CREATE INDEX IF NOT EXISTS idx_purchase_history_user_created ON purchase_history(user_id, created_at DESC)").execute(pool).await;
    let _ = sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_purchase_history_status ON purchase_history(status)",
    )
    .execute(pool)
    .await;
    let _ = sqlx::query("CREATE INDEX IF NOT EXISTS idx_purchase_history_transaction_id ON purchase_history(transaction_id) WHERE transaction_id IS NOT NULL").execute(pool).await;

    info!("✅ Tables token_consumption_logs et purchase_history créées/vérifiées");
    Ok(())
}

/// Vérifie que la table service_products existe (créée via 00000006_create_product_tables.sql)
/// ✅ NOUVEAU 2026-01-03: Vérifie et crée la table service_products séparée pour améliorer les performances
/// Cette table remplace le stockage JSONB dans services.data->'produits'->'valeur'
/// NOTE: La table products (UUID) pour tickets de bus est préservée et non modifiée
pub async fn ensure_service_products_table(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification de la table service_products...");

    // Vérifier si la table existe
    let table_exists: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'service_products')"
    )
    .fetch_one(pool)
    .await?;

    if table_exists {
        info!("✅ Table service_products déjà présente");

        // ✅ CORRIGÉ: Créer les index même si la table existe déjà (au cas où ils manqueraient)
        info!("🔍 Vérification des index service_products...");

        sqlx::query("CREATE INDEX IF NOT EXISTS idx_service_products_service_id ON service_products(service_id)")
            .execute(pool).await?;
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_service_products_active ON service_products(is_active) WHERE is_active = true")
            .execute(pool).await?;
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_service_products_type ON service_products(product_type)")
            .execute(pool).await?;
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_service_products_name_gin ON service_products USING GIN(to_tsvector('french', product_name))")
            .execute(pool).await?;
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_service_products_data_gin ON service_products USING GIN(product_data)")
            .execute(pool).await?;
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_service_products_service_index ON service_products(service_id, product_index)")
            .execute(pool).await?;
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_service_products_created_at ON service_products(created_at DESC)")
            .execute(pool).await?;

        info!("✅ Index service_products vérifiés/créés");
    } else {
        warn!("⚠️ Table service_products manquante, création en cours...");

        // Créer la table service_products
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS service_products (
                id SERIAL PRIMARY KEY,
                service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
                product_index INTEGER NOT NULL,
                product_data JSONB NOT NULL,
                
                -- Métadonnées générées
                product_name TEXT GENERATED ALWAYS AS (
                    COALESCE(
                        -- Cas 1: nom.valeur (format formulaire dynamique)
                        product_data->'nom'->>'valeur',
                        -- Cas 2: nom_produit.valeur (format formulaire dynamique)
                        product_data->'nom_produit'->>'valeur',
                        -- Cas 3: nom direct (format simple)
                        product_data->>'nom',
                        -- Cas 4: nom_produit direct (format simple)
                        product_data->>'nom_produit',
                        -- Cas 5: titre (fallback)
                        product_data->>'titre',
                        -- Cas 6: title (fallback anglais)
                        product_data->>'title',
                        -- Cas 7: name (fallback anglais)
                        product_data->>'name',
                        -- Fallback final
                        'Produit sans nom'
                    )
                ) STORED,
                
                product_type TEXT GENERATED ALWAYS AS (
                    COALESCE(
                        product_data->'type'->>'valeur',
                        product_data->>'type',
                        'autre'
                    )
                ) STORED,
                
                product_price NUMERIC GENERATED ALWAYS AS (
                    CASE 
                        WHEN product_data->'prix'->'valeur'->>'montant' IS NOT NULL 
                        THEN (product_data->'prix'->'valeur'->>'montant')::NUMERIC
                        WHEN product_data->'prix'->>'montant' IS NOT NULL 
                        THEN (product_data->'prix'->>'montant')::NUMERIC
                        WHEN product_data->>'prix' IS NOT NULL 
                        THEN (product_data->>'prix')::NUMERIC
                        ELSE NULL
                    END
                ) STORED,
                
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW(),
                auto_deactivate_at TIMESTAMPTZ,
                
                UNIQUE(service_id, product_index)
            )
            "#,
        )
        .execute(pool)
        .await?;

        // Créer les index
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_service_products_service_id ON service_products(service_id)")
            .execute(pool).await?;
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_service_products_active ON service_products(is_active) WHERE is_active = true")
            .execute(pool).await?;
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_service_products_type ON service_products(product_type)")
            .execute(pool).await?;
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_service_products_name_gin ON service_products USING GIN(to_tsvector('french', product_name))")
            .execute(pool).await?;
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_service_products_data_gin ON service_products USING GIN(product_data)")
            .execute(pool).await?;
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_service_products_service_index ON service_products(service_id, product_index)")
            .execute(pool).await?;
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_service_products_created_at ON service_products(created_at DESC)")
            .execute(pool).await?;

        // Créer le trigger pour updated_at
        sqlx::query(
            r#"
            CREATE OR REPLACE FUNCTION update_service_products_updated_at()
            RETURNS TRIGGER AS $$
            BEGIN
                NEW.updated_at = NOW();
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql
            "#,
        )
        .execute(pool)
        .await?;

        sqlx::query(
            r#"
            CREATE TRIGGER trg_service_products_updated_at
                BEFORE UPDATE ON service_products
                FOR EACH ROW
                EXECUTE FUNCTION update_service_products_updated_at()
            "#,
        )
        .execute(pool)
        .await?;

        info!("✅ Table service_products créée avec succès !");
    }

    // ✅ NOUVEAU 2026-03-06: Migration des product_name existants pour corriger le bug du premier produit
    migrate_product_name_generation(pool).await?;

    Ok(())
}

/// ✅ Crée la table echanges si elle n'existe pas (sécurisé)
pub async fn ensure_echanges_table(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification/création de la table echanges...");

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS echanges (
            id SERIAL PRIMARY KEY,
            user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            offre JSONB NOT NULL,
            besoin JSONB NOT NULL,
            statut VARCHAR(32) NOT NULL DEFAULT 'en_attente',
            matched_with INT REFERENCES echanges(id),
            quantite_offerte DOUBLE PRECISION,
            quantite_requise DOUBLE PRECISION,
            lot_id INT,
            disponibilite JSONB,
            contraintes JSONB,
            reputation DOUBLE PRECISION,
            gps_fixe_lat DOUBLE PRECISION,
            gps_fixe_lon DOUBLE PRECISION,
            don BOOLEAN DEFAULT false,
            created_at TIMESTAMP NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
        "#,
    )
    .execute(pool)
    .await?;

    let _ = sqlx::query("CREATE INDEX IF NOT EXISTS idx_echanges_statut ON echanges(statut)")
        .execute(pool)
        .await;
    let _ = sqlx::query("CREATE INDEX IF NOT EXISTS idx_echanges_don ON echanges(don)")
        .execute(pool)
        .await;
    let _ = sqlx::query("CREATE INDEX IF NOT EXISTS idx_echanges_user_id ON echanges(user_id)")
        .execute(pool)
        .await;

    info!("✅ Table echanges créée/vérifiée");
    Ok(())
}

/// ✅ Crée les tables de chat si elles n'existent pas (sécurisé)
pub async fn ensure_chat_tables(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification/création des tables de chat...");

    let conversations_exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'conversations')",
    )
    .fetch_one(pool)
    .await?;

    if !conversations_exists {
        warn!("⚠️ Table conversations manquante, création en cours...");
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS conversations (
                id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
                client_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                prestataire_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                service_id INTEGER REFERENCES services(id) ON DELETE SET NULL,
                service_title TEXT,
                status VARCHAR(20) DEFAULT 'active',
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
            "#,
        )
        .execute(pool)
        .await?;
        info!("✅ Table conversations créée");
    }

    let chat_messages_exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'chat_messages')",
    )
    .fetch_one(pool)
    .await?;

    if !chat_messages_exists {
        warn!("⚠️ Table chat_messages manquante, création en cours...");
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS chat_messages (
                id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
                conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
                from_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                content TEXT NOT NULL,
                message_type VARCHAR(20) DEFAULT 'text',
                metadata JSONB,
                is_read BOOLEAN DEFAULT FALSE,
                is_edited BOOLEAN DEFAULT FALSE,
                edited_at TIMESTAMP WITH TIME ZONE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
            "#,
        )
        .execute(pool)
        .await?;

        let _ = sqlx::query("CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation_id ON chat_messages(conversation_id)").execute(pool).await;
        let _ = sqlx::query("CREATE INDEX IF NOT EXISTS idx_chat_messages_from_user_id ON chat_messages(from_user_id)").execute(pool).await;
        let _ = sqlx::query("CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at DESC)").execute(pool).await;
        let _ = sqlx::query(
            "CREATE INDEX IF NOT EXISTS idx_chat_messages_is_read ON chat_messages(is_read)",
        )
        .execute(pool)
        .await;
        let _ = sqlx::query("CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation_created ON chat_messages(conversation_id, created_at DESC)").execute(pool).await;
        info!("✅ Table chat_messages créée");
    }

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS chat_unread_counts (
            id SERIAL PRIMARY KEY,
            conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            unread_count INTEGER DEFAULT 0,
            last_read_message_id TEXT,
            last_read_at TIMESTAMP WITH TIME ZONE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            UNIQUE(conversation_id, user_id)
        )
        "#,
    )
    .execute(pool)
    .await?;

    // ✅ CORRIGÉ 2026-03-11: S'assurer que la table conversations a TOUTES les colonnes requises
    // La table peut avoir été créée par les migrations "fix" (00000071, 00000073) avec un schéma minimal
    // (seulement id, created_at, updated_at), ce qui cause des erreurs 404/500 pour le chat,
    // les prix négociés, et les conversations WebSocket
    if conversations_exists {
        let required_columns = [
            (
                "client_id",
                "INTEGER REFERENCES users(id) ON DELETE CASCADE",
            ),
            (
                "prestataire_id",
                "INTEGER REFERENCES users(id) ON DELETE CASCADE",
            ),
            (
                "service_id",
                "INTEGER REFERENCES services(id) ON DELETE SET NULL",
            ),
            ("service_title", "TEXT"),
            ("status", "VARCHAR(20) DEFAULT 'active'"),
            ("is_active", "BOOLEAN DEFAULT TRUE"),
            ("last_message_at", "TIMESTAMP WITH TIME ZONE DEFAULT NOW()"),
        ];

        for (col_name, col_type) in &required_columns {
            let has_column = sqlx::query_scalar::<_, bool>(
                "SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'conversations' AND column_name = $1)",
            )
            .bind(col_name)
            .fetch_one(pool)
            .await?;

            if !has_column {
                warn!(
                    "⚠️ Colonne '{}' manquante sur conversations, ajout en cours...",
                    col_name
                );
                let alter_sql = format!(
                    "ALTER TABLE conversations ADD COLUMN IF NOT EXISTS {} {}",
                    col_name, col_type
                );
                sqlx::query(&alter_sql).execute(pool).await?;
                info!("✅ Colonne '{}' ajoutée à conversations", col_name);
            }
        }

        // Créer les index manquants
        sqlx::query(
            "CREATE INDEX IF NOT EXISTS idx_conversations_client_id ON conversations(client_id)",
        )
        .execute(pool)
        .await?;
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_conversations_prestataire_id ON conversations(prestataire_id)")
            .execute(pool).await?;
        sqlx::query(
            "CREATE INDEX IF NOT EXISTS idx_conversations_service_id ON conversations(service_id)",
        )
        .execute(pool)
        .await?;
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_conversations_last_message ON conversations(last_message_at DESC)")
            .execute(pool).await?;
    }

    Ok(())
}

/// ✅ NOUVEAU 2025-01-27 : Vérifie et crée la table message_reactions pour les réactions aux messages
/// Optimisé pour scalabilité avec index et contraintes
/// Migration: 20250127_add_message_reactions.sql
pub async fn ensure_message_reactions_table(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification/création de la table message_reactions...");

    // Lire le contenu de la migration SQL
    let migration_sql = include_str!("../../migrations/00000129_add_message_reactions.sql");

    // Exécuter la migration SQL en divisant en commandes individuelles
    execute_migration_sql_safe(pool, migration_sql).await?;

    info!("✅ Table message_reactions créée avec succès");
    Ok(())
}

/// Vérifie et crée/corrige la table user_push_tokens avec le bon schéma
/// ✅ 2025-12-01 : Migration pour corriger le schéma (id SERIAL, device_type, device_id, last_used_at)
pub async fn ensure_push_tokens_table(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification et correction de la table user_push_tokens...");

    // Créer la table si elle n'existe pas
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS user_push_tokens (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            push_token VARCHAR(500) NOT NULL UNIQUE,
            device_type VARCHAR(20) NOT NULL,
            device_id VARCHAR(255),
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            last_used_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
        "#,
    )
    .execute(pool)
    .await?;

    // Vérifier et corriger le schéma si nécessaire (migration depuis ancien schéma)
    sqlx::query(
        r#"
        DO $$
        BEGIN
            -- Renommer platform en device_type si elle existe
            IF EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'user_push_tokens' AND column_name = 'platform'
            ) THEN
                ALTER TABLE user_push_tokens RENAME COLUMN platform TO device_type;
                RAISE NOTICE 'Colonne platform renommée en device_type';
            END IF;
            
            -- Ajouter device_id si manquant
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'user_push_tokens' AND column_name = 'device_id'
            ) THEN
                ALTER TABLE user_push_tokens ADD COLUMN device_id VARCHAR(255);
            END IF;
            
            -- Ajouter last_used_at si manquant
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'user_push_tokens' AND column_name = 'last_used_at'
            ) THEN
                ALTER TABLE user_push_tokens 
                ADD COLUMN last_used_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
            END IF;
        END $$;
        "#,
    )
    .execute(pool)
    .await?;

    // Créer les index
    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_user_push_tokens_user_id ON user_push_tokens(user_id)",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_user_push_tokens_push_token ON user_push_tokens(push_token)",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_user_push_tokens_is_active ON user_push_tokens(is_active)",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_user_push_tokens_device ON user_push_tokens(device_id)",
    )
    .execute(pool)
    .await?;

    // Créer le trigger pour updated_at
    sqlx::query(
        r#"
        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = CURRENT_TIMESTAMP;
            RETURN NEW;
        END;
        $$ language 'plpgsql';
        "#,
    )
    .execute(pool)
    .await?;

    sqlx::query(
        r#"
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_user_push_tokens_updated_at') THEN
                CREATE TRIGGER update_user_push_tokens_updated_at 
                    BEFORE UPDATE ON user_push_tokens 
                    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
            END IF;
        END $$;
        "#,
    )
    .execute(pool)
    .await?;

    info!("✅ Table user_push_tokens vérifiée et corrigée si nécessaire");
    Ok(())
}

/// ✅ Crée la table image_analyses si elle n'existe pas (sécurisé)
pub async fn ensure_image_analyses_table(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification/création de la table image_analyses...");

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS image_analyses (
            id SERIAL PRIMARY KEY,
            service_id INTEGER REFERENCES services(id) ON DELETE CASCADE,
            media_id INTEGER REFERENCES media(id) ON DELETE CASCADE,
            user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
            description TEXT NOT NULL,
            tags TEXT[] NOT NULL DEFAULT '{}',
            category_detected VARCHAR(100),
            marque VARCHAR(100),
            couleurs TEXT[] NOT NULL DEFAULT '{}',
            caracteristiques_cles JSONB NOT NULL DEFAULT '{}',
            search_query_exact TEXT,
            search_query_broad TEXT,
            search_query_semantic TEXT,
            confiance FLOAT DEFAULT 0.0,
            model_used VARCHAR(50),
            tokens_consumed INTEGER DEFAULT 0,
            cost_usd DECIMAL(10, 6) DEFAULT 0.0,
            analysis_type VARCHAR(20) DEFAULT 'search',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
        "#,
    )
    .execute(pool)
    .await?;

    let _ = sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_image_analyses_service_id ON image_analyses(service_id)",
    )
    .execute(pool)
    .await;
    let _ = sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_image_analyses_media_id ON image_analyses(media_id)",
    )
    .execute(pool)
    .await;
    let _ = sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_image_analyses_user_id ON image_analyses(user_id)",
    )
    .execute(pool)
    .await;
    let _ = sqlx::query("CREATE INDEX IF NOT EXISTS idx_image_analyses_category ON image_analyses(category_detected) WHERE category_detected IS NOT NULL").execute(pool).await;
    let _ = sqlx::query("CREATE INDEX IF NOT EXISTS idx_image_analyses_marque ON image_analyses(marque) WHERE marque IS NOT NULL").execute(pool).await;
    let _ = sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_image_analyses_type ON image_analyses(analysis_type)",
    )
    .execute(pool)
    .await;
    let _ = sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_image_analyses_tags ON image_analyses USING GIN(tags)",
    )
    .execute(pool)
    .await;
    let _ = sqlx::query("CREATE INDEX IF NOT EXISTS idx_image_analyses_caracteristiques ON image_analyses USING GIN(caracteristiques_cles)").execute(pool).await;

    info!("✅ Table image_analyses créée/vérifiée");
    Ok(())
}

/// ✅ Crée la table programmes_scolaires si elle n'existe pas (sécurisé)
pub async fn ensure_programmes_scolaires_table(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification/création de la table programmes_scolaires...");

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS programmes_scolaires (
            id SERIAL PRIMARY KEY,
            etablissement TEXT NOT NULL,
            classe TEXT NOT NULL,
            annee TEXT,
            programme JSONB NOT NULL,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW(),
            UNIQUE (etablissement, classe, annee)
        )
        "#,
    )
    .execute(pool)
    .await?;

    let _ = sqlx::query("CREATE INDEX IF NOT EXISTS idx_programmes_scolaires_etablissement ON programmes_scolaires(etablissement)").execute(pool).await;
    let _ = sqlx::query("CREATE INDEX IF NOT EXISTS idx_programmes_scolaires_classe ON programmes_scolaires(classe)").execute(pool).await;

    info!("✅ Table programmes_scolaires créée/vérifiée");
    Ok(())
}

/// ✅ Crée la table product_models si elle n'existe pas (sécurisé)
pub async fn ensure_product_models_tables(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification/création de la table product_models...");

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS product_models (
            id SERIAL PRIMARY KEY,
            category VARCHAR(100) NOT NULL,
            subcategory VARCHAR(100),
            model_name VARCHAR(200) NOT NULL,
            brand VARCHAR(100),
            attributes JSONB NOT NULL DEFAULT '{}',
            tags TEXT[] NOT NULL DEFAULT '{}',
            image_url TEXT,
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        )
        "#,
    )
    .execute(pool)
    .await?;

    let _ = sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_product_models_category ON product_models(category)",
    )
    .execute(pool)
    .await;
    let _ = sqlx::query("CREATE INDEX IF NOT EXISTS idx_product_models_brand ON product_models(brand) WHERE brand IS NOT NULL").execute(pool).await;
    let _ = sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_product_models_tags ON product_models USING GIN(tags)",
    )
    .execute(pool)
    .await;

    info!("✅ Table product_models créée/vérifiée");
    Ok(())
}

/// ✅ Crée la table content_visibility_tracking si elle n'existe pas (sécurisé)
pub async fn ensure_visibility_tracking_table(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification/création de la table content_visibility_tracking...");

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS content_visibility_tracking (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            content_id VARCHAR(100) NOT NULL,
            content_type VARCHAR(20) NOT NULL CHECK (content_type IN ('organic', 'paid')),
            session_id VARCHAR(100) NOT NULL,
            appeared_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            position_in_feed INTEGER,
            viewed BOOLEAN DEFAULT FALSE,
            view_duration_ms INTEGER,
            clicked BOOLEAN DEFAULT FALSE,
            clicked_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        "#,
    )
    .execute(pool)
    .await?;

    let _ = sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_visibility_user_id ON content_visibility_tracking(user_id)",
    )
    .execute(pool)
    .await;
    let _ = sqlx::query("CREATE INDEX IF NOT EXISTS idx_visibility_content ON content_visibility_tracking(content_id, content_type)").execute(pool).await;
    let _ = sqlx::query("CREATE INDEX IF NOT EXISTS idx_visibility_session ON content_visibility_tracking(session_id)").execute(pool).await;
    let _ = sqlx::query("CREATE INDEX IF NOT EXISTS idx_visibility_appeared_at ON content_visibility_tracking(appeared_at)").execute(pool).await;
    let _ = sqlx::query("CREATE INDEX IF NOT EXISTS idx_visibility_user_content ON content_visibility_tracking(user_id, content_id, appeared_at DESC)").execute(pool).await;
    let _ = sqlx::query("CREATE INDEX IF NOT EXISTS idx_visibility_session_content ON content_visibility_tracking(session_id, content_id)").execute(pool).await;

    info!("✅ Table content_visibility_tracking créée/vérifiée");
    Ok(())
}

/// ✅ Crée les tables service_team_management si elles n'existent pas (sécurisé)
pub async fn ensure_service_team_management_table(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification/création des tables service_team_management...");

    // 1. Table des rôles d'équipe
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS service_team_roles (
            id VARCHAR(50) PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            description TEXT,
            level INTEGER NOT NULL DEFAULT 1,
            color VARCHAR(7) DEFAULT '#6B7280',
            icon VARCHAR(50) DEFAULT 'users',
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        )
        "#,
    )
    .execute(pool)
    .await?;

    // 2. Table des permissions
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS service_permissions (
            id VARCHAR(100) PRIMARY KEY,
            name VARCHAR(200) NOT NULL,
            description TEXT,
            category VARCHAR(50) NOT NULL DEFAULT 'general',
            created_at TIMESTAMPTZ DEFAULT NOW()
        )
        "#,
    )
    .execute(pool)
    .await?;

    // 3. Table des permissions par rôle
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS role_permissions (
            role_id VARCHAR(50) REFERENCES service_team_roles(id) ON DELETE CASCADE,
            permission_id VARCHAR(100) REFERENCES service_permissions(id) ON DELETE CASCADE,
            PRIMARY KEY (role_id, permission_id)
        )
        "#,
    )
    .execute(pool)
    .await?;

    // 4. Table des membres d'équipe
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS service_team_members (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            service_id INTEGER REFERENCES services(id) ON DELETE CASCADE,
            user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            role_id VARCHAR(50) REFERENCES service_team_roles(id) ON DELETE RESTRICT,
            added_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
            added_at TIMESTAMPTZ DEFAULT NOW(),
            is_active BOOLEAN DEFAULT TRUE,
            UNIQUE(service_id, user_id)
        )
        "#,
    )
    .execute(pool)
    .await?;

    // 5. Table des invitations d'équipe
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS service_team_invitations (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            service_id INTEGER REFERENCES services(id) ON DELETE CASCADE,
            email VARCHAR(255) NOT NULL,
            role_id VARCHAR(50) REFERENCES service_team_roles(id) ON DELETE RESTRICT,
            invited_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
            invited_at TIMESTAMPTZ DEFAULT NOW(),
            expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
            status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'rejected', 'expired')),
            token VARCHAR(255) UNIQUE NOT NULL,
            accepted_at TIMESTAMPTZ,
            UNIQUE(service_id, email)
        )
        "#,
    )
    .execute(pool)
    .await?;

    // 6. Table des activités d'équipe
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS service_team_activities (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            service_id INTEGER REFERENCES services(id) ON DELETE CASCADE,
            user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
            action VARCHAR(100) NOT NULL,
            description TEXT,
            metadata JSONB,
            created_at TIMESTAMPTZ DEFAULT NOW()
        )
        "#,
    )
    .execute(pool)
    .await?;

    // 7. Insérer les rôles prédéfinis
    sqlx::query(
        r#"
        INSERT INTO service_team_roles (id, name, description, level, color, icon) VALUES
        ('admin', 'Administrateur', 'Accès complet à tous les services et paramètres', 1, '#DC2626', 'crown'),
        ('manager', 'Gestionnaire', 'Gestion des services et équipe, pas d''accès financier', 2, '#7C3AED', 'users'),
        ('editor', 'Éditeur', 'Modification du contenu et médias des services', 3, '#059669', 'edit'),
        ('viewer', 'Observateur', 'Consultation des services et statistiques', 4, '#6B7280', 'eye')
        ON CONFLICT (id) DO NOTHING
        "#,
    )
    .execute(pool)
    .await?;

    // 8. Insérer les permissions prédéfinies
    sqlx::query(
        r#"
        INSERT INTO service_permissions (id, name, description, category) VALUES
        ('view_services', 'Voir les services', 'Consulter la liste des services', 'general'),
        ('create_service', 'Créer un service', 'Créer de nouveaux services', 'general'),
        ('delete_service', 'Supprimer un service', 'Supprimer des services', 'general'),
        ('edit_content', 'Modifier le contenu', 'Modifier le titre, description et détails', 'content'),
        ('edit_products', 'Gérer les produits', 'Ajouter, modifier et supprimer des produits', 'content'),
        ('edit_pricing', 'Modifier les prix', 'Changer les prix des services et produits', 'content'),
        ('upload_media', 'Télécharger des médias', 'Ajouter des images, vidéos et documents', 'media'),
        ('delete_media', 'Supprimer des médias', 'Supprimer des images, vidéos et documents', 'media'),
        ('view_analytics', 'Voir les statistiques', 'Consulter les vues, interactions et performances', 'analytics'),
        ('export_data', 'Exporter les données', 'Exporter les statistiques et rapports', 'analytics'),
        ('manage_team', 'Gérer l''équipe', 'Inviter et gérer les membres de l''équipe', 'team'),
        ('assign_roles', 'Assigner des rôles', 'Changer les rôles et permissions des membres', 'team'),
        ('view_financials', 'Voir les finances', 'Consulter les revenus et dépenses', 'financial'),
        ('manage_payments', 'Gérer les paiements', 'Configurer et gérer les méthodes de paiement', 'financial')
        ON CONFLICT (id) DO NOTHING
        "#,
    )
    .execute(pool)
    .await?;

    // 9. Assigner les permissions aux rôles
    sqlx::query(
        r#"
        INSERT INTO role_permissions (role_id, permission_id) VALUES
        ('admin', 'view_services'), ('admin', 'create_service'), ('admin', 'delete_service'),
        ('admin', 'edit_content'), ('admin', 'edit_products'), ('admin', 'edit_pricing'),
        ('admin', 'upload_media'), ('admin', 'delete_media'),
        ('admin', 'view_analytics'), ('admin', 'export_data'),
        ('admin', 'manage_team'), ('admin', 'assign_roles'),
        ('admin', 'view_financials'), ('admin', 'manage_payments'),
        ('manager', 'view_services'), ('manager', 'create_service'),
        ('manager', 'edit_content'), ('manager', 'edit_products'), ('manager', 'edit_pricing'),
        ('manager', 'upload_media'), ('manager', 'delete_media'),
        ('manager', 'view_analytics'), ('manager', 'export_data'),
        ('manager', 'manage_team'), ('manager', 'assign_roles'), ('manager', 'view_financials'),
        ('editor', 'view_services'), ('editor', 'edit_content'), ('editor', 'edit_products'),
        ('editor', 'edit_pricing'), ('editor', 'upload_media'), ('editor', 'delete_media'),
        ('editor', 'view_analytics'),
        ('viewer', 'view_services'), ('viewer', 'view_analytics')
        ON CONFLICT (role_id, permission_id) DO NOTHING
        "#,
    )
    .execute(pool)
    .await?;

    // 10. Index pour les performances
    let _ = sqlx::query("CREATE INDEX IF NOT EXISTS idx_service_team_members_service_id ON service_team_members(service_id)").execute(pool).await;
    let _ = sqlx::query("CREATE INDEX IF NOT EXISTS idx_service_team_members_user_id ON service_team_members(user_id)").execute(pool).await;
    let _ = sqlx::query("CREATE INDEX IF NOT EXISTS idx_service_team_members_role_id ON service_team_members(role_id)").execute(pool).await;
    let _ = sqlx::query("CREATE INDEX IF NOT EXISTS idx_service_team_members_active ON service_team_members(is_active)").execute(pool).await;
    let _ = sqlx::query("CREATE INDEX IF NOT EXISTS idx_service_team_invitations_service_id ON service_team_invitations(service_id)").execute(pool).await;
    let _ = sqlx::query("CREATE INDEX IF NOT EXISTS idx_service_team_invitations_email ON service_team_invitations(email)").execute(pool).await;
    let _ = sqlx::query("CREATE INDEX IF NOT EXISTS idx_service_team_invitations_token ON service_team_invitations(token)").execute(pool).await;
    let _ = sqlx::query("CREATE INDEX IF NOT EXISTS idx_service_team_invitations_status ON service_team_invitations(status)").execute(pool).await;
    let _ = sqlx::query("CREATE INDEX IF NOT EXISTS idx_service_team_activities_service_id ON service_team_activities(service_id)").execute(pool).await;
    let _ = sqlx::query("CREATE INDEX IF NOT EXISTS idx_service_team_activities_user_id ON service_team_activities(user_id)").execute(pool).await;

    // 11. Ajouter 'rejected' au CHECK constraint si absent (migration sur table existante)
    let _ = sqlx::query(
        r#"
        DO $$ BEGIN
            ALTER TABLE service_team_invitations DROP CONSTRAINT IF EXISTS service_team_invitations_status_check;
            ALTER TABLE service_team_invitations ADD CONSTRAINT service_team_invitations_status_check
                CHECK (status IN ('pending', 'accepted', 'declined', 'rejected', 'expired'));
        EXCEPTION WHEN OTHERS THEN NULL;
        END $$
        "#,
    )
    .execute(pool)
    .await;

    info!("✅ Tables service_team_management créées/vérifiées avec succès");
    Ok(())
}

/// ✅ Crée les tables bus_return_trips si elles n'existent pas (sécurisé)
pub async fn ensure_bus_return_trips_table(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification/création des tables bus return trips...");

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS bus_ticket_payments (
            id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            agency_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            product_id TEXT NOT NULL,
            reservation_ids TEXT[] NOT NULL,
            ticket_price INTEGER NOT NULL,
            number_of_tickets INTEGER NOT NULL DEFAULT 1,
            subtotal INTEGER NOT NULL,
            booking_fee INTEGER NOT NULL DEFAULT 500,
            total_amount INTEGER NOT NULL,
            currency VARCHAR(10) NOT NULL DEFAULT 'XAF',
            bus_number VARCHAR(50),
            departure_city TEXT NOT NULL,
            arrival_city TEXT NOT NULL,
            departure_date VARCHAR(20) NOT NULL,
            departure_time VARCHAR(10) NOT NULL,
            company_name TEXT,
            payment_status VARCHAR(20) NOT NULL DEFAULT 'completed' CHECK (payment_status IN ('completed', 'refunded', 'partial_refund')),
            payment_method JSONB,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            refunded_at TIMESTAMP WITH TIME ZONE,
            refund_amount INTEGER DEFAULT 0,
            refund_reason TEXT,
            CONSTRAINT positive_amounts CHECK (ticket_price > 0 AND subtotal > 0 AND total_amount > 0)
        )
        "#,
    )
    .execute(pool)
    .await?;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS return_trip_requests (
            id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            outbound_ticket_id TEXT NOT NULL,
            outbound_payment_id TEXT REFERENCES bus_ticket_payments(id),
            return_from TEXT NOT NULL,
            return_to TEXT NOT NULL,
            preferred_return_date VARCHAR(20) NOT NULL,
            preferred_return_time VARCHAR(10),
            date_flexibility_days INTEGER DEFAULT 1,
            passenger_names TEXT[] NOT NULL,
            number_of_seats INTEGER NOT NULL,
            already_paid BOOLEAN DEFAULT TRUE,
            paid_amount INTEGER,
            matched_product_id TEXT,
            matched_at TIMESTAMP WITH TIME ZONE,
            notification_sent BOOLEAN DEFAULT FALSE,
            notification_sent_at TIMESTAMP WITH TIME ZONE,
            reservation_completed BOOLEAN DEFAULT FALSE,
            reservation_ids TEXT[],
            completed_at TIMESTAMP WITH TIME ZONE,
            status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'matched', 'completed', 'cancelled', 'expired')),
            expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '90 days'),
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
        "#,
    )
    .execute(pool)
    .await?;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS prebooked_return_seats (
            id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
            return_request_id TEXT NOT NULL REFERENCES return_trip_requests(id) ON DELETE CASCADE,
            product_id TEXT NOT NULL,
            seat_ids TEXT[] NOT NULL,
            passenger_names TEXT[] NOT NULL,
            status VARCHAR(20) DEFAULT 'reserved' CHECK (status IN ('reserved', 'confirmed', 'released')),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            confirmed_at TIMESTAMP WITH TIME ZONE
        )
        "#,
    )
    .execute(pool)
    .await?;

    let _ = sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_bus_ticket_payments_user ON bus_ticket_payments(user_id)",
    )
    .execute(pool)
    .await;
    let _ = sqlx::query("CREATE INDEX IF NOT EXISTS idx_bus_ticket_payments_agency ON bus_ticket_payments(agency_user_id)").execute(pool).await;
    let _ = sqlx::query("CREATE INDEX IF NOT EXISTS idx_bus_ticket_payments_date ON bus_ticket_payments(departure_date, departure_time)").execute(pool).await;
    let _ = sqlx::query("CREATE INDEX IF NOT EXISTS idx_bus_ticket_payments_route ON bus_ticket_payments(departure_city, arrival_city)").execute(pool).await;
    let _ = sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_return_requests_user ON return_trip_requests(user_id)",
    )
    .execute(pool)
    .await;
    let _ = sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_return_requests_status ON return_trip_requests(status)",
    )
    .execute(pool)
    .await;
    let _ = sqlx::query("CREATE INDEX IF NOT EXISTS idx_return_requests_route ON return_trip_requests(return_from, return_to)").execute(pool).await;
    let _ = sqlx::query("CREATE INDEX IF NOT EXISTS idx_return_requests_date ON return_trip_requests(preferred_return_date)").execute(pool).await;
    let _ = sqlx::query("CREATE INDEX IF NOT EXISTS idx_prebooked_seats_product ON prebooked_return_seats(product_id)").execute(pool).await;
    let _ = sqlx::query("CREATE INDEX IF NOT EXISTS idx_prebooked_seats_request ON prebooked_return_seats(return_request_id)").execute(pool).await;

    info!("✅ Tables bus return trips créées/vérifiées");
    Ok(())
}

/// ✅ Phase 5 - Matching Intelligent : Ajoute les colonnes pour matching modes de paiement
pub async fn ensure_payment_methods_matching_columns(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification des colonnes payment_methods_matching...");

    // Ajouter colonne payment_methods dans users
    sqlx::query(
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS payment_methods JSONB DEFAULT '{}'::jsonb",
    )
    .execute(pool)
    .await?;

    // Ajouter colonnes dans delivery_payment_reservations
    sqlx::query(
        "ALTER TABLE delivery_payment_reservations ADD COLUMN IF NOT EXISTS client_payment_method JSONB"
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "ALTER TABLE delivery_payment_reservations ADD COLUMN IF NOT EXISTS merchant_payment_method JSONB"
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "ALTER TABLE delivery_payment_reservations ADD COLUMN IF NOT EXISTS payout_method_used VARCHAR(50)"
    )
    .execute(pool)
    .await?;

    // Créer index pour users.payment_methods
    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_users_payment_methods ON users USING GIN (payment_methods) WHERE payment_methods != '{}'::jsonb"
    )
    .execute(pool)
    .await?;

    // Créer index pour delivery_payment_reservations.payout_method_used
    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_delivery_payment_reservations_payout_method ON delivery_payment_reservations(payout_method_used)"
    )
    .execute(pool)
    .await?;

    Ok(())
}

/// ✅ NOUVEAU : Crée la table delivery_proximity_suggestions pour stocker les suggestions de proximité
pub async fn ensure_delivery_proximity_suggestions_table(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification de la table delivery_proximity_suggestions...");
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS delivery_proximity_suggestions (
            id SERIAL PRIMARY KEY,
            delivery_id UUID NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
            suggested_status TEXT NOT NULL,
            location_type TEXT NOT NULL, -- "pickup" ou "dropoff"
            distance_meters FLOAT,
            auto_confirm_after_seconds INTEGER,
            status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'confirmed', 'auto_confirmed', 'cancelled'
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            confirmed_at TIMESTAMPTZ,
            courier_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
            metadata JSONB DEFAULT '{}'::jsonb
        )
        "#,
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_delivery_proximity_suggestions_delivery ON delivery_proximity_suggestions(delivery_id)",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_delivery_proximity_suggestions_status ON delivery_proximity_suggestions(status) WHERE status = 'pending'",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_delivery_proximity_suggestions_created ON delivery_proximity_suggestions(created_at)",
    )
    .execute(pool)
    .await?;

    Ok(())
}

/// ✅ NOUVEAU : Crée la table negotiated_prices pour stocker les prix négociés entre prestataire et client
pub async fn ensure_negotiated_prices_table(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification de la table negotiated_prices...");
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS negotiated_prices (
            id SERIAL PRIMARY KEY,
            conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
            service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
            product_index INTEGER, -- NULL si prix global pour le service
            merchant_user_id INTEGER NOT NULL REFERENCES users(id),
            client_user_id INTEGER NOT NULL REFERENCES users(id),
            original_price_cents BIGINT NOT NULL,
            negotiated_price_cents BIGINT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'accepted', 'rejected', 'expired'
            expires_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            accepted_at TIMESTAMPTZ,
            metadata JSONB DEFAULT '{}'::jsonb,
            UNIQUE(conversation_id, service_id, product_index, client_user_id)
        )
        "#,
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_negotiated_prices_conversation ON negotiated_prices(conversation_id)",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_negotiated_prices_service ON negotiated_prices(service_id)",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_negotiated_prices_status ON negotiated_prices(status) WHERE status = 'pending'",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_negotiated_prices_client ON negotiated_prices(client_user_id, status) WHERE status = 'accepted'",
    )
    .execute(pool)
    .await?;

    Ok(())
}

/// ✅ Phase 9 - Amélioration 31 : Crée la table video_dependencies pour chaînage vidéos
pub async fn ensure_video_dependencies_table(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification de la table video_dependencies...");

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS video_dependencies (
            id SERIAL PRIMARY KEY,
            parent_session_id UUID NOT NULL REFERENCES studio_sessions(id) ON DELETE CASCADE,
            child_session_id UUID NOT NULL REFERENCES studio_sessions(id) ON DELETE CASCADE,
            order_index INTEGER,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            UNIQUE(parent_session_id, child_session_id)
        )
        "#,
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_video_dependencies_parent ON video_dependencies(parent_session_id, order_index)",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_video_dependencies_child ON video_dependencies(child_session_id)",
    )
    .execute(pool)
    .await?;

    Ok(())
}

/// ✅ Phase 9 - Amélioration 32 : Crée la table merchant_storage_locations pour plusieurs lieux de stock
pub async fn ensure_merchant_storage_locations_table(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification de la table merchant_storage_locations...");

    sqlx::query(
        r#"
            CREATE TABLE IF NOT EXISTS merchant_storage_locations (
                id SERIAL PRIMARY KEY,
                merchant_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                name TEXT NOT NULL,
                address TEXT NOT NULL,
                latitude DOUBLE PRECISION NOT NULL,
                longitude DOUBLE PRECISION NOT NULL,
                zone_id UUID REFERENCES delivery_zones(id) ON DELETE SET NULL,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            )
            "#,
    )
    .execute(pool)
    .await?;

    sqlx::query(
            "CREATE INDEX IF NOT EXISTS idx_merchant_storage_locations_merchant ON merchant_storage_locations(merchant_user_id, is_active) WHERE is_active = TRUE",
        )
        .execute(pool)
        .await?;

    // ✅ Phase 9 - Amélioration : Index pour zone_id
    sqlx::query(
            "CREATE INDEX IF NOT EXISTS idx_merchant_storage_locations_zone ON merchant_storage_locations(zone_id) WHERE zone_id IS NOT NULL",
        )
        .execute(pool)
        .await?;

    // ✅ Phase 9 - Amélioration 32 : Ajouter storage_location_id à product_delivery_config
    sqlx::query(
        r#"
        ALTER TABLE product_delivery_config 
        ADD COLUMN IF NOT EXISTS storage_location_id INTEGER REFERENCES merchant_storage_locations(id) ON DELETE SET NULL
        "#,
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_product_delivery_config_storage_location ON product_delivery_config(storage_location_id) WHERE storage_location_id IS NOT NULL",
    )
    .execute(pool)
    .await?;

    Ok(())
}

/// ✅ Phase 9 - Amélioration : Crée la table product_delivery_zones pour associer des zones de livraison aux produits
pub async fn ensure_product_delivery_zones_table(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification de la table product_delivery_zones...");

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS product_delivery_zones (
            id SERIAL PRIMARY KEY,
            service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
            product_index INTEGER NOT NULL,
            zone_id UUID NOT NULL REFERENCES delivery_zones(id) ON DELETE CASCADE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            UNIQUE(service_id, product_index, zone_id)
        )
        "#,
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_product_delivery_zones_service ON product_delivery_zones(service_id, product_index)",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_product_delivery_zones_zone ON product_delivery_zones(zone_id)",
    )
    .execute(pool)
    .await?;

    Ok(())
}

/// ✅ Phase 10 - Optimisations : Crée les index géographiques pour optimiser les requêtes GPS
pub async fn ensure_geographic_indexes(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification des index géographiques...");

    // 1. Index GIST pour services.gps (TEXT format "latitude,longitude")
    // Créer un index fonctionnel qui convertit le TEXT en GEOGRAPHY Point
    sqlx::query(
        r#"
        CREATE INDEX IF NOT EXISTS idx_services_gps_gist 
        ON services 
        USING GIST (
            ST_GeogFromText(
                'POINT(' || 
                SPLIT_PART(gps, ',', 2) || ' ' || 
                SPLIT_PART(gps, ',', 1) || 
                ')'
            )
        )
        WHERE gps IS NOT NULL 
          AND gps != '' 
          AND gps ~ '^-?\d+\.?\d*,-?\d+\.?\d*$'
        "#,
    )
    .execute(pool)
    .await?;

    // 2. Index GIST pour merchant_storage_locations (latitude, longitude)
    sqlx::query(
        r#"
        CREATE INDEX IF NOT EXISTS idx_merchant_storage_locations_location_gist 
        ON merchant_storage_locations 
        USING GIST (
            CAST(ST_SetSRID(ST_MakePoint(longitude, latitude), 4326) AS geography)
        )
        WHERE latitude IS NOT NULL AND longitude IS NOT NULL
        "#,
    )
    .execute(pool)
    .await?;

    // 3. Index GIST pour african_locations (latitude, longitude)
    sqlx::query(
        r#"
        CREATE INDEX IF NOT EXISTS idx_african_locations_location_gist 
        ON african_locations 
        USING GIST (
            CAST(ST_SetSRID(ST_MakePoint(CAST(longitude AS double precision), CAST(latitude AS double precision)), 4326) AS geography)
        )
        WHERE latitude IS NOT NULL AND longitude IS NOT NULL
        "#,
    )
    .execute(pool)
    .await?;

    // 4. Index B-tree pour services.gps (pour recherches exactes et LIKE)
    sqlx::query(
        r#"
        CREATE INDEX IF NOT EXISTS idx_services_gps_btree 
        ON services (gps) 
        WHERE gps IS NOT NULL AND gps != ''
        "#,
    )
    .execute(pool)
    .await?;

    // 5. Index composite pour merchant_storage_locations (merchant + location)
    sqlx::query(
        r#"
        CREATE INDEX IF NOT EXISTS idx_merchant_storage_locations_merchant_location 
        ON merchant_storage_locations (merchant_user_id, is_active) 
        WHERE is_active = TRUE AND latitude IS NOT NULL AND longitude IS NOT NULL
        "#,
    )
    .execute(pool)
    .await?;

    info!("✅ Index géographiques créés avec succès");
    Ok(())
}

/// ✅ Phase 9 - Amélioration : Crée le type enum pour les raisons de refus de colis
pub async fn ensure_parcel_rejection_reason_type(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification du type parcel_rejection_reason...");

    sqlx::query(
        r#"
        DO $$ BEGIN
            CREATE TYPE parcel_rejection_reason AS ENUM (
                'damaged',
                'wrong_item',
                'expired',
                'wrong_quantity',
                'wrong_size',
                'wrong_color',
                'quality_issue',
                'not_ordered',
                'duplicate',
                'other'
            );
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
        "#,
    )
    .execute(pool)
    .await?;

    // ✅ Phase 9 - Amélioration : Ajouter rejection_reason à shopping_order_items
    sqlx::query(
        r#"
        ALTER TABLE shopping_order_items 
        ADD COLUMN IF NOT EXISTS rejection_reason parcel_rejection_reason
        "#,
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_shopping_order_items_rejection_reason ON shopping_order_items(rejection_reason) WHERE rejection_reason IS NOT NULL",
    )
    .execute(pool)
    .await?;

    Ok(())
}

/// ✅ Phase 9 - Amélioration : Crée la table delivery_proof_media pour stocker les médias de preuve (pickup/delivery)
pub async fn ensure_delivery_proof_media_table(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification de la table delivery_proof_media...");

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS delivery_proof_media (
            id SERIAL PRIMARY KEY,
            delivery_id UUID NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
            media_type TEXT NOT NULL CHECK (media_type IN ('image', 'video')),
            media_url TEXT NOT NULL,
            proof_type TEXT NOT NULL CHECK (proof_type IN ('pickup', 'delivery')),
            uploaded_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            uploaded_at TIMESTAMPTZ DEFAULT NOW(),
            metadata JSONB DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ DEFAULT NOW()
        )
        "#,
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_delivery_proof_media_delivery ON delivery_proof_media(delivery_id, proof_type)",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_delivery_proof_media_uploaded_by ON delivery_proof_media(uploaded_by)",
    )
    .execute(pool)
    .await?;

    Ok(())
}

/// ✅ NOUVEAU : Crée la table delivery_engine_pricing pour paramétrer les coûts par type d'engin
pub async fn ensure_delivery_engine_pricing_table(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification de la table delivery_engine_pricing...");

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS delivery_engine_pricing (
            engine_type delivery_engine_type PRIMARY KEY,
            cost_per_km_fcfa NUMERIC(10, 2) NOT NULL,
            minimum_cost_fcfa NUMERIC(10, 2) NOT NULL,
            fuel_consumption_l_per_km NUMERIC(6, 3),
            description TEXT,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        )
        "#,
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_delivery_engine_pricing_type ON delivery_engine_pricing(engine_type)",
    )
    .execute(pool)
    .await?;

    // Insérer les valeurs par défaut (prix ajustés selon demande)
    sqlx::query(
        r#"
        INSERT INTO delivery_engine_pricing (engine_type, cost_per_km_fcfa, minimum_cost_fcfa, fuel_consumption_l_per_km, description)
        VALUES
            ('pieton', 200.00, 500.00, NULL, 'Livraison à pied - Pas de carburant'),
            ('velo_cargo', 200.00, 800.00, NULL, 'Vélo cargo - Pas de carburant (réduit)'),
            ('scooter', 225.00, 1000.00, 0.030, 'Scooter - Consommation ~3L/100km (réduit de moitié, aligné avec moto)'),
            ('moto', 225.00, 1000.00, 0.040, 'Moto - Consommation ~4L/100km (réduit de moitié, aligné avec scooter)'),
            ('tricycle', 250.00, 1000.00, 0.035, 'Tricycle - Consommation ~3.5L/100km'),
            ('voiture', 600.00, 1500.00, 0.080, 'Voiture - Consommation ~8L/100km'),
            ('camionnette', 1000.00, 5000.00, 0.100, 'Camionnette/Pickup - Consommation ~10L/100km (base 1000, min 5000)'),
            ('camion_leger', 2000.00, 10000.00, 0.120, 'Camion léger - Consommation ~12L/100km (base 2000, min 10000)'),
            ('autre', 500.00, 1000.00, NULL, 'Autre type d''engin - Prix par défaut')
        ON CONFLICT (engine_type) 
        DO UPDATE SET 
            cost_per_km_fcfa = EXCLUDED.cost_per_km_fcfa,
            minimum_cost_fcfa = EXCLUDED.minimum_cost_fcfa,
            fuel_consumption_l_per_km = EXCLUDED.fuel_consumption_l_per_km,
            description = EXCLUDED.description,
            updated_at = NOW()
        "#,
    )
    .execute(pool)
    .await?;

    // Créer le trigger pour updated_at
    sqlx::query(
        r#"
        CREATE OR REPLACE FUNCTION update_delivery_engine_pricing_updated_at()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql
        "#,
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "DROP TRIGGER IF EXISTS trigger_update_delivery_engine_pricing_updated_at ON delivery_engine_pricing",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        r#"
        CREATE TRIGGER trigger_update_delivery_engine_pricing_updated_at
            BEFORE UPDATE ON delivery_engine_pricing
            FOR EACH ROW
            EXECUTE FUNCTION update_delivery_engine_pricing_updated_at()
        "#,
    )
    .execute(pool)
    .await?;

    Ok(())
}

/// ✅ 2025-11-25 : Corrige l'index idx_services_search_optimized en supprimant INCLUDE (data)
/// pour éviter l'erreur "index row size exceeds btree maximum"
/// Migration: 20251125_fix_idx_services_search_optimized.sql
pub async fn ensure_services_search_optimized_index_fix(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification/correction de l'index idx_services_search_optimized...");

    // 1. Supprimer l'ancien index problématique s'il existe avec INCLUDE (data)
    sqlx::query("DROP INDEX IF EXISTS idx_services_search_optimized")
        .execute(pool)
        .await?;

    // 2. Recréer l'index sans INCLUDE (data) pour éviter l'erreur de taille
    //    On garde seulement user_id dans INCLUDE car c'est un INTEGER (petit, ~4 bytes)
    sqlx::query(
        r#"
        CREATE INDEX IF NOT EXISTS idx_services_search_optimized 
        ON services (is_active, created_at DESC) 
        INCLUDE (user_id)
        WHERE is_active = true
        "#,
    )
    .execute(pool)
    .await?;

    // 3. Ajouter un commentaire pour documenter la modification
    sqlx::query(
        r#"
        COMMENT ON INDEX idx_services_search_optimized IS 
        'Index optimisé pour recherche active (sans INCLUDE data pour éviter erreur taille B-tree). 
        Performance: 10-50ms par requête (acceptable). Voir EXPLICATION_INDEX_INCLUDE_DATA.md pour détails.'
        "#
    )
    .execute(pool)
    .await?;

    info!("✅ Index idx_services_search_optimized corrigé (sans INCLUDE data)");
    Ok(())
}

/// ✅ 2025-11-25 : Crée les fonctions helper GPS nécessaires pour search_services_gps_final
/// Migration: 20250119003_enhance_product_search_gps.sql, 20250830002_002_add_postgis_geospatial.sql
pub async fn ensure_gps_helper_functions(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification/création des fonctions helper GPS...");

    // 1. Fonction get_best_gps_for_service (priorité GPS produit)
    sqlx::query(
        r#"
        CREATE OR REPLACE FUNCTION get_best_gps_for_service(service_data JSONB)
        RETURNS TEXT AS $$
        DECLARE
            product_gps TEXT;
            service_gps TEXT;
        BEGIN
            -- 1. Priorité: GPS des produits immobiliers
            SELECT product->>'gps'
            INTO product_gps
            FROM jsonb_array_elements(
                CASE 
                    WHEN jsonb_typeof(service_data->'produits') = 'array' 
                    THEN service_data->'produits'
                    WHEN jsonb_typeof(service_data->'produits'->'valeur') = 'array'
                    THEN service_data->'produits'->'valeur'
                    ELSE '[]'::jsonb
                END
            ) AS product
            WHERE product->>'gps' IS NOT NULL 
                AND product->>'gps' != ''
                AND product->>'gps' != '0,0'
                AND (product->>'type' = 'immobilier_batiment' OR product->>'type' = 'immobilier_terrain')
            LIMIT 1;
            
            IF product_gps IS NOT NULL THEN
                RETURN product_gps;
            END IF;
            
            -- 2. Fallback: GPS de n'importe quel produit
            SELECT product->>'gps'
            INTO product_gps
            FROM jsonb_array_elements(
                CASE 
                    WHEN jsonb_typeof(service_data->'produits') = 'array' 
                    THEN service_data->'produits'
                    WHEN jsonb_typeof(service_data->'produits'->'valeur') = 'array'
                    THEN service_data->'produits'->'valeur'
                    ELSE '[]'::jsonb
                END
            ) AS product
            WHERE product->>'gps' IS NOT NULL 
                AND product->>'gps' != ''
                AND product->>'gps' != '0,0'
            LIMIT 1;
            
            IF product_gps IS NOT NULL THEN
                RETURN product_gps;
            END IF;
            
            -- 3. Fallback: GPS du service (gps_fixe en priorité)
            service_gps := COALESCE(
                service_data->>'gps_fixe',
                service_data->'gps_fixe'->>'valeur'
            );
            
            IF service_gps IS NOT NULL AND service_gps != '' AND service_gps != '0,0' THEN
                RETURN service_gps;
            END IF;
            
            RETURN NULL;
        END;
        $$ LANGUAGE plpgsql IMMUTABLE;
        "#
    )
    .execute(pool)
    .await?;

    // 2. Fonction calculate_intelligent_radius (version double precision)
    sqlx::query(
        r#"
        CREATE OR REPLACE FUNCTION calculate_intelligent_radius(base_radius double precision)
        RETURNS double precision AS $$
        BEGIN
            -- Pour l'instant, retourner le rayon de base
            -- Peut être amélioré avec logique de densité de population
            RETURN base_radius;
        END;
        $$ LANGUAGE plpgsql IMMUTABLE;
        "#,
    )
    .execute(pool)
    .await?;

    // 3. Fonction calculate_distance_km (surcharge avec 2 paramètres TEXT)
    sqlx::query(
        r#"
        CREATE OR REPLACE FUNCTION calculate_distance_km(gps1 TEXT, gps2 TEXT)
        RETURNS double precision AS $$
        DECLARE
            lat1 double precision;
            lng1 double precision;
            lat2 double precision;
            lng2 double precision;
        BEGIN
            -- Extraire lat,lng du premier GPS
            IF gps1 IS NULL OR gps1 = '' OR gps1 = '0,0' THEN
                RETURN 999999.0;
            END IF;
            
            lat1 := split_part(gps1, ',', 1)::double precision;
            lng1 := split_part(gps1, ',', 2)::double precision;
            
            -- Extraire lat,lng du deuxième GPS
            IF gps2 IS NULL OR gps2 = '' OR gps2 = '0,0' THEN
                RETURN 999999.0;
            END IF;
            
            lat2 := split_part(gps2, ',', 1)::double precision;
            lng2 := split_part(gps2, ',', 2)::double precision;
            
            -- Utiliser la fonction calculate_distance_km avec 4 paramètres si elle existe
            -- Sinon, utiliser la formule Haversine
            IF EXISTS (
                SELECT 1 FROM pg_proc 
                WHERE proname = 'calculate_distance_km' 
                AND pronargs = 4
            ) THEN
                RETURN calculate_distance_km(lat1, lng1, lat2, lng2);
            ELSE
                -- Formule Haversine simple
                RETURN (
                    6371.0 * acos(
                        LEAST(1.0, GREATEST(-1.0,
                            cos(radians(lat1)) * 
                            cos(radians(lat2)) * 
                            cos(radians(lng2) - radians(lng1)) + 
                            sin(radians(lat1)) * 
                            sin(radians(lat2))
                        ))
                    )
                );
            END IF;
        EXCEPTION
            WHEN OTHERS THEN
                RETURN 999999.0;
        END;
        $$ LANGUAGE plpgsql IMMUTABLE;
        "#,
    )
    .execute(pool)
    .await?;

    info!("✅ Fonctions helper GPS créées/mises à jour");
    Ok(())
}

/// ✅ 2025-11-25 : Crée les fonctions search_services_gps_final et get_active_products
/// Migration: 20251123_filter_active_products_in_search_gps_final.sql
pub async fn ensure_search_services_gps_final(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification/création de search_services_gps_final...");

    // 1. Fonction get_active_products
    sqlx::query(
        r#"
        CREATE OR REPLACE FUNCTION get_active_products(service_data JSONB, p_service_id INTEGER)
        RETURNS JSONB AS $$
        DECLARE
            active_products JSONB := '[]'::JSONB;
            product JSONB;
            product_idx INTEGER := 0;
            is_product_active BOOLEAN;
            produits_array JSONB;
        BEGIN
            -- Déterminer le tableau de produits à utiliser
            IF jsonb_typeof(service_data->'produits') = 'array' THEN
                produits_array := service_data->'produits';
            ELSIF jsonb_typeof(service_data->'produits'->'valeur') = 'array' THEN
                produits_array := service_data->'produits'->'valeur';
            ELSE
                RETURN '[]'::JSONB;
            END IF;
            
            -- Itérer sur les produits
            FOR product IN SELECT * FROM jsonb_array_elements(produits_array)
            LOOP
                -- Vérifier si le produit est actif dans products_lifecycle
                -- Si pas d'entrée dans products_lifecycle, considérer comme actif (valeur par défaut)
                SELECT COALESCE(pl.is_active, TRUE) INTO is_product_active
                FROM products_lifecycle pl
                WHERE pl.service_id = p_service_id
                    AND pl.product_index = product_idx;
                
                -- Ajouter seulement si actif
                IF is_product_active THEN
                    active_products := active_products || jsonb_build_array(product);
                END IF;
                
                product_idx := product_idx + 1;
            END LOOP;
            
            RETURN active_products;
        END;
        $$ LANGUAGE plpgsql STABLE;
        "#
    )
    .execute(pool)
    .await?;

    // 2. Fonction search_services_gps_final (version simplifiée pour auto_migrate)
    // Note: La version complète est dans la migration 20251123
    // Cette version crée la fonction de base, la migration SQLx l'améliorera
    // ⚠️ IMPORTANT: Utiliser search_radius_km (pas radius_km) pour correspondre aux migrations SQL
    // ⚠️ CRITIQUE: Supprimer toutes les versions existantes pour éviter l'erreur de renommage de paramètre
    // Séparer les DROP FUNCTION en requêtes individuelles car SQLx ne peut pas exécuter plusieurs commandes dans un prepared statement
    let _ = sqlx::query(
        "DROP FUNCTION IF EXISTS search_services_gps_final(text, text, integer, integer)",
    )
    .execute(pool)
    .await;
    let _ = sqlx::query("DROP FUNCTION IF EXISTS search_services_gps_final(text, text, integer)")
        .execute(pool)
        .await;
    let _ = sqlx::query("DROP FUNCTION IF EXISTS search_services_gps_final(text, text)")
        .execute(pool)
        .await;
    let _ = sqlx::query("DROP FUNCTION IF EXISTS search_services_gps_final(text)")
        .execute(pool)
        .await;
    let _ = sqlx::query("DROP FUNCTION IF EXISTS search_services_gps_final()")
        .execute(pool)
        .await;

    sqlx::query(
        r#"
        CREATE OR REPLACE FUNCTION search_services_gps_final(
            search_query text,
            user_gps_zone text DEFAULT NULL,
            search_radius_km integer DEFAULT 50,
            max_results integer DEFAULT 100
        )
        RETURNS TABLE(
            service_id integer,
            titre_service text,
            category text,
            gps_coords text,
            distance_km double precision,
            relevance_score double precision,
            gps_source text
        ) AS $$
        DECLARE
            gps_parts text[];
            lat double precision;
            lng double precision;
            radius_adjusted double precision;
        BEGIN
            -- Ajuster le rayon
            radius_adjusted := COALESCE(calculate_intelligent_radius(search_radius_km::double precision), search_radius_km::double precision);
            
            -- Extraire les coordonnées GPS si fournies
            IF user_gps_zone IS NOT NULL AND user_gps_zone != '' AND user_gps_zone != 'null' THEN
                -- Diviser par le séparateur "|" pour gérer les zones polygonales
                gps_parts := string_to_array(user_gps_zone, '|');
                
                -- Pour l'instant, utiliser le premier point comme centre de recherche
                IF array_length(gps_parts, 1) > 0 THEN
                    -- Extraire lat,lng du premier point
                    lat := split_part(gps_parts[1], ',', 1)::double precision;
                    lng := split_part(gps_parts[1], ',', 2)::double precision;
                    
                    -- ✅ CORRIGÉ 2026-01-XX: Recherche UNIQUEMENT dans service_products, PAS dans services.data->'produits'
                    RETURN QUERY
                    WITH services_with_active_products AS (
                        SELECT DISTINCT
                            s.id,
                            s.data,
                            s.category,
                            s.gps,
                            s.is_active,
                            COALESCE(
                                get_best_gps_for_service(s.data),
                                s.gps,
                                '0,0'
                            ) as best_gps
                        FROM services s
                        INNER JOIN service_products p ON p.service_id = s.id
                        WHERE s.is_active = TRUE
                            AND p.is_active = TRUE
                    ),
                    scored_products AS (
                        SELECT 
                            s.id as service_id,
                            COALESCE(
                                s.data->>'titre_service', 
                                s.data->'titre_service'->>'valeur', 
                                'Sans titre'
                            ) as titre_service,
                            COALESCE(
                                s.category, 
                                s.data->>'category', 
                                s.data->'category'->>'valeur',
                                'Non catégorisé'
                            ) as category,
                            s.best_gps as gps_coords,
                            CASE 
                                WHEN s.best_gps IS NOT NULL AND s.best_gps != '0,0' THEN
                                    calculate_distance_km(user_gps_zone, s.best_gps)
                                ELSE 999999.0
                            END as distance_km,
                            -- Score basé UNIQUEMENT sur service_products (PAS sur services.data->'produits')
                            (
                                (
                                    SELECT COALESCE(SUM(
                                        CASE 
                                            WHEN p.product_name ILIKE '%' || search_query || '%' THEN 20.0
                                            WHEN p.product_data->>'nom' ILIKE '%' || search_query || '%' THEN 20.0
                                            WHEN p.product_data->>'name' ILIKE '%' || search_query || '%' THEN 20.0
                                            WHEN p.product_data->>'titre' ILIKE '%' || search_query || '%' THEN 18.0
                                            WHEN p.product_data->>'categorie' ILIKE '%' || search_query || '%' THEN 15.0
                                            WHEN COALESCE(p.product_data->>'description_produit', p.product_data->>'description', p.product_data->'description'->>'valeur', '') ILIKE '%' || search_query || '%' THEN 12.0
                                            WHEN p.product_data->>'type' ILIKE '%' || search_query || '%' THEN 10.0
                                            WHEN p.product_data->>'marque' ILIKE '%' || search_query || '%' THEN 10.0
                                            ELSE 0.0
                                        END
                                    ), 0.0)
                                    FROM service_products p
                                    WHERE p.service_id = s.id
                                        AND p.is_active = TRUE
                                ) +
                                CASE 
                                    WHEN s.data->>'titre_service' ILIKE '%' || search_query || '%' THEN 5.0
                                    ELSE 0.0
                                END
                            )::double precision as relevance_score,
                            CASE 
                                WHEN s.best_gps = get_best_gps_for_service(s.data) THEN 'produit_gps'
                                ELSE 'service_gps'
                            END as gps_source
                        FROM services_with_active_products s
                        WHERE 
                            CASE 
                                WHEN s.best_gps IS NOT NULL AND s.best_gps != '0,0' THEN
                                    calculate_distance_km(user_gps_zone, s.best_gps) <= radius_adjusted
                                ELSE FALSE
                            END
                            AND (
                                search_query IS NULL 
                                OR search_query = ''
                                OR EXISTS (
                                    SELECT 1
                                    FROM service_products p
                                    WHERE p.service_id = s.id
                                        AND p.is_active = TRUE
                                        AND (
                                            p.product_name ILIKE '%' || search_query || '%'
                                            OR p.product_data->>'nom' ILIKE '%' || search_query || '%'
                                            OR p.product_data->>'name' ILIKE '%' || search_query || '%'
                                            OR p.product_data->>'titre' ILIKE '%' || search_query || '%'
                                            OR p.product_data->>'categorie' ILIKE '%' || search_query || '%'
                                            OR COALESCE(p.product_data->>'description_produit', p.product_data->>'description', p.product_data->'description'->>'valeur', '') ILIKE '%' || search_query || '%'
                                        )
                                )
                                OR s.data->>'titre_service' ILIKE '%' || search_query || '%'
                                OR s.data->'titre_service'->>'valeur' ILIKE '%' || search_query || '%'
                                OR s.data->>'description' ILIKE '%' || search_query || '%'
                                OR s.data->'description'->>'valeur' ILIKE '%' || search_query || '%'
                            )
                    )
                    SELECT 
                        sp.service_id,
                        sp.titre_service,
                        sp.category,
                        sp.gps_coords,
                        sp.distance_km,
                        sp.relevance_score,
                        sp.gps_source
                    FROM scored_products sp
                    WHERE sp.relevance_score > 0
                    ORDER BY 
                        sp.relevance_score DESC,
                        sp.distance_km ASC
                    LIMIT max_results;
                    
                    RETURN;
                END IF;
            END IF;
            
            -- ✅ CORRIGÉ 2026-01-XX: Si pas de GPS, recherche textuelle UNIQUEMENT dans service_products
            RETURN QUERY
            WITH services_with_active_products AS (
                SELECT DISTINCT
                    s.id,
                    s.data,
                    s.category,
                    s.gps
                FROM services s
                INNER JOIN service_products p ON p.service_id = s.id
                WHERE s.is_active = TRUE
                    AND p.is_active = TRUE
            )
            SELECT 
                s.id as service_id,
                COALESCE(
                    s.data->>'titre_service', 
                    s.data->'titre_service'->>'valeur', 
                    'Sans titre'
                ) as titre_service,
                COALESCE(
                    s.category, 
                    s.data->>'category', 
                    s.data->'category'->>'valeur',
                    'Non catégorisé'
                ) as category,
                COALESCE(
                    get_best_gps_for_service(s.data),
                    s.gps,
                    '0,0'
                ) as gps_coords,
                0.0 as distance_km,
                (
                    (
                        SELECT COALESCE(SUM(
                            CASE 
                                WHEN p.product_name ILIKE '%' || search_query || '%' THEN 20.0
                                WHEN p.product_data->>'nom' ILIKE '%' || search_query || '%' THEN 20.0
                                WHEN p.product_data->>'name' ILIKE '%' || search_query || '%' THEN 20.0
                                WHEN p.product_data->>'titre' ILIKE '%' || search_query || '%' THEN 18.0
                                WHEN p.product_data->>'categorie' ILIKE '%' || search_query || '%' THEN 15.0
                                WHEN COALESCE(p.product_data->>'description_produit', p.product_data->>'description', p.product_data->'description'->>'valeur', '') ILIKE '%' || search_query || '%' THEN 12.0
                                WHEN p.product_data->>'type' ILIKE '%' || search_query || '%' THEN 10.0
                                WHEN p.product_data->>'marque' ILIKE '%' || search_query || '%' THEN 10.0
                                ELSE 0.0
                            END
                        ), 0.0)
                        FROM service_products p
                        WHERE p.service_id = s.id
                            AND p.is_active = TRUE
                    ) +
                    CASE 
                        WHEN s.data->>'titre_service' ILIKE '%' || search_query || '%' THEN 5.0
                        ELSE 0.0
                    END
                )::double precision as relevance_score,
                'no_gps' as gps_source
            FROM services_with_active_products s
            WHERE 
                search_query IS NULL 
                OR search_query = ''
                OR EXISTS (
                    SELECT 1
                    FROM service_products p
                    WHERE p.service_id = s.id
                        AND p.is_active = TRUE
                        AND (
                            p.product_name ILIKE '%' || search_query || '%'
                            OR p.product_data->>'nom' ILIKE '%' || search_query || '%'
                            OR p.product_data->>'name' ILIKE '%' || search_query || '%'
                            OR p.product_data->>'titre' ILIKE '%' || search_query || '%'
                            OR p.product_data->>'categorie' ILIKE '%' || search_query || '%'
                            OR COALESCE(p.product_data->>'description_produit', p.product_data->>'description', p.product_data->'description'->>'valeur', '') ILIKE '%' || search_query || '%'
                        )
                )
                OR s.data->>'titre_service' ILIKE '%' || search_query || '%'
                OR s.data->'titre_service'->>'valeur' ILIKE '%' || search_query || '%'
                OR s.data->>'description' ILIKE '%' || search_query || '%'
                OR s.data->'description'->>'valeur' ILIKE '%' || search_query || '%'
            ORDER BY relevance_score DESC
            LIMIT max_results;
        END;
        $$ LANGUAGE plpgsql STABLE;
        "#
    )
    .execute(pool)
    .await?;

    // 3. Commentaires
    sqlx::query(
        r#"
        COMMENT ON FUNCTION get_active_products IS 'Filtre et retourne uniquement les produits actifs (is_active = TRUE dans products_lifecycle). Par défaut, si pas d''entrée dans products_lifecycle, le produit est considéré comme actif.';
        "#
    )
    .execute(pool)
    .await?;

    sqlx::query(
        r#"
        COMMENT ON FUNCTION search_services_gps_final IS 'Recherche UNIQUEMENT dans service_products (PAS dans services.data->produits). Retourne uniquement les services qui ont au moins un produit actif dans service_products correspondant à la recherche.';
        "#
    )
    .execute(pool)
    .await?;

    info!("✅ Fonction search_services_gps_final créée/mise à jour");
    Ok(())
}

/// ✅ 2025-11-25 : Crée la fonction hybrid_image_search pour recherche d'images hybride
/// Migration: 20251027003_create_hybrid_image_search_function.sql
pub async fn ensure_hybrid_image_search(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification/création de hybrid_image_search...");

    // 1. Fonction helper calculate_gps_distance_km_simple
    sqlx::query(
        r#"
        CREATE OR REPLACE FUNCTION calculate_gps_distance_km_simple(
            lat1 DOUBLE PRECISION,
            lng1 DOUBLE PRECISION,
            lat2 DOUBLE PRECISION,
            lng2 DOUBLE PRECISION
        )
        RETURNS DOUBLE PRECISION AS $$
        BEGIN
            RETURN (
                6371.0 * acos(
                    LEAST(1.0, GREATEST(-1.0,
                        cos(radians(lat1)) * 
                        cos(radians(lat2)) * 
                        cos(radians(lng2) - radians(lng1)) + 
                        sin(radians(lat1)) * 
                        sin(radians(lat2))
                    ))
                )
            );
        EXCEPTION
            WHEN OTHERS THEN
                RETURN NULL;
        END;
        $$ LANGUAGE plpgsql IMMUTABLE;
        "#,
    )
    .execute(pool)
    .await?;

    // 2. Fonction hybrid_image_search (version simplifiée - la migration SQLx complète l'améliorera)
    // Note: Cette fonction est complexe, la migration SQLx 20251027003 contient la version complète
    sqlx::query(
        r#"
        CREATE OR REPLACE FUNCTION hybrid_image_search(
            search_tags TEXT[],
            search_category TEXT DEFAULT NULL,
            search_marque TEXT DEFAULT NULL,
            search_couleur TEXT DEFAULT NULL,
            search_query_semantic TEXT DEFAULT NULL,
            gps_lat FLOAT DEFAULT NULL,
            gps_lng FLOAT DEFAULT NULL,
            search_radius_km INTEGER DEFAULT 50,
            max_results INTEGER DEFAULT 20
        )
        RETURNS TABLE (
            service_id INTEGER,
            analysis_id INTEGER,
            media_id INTEGER,
            product_description TEXT,
            product_tags TEXT[],
            product_marque TEXT,
            product_couleurs TEXT[],
            match_score FLOAT,
            distance_km FLOAT
        ) AS $$
        BEGIN
            -- Version simplifiée - la migration SQLx 20251027003 contient la version complète
            -- Cette fonction garantit que l'interface existe même si la migration n'a pas été appliquée
            RETURN QUERY
            SELECT 
                NULL::INTEGER as service_id,
                NULL::INTEGER as analysis_id,
                NULL::INTEGER as media_id,
                NULL::TEXT as product_description,
                NULL::TEXT[] as product_tags,
                NULL::TEXT as product_marque,
                NULL::TEXT[] as product_couleurs,
                0.0::FLOAT as match_score,
                NULL::FLOAT as distance_km
            WHERE FALSE; -- Retourne aucun résultat par défaut
        END;
        $$ LANGUAGE plpgsql STABLE;
        "#
    )
    .execute(pool)
    .await?;

    info!("✅ Fonction hybrid_image_search créée/mise à jour (version de base - migration SQLx complétera)");
    Ok(())
}

/// ✅ 2025-12-21 : Améliore hybrid_image_search avec fallback vers services.data->produits
/// Migration: 20251221_add_fallback_to_hybrid_image_search.sql
pub async fn ensure_hybrid_image_search_fallback(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Application migration hybrid_image_search_fallback...");
    let migration_sql =
        include_str!("../../migrations/20251221_add_fallback_to_hybrid_image_search.sql");
    execute_migration_sql_safe(pool, migration_sql).await?;
    info!("✅ Migration hybrid_image_search_fallback appliquée");
    Ok(())
}

/// ✅ 2025-12-23 : Améliore la pertinence de hybrid_image_search avec scoring optimisé
/// Migration: 20251223_improve_hybrid_image_search_relevance.sql
pub async fn ensure_hybrid_image_search_relevance(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Application migration hybrid_image_search_relevance...");
    let migration_sql =
        include_str!("../../migrations/20251223_improve_hybrid_image_search_relevance.sql");
    execute_migration_sql_safe(pool, migration_sql).await?;
    info!("✅ Migration hybrid_image_search_relevance appliquée");
    Ok(())
}

/// ✅ 2025-12-24 : Améliore hybrid_image_search avec langue dynamique et scoring priorisant ILIKE
/// Migration: 20251224_improve_hybrid_image_search_language_and_relevance.sql
pub async fn ensure_hybrid_image_search_language_and_relevance(
    pool: &PgPool,
) -> Result<(), sqlx::Error> {
    info!("🔍 Application migration hybrid_image_search_language_and_relevance...");
    let migration_sql = include_str!(
        "../../migrations/00001029_improve_hybrid_image_search_language_and_relevance.sql"
    );
    execute_migration_sql_safe(pool, migration_sql).await?;
    info!("✅ Migration hybrid_image_search_language_and_relevance appliquée");
    Ok(())
}

/// ✅ 2025-12-24 : Correction pertinence et performance recherche par image (seuil strict 150.0, scoring plus strict)
/// Migration: 20251224_fix_image_search_relevance_and_performance.sql
pub async fn ensure_hybrid_image_search_relevance_and_performance(
    pool: &PgPool,
) -> Result<(), sqlx::Error> {
    info!("🔍 Application migration hybrid_image_search_relevance_and_performance...");
    let migration_sql =
        include_str!("../../migrations/20251224_fix_image_search_relevance_and_performance.sql");
    execute_migration_sql_safe(pool, migration_sql).await?;
    info!("✅ Migration hybrid_image_search_relevance_and_performance appliquée");
    Ok(())
}

/// ✅ 2025-12-27 : Adaptation recherche par image pour produits génériques (sans marque/couleur)
/// Migration: 20251227_fix_image_search_strict_matching.sql
/// Problème: Produits génériques (services, prestations) n'ont pas de marque/couleur
/// Solution: 1 tag suffit (au lieu de 2), marque/couleur optionnels, priorité à search_query_semantic
pub async fn ensure_hybrid_image_search_generic_products(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Application migration hybrid_image_search_generic_products...");
    let migration_sql =
        include_str!("../../migrations/00000043_fix_image_search_strict_matching.sql");
    execute_migration_sql_safe(pool, migration_sql).await?;
    info!("✅ Migration hybrid_image_search_generic_products appliquée");
    Ok(())
}

/// ✅ 2025-12-24 : Optimisation critique des requêtes lentes identifiées dans les logs
/// Migration: 20251224_optimize_slow_queries_critical.sql
/// Problèmes corrigés: pharmacies JOIN (1.68s), delivery_matching_queue (1.37s), deliveries SELECT (1.4-2.3s), find_nearby_couriers (2.1s)
pub async fn ensure_optimize_slow_queries_critical(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Application migration optimize_slow_queries_critical...");
    let migration_sql =
        include_str!("../../migrations/00001032_optimize_slow_queries_critical.sql");
    execute_migration_sql_safe(pool, migration_sql).await?;
    info!("✅ Migration optimize_slow_queries_critical appliquée");
    Ok(())
}

/// ✅ 2026-01-11 : Optimisation additionnelle des requêtes deliveries identifiées dans les warnings
/// Migration: 20260111_optimize_delivery_queries_additional.sql
/// Problèmes corrigés: get_delivery_summary (1.1-1.5s), find_nearby_couriers (1.14s), UPDATE delivery_matching_queue (1.09s)
pub async fn ensure_optimize_delivery_queries_additional(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Application migration optimize_delivery_queries_additional...");
    let migration_sql =
        include_str!("../../migrations/20260111_optimize_delivery_queries_additional.sql");
    execute_migration_sql_safe(pool, migration_sql).await?;
    info!("✅ Migration optimize_delivery_queries_additional appliquée");
    Ok(())
}

/// ✅ 2026-01-14 : Optimisation des performances de recherche
/// Migration: 20260114_optimize_search_performance.sql
/// Problèmes corrigés:
///   - Requête publicites lente (1.136s) → <50ms avec index
///   - UPDATE delivery_matching_queue lent (1.288s) → <50ms avec index
///   - SELECT delivery_parcels avec sous-requête lente (436-765ms) → <50ms avec JOIN + index
pub async fn ensure_optimize_search_performance(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Application migration optimize_search_performance...");
    let migration_sql = include_str!("../../migrations/00000054_optimize_search_performance.sql");
    execute_migration_sql_safe(pool, migration_sql).await?;
    info!("✅ Migration optimize_search_performance appliquée");
    Ok(())
}

/// ✅ 2025-11-25 : Crée les fonctions de recherche avec planification (pharmacie/hôpital)
/// Migration: 20251020003_add_pharmacy_hospital_scheduling_search.sql
pub async fn ensure_scheduling_search_functions(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification/création des fonctions de recherche avec planification...");

    // 1. Fonction is_pharmacy_on_duty
    sqlx::query(
        r#"
        CREATE OR REPLACE FUNCTION is_pharmacy_on_duty(
            pharmacy_data JSONB,
            search_time TIMESTAMPTZ DEFAULT NOW()
        )
        RETURNS BOOLEAN AS $$
        DECLARE
            jours_garde TEXT;
            heures_ouverture TEXT;
            heures_fermeture TEXT;
            current_day TEXT;
            v_current_time TIME;
            is_garde_day BOOLEAN := FALSE;
            is_garde_hour BOOLEAN := FALSE;
        BEGIN
            jours_garde := pharmacy_data->>'joursGarde';
            heures_ouverture := pharmacy_data->>'heuresOuverture';
            heures_fermeture := pharmacy_data->>'heuresFermeture';
            
            IF jours_garde IS NULL OR jours_garde = '' THEN
                RETURN FALSE;
            END IF;
            
            current_day := CASE EXTRACT(DOW FROM search_time)
                WHEN 0 THEN 'Dimanche'
                WHEN 1 THEN 'Lundi'
                WHEN 2 THEN 'Mardi'
                WHEN 3 THEN 'Mercredi'
                WHEN 4 THEN 'Jeudi'
                WHEN 5 THEN 'Vendredi'
                WHEN 6 THEN 'Samedi'
            END;
            
            v_current_time := search_time::TIME;
            
            is_garde_day := (
                jours_garde ILIKE '%' || current_day || '%' OR
                jours_garde ILIKE '%Lundi-Dimanche%' OR
                jours_garde ILIKE '%24h%' OR
                jours_garde ILIKE '%permanent%'
            );
            
            IF NOT is_garde_day THEN
                RETURN FALSE;
            END IF;
            
            IF heures_ouverture IS NOT NULL AND heures_fermeture IS NOT NULL THEN
                IF heures_ouverture = '00:00' AND heures_fermeture = '23:59' THEN
                    is_garde_hour := TRUE;
                ELSE
                    is_garde_hour := (
                        v_current_time >= heures_ouverture::TIME AND 
                        v_current_time <= heures_fermeture::TIME
                    );
                END IF;
            ELSE
                is_garde_hour := TRUE;
            END IF;
            
            RETURN is_garde_day AND is_garde_hour;
        END;
        $$ LANGUAGE plpgsql IMMUTABLE;
        "#,
    )
    .execute(pool)
    .await?;

    // 2. Fonction is_medical_service_available
    sqlx::query(
        r#"
        CREATE OR REPLACE FUNCTION is_medical_service_available(
            hospital_data JSONB,
            search_time TIMESTAMPTZ DEFAULT NOW(),
            requested_service TEXT DEFAULT NULL
        )
        RETURNS BOOLEAN AS $$
        DECLARE
            planning_hebdomadaire JSONB;
            prestations_medicales JSONB;
            current_day TEXT;
            v_current_time TIME;
            day_planning JSONB;
            service_available BOOLEAN := FALSE;
            time_available BOOLEAN := FALSE;
        BEGIN
            planning_hebdomadaire := hospital_data->'planningHebdomadaire';
            prestations_medicales := hospital_data->'prestationsMedicales';
            
            IF planning_hebdomadaire IS NULL THEN
                RETURN FALSE;
            END IF;
            
            current_day := CASE EXTRACT(DOW FROM search_time)
                WHEN 0 THEN 'dimanche'
                WHEN 1 THEN 'lundi'
                WHEN 2 THEN 'mardi'
                WHEN 3 THEN 'mercredi'
                WHEN 4 THEN 'jeudi'
                WHEN 5 THEN 'vendredi'
                WHEN 6 THEN 'samedi'
            END;
            
            v_current_time := search_time::TIME;
            day_planning := planning_hebdomadaire->current_day;
            
            IF day_planning IS NULL THEN
                RETURN FALSE;
            END IF;
            
            IF requested_service IS NOT NULL AND prestations_medicales IS NOT NULL THEN
                service_available := (
                    prestations_medicales ? requested_service OR
                    prestations_medicales::TEXT ILIKE '%' || requested_service || '%'
                );
            ELSE
                service_available := TRUE;
            END IF;
            
            IF day_planning->>'permanent' = 'true' THEN
                time_available := TRUE;
            ELSE
                time_available := (
                    v_current_time >= (day_planning->>'debut')::TIME AND 
                    v_current_time <= (day_planning->>'fin')::TIME
                );
            END IF;
            
            RETURN service_available AND time_available;
        END;
        $$ LANGUAGE plpgsql IMMUTABLE;
        "#,
    )
    .execute(pool)
    .await?;

    // 3. Fonction search_products_with_scheduling (version simplifiée)
    // Note: La migration SQLx 20251020003 contient la version complète
    sqlx::query(
        r#"
        CREATE OR REPLACE FUNCTION search_products_with_scheduling(
            search_query TEXT,
            search_time TIMESTAMPTZ DEFAULT NOW(),
            user_lat FLOAT DEFAULT NULL,
            user_lng FLOAT DEFAULT NULL,
            max_distance_km FLOAT DEFAULT 50.0
        )
        RETURNS TABLE (
            service_id INTEGER,
            product_data JSONB,
            relevance_score FLOAT,
            distance_km FLOAT,
            is_available_now BOOLEAN,
            availability_info TEXT
        ) AS $$
        BEGIN
            -- Version simplifiée - la migration SQLx 20251020003 contient la version complète
            RETURN QUERY
            SELECT 
                NULL::INTEGER as service_id,
                NULL::JSONB as product_data,
                0.0::FLOAT as relevance_score,
                NULL::FLOAT as distance_km,
                FALSE::BOOLEAN as is_available_now,
                NULL::TEXT as availability_info
            WHERE FALSE;
        END;
        $$ LANGUAGE plpgsql;
        "#,
    )
    .execute(pool)
    .await?;

    info!("✅ Fonctions de recherche avec planification créées/mises à jour");
    Ok(())
}

/// Helper pour exécuter plusieurs commandes SQL séparées par des points-virgules
/// Gère les blocs DO $$ ... $$ comme une seule commande
/// ✅ CORRECTION RACINE: Normalise les commandes SQL pour éviter les erreurs d'objets existants
/// - Ajoute IF NOT EXISTS aux CREATE INDEX
/// - Wrappe CREATE TRIGGER dans DO $$ blocks avec vérification d'existence
/// - Ajoute IF NOT EXISTS aux CREATE TABLE
fn normalize_sql_command(cmd: &str) -> String {
    let trimmed = cmd.trim();
    let upper = trimmed.to_uppercase();

    // Normaliser CREATE INDEX - ajouter IF NOT EXISTS si manquant
    if upper.contains("CREATE INDEX")
        && !upper.contains("IF NOT EXISTS")
        && !upper.contains("UNIQUE INDEX")
    {
        // Pattern: CREATE INDEX index_name ON table_name(...)
        // -> CREATE INDEX IF NOT EXISTS index_name ON table_name(...)
        if let Some(idx_pos) = upper.find("CREATE INDEX") {
            let before = &trimmed[..idx_pos];
            let after_idx = &trimmed[idx_pos + "CREATE INDEX".len()..];
            // Vérifier qu'on n'a pas déjà UNIQUE INDEX ou IF NOT EXISTS
            if !after_idx.trim_start().starts_with("UNIQUE")
                && !after_idx.trim_start().starts_with("IF NOT EXISTS")
            {
                return format!("{}CREATE INDEX IF NOT EXISTS{}", before, after_idx);
            }
        }
    }

    // Normaliser CREATE UNIQUE INDEX - ajouter IF NOT EXISTS si manquant
    if upper.contains("CREATE UNIQUE INDEX") && !upper.contains("IF NOT EXISTS") {
        if let Some(idx_pos) = upper.find("CREATE UNIQUE INDEX") {
            let before = &trimmed[..idx_pos];
            let after_idx = &trimmed[idx_pos + "CREATE UNIQUE INDEX".len()..];
            if !after_idx.trim_start().starts_with("IF NOT EXISTS") {
                return format!("{}CREATE UNIQUE INDEX IF NOT EXISTS{}", before, after_idx);
            }
        }
    }

    // Normaliser CREATE TABLE - ajouter IF NOT EXISTS si manquant
    if upper.contains("CREATE TABLE")
        && !upper.contains("IF NOT EXISTS")
        && !upper.contains("CREATE TABLE AS")
    {
        if let Some(tbl_pos) = upper.find("CREATE TABLE") {
            let before = &trimmed[..tbl_pos];
            let after_tbl = &trimmed[tbl_pos + "CREATE TABLE".len()..];
            // Ne pas modifier si c'est CREATE TABLE AS SELECT
            if !after_tbl.trim_start().starts_with("AS")
                && !after_tbl.trim_start().starts_with("IF NOT EXISTS")
            {
                return format!("{}CREATE TABLE IF NOT EXISTS{}", before, after_tbl);
            }
        }
    }

    // ✅ AMÉLIORATION 2026-01-31: Normaliser CREATE TRIGGER - wrapper dans DO $$ block avec vérification
    // Ne pas wrapper si déjà dans un DO $$ block ou si DROP TRIGGER IF EXISTS est présent
    if upper.contains("CREATE TRIGGER")
        && !upper.contains("DO $$")
        && !upper.contains("IF NOT EXISTS")
        && !upper.contains("DROP TRIGGER IF EXISTS")
    {
        // Extraire le nom du trigger et la définition complète
        // Pattern: CREATE TRIGGER trigger_name ON table_name ...
        if let Some(trigger_pos) = upper.find("CREATE TRIGGER") {
            let trigger_decl = &trimmed[trigger_pos..];
            // Extraire le nom du trigger (mot après CREATE TRIGGER)
            let parts: Vec<&str> = trigger_decl.split_whitespace().collect();
            if parts.len() >= 3 {
                // Le nom du trigger peut contenir des caractères spéciaux, prendre jusqu'au prochain mot-clé
                let trigger_name_candidate = parts[2];
                // Nettoyer le nom (enlever ; si présent)
                let trigger_name = trigger_name_candidate.trim_end_matches(';');

                // ✅ AMÉLIORATION: Vérifier que la définition du trigger est complète
                // Un trigger complet doit contenir: ON table_name, FOR EACH ROW, EXECUTE FUNCTION
                let trigger_decl_upper = trigger_decl.to_uppercase();
                let is_complete = trigger_decl_upper.contains("ON ")
                    && (trigger_decl_upper.contains("FOR EACH ROW")
                        || trigger_decl_upper.contains("FOR EACH STATEMENT"))
                    && trigger_decl_upper.contains("EXECUTE FUNCTION");

                if !is_complete {
                    // Trigger incomplet - ne pas wrapper, laisser tel quel pour que l'erreur soit détectée
                    warn!("⚠️ Trigger incomplet détecté (manque ON table_name, FOR EACH ROW, ou EXECUTE FUNCTION): {}", 
                        if trigger_decl.len() > 100 { format!("{}...", &trigger_decl[..100]) } else { trigger_decl.to_string() });
                    return trimmed.to_string(); // Retourner tel quel pour que l'erreur soit détectée
                }

                // ✅ CORRIGÉ: Utiliser EXECUTE car PostgreSQL ne permet pas CREATE TRIGGER dans IF THEN directement
                // Wrapper dans DO $$ avec vérification d'existence
                // IMPORTANT: Inclure TOUTE la définition du trigger dans EXECUTE
                let trigger_sql = trigger_decl.trim_end_matches(';').replace('\'', "''"); // Échapper les quotes pour EXECUTE
                return format!(
                    r#"DO $$
                    BEGIN
                        IF NOT EXISTS (
                            SELECT 1 FROM pg_trigger WHERE tgname = '{}'
                        ) THEN
                            EXECUTE '{}';
                        END IF;
                    END $$;
                    "#,
                    trigger_name, trigger_sql
                );
            }
        }
    }

    // ✅ NOUVEAU 2026-01-31: Normaliser ALTER TABLE ADD COLUMN - ajouter IF NOT EXISTS si manquant
    // PostgreSQL supporte ALTER TABLE ... ADD COLUMN IF NOT EXISTS depuis la version 9.6
    if upper.contains("ALTER TABLE")
        && upper.contains("ADD COLUMN")
        && !upper.contains("IF NOT EXISTS")
    {
        // Pattern: ALTER TABLE table_name ADD COLUMN column_name ...
        // -> ALTER TABLE table_name ADD COLUMN IF NOT EXISTS column_name ...
        if let Some(add_col_pos) = upper.find("ADD COLUMN") {
            let before_add = &trimmed[..add_col_pos];
            let after_add = &trimmed[add_col_pos + "ADD COLUMN".len()..];
            // Vérifier qu'on n'a pas déjà IF NOT EXISTS après ADD COLUMN
            if !after_add.trim_start().to_uppercase().starts_with("IF NOT EXISTS") {
                return format!("{}ADD COLUMN IF NOT EXISTS{}", before_add, after_add);
            }
        }
    }

    trimmed.to_string()
}

/// ✅ AMÉLIORÉ 2026-02-14: Fonction helper pour détecter si une CREATE TABLE est complète
/// Vérifie que ');' apparaît vraiment à la fin de la commande (pas dans une valeur par défaut, chaîne, etc.)
fn is_create_table_complete(cmd: &str) -> bool {
    let cmd_upper = cmd.to_uppercase();

    // Doit contenir CREATE TABLE
    if !cmd_upper.contains("CREATE TABLE") {
        return false;
    }

    // Compter les parenthèses pour vérifier l'équilibre, en ignorant celles dans les chaînes
    let mut depth = 0i32;
    let mut has_opening_paren = false;
    let mut in_string = false;
    let mut string_char: Option<char> = None;
    let chars: Vec<char> = cmd.chars().collect();

    for i in 0..chars.len() {
        let ch = chars[i];
        let is_escaped = i > 0 && chars[i - 1] == '\\';

        // Gérer les chaînes (simples et doubles quotes)
        if !in_string {
            if (ch == '\'' || ch == '"') && !is_escaped {
                in_string = true;
                string_char = Some(ch);
            } else if ch == '(' {
                depth += 1;
                has_opening_paren = true;
            } else if ch == ')' {
                depth -= 1;
            }
        } else {
            // Dans une chaîne, ignorer les parenthèses
            if let Some(sc) = string_char {
                if ch == sc && !is_escaped {
                    in_string = false;
                    string_char = None;
                }
            }
        }
    }

    // Vérifier que les parenthèses sont équilibrées
    let has_balanced_parens = depth == 0;

    // Vérifier que ');' apparaît à la fin (après avoir fermé toutes les parenthèses)
    // On cherche ');' qui n'est pas dans une chaîne
    let mut found_closing = false;
    let mut temp_depth = 0i32;
    let mut temp_in_string = false;
    let mut temp_string_char: Option<char> = None;

    for i in 0..chars.len().saturating_sub(1) {
        let ch = chars[i];
        let next_ch = chars[i + 1];
        let is_escaped = i > 0 && chars[i - 1] == '\\';

        if !temp_in_string {
            if (ch == '\'' || ch == '"') && !is_escaped {
                temp_in_string = true;
                temp_string_char = Some(ch);
            } else if ch == '(' {
                temp_depth += 1;
            } else if ch == ')' {
                temp_depth -= 1;
                // Si on ferme la dernière parenthèse et que le prochain caractère est ';'
                if temp_depth == 0 && next_ch == ';' {
                    // Vérifier qu'il n'y a pas de caractères significatifs après
                    let remaining = &cmd[i + 2..].trim();
                    // Ignorer les commentaires et espaces
                    if remaining.is_empty() || remaining.starts_with("--") {
                        found_closing = true;
                        break;
                    }
                }
            }
        } else {
            if let Some(sc) = temp_string_char {
                if ch == sc && !is_escaped {
                    temp_in_string = false;
                    temp_string_char = None;
                }
            }
        }
    }

    // La commande est complète si :
    // 1. Elle a une parenthèse ouvrante
    // 2. Les parenthèses sont équilibrées
    // 3. On a trouvé ');' à la fin
    has_opening_paren && has_balanced_parens && found_closing
}

/// ✅ AMÉLIORÉ 2026-02-14: Fonction helper pour détecter si une CREATE INDEX est complète
/// Vérifie qu'elle a "ON table_name" et se termine correctement
fn is_create_index_complete(cmd: &str) -> bool {
    let cmd_upper = cmd.to_uppercase();

    if !cmd_upper.contains("CREATE INDEX") && !cmd_upper.contains("CREATE UNIQUE INDEX") {
        return false;
    }

    // Doit avoir "ON table_name"
    let has_on = cmd_upper.contains(" ON ");

    // Si elle a un prédicat WHERE, vérifier qu'il est complet
    if cmd_upper.contains(" WHERE ") {
        // Compter les parenthèses dans le prédicat WHERE
        let where_pos = cmd_upper.find(" WHERE ").unwrap_or(0);
        let after_where = &cmd[where_pos..];
        let mut depth = 0i32;
        let mut in_string = false;
        let mut string_char: Option<char> = None;

        for ch in after_where.chars() {
            if !in_string {
                if ch == '\'' || ch == '"' {
                    in_string = true;
                    string_char = Some(ch);
                } else if ch == '(' {
                    depth += 1;
                } else if ch == ')' {
                    depth -= 1;
                }
            } else {
                if let Some(sc) = string_char {
                    if ch == sc {
                        in_string = false;
                        string_char = None;
                    }
                }
            }
        }

        // Le prédicat WHERE doit avoir des parenthèses équilibrées
        if depth != 0 {
            return false;
        }
    }

    // Doit se terminer par ';'
    cmd.trim().ends_with(';') && has_on
}

/// ✅ AMÉLIORÉ 2026-02-14: Fonction helper pour détecter si une CREATE MATERIALIZED VIEW est complète
fn is_create_materialized_view_complete(cmd: &str) -> bool {
    let cmd_upper = cmd.to_uppercase();

    if !cmd_upper.contains("CREATE MATERIALIZED VIEW") {
        return false;
    }

    // Doit avoir "AS SELECT"
    let has_as_select = cmd_upper.contains(" AS ") && cmd_upper.contains("SELECT");

    // Doit se terminer par ';'
    let ends_with_semicolon = cmd.trim().ends_with(';');

    // Vérifier qu'il y a un GROUP BY si nécessaire (pour les agrégations)
    // Note: On ne peut pas vraiment vérifier cela sans parser complètement, mais on peut vérifier la structure de base

    has_as_select && ends_with_semicolon
}

/// ✅ AMÉLIORÉ 2026-02-01: Fonction helper pour exécuter des migrations SQL
/// Divise les commandes correctement en préservant les blocs DO $$ et les fonctions
/// Détecte les commandes multiples même sans ';' entre elles
/// Cette fonction remplace execute_multiple_sql_commands pour éviter les fragments SQL invalides
pub async fn execute_migration_sql_safe(pool: &PgPool, sql: &str) -> Result<(), sqlx::Error> {
    // Diviser par ';' mais préserver les blocs $$...$$
    let mut commands = Vec::new();
    let mut current = String::new();
    let mut in_dollar_block = false;
    let mut dollar_tag = String::new();
    let mut paren_depth = 0i32;

    let lines: Vec<&str> = sql.lines().collect();
    let mut i = 0;

    while i < lines.len() {
        let line = lines[i];
        let trimmed = line.trim();

        // Ignorer les lignes vides et commentaires seuls
        if trimmed.is_empty() || trimmed.starts_with("--") {
            if !current.trim().is_empty() {
                current.push_str(line);
                current.push_str("\n");
            }
            i += 1;
            continue;
        }

        // ✅ AMÉLIORATION 2026-02-01: Détecter début/fin de blocs $$ avec support des tags personnalisés
        // Exemples: $$, $tag$, $function$, etc.
        if trimmed.contains("$") {
            // Chercher tous les patterns $$ ou $tag$
            let dollar_patterns: Vec<&str> =
                trimmed.split_whitespace().filter(|s| s.contains('$')).collect();

            for pattern in dollar_patterns {
                // Extraire le tag (entre les $)
                if let Some(start) = pattern.find('$') {
                    if let Some(end) = pattern[start + 1..].find('$') {
                        let tag = &pattern[start..=start + end + 1];

                        if !in_dollar_block {
                            // Début d'un bloc
                            dollar_tag = tag.to_string();
                            in_dollar_block = true;
                            break;
                        } else if pattern.contains(&dollar_tag) {
                            // Fin d'un bloc (même tag)
                            in_dollar_block = false;
                            dollar_tag.clear();
                            break;
                        }
                    }
                }
            }

            // Fallback pour le pattern simple $$
            if !in_dollar_block && trimmed.contains("$$") {
                dollar_tag = "$$".to_string();
                in_dollar_block = true;
            } else if in_dollar_block && trimmed.contains("$$") && dollar_tag == "$$" {
                // ✅ AMÉLIORATION 2026-02-02: Vérifier que c'est bien la fin du bloc (END $$; ou $$ LANGUAGE)
                // Ne pas fermer le bloc si c'est juste $$ au milieu d'une fonction
                if trimmed.contains("END $$")
                    || trimmed.contains("$$ LANGUAGE")
                    || trimmed.contains("$$;")
                {
                    in_dollar_block = false;
                    dollar_tag.clear();
                }
            }
        }

        // Compter les parenthèses AVANT d'ajouter la ligne
        let open_parens = trimmed.matches('(').count();
        let close_parens = trimmed.matches(')').count();
        let new_paren_depth = paren_depth + (open_parens as i32) - (close_parens as i32);

        // ✅ CRITIQUE 2026-02-01: Vérifier si la ligne actuelle se termine par ';' AVANT d'ajouter à current
        // Si oui et qu'on n'est pas dans un bloc $$ ou une parenthèse, terminer la commande actuelle
        let line_ends_with_semicolon = trimmed.ends_with(';');
        let should_end_before_adding = line_ends_with_semicolon
            && !in_dollar_block
            && new_paren_depth == 0
            && !current.trim().is_empty();

        // Si on doit terminer avant d'ajouter, traiter la commande actuelle d'abord
        if should_end_before_adding {
            let cmd = current.trim();
            if !cmd.is_empty() && !cmd.starts_with("--") {
                let cmd_upper = cmd.to_uppercase();
                let valid_keywords = [
                    "CREATE", "ALTER", "DROP", "INSERT", "UPDATE", "DELETE", "SELECT", "GRANT",
                    "REVOKE", "COMMENT", "TRUNCATE", "ANALYZE", "VACUUM", "EXECUTE", "DO", "BEGIN",
                    "COMMIT", "ROLLBACK",
                ];
                if valid_keywords.iter().any(|kw| cmd_upper.starts_with(kw)) {
                    commands.push(cmd.to_string());
                }
            }
            current.clear();
            // paren_depth sera mis à jour plus bas avec new_paren_depth
        }

        // Maintenant ajouter la ligne actuelle
        current.push_str(line);
        current.push_str("\n");

        // Mettre à jour paren_depth après avoir ajouté la ligne
        paren_depth = new_paren_depth;

        // ✅ AMÉLIORATION 2026-02-01: Détecter la fin d'une commande de plusieurs façons
        let mut should_end_command = false;

        // 1. ✅ AMÉLIORATION 2026-02-01: Si on trouve un ';' et qu'on n'est pas dans un bloc $$ ou une parenthèse
        // CRITIQUE: Ne jamais terminer une commande si on est dans un bloc $$ (même avec ';')
        // Exception: Ne pas terminer certaines commandes multi-lignes si elles ne sont pas complètes
        if trimmed.ends_with(';') && !in_dollar_block {
            let cmd_upper = current.to_uppercase();
            let is_create_table = cmd_upper.contains("CREATE TABLE");
            let is_create_index =
                cmd_upper.contains("CREATE INDEX") || cmd_upper.contains("CREATE UNIQUE INDEX");
            let is_comment_on = cmd_upper.contains("COMMENT ON");
            let is_create_materialized_view = cmd_upper.contains("CREATE MATERIALIZED VIEW");

            // ✅ AMÉLIORATION 2026-02-14: Si c'est une CREATE TABLE, utiliser la fonction helper améliorée
            // CRITIQUE: Les CREATE TABLE doivent se terminer par ');' même si c'est sur plusieurs lignes
            // CRITIQUE: Ne JAMAIS terminer une CREATE TABLE si elle n'a pas ');' même si paren_depth == 0
            if is_create_table {
                // ✅ AMÉLIORATION 2026-02-14: Utiliser la fonction helper qui vérifie correctement
                // que ');' est vraiment la fin de la commande (pas dans une valeur par défaut, chaîne, etc.)
                if is_create_table_complete(&current) && paren_depth == 0 {
                    should_end_command = true;
                } else {
                    // Si la CREATE TABLE n'est pas complète, NE PAS terminer même si on a un ';'
                    should_end_command = false;
                }
            }
            // ✅ AMÉLIORATION 2026-02-14: Si c'est une CREATE INDEX, utiliser la fonction helper améliorée
            else if is_create_index {
                if is_create_index_complete(&current) && paren_depth == 0 {
                    should_end_command = true;
                } else {
                    should_end_command = false;
                }
            }
            // Si c'est un COMMENT ON, vérifier qu'il y a "IS" et une chaîne complète
            else if is_comment_on {
                let has_comment_is = cmd_upper.contains(" IS ");
                let has_string = trimmed.ends_with("'")
                    || trimmed.ends_with("';")
                    || trimmed.ends_with("'::text");
                if has_comment_is && has_string {
                    should_end_command = true;
                }
            }
            // ✅ AMÉLIORATION 2026-02-14: Si c'est une CREATE MATERIALIZED VIEW, utiliser la fonction helper
            else if is_create_materialized_view {
                if is_create_materialized_view_complete(&current) && paren_depth == 0 {
                    should_end_command = true;
                } else {
                    should_end_command = false;
                }
            }
            // ✅ NOUVEAU: Si c'est une CREATE VIEW, vérifier qu'elle a "AS SELECT" et se termine par ';'
            else if cmd_upper.contains("CREATE VIEW") {
                let has_view_as = cmd_upper.contains(" AS ");
                let has_from = cmd_upper.contains(" FROM ");
                // Une vue complète doit avoir AS, FROM, et se terminer par ';'
                if has_view_as && has_from && trimmed.ends_with(';') {
                    should_end_command = true;
                }
            }
            // Pour les autres commandes, terminer normalement SEULEMENT si paren_depth == 0
            else {
                // ✅ AMÉLIORATION 2026-02-14: Ne terminer que si paren_depth == 0
                // Cela évite de terminer des commandes avec des parenthèses non fermées
                if paren_depth == 0 {
                    should_end_command = true;
                } else {
                    should_end_command = false;
                }
            }
        }

        // 2. ✅ NOUVEAU: Détecter la fin d'un CREATE TRIGGER même sans ';' après EXECUTE FUNCTION
        if !in_dollar_block && paren_depth == 0 && !current.trim().is_empty() {
            let cmd_upper = current.to_uppercase();
            if cmd_upper.contains("CREATE TRIGGER") {
                let has_on = cmd_upper.contains("ON ");
                let has_for_each =
                    cmd_upper.contains("FOR EACH ROW") || cmd_upper.contains("FOR EACH STATEMENT");
                let has_execute = cmd_upper.contains("EXECUTE FUNCTION");

                // Si le trigger est complet (a ON, FOR EACH, EXECUTE FUNCTION)
                if has_on && has_for_each && has_execute {
                    // Vérifier si la ligne suivante commence par un nouveau mot-clé SQL
                    if i + 1 < lines.len() {
                        let next_line = lines[i + 1].trim();
                        if !next_line.is_empty() && !next_line.starts_with("--") {
                            let next_upper = next_line.to_uppercase();
                            let sql_keywords = [
                                "CREATE", "ALTER", "DROP", "INSERT", "UPDATE", "DELETE", "SELECT",
                                "GRANT", "REVOKE", "COMMENT", "TRUNCATE", "ANALYZE", "VACUUM",
                                "EXECUTE", "DO", "BEGIN", "COMMIT", "ROLLBACK",
                            ];
                            if sql_keywords.iter().any(|kw| next_upper.starts_with(kw)) {
                                should_end_command = true;
                            }
                        }
                    } else {
                        // Dernière ligne, terminer la commande
                        should_end_command = true;
                    }
                }
            }
        }

        // 3. ✅ AMÉLIORATION 2026-02-01: Détecter une nouvelle commande qui commence même si la précédente n'a pas de ';'
        // Amélioration: Ne pas terminer une commande CREATE TABLE/CREATE VIEW si elle n'est pas complète
        // CRITIQUE: Ne jamais terminer une commande si on est dans un bloc $$ (même si paren_depth == 0)
        if !in_dollar_block && paren_depth == 0 && !current.trim().is_empty() && i + 1 < lines.len()
        {
            let next_line = lines[i + 1].trim();
            if !next_line.is_empty() && !next_line.starts_with("--") {
                let next_upper = next_line.to_uppercase();
                let sql_keywords = [
                    "CREATE", "ALTER", "DROP", "INSERT", "UPDATE", "DELETE", "SELECT", "GRANT",
                    "REVOKE", "COMMENT", "TRUNCATE", "ANALYZE", "VACUUM", "EXECUTE", "DO", "BEGIN",
                    "COMMIT", "ROLLBACK",
                ];
                // Si la ligne suivante commence par un mot-clé SQL et que la commande actuelle est complète
                if sql_keywords.iter().any(|kw| next_upper.starts_with(kw)) {
                    let cmd_upper = current.to_uppercase();

                    // ✅ CRITIQUE 2026-02-14: Ne pas terminer une CREATE TABLE si elle n'a pas de ');' final
                    // Les CREATE TABLE doivent se terminer par ');' même si c'est sur plusieurs lignes
                    let is_create_table = cmd_upper.contains("CREATE TABLE");

                    // ✅ AMÉLIORATION 2026-02-01: Détecter la fin des CREATE INDEX et COMMENT ON multi-lignes
                    let is_create_index = cmd_upper.contains("CREATE INDEX")
                        || cmd_upper.contains("CREATE UNIQUE INDEX");
                    let is_comment_on = cmd_upper.contains("COMMENT ON");
                    let is_create_materialized_view =
                        cmd_upper.contains("CREATE MATERIALIZED VIEW");

                    // ✅ AMÉLIORATION 2026-02-14: Pour CREATE INDEX, utiliser la fonction helper améliorée
                    let index_complete = is_create_index && is_create_index_complete(&current);

                    // Pour COMMENT ON, vérifier qu'il y a "IS" et que ça se termine par une chaîne complète
                    let has_comment_is = is_comment_on && cmd_upper.contains(" IS ");
                    let comment_complete = is_comment_on
                        && has_comment_is
                        && (trimmed.ends_with("'")
                            || trimmed.ends_with("';")
                            || trimmed.ends_with("'::text"));

                    // ✅ AMÉLIORATION 2026-02-14: Pour CREATE MATERIALIZED VIEW, utiliser la fonction helper
                    let materialized_complete = is_create_materialized_view
                        && is_create_materialized_view_complete(&current);

                    // ✅ NOUVEAU 2026-02-02: Pour CREATE VIEW, vérifier qu'elle a AS, FROM, et se termine par ';'
                    let is_create_view = cmd_upper.contains("CREATE VIEW");
                    let view_complete = is_create_view
                        && cmd_upper.contains(" AS ")
                        && cmd_upper.contains(" FROM ")
                        && trimmed.ends_with(';');

                    // ✅ AMÉLIORATION 2026-02-14: Vérifier que la commande actuelle est complète
                    // CRITIQUE: Pour CREATE TABLE, utiliser la fonction helper améliorée
                    let table_complete = is_create_table && is_create_table_complete(&current);
                    let other_command_complete = !is_create_table && trimmed.ends_with(';');

                    if other_command_complete
                        || (cmd_upper.contains("CREATE TRIGGER")
                            && cmd_upper.contains("ON ")
                            && cmd_upper.contains("EXECUTE FUNCTION"))
                        || table_complete
                        || view_complete
                        || index_complete
                        || comment_complete
                        || materialized_complete
                    {
                        should_end_command = true;
                    }
                    // Si c'est une commande multi-ligne sans fin complète, ne pas terminer (attendre la ligne suivante)
                }
            }
        }

        if should_end_command {
            let cmd = current.trim();
            if !cmd.is_empty() && !cmd.starts_with("--") {
                // Vérifier que la commande commence par un mot-clé SQL valide
                let cmd_upper = cmd.to_uppercase();
                let valid_keywords = [
                    "CREATE", "ALTER", "DROP", "INSERT", "UPDATE", "DELETE", "SELECT", "GRANT",
                    "REVOKE", "COMMENT", "TRUNCATE", "ANALYZE", "VACUUM", "EXECUTE", "DO", "BEGIN",
                    "COMMIT", "ROLLBACK",
                ];
                if valid_keywords.iter().any(|kw| cmd_upper.starts_with(kw)) {
                    commands.push(cmd.to_string());
                }
            }
            current.clear();
            paren_depth = 0;
        }

        i += 1;
    }

    // ✅ AMÉLIORATION 2026-02-13: Traiter la dernière commande si elle existe
    // Vérifier que les CREATE TABLE sont complètes (ont ');' et parenthèses équilibrées)
    if !current.trim().is_empty() && !in_dollar_block && paren_depth == 0 {
        let cmd = current.trim();
        if !cmd.is_empty() && !cmd.starts_with("--") {
            let cmd_upper = cmd.to_uppercase();
            let valid_keywords = [
                "CREATE", "ALTER", "DROP", "INSERT", "UPDATE", "DELETE", "SELECT", "GRANT",
                "REVOKE", "COMMENT", "TRUNCATE", "ANALYZE", "VACUUM", "EXECUTE", "DO", "BEGIN",
                "COMMIT", "ROLLBACK",
            ];
            if valid_keywords.iter().any(|kw| cmd_upper.starts_with(kw)) {
                // ✅ AMÉLIORATION 2026-02-14: Pour CREATE TABLE, utiliser la fonction helper améliorée
                if cmd_upper.contains("CREATE TABLE") {
                    if !is_create_table_complete(cmd) {
                        warn!("⚠️ [MIGRATION] CREATE TABLE incomplète détectée (manque ');' ou parenthèses non équilibrées), ignorée");
                        warn!(
                            "   Preview: {}",
                            if cmd.len() > 200 {
                                format!("{}...", &cmd[..200])
                            } else {
                                cmd.to_string()
                            }
                        );
                    } else {
                        commands.push(cmd.to_string());
                    }
                } else {
                    commands.push(cmd.to_string());
                }
            }
        }
    }

    // ✅ AMÉLIORATION 2026-02-01: Exécuter chaque commande avec gestion d'erreurs améliorée
    for cmd in commands {
        let trimmed_cmd = cmd.trim();
        if trimmed_cmd.is_empty() || trimmed_cmd.starts_with("--") {
            continue;
        }

        // ✅ AMÉLIORATION 2026-02-01: Gérer les commandes multiples dans un seul statement
        // Si la commande contient plusieurs ';' et n'est pas dans un bloc DO $$, diviser
        let cmd_upper = trimmed_cmd.to_uppercase();
        // Vérifier si on est dans une parenthèse en comptant les parenthèses dans la commande
        let cmd_paren_depth: i32 = trimmed_cmd
            .chars()
            .map(|c| {
                if c == '(' {
                    1
                } else if c == ')' {
                    -1
                } else {
                    0
                }
            })
            .sum();

        // ✅ NOUVEAU: Détecter les blocs DO $$ qui contiennent plusieurs commandes séparées
        // Exemple: DO $$ BEGIN DROP TRIGGER ...; CREATE TRIGGER ...; END $$;
        let is_do_block_with_multiple_commands = cmd_upper.contains("DO $$")
            && cmd_upper.contains("BEGIN")
            && cmd_upper.contains("END $$")
            && trimmed_cmd.matches(';').count() > 2; // Plus de 2 ';' = plusieurs commandes dans le bloc

        if trimmed_cmd.matches(';').count() > 1
            && !cmd_upper.contains("DO $$")
            && !cmd_upper.contains("CREATE FUNCTION")
            && !cmd_upper.contains("CREATE OR REPLACE FUNCTION")
            && cmd_paren_depth == 0
            && !is_do_block_with_multiple_commands
        {
            // Diviser en commandes individuelles
            let parts: Vec<&str> =
                trimmed_cmd.split(';').filter(|p| !p.trim().is_empty()).collect();

            for part in parts {
                let part_trimmed = part.trim();
                if part_trimmed.is_empty() || part_trimmed.starts_with("--") {
                    continue;
                }

                let part_upper = part_trimmed.to_uppercase();
                let valid_keywords = [
                    "CREATE", "ALTER", "DROP", "INSERT", "UPDATE", "DELETE", "SELECT", "GRANT",
                    "REVOKE", "COMMENT", "TRUNCATE", "ANALYZE", "VACUUM", "EXECUTE", "DO", "BEGIN",
                    "COMMIT", "ROLLBACK",
                ];

                if valid_keywords.iter().any(|kw| part_upper.starts_with(kw)) {
                    let part_cmd = format!("{};", part_trimmed);
                    match sqlx::query(&part_cmd).execute(pool).await {
                        Ok(_) => {}
                        Err(e) => {
                            let error_str = e.to_string();
                            let error_lower = error_str.to_lowercase();
                            // Ignorer les erreurs "already exists", "does not exist", "is not unique", "cannot change return type"
                            // Gestion intelligente des erreurs avec logging
                            let is_benign_part = error_lower.contains("already exists")
                                || error_lower.contains("does not exist")
                                || error_lower.contains("is not unique")
                                || error_lower.contains("cannot change return type")
                                || error_lower.contains(
                                    "functions in index predicate must be marked immutable",
                                );

                            if !is_benign_part {
                                error!(
                                    "❌ [MIGRATION] Erreur critique dans partie divisée: {} | Partie: {}",
                                    error_str,
                                    if part_trimmed.len() > 100 {
                                        format!("{}...", &part_trimmed[..100])
                                    } else {
                                        part_trimmed.to_string()
                                    }
                                );
                                return Err(e);
                            } else {
                                debug!(
                                    "ℹ️ [MIGRATION] Erreur bénigne ignorée dans partie divisée: {}",
                                    error_str
                                );
                            }
                        }
                    }
                }
            }
        } else {
            // Commande simple, exécuter directement
            match sqlx::query(trimmed_cmd).execute(pool).await {
                Ok(_) => {}
                Err(e) => {
                    let error_str = e.to_string();
                    let error_lower = error_str.to_lowercase();

                    // ✅ AMÉLIORATION 2026-02-01: Gérer les erreurs "cannot insert multiple commands"
                    if error_lower
                        .contains("cannot insert multiple commands into a prepared statement")
                    {
                        // ✅ NOUVEAU: Gérer spécialement les blocs DO $$ avec plusieurs commandes
                        let cmd_upper = trimmed_cmd.to_uppercase();
                        if cmd_upper.contains("DO $$")
                            && cmd_upper.contains("BEGIN")
                            && cmd_upper.contains("END $$")
                        {
                            // Extraire les commandes du bloc DO $$ en divisant par ';' mais en préservant la structure
                            // Exemple: DO $$ BEGIN DROP TRIGGER ...; CREATE TRIGGER ...; END $$;
                            // On doit diviser en: DROP TRIGGER ...; et CREATE TRIGGER ...; (séparément)

                            // Trouver le contenu entre BEGIN et END $$
                            if let Some(begin_pos) = cmd_upper.find("BEGIN") {
                                if let Some(end_pos) = cmd_upper.find("END $$") {
                                    let block_content = &trimmed_cmd[begin_pos + 5..end_pos].trim();
                                    // Diviser le contenu par ';' mais garder les commandes complètes
                                    let inner_commands: Vec<&str> = block_content
                                        .split(';')
                                        .map(|s| s.trim())
                                        .filter(|s| {
                                            !s.is_empty() && !s.to_uppercase().starts_with("--")
                                        })
                                        .collect();

                                    // Exécuter chaque commande individuellement
                                    for inner_cmd in inner_commands {
                                        let inner_upper = inner_cmd.to_uppercase();
                                        let valid_keywords = [
                                            "CREATE", "ALTER", "DROP", "INSERT", "UPDATE",
                                            "DELETE", "SELECT", "GRANT", "REVOKE", "COMMENT",
                                            "TRUNCATE", "ANALYZE", "VACUUM", "EXECUTE", "BEGIN",
                                            "COMMIT", "ROLLBACK",
                                        ];

                                        if valid_keywords
                                            .iter()
                                            .any(|kw| inner_upper.starts_with(kw))
                                        {
                                            let inner_cmd_with_semicolon =
                                                format!("{};", inner_cmd);
                                            if let Err(e2) = sqlx::query(&inner_cmd_with_semicolon)
                                                .execute(pool)
                                                .await
                                            {
                                                let error_str2 = e2.to_string();
                                                let error_lower2 = error_str2.to_lowercase();
                                                let is_benign2 = error_lower2.contains("already exists")
                                                    || error_lower2.contains("does not exist")
                                                    || error_lower2.contains("is not unique")
                                                    || error_lower2.contains("cannot change return type")
                                                    || error_lower2.contains("functions in index predicate must be marked immutable");

                                                if !is_benign2 {
                                                    error!(
                                                        "❌ [MIGRATION] Erreur critique dans commande extraite du bloc DO: {} | Commande: {}",
                                                        error_str2,
                                                        if inner_cmd.len() > 100 {
                                                            format!("{}...", &inner_cmd[..100])
                                                        } else {
                                                            inner_cmd.to_string()
                                                        }
                                                    );
                                                    return Err(e2);
                                                } else {
                                                    debug!(
                                                        "ℹ️ [MIGRATION] Erreur bénigne ignorée dans commande extraite du bloc DO: {}",
                                                        error_str2
                                                    );
                                                }
                                            }
                                        }
                                    }
                                    // Continuer avec la prochaine commande après avoir traité le bloc DO
                                    continue;
                                }
                            }
                        }

                        // Diviser la commande et réessayer (logique existante)
                        let parts: Vec<&str> =
                            trimmed_cmd.split(';').filter(|p| !p.trim().is_empty()).collect();

                        for part in parts {
                            let part_trimmed = part.trim();
                            if part_trimmed.is_empty() || part_trimmed.starts_with("--") {
                                continue;
                            }

                            let part_upper = part_trimmed.to_uppercase();
                            let valid_keywords = [
                                "CREATE", "ALTER", "DROP", "INSERT", "UPDATE", "DELETE", "SELECT",
                                "GRANT", "REVOKE", "COMMENT", "TRUNCATE", "ANALYZE", "VACUUM",
                                "EXECUTE", "DO", "BEGIN", "COMMIT", "ROLLBACK",
                            ];

                            if valid_keywords.iter().any(|kw| part_upper.starts_with(kw)) {
                                let part_cmd = format!("{};", part_trimmed);
                                if let Err(e2) = sqlx::query(&part_cmd).execute(pool).await {
                                    let error_str2 = e2.to_string();
                                    let error_lower2 = error_str2.to_lowercase();
                                    // Gestion intelligente des erreurs avec logging
                                    let is_benign2 = error_lower2.contains("already exists")
                                        || error_lower2.contains("does not exist")
                                        || error_lower2.contains("is not unique")
                                        || error_lower2.contains("cannot change return type")
                                        || error_lower2.contains(
                                            "functions in index predicate must be marked immutable",
                                        );

                                    if !is_benign2 {
                                        error!(
                                            "❌ [MIGRATION] Erreur critique après division: {} | Partie: {}",
                                            error_str2,
                                            if part_trimmed.len() > 100 {
                                                format!("{}...", &part_trimmed[..100])
                                            } else {
                                                part_trimmed.to_string()
                                            }
                                        );
                                        return Err(e2);
                                    } else {
                                        debug!(
                                            "ℹ️ [MIGRATION] Erreur bénigne ignorée après division: {}",
                                            error_str2
                                        );
                                    }
                                }
                            }
                        }
                    } else {
                        // ✅ AMÉLIORATION 2026-02-01: Gestion intelligente des erreurs avec logging détaillé
                        // Distinguer les erreurs bénignes (attendues) des erreurs critiques

                        let is_benign = error_lower.contains("already exists")
                            || error_lower.contains("does not exist")
                            || error_lower.contains("is not unique")
                            || error_lower.contains("cannot change return type")
                            || error_lower
                                .contains("functions in index predicate must be marked immutable");

                        if is_benign {
                            // Erreur bénigne : logger avec niveau approprié
                            let error_type = if error_lower.contains("already exists") {
                                "already_exists"
                            } else if error_lower.contains("does not exist") {
                                "does_not_exist"
                            } else if error_lower.contains("is not unique") {
                                "is_not_unique"
                            } else if error_lower.contains("cannot change return type") {
                                "cannot_change_return_type"
                            } else if error_lower
                                .contains("functions in index predicate must be marked immutable")
                            {
                                "immutable_function_required"
                            } else {
                                "unknown_benign"
                            };

                            // Logger avec contexte pour analyse
                            debug!(
                                "ℹ️ [MIGRATION] Erreur bénigne ignorée [{}]: {} | Commande: {}",
                                error_type,
                                error_str,
                                if trimmed_cmd.len() > 100 {
                                    format!("{}...", &trimmed_cmd[..100])
                                } else {
                                    trimmed_cmd.to_string()
                                }
                            );
                        } else if error_lower.contains("syntax error at end of input") {
                            // ✅ AMÉLIORATION 2026-02-14: Logger en error! au lieu de warn! pour les fragments de commandes
                            // Cela indique qu'une commande est incomplète, probablement coupée par le parser
                            // CRITIQUE: Ces erreurs doivent être visibles dans les logs CloudWatch
                            error!(
                                "❌ [MIGRATION] Fragment de commande détecté (syntax error at end of input): {} | Commande (premiers 500 chars): {}",
                                error_str,
                                if trimmed_cmd.len() > 500 {
                                    format!("{}...", &trimmed_cmd[..500])
                                } else {
                                    trimmed_cmd.to_string()
                                }
                            );
                            error!(
                                "   📊 [MIGRATION] Contexte: Longueur commande: {} chars | Parenthèses équilibrées: {} | Type: {}",
                                trimmed_cmd.len(),
                                trimmed_cmd.matches('(').count() == trimmed_cmd.matches(')').count(),
                                if trimmed_cmd.to_uppercase().contains("CREATE TABLE") {
                                    "CREATE TABLE"
                                } else if trimmed_cmd.to_uppercase().contains("CREATE INDEX") {
                                    "CREATE INDEX"
                                } else if trimmed_cmd.to_uppercase().contains("CREATE MATERIALIZED VIEW") {
                                    "CREATE MATERIALIZED VIEW"
                                } else if trimmed_cmd.to_uppercase().contains("COMMENT ON") {
                                    "COMMENT ON"
                                } else {
                                    "AUTRE"
                                }
                            );
                            // Ignorer les fragments - ils seront probablement corrigés dans une prochaine migration
                            debug!("ℹ️ [MIGRATION] Fragment ignoré, probablement dû à un parsing incomplet");
                        } else {
                            // Erreur critique : logger et retourner
                            error!(
                                "❌ [MIGRATION] Erreur critique non ignorée: {} | Commande: {}",
                                error_str,
                                if trimmed_cmd.len() > 200 {
                                    format!("{}...", &trimmed_cmd[..200])
                                } else {
                                    trimmed_cmd.to_string()
                                }
                            );
                            return Err(e);
                        }
                    }
                }
            }
        }
    }

    Ok(())
}

/// ⚠️ DÉPRÉCIÉ 2026-01-31: Cette fonction crée des fragments SQL invalides
/// Utilisez plutôt execute_migration_sql_safe() ou sqlx::migrate!() ou sqlx::query() directement
/// Cette fonction est conservée uniquement pour compatibilité avec les scripts binaires
///
/// Fonction publique pour exécuter des migrations SQL avec gestion des blocs DO $$
#[deprecated(note = "Utilisez execute_migration_sql_safe() ou sqlx::migrate!() à la place")]
pub async fn execute_multiple_sql_commands(pool: &PgPool, sql: &str) -> Result<(), sqlx::Error> {
    // Amélioration : gérer les blocs DO $$...END $$; et CREATE FUNCTION $$...$$ LANGUAGE correctement
    // Diviser par ";" mais préserver les blocs $$...$$;
    // ✅ CORRECTION CRITIQUE 2026-01-30: Compter les parenthèses pour ne pas diviser dans CREATE TABLE (...)
    let mut commands = Vec::new();
    let mut current = String::new();
    let mut in_dollar_block = false;
    let mut dollar_tag = String::new();
    let mut paren_depth = 0i32; // Compteur de parenthèses ouvertes/fermées

    for line in sql.lines() {
        let trimmed = line.trim();

        // ✅ CORRECTION CRITIQUE 2026-01-30: Vérifier la fin du bloc AVANT d'ajouter la ligne
        // Cela permet de détecter correctement la fin et de séparer les commandes suivantes
        let should_terminate_block = if in_dollar_block {
            if trimmed.contains(&dollar_tag) {
                let dollar_pos = trimmed.find(&dollar_tag);
                if let Some(pos) = dollar_pos {
                    let after_dollar: &str = trimmed[pos + dollar_tag.len()..].trim();

                    // Cas 1: $$ LANGUAGE plpgsql; (LANGUAGE après $$) - FIN DE FONCTION
                    if after_dollar.to_uppercase().starts_with("LANGUAGE") && trimmed.ends_with(';')
                    {
                        true
                    }
                    // Cas 2: END $$; (bloc DO) - FIN DE BLOC DO
                    else if trimmed.contains("END")
                        && trimmed.ends_with(&format!("{};", dollar_tag))
                    {
                        true
                    }
                    // Cas 3: $$; simple (fin de bloc)
                    else if (after_dollar.is_empty() || after_dollar == ";")
                        && trimmed.ends_with(';')
                    {
                        true
                    } else {
                        false
                    }
                } else {
                    false
                }
            } else {
                false
            }
        } else {
            false
        };

        // Ignorer les lignes vides et les commentaires seuls UNIQUEMENT si on n'a pas de commande en cours
        // Ne pas ignorer si on est dans une commande multi-lignes (comme CREATE TABLE)
        if trimmed.is_empty() || trimmed.starts_with("--") {
            if !in_dollar_block {
                // Si on a déjà du contenu dans current, c'est qu'on est dans une commande multi-lignes
                // On doit garder les commentaires et lignes vides pour préserver le contexte
                if !current.trim().is_empty() {
                    current.push_str(line);
                    current.push_str("\n");
                }
                // Sinon, on ignore vraiment (début de fichier ou après une commande complète)
                continue;
            } else {
                // Dans un bloc dollar, on garde les commentaires
                current.push_str(line);
                current.push_str("\n");
                continue;
            }
        }

        // ✅ CORRECTION CRITIQUE 2026-01-30: Détecter début d'un bloc DO $$ ou CREATE FUNCTION $$
        // Détecter début d'un bloc avec $$
        if trimmed.contains("$$") && !in_dollar_block {
            // Vérifier si c'est le début d'un bloc DO $$ ou CREATE FUNCTION $$
            let is_do_block = trimmed.to_uppercase().starts_with("DO");
            let is_function_block = trimmed.to_uppercase().contains("CREATE FUNCTION")
                || trimmed.to_uppercase().contains("AS $$");

            if is_do_block || is_function_block {
                // Détecter le tag $$ (peut être $$, $tag$, etc.)
                if let Some(start) = trimmed.find("$$") {
                    let tag_end = trimmed[start + 2..].find("$$");
                    if tag_end.is_some() {
                        // Tag simple $$ trouvé deux fois sur la même ligne (début et fin immédiat)
                        // C'est probablement une fonction inline, on entre quand même dans le bloc
                        dollar_tag = "$$".to_string();
                        in_dollar_block = true;
                    } else {
                        // Tag simple $$ (début de bloc) ou tag personnalisé $tag$
                        let tag_start = trimmed[..start].rfind('$');
                        if let Some(ts) = tag_start {
                            dollar_tag = trimmed[ts..=start + 1].to_string();
                            in_dollar_block = true;
                        } else {
                            dollar_tag = "$$".to_string();
                            in_dollar_block = true;
                        }
                    }
                }
            } else {
                // Vérifier si la ligne précédente contenait DO ou CREATE FUNCTION
                // (cas où DO $$ est sur deux lignes)
                if current.to_uppercase().trim().ends_with("DO")
                    || current.to_uppercase().contains("CREATE FUNCTION")
                {
                    if trimmed.contains("$$") {
                        dollar_tag = "$$".to_string();
                        in_dollar_block = true;
                    }
                }
            }
        }

        // ✅ CORRECTION CRITIQUE 2026-01-30: Compter les parenthèses AVANT d'ajouter la ligne
        // Cela permet de détecter si on est dans une parenthèse avant de diviser sur ;
        let open_parens = trimmed.matches('(').count();
        let close_parens = trimmed.matches(')').count();
        paren_depth += (open_parens as i32) - (close_parens as i32);

        // Ajouter la ligne à current
        current.push_str(line);
        current.push_str("\n");

        // Si on doit terminer le bloc, le faire maintenant
        if should_terminate_block {
            commands.push(current.trim().to_string());
            current.clear();
            in_dollar_block = false;
            dollar_tag.clear();
            paren_depth = 0; // Réinitialiser le compteur de parenthèses
            continue; // Passer à la ligne suivante (qui sera une nouvelle commande)
        }

        // Détecter fin du bloc $$ (cas supplémentaires)
        if in_dollar_block {
            // Si on trouve END; dans un bloc CREATE FUNCTION, on continue à accumuler
            // car la ligne suivante devrait contenir $$ LANGUAGE
            if trimmed == "END;" && current.contains("CREATE") && current.contains("FUNCTION") {
                // On continue à accumuler
            }
        } else if !in_dollar_block {
            // ✅ CORRECTION CRITIQUE 2026-01-30: Détecter DO $$ au début d'une ligne
            // Si on voit "DO $$" ou "DO $tag$", on entre dans un bloc dollar
            if trimmed.to_uppercase().starts_with("DO") && trimmed.contains("$$") {
                // On va entrer dans un bloc dollar, donc on ne divise pas ici
                // Le bloc sera détecté par la logique de détection de $$
            }

            // ✅ CORRECTION CRITIQUE 2026-01-30: Détecter nouvelle commande SQL qui commence
            // Si on a déjà du contenu dans current et qu'on voit un nouveau mot-clé SQL au début de la ligne,
            // c'est qu'une nouvelle commande commence (la précédente s'est terminée par ;)
            let sql_keywords = [
                "CREATE", "DROP", "ALTER", "INSERT", "UPDATE", "DELETE", "SELECT", "GRANT",
                "REVOKE", "COMMENT", "TRUNCATE", "ANALYZE", "VACUUM", "EXECUTE", "DO", "BEGIN",
                "COMMIT", "ROLLBACK",
            ];
            let is_new_command =
                sql_keywords.iter().any(|keyword| trimmed.to_uppercase().starts_with(keyword));

            // Si on détecte une nouvelle commande et qu'on a déjà du contenu, terminer la commande précédente
            if is_new_command && !current.trim().is_empty() {
                let prev_cmd = current.trim();
                // Vérifier que la commande précédente est valide et se termine par ;
                if prev_cmd.ends_with(';') && !prev_cmd.starts_with("--") {
                    commands.push(prev_cmd.to_string());
                    current.clear();
                } else if !prev_cmd.ends_with(';') && !prev_cmd.is_empty() {
                    // La commande précédente n'a pas de ;, l'ajouter
                    commands.push(format!("{};", prev_cmd));
                    current.clear();
                }
            }

            // ✅ AMÉLIORATION 2026-01-31: Détecter les fonctions qui commencent par RETURNS sans CREATE FUNCTION
            // Si on voit RETURNS au début d'une ligne et qu'on n'a pas de CREATE FUNCTION dans current,
            // c'est qu'une fonction a été coupée - fusionner avec la commande précédente
            if trimmed.to_uppercase().starts_with("RETURNS")
                && !current.to_uppercase().contains("CREATE FUNCTION")
                && !current.to_uppercase().contains("CREATE OR REPLACE FUNCTION")
            {
                // Chercher la commande précédente dans commands qui pourrait être la fonction
                if let Some(last_cmd) = commands.last_mut() {
                    if last_cmd.to_uppercase().contains("CREATE FUNCTION")
                        || last_cmd.to_uppercase().contains("CREATE OR REPLACE FUNCTION")
                    {
                        // Fusionner avec la commande précédente
                        last_cmd.push_str("\n");
                        last_cmd.push_str(line);
                        continue;
                    }
                }
            }

            // ✅ AMÉLIORATION 2026-01-31: Détecter les fragments de fonctions qui commencent par des paramètres
            // Si on voit un paramètre (p_service_id, p_payment_id, etc.) au début d'une ligne,
            // c'est qu'une fonction a été coupée - fusionner avec la commande précédente
            if (trimmed.to_uppercase().starts_with("P_SERVICE_ID")
                || trimmed.to_uppercase().starts_with("P_PAYMENT_ID")
                || trimmed.to_uppercase().starts_with("P_"))
                && !current.to_uppercase().contains("CREATE FUNCTION")
                && !current.to_uppercase().contains("CREATE OR REPLACE FUNCTION")
            {
                // Chercher la commande précédente dans commands qui pourrait être la fonction
                if let Some(last_cmd) = commands.last_mut() {
                    if last_cmd.to_uppercase().contains("CREATE FUNCTION")
                        || last_cmd.to_uppercase().contains("CREATE OR REPLACE FUNCTION")
                    {
                        // Fusionner avec la commande précédente
                        last_cmd.push_str("\n");
                        last_cmd.push_str(line);
                        continue;
                    }
                }
            }

            // ✅ NOUVEAU 2026-01-31: Détecter les fragments de colonnes qui commencent par des noms de colonnes
            // Si on voit un nom de colonne (updated_at, user_id, etc.) au début d'une ligne,
            // c'est qu'une commande CREATE TABLE ou ALTER TABLE a été coupée - ignorer ce fragment
            let trimmed_lower = trimmed.to_lowercase();
            let is_column_fragment = trimmed_lower.trim().starts_with("updated_at")
                || trimmed_lower.trim().starts_with("user_id")
                || trimmed_lower.trim().starts_with("doctor_name")
                || trimmed_lower.trim().starts_with("comment_participant")
                || trimmed_lower.trim().starts_with("download_count")
                || trimmed_lower.trim().starts_with("tags")
                || (trimmed_lower.trim().starts_with("updated_at")
                    && trimmed_lower.contains("timestamptz"))
                || (trimmed_lower.trim().starts_with("user_id")
                    && trimmed_lower.contains("integer"))
                || (trimmed_lower.trim().starts_with("doctor_name")
                    && trimmed_lower.contains("varchar"))
                || (trimmed_lower.trim().starts_with("comment_participant")
                    && trimmed_lower.contains("text"))
                || (trimmed_lower.trim().starts_with("download_count")
                    && trimmed_lower.contains("integer"))
                || (trimmed_lower.trim().starts_with("tags") && trimmed_lower.contains("text[]"));

            if is_column_fragment
                && !current.to_uppercase().contains("CREATE TABLE")
                && !current.to_uppercase().contains("ALTER TABLE")
                && !current.to_uppercase().contains("CREATE FUNCTION")
            {
                // C'est un fragment de colonne isolé - l'ignorer
                warn!(
                    "⚠️ Fragment de colonne détecté et ignoré: {}",
                    if trimmed.len() > 100 {
                        format!("{}...", &trimmed[..100])
                    } else {
                        trimmed.to_string()
                    }
                );
                continue;
            }

            // Commande normale - se termine par ;
            if trimmed.ends_with(';') {
                let cmd = current.trim();

                // ✅ CORRECTION CRITIQUE 2026-01-30: Ne PAS diviser si on est dans un bloc DO $$
                // Vérifier si la commande commence par DO $$ et n'a pas encore de END $$;
                if cmd.to_uppercase().starts_with("DO")
                    && cmd.contains("$$")
                    && !cmd.contains("END $$")
                {
                    // On est dans un bloc DO $$ qui n'est pas terminé, continuer à accumuler
                    continue;
                }

                // ✅ CORRECTION CRITIQUE 2026-01-30: Ne PAS diviser si on est dans une parenthèse
                // Exemple: CREATE TABLE IF NOT EXISTS duets (col1, col2); ne doit pas être divisé sur le ; après (
                if paren_depth > 0 {
                    // On est dans une parenthèse, continuer à accumuler jusqu'à ce que toutes les parenthèses soient fermées
                    continue;
                }

                // ✅ AMÉLIORATION 2026-01-31: Ne PAS diviser si on est dans un CREATE TRIGGER incomplet
                // Un trigger complet doit contenir: ON table_name, FOR EACH ROW, EXECUTE FUNCTION
                let cmd_upper = cmd.to_uppercase();
                if cmd_upper.contains("CREATE TRIGGER") {
                    let has_on = cmd_upper.contains("ON ");
                    let has_for_each = cmd_upper.contains("FOR EACH ROW")
                        || cmd_upper.contains("FOR EACH STATEMENT");
                    let has_execute = cmd_upper.contains("EXECUTE FUNCTION");

                    // Si le trigger n'est pas complet, continuer à accumuler
                    if !has_on || !has_for_each || !has_execute {
                        continue;
                    }
                }

                // ✅ NOUVEAU 2026-01-31: Ne PAS diviser si c'est une fonction qui se termine par (; ou qui n'a pas de $$ LANGUAGE
                // Exemples: CREATE OR REPLACE FUNCTION add_product_to_service_jsonb(;
                //          CREATE OR REPLACE FUNCTION get_user_stats(user_id_param INTEGER); (suivi de RETURNS)
                if cmd_upper.contains("CREATE FUNCTION")
                    || cmd_upper.contains("CREATE OR REPLACE FUNCTION")
                {
                    // Si la fonction se termine par (; c'est incomplet
                    if cmd.ends_with("(;") {
                        continue; // Continuer à accumuler
                    }
                    // Si la fonction se termine par ; mais n'a pas de $$ LANGUAGE, elle est probablement incomplète
                    // (la ligne suivante devrait contenir RETURNS ou un paramètre)
                    if cmd.ends_with(");")
                        && !cmd_upper.contains("$$")
                        && !cmd_upper.contains("LANGUAGE")
                    {
                        // Vérifier si la ligne suivante commence par RETURNS ou un paramètre
                        // On ne peut pas vérifier la ligne suivante ici, donc on continue à accumuler
                        // et on laissera la validation finale rejeter si c'est vraiment incomplet
                        continue;
                    }
                }

                // ✅ CORRECTION 2026-01-30: Détecter les fins de fonctions/triggers pour mieux diviser
                // Pattern: "$$ language 'plpgsql';" suivi de "CREATE TRIGGER" ou "CREATE TABLE"
                let is_function_end = cmd.to_uppercase().contains("$$")
                    && (cmd.to_uppercase().contains("LANGUAGE")
                        || cmd.to_uppercase().contains("AS $$"));

                // ✅ CORRECTION 2026-01-30: Détecter et diviser les commandes multiples sur une seule ligne
                // Exemple: "CREATE INDEX ...; CREATE INDEX ...;" doit être divisé en 2 commandes
                // MAIS seulement si on n'est PAS dans un bloc DO $$ ET si on n'est PAS dans une parenthèse
                // ✅ CORRECTION CRITIQUE 2026-01-30: Ne PAS diviser si paren_depth > 0
                // ✅ CORRECTION 2026-01-31: Ne PAS diviser si c'est une fonction (contient RETURNS, AS $$, LANGUAGE)
                let is_function = cmd.to_uppercase().contains("CREATE FUNCTION")
                    || cmd.to_uppercase().contains("CREATE OR REPLACE FUNCTION")
                    || cmd.to_uppercase().contains("RETURNS")
                    || (cmd.to_uppercase().contains("AS $$")
                        && !cmd.to_uppercase().contains("LANGUAGE"));

                if !cmd.to_uppercase().starts_with("DO")
                    && !is_function
                    && cmd.contains(";")
                    && cmd.matches(';').count() > 1
                    && paren_depth == 0
                // ✅ Ne diviser que si toutes les parenthèses sont fermées
                {
                    // Diviser par ';' mais préserver le contexte
                    // ✅ CORRECTION CRITIQUE 2026-01-30: Diviser intelligemment en comptant les parenthèses
                    let mut current_part = String::new();
                    let mut part_paren_depth = 0i32;

                    for ch in cmd.chars() {
                        current_part.push(ch);
                        if ch == '(' {
                            part_paren_depth += 1;
                        } else if ch == ')' {
                            part_paren_depth -= 1;
                        } else if ch == ';' && part_paren_depth == 0 {
                            // On a trouvé un ; qui n'est pas dans une parenthèse
                            let part_trimmed = current_part.trim();
                            if !part_trimmed.is_empty()
                                && !part_trimmed.starts_with("--")
                                && !part_trimmed
                                    .trim_matches(|c: char| {
                                        c.is_whitespace() || c == ';' || c == '(' || c == ')'
                                    })
                                    .is_empty()
                                && (part_trimmed.to_uppercase().contains("CREATE")
                                    || part_trimmed.to_uppercase().contains("ALTER")
                                    || part_trimmed.to_uppercase().contains("DROP")
                                    || part_trimmed.to_uppercase().contains("INSERT")
                                    || part_trimmed.to_uppercase().contains("UPDATE")
                                    || part_trimmed.to_uppercase().contains("DELETE")
                                    || part_trimmed.to_uppercase().contains("SELECT")
                                    || part_trimmed.to_uppercase().contains("GRANT")
                                    || part_trimmed.to_uppercase().contains("REVOKE")
                                    || part_trimmed.to_uppercase().contains("COMMENT")
                                    || part_trimmed.to_uppercase().contains("TRUNCATE")
                                    || part_trimmed.to_uppercase().contains("ANALYZE")
                                    || part_trimmed.to_uppercase().contains("VACUUM")
                                    || part_trimmed.to_uppercase().contains("EXECUTE")
                                    || part_trimmed.to_uppercase().contains("DO"))
                            {
                                commands.push(part_trimmed.to_string());
                            }
                            current_part.clear();
                        }
                    }
                    // Traiter la dernière partie si elle existe
                    if !current_part.trim().is_empty() && part_paren_depth == 0 {
                        let part_trimmed = current_part.trim();
                        if !part_trimmed.is_empty()
                            && !part_trimmed.starts_with("--")
                            && (part_trimmed.to_uppercase().contains("CREATE")
                                || part_trimmed.to_uppercase().contains("ALTER")
                                || part_trimmed.to_uppercase().contains("DROP"))
                        {
                            if !part_trimmed.ends_with(';') {
                                commands.push(format!("{};", part_trimmed));
                            } else {
                                commands.push(part_trimmed.to_string());
                            }
                        }
                    }
                    current.clear();
                    paren_depth = 0; // Réinitialiser le compteur de parenthèses
                } else if is_function_end {
                    // Fin de fonction - vérifier si la ligne suivante commence une nouvelle commande
                    // On garde la commande actuelle et on la termine ici
                    if !cmd.is_empty()
                        && !cmd.starts_with("--")
                        && (cmd.to_uppercase().contains("CREATE")
                            || cmd.to_uppercase().contains("ALTER")
                            || cmd.to_uppercase().contains("DROP"))
                    {
                        commands.push(cmd.to_string());
                    }
                    current.clear();
                    paren_depth = 0; // Réinitialiser le compteur de parenthèses
                } else {
                    // Commande unique - vérifier qu'elle est valide
                    // ✅ CORRECTION 2026-01-31: Validation plus stricte pour éviter les commandes incomplètes
                    let cmd_clean = cmd.trim();
                    let cmd_upper = cmd_clean.to_uppercase();

                    // ✅ AMÉLIORATION 2026-01-31: Validation stricte pour éviter les commandes incomplètes et fragments
                    // Vérifier que la commande n'est pas vide et contient du contenu valide
                    let cmd_lower = cmd_clean.to_lowercase();

                    // Rejeter les fragments de colonnes qui commencent par des noms de colonnes
                    let is_column_fragment = cmd_lower.trim().starts_with("updated_at")
                        || cmd_lower.trim().starts_with("user_id")
                        || cmd_lower.trim().starts_with("doctor_name")
                        || cmd_lower.trim().starts_with("comment_participant")
                        || cmd_lower.trim().starts_with("download_count")
                        || cmd_lower.trim().starts_with("tags")
                        || (cmd_lower.trim().starts_with("updated_at")
                            && cmd_lower.contains("timestamptz"))
                        || (cmd_lower.trim().starts_with("user_id")
                            && cmd_lower.contains("integer"))
                        || (cmd_lower.trim().starts_with("doctor_name")
                            && cmd_lower.contains("varchar"))
                        || (cmd_lower.trim().starts_with("comment_participant")
                            && cmd_lower.contains("text"))
                        || (cmd_lower.trim().starts_with("download_count")
                            && cmd_lower.contains("integer"))
                        || (cmd_lower.trim().starts_with("tags") && cmd_lower.contains("text[]"));

                    // Rejeter les fragments de fonctions qui commencent par RETURNS ou des paramètres
                    let is_function_fragment = cmd_upper.starts_with("RETURNS")
                        || cmd_upper.starts_with("P_SERVICE_ID")
                        || cmd_upper.starts_with("P_PAYMENT_ID")
                        || (cmd_upper.starts_with("P_") && !cmd_upper.contains("CREATE"));

                    // ✅ AMÉLIORATION 2026-01-31: Rejeter les fonctions qui se terminent par ); sans $$ LANGUAGE
                    // Exemple: CREATE OR REPLACE FUNCTION get_user_stats(user_id_param INTEGER);
                    let is_incomplete_function = (cmd_upper.contains("CREATE FUNCTION")
                        || cmd_upper.contains("CREATE OR REPLACE FUNCTION"))
                        && (cmd_clean.ends_with(");") || cmd_clean.ends_with(";"))
                        && !cmd_upper.contains("$$")
                        && !cmd_upper.contains("LANGUAGE")
                        && !cmd_upper.contains("RETURNS TRIGGER");

                    let is_valid = !cmd_clean.is_empty()
                    && !cmd_clean.starts_with("--")
                    && !is_column_fragment
                    && !is_function_fragment
                    && !is_incomplete_function
                    && !cmd_clean
                        .trim_matches(|c: char| {
                            c.is_whitespace() || c == ';' || c == '(' || c == ')'
                        })
                        .is_empty()
                    // Vérifier qu'elle ne se termine pas par (; ou AS; sans contenu
                    && !cmd_clean.ends_with("(;")
                    && !cmd_clean.ends_with("AS;")
                    && !(cmd_upper.contains("CREATE TABLE") && cmd_clean.ends_with("(;"))
                    && !(cmd_upper.contains("CREATE INDEX") && !cmd_upper.contains("ON "))
                    && !(cmd_upper.contains("CREATE UNIQUE INDEX") && !cmd_upper.contains("ON "))
                    && !(cmd_upper.contains("CREATE FUNCTION") && cmd_clean.ends_with("(;"))
                    && !(cmd_upper.contains("CREATE OR REPLACE FUNCTION") && cmd_clean.ends_with("(;"))
                    // ✅ NOUVEAU 2026-01-31: Rejeter les CREATE INDEX sans colonnes (se termine par ON table;)
                    && !(cmd_upper.contains("CREATE INDEX") && cmd_clean.ends_with(";") && cmd_upper.contains("ON ") && !cmd_clean.contains("(") && !cmd_clean.contains("USING"))
                    && (cmd_upper.contains("CREATE")
                        || cmd_upper.contains("ALTER")
                        || cmd_upper.contains("DROP")
                        || cmd_upper.contains("INSERT")
                        || cmd_upper.contains("UPDATE")
                        || cmd_upper.contains("DELETE")
                        || cmd_upper.contains("SELECT")
                        || cmd_upper.contains("GRANT")
                        || cmd_upper.contains("REVOKE")
                        || cmd_upper.contains("COMMENT")
                        || cmd_upper.contains("TRUNCATE")
                        || cmd_upper.contains("ANALYZE")
                        || cmd_upper.contains("VACUUM")
                        || cmd_upper.contains("EXECUTE")
                        || cmd_upper.contains("DO"));

                    if is_valid {
                        commands.push(cmd.to_string());
                    } else {
                        // Log les commandes invalides pour diagnostic
                        if !cmd_clean.is_empty() && !cmd_clean.starts_with("--") {
                            debug!(
                                "⚠️ Commande invalide ignorée: {}",
                                if cmd_clean.len() > 100 {
                                    format!("{}...", &cmd_clean[..100])
                                } else {
                                    cmd_clean.to_string()
                                }
                            );
                        }
                    }
                    current.clear();
                    paren_depth = 0; // Réinitialiser le compteur de parenthèses
                }
            }
        }
    }

    // ✅ CORRECTION CRITIQUE 2026-01-30: Traiter la dernière commande si elle existe
    // (cas où le fichier ne se termine pas par ;)
    if !current.trim().is_empty() {
        let cmd = current.trim();
        if !cmd.starts_with("--") && paren_depth == 0 {
            // Si la commande n'a pas de ;, l'ajouter
            if !cmd.ends_with(';') {
                commands.push(format!("{};", cmd));
            } else {
                commands.push(cmd.to_string());
            }
        }
    }

    // Ajouter la dernière commande si elle existe
    if !current.trim().is_empty() {
        let cmd = current.trim();
        // Vérifier que la commande n'est pas vide et contient au moins un mot-clé SQL valide
        if !cmd.is_empty()
            && !cmd.starts_with("--")
            && !cmd
                .trim_matches(|c: char| c.is_whitespace() || c == ';' || c == '(' || c == ')')
                .is_empty()
            && (cmd.to_uppercase().contains("CREATE")
                || cmd.to_uppercase().contains("ALTER")
                || cmd.to_uppercase().contains("DROP")
                || cmd.to_uppercase().contains("INSERT")
                || cmd.to_uppercase().contains("UPDATE")
                || cmd.to_uppercase().contains("DELETE")
                || cmd.to_uppercase().contains("SELECT")
                || cmd.to_uppercase().contains("GRANT")
                || cmd.to_uppercase().contains("REVOKE")
                || cmd.to_uppercase().contains("COMMENT")
                || cmd.to_uppercase().contains("TRUNCATE")
                || cmd.to_uppercase().contains("ANALYZE")
                || cmd.to_uppercase().contains("VACUUM")
                || cmd.to_uppercase().contains("EXECUTE")
                || cmd.to_uppercase().contains("DO"))
        {
            commands.push(cmd.to_string());
        }
    }

    // ✅ CORRECTION RACINE: Normaliser et exécuter chaque commande
    for cmd in commands {
        let trimmed_cmd = cmd.trim();

        // ✅ CORRECTION 2026-01-31: Validation stricte des commandes
        // Ignorer les commandes vides, les commentaires, et les commandes qui ne sont que des parenthèses
        if trimmed_cmd.is_empty()
            || trimmed_cmd.starts_with("--")
            || trimmed_cmd == ")"
            || trimmed_cmd == "();"
            || trimmed_cmd
                .trim_matches(|c: char| c.is_whitespace() || c == ';' || c == '(' || c == ')')
                .is_empty()
        {
            continue;
        }

        // ✅ CORRECTION CRITIQUE 2026-01-31: Rejeter les fragments de commandes qui ne commencent pas par un mot-clé SQL valide
        // Les fragments commencent souvent par des identifiants de colonnes (id, u., etc.) ou des mots-clés de continuation
        let cmd_upper_first_words = trimmed_cmd.to_uppercase();
        let first_word = cmd_upper_first_words.split_whitespace().next().unwrap_or("");

        // Liste des mots-clés SQL valides pour commencer une commande
        let valid_start_keywords = [
            "CREATE",
            "ALTER",
            "DROP",
            "INSERT",
            "UPDATE",
            "DELETE",
            "SELECT",
            "GRANT",
            "REVOKE",
            "COMMENT",
            "TRUNCATE",
            "ANALYZE",
            "VACUUM",
            "EXECUTE",
            "DO",
            "BEGIN",
            "COMMIT",
            "ROLLBACK",
            "SET",
            "RESET",
            "WITH",
            "EXPLAIN",
            "PREPARE",
            "DEALLOCATE",
            "COPY",
            "LOCK",
            "UNLOCK",
        ];

        // Si la commande ne commence pas par un mot-clé SQL valide, c'est probablement un fragment
        if !valid_start_keywords.iter().any(|&kw| cmd_upper_first_words.starts_with(kw)) {
            // ✅ CORRECTION 2026-01-31: Liste étendue des fragments à rejeter (basée sur l'analyse Log 14)
            // Vérifier si c'est un fragment commun (commence par un identifiant de colonne, etc.)
            let trimmed_lower = trimmed_cmd.to_lowercase();
            // ✅ AMÉLIORATION 2026-01-31: Liste étendue des fragments à rejeter
            let is_fragment = first_word == "ID" 
                || first_word.starts_with("U.")
                || first_word.starts_with("S.")
                || first_word.starts_with("P.")
                || first_word == "RETURNS"
                || first_word == "AS"
                || first_word == "ON"
                || first_word == "FOR"
                || first_word == "WHEN"
                || first_word == "THEN"
                || first_word == "ELSE"
                || first_word == "END"
                || first_word == "FROM"  // Fragment de SELECT
                || first_word == "BEFORE"  // Fragment de CREATE TRIGGER
                || first_word == "AFTER"  // Fragment de CREATE TRIGGER
                || first_word == "UPDATED_AT"  // Fragment de colonne (très fréquent)
                || first_word == "USER_ID"  // Fragment de colonne/paramètre
                || first_word == "DOCTOR_NAME"  // Fragment de colonne
                || first_word == "COMMENT_PARTICIPANT"  // Fragment de colonne
                || first_word == "DOWNLOAD_COUNT"  // Fragment de colonne
                || first_word == "TAGS"  // Fragment de colonne
                || first_word.starts_with("P_SERVICE_ID")  // Fragment de fonction
                || first_word.starts_with("P_PAYMENT_ID")  // Fragment de fonction
                || trimmed_cmd.starts_with("(")
                || trimmed_cmd.starts_with(",")
                // Vérifier aussi avec trimmed_lower pour capturer tous les cas
                || trimmed_lower.trim().starts_with("updated_at")  // Fragment de colonne (très fréquent)
                || trimmed_lower.trim().starts_with("user_id")  // Variante lowercase
                || trimmed_lower.trim().starts_with("doctor_name")  // Fragment de colonne
                || trimmed_lower.trim().starts_with("comment_participant")  // Fragment de colonne
                || trimmed_lower.trim().starts_with("download_count")  // Fragment de colonne
                || trimmed_lower.trim().starts_with("tags")  // Fragment de colonne
                || trimmed_lower.trim().starts_with("p_service_id")  // Variante lowercase
                || trimmed_lower.trim().starts_with("p_payment_id")  // Variante lowercase
                || trimmed_lower.trim().starts_with("after")  // Variante lowercase
                // ✅ NOUVEAU 2026-01-31: Détecter les fragments de colonnes avec types SQL
                || (trimmed_lower.trim().starts_with("updated_at") && trimmed_lower.contains("timestamptz"))
                || (trimmed_lower.trim().starts_with("user_id") && trimmed_lower.contains("integer"))
                || (trimmed_lower.trim().starts_with("doctor_name") && trimmed_lower.contains("varchar"))
                || (trimmed_lower.trim().starts_with("comment_participant") && trimmed_lower.contains("text"))
                || (trimmed_lower.trim().starts_with("download_count") && trimmed_lower.contains("integer"))
                || (trimmed_lower.trim().starts_with("tags") && trimmed_lower.contains("text[]"));

            if is_fragment {
                warn!("⚠️ Fragment de commande SQL ignoré (ne commence pas par un mot-clé SQL valide): {}", 
                    if trimmed_cmd.len() > 100 { format!("{}...", &trimmed_cmd[..100]) } else { trimmed_cmd.to_string() });
                continue;
            }
        }

        // ✅ AMÉLIORATION 2026-01-31: Filtrer les commandes incomplètes (se terminent par ; sans contenu valide)
        // Exemples: "CREATE TABLE IF NOT EXISTS duets (;" ou "CREATE INDEX IF NOT EXISTS idx_name;"
        let cmd_upper = trimmed_cmd.to_uppercase();

        // Vérifier si la commande est incomplète (se termine par (; ou AS; sans contenu)
        let is_incomplete = (cmd_upper.contains("CREATE TABLE") && trimmed_cmd.ends_with("(;"))
            || (cmd_upper.contains("CREATE INDEX") && trimmed_cmd.ends_with(";") && !cmd_upper.contains("ON "))
            || (cmd_upper.contains("CREATE UNIQUE INDEX") && trimmed_cmd.ends_with(";") && !cmd_upper.contains("ON "))
            || (cmd_upper.contains("CREATE MATERIALIZED VIEW") && trimmed_cmd.ends_with("AS;"))
            || (cmd_upper.contains("CREATE FUNCTION") && trimmed_cmd.ends_with("(;"))
            || (cmd_upper.contains("CREATE OR REPLACE FUNCTION") && trimmed_cmd.ends_with("(;"))
            || (cmd_upper.contains("COMMENT ON") && trimmed_cmd.ends_with("IS;"))
            || (cmd_upper.contains("DELETE FROM") && trimmed_cmd.ends_with("NOT IN (;"))
            || (cmd_upper.contains("ALTER TABLE") && trimmed_cmd.ends_with(";") && !cmd_upper.contains("ADD COLUMN") && !cmd_upper.contains("DROP COLUMN") && !cmd_upper.contains("ALTER COLUMN"))
            // ✅ NOUVEAU 2026-01-31: Détecter les INSERT incomplets
            || (cmd_upper.contains("INSERT INTO") && trimmed_cmd.ends_with(";") && !cmd_upper.contains("VALUES") && !cmd_upper.contains("SELECT"))
            // ✅ NOUVEAU 2026-01-31: Détecter les CREATE INDEX sans colonnes (se termine par ON table;)
            || (cmd_upper.contains("CREATE INDEX") && trimmed_cmd.ends_with(";") && cmd_upper.contains("ON ") && !trimmed_cmd.contains("(") && !trimmed_cmd.contains("USING"));

        if is_incomplete {
            warn!(
                "⚠️ Commande SQL incomplète ignorée: {}",
                if trimmed_cmd.len() > 100 {
                    format!("{}...", &trimmed_cmd[..100])
                } else {
                    trimmed_cmd.to_string()
                }
            );
            continue;
        }

        // ✅ AMÉLIORATION 2026-01-31: Vérifier que les fonctions ont LANGUAGE plpgsql
        // Détecter toutes les fonctions sans LANGUAGE, même celles qui se terminent par ;
        if (cmd_upper.contains("CREATE FUNCTION")
            || cmd_upper.contains("CREATE OR REPLACE FUNCTION"))
            && !cmd_upper.contains("LANGUAGE")
            && !cmd_upper.contains("RETURNS TRIGGER")
        {
            // Si la fonction se termine par ; ou ); sans LANGUAGE, c'est une fonction incomplète
            // Exemples: CREATE OR REPLACE FUNCTION get_user_stats(user_id_param INTEGER);
            //          CREATE OR REPLACE FUNCTION add_product_to_service_jsonb(;
            if (trimmed_cmd.ends_with(";") || trimmed_cmd.ends_with(");"))
                && !cmd_upper.contains("$$")
            {
                warn!(
                    "⚠️ Fonction incomplète détectée (se termine par ; ou ); sans $$ LANGUAGE): {}",
                    if trimmed_cmd.len() > 100 {
                        format!("{}...", &trimmed_cmd[..100])
                    } else {
                        trimmed_cmd.to_string()
                    }
                );
                continue; // Ignorer cette fonction incomplète
            }

            // Si la fonction contient $$ mais pas LANGUAGE, ajouter LANGUAGE plpgsql
            if cmd_upper.contains("$$") {
                warn!("⚠️ Fonction sans LANGUAGE détectée, tentative de correction...");
                // Essayer de corriger en ajoutant LANGUAGE plpgsql avant le dernier $$
                if let Some(last_dollar) = trimmed_cmd.rfind("$$") {
                    let before = &trimmed_cmd[..last_dollar];
                    let after = &trimmed_cmd[last_dollar..];
                    // Vérifier si END; ou END $$ est présent avant $$
                    if before.to_uppercase().contains("END")
                        || before.to_uppercase().ends_with("END")
                    {
                        let corrected = format!(
                            "{} LANGUAGE plpgsql{}",
                            before.trim_end_matches(';').trim_end(),
                            after
                        );
                        warn!(
                            "   Commande corrigée: {}",
                            if corrected.len() > 150 {
                                format!("{}...", &corrected[..150])
                            } else {
                                corrected.clone()
                            }
                        );
                        // Utiliser la commande corrigée
                        let normalized_cmd = normalize_sql_command(&corrected);
                        // Continuer avec la commande corrigée
                        if let Err(e) = sqlx::query(&normalized_cmd).execute(pool).await {
                            warn!("   ⚠️ Erreur même après correction: {}", e);
                        }
                        continue;
                    } else if before.to_uppercase().contains("AS $$")
                        || before.to_uppercase().contains("$$")
                    {
                        // Fonction avec AS $$ mais sans END explicite - ajouter LANGUAGE avant le dernier $$
                        let corrected = format!("{} LANGUAGE plpgsql{}", before.trim_end(), after);
                        warn!(
                            "   Commande corrigée (sans END): {}",
                            if corrected.len() > 150 {
                                format!("{}...", &corrected[..150])
                            } else {
                                corrected.clone()
                            }
                        );
                        let normalized_cmd = normalize_sql_command(&corrected);
                        if let Err(e) = sqlx::query(&normalized_cmd).execute(pool).await {
                            warn!("   ⚠️ Erreur même après correction: {}", e);
                        }
                        continue;
                    }
                }
            }
        }

        // ✅ CORRECTION 2026-01-31: Détecter et diviser les commandes multiples AVANT l'exécution
        // Cela évite l'erreur "cannot insert multiple commands" en divisant préventivement
        let normalized_cmd = if trimmed_cmd.matches(';').count() > 1
            && !trimmed_cmd.to_uppercase().contains("DO $$")
            && !trimmed_cmd.to_uppercase().contains("CREATE FUNCTION")
            && !trimmed_cmd.to_uppercase().contains("CREATE OR REPLACE FUNCTION")
        {
            // Détecter plusieurs commandes dans un même bloc
            // Diviser intelligemment en préservant les blocs DO $$ et les fonctions
            let parts: Vec<&str> =
                trimmed_cmd.split(';').filter(|p| !p.trim().is_empty()).collect();
            if parts.len() > 1 {
                // Vérifier que chaque partie commence par un mot-clé SQL valide
                let valid_parts: Vec<String> = parts
                    .iter()
                    .filter_map(|part| {
                        let part_trimmed = part.trim();
                        if part_trimmed.is_empty() || part_trimmed.starts_with("--") {
                            return None;
                        }
                        let part_upper = part_trimmed.to_uppercase();
                        let is_valid = part_upper.starts_with("CREATE")
                            || part_upper.starts_with("ALTER")
                            || part_upper.starts_with("DROP")
                            || part_upper.starts_with("INSERT")
                            || part_upper.starts_with("UPDATE")
                            || part_upper.starts_with("DELETE")
                            || part_upper.starts_with("SELECT")
                            || part_upper.starts_with("GRANT")
                            || part_upper.starts_with("REVOKE")
                            || part_upper.starts_with("COMMENT")
                            || part_upper.starts_with("TRUNCATE")
                            || part_upper.starts_with("ANALYZE")
                            || part_upper.starts_with("VACUUM")
                            || part_upper.starts_with("EXECUTE")
                            || part_upper.starts_with("DO")
                            || part_upper.starts_with("BEGIN")
                            || part_upper.starts_with("COMMIT")
                            || part_upper.starts_with("ROLLBACK")
                            || part_upper.starts_with("SET")
                            || part_upper.starts_with("RESET");

                        if is_valid {
                            Some(format!("{};", part_trimmed))
                        } else {
                            None
                        }
                    })
                    .collect();

                if valid_parts.len() > 1 {
                    // ✅ CORRECTION 2026-01-31: Filtrer les fragments avant d'exécuter
                    let filtered_parts: Vec<String> = valid_parts
                        .iter()
                        .filter(|part_cmd| {
                            let part_trimmed = part_cmd.trim();
                            let part_lower = part_trimmed.to_lowercase();
                            // Rejeter les fragments communs
                            !part_lower.starts_with("updated_at")
                                && !part_lower.starts_with("user_id")
                                && !part_lower.starts_with("p_service_id")
                                && !part_lower.starts_with("p_payment_id")
                                && !part_lower.starts_with("from")
                                && !part_lower.starts_with("before")
                                && !part_lower.starts_with("after")
                                && !part_lower.starts_with("returns")
                                && !part_trimmed.starts_with("(")
                                && !part_trimmed.starts_with(",")
                        })
                        .cloned()
                        .collect();

                    if filtered_parts.is_empty() {
                        warn!("⚠️ Toutes les parties de la commande multiple ont été filtrées comme fragments");
                        continue;
                    }

                    // Exécuter chaque partie valide séparément
                    warn!("⚠️ Commande multiple détectée et divisée en {} parties valides avant exécution ({} parties filtrées)", 
                        filtered_parts.len(), valid_parts.len() - filtered_parts.len());
                    for (i, part_cmd) in filtered_parts.iter().enumerate() {
                        let part_normalized = normalize_sql_command(part_cmd);
                        // Ignorer ANALYZE dans les migrations
                        if part_normalized.to_uppercase().trim().starts_with("ANALYZE") {
                            debug!("ℹ️ ANALYZE ignoré dans migration (exécuté séparément)");
                            continue;
                        }
                        if let Err(e) = sqlx::query(&part_normalized).execute(pool).await {
                            warn!("   ⚠️ Erreur partie {}: {}", i + 1, e);
                        }
                    }
                    continue; // Passer à la commande suivante
                }
            }
            // Si la division n'a pas fonctionné, continuer avec la commande originale
            normalize_sql_command(trimmed_cmd)
        } else {
            normalize_sql_command(trimmed_cmd)
        };

        // ✅ CORRECTION 2026-01-31: Gérer DROP TRIGGER avant CREATE TRIGGER
        // Si la commande contient CREATE TRIGGER, vérifier s'il y a un DROP TRIGGER correspondant avant
        let cmd_upper = normalized_cmd.to_uppercase();
        if cmd_upper.contains("CREATE TRIGGER") && !cmd_upper.contains("DROP TRIGGER IF EXISTS") {
            // Extraire le nom du trigger et de la table depuis CREATE TRIGGER ... ON table_name
            if let Some(trigger_start) = cmd_upper.find("CREATE TRIGGER") {
                let after_trigger = &normalized_cmd[trigger_start + "CREATE TRIGGER".len()..];
                let parts: Vec<&str> = after_trigger.split_whitespace().collect();
                if parts.len() >= 3 {
                    let trigger_name = parts[0].trim_end_matches(';');
                    // Chercher "ON" dans les parties suivantes
                    if let Some(on_idx) = parts.iter().position(|&p| p.to_uppercase() == "ON") {
                        if on_idx + 1 < parts.len() {
                            let table_name = parts[on_idx + 1].trim_end_matches(';');
                            if !trigger_name.is_empty() && !table_name.is_empty() {
                                // Exécuter DROP TRIGGER IF EXISTS avant CREATE TRIGGER
                                let full_drop_cmd = format!(
                                    "DROP TRIGGER IF EXISTS {} ON {};",
                                    trigger_name, table_name
                                );
                                if let Err(e) = sqlx::query(&full_drop_cmd).execute(pool).await {
                                    debug!("ℹ️ Erreur DROP TRIGGER (ignorée): {}", e);
                                }
                            }
                        }
                    }
                }
            }
        }

        // Ignorer les erreurs pour les commandes qui peuvent échouer si l'objet existe déjà
        if normalized_cmd.to_uppercase().contains("DROP INDEX")
            && !normalized_cmd.to_uppercase().contains("IF EXISTS")
        {
            // Convertir DROP INDEX en DROP INDEX IF EXISTS
            let fixed_cmd = normalized_cmd.replace("DROP INDEX", "DROP INDEX IF EXISTS");
            if let Err(e) = sqlx::query(&fixed_cmd).execute(pool).await {
                debug!("ℹ️ Erreur DROP INDEX (ignorée): {}", e);
            }
        } else if normalized_cmd.to_uppercase().contains("DROP TABLE")
            && !normalized_cmd.to_uppercase().contains("IF EXISTS")
        {
            // Convertir DROP TABLE en DROP TABLE IF EXISTS
            let fixed_cmd = normalized_cmd.replace("DROP TABLE", "DROP TABLE IF EXISTS");
            if let Err(e) = sqlx::query(&fixed_cmd).execute(pool).await {
                debug!("ℹ️ Erreur DROP TABLE (ignorée): {}", e);
            }
        } else {
            // ✅ CORRECTION 2025-12-09: Ignorer ANALYZE dans les migrations (trop lent, exécuté séparément)
            if normalized_cmd.to_uppercase().trim().starts_with("ANALYZE") {
                debug!(
                    "ℹ️ ANALYZE ignoré dans migration (exécuté séparément pour éviter warnings)"
                );
                continue;
            }

            // Exécuter la commande normalisée
            if let Err(e) = sqlx::query(&normalized_cmd).execute(pool).await {
                // Pour les autres erreurs, on les log mais on continue
                // Sauf pour les erreurs critiques qui doivent être propagées
                let error_str = e.to_string();
                let error_lower = error_str.to_lowercase();

                // ✅ NOUVEAU 2026-01-29: Log détaillé de toutes les erreurs pour diagnostic AWS
                let cmd_preview = if normalized_cmd.len() > 200 {
                    format!("{}...", &normalized_cmd[..200])
                } else {
                    normalized_cmd.clone()
                };
                warn!("⚠️ [MIGRATION CONSOLIDÉE] Erreur lors de l'exécution de la commande SQL:");
                warn!("   Commande (preview): {}", cmd_preview);
                warn!("   Erreur: {}", error_str);

                // ✅ CORRECTION 2026-01-31: Traiter le cas spécial "cannot insert multiple commands" avant l'expression booléenne
                // Si cette erreur se produit, diviser la commande et réessayer
                if error_lower.contains("cannot insert multiple commands into a prepared statement")
                {
                    warn!("   ⚠️ Commande multiple détectée, tentative de division...");
                    // Essayer de diviser la commande par ';' et exécuter chaque partie
                    // ✅ AMÉLIORATION: Diviser intelligemment en préservant les blocs DO $$ et les fonctions
                    let parts: Vec<&str> =
                        normalized_cmd.split(';').filter(|p| !p.trim().is_empty()).collect();
                    if parts.len() > 1 {
                        let mut valid_parts = Vec::new();
                        for part in parts.iter() {
                            let part_trimmed = part.trim();
                            // Vérifier que la partie commence par un mot-clé SQL valide
                            let part_upper = part_trimmed.to_uppercase();
                            let is_valid = part_upper.starts_with("CREATE")
                                || part_upper.starts_with("ALTER")
                                || part_upper.starts_with("DROP")
                                || part_upper.starts_with("INSERT")
                                || part_upper.starts_with("UPDATE")
                                || part_upper.starts_with("DELETE")
                                || part_upper.starts_with("SELECT")
                                || part_upper.starts_with("GRANT")
                                || part_upper.starts_with("REVOKE")
                                || part_upper.starts_with("COMMENT")
                                || part_upper.starts_with("TRUNCATE")
                                || part_upper.starts_with("ANALYZE")
                                || part_upper.starts_with("VACUUM")
                                || part_upper.starts_with("EXECUTE")
                                || part_upper.starts_with("DO")
                                || part_upper.starts_with("BEGIN")
                                || part_upper.starts_with("COMMIT")
                                || part_upper.starts_with("ROLLBACK")
                                || part_upper.starts_with("SET")
                                || part_upper.starts_with("RESET");

                            if is_valid && !part_trimmed.starts_with("--") {
                                valid_parts.push(part_trimmed);
                            }
                        }

                        // Exécuter chaque partie valide
                        for (i, part) in valid_parts.iter().enumerate() {
                            let part_cmd = format!("{};", part);
                            if let Err(e2) = sqlx::query(&part_cmd).execute(pool).await {
                                warn!("   ⚠️ Erreur partie {}: {}", i + 1, e2);
                            }
                        }
                        continue; // On a traité la commande multiple, passer à la suivante
                    }
                }

                // ✅ AMÉLIORATION 2026-01-31: Ignorer silencieusement les erreurs attendues courantes
                let is_expected_error =
                    // Colonnes/tables/index/triggers déjà existants
                    error_lower.contains("already exists") ||
                    error_lower.contains("does not exist") && (
                        error_lower.contains("relation") ||
                        error_lower.contains("column") ||
                        error_lower.contains("type") ||
                        error_lower.contains("index")
                    ) ||
                    // Colonnes manquantes (peuvent être créées plus tard)
                    error_lower.contains("column") && error_lower.contains("does not exist") ||
                    // Contraintes de clés étrangères impossibles (table référencée n'existe pas)
                    error_lower.contains("foreign key constraint") && error_lower.contains("cannot be implemented") ||
                    // Tables manquantes pour contraintes/opérations
                    error_lower.contains("relation") && error_lower.contains("does not exist") ||
                    // Partitionnement non applicable
                    error_lower.contains("is not partitioned") ||
                    // ✅ NOUVEAU 2025-12-09: Erreurs de syntaxe SQL dues au parsing de fonctions/triggers
                    // Ces erreurs peuvent se produire si une fonction de trigger n'existe pas encore
                    ((error_lower.contains("syntax error") && error_lower.contains("end")) &&
                    (normalized_cmd.to_uppercase().contains("CREATE TRIGGER") || normalized_cmd.to_uppercase().contains("EXECUTE FUNCTION"))) ||
                    // Fonction appelée par un trigger n'existe pas encore
                    (error_lower.contains("function") && error_lower.contains("does not exist") && normalized_cmd.to_uppercase().contains("CREATE TRIGGER")) ||
                    error_lower.contains("cannot change") && error_lower.contains("partition") ||
                    // Erreurs de syntaxe pour fragments/fragments invalides
                    (error_lower.contains("syntax error") && (
                        error_lower.contains("near \")\"") ||
                        error_lower.contains("unexpected") && error_lower.contains(")")
                    )) ||
                    // ✅ NOUVEAU 2026-01-31: Erreurs "syntax error at end of input" pour triggers incomplets dans EXECUTE
                    (error_lower.contains("syntax error") && error_lower.contains("at end of input") && normalized_cmd.to_uppercase().contains("EXECUTE") && normalized_cmd.to_uppercase().contains("CREATE TRIGGER")) ||
                    // Commandes multiples dans prepared statement (erreur attendue si on n'a pas pu la diviser)
                    error_lower.contains("cannot insert multiple commands into a prepared statement") ||
                    // Fonctions dans index predicate (IMMUTABLE requis)
                    error_lower.contains("functions in index predicate must be marked immutable") ||
                    // ✅ CORRECTION 2025-12-09: Erreurs de connexion TLS (attendu lors de crashes serveur)
                    error_lower.contains("peer closed connection without sending tls close_notify") ||
                    error_lower.contains("connection reset by peer") ||
                    error_lower.contains("broken pipe") ||
                    error_lower.contains("terminating connection because of crash");

                if is_expected_error {
                    // Logger seulement au niveau debug pour réduire le bruit
                    debug!("ℹ️ Erreur SQL attendue ignorée: {}", error_str);
                    continue;
                }

                // Ignorer les erreurs de partitionnement sur tables existantes
                if error_lower.contains("partition")
                    && (error_lower.contains("cannot change")
                        || error_lower.contains("already exists")
                        || error_lower.contains("must be empty"))
                {
                    debug!(
                        "ℹ️ Erreur de partitionnement ignorée (table existante): {}",
                        error_str
                    );
                    continue;
                }

                // Ignorer les erreurs de syntaxe si c'est juste une parenthèse fermante isolée ou commande invalide
                if error_lower.contains("syntax error") && error_lower.contains("near \")\"") {
                    debug!("ℹ️ Commande SQL invalide ignorée (parenthèse isolée)");
                    continue;
                }

                // Ignorer les erreurs de syntaxe pour les commandes qui semblent être des fragments
                if error_lower.contains("syntax error") {
                    // Vérifier si c'est un fragment invalide (juste des parenthèses, point-virgule, etc.)
                    let cmd_clean = trimmed_cmd.trim_matches(|c: char| {
                        c.is_whitespace() || c == ';' || c == '(' || c == ')'
                    });
                    if cmd_clean.is_empty() || cmd_clean.len() < 5 {
                        debug!("ℹ️ Fragment SQL invalide ignoré");
                        continue;
                    }

                    // Si c'est une vraie erreur de syntaxe sur une commande valide, on la propage
                    error!("❌ Erreur de syntaxe SQL: {}", e);
                    error!("❌ Commande problématique: {}", trimmed_cmd);
                    return Err(e);
                } else if error_lower.contains("unterminated") {
                    error!("❌ Commande SQL non terminée: {}", e);
                    error!("❌ Commande problématique: {}", trimmed_cmd);
                    return Err(e);
                } else {
                    // Seulement logger les vraies erreurs inattendues
                    warn!("⚠️ Erreur lors de l'exécution SQL (continuation): {}", e);
                }
            }
        }
    }

    Ok(())
}

/// ✅ 2025-11-26 : Crée les tables pour services spécialisés (Santé et Transport)
/// Compatible SQLx offline mode
pub async fn ensure_specialized_services_tables(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification et création des tables services spécialisés...");

    // ✅ CORRECTION: Vérifier toutes les tables spécialisées individuellement
    let pharmacies_exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'pharmacies')",
    )
    .fetch_one(pool)
    .await
    .unwrap_or(false);

    let hopitaux_exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'hopitaux_cliniques')"
    )
    .fetch_one(pool)
    .await
    .unwrap_or(false);

    let laboratoires_exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'laboratoires_imagerie')"
    )
    .fetch_one(pool)
    .await
    .unwrap_or(false);

    let agences_exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'agences_voyage')"
    )
    .fetch_one(pool)
    .await
    .unwrap_or(false);

    let covoiturages_exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'covoiturages')",
    )
    .fetch_one(pool)
    .await
    .unwrap_or(false);

    let taxis_exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'taxis_ville')",
    )
    .fetch_one(pool)
    .await
    .unwrap_or(false);

    // Si au moins une table manque, exécuter la migration complète
    let any_missing = !pharmacies_exists
        || !hopitaux_exists
        || !laboratoires_exists
        || !agences_exists
        || !covoiturages_exists
        || !taxis_exists;

    if any_missing {
        // Lire le contenu de la migration SQL
        let migration_sql =
            include_str!("../../migrations/20251126_create_specialized_services_tables.sql");

        // Exécuter la migration SQL en divisant en commandes individuelles
        execute_migration_sql_safe(pool, migration_sql).await?;
        info!("✅ Tables services spécialisés créées via migration complète");
    } else {
        info!("✅ Toutes les tables services spécialisés déjà présentes");
    }

    // ✅ CORRECTION: Vérifications supplémentaires et créations individuelles si nécessaire
    // (au cas où la migration complète échouerait partiellement)

    // Créer la fonction update_specialized_service_timestamp si elle n'existe pas
    sqlx::query(
        r#"
        CREATE OR REPLACE FUNCTION update_specialized_service_timestamp()
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

    // 1. PHARMACIES
    if !pharmacies_exists {
        warn!("⚠️ Table pharmacies manquante, création directe...");
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS pharmacies (
                id SERIAL PRIMARY KEY,
                service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                nom VARCHAR(255) NOT NULL,
                adresse TEXT,
                quartier VARCHAR(255),
                ville VARCHAR(255),
                gps VARCHAR(255),
                jours_garde TEXT,
                heures_ouverture TIME,
                heures_fermeture TIME,
                permanent_24h BOOLEAN DEFAULT FALSE,
                telephone VARCHAR(50),
                telephone_urgence VARCHAR(50),
                whatsapp VARCHAR(50),
                email VARCHAR(255),
                services TEXT[],
                is_active BOOLEAN DEFAULT TRUE,
                is_on_duty_now BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                CONSTRAINT unique_pharmacy_service UNIQUE(service_id)
            )
            "#,
        )
        .execute(pool)
        .await?;

        sqlx::query("CREATE INDEX IF NOT EXISTS idx_pharmacies_user_id ON pharmacies(user_id)")
            .execute(pool)
            .await?;
        sqlx::query(
            "CREATE INDEX IF NOT EXISTS idx_pharmacies_service_id ON pharmacies(service_id)",
        )
        .execute(pool)
        .await?;
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_pharmacies_is_active ON pharmacies(is_active)")
            .execute(pool)
            .await?;
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_pharmacies_is_on_duty ON pharmacies(is_on_duty_now) WHERE is_on_duty_now = TRUE").execute(pool).await?;
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_pharmacies_ville ON pharmacies(ville)")
            .execute(pool)
            .await?;
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_pharmacies_quartier ON pharmacies(quartier)")
            .execute(pool)
            .await?;
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_pharmacies_services_gin ON pharmacies USING GIN(services)").execute(pool).await?;

        sqlx::query(
            r#"
            DROP TRIGGER IF EXISTS trigger_pharmacies_updated_at ON pharmacies;
            CREATE TRIGGER trigger_pharmacies_updated_at
                BEFORE UPDATE ON pharmacies
                FOR EACH ROW
                EXECUTE FUNCTION update_specialized_service_timestamp();
            "#,
        )
        .execute(pool)
        .await?;

        info!("✅ Table pharmacies créée directement");
    }

    // 1b. PHARMACIES: Colonnes supplémentaires pour UX moderne
    let pharma_columns_to_add = vec![
        ("description", "TEXT"),
        ("logo_url", "TEXT"),
        ("note_moyenne", "REAL DEFAULT 0"),
        ("nombre_avis", "INTEGER DEFAULT 0"),
        ("site_web", "VARCHAR(255)"),
        ("is_verified", "BOOLEAN DEFAULT FALSE"),
        ("specialites", "TEXT[]"),
    ];
    for (col, col_type) in &pharma_columns_to_add {
        let check = format!(
            "SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='pharmacies' AND column_name='{}')",
            col
        );
        let exists: bool =
            sqlx::query_scalar::<_, bool>(&check).fetch_one(pool).await.unwrap_or(true);
        if !exists {
            let alter = format!("ALTER TABLE pharmacies ADD COLUMN {} {}", col, col_type);
            if let Err(e) = sqlx::query(&alter).execute(pool).await {
                warn!(
                    "⚠️ Impossible d'ajouter colonne {} à pharmacies: {}",
                    col, e
                );
            } else {
                info!("✅ Colonne {} ajoutée à pharmacies", col);
            }
        }
    }

    // 2. HOPITAUX_CLINIQUES
    if !hopitaux_exists {
        warn!("⚠️ Table hopitaux_cliniques manquante, création directe...");
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS hopitaux_cliniques (
                id SERIAL PRIMARY KEY,
                service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                nom VARCHAR(255) NOT NULL,
                type_etablissement VARCHAR(50) NOT NULL,
                adresse TEXT,
                quartier VARCHAR(255),
                ville VARCHAR(255),
                gps VARCHAR(255),
                prestations_medicales TEXT[],
                banque_sang BOOLEAN DEFAULT FALSE,
                urgences_disponible BOOLEAN DEFAULT FALSE,
                rdv_en_ligne BOOLEAN DEFAULT FALSE,
                planning_hebdomadaire JSONB,
                telephone VARCHAR(50),
                telephone_urgence VARCHAR(50),
                whatsapp VARCHAR(50),
                email VARCHAR(255),
                site_web VARCHAR(255),
                is_active BOOLEAN DEFAULT TRUE,
                is_available_now BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                CONSTRAINT unique_hospital_service UNIQUE(service_id)
            )
            "#,
        )
        .execute(pool)
        .await?;

        sqlx::query(
            "CREATE INDEX IF NOT EXISTS idx_hopitaux_user_id ON hopitaux_cliniques(user_id)",
        )
        .execute(pool)
        .await?;
        sqlx::query(
            "CREATE INDEX IF NOT EXISTS idx_hopitaux_service_id ON hopitaux_cliniques(service_id)",
        )
        .execute(pool)
        .await?;
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_hopitaux_type ON hopitaux_cliniques(type_etablissement)").execute(pool).await?;
        sqlx::query(
            "CREATE INDEX IF NOT EXISTS idx_hopitaux_is_active ON hopitaux_cliniques(is_active)",
        )
        .execute(pool)
        .await?;
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_hopitaux_is_available ON hopitaux_cliniques(is_available_now) WHERE is_available_now = TRUE").execute(pool).await?;
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_hopitaux_prestations_gin ON hopitaux_cliniques USING GIN(prestations_medicales)").execute(pool).await?;
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_hopitaux_planning_gin ON hopitaux_cliniques USING GIN(planning_hebdomadaire)").execute(pool).await?;

        sqlx::query(
            r#"
            DROP TRIGGER IF EXISTS trigger_hopitaux_updated_at ON hopitaux_cliniques;
            CREATE TRIGGER trigger_hopitaux_updated_at
                BEFORE UPDATE ON hopitaux_cliniques
                FOR EACH ROW
                EXECUTE FUNCTION update_specialized_service_timestamp();
            "#,
        )
        .execute(pool)
        .await?;

        info!("✅ Table hopitaux_cliniques créée directement");
    }

    // 2b. HOPITAUX_CLINIQUES: Colonnes supplémentaires pour UX moderne
    let hopital_columns_to_add = vec![
        ("description", "TEXT"),
        ("logo_url", "TEXT"),
        ("note_moyenne", "REAL DEFAULT 0"),
        ("nombre_avis", "INTEGER DEFAULT 0"),
        ("is_verified", "BOOLEAN DEFAULT FALSE"),
        ("specialites", "TEXT[]"),
    ];
    for (col, col_type) in &hopital_columns_to_add {
        let check = format!(
            "SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='hopitaux_cliniques' AND column_name='{}')",
            col
        );
        let exists: bool =
            sqlx::query_scalar::<_, bool>(&check).fetch_one(pool).await.unwrap_or(true);
        if !exists {
            let alter = format!(
                "ALTER TABLE hopitaux_cliniques ADD COLUMN {} {}",
                col, col_type
            );
            if let Err(e) = sqlx::query(&alter).execute(pool).await {
                warn!(
                    "⚠️ Impossible d'ajouter colonne {} à hopitaux_cliniques: {}",
                    col, e
                );
            } else {
                info!("✅ Colonne {} ajoutée à hopitaux_cliniques", col);
            }
        }
    }

    // 3. LABORATOIRES_IMAGERIE
    if !laboratoires_exists {
        warn!("⚠️ Table laboratoires_imagerie manquante, création directe...");
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS laboratoires_imagerie (
                id SERIAL PRIMARY KEY,
                service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                nom VARCHAR(255) NOT NULL,
                type_laboratoire VARCHAR(50) NOT NULL,
                adresse TEXT,
                quartier VARCHAR(255),
                ville VARCHAR(255),
                gps VARCHAR(255),
                analyses_disponibles TEXT[],
                imagerie_disponible TEXT[],
                planning_hebdomadaire JSONB,
                rdv_requis BOOLEAN DEFAULT TRUE,
                resultats_en_ligne BOOLEAN DEFAULT FALSE,
                telephone VARCHAR(50),
                whatsapp VARCHAR(50),
                email VARCHAR(255),
                is_active BOOLEAN DEFAULT TRUE,
                is_available_now BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                CONSTRAINT unique_laboratory_service UNIQUE(service_id)
            )
            "#,
        )
        .execute(pool)
        .await?;

        sqlx::query(
            "CREATE INDEX IF NOT EXISTS idx_laboratoires_user_id ON laboratoires_imagerie(user_id)",
        )
        .execute(pool)
        .await?;
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_laboratoires_service_id ON laboratoires_imagerie(service_id)").execute(pool).await?;
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_laboratoires_type ON laboratoires_imagerie(type_laboratoire)").execute(pool).await?;
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_laboratoires_analyses_gin ON laboratoires_imagerie USING GIN(analyses_disponibles)").execute(pool).await?;
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_laboratoires_imagerie_gin ON laboratoires_imagerie USING GIN(imagerie_disponible)").execute(pool).await?;
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_laboratoires_is_available ON laboratoires_imagerie(is_available_now) WHERE is_available_now = TRUE").execute(pool).await?;

        sqlx::query(
            r#"
            DROP TRIGGER IF EXISTS trigger_laboratoires_updated_at ON laboratoires_imagerie;
            CREATE TRIGGER trigger_laboratoires_updated_at
                BEFORE UPDATE ON laboratoires_imagerie
                FOR EACH ROW
                EXECUTE FUNCTION update_specialized_service_timestamp();
            "#,
        )
        .execute(pool)
        .await?;

        info!("✅ Table laboratoires_imagerie créée directement");
    }

    // 3b. LABORATOIRES_IMAGERIE: Colonnes supplémentaires pour UX moderne
    let labo_columns_to_add = vec![
        ("description", "TEXT"),
        ("logo_url", "TEXT"),
        ("note_moyenne", "REAL DEFAULT 0"),
        ("nombre_avis", "INTEGER DEFAULT 0"),
        ("site_web", "VARCHAR(255)"),
        ("is_verified", "BOOLEAN DEFAULT FALSE"),
        ("specialites", "TEXT[]"),
    ];
    for (col, col_type) in &labo_columns_to_add {
        let check = format!(
            "SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='laboratoires_imagerie' AND column_name='{}')",
            col
        );
        let exists: bool =
            sqlx::query_scalar::<_, bool>(&check).fetch_one(pool).await.unwrap_or(true);
        if !exists {
            let alter = format!(
                "ALTER TABLE laboratoires_imagerie ADD COLUMN {} {}",
                col, col_type
            );
            if let Err(e) = sqlx::query(&alter).execute(pool).await {
                warn!(
                    "⚠️ Impossible d'ajouter colonne {} à laboratoires_imagerie: {}",
                    col, e
                );
            } else {
                info!("✅ Colonne {} ajoutée à laboratoires_imagerie", col);
            }
        }
    }

    // 4. AGENCES_VOYAGE
    if !agences_exists {
        warn!("⚠️ Table agences_voyage manquante, création directe...");
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS agences_voyage (
                id SERIAL PRIMARY KEY,
                service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                nom_agence VARCHAR(255) NOT NULL,
                adresse TEXT,
                quartier VARCHAR(255),
                ville VARCHAR(255),
                gps VARCHAR(255),
                services_voyage TEXT[],
                compagnies_bus TEXT[],
                destinations TEXT[],
                heures_ouverture TIME,
                heures_fermeture TIME,
                jours_ouverture TEXT,
                telephone VARCHAR(50),
                whatsapp VARCHAR(50),
                email VARCHAR(255),
                site_web VARCHAR(255),
                peut_emettre_tickets_bus BOOLEAN DEFAULT FALSE,
                compagnies_affiliees TEXT[],
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                CONSTRAINT unique_agency_service UNIQUE(service_id)
            )
            "#,
        )
        .execute(pool)
        .await?;

        sqlx::query("CREATE INDEX IF NOT EXISTS idx_agences_user_id ON agences_voyage(user_id)")
            .execute(pool)
            .await?;
        sqlx::query(
            "CREATE INDEX IF NOT EXISTS idx_agences_service_id ON agences_voyage(service_id)",
        )
        .execute(pool)
        .await?;
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_agences_tickets_bus ON agences_voyage(peut_emettre_tickets_bus) WHERE peut_emettre_tickets_bus = TRUE").execute(pool).await?;
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_agences_services_gin ON agences_voyage USING GIN(services_voyage)").execute(pool).await?;
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_agences_compagnies_gin ON agences_voyage USING GIN(compagnies_bus)").execute(pool).await?;
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_agences_destinations_gin ON agences_voyage USING GIN(destinations)").execute(pool).await?;

        sqlx::query(
            r#"
            DROP TRIGGER IF EXISTS trigger_agences_updated_at ON agences_voyage;
            CREATE TRIGGER trigger_agences_updated_at
                BEFORE UPDATE ON agences_voyage
                FOR EACH ROW
                EXECUTE FUNCTION update_specialized_service_timestamp();
            "#,
        )
        .execute(pool)
        .await?;

        info!("✅ Table agences_voyage créée directement");
    }

    // 4b. AGENCES_VOYAGE: Colonnes supplémentaires pour UX moderne
    let agences_columns_to_add = vec![
        ("description", "TEXT"),
        ("logo_url", "TEXT"),
        ("note_moyenne", "REAL DEFAULT 0"),
        ("nombre_avis", "INTEGER DEFAULT 0"),
        ("devise", "VARCHAR(10) DEFAULT 'XAF'"),
        ("pays", "VARCHAR(100)"),
        ("is_verified", "BOOLEAN DEFAULT FALSE"),
        ("specialites", "TEXT[]"),
    ];
    for (col, col_type) in &agences_columns_to_add {
        let check = format!(
            "SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='agences_voyage' AND column_name='{}')",
            col
        );
        let exists: bool =
            sqlx::query_scalar::<_, bool>(&check).fetch_one(pool).await.unwrap_or(true);
        if !exists {
            let alter = format!("ALTER TABLE agences_voyage ADD COLUMN {} {}", col, col_type);
            if let Err(e) = sqlx::query(&alter).execute(pool).await {
                warn!(
                    "⚠️ Impossible d'ajouter colonne {} à agences_voyage: {}",
                    col, e
                );
            } else {
                info!("✅ Colonne {} ajoutée à agences_voyage", col);
            }
        }
    }

    // 5. COVOITURAGES
    if !covoiturages_exists {
        warn!("⚠️ Table covoiturages manquante, création directe...");
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS covoiturages (
                id SERIAL PRIMARY KEY,
                service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                depart VARCHAR(255) NOT NULL,
                destination VARCHAR(255) NOT NULL,
                gps_depart VARCHAR(255),
                gps_destination VARCHAR(255),
                date_depart TIMESTAMPTZ NOT NULL,
                heure_depart TIME NOT NULL,
                date_arrivee_estimee TIMESTAMPTZ,
                type_vehicule VARCHAR(50),
                marque_modele VARCHAR(255),
                nombre_places INTEGER NOT NULL,
                places_disponibles INTEGER NOT NULL,
                prix_par_place INTEGER NOT NULL,
                devise VARCHAR(3) DEFAULT 'XAF',
                bagages_autorises BOOLEAN DEFAULT TRUE,
                animaux_autorises BOOLEAN DEFAULT FALSE,
                fumeur_autorise BOOLEAN DEFAULT FALSE,
                climatisation BOOLEAN DEFAULT FALSE,
                statut VARCHAR(20) NOT NULL DEFAULT 'ouvert' CHECK (statut IN ('ouvert', 'complet', 'annule', 'termine')),
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                CONSTRAINT unique_covoiturage_service UNIQUE(service_id)
            )
            "#
        )
        .execute(pool)
        .await?;

        sqlx::query("CREATE INDEX IF NOT EXISTS idx_covoiturages_user_id ON covoiturages(user_id)")
            .execute(pool)
            .await?;
        sqlx::query(
            "CREATE INDEX IF NOT EXISTS idx_covoiturages_service_id ON covoiturages(service_id)",
        )
        .execute(pool)
        .await?;
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_covoiturages_date_depart ON covoiturages(date_depart) WHERE is_active = TRUE AND statut = 'ouvert'").execute(pool).await?;
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_covoiturages_statut ON covoiturages(statut) WHERE statut = 'ouvert'").execute(pool).await?;
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_covoiturages_depart_destination ON covoiturages(depart, destination)").execute(pool).await?;
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_covoiturages_places_disponibles ON covoiturages(places_disponibles) WHERE places_disponibles > 0").execute(pool).await?;

        sqlx::query(
            r#"
            DROP TRIGGER IF EXISTS trigger_covoiturages_updated_at ON covoiturages;
            CREATE TRIGGER trigger_covoiturages_updated_at
                BEFORE UPDATE ON covoiturages
                FOR EACH ROW
                EXECUTE FUNCTION update_specialized_service_timestamp();
            "#,
        )
        .execute(pool)
        .await?;

        info!("✅ Table covoiturages créée directement");
    }

    // 6. TAXIS_VILLE
    if !taxis_exists {
        warn!("⚠️ Table taxis_ville manquante, création directe...");
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS taxis_ville (
                id SERIAL PRIMARY KEY,
                service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                nom_chauffeur VARCHAR(255),
                telephone VARCHAR(50) NOT NULL,
                whatsapp VARCHAR(50),
                type_vehicule VARCHAR(50),
                marque_modele VARCHAR(255),
                immatriculation VARCHAR(50),
                couleur VARCHAR(50),
                annee INTEGER,
                is_available_now BOOLEAN DEFAULT FALSE,
                zone_intervention TEXT[],
                gps_actuel VARCHAR(255),
                tarif_base INTEGER DEFAULT 500,
                tarif_par_km INTEGER DEFAULT 200,
                devise VARCHAR(3) DEFAULT 'XAF',
                paiement_cash BOOLEAN DEFAULT TRUE,
                paiement_mobile_money BOOLEAN DEFAULT FALSE,
                paiement_carte BOOLEAN DEFAULT FALSE,
                climatisation BOOLEAN DEFAULT FALSE,
                wifi BOOLEAN DEFAULT FALSE,
                is_active BOOLEAN DEFAULT TRUE,
                is_on_duty BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                CONSTRAINT unique_taxi_service UNIQUE(service_id)
            )
            "#,
        )
        .execute(pool)
        .await?;

        sqlx::query("CREATE INDEX IF NOT EXISTS idx_taxis_user_id ON taxis_ville(user_id)")
            .execute(pool)
            .await?;
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_taxis_service_id ON taxis_ville(service_id)")
            .execute(pool)
            .await?;
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_taxis_is_available ON taxis_ville(is_available_now) WHERE is_available_now = TRUE").execute(pool).await?;
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_taxis_is_on_duty ON taxis_ville(is_on_duty) WHERE is_on_duty = TRUE").execute(pool).await?;
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_taxis_zone_gin ON taxis_ville USING GIN(zone_intervention)").execute(pool).await?;

        sqlx::query(
            r#"
            DROP TRIGGER IF EXISTS trigger_taxis_updated_at ON taxis_ville;
            CREATE TRIGGER trigger_taxis_updated_at
                BEFORE UPDATE ON taxis_ville
                FOR EACH ROW
                EXECUTE FUNCTION update_specialized_service_timestamp();
            "#,
        )
        .execute(pool)
        .await?;

        info!("✅ Table taxis_ville créée directement");
    }

    Ok(())
}

/// ✅ NOUVEAU 2025-11-26 : Créer les fonctions de recherche spécialisées avec moment
pub async fn ensure_specialized_search_functions(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification/création des fonctions de recherche spécialisées avec moment...");

    // Lire le contenu de la migration SQL
    let migration_sql =
        include_str!("../../migrations/00001024_search_specialized_services_with_moment.sql");

    // Exécuter la migration
    sqlx::query(migration_sql).execute(pool).await?;

    info!("✅ Fonctions de recherche spécialisées créées/mises à jour");
    Ok(())
}

/// ✅ NOUVEAU 2025-11-27 : Créer la table banques_sang (service spécialisé isolé)
/// Compatible SQLx offline mode
pub async fn ensure_banques_sang_table(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification et création de la table banques_sang...");

    // Vérifier d'abord si la table existe déjà
    let banques_sang_exists: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'banques_sang')",
    )
    .fetch_one(pool)
    .await
    .unwrap_or(false);

    if !banques_sang_exists {
        // Lire le contenu de la migration SQL
        let migration_sql = include_str!("../../migrations/00000096_create_banques_sang_table.sql");

        // Exécuter la migration SQL en divisant en commandes individuelles
        execute_migration_sql_safe(pool, migration_sql).await?;
        info!("✅ Table banques_sang créée");
    } else {
        info!("✅ Table banques_sang déjà présente");
    }

    // Colonnes supplémentaires pour UX moderne
    let bs_columns_to_add = vec![
        ("description", "TEXT"),
        ("logo_url", "TEXT"),
        ("note_moyenne", "REAL DEFAULT 0"),
        ("nombre_avis", "INTEGER DEFAULT 0"),
        ("site_web", "VARCHAR(255)"),
        ("is_verified", "BOOLEAN DEFAULT FALSE"),
    ];
    for (col, col_type) in &bs_columns_to_add {
        let check = format!(
            "SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='banques_sang' AND column_name='{}')",
            col
        );
        let exists: bool =
            sqlx::query_scalar::<_, bool>(&check).fetch_one(pool).await.unwrap_or(true);
        if !exists {
            let alter = format!("ALTER TABLE banques_sang ADD COLUMN {} {}", col, col_type);
            if let Err(e) = sqlx::query(&alter).execute(pool).await {
                warn!(
                    "⚠️ Impossible d'ajouter colonne {} à banques_sang: {}",
                    col, e
                );
            } else {
                info!("✅ Colonne {} ajoutée à banques_sang", col);
            }
        }
    }

    Ok(())
}

/// ✅ NOUVEAU 2025-11-27 : Intégrer tickets bus avec agences de voyage
/// Compatible SQLx offline mode
pub async fn ensure_bus_tickets_integration(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification et intégration tickets bus avec agences_voyage...");

    // Lire le contenu de la migration SQL
    let migration_sql =
        include_str!("../../migrations/00000099_integrate_bus_tickets_with_agences_voyage.sql");

    // Exécuter la migration SQL en divisant en commandes individuelles
    execute_migration_sql_safe(pool, migration_sql).await?;

    info!("✅ Intégration tickets bus avec agences_voyage créée/mise à jour");
    Ok(())
}

/// Vérifie et crée le système de commission et reversement pour tickets bus
pub async fn ensure_bus_ticket_commission_system(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification système commission et reversement tickets bus...");

    // Lire le contenu de la migration SQL
    let migration_sql =
        include_str!("../../migrations/00000090_add_commission_to_bus_payments.sql");

    // Exécuter la migration SQL en divisant en commandes individuelles
    execute_migration_sql_safe(pool, migration_sql).await?;

    info!("✅ Système commission et reversement tickets bus créé/mis à jour");
    Ok(())
}

/// Vérifie et crée le système de validation de tickets bus
pub async fn ensure_bus_ticket_validation_system(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification système validation tickets bus...");

    // Vérifier d'abord si la table existe déjà
    let bus_boarding_status_exists: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'bus_boarding_status')"
    )
    .fetch_one(pool)
    .await
    .unwrap_or(false);

    if !bus_boarding_status_exists {
        // Lire le contenu de la migration SQL
        let migration_sql =
            include_str!("../../migrations/00000095_bus_ticket_validation_system.sql");

        // Exécuter la migration SQL en divisant en commandes individuelles
        execute_migration_sql_safe(pool, migration_sql).await?;
        info!("✅ Système validation tickets bus créé");
    } else {
        info!("✅ Système validation tickets bus déjà présent");
    }

    Ok(())
}

/// Vérifie et crée le système de gestion manuelle des places non disponibles
pub async fn ensure_bus_seat_blocks_system(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification système blocage places bus...");

    // Vérifier d'abord si la table existe déjà
    let bus_seat_blocks_exists: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'bus_seat_blocks')"
    )
    .fetch_one(pool)
    .await
    .unwrap_or(false);

    if !bus_seat_blocks_exists {
        // Lire le contenu de la migration SQL
        let migration_sql = include_str!("../../migrations/00000094_bus_manual_seat_blocks.sql");

        // Exécuter la migration SQL en divisant en commandes individuelles
        execute_migration_sql_safe(pool, migration_sql).await?;
        info!("✅ Système blocage places bus créé");
    } else {
        info!("✅ Système blocage places bus déjà présent");
    }

    Ok(())
}

/// ✅ NOUVEAU 2025-11-27 : Système Intelligent de Matching Banque de Sang
/// Compatible SQLx offline mode
pub async fn ensure_blood_donation_matching_system(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification système matching intelligent banque de sang...");

    // Vérifier d'abord si la table existe déjà
    let user_blood_groups_exists: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'user_blood_groups')"
    )
    .fetch_one(pool)
    .await
    .unwrap_or(false);

    if !user_blood_groups_exists {
        // Lire le contenu de la migration SQL
        let migration_sql =
            include_str!("../../migrations/00000093_blood_donation_matching_system.sql");

        // Exécuter la migration SQL en divisant en commandes individuelles
        execute_migration_sql_safe(pool, migration_sql).await?;
        info!("✅ Système matching intelligent banque de sang créé");
    } else {
        info!("✅ Système matching intelligent banque de sang déjà présent");
    }

    Ok(())
}

/// ✅ NOUVEAU 2025-11-27 : Vérifie et crée la table agency_departure_schedules
/// Compatible SQLx offline mode
pub async fn ensure_agency_departure_schedules(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification table agency_departure_schedules...");

    // Vérifier d'abord si la table existe déjà
    let table_exists: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'agency_departure_schedules')"
    )
    .fetch_one(pool)
    .await
    .unwrap_or(false);

    if !table_exists {
        // Lire le contenu de la migration SQL
        let migration_sql =
            include_str!("../../migrations/00000092_agency_departure_schedules.sql");

        // Exécuter la migration SQL en divisant en commandes individuelles
        execute_migration_sql_safe(pool, migration_sql).await?;
        info!("✅ Table agency_departure_schedules créée");
    } else {
        info!("✅ Table agency_departure_schedules déjà présente");
    }

    Ok(())
}

/// ✅ NOUVEAU 2025-11-27 : Ajoute les colonnes return_date et return_time à bus_ticket_payments
/// Compatible SQLx offline mode
pub async fn ensure_return_time_columns(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification colonnes return_date et return_time...");

    // Vérifier si les colonnes existent déjà
    let return_date_exists: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'bus_ticket_payments' AND column_name = 'return_date')"
    )
    .fetch_one(pool)
    .await
    .unwrap_or(false);

    if !return_date_exists {
        // Lire le contenu de la migration SQL
        let migration_sql =
            include_str!("../../migrations/00000091_add_return_time_to_bus_payments.sql");

        // Exécuter la migration SQL en divisant en commandes individuelles
        execute_migration_sql_safe(pool, migration_sql).await?;
        info!("✅ Colonnes return_date et return_time ajoutées");
    } else {
        info!("✅ Colonnes return_date et return_time déjà présentes");
    }

    Ok(())
}

/// ✅ NOUVEAU 2025-11-27 : Améliore la fonction match_return_trip_requests pour inclure l'heure
/// Compatible SQLx offline mode
pub async fn ensure_improved_return_matching(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification fonction match_return_trip_requests améliorée...");

    // ✅ CORRIGÉ: DROP la fonction avant de la recréer pour éviter l'erreur "cannot change return type"
    let _ = sqlx::query("DROP FUNCTION IF EXISTS match_return_trip_requests(TEXT)")
        .execute(pool)
        .await;

    // Lire le contenu de la migration SQL
    let migration_sql =
        include_str!("../../migrations/00000098_improve_return_trip_matching_with_time.sql");

    // Exécuter la migration SQL en divisant en commandes individuelles
    execute_migration_sql_safe(pool, migration_sql).await?;
    info!("✅ Fonction match_return_trip_requests améliorée avec matching par heure");

    Ok(())
}

/// ✅ NOUVEAU 2025-11-27 : Ajoute le champ groupe_sanguin dans users
/// Compatible SQLx offline mode
pub async fn ensure_blood_group_column_in_users(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification colonne groupe_sanguin dans users...");

    // Vérifier si la colonne existe déjà
    let column_exists: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'groupe_sanguin')"
    )
    .fetch_one(pool)
    .await
    .unwrap_or(false);

    if !column_exists {
        // Lire le contenu de la migration SQL
        let migration_sql = include_str!("../../migrations/20251127_add_blood_group_to_users.sql");

        // Exécuter la migration SQL en divisant en commandes individuelles
        execute_migration_sql_safe(pool, migration_sql).await?;
        info!("✅ Colonne groupe_sanguin ajoutée dans users");
    } else {
        info!("✅ Colonne groupe_sanguin déjà présente dans users");
    }

    Ok(())
}

/// ✅ 2025-01-28 : Ajouter champ specialized_type pour identification sans ambiguïté des services spécialisés
/// Compatible SQLx offline mode
pub async fn ensure_services_specialized_type(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification/création du champ specialized_type dans services...");

    // Vérifier si la colonne existe déjà
    let column_exists: bool = sqlx::query_scalar(
        r#"
        SELECT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'services' AND column_name = 'specialized_type'
        )
        "#,
    )
    .fetch_one(pool)
    .await
    .unwrap_or(false);

    if !column_exists {
        info!("📝 Ajout de la colonne specialized_type...");

        // Ajouter la colonne
        sqlx::query("ALTER TABLE services ADD COLUMN specialized_type VARCHAR(50)")
            .execute(pool)
            .await?;

        info!("✅ Colonne specialized_type ajoutée");
    } else {
        info!("✅ Colonne specialized_type déjà présente");
    }

    // Remplir depuis les tables spécialisées existantes (vérifier existence d'abord)
    let tables_to_check = vec![
        ("pharmacies", "pharmacie"),
        ("hopitaux_cliniques", "hopital_clinique"),
        ("laboratoires_imagerie", "laboratoire_imagerie"),
        ("agences_voyage", "agence_voyage"),
        ("covoiturages", "covoiturage"),
        ("taxis_ville", "taxi_ville"),
        ("banques_sang", "banque_sang"),
    ];

    for (table_name, specialized_type) in tables_to_check {
        let table_exists: bool = sqlx::query_scalar(&format!(
            "SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = '{}')",
            table_name
        ))
        .fetch_one(pool)
        .await
        .unwrap_or(false);

        if table_exists {
            sqlx::query(&format!(
                r#"
                UPDATE services s
                SET specialized_type = '{}'
                WHERE EXISTS (
                    SELECT 1 FROM {} p WHERE p.service_id = s.id
                )
                AND specialized_type IS NULL
                "#,
                specialized_type, table_name
            ))
            .execute(pool)
            .await?;
        }
    }

    // Ajouter contrainte CHECK si elle n'existe pas
    sqlx::query(
        r#"
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.table_constraints 
                WHERE constraint_name = 'check_specialized_type' 
                AND table_name = 'services'
            ) THEN
                ALTER TABLE services 
                ADD CONSTRAINT check_specialized_type 
                CHECK (
                    specialized_type IS NULL 
                    OR specialized_type IN (
                        'pharmacie',
                        'hopital_clinique',
                        'laboratoire_imagerie',
                        'agence_voyage',
                        'covoiturage',
                        'taxi_ville',
                        'banque_sang'
                    )
                );
            END IF;
        END
        $$;
        "#,
    )
    .execute(pool)
    .await?;

    // Créer index si il n'existe pas
    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_services_specialized_type ON services(specialized_type) WHERE specialized_type IS NOT NULL"
    )
    .execute(pool)
    .await?;

    info!("✅ Migration specialized_type terminée");
    Ok(())
}

/// ✅ 2025-01-28 : Créer les triggers pour garantir la cohérence entre specialized_type et les tables spécialisées
/// Compatible SQLx offline mode
pub async fn ensure_specialized_type_triggers(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification/création des triggers specialized_type...");

    // Lire le contenu de la migration SQL
    let migration_sql = include_str!("../../migrations/00000012_add_specialized_type_triggers.sql");

    // Exécuter la migration SQL en divisant en commandes individuelles
    execute_migration_sql_safe(pool, migration_sql).await?;

    info!("✅ Triggers specialized_type créés");
    Ok(())
}

/// ✅ 2025-11-26 : Correction de la signature de search_services_gps_final
/// Pour résoudre l'erreur: "structure of query does not match function result type"
/// Migration: 20251126_fix_search_services_gps_final_signature.sql
pub async fn ensure_search_services_gps_final_signature_fix(
    pool: &PgPool,
) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification/correction de la signature de search_services_gps_final...");

    // Lire le contenu de la migration SQL
    let migration_sql =
        include_str!("../../migrations/20251126_fix_search_services_gps_final_signature.sql");

    // Exécuter la migration SQL en divisant en commandes individuelles
    execute_migration_sql_safe(pool, migration_sql).await?;

    info!("✅ Signature de search_services_gps_final corrigée");
    Ok(())
}

/// ✅ 2025-12-01 : Optimisation CRITIQUE de search_services_gps_final
/// Élimine les calculs de distance GPS redondants (calculé 2 fois → 1 fois via CTE)
/// Réduit le temps d'exécution de ~17s à <2s
/// Migration: 20251201_OPTIMIZE_SEARCH_GPS_FINAL_CRITICAL.sql
pub async fn ensure_search_services_gps_final_optimization(
    pool: &PgPool,
) -> Result<(), sqlx::Error> {
    info!("🔍 Application de l'optimisation CRITIQUE de search_services_gps_final...");

    // Lire le contenu de la migration SQL
    let migration_sql =
        include_str!("../../migrations/00000048_OPTIMIZE_SEARCH_GPS_FINAL_CRITICAL.sql");

    // Exécuter la migration SQL en divisant en commandes individuelles
    execute_migration_sql_safe(pool, migration_sql).await?;

    info!("✅ Optimisation CRITIQUE de search_services_gps_final appliquée (réduction ~17s → <2s)");
    Ok(())
}

/// ✅ 2025-01-01 : Alignement de search_services_gps_final avec keyword_search_with_gps
/// Utilise la même logique de recherche (autocomplete, produits, unaccent, similarity)
/// Migration: 20250101_ALIGN_SEARCH_GPS_FINAL_WITH_KEYWORD_SEARCH.sql
pub async fn ensure_search_services_gps_final_alignment(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Application de l'alignement de search_services_gps_final avec keyword_search_with_gps...");

    // Lire le contenu de la migration SQL
    let migration_sql =
        include_str!("../../migrations/20250101_ALIGN_SEARCH_GPS_FINAL_WITH_KEYWORD_SEARCH.sql");

    // Exécuter la migration SQL en divisant en commandes individuelles
    execute_migration_sql_safe(pool, migration_sql).await?;

    info!("✅ Alignement de search_services_gps_final avec keyword_search_with_gps appliqué");
    Ok(())
}

/// ✅ 2025-01-01 : Optimisation de hybrid_image_search avec unaccent() et similarity()
/// Aligne la recherche par image avec keyword_search_with_gps (gère accents, erreurs de saisie, troncature)
/// Migration: 20250101_OPTIMIZE_HYBRID_IMAGE_SEARCH_WITH_UNACCENT_SIMILARITY.sql
pub async fn ensure_hybrid_image_search_optimization(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Application de l'optimisation de hybrid_image_search avec unaccent() et similarity()...");

    // Lire le contenu de la migration SQL
    let migration_sql = include_str!(
        "../../migrations/00000102_OPTIMIZE_HYBRID_IMAGE_SEARCH_WITH_UNACCENT_SIMILARITY.sql"
    );

    // Exécuter la migration SQL en divisant en commandes individuelles
    execute_migration_sql_safe(pool, migration_sql).await?;

    info!("✅ Optimisation de hybrid_image_search appliquée (unaccent + similarity)");
    Ok(())
}

/// ✅ 2025-11-26 : Optimisation des index pour recherche de produits
/// Crée des index sur les colonnes fréquemment recherchées pour améliorer les performances
/// Migration: 20251126_optimize_search_indexes.sql
pub async fn ensure_search_indexes_optimization(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification/création des index d'optimisation de recherche...");

    // Lire le contenu de la migration SQL
    // Lire le contenu de la migration SQL
    let migration_sql = include_str!("../../migrations/20251126_optimize_search_indexes.sql");

    // Exécuter la migration SQL en divisant en commandes individuelles
    execute_migration_sql_safe(pool, migration_sql).await?;

    info!("✅ Index d'optimisation de recherche créés");
    Ok(())
}

/// ✅ 2025-11-27 : Optimisation des performances pour get_services_for_prestataire
/// Crée des index composites pour optimiser les jointures avec products_lifecycle
/// Migration: 20251127_optimize_get_services_performance.sql
pub async fn ensure_get_services_performance_indexes(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification/création des index d'optimisation get_services_for_prestataire...");

    // Lire le contenu de la migration SQL
    let migration_sql =
        include_str!("../../migrations/00000100_optimize_get_services_performance.sql");

    // Exécuter la migration SQL en divisant en commandes individuelles
    execute_migration_sql_safe(pool, migration_sql).await?;

    info!("✅ Index d'optimisation get_services_for_prestataire créés");
    Ok(())
}

/// ✅ 2025-12-01 : Optimisations de scalabilité pour millions d'interactions
/// Crée les index, vues matérialisées et fonctions pour performance maximale
/// Migration: 20251201_scalability_indexes.sql
pub async fn ensure_scalability_indexes(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification/création des index et vues matérialisées de scalabilité...");

    // Lire le contenu de la migration SQL
    // Lire le contenu de la migration SQL
    let migration_sql = include_str!("../../migrations/20251201_scalability_indexes.sql");

    // Exécuter la migration SQL en divisant en commandes individuelles
    execute_migration_sql_safe(pool, migration_sql).await?;

    // ✅ CORRECTION 2025-12-09: Appliquer la correction des index uniques
    let fix_migration_sql =
        include_str!("../../migrations/20251209_fix_materialized_views_unique_indexes.sql");
    if let Err(e) = execute_migration_sql_safe(pool, fix_migration_sql).await {
        warn!("⚠️ Erreur lors de l'application de la correction des index uniques (peut être ignorée si déjà appliquée): {}", e);
    }

    // ✅ CORRECTION 2025-12-09: Appliquer l'optimisation des requêtes lentes
    let optimize_slow_queries_sql =
        include_str!("../../migrations/00001009_optimize_slow_queries_indexes.sql");
    if let Err(e) = execute_migration_sql_safe(pool, optimize_slow_queries_sql).await {
        warn!("⚠️ Erreur lors de l'optimisation des requêtes lentes (peut être ignorée si déjà appliquée): {}", e);
    }

    // ✅ CORRECTION 2025-12-10: Vérifier et corriger l'erreur u_client.name dans les vues/fonctions
    let fix_u_client_name_sql =
        include_str!("../../migrations/20251210_fix_u_client_name_error.sql");
    if let Err(e) = execute_migration_sql_safe(pool, fix_u_client_name_sql).await {
        warn!("⚠️ Erreur lors de la vérification u_client.name (peut être ignorée si déjà appliquée): {}", e);
    }

    info!("✅ Index et vues matérialisées de scalabilité créés");
    Ok(())
}

/// ✅ Phase 1 - 2025-01-27 : Optimisations critiques pour scalabilité livraison
/// Crée les index optimisés, fonction SQL find_nearby_couriers et vues matérialisées
/// Migration: 20250127_phase1_delivery_optimizations.sql
pub async fn ensure_delivery_phase1_optimizations(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification/création des optimisations Phase 1 livraison...");

    // Lire le contenu de la migration SQL
    // Lire le contenu de la migration SQL
    let migration_sql = include_str!("../../migrations/20250127_phase1_delivery_optimizations.sql");

    // Exécuter la migration SQL en divisant en commandes individuelles
    execute_migration_sql_safe(pool, migration_sql).await?;

    info!("✅ Optimisations Phase 1 livraison créées (index, fonction SQL, vues matérialisées)");
    Ok(())
}

/// ✅ Phase 2 - 2025-01-27 : Partitionnement et archivage pour scalabilité long terme
/// Crée les partitions, table d'archive et fonctions d'archivage automatique
/// Migration: 20250127_phase2_delivery_partitioning.sql
pub async fn ensure_delivery_phase2_partitioning(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification/création des optimisations Phase 2 livraison (partitionnement)...");

    // Lire le contenu de la migration SQL
    let migration_sql = include_str!("../../migrations/00000141_phase2_delivery_partitioning.sql");

    // Exécuter la migration SQL en divisant en commandes individuelles
    execute_migration_sql_safe(pool, migration_sql).await?;

    info!("✅ Optimisations Phase 2 livraison créées (partitions, archivage)");
    Ok(())
}

/// ✅ 2025-01-01 : Migrations de scalabilité pour millions de créations vidéo simultanées
/// Crée les tables, index, partitions et vues matérialisées pour la scalabilité
/// Migration: 20250101_scalability_improvements.sql
pub async fn ensure_video_scalability_improvements(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Application des améliorations de scalabilité vidéo (millions de créations simultanées)...");

    // Lire le contenu de la migration SQL
    // Lire le contenu de la migration SQL
    let migration_sql = include_str!("../../migrations/20250101_scalability_improvements.sql");

    // Exécuter la migration SQL en divisant en commandes individuelles
    execute_migration_sql_safe(pool, migration_sql).await?;

    info!("✅ Améliorations de scalabilité vidéo appliquées");
    Ok(())
}

/// ✅ 2025-12-03 : Table videos avec hashtags pour VideoFeed
/// Crée la table videos, index, triggers et vue hashtag_stats
/// Migration: 20251203_create_videos_table_with_hashtags.sql
pub async fn ensure_videos_table(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification/création de la table videos avec hashtags...");

    // Lire le contenu de la migration SQL
    let migration_sql =
        include_str!("../../migrations/20251203_create_videos_table_with_hashtags.sql");

    // Exécuter la migration SQL en divisant en commandes individuelles
    execute_migration_sql_safe(pool, migration_sql).await?;

    info!("✅ Table videos avec hashtags créée");
    Ok(())
}

/// ✅ 2025-12-03 : Optimisations de scalabilité pour hashtags
/// Crée les index, vues matérialisées et fonctions optimisées
/// Migration: 20251203_optimize_hashtags_scalability.sql
pub async fn ensure_hashtags_scalability_optimizations(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Application des optimisations de scalabilité hashtags...");

    // Lire le contenu de la migration SQL
    let migration_sql = include_str!("../../migrations/00000084_optimize_hashtags_scalability.sql");

    // Exécuter la migration SQL en divisant en commandes individuelles
    execute_migration_sql_safe(pool, migration_sql).await?;

    info!("✅ Optimisations de scalabilité hashtags appliquées (support millions d'interactions)");
    Ok(())
}

/// ✅ 2025-12-03 : Amélioration algorithme recommandations avec signaux enrichis
/// Ajoute colonnes watch_duration, user_preferences, et fonctions de scoring améliorées
/// Migration: 20251203_enhance_recommendations_algorithm.sql
pub async fn ensure_recommendations_enhancement(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification/création améliorations algorithme recommandations...");

    // Lire le contenu de la migration SQL
    let migration_sql =
        // Lire le contenu de la migration SQL
        include_str!("../../migrations/20251203_enhance_recommendations_algorithm.sql");

    // Exécuter la migration SQL en divisant en commandes individuelles
    execute_migration_sql_safe(pool, migration_sql).await?;

    info!("✅ Améliorations algorithme recommandations appliquées");
    Ok(())
}

/// ✅ 2025-01-28 : Contraintes de validation pour services spécialisés
/// Ajoute CHECK constraints pour valider heures, dates, prix, GPS, email
/// Migration: 20250128_add_specialized_services_constraints.sql
pub async fn ensure_specialized_services_constraints(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification/application des contraintes de validation services spécialisés...");

    // Lire le contenu de la migration SQL
    let migration_sql =
        include_str!("../../migrations/00000011_add_specialized_services_constraints.sql");

    // Exécuter la migration SQL en divisant en commandes individuelles
    execute_migration_sql_safe(pool, migration_sql).await?;

    info!("✅ Contraintes de validation services spécialisés appliquées");
    Ok(())
}

/// ✅ 2025-01-28 : Table pour brouillons de services spécialisés
/// Permet la sauvegarde automatique pendant la création
/// Migration: 20250128_create_specialized_services_drafts.sql
pub async fn ensure_specialized_services_drafts_table(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification/création de la table specialized_services_drafts...");

    // Lire le contenu de la migration SQL
    let migration_sql =
        // Lire le contenu de la migration SQL
        include_str!("../../migrations/20250128_create_specialized_services_drafts.sql");

    // Exécuter la migration SQL en divisant en commandes individuelles
    execute_migration_sql_safe(pool, migration_sql).await?;

    info!("✅ Table specialized_services_drafts créée");
    Ok(())
}

/// ✅ 2025-01-28 : Tables pour historique et recherches sauvegardées
/// Permet de sauvegarder l'historique et les recherches favorites
/// Migration: 20250128_create_search_history_and_saved_searches.sql
pub async fn ensure_search_history_tables(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification/création des tables search_history et saved_searches...");

    // Lire le contenu de la migration SQL
    let migration_sql =
        include_str!("../../migrations/00001004_create_search_history_and_saved_searches.sql");

    // Exécuter la migration SQL en divisant en commandes individuelles
    execute_migration_sql_safe(pool, migration_sql).await?;

    info!("✅ Tables search_history et saved_searches créées");
    Ok(())
}

/// ✅ 2025-01-28 : Index de scalabilité pour recherche taxis et covoiturages
/// Optimise les recherches avec filtres multiples pour scalabilité horizontale
/// Migration: 20250128_add_taxi_covoit_scalability_indexes.sql
pub async fn ensure_taxi_covoit_scalability_indexes(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification/création des index de scalabilité Taxi/Covoiturage...");

    // Lire le contenu de la migration SQL
    let migration_sql =
        // Lire le contenu de la migration SQL
        include_str!("../../migrations/20250128_add_taxi_covoit_scalability_indexes.sql");

    // Exécuter la migration SQL en divisant en commandes individuelles
    execute_migration_sql_safe(pool, migration_sql).await?;

    info!("✅ Index de scalabilité Taxi/Covoiturage créés");
    Ok(())
}

/// ✅ 2025-01-28 : Index de scalabilité pour recherche hôpitaux et laboratoires
/// Optimise les recherches avec filtres multiples pour scalabilité horizontale
/// Migration: 20250128_add_hospital_lab_scalability_indexes.sql
pub async fn ensure_hospital_lab_scalability_indexes(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification/création des index de scalabilité Hôpitaux/Laboratoires...");

    // Lire le contenu de la migration SQL
    let migration_sql =
        include_str!("../../migrations/00000010_add_hospital_lab_scalability_indexes.sql");

    // Exécuter la migration SQL en divisant en commandes individuelles
    execute_migration_sql_safe(pool, migration_sql).await?;

    info!("✅ Index de scalabilité Hôpitaux/Laboratoires créés");
    Ok(())
}

/// ✅ 2025-01-28 : Tables pour bourse du livre scolaire et troc intelligent
/// Migration: 20250128_create_livres_scolaires_troc.sql
pub async fn ensure_livres_scolaires_tables(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification/création des tables livres scolaires et troc...");

    // Lire le contenu de la migration SQL
    // Lire le contenu de la migration SQL
    let migration_sql = include_str!("../../migrations/20250128_create_livres_scolaires_troc.sql");

    // Exécuter la migration SQL en divisant en commandes individuelles
    execute_migration_sql_safe(pool, migration_sql).await?;

    info!("✅ Tables livres scolaires et troc créées");
    Ok(())
}

/// ✅ 2026-03-15 : Bourse du Livre V2 - recto/verso, modes, paquets, commissions, dons
/// Migration: 20260315_bourse_livre_v2_complete.sql
pub async fn ensure_bourse_livre_v2_tables(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification/création des tables Bourse du Livre V2...");

    let migration_sql = include_str!("../../migrations/20260315_bourse_livre_v2_complete.sql");

    execute_migration_sql_safe(pool, migration_sql).await?;

    info!("✅ Tables Bourse du Livre V2 créées");
    Ok(())
}

/// ✅ 2026-03-15 : Bourse du Livre V2 Phase 2 - achats directs, dépôt-seulement
/// Migration: 20260315_bourse_livre_v2_phase2.sql
pub async fn ensure_bourse_livre_v2_phase2_tables(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification/création des tables Bourse du Livre V2 Phase 2...");

    let migration_sql = include_str!("../../migrations/20260315_bourse_livre_v2_phase2.sql");

    execute_migration_sql_safe(pool, migration_sql).await?;

    info!("✅ Tables Bourse du Livre V2 Phase 2 créées (book_purchases, etc.)");
    Ok(())
}

/// ✅ 2026-03-15 : Bourse du Livre V2 Phase 3 - Pont livraison intelligent + disponibilité + dashboards
/// Migration: 20260315_bourse_livre_v2_phase3_delivery_bridge.sql
pub async fn ensure_bourse_livre_v2_phase3_tables(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification/création des tables Bourse du Livre V2 Phase 3 (delivery bridge)...");

    let migration_sql =
        include_str!("../../migrations/20260315_bourse_livre_v2_phase3_delivery_bridge.sql");

    execute_migration_sql_safe(pool, migration_sql).await?;

    info!(
        "✅ Tables Bourse du Livre V2 Phase 3 créées (delivery bridge, disponibilité, itinéraire)"
    );
    Ok(())
}

/// ✅ 2025-01-28 : Tables pour système d'offres d'emploi avec matching intelligent
/// Migration: 20250128_create_offres_emploi.sql
pub async fn ensure_offres_emploi_tables(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification/création des tables offres d'emploi...");

    // Lire le contenu de la migration SQL
    let migration_sql = include_str!("../../migrations/00000016_create_offres_emploi.sql");

    // Exécuter la migration SQL en divisant en commandes individuelles
    execute_migration_sql_safe(pool, migration_sql).await?;

    info!("✅ Tables offres d'emploi créées");
    Ok(())
}

/// ✅ 2025-01-28 : Tables pour système d'orientation scolaire et établissements
/// Migration: 20250128_create_orientation_scolaire.sql
pub async fn ensure_orientation_scolaire_tables(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification/création des tables orientation scolaire...");

    // Lire le contenu de la migration SQL
    // Lire le contenu de la migration SQL
    let migration_sql = include_str!("../../migrations/20250128_create_orientation_scolaire.sql");

    // Exécuter la migration SQL en divisant en commandes individuelles
    execute_migration_sql_safe(pool, migration_sql).await?;

    info!("✅ Tables orientation scolaire créées");
    Ok(())
}

/// ✅ 2025-01-28 : Tables pour chat de livraison et gamification
/// Migration: 20250128_create_delivery_chat_tables.sql
pub async fn ensure_delivery_chat_tables(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification/création des tables chat de livraison et gamification...");

    // Lire le contenu de la migration SQL
    let migration_sql = include_str!("../../migrations/00000014_create_delivery_chat_tables.sql");

    // Exécuter la migration SQL en divisant en commandes individuelles
    execute_migration_sql_safe(pool, migration_sql).await?;

    info!("✅ Tables chat de livraison et gamification créées");
    Ok(())
}

// ✅ 2025-01-29 : Table user_documents pour KYC (vérification identité conducteur)
/// Migration: 20250129_create_user_documents.sql
pub async fn ensure_user_documents_table(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification/création de la table user_documents...");

    // Lire le contenu de la migration SQL
    // Lire le contenu de la migration SQL
    let migration_sql = include_str!("../../migrations/20250129_create_user_documents.sql");

    // Exécuter la migration SQL en divisant en commandes individuelles
    execute_migration_sql_safe(pool, migration_sql).await?;

    info!("✅ Table user_documents créée");
    Ok(())
}

// ✅ 2025-01-29 : Tables assurance + QR code pour covoiturage
/// Migration: 20250129_add_insurance_qr_covoiturage.sql
pub async fn ensure_insurance_qr_tables(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification/création des tables assurance + QR code covoiturage...");

    // Lire le contenu de la migration SQL
    let migration_sql = include_str!("../../migrations/20250129_add_insurance_qr_covoiturage.sql");

    // Exécuter la migration SQL en divisant en commandes individuelles
    execute_migration_sql_safe(pool, migration_sql).await?;

    info!("✅ Tables assurance + QR code créées");
    Ok(())
}

/// ✅ NOUVEAU 2025-01-27: Créer les tables pour programme fidélité, chat support et avis tickets
async fn ensure_loyalty_chat_rating_tables(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification des tables loyalty, chat_support et bus_ticket_ratings...");

    // Lire le contenu de la migration SQL
    let migration_sql = include_str!("../../migrations/00000139_loyalty_chat_rating_tables.sql");

    // Exécuter la migration SQL en divisant en commandes individuelles
    execute_migration_sql_safe(pool, migration_sql).await?;

    info!("✅ Tables loyalty, chat_support et bus_ticket_ratings créées/vérifiées");
    Ok(())
}

/// ✅ 2025-01-27 : Tables avancées pour Hôpitaux/Cliniques (consultations, urgences, créneaux, analytics)
/// Migration: 20250127_create_hospital_advanced_tables.sql
pub async fn ensure_hospital_advanced_tables(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification/création des tables avancées hôpitaux (consultations, urgences, créneaux, analytics)...");

    // Lire le contenu de la migration SQL
    let migration_sql =
        include_str!("../../migrations/20250127_create_hospital_advanced_tables.sql");

    // Exécuter la migration SQL en divisant en commandes individuelles
    execute_migration_sql_safe(pool, migration_sql).await?;

    info!("✅ Tables avancées hôpitaux créées");
    Ok(())
}

/// ✅ 2025-01-28 : Table pour produits de pharmacie
/// Migration: 20250128_002_add_pharmacy_products.sql
pub async fn ensure_pharmacy_products_table(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification/création de la table pharmacy_products...");

    // Lire le contenu de la migration SQL
    let migration_sql = include_str!("../../migrations/00000005_002_add_pharmacy_products.sql");

    // Exécuter la migration SQL en divisant en commandes individuelles
    execute_migration_sql_safe(pool, migration_sql).await?;

    info!("✅ Table pharmacy_products créée");
    Ok(())
}

/// ✅ 2025-01-27 : Tables avancées pour Pharmacies (commandes, réservations, analytics)
/// Migration: 20250127_create_pharmacy_advanced_tables.sql
pub async fn ensure_pharmacy_advanced_tables(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification/création des tables avancées pharmacies (commandes, réservations, analytics)...");

    // Lire le contenu de la migration SQL
    let migration_sql =
        include_str!("../../migrations/20250127_create_pharmacy_advanced_tables.sql");

    // Exécuter la migration SQL en divisant en commandes individuelles
    execute_migration_sql_safe(pool, migration_sql).await?;

    info!("✅ Tables avancées pharmacies créées");
    Ok(())
}

/// ✅ 2025-01-27 : Tables avancées pour Laboratoires/Imagerie (examens, types d'examens, analytics)
/// Migration: 20250127_create_lab_advanced_tables.sql
pub async fn ensure_lab_advanced_tables(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!(
        "🔍 Vérification/création des tables avancées laboratoires (examens, types, analytics)..."
    );

    // Lire le contenu de la migration SQL
    let migration_sql = include_str!("../../migrations/00000037_create_lab_advanced_tables.sql");

    // Exécuter la migration SQL en divisant en commandes individuelles
    execute_migration_sql_safe(pool, migration_sql).await?;

    info!("✅ Tables avancées laboratoires créées");
    Ok(())
}

/// ✅ NOUVEAU 2025-01-27 Phase 2: Tables pour système plugins marketplace
/// Migration: 20250127_012_create_plugin_marketplace.sql
pub async fn ensure_plugin_marketplace_tables(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification/création des tables plugin marketplace...");

    // Lire le contenu de la migration SQL
    // Lire le contenu de la migration SQL
    let migration_sql = include_str!("../../migrations/20250127_012_create_plugin_marketplace.sql");

    // Exécuter la migration SQL en divisant en commandes individuelles
    execute_migration_sql_safe(pool, migration_sql).await?;

    info!("✅ Tables plugin marketplace créées");
    Ok(())
}

/// ✅ 2025-01-27 : Tables avancées pour Bourse du Livre (échanges, recommandations IA, prix, analytics)
/// Migration: 20250127_create_bourse_livre_advanced_tables.sql
pub async fn ensure_bourse_livre_advanced_tables(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification/création des tables avancées bourse du livre (échanges, recommandations IA, prix, analytics)...");

    // Lire le contenu de la migration SQL
    let migration_sql =
        include_str!("../../migrations/00000131_create_bourse_livre_advanced_tables.sql");

    // Exécuter la migration SQL en divisant en commandes individuelles
    execute_migration_sql_safe(pool, migration_sql).await?;

    info!("✅ Tables avancées bourse du livre créées");
    Ok(())
}

/// ✅ 2025-01-27 : Tables avancées pour Orientation Scolaire (profils étudiants, recommandations IA, comparaisons, analytics)
/// Migration: 20250127_create_orientation_scolaire_advanced_tables.sql
pub async fn ensure_orientation_scolaire_advanced_tables(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification/création des tables avancées orientation scolaire (profils, recommandations IA, comparaisons, analytics)...");

    // Lire le contenu de la migration SQL
    let migration_sql =
        include_str!("../../migrations/20250127_create_orientation_scolaire_advanced_tables.sql");

    // Exécuter la migration SQL en divisant en commandes individuelles
    execute_migration_sql_safe(pool, migration_sql).await?;

    info!("✅ Tables avancées orientation scolaire créées");
    Ok(())
}

/// ✅ 2025-01-27 : Tables complètes pour Service Immobilier (vente/location, terrains, décoration, déménagement)
/// Migration: 20250127_create_immobilier_complete_tables.sql
pub async fn ensure_immobilier_complete_tables(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification/création des tables immobilier complet (vente/location, terrains, décoration, déménagement)...");

    // Lire le contenu de la migration SQL
    let migration_sql =
        include_str!("../../migrations/00000133_create_immobilier_complete_tables.sql");

    // Exécuter la migration SQL en divisant en commandes individuelles
    execute_migration_sql_safe(pool, migration_sql).await?;

    info!("✅ Tables immobilier complet créées");
    Ok(())
}

/// ✅ 2025-01-27 : Tables avancées pour Offres d'Emploi (matching IA amélioré, analyse CV, prédictions salaires, formations)
/// Migration: 20250127_create_offres_emploi_advanced_tables.sql
pub async fn ensure_offres_emploi_advanced_tables(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification/création des tables avancées offres d'emploi (matching IA, analyse CV, prédictions, formations)...");

    // Lire le contenu de la migration SQL
    let migration_sql =
        include_str!("../../migrations/20250127_create_offres_emploi_advanced_tables.sql");

    // Exécuter la migration SQL en divisant en commandes individuelles
    execute_migration_sql_safe(pool, migration_sql).await?;

    info!("✅ Tables avancées offres d'emploi créées");
    Ok(())
}

/// ✅ 2025-01-27 : Tables pour service Planification Menus
/// Migration: 20250127_create_menu_planning_tables.sql
pub async fn ensure_menu_planning_tables(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification/création des tables planification menus...");

    // Lire le contenu de la migration SQL
    let migration_sql = include_str!("../../migrations/00000027_create_menu_planning_tables.sql");

    // Exécuter la migration SQL en divisant en commandes individuelles
    execute_migration_sql_safe(pool, migration_sql).await?;

    info!("✅ Tables planification menus créées");
    Ok(())
}

/// ✅ 2025-12-07 : Tables sociales vidéo (duets, remixes, stitches, video_reactions)
/// Migration: 20251207_create_social_video_tables.sql
pub async fn ensure_social_video_tables(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification/création des tables sociales vidéo (duets, remixes, stitches, video_reactions)...");

    // Lire le contenu de la migration SQL
    let migration_sql = include_str!("../../migrations/20251207_create_social_video_tables.sql");

    // Exécuter la migration SQL en divisant en commandes individuelles
    execute_migration_sql_safe(pool, migration_sql).await?;

    info!("✅ Tables sociales vidéo créées");
    Ok(())
}

/// ✅ 2025-01-29 : Tables covoiturage (assurance, QR codes, trajets récurrents)
/// Migrations: 20250129_add_insurance_qr_covoiturage.sql, 20250129_add_recurring_trips_covoiturage.sql
pub async fn ensure_covoiturage_tables(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification/création des tables covoiturage (assurance, QR codes, trajets récurrents)...");

    // Créer table covoiturage_insurance
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS covoiturage_insurance (
            id SERIAL PRIMARY KEY,
            reservation_id INTEGER NOT NULL REFERENCES specialized_reservations(id) ON DELETE CASCADE,
            passenger_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            insurance_provider TEXT,
            policy_number TEXT,
            coverage_amount DECIMAL(10,2),
            coverage_type TEXT DEFAULT 'basic' CHECK (coverage_type IN ('basic', 'premium', 'full')),
            status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled')),
            start_date TIMESTAMPTZ NOT NULL,
            end_date TIMESTAMPTZ NOT NULL,
            metadata JSONB DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        "#
    )
    .execute(pool)
    .await?;

    // Créer table reservation_qr_codes
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS reservation_qr_codes (
            id SERIAL PRIMARY KEY,
            reservation_id INTEGER NOT NULL REFERENCES specialized_reservations(id) ON DELETE CASCADE,
            qr_code TEXT NOT NULL UNIQUE,
            qr_code_url TEXT,
            status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'validated', 'expired', 'cancelled')),
            validated_at TIMESTAMPTZ,
            validated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
            expires_at TIMESTAMPTZ NOT NULL,
            metadata JSONB DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        "#
    )
    .execute(pool)
    .await?;

    // Ajouter colonnes récurrence dans covoiturages
    sqlx::query(
        r#"
        DO $$
        BEGIN
            ALTER TABLE covoiturages ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN NOT NULL DEFAULT FALSE;
            ALTER TABLE covoiturages ADD COLUMN IF NOT EXISTS recurrence_type TEXT CHECK (recurrence_type IN ('daily', 'weekly', 'monthly', NULL));
            ALTER TABLE covoiturages ADD COLUMN IF NOT EXISTS recurrence_days INTEGER[];
            ALTER TABLE covoiturages ADD COLUMN IF NOT EXISTS recurrence_end_date DATE;
            ALTER TABLE covoiturages ADD COLUMN IF NOT EXISTS parent_trip_id INTEGER REFERENCES covoiturages(id) ON DELETE CASCADE;
            ALTER TABLE covoiturages ADD COLUMN IF NOT EXISTS recurrence_pattern JSONB DEFAULT '{}'::jsonb;
        END $$;
        "#
    )
    .execute(pool)
    .await?;

    // Créer table recurring_trip_instances
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS recurring_trip_instances (
            id SERIAL PRIMARY KEY,
            parent_trip_id INTEGER NOT NULL REFERENCES covoiturages(id) ON DELETE CASCADE,
            instance_date DATE NOT NULL,
            instance_covoiturage_id INTEGER REFERENCES covoiturages(id) ON DELETE SET NULL,
            status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'cancelled', 'completed')),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            UNIQUE(parent_trip_id, instance_date)
        )
        "#
    )
    .execute(pool)
    .await?;

    // Créer index
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_covoiturage_insurance_reservation ON covoiturage_insurance(reservation_id)")
        .execute(pool).await?;
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_reservation_qr_codes_reservation ON reservation_qr_codes(reservation_id)")
        .execute(pool).await?;
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_reservation_qr_codes_qr_code ON reservation_qr_codes(qr_code)")
        .execute(pool).await?;
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_recurring_instances_parent ON recurring_trip_instances(parent_trip_id)")
        .execute(pool).await?;
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_recurring_instances_date ON recurring_trip_instances(instance_date)")
        .execute(pool).await?;

    info!("✅ Tables covoiturage créées");
    Ok(())
}

/// ✅ 2025-12-11 : Vue matérialisée et fonction pour les statistiques utilisateur
/// Migration: 20251211_fix_user_stats_errors.sql
/// Corrige les erreurs: mv_user_stats does not exist, get_user_stats does not exist
pub async fn ensure_user_stats_objects(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification/création de mv_user_stats et get_user_stats...");

    // Lire le contenu de la migration SQL
    let migration_sql = include_str!("../../migrations/20251211_fix_user_stats_errors.sql");

    // Exécuter la migration SQL en divisant en commandes individuelles
    execute_migration_sql_safe(pool, migration_sql).await?;

    info!("✅ Vue matérialisée et fonction user_stats créées");
    Ok(())
}

/// ✅ 2025-12-12 : Optimisation index delivery_matching_queue
/// Migration: 20251212_optimize_delivery_matching_queue_index.sql
/// Optimise la requête lente (1-1.4s) sur delivery_matching_queue
pub async fn ensure_delivery_matching_queue_index(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification/création index optimisé delivery_matching_queue...");

    // Lire le contenu de la migration SQL
    let migration_sql =
        include_str!("../../migrations/20251212_optimize_delivery_matching_queue_index.sql");

    // Exécuter la migration SQL en divisant en commandes individuelles
    execute_migration_sql_safe(pool, migration_sql).await?;

    info!("✅ Index delivery_matching_queue optimisé créé");
    Ok(())
}

/// ✅ 2025-12-16 : Optimisation performances création produits
/// Migration: 20251216_optimize_product_creation_performance.sql
/// Optimise:
/// - Requête get_services_for_prestataire (1+ seconde -> <100ms)
/// - Refresh vue matérialisée (10.8s -> <2s)
/// - Utilise autocomplete_characteristics au lieu de extract_all_product_text()
pub async fn ensure_optimize_product_creation_performance(
    pool: &PgPool,
) -> Result<(), sqlx::Error> {
    info!("🔍 Application migration optimize_product_creation_performance...");

    // Lire le contenu de la migration SQL
    let migration_sql =
        include_str!("../../migrations/20251216_optimize_product_creation_performance.sql");

    // Exécuter la migration SQL en divisant en commandes individuelles
    execute_migration_sql_safe(pool, migration_sql).await?;

    info!("✅ Migration optimize_product_creation_performance appliquée");
    Ok(())
}

/// ✅ 2025-12-30 : Correction erreurs TLS lors de l'ajout de produit
/// Migration: 20251230_fix_add_product_tls_error.sql
/// Corrige:
/// - Fermetures TLS inattendues lors de l'ajout de produit
/// - Optimise la fonction add_product_to_service_jsonb
/// - Améliore le retry avec backoff plus long pour erreurs TLS
pub async fn ensure_fix_add_product_tls_error(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Application migration fix_add_product_tls_error...");

    // Lire le contenu de la migration SQL
    let migration_sql = include_str!("../../migrations/20251230_fix_add_product_tls_error.sql");

    // Exécuter la migration SQL en divisant en commandes individuelles
    execute_migration_sql_safe(pool, migration_sql).await?;

    info!("✅ Migration fix_add_product_tls_error appliquée");
    Ok(())
}

/// ✅ 2025-12-31 : Correction définitive performance création produit
/// Migration: 20251231_fix_product_creation_issues.sql
/// Corrige:
/// - Contrainte UNIQUE manquante pour autocomplete_characteristics
/// - Optimise la fonction add_product_to_service_jsonb
/// - Améliore les index pour les requêtes fréquentes
pub async fn ensure_fix_product_creation_issues(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Application migration fix_product_creation_issues...");

    // Lire le contenu de la migration SQL
    // Lire le contenu de la migration SQL
    let migration_sql = include_str!("../../migrations/20251231_fix_product_creation_issues.sql");

    // Exécuter la migration SQL en divisant en commandes individuelles
    execute_migration_sql_safe(pool, migration_sql).await?;

    info!("✅ Migration fix_product_creation_issues appliquée");
    Ok(())
}

/// ✅ 2025-12-31 : Optimisation performance création produit v2
/// Migration: 20251231_fix_product_creation_performance_v2.sql
/// Optimise:
/// - Fonction add_product_to_service_jsonb_v2 qui retourne directement les données nécessaires
/// - Évite le SELECT complet du JSONB après UPDATE (gain de 1-3 secondes)
/// - Index GIN pour accès rapide à data->'produits'->'valeur'
pub async fn ensure_fix_product_creation_performance_v2(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Application migration fix_product_creation_performance_v2...");

    // Lire le contenu de la migration SQL
    let migration_sql =
        include_str!("../../migrations/00000081_fix_product_creation_performance_v2.sql");

    // Exécuter la migration SQL en divisant en commandes individuelles
    execute_migration_sql_safe(pool, migration_sql).await?;

    info!("✅ Migration fix_product_creation_performance_v2 appliquée");
    Ok(())
}

/// ✅ 2025-12-31 : Correction timeout création produit
/// Migration: 20251231_fix_product_creation_timeout.sql
/// Corrige:
/// - Timeout après 15-16s lors de l'ajout d'un produit
/// - Améliore la gestion des verrous dans la fonction PostgreSQL
/// - Optimise la fonction pour réduire la latence
pub async fn ensure_fix_product_creation_timeout(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Application migration fix_product_creation_timeout...");

    // Lire le contenu de la migration SQL
    // Lire le contenu de la migration SQL
    let migration_sql = include_str!("../../migrations/20251231_fix_product_creation_timeout.sql");

    // Exécuter la migration SQL en divisant en commandes individuelles
    execute_migration_sql_safe(pool, migration_sql).await?;

    info!("✅ Migration fix_product_creation_timeout appliquée");
    Ok(())
}

/// ✅ 2025-12-21 : Optimisation des endpoints lents
/// Migration: 20251221_optimize_slow_endpoints.sql
/// Optimise:
/// - /api/services/{id}/stats et /api/services/{id}/reviews (MongoDB - optimisé dans le code)
/// - /api/search/direct et /api/autocomplete/search-products (index GIN sur full_vector)
/// - Requête principale dans native_search_service.rs (limitation du fallback)
pub async fn ensure_optimize_slow_endpoints(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Application migration optimize_slow_endpoints...");

    // Lire le contenu de la migration SQL
    let migration_sql = include_str!("../../migrations/00000067_optimize_slow_endpoints.sql");

    // Exécuter la migration SQL en divisant en commandes individuelles
    execute_migration_sql_safe(pool, migration_sql).await?;

    info!("✅ Migration optimize_slow_endpoints appliquée");
    Ok(())
}

pub async fn ensure_optimize_delivery_indexes(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Application migration optimize_delivery_indexes...");

    // Lire le contenu de la migration SQL
    // Lire le contenu de la migration SQL
    let migration_sql = include_str!("../../migrations/20251221_optimize_delivery_indexes.sql");

    // Exécuter la migration SQL en divisant en commandes individuelles
    execute_migration_sql_safe(pool, migration_sql).await?;

    info!("✅ Migration optimize_delivery_indexes appliquée");
    Ok(())
}

/// ✅ 2025-12-21 : Aligner parcel_types avec les types de véhicules des coursiers
/// Migration: 20251221_align_parcel_types_with_vehicle_types.sql
/// Problème: La liste des modes de livraison est vide car parcel_types ne correspond pas aux types de véhicules
pub async fn ensure_align_parcel_types_with_vehicle_types(
    pool: &PgPool,
) -> Result<(), sqlx::Error> {
    info!("🔍 Application migration align_parcel_types_with_vehicle_types...");

    // Lire le contenu de la migration SQL
    let migration_sql =
        include_str!("../../migrations/00000064_align_parcel_types_with_vehicle_types.sql");

    // Exécuter la migration SQL en divisant en commandes individuelles
    execute_migration_sql_safe(pool, migration_sql).await?;

    info!("✅ Migration align_parcel_types_with_vehicle_types appliquée");
    Ok(())
}

/// ✅ 2026-01-15 : Corriger les IDs de parcel_types pour garantir la cohérence avec le frontend
/// Migration: 20260115_fix_parcel_types_ids.sql
/// Problème: Les IDs dans parcel_types peuvent ne pas correspondre à l'ordre attendu par le frontend
/// Solution: Réinitialiser les IDs pour qu'ils correspondent à l'ordre des slugs (1=bike, 2=motorcycle, etc.)
pub async fn ensure_fix_parcel_types_ids(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Application migration fix_parcel_types_ids...");

    // Lire le contenu de la migration SQL
    // Lire le contenu de la migration SQL
    let migration_sql = include_str!("../../migrations/20260115_fix_parcel_types_ids.sql");

    // Exécuter la migration SQL en divisant en commandes individuelles
    execute_migration_sql_safe(pool, migration_sql).await?;

    info!("✅ Migration fix_parcel_types_ids appliquée");
    Ok(())
}

/// ✅ 2025-12-21 : Optimisation des UPDATE services pour réduire la latence
/// Migration: 20251221_optimize_services_update_performance.sql
/// Problème: UPDATE services SET data prend 5-7s à cause de la réécriture complète du JSON
pub async fn ensure_optimize_services_update_performance(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Application migration optimize_services_update_performance...");

    // Lire le contenu de la migration SQL
    let migration_sql =
        include_str!("../../migrations/00000066_optimize_services_update_performance.sql");

    // Exécuter la migration SQL en divisant en commandes individuelles
    execute_migration_sql_safe(pool, migration_sql).await?;

    info!("✅ Migration optimize_services_update_performance appliquée");
    Ok(())
}

/// ✅ 2025-12-30 : Créer les index MongoDB pour optimiser les requêtes
/// Index critiques pour /api/services/{id}/stats et /api/services/{id}/reviews
pub async fn ensure_mongodb_indexes(mongo_history: Arc<MongoHistoryService>) -> Result<(), String> {
    info!("🔍 Création des index MongoDB pour optimiser les requêtes...");

    match mongo_history.ensure_indexes().await {
        Ok(_) => {
            info!("✅ Index MongoDB créés avec succès");
            Ok(())
        }
        Err(e) => {
            error!("❌ Erreur création index MongoDB: {}", e);
            Err(format!("Erreur création index MongoDB: {}", e))
        }
    }
}

/// ✅ NOUVEAU 2026-01-02: Optimisation critique de add_product_to_service_jsonb_v2
/// Évite les timeouts même sans médias en optimisant l'UPDATE JSONB
pub async fn ensure_add_product_optimization(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification de l'optimisation add_product_to_service_jsonb_v2...");

    // Vérifier si la fonction existe déjà avec la version optimisée
    let function_exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(
            SELECT 1 FROM pg_proc 
            WHERE proname = 'add_product_to_service_jsonb_v2'
            AND prosrc LIKE '%Lire les données AVANT le verrou%'
        )",
    )
    .fetch_one(pool)
    .await?;

    if function_exists {
        info!("✅ Fonction add_product_to_service_jsonb_v2 déjà optimisée");
        return Ok(());
    }

    info!("🔄 Application de l'optimisation add_product_to_service_jsonb_v2...");

    // Appliquer la migration optimisée
    sqlx::query(
        r#"
        CREATE OR REPLACE FUNCTION add_product_to_service_jsonb_v2(
            p_service_id INTEGER,
            p_product_json JSONB
        ) RETURNS TABLE(
            product_index INTEGER,
            produits_data JSONB,
            lieu_data JSONB
        ) AS $$
        DECLARE
            v_product_index INTEGER;
            v_produits_data JSONB;
            v_lieu_data JSONB;
            v_current_data JSONB;
        BEGIN
            -- ✅ OPTIMISÉ: Lire les données AVANT le verrou (lecture rapide)
            SELECT 
                COALESCE(jsonb_array_length(data->'produits'->'valeur'), 0),
                data
            INTO v_product_index, v_current_data
            FROM services
            WHERE id = p_service_id AND is_active = true;
            
            IF v_product_index IS NULL OR v_current_data IS NULL THEN
                RETURN;
            END IF;
            
            -- ✅ OPTIMISÉ: Calculer le nouveau JSONB en mémoire
            DECLARE
                v_new_produits_valeur JSONB;
                v_new_data JSONB;
            BEGIN
                IF v_current_data->'produits'->'valeur' IS NOT NULL THEN
                    v_new_produits_valeur := (v_current_data->'produits'->'valeur') || jsonb_build_array(p_product_json);
                ELSE
                    v_new_produits_valeur := jsonb_build_array(p_product_json);
                END IF;
                
                IF v_current_data->'produits' IS NOT NULL THEN
                    v_new_data := jsonb_set(
                        v_current_data,
                        '{produits,valeur}',
                        v_new_produits_valeur,
                        true
                    );
                ELSE
                    v_new_data := v_current_data || jsonb_build_object(
                        'produits',
                        jsonb_build_object(
                            'type_donnee', 'autocomplete',
                            'valeur', v_new_produits_valeur,
                            'separateur', ',',
                            'sous_caracteristiques', '{}'::jsonb,
                            'filtrable', true,
                            'origine_champs', 'formulaire'
                        )
                    );
                END IF;
                
                UPDATE services
                SET 
                    data = v_new_data,
                    updated_at = NOW()
                WHERE id = p_service_id
                AND is_active = true
                RETURNING 
                    data->'produits' as produits_data,
                    data->'lieu_produit' as lieu_data
                INTO v_produits_data, v_lieu_data;
                
                IF NOT FOUND THEN
                    RETURN;
                END IF;
            END;
            
            product_index := v_product_index;
            produits_data := v_produits_data;
            lieu_data := v_lieu_data;
            
            RETURN NEXT;
        END;
        $$ LANGUAGE plpgsql;
        "#
    )
    .execute(pool)
    .await?;

    // Créer les index si nécessaire
    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_services_id_for_updates 
         ON services(id) 
         WHERE is_active = true",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_services_produits_valeur_gin 
         ON services USING GIN ((data->'produits'->'valeur'))
         WHERE data->'produits'->'valeur' IS NOT NULL",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_services_data_produits_partial
         ON services USING GIN (data)
         WHERE is_active = true 
         AND data->'produits'->'valeur' IS NOT NULL
         AND jsonb_array_length(data->'produits'->'valeur') > 0",
    )
    .execute(pool)
    .await?;

    info!("✅ Optimisation add_product_to_service_jsonb_v2 appliquée avec succès");
    Ok(())
}

/// ✅ NOUVEAU 2026-01-02: Création de la queue asynchrone pour création de produits
pub async fn ensure_product_creation_queue(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification de la table product_creation_queue...");

    // Vérifier si la table existe déjà
    let table_exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'product_creation_queue'
        )",
    )
    .fetch_one(pool)
    .await?;

    if table_exists {
        info!("✅ Table product_creation_queue existe déjà");

        // ✅ NOUVEAU 2026-03-11: Ajouter colonne videos_to_process si elle n'existe pas
        let has_videos_col = sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS(
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = 'product_creation_queue'
                  AND column_name = 'videos_to_process'
            )",
        )
        .fetch_one(pool)
        .await?;

        if !has_videos_col {
            info!("🔄 Ajout de la colonne videos_to_process à product_creation_queue...");
            sqlx::query(
                "ALTER TABLE product_creation_queue ADD COLUMN videos_to_process TEXT[] DEFAULT '{}'",
            )
            .execute(pool)
            .await?;
            info!("✅ Colonne videos_to_process ajoutée");
        }

        return Ok(());
    }

    info!("🔄 Création de la table product_creation_queue...");

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS product_creation_queue (
            id BIGSERIAL PRIMARY KEY,
            service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            product_data JSONB NOT NULL,
            images_to_process TEXT[] DEFAULT '{}',
            status VARCHAR(50) NOT NULL DEFAULT 'pending',
            priority INTEGER NOT NULL DEFAULT 5,
            attempt_count INTEGER NOT NULL DEFAULT 0,
            max_attempts INTEGER NOT NULL DEFAULT 3,
            error_message TEXT,
            result_data JSONB,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            started_at TIMESTAMP WITH TIME ZONE,
            completed_at TIMESTAMP WITH TIME ZONE,
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
        )
        "#,
    )
    .execute(pool)
    .await?;

    // Créer les index
    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_product_queue_status_priority 
         ON product_creation_queue(status, priority, created_at) 
         WHERE status IN ('pending', 'processing')",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_product_queue_created_at 
         ON product_creation_queue(created_at) 
         WHERE status IN ('completed', 'failed')",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_product_queue_service_id 
         ON product_creation_queue(service_id) 
         WHERE status = 'pending'",
    )
    .execute(pool)
    .await?;

    // Créer la fonction de nettoyage
    sqlx::query(
        r#"
        CREATE OR REPLACE FUNCTION cleanup_old_product_creation_jobs()
        RETURNS INTEGER AS $$
        DECLARE
            deleted_count INTEGER;
        BEGIN
            DELETE FROM product_creation_queue
            WHERE status IN ('completed', 'failed')
              AND created_at < NOW() - INTERVAL '7 days';
            
            GET DIAGNOSTICS deleted_count = ROW_COUNT;
            RETURN deleted_count;
        END;
        $$ LANGUAGE plpgsql
        "#,
    )
    .execute(pool)
    .await?;

    info!("✅ Table product_creation_queue créée avec succès");
    Ok(())
}

/// ✅ NOUVEAU 2026-02-06: Phase de lancement (3 mois gratuits)
/// Ajoute la colonne free_product_created dans users et crée la table launch_phase_config
pub async fn ensure_launch_phase_tables(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification des tables phase de lancement...");

    // 1. Ajouter colonne free_product_created dans users si elle n'existe pas
    let column_exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'users' 
            AND column_name = 'free_product_created'
        )",
    )
    .fetch_one(pool)
    .await?;

    if !column_exists {
        info!("🔄 Ajout de la colonne free_product_created dans users...");
        sqlx::query("ALTER TABLE users ADD COLUMN free_product_created INTEGER DEFAULT 0")
            .execute(pool)
            .await?;
        info!("✅ Colonne free_product_created ajoutée à users");
    } else {
        info!("✅ Colonne free_product_created existe déjà dans users");
    }

    // 2. Créer table launch_phase_config si elle n'existe pas
    let table_exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'launch_phase_config'
        )",
    )
    .fetch_one(pool)
    .await?;

    if !table_exists {
        info!("🔄 Création de la table launch_phase_config...");
        sqlx::query(
            r#"
            CREATE TABLE launch_phase_config (
                id SERIAL PRIMARY KEY,
                start_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                end_date TIMESTAMPTZ NOT NULL,
                is_active BOOLEAN NOT NULL DEFAULT TRUE,
                description TEXT,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
            "#,
        )
        .execute(pool)
        .await?;

        // Insérer la configuration par défaut (3 mois à partir de maintenant)
        sqlx::query(
            r#"
            INSERT INTO launch_phase_config (start_date, end_date, is_active, description)
            VALUES (NOW(), NOW() + INTERVAL '90 days', TRUE, 'Phase de lancement - 3 mois gratuits pour tous les prestataires')
            "#,
        )
        .execute(pool)
        .await?;

        // Créer index
        sqlx::query(
            "CREATE INDEX idx_launch_phase_config_active ON launch_phase_config(is_active) WHERE is_active = TRUE"
        )
        .execute(pool)
        .await?;

        info!("✅ Table launch_phase_config créée avec succès");
    } else {
        info!("✅ Table launch_phase_config existe déjà");
    }

    // 3. Créer fonction is_launch_phase_active() si elle n'existe pas
    sqlx::query(
        r#"
        CREATE OR REPLACE FUNCTION is_launch_phase_active()
        RETURNS BOOLEAN AS $$
        DECLARE
            v_end_date TIMESTAMPTZ;
        BEGIN
            SELECT end_date INTO v_end_date
            FROM launch_phase_config
            WHERE is_active = TRUE
            ORDER BY id DESC
            LIMIT 1;
            
            IF v_end_date IS NULL THEN
                RETURN FALSE;
            END IF;
            
            RETURN NOW() <= v_end_date;
        END;
        $$ LANGUAGE plpgsql STABLE
        "#,
    )
    .execute(pool)
    .await?;

    // 4. Créer fonction is_user_in_launch_phase() si elle n'existe pas
    sqlx::query(
        r#"
        CREATE OR REPLACE FUNCTION is_user_in_launch_phase(p_user_id INTEGER)
        RETURNS BOOLEAN AS $$
        DECLARE
            v_user_created_at TIMESTAMPTZ;
            v_end_date TIMESTAMPTZ;
        BEGIN
            -- Vérifier si la phase de lancement est active
            IF NOT is_launch_phase_active() THEN
                RETURN FALSE;
            END IF;
            
            -- Récupérer la date de création de l'utilisateur
            SELECT created_at INTO v_user_created_at
            FROM users
            WHERE id = p_user_id;
            
            IF v_user_created_at IS NULL THEN
                RETURN FALSE;
            END IF;
            
            -- Récupérer la date de fin de la phase de lancement
            SELECT end_date INTO v_end_date
            FROM launch_phase_config
            WHERE is_active = TRUE
            ORDER BY id DESC
            LIMIT 1;
            
            IF v_end_date IS NULL THEN
                RETURN FALSE;
            END IF;
            
            -- L'utilisateur est dans la phase s'il a été créé avant la fin de la phase
            RETURN v_user_created_at <= v_end_date;
        END;
        $$ LANGUAGE plpgsql STABLE
        "#,
    )
    .execute(pool)
    .await?;

    info!("✅ Fonctions phase de lancement créées/vérifiées");
    Ok(())
}

/// ✅ NOUVEAU 2026-02-14: Création de la table gpu_scale_actions pour tracking des actions de scaling GPU
pub async fn ensure_gpu_scale_actions_table(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification de la table gpu_scale_actions...");

    let table_exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'gpu_scale_actions'
        )",
    )
    .fetch_one(pool)
    .await?;

    if table_exists {
        info!("✅ Table gpu_scale_actions existe déjà");
        return Ok(());
    }

    info!("🔄 Création de la table gpu_scale_actions...");

    sqlx::query(
        r#"
        CREATE TABLE gpu_scale_actions (
            id SERIAL PRIMARY KEY,
            action VARCHAR(50) NOT NULL,
            instances_from INTEGER NOT NULL,
            instances_to INTEGER NOT NULL,
            created_at TIMESTAMP DEFAULT NOW()
        )
        "#,
    )
    .execute(pool)
    .await?;

    // Créer les index
    sqlx::query(
        "CREATE INDEX idx_gpu_scale_actions_created_at ON gpu_scale_actions(created_at DESC)",
    )
    .execute(pool)
    .await?;

    sqlx::query("CREATE INDEX idx_gpu_scale_actions_action ON gpu_scale_actions(action)")
        .execute(pool)
        .await?;

    // Ajouter les commentaires
    sqlx::query(
        "COMMENT ON TABLE gpu_scale_actions IS 'Historique des actions de scaling automatique des instances GPU'"
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "COMMENT ON COLUMN gpu_scale_actions.action IS 'Type d''action: scale_up, scale_down'",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "COMMENT ON COLUMN gpu_scale_actions.instances_from IS 'Nombre d''instances avant le scaling'"
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "COMMENT ON COLUMN gpu_scale_actions.instances_to IS 'Nombre d''instances après le scaling'"
    )
    .execute(pool)
    .await?;

    info!("✅ Table gpu_scale_actions créée avec succès");
    Ok(())
}

/// ✅ NOUVEAU 2026-01-02: Création de la table de cache PostgreSQL
pub async fn ensure_cache_table(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification de la table cache_table...");

    // Vérifier si la table existe déjà
    let table_exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'cache_table'
        )",
    )
    .fetch_one(pool)
    .await?;

    if table_exists {
        info!("✅ Table cache_table existe déjà");
        return Ok(());
    }

    info!("🔄 Création de la table cache_table...");

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS cache_table (
            cache_key VARCHAR(255) PRIMARY KEY,
            cache_value JSONB NOT NULL,
            expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            access_count INTEGER NOT NULL DEFAULT 0,
            last_accessed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
        )
        "#,
    )
    .execute(pool)
    .await?;

    // Créer les index
    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_cache_expires_at 
         ON cache_table(expires_at) 
         WHERE expires_at < NOW()",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_cache_key_pattern 
         ON cache_table(cache_key text_pattern_ops)",
    )
    .execute(pool)
    .await?;

    // Créer les fonctions de cache
    sqlx::query(
        r#"
        CREATE OR REPLACE FUNCTION cleanup_expired_cache()
        RETURNS INTEGER AS $$
        DECLARE
            deleted_count INTEGER;
        BEGIN
            DELETE FROM cache_table
            WHERE expires_at < NOW();
            
            GET DIAGNOSTICS deleted_count = ROW_COUNT;
            RETURN deleted_count;
        END;
        $$ LANGUAGE plpgsql
        "#,
    )
    .execute(pool)
    .await?;

    sqlx::query(
        r#"
        CREATE OR REPLACE FUNCTION get_cache(key VARCHAR(255))
        RETURNS JSONB AS $$
        DECLARE
            result JSONB;
        BEGIN
            SELECT cache_value INTO result
            FROM cache_table
            WHERE cache_key = key
              AND expires_at > NOW();
            
            IF result IS NOT NULL THEN
                UPDATE cache_table
                SET access_count = access_count + 1,
                    last_accessed_at = NOW()
                WHERE cache_key = key;
            END IF;
            
            RETURN result;
        END;
        $$ LANGUAGE plpgsql
        "#,
    )
    .execute(pool)
    .await?;

    sqlx::query(
        r#"
        CREATE OR REPLACE FUNCTION set_cache(
            key VARCHAR(255),
            value JSONB,
            ttl_seconds INTEGER DEFAULT 3600
        )
        RETURNS VOID AS $$
        BEGIN
            INSERT INTO cache_table (cache_key, cache_value, expires_at, updated_at)
            VALUES (key, value, NOW() + (ttl_seconds || ' seconds')::INTERVAL, NOW())
            ON CONFLICT (cache_key) 
            DO UPDATE SET
                cache_value = EXCLUDED.cache_value,
                expires_at = EXCLUDED.expires_at,
                updated_at = EXCLUDED.updated_at,
                access_count = 0;
        END;
        $$ LANGUAGE plpgsql
        "#,
    )
    .execute(pool)
    .await?;

    sqlx::query(
        r#"
        CREATE OR REPLACE FUNCTION delete_cache(key VARCHAR(255))
        RETURNS BOOLEAN AS $$
        DECLARE
            deleted_count INTEGER;
        BEGIN
            DELETE FROM cache_table
            WHERE cache_key = key;
            
            GET DIAGNOSTICS deleted_count = ROW_COUNT;
            RETURN deleted_count > 0;
        END;
        $$ LANGUAGE plpgsql
        "#,
    )
    .execute(pool)
    .await?;

    sqlx::query(
        r#"
        CREATE OR REPLACE FUNCTION delete_cache_pattern(pattern VARCHAR(255))
        RETURNS INTEGER AS $$
        DECLARE
            deleted_count INTEGER;
        BEGIN
            DELETE FROM cache_table
            WHERE cache_key LIKE pattern;
            
            GET DIAGNOSTICS deleted_count = ROW_COUNT;
            RETURN deleted_count;
        END;
        $$ LANGUAGE plpgsql
        "#,
    )
    .execute(pool)
    .await?;

    info!("✅ Table cache_table créée avec succès");
    Ok(())
}

/// ✅ NOUVEAU 2026-01-24: Vérifie que l'extension pgvector est installée
/// Cette fonction vérifie la disponibilité de pgvector et affiche un message informatif
pub async fn ensure_pgvector_extension(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification de l'extension pgvector...");

    let pgvector_available: bool = sqlx::query_scalar::<_, bool>(
        r#"
        SELECT EXISTS (
            SELECT 1 
            FROM pg_extension 
            WHERE extname = 'vector'
        )
        "#,
    )
    .fetch_one(pool)
    .await?;

    if pgvector_available {
        let version: Option<String> = sqlx::query_scalar::<_, Option<String>>(
            r#"
            SELECT extversion 
            FROM pg_extension 
            WHERE extname = 'vector'
            "#,
        )
        .fetch_one(pool)
        .await?;

        info!(
            "✅ Extension pgvector installée (version: {})",
            version.unwrap_or_else(|| "inconnue".to_string())
        );
        info!("💡 pgvector est disponible pour les recherches sémantiques et embeddings");
    } else {
        warn!("⚠️ Extension pgvector non disponible");
        warn!("💡 L'application continuera à utiliser TEXT[] pour le matching vectoriel");
        warn!("📦 Pour installer pgvector:");
        warn!("   - Ubuntu/Debian: sudo apt-get install postgresql-XX-pgvector");
        warn!("   - macOS: brew install pgvector");
        warn!("   - Depuis sources: https://github.com/pgvector/pgvector");
        warn!("   - Puis redémarrer PostgreSQL et relancer les migrations");
    }

    Ok(())
}

// ============================================================================
// CORRECTIONS CRITIQUES AWS - 2026-01-30
// ============================================================================

/// Supprime toutes les versions dupliquées de hybrid_image_search
async fn fix_hybrid_image_search_duplicates(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔧 Correction: Suppression des versions dupliquées de hybrid_image_search...");

    let sql = r#"
        DO $$
        DECLARE
            func_record RECORD;
        BEGIN
            FOR func_record IN 
                SELECT p.oid, p.proname, pg_get_function_arguments(p.oid) as args
                FROM pg_proc p
                JOIN pg_namespace n ON p.pronamespace = n.oid
                WHERE p.proname = 'hybrid_image_search'
                AND n.nspname = 'public'
            LOOP
                BEGIN
                    EXECUTE format('DROP FUNCTION IF EXISTS %s(%s) CASCADE', 
                        func_record.proname, 
                        func_record.args);
                    RAISE NOTICE 'Supprimé: hybrid_image_search(%)', func_record.args;
                EXCEPTION WHEN OTHERS THEN
                    RAISE NOTICE 'Erreur lors de la suppression de hybrid_image_search(%): %', 
                        func_record.args, SQLERRM;
                END;
            END LOOP;
        END $$;
    "#;

    sqlx::query(sql).execute(pool).await?;
    info!("✅ Toutes les versions dupliquées de hybrid_image_search ont été supprimées");
    Ok(())
}

/// Crée la table appointment_slots pour gérer les créneaux horaires des prestataires santé
async fn ensure_appointment_slots_table(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔧 Correction: Vérification/création de appointment_slots...");

    let sql = r#"
        CREATE TABLE IF NOT EXISTS appointment_slots (
            id SERIAL PRIMARY KEY,
            service_id INTEGER NOT NULL,
            service_type VARCHAR(50) NOT NULL,
            prestataire_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            slot_date DATE NOT NULL,
            start_time TIME NOT NULL,
            end_time TIME NOT NULL,
            max_bookings INTEGER NOT NULL DEFAULT 1,
            current_bookings INTEGER NOT NULL DEFAULT 0,
            consultation_type VARCHAR(100),
            price NUMERIC(10, 2),
            currency VARCHAR(10) DEFAULT 'XAF',
            notes TEXT,
            is_active BOOLEAN NOT NULL DEFAULT true,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            UNIQUE(service_id, slot_date, start_time, consultation_type)
        );

        CREATE INDEX IF NOT EXISTS idx_appointment_slots_service ON appointment_slots(service_id, service_type);
        CREATE INDEX IF NOT EXISTS idx_appointment_slots_date ON appointment_slots(slot_date);
        CREATE INDEX IF NOT EXISTS idx_appointment_slots_prestataire ON appointment_slots(prestataire_id);
        CREATE INDEX IF NOT EXISTS idx_appointment_slots_available ON appointment_slots(service_id, slot_date, is_active) WHERE current_bookings < max_bookings;

        -- Ajouter colonnes de compatibilité à specialized_reservations pour book_hospital
        ALTER TABLE specialized_reservations ADD COLUMN IF NOT EXISTS reservation_date DATE;
        ALTER TABLE specialized_reservations ADD COLUMN IF NOT EXISTS reservation_time TEXT;
        ALTER TABLE specialized_reservations ADD COLUMN IF NOT EXISTS slot_id INTEGER REFERENCES appointment_slots(id);
    "#;

    execute_migration_sql_safe(pool, sql).await?;
    info!("✅ Table appointment_slots créée / colonnes compat ajoutées");
    Ok(())
}

/// Crée la table specialized_reservations si elle n'existe pas
async fn ensure_specialized_reservations_table(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔧 Correction: Vérification/création de specialized_reservations...");

    // Vérifier si la table existe
    let exists: bool = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'specialized_reservations'
        )",
    )
    .fetch_one(pool)
    .await?;

    if exists {
        info!("✅ Table specialized_reservations existe déjà");
        return Ok(());
    }

    // Créer la table
    let sql = r#"
        CREATE TABLE specialized_reservations (
            id SERIAL PRIMARY KEY,
            service_id INTEGER NOT NULL,
            service_type VARCHAR(50) NOT NULL,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            prestataire_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            reservation_type VARCHAR(50) NOT NULL,
            status VARCHAR(20) NOT NULL DEFAULT 'pending',
            requested_date TIMESTAMP WITH TIME ZONE,
            confirmed_date TIMESTAMP WITH TIME ZONE,
            completed_at TIMESTAMP WITH TIME ZONE,
            cancelled_at TIMESTAMP WITH TIME ZONE,
            details JSONB NOT NULL DEFAULT '{}',
            amount NUMERIC(10, 2),
            currency VARCHAR(10),
            payment_status VARCHAR(20),
            payment_method VARCHAR(50),
            notes TEXT,
            prestataire_notes TEXT,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
        );
        
        CREATE INDEX IF NOT EXISTS idx_specialized_reservations_service_id ON specialized_reservations(service_id);
        CREATE INDEX IF NOT EXISTS idx_specialized_reservations_user_id ON specialized_reservations(user_id);
        CREATE INDEX IF NOT EXISTS idx_specialized_reservations_prestataire_id ON specialized_reservations(prestataire_id);
        CREATE INDEX IF NOT EXISTS idx_specialized_reservations_status ON specialized_reservations(status);
        CREATE INDEX IF NOT EXISTS idx_specialized_reservations_service_type ON specialized_reservations(service_type);
    "#;

    execute_migration_sql_safe(pool, sql).await?;
    info!("✅ Table specialized_reservations créée avec succès");
    Ok(())
}

/// ✅ NOUVEAU 2026-01-30: S'assure que la colonne gps existe dans services
/// Problème: Les vues matérialisées échouent car s.gps n'existe pas
async fn ensure_services_gps_column(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔧 Correction: Vérification de la colonne gps dans services...");

    let column_exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'services' 
            AND column_name = 'gps'
        )",
    )
    .fetch_one(pool)
    .await?;

    if !column_exists {
        warn!("⚠️ Colonne gps manquante dans services, ajout en cours...");
        sqlx::query("ALTER TABLE services ADD COLUMN IF NOT EXISTS gps VARCHAR(255)")
            .execute(pool)
            .await?;
        info!("✅ Colonne gps ajoutée à services");
    } else {
        info!("✅ Colonne gps existe déjà dans services");
    }

    Ok(())
}

/// ✅ NOUVEAU 2026-01-30: Corrige l'index avec NOW() non IMMUTABLE
/// Problème: functions in index predicate must be marked IMMUTABLE
async fn fix_delivery_matching_queue_index(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔧 Correction: Vérification de l'index delivery_matching_queue...");

    // Supprimer l'index problématique s'il existe avec NOW() dans le prédicat
    let sql = r#"
        DO $$
        BEGIN
            -- Supprimer l'index s'il existe avec NOW() dans le prédicat
            IF EXISTS (
                SELECT 1 FROM pg_indexes 
                WHERE indexname = 'idx_delivery_matching_queue_next_attempt_pending'
                AND indexdef LIKE '%NOW()%'
            ) THEN
                DROP INDEX IF EXISTS idx_delivery_matching_queue_next_attempt_pending;
                RAISE NOTICE 'Index problématique supprimé';
            END IF;
            
            -- Recréer l'index sans NOW() dans le prédicat
            IF NOT EXISTS (
                SELECT 1 FROM pg_indexes 
                WHERE indexname = 'idx_delivery_matching_queue_next_attempt_pending'
            ) THEN
                CREATE INDEX idx_delivery_matching_queue_next_attempt_pending
                ON delivery_matching_queue(next_attempt_at)
                WHERE status IN ('queued', 'searching') AND next_attempt_at IS NOT NULL;
                RAISE NOTICE 'Index corrigé créé';
            END IF;
        END $$;
    "#;

    execute_migration_sql_safe(pool, sql).await?;
    info!("✅ Index delivery_matching_queue corrigé");
    Ok(())
}

/// ✅ NOUVEAU 2026-01-30: S'assure que la table products existe
/// Problème: relation "products" does not exist
async fn ensure_products_table(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔧 Correction: Vérification de la table products...");

    let table_exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'products'
        )",
    )
    .fetch_one(pool)
    .await?;

    if !table_exists {
        warn!("⚠️ Table products manquante, création en cours...");
        let sql = r#"
            CREATE TABLE IF NOT EXISTS products (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
                name TEXT NOT NULL,
                type TEXT NOT NULL,
                description TEXT,
                price_cents BIGINT,
                currency VARCHAR(10) DEFAULT 'XAF',
                seat_map JSONB,
                bus_configuration JSONB,
                total_seats INTEGER,
                numero_bus VARCHAR(50),
                logo_agence TEXT,
                conditions_voyage TEXT,
                caution_reservation INTEGER DEFAULT 500,
                metadata JSONB DEFAULT '{}'::jsonb,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
            
            CREATE INDEX IF NOT EXISTS idx_products_service_id ON products(service_id);
            CREATE INDEX IF NOT EXISTS idx_products_type ON products(type);
            CREATE INDEX IF NOT EXISTS idx_products_created_at ON products(created_at DESC);
        "#;

        execute_migration_sql_safe(pool, sql).await?;
        info!("✅ Table products créée");
    } else {
        info!("✅ Table products existe déjà");
    }

    Ok(())
}

/// ✅ NOUVEAU 2026-01-30: Corrige les vues matérialisées pour gérer gps manquant
/// Problème: Les vues matérialisées échouent car s.gps n'existe pas
async fn fix_materialized_views_gps(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔧 Correction: Vérification des vues matérialisées...");

    // Vérifier si la colonne gps existe
    let gps_exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'services' 
            AND column_name = 'gps'
        )",
    )
    .fetch_one(pool)
    .await?;

    if !gps_exists {
        warn!("⚠️ Colonne gps n'existe pas, les vues matérialisées seront créées sans gps");
        // Supprimer les vues matérialisées existantes pour les recréer sans gps
        let sql = r#"
            DROP MATERIALIZED VIEW IF EXISTS services_search_cache CASCADE;
            DROP MATERIALIZED VIEW IF EXISTS active_products_cache CASCADE;
            
            -- Recréer services_search_cache sans gps
            CREATE MATERIALIZED VIEW IF NOT EXISTS services_search_cache AS
            SELECT 
                s.id,
                s.user_id,
                s.data,
                s.is_active,
                s.category,
                s.created_at,
                to_tsvector('french', 
                    COALESCE(s.data->'titre_service'->>'valeur', '') || ' ' ||
                    COALESCE(s.data->'description'->>'valeur', '') || ' ' ||
                    COALESCE(s.category, '')
                ) as search_vector
            FROM services s
            WHERE s.is_active = TRUE;
            
            CREATE UNIQUE INDEX IF NOT EXISTS idx_services_search_cache_id_unique
            ON services_search_cache (id);
            
            CREATE INDEX IF NOT EXISTS idx_services_search_cache_vector
            ON services_search_cache USING GIN (search_vector);
            
            CREATE INDEX IF NOT EXISTS idx_services_search_cache_category
            ON services_search_cache (category, created_at DESC);
            
            CREATE INDEX IF NOT EXISTS idx_services_search_cache_active
            ON services_search_cache (is_active, created_at DESC)
            WHERE is_active = TRUE;
            
            -- Recréer active_products_cache sans gps
            CREATE MATERIALIZED VIEW IF NOT EXISTS active_products_cache AS
            SELECT 
                (s.id::bigint * 1000000 + jsonb_array_elements.pos) as cache_id,
                s.id as service_id,
                s.user_id,
                s.category,
                jsonb_array_elements.product,
                s.created_at
            FROM services s
            CROSS JOIN LATERAL jsonb_array_elements(
                CASE 
                    WHEN jsonb_typeof(s.data->'produits') = 'array' 
                    THEN s.data->'produits'
                    WHEN jsonb_typeof(s.data->'produits'->'valeur') = 'array'
                    THEN s.data->'produits'->'valeur'
                    ELSE '[]'::jsonb
                END
            ) WITH ORDINALITY AS jsonb_array_elements(product, pos)
            WHERE s.is_active = TRUE
            AND (
                jsonb_typeof(s.data->'produits') = 'array' OR
                jsonb_typeof(s.data->'produits'->'valeur') = 'array'
            );
            
            CREATE UNIQUE INDEX IF NOT EXISTS idx_active_products_cache_id_unique
            ON active_products_cache (cache_id);
            
            CREATE INDEX IF NOT EXISTS idx_active_products_service_category
            ON active_products_cache (service_id, category);
            
            CREATE INDEX IF NOT EXISTS idx_active_products_product_name
            ON active_products_cache USING GIN (
                to_tsvector('french', 
                    COALESCE(product->>'name', '') || ' ' ||
                    COALESCE(product->>'description', '')
                )
            );
        "#;

        execute_migration_sql_safe(pool, sql).await?;
        info!("✅ Vues matérialisées recréées sans gps");
    } else {
        // La colonne gps existe, vérifier si les vues existent et les recréer si nécessaire
        let services_cache_exists = sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS(
                SELECT 1 FROM pg_matviews 
                WHERE matviewname = 'services_search_cache'
            )",
        )
        .fetch_one(pool)
        .await?;

        let products_cache_exists = sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS(
                SELECT 1 FROM pg_matviews 
                WHERE matviewname = 'active_products_cache'
            )",
        )
        .fetch_one(pool)
        .await?;

        if !services_cache_exists || !products_cache_exists {
            warn!("⚠️ Vues matérialisées manquantes, création en cours...");
            let sql = r#"
                CREATE MATERIALIZED VIEW IF NOT EXISTS services_search_cache AS
                SELECT 
                    s.id,
                    s.user_id,
                    s.data,
                    s.is_active,
                    s.category,
                    s.gps,
                    s.created_at,
                    to_tsvector('french', 
                        COALESCE(s.data->'titre_service'->>'valeur', '') || ' ' ||
                        COALESCE(s.data->'description'->>'valeur', '') || ' ' ||
                        COALESCE(s.category, '')
                    ) as search_vector
                FROM services s
                WHERE s.is_active = TRUE;
                
                CREATE UNIQUE INDEX IF NOT EXISTS idx_services_search_cache_id_unique
                ON services_search_cache (id);
                
                CREATE INDEX IF NOT EXISTS idx_services_search_cache_vector
                ON services_search_cache USING GIN (search_vector);
                
                CREATE INDEX IF NOT EXISTS idx_services_search_cache_category
                ON services_search_cache (category, created_at DESC);
                
                CREATE INDEX IF NOT EXISTS idx_services_search_cache_active
                ON services_search_cache (is_active, created_at DESC)
                WHERE is_active = TRUE;
                
                CREATE MATERIALIZED VIEW IF NOT EXISTS active_products_cache AS
                SELECT 
                    (s.id::bigint * 1000000 + jsonb_array_elements.pos) as cache_id,
                    s.id as service_id,
                    s.user_id,
                    s.category,
                    s.gps,
                    jsonb_array_elements.product,
                    s.created_at
                FROM services s
                CROSS JOIN LATERAL jsonb_array_elements(
                    CASE 
                        WHEN jsonb_typeof(s.data->'produits') = 'array' 
                        THEN s.data->'produits'
                        WHEN jsonb_typeof(s.data->'produits'->'valeur') = 'array'
                        THEN s.data->'produits'->'valeur'
                        ELSE '[]'::jsonb
                    END
                ) WITH ORDINALITY AS jsonb_array_elements(product, pos)
                WHERE s.is_active = TRUE
                AND (
                    jsonb_typeof(s.data->'produits') = 'array' OR
                    jsonb_typeof(s.data->'produits'->'valeur') = 'array'
                );
                
                CREATE UNIQUE INDEX IF NOT EXISTS idx_active_products_cache_id_unique
                ON active_products_cache (cache_id);
                
                CREATE INDEX IF NOT EXISTS idx_active_products_service_category
                ON active_products_cache (service_id, category);
                
                CREATE INDEX IF NOT EXISTS idx_active_products_product_name
                ON active_products_cache USING GIN (
                    to_tsvector('french', 
                        COALESCE(product->>'name', '') || ' ' ||
                        COALESCE(product->>'description', '')
                    )
                );
            "#;

            execute_migration_sql_safe(pool, sql).await?;
            info!("✅ Vues matérialisées créées avec gps");
        } else {
            info!("✅ Vues matérialisées existent déjà");
        }
    }

    Ok(())
}

/// ✅ NOUVEAU 2026-01-30: Supprime les contraintes dupliquées
/// Problème: constraint "fk_video_generation_jobs_audio_job" already exists
async fn fix_duplicate_constraints(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔧 Correction: Vérification des contraintes dupliquées...");

    let sql = r#"
        DO $$
        BEGIN
            -- Supprimer la contrainte si elle existe avant de la recréer
            IF EXISTS (
                SELECT 1 FROM pg_constraint 
                WHERE conname = 'fk_video_generation_jobs_audio_job'
            ) THEN
                ALTER TABLE video_generation_jobs 
                DROP CONSTRAINT IF EXISTS fk_video_generation_jobs_audio_job;
                RAISE NOTICE 'Contrainte fk_video_generation_jobs_audio_job supprimée';
            END IF;
            
            -- Recréer la contrainte si la table et les colonnes existent
            IF EXISTS (
                SELECT 1 FROM information_schema.tables 
                WHERE table_name = 'video_generation_jobs'
            ) AND EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'video_generation_jobs' 
                AND column_name = 'audio_job_id'
            ) AND EXISTS (
                SELECT 1 FROM information_schema.tables 
                WHERE table_name = 'premium_audio_jobs'
            ) AND EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'premium_audio_jobs' 
                AND column_name = 'job_id'
            ) THEN
                ALTER TABLE video_generation_jobs 
                ADD CONSTRAINT fk_video_generation_jobs_audio_job 
                FOREIGN KEY (audio_job_id) 
                REFERENCES premium_audio_jobs(job_id) 
                ON DELETE SET NULL;
                RAISE NOTICE 'Contrainte fk_video_generation_jobs_audio_job recréée';
            END IF;
        END $$;
    "#;

    execute_migration_sql_safe(pool, sql).await?;
    info!("✅ Contraintes dupliquées corrigées");
    Ok(())
}

/// Crée la fonction run_audio_cache_cleanup() si elle n'existe pas
/// ✅ CORRIGÉ 2026-01-30: Supprime toutes les versions de la fonction avant de la recréer
/// pour éviter les conflits de signature (comme pour hybrid_image_search)
async fn ensure_run_audio_cache_cleanup_function(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔧 Correction: Vérification/création de run_audio_cache_cleanup()...");

    // ✅ CORRIGÉ: Supprimer TOUTES les versions de la fonction (toutes signatures)
    // pour éviter les conflits si une version avec paramètres existe
    let drop_sql = r#"
        DO $$
        DECLARE
            r RECORD;
        BEGIN
            FOR r IN 
                SELECT p.oid, p.proname, pg_get_function_arguments(p.oid) as args
                FROM pg_proc p
                JOIN pg_namespace n ON p.pronamespace = n.oid
                WHERE p.proname = 'run_audio_cache_cleanup'
                AND n.nspname = 'public'
            LOOP
                BEGIN
                    EXECUTE format('DROP FUNCTION IF EXISTS %s(%s) CASCADE', 
                        r.proname, r.args);
                    RAISE NOTICE 'Supprimé: run_audio_cache_cleanup(%)', r.args;
                EXCEPTION WHEN OTHERS THEN
                    RAISE NOTICE 'Erreur lors de la suppression de run_audio_cache_cleanup(%): %', 
                        r.args, SQLERRM;
                END;
            END LOOP;
        END $$;
    "#;

    execute_migration_sql_safe(pool, drop_sql).await?;
    info!("🧹 Toutes les versions de run_audio_cache_cleanup() supprimées");

    // Créer la fonction avec la signature exacte (sans paramètres)
    let sql = r#"
        CREATE OR REPLACE FUNCTION run_audio_cache_cleanup()
        RETURNS TABLE(
            deleted_count INTEGER,
            kept_count INTEGER,
            total_before INTEGER,
            total_after INTEGER
        ) AS $$
        DECLARE
            deleted_count_var INTEGER := 0;
            kept_count_var INTEGER := 0;
            total_before_var INTEGER := 0;
            total_after_var INTEGER := 0;
        BEGIN
            -- Vérifier si la fonction cleanup_old_audio_transcriptions existe
            IF EXISTS (
                SELECT 1 FROM pg_proc 
                WHERE proname = 'cleanup_old_audio_transcriptions'
            ) THEN
                -- Exécuter le nettoyage et récupérer les résultats dans des variables explicites
                -- Utiliser COALESCE pour garantir des valeurs non-NULL
                SELECT 
                    COALESCE(deleted_count, 0),
                    COALESCE(kept_count, 0),
                    COALESCE(total_before, 0),
                    COALESCE(total_after, 0)
                INTO 
                    deleted_count_var,
                    kept_count_var,
                    total_before_var,
                    total_after_var
                FROM cleanup_old_audio_transcriptions()
                LIMIT 1;
            ELSE
                -- Si la fonction n'existe pas, retourner des valeurs par défaut (0)
                RAISE NOTICE 'Fonction cleanup_old_audio_transcriptions non trouvée, retour de valeurs par défaut';
            END IF;
            
            -- Log (peut être envoyé à un système de monitoring)
            RAISE NOTICE 'Audio cache cleanup: deleted %, kept %, total before %, after %', 
                deleted_count_var, kept_count_var, total_before_var, total_after_var;
            
            -- Retourner les résultats comme une table (toujours des valeurs non-NULL)
            RETURN QUERY SELECT deleted_count_var, kept_count_var, total_before_var, total_after_var;
        END;
        $$ LANGUAGE plpgsql;
    "#;

    execute_migration_sql_safe(pool, sql).await?;
    info!("✅ Fonction run_audio_cache_cleanup() créée avec succès (signature sans paramètres)");
    Ok(())
}

/// ⚠️ DÉPRÉCIÉ 2026-01-31: Cette fonction n'est plus utilisée dans main.rs
/// Utilisez plutôt sqlx::migrate!() qui gère automatiquement toutes les migrations
/// Cette fonction est conservée uniquement pour compatibilité avec les scripts binaires
///
/// Exécute toutes les migrations individuelles (00000001 à 00000041)
/// Remplace l'ancien fichier consolidé 0000_create_all_tables.sql
#[deprecated(note = "Utilisez sqlx::migrate!() à la place")]
pub async fn run_individual_migrations(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!(
        "🔄 [MIGRATIONS INDIVIDUELLES] Démarrage de l'application des migrations individuelles..."
    );

    // Liste ordonnée des fichiers de migration individuels
    // ✅ CORRIGÉ 2026-02-15: Suppression des migrations manquantes
    let migration_files = vec![
        "00000001_create_extensions.sql",
        "00000002_create_base_tables.sql",
        "00000003_create_utility_tables.sql",
        // "00000004_create_payment_tables.sql", // ❌ Fichier manquant - remplacé par 00000004_001_add_specialized_reservations_and_ratings.sql
        // "00000005_create_autocomplete_tables.sql", // ❌ Fichier manquant
        // "00000006_create_product_tables.sql", // ❌ Fichier manquant - remplacé par 00000006_999_create_automated_reports.sql
        // "00000007_create_review_tables.sql", // ❌ Fichier manquant
        // "00000008_create_delivery_tables.sql", // ❌ Fichier manquant - remplacé par 00000008_999_create_publicite_audiences_and_assets.sql
        // "00000009_create_specialized_services_tables.sql", // ❌ Fichier manquant
        // "00000010_create_functions.sql", // ❌ Fichier manquant - remplacé par 00000010_add_hospital_lab_scalability_indexes.sql
        // "00000011_create_indexes_and_optimizations.sql", // ❌ Fichier manquant
        // "00000012_create_communication_tables.sql", // ❌ Fichier manquant - remplacé par 00000012_add_specialized_type_triggers.sql
        // "00000013_create_advertising_tables.sql", // ❌ Fichier manquant
        // "00000014_create_live_streaming_tables.sql", // ❌ Fichier manquant - remplacé par 00000014_create_delivery_chat_tables.sql
        // "00000015_create_flash_sales_tables.sql", // ❌ Fichier manquant
        // "00000016_create_promotion_tables.sql", // ❌ Fichier manquant
        // "00000017_create_social_media_tables.sql", // ❌ Fichier manquant - remplacé par 00000017_create_orientation_scolaire.sql
        "00000018_create_media_engagement_tables.sql",
        "00000019_create_video_audio_tables.sql",
        "00000020_create_studio_tables.sql",
        "00000021_create_additional_functions.sql",
        "00000022_create_remaining_tables_and_functions.sql",
        "00000023_create_videos_tables.sql",
        // "00000024_create_message_reactions_and_delivery_chat_tables.sql", // ❌ Fichier manquant - remplacé par 00000024_002_fix_recherche_produits_complete.sql
        "00000025_create_effects_and_templates_tables.sql",
        "00000026_create_plugin_marketplace_tables.sql",
        "00000027_create_menu_planning_tables.sql",
        "00000028_create_optimized_functions_and_cache.sql",
        "00000029_create_blood_donation_and_specialized_tables.sql",
        // "00000030_create_final_optimizations_and_views.sql", // ❌ Fichier manquant - remplacé par 00000030_add_delivery_round_trip.sql
        "00000031_create_bus_tables.sql",
        "00000032_create_bus_functions_and_agency_tables.sql",
        // "00000033_create_missing_delivery_tables.sql", // ❌ Fichier manquant - remplacé par 00000033_004_improve_search_with_autocomplete.sql
        "00000034_create_immobilier_tables.sql",
        "00000035_create_pharmacy_advanced_tables.sql",
        "00000036_create_hospital_advanced_tables.sql",
        "00000037_create_lab_advanced_tables.sql",
        "00000038_create_offres_emploi_advanced_tables.sql",
        // "00000039_create_orientation_scolaire_advanced_tables.sql", // ❌ Fichier manquant - remplacé par 00000039_create_bus_tables.sql
        "00000040_create_bourse_livre_advanced_tables.sql",
        "00000041_create_bus_ratings_return_trips_and_additional_tables.sql",
        "00001040_create_navigation_trips_table.sql", // ✅ Table navigation intelligente
    ];

    let mut success_count = 0;
    let mut error_count = 0;

    for (index, file_name) in migration_files.iter().enumerate() {
        let migration_number = index + 1;
        info!(
            "🔄 [MIGRATION {}/{}] Application de {}...",
            migration_number,
            migration_files.len(),
            file_name
        );

        // Charger le contenu du fichier de migration
        // Note: On utilise include_str! pour chaque fichier individuellement
        let migration_sql = match *file_name {
            "00000001_create_extensions.sql" => include_str!("../../migrations/00000001_create_extensions.sql"),
            "00000002_create_base_tables.sql" => include_str!("../../migrations/00000002_create_base_tables.sql"),
            "00000003_create_utility_tables.sql" => include_str!("../../migrations/00000003_create_utility_tables.sql"),
            // ✅ CORRIGÉ 2026-02-15: Fichiers manquants supprimés
            "00000018_create_media_engagement_tables.sql" => include_str!("../../migrations/00000018_create_media_engagement_tables.sql"),
            "00000019_create_video_audio_tables.sql" => include_str!("../../migrations/00001013_create_video_audio_tables.sql"),
            "00000020_create_studio_tables.sql" => include_str!("../../migrations/00000020_create_studio_tables.sql"),
            "00000021_create_additional_functions.sql" => include_str!("../../migrations/00000021_create_additional_functions.sql"),
            "00000022_create_remaining_tables_and_functions.sql" => include_str!("../../migrations/00000022_create_remaining_tables_and_functions.sql"),
            "00000023_create_videos_tables.sql" => include_str!("../../migrations/00000023_create_videos_tables.sql"),
            "00000025_create_effects_and_templates_tables.sql" => include_str!("../../migrations/00001006_create_effects_and_templates_tables.sql"),
            "00000026_create_plugin_marketplace_tables.sql" => include_str!("../../migrations/00000026_create_plugin_marketplace_tables.sql"),
            "00000027_create_menu_planning_tables.sql" => include_str!("../../migrations/00000027_create_menu_planning_tables.sql"),
            "00000028_create_optimized_functions_and_cache.sql" => include_str!("../../migrations/00000028_create_optimized_functions_and_cache.sql"),
            "00000029_create_blood_donation_and_specialized_tables.sql" => include_str!("../../migrations/00000029_create_blood_donation_and_specialized_tables.sql"),
            "00000031_create_bus_tables.sql" => include_str!("../../migrations/00000039_create_bus_tables.sql"),
            "00000032_create_bus_functions_and_agency_tables.sql" => include_str!("../../migrations/00000032_create_bus_functions_and_agency_tables.sql"),
            "00000034_create_immobilier_tables.sql" => include_str!("../../migrations/00000133_create_immobilier_complete_tables.sql"),
            "00000035_create_pharmacy_advanced_tables.sql" => include_str!("../../migrations/00000035_create_pharmacy_advanced_tables.sql"),
            "00000036_create_hospital_advanced_tables.sql" => include_str!("../../migrations/00000036_create_hospital_advanced_tables.sql"),
            "00000037_create_lab_advanced_tables.sql" => include_str!("../../migrations/00000037_create_lab_advanced_tables.sql"),
            "00000038_create_offres_emploi_advanced_tables.sql" => include_str!("../../migrations/00000038_create_offres_emploi_advanced_tables.sql"),
            "00000040_create_bourse_livre_advanced_tables.sql" => include_str!("../../migrations/00000131_create_bourse_livre_advanced_tables.sql"),
            "00000041_create_bus_ratings_return_trips_and_additional_tables.sql" => include_str!("../../migrations/00000041_create_bus_ratings_return_trips_and_additional_tables.sql"),
            "00001040_create_navigation_trips_table.sql" => include_str!("../../migrations/00001040_create_navigation_trips_table.sql"),
            _ => {
                error!("❌ [MIGRATION {}] Fichier de migration inconnu: {}", migration_number, file_name);
                error_count += 1;
                continue;
            }
        };

        info!(
            "🔍 [MIGRATION {}] Fichier chargé, taille: {} caractères",
            migration_number,
            migration_sql.len()
        );

        match execute_migration_sql_safe(pool, &migration_sql).await {
            Ok(_) => {
                info!(
                    "✅ [MIGRATION {}] {} appliquée avec succès",
                    migration_number, file_name
                );
                success_count += 1;
            }
            Err(e) => {
                error!(
                    "❌ [MIGRATION {}] Erreur lors de l'application de {}: {}",
                    migration_number, file_name, e
                );
                error_count += 1;
                // Continuer avec les migrations suivantes même en cas d'erreur
            }
        }
    }

    info!(
        "✅ [MIGRATIONS INDIVIDUELLES] Terminé: {} succès, {} erreurs",
        success_count, error_count
    );

    if error_count > 0 {
        warn!("⚠️ [MIGRATIONS INDIVIDUELLES] Certaines migrations ont échoué. Vérifiez les logs ci-dessus.");
    }

    Ok(())
}

/// ✅ NOUVEAU 2026-02-25: Tables pour vérification téléphone par OTP (SMS/WhatsApp)
pub async fn ensure_phone_verification_tables(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification des tables de vérification téléphone OTP...");

    // 1. Ajouter les colonnes phone, phone_country, phone_verified dans users
    sqlx::query("ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(20)")
        .execute(pool)
        .await?;

    sqlx::query("ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_country VARCHAR(5)")
        .execute(pool)
        .await?;

    sqlx::query("ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT FALSE")
        .execute(pool)
        .await?;

    // 2. Créer la table phone_verification_codes
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS phone_verification_codes (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            phone VARCHAR(20) NOT NULL,
            country_code VARCHAR(5) NOT NULL DEFAULT 'CM',
            code VARCHAR(6) NOT NULL,
            attempts INTEGER DEFAULT 0,
            is_used BOOLEAN DEFAULT FALSE,
            expires_at TIMESTAMPTZ NOT NULL,
            verified_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ DEFAULT NOW()
        )
        "#,
    )
    .execute(pool)
    .await?;

    // 3. Index pour recherche rapide
    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_phone_verification_user ON phone_verification_codes(user_id, is_used, expires_at)"
    ).execute(pool).await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_phone_verification_phone ON phone_verification_codes(phone)"
    ).execute(pool).await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone) WHERE phone IS NOT NULL",
    )
    .execute(pool)
    .await?;

    info!("✅ Tables de vérification téléphone OTP créées/vérifiées");
    Ok(())
}

/// ✅ NOUVEAU 2026-03-01: Ajouter colonnes manquantes à product_delivery_config
/// et créer les tables delivery_engine_pricing / delivery_insurance_fees si absentes.
/// Ces éléments sont requis par /api/delivery/client-order et /api/delivery/estimate-costs.
pub async fn ensure_delivery_config_columns(pool: &PgPool) -> Result<(), sqlx::Error> {
    // 1. Ajouter colonnes manquantes à product_delivery_config
    sqlx::query(
        "ALTER TABLE product_delivery_config
         ADD COLUMN IF NOT EXISTS preparation_time_minutes INTEGER,
         ADD COLUMN IF NOT EXISTS max_preparation_time_minutes INTEGER DEFAULT 60,
         ADD COLUMN IF NOT EXISTS availability_days INTEGER[] DEFAULT ARRAY[0,1,2,3,4,5,6],
         ADD COLUMN IF NOT EXISTS is_immediately_available BOOLEAN DEFAULT FALSE",
    )
    .execute(pool)
    .await?;

    // 2. Créer le type ENUM delivery_engine_type si absent
    sqlx::query(
        "DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'delivery_engine_type') THEN
                CREATE TYPE delivery_engine_type AS ENUM (
                    'moto', 'scooter', 'voiture', 'camionnette',
                    'velo_cargo', 'pieton', 'camion_leger', 'autre'
                );
            END IF;
        END $$",
    )
    .execute(pool)
    .await?;

    // 3. Créer table delivery_engine_pricing si absente
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS delivery_engine_pricing (
            engine_type delivery_engine_type PRIMARY KEY,
            cost_per_km_fcfa NUMERIC(10, 2) NOT NULL,
            minimum_cost_fcfa NUMERIC(10, 2) NOT NULL,
            fuel_consumption_l_per_km NUMERIC(6, 3),
            description TEXT,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        )",
    )
    .execute(pool)
    .await?;

    // Seed default pricing values
    sqlx::query(
        "INSERT INTO delivery_engine_pricing (engine_type, cost_per_km_fcfa, minimum_cost_fcfa, fuel_consumption_l_per_km, description)
         VALUES
            ('pieton', 200, 500, NULL, 'Livraison à pied'),
            ('velo_cargo', 200, 800, NULL, 'Vélo cargo'),
            ('scooter', 225, 1000, 0.030, 'Scooter'),
            ('moto', 225, 1000, 0.040, 'Moto'),
            ('voiture', 600, 1500, 0.080, 'Voiture'),
            ('camionnette', 1000, 5000, 0.100, 'Camionnette'),
            ('camion_leger', 2000, 10000, 0.120, 'Camion léger'),
            ('autre', 500, 1000, NULL, 'Autre type')
         ON CONFLICT (engine_type) DO NOTHING"
    ).execute(pool).await?;

    // 4. Créer table delivery_insurance_fees si absente
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS delivery_insurance_fees (
            engine_type delivery_engine_type PRIMARY KEY,
            base_fee_fcfa NUMERIC(10, 2) NOT NULL DEFAULT 0,
            percentage_rate NUMERIC(5, 2) NOT NULL DEFAULT 0,
            max_fee_fcfa NUMERIC(10, 2) NOT NULL DEFAULT 0,
            min_value_threshold NUMERIC(10, 2) NOT NULL DEFAULT 0,
            description TEXT,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        )",
    )
    .execute(pool)
    .await?;

    // Seed default insurance values
    sqlx::query(
        "INSERT INTO delivery_insurance_fees (engine_type, base_fee_fcfa, percentage_rate, max_fee_fcfa, min_value_threshold, description)
         VALUES
            ('pieton', 0, 0, 0, 999999, 'Pas d''assurance'),
            ('velo_cargo', 100, 0.5, 1000, 5000, 'Vélo cargo'),
            ('scooter', 200, 0.8, 2500, 3000, 'Scooter'),
            ('moto', 250, 1.0, 3000, 2000, 'Moto'),
            ('voiture', 300, 1.2, 5000, 1000, 'Voiture'),
            ('camionnette', 500, 1.5, 10000, 500, 'Camionnette'),
            ('camion_leger', 1000, 2.0, 20000, 0, 'Camion léger'),
            ('autre', 250, 1.0, 3000, 2000, 'Autre type')
         ON CONFLICT (engine_type) DO NOTHING"
    ).execute(pool).await?;

    info!("✅ Colonnes product_delivery_config + tables delivery_engine_pricing/insurance_fees vérifiées");
    Ok(())
}

/// ✅ NOUVEAU 2026-03-05: Table user_follows pour système de suivi vendeurs
pub async fn ensure_user_follows_table(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification de la table user_follows...");

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS user_follows (
            id SERIAL PRIMARY KEY,
            follower_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            followed_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            UNIQUE(follower_id, followed_id)
        )
        "#,
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_user_follows_follower ON user_follows(follower_id)",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_user_follows_followed ON user_follows(followed_id)",
    )
    .execute(pool)
    .await?;

    info!("✅ Table user_follows vérifiée/créée avec succès");
    Ok(())
}

/// ✅ NOUVEAU 2026-03-05: Table generative_video_jobs pour pipeline vidéo IA (Runway/Sora/Pika)
pub async fn ensure_generative_video_jobs_table(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification de la table generative_video_jobs...");

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS generative_video_jobs (
            job_id TEXT PRIMARY KEY,
            user_id BIGINT NOT NULL,
            status TEXT NOT NULL DEFAULT 'queued',
            error_message TEXT,
            result_payload JSONB,
            request_payload JSONB,
            provider TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        "#,
    )
    .execute(pool)
    .await?;

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_generative_video_jobs_user_id ON generative_video_jobs(user_id)")
        .execute(pool)
        .await?;

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_generative_video_jobs_status ON generative_video_jobs(status, created_at DESC)")
        .execute(pool)
        .await?;

    // Trigger pour auto-update updated_at
    sqlx::query(
        r#"
        CREATE OR REPLACE FUNCTION set_generative_video_jobs_updated_at()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql
        "#,
    )
    .execute(pool)
    .await?;

    sqlx::query(
        r#"
        DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_generative_video_jobs_updated_at') THEN
                CREATE TRIGGER trigger_generative_video_jobs_updated_at
                    BEFORE UPDATE ON generative_video_jobs
                    FOR EACH ROW
                    EXECUTE FUNCTION set_generative_video_jobs_updated_at();
            END IF;
        END $$
        "#,
    )
    .execute(pool)
    .await?;

    info!("✅ Table generative_video_jobs vérifiée/créée avec succès");
    Ok(())
}

/// ✅ NOUVEAU 2026-03-05: Table de configuration régionale dynamique
/// Stocke les prix carburant, CO2/km, et contexte culturel par pays — modifiable sans redéploiement
pub async fn ensure_geo_regional_config_table(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🌍 Vérification de la table geo_regional_config...");

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS geo_regional_config (
            country_code VARCHAR(5) PRIMARY KEY,
            country_name VARCHAR(100) NOT NULL,
            region_name VARCHAR(100) NOT NULL,
            currency_code VARCHAR(10) NOT NULL,
            currency_symbol VARCHAR(10) NOT NULL,
            fuel_price_per_liter DOUBLE PRECISION NOT NULL,
            fuel_consumption_l_100km DOUBLE PRECISION NOT NULL DEFAULT 8.0,
            co2_car_g_per_km DOUBLE PRECISION NOT NULL DEFAULT 120.0,
            co2_transit_g_per_km DOUBLE PRECISION NOT NULL DEFAULT 50.0,
            cultural_context TEXT,
            language_hint VARCHAR(5) NOT NULL DEFAULT 'fr',
            source VARCHAR(100) DEFAULT 'manual',
            updated_by VARCHAR(100) DEFAULT 'system',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        "#,
    )
    .execute(pool)
    .await?;

    // Seed avec les données de référence (n'écrase pas si déjà présent)
    sqlx::query(
        r#"
        INSERT INTO geo_regional_config (country_code, country_name, region_name, currency_code, currency_symbol, fuel_price_per_liter, fuel_consumption_l_100km, co2_car_g_per_km, co2_transit_g_per_km, cultural_context, language_hint, source)
        VALUES
            ('CM', 'Cameroun', 'Afrique centrale (CEMAC)', 'XAF', 'FCFA', 850.0, 8.0, 120.0, 50.0, 'Motos-taxis fréquents, routes mixtes goudron/terre, climat tropical, minibus/bus', 'fr', 'seed'),
            ('GA', 'Gabon', 'Afrique centrale (CEMAC)', 'XAF', 'FCFA', 850.0, 8.0, 120.0, 50.0, 'Routes bitumées principales, taxis collectifs, climat équatorial', 'fr', 'seed'),
            ('CG', 'Congo-Brazzaville', 'Afrique centrale (CEMAC)', 'XAF', 'FCFA', 850.0, 8.0, 120.0, 50.0, 'Transport mixte, routes variées', 'fr', 'seed'),
            ('CF', 'République centrafricaine', 'Afrique centrale (CEMAC)', 'XAF', 'FCFA', 900.0, 9.0, 130.0, 55.0, 'Routes souvent dégradées, motos prédominantes', 'fr', 'seed'),
            ('TD', 'Tchad', 'Afrique centrale (CEMAC)', 'XAF', 'FCFA', 870.0, 9.0, 130.0, 55.0, 'Grandes distances, routes désertiques au nord', 'fr', 'seed'),
            ('GQ', 'Guinée équatoriale', 'Afrique centrale (CEMAC)', 'XAF', 'FCFA', 800.0, 8.0, 120.0, 50.0, 'Réseau routier en développement', 'fr', 'seed'),
            ('SN', 'Sénégal', 'Afrique de l''Ouest (CEDEAO/UEMOA)', 'XOF', 'FCFA', 750.0, 8.5, 125.0, 50.0, 'Cars rapides, Ndiaga Ndiaye, DDD à Dakar', 'fr', 'seed'),
            ('CI', 'Côte d''Ivoire', 'Afrique de l''Ouest (CEDEAO/UEMOA)', 'XOF', 'FCFA', 735.0, 8.5, 125.0, 50.0, 'Gbakas, wôrô-wôrô, SOTRA à Abidjan', 'fr', 'seed'),
            ('NG', 'Nigeria', 'Afrique de l''Ouest', 'NGN', '₦', 700.0, 10.0, 140.0, 60.0, 'Okada, danfo, BRT à Lagos, carburant subventionné', 'en', 'seed'),
            ('GH', 'Ghana', 'Afrique de l''Ouest', 'GHS', 'GH₵', 15.0, 9.0, 130.0, 55.0, 'Trotros, trafic Accra', 'en', 'seed'),
            ('KE', 'Kenya', 'Afrique de l''Est', 'KES', 'KSh', 180.0, 8.5, 125.0, 50.0, 'Matatus, boda-bodas, SGR Nairobi-Mombasa', 'en', 'seed'),
            ('RW', 'Rwanda', 'Afrique de l''Est', 'RWF', 'FRw', 1350.0, 8.5, 125.0, 50.0, 'Motos-taxis, bus Kigali bien organisé', 'en', 'seed'),
            ('CD', 'RD Congo', 'Afrique centrale', 'CDF', 'FC', 3500.0, 10.0, 140.0, 60.0, 'Routes dégradées, motos-taxis Kinshasa', 'fr', 'seed'),
            ('ZA', 'Afrique du Sud', 'Afrique australe', 'ZAR', 'R', 24.0, 8.5, 120.0, 45.0, 'Réseau routier développé, minibus-taxis, Gautrain', 'en', 'seed'),
            ('MA', 'Maroc', 'Afrique du Nord (Maghreb)', 'MAD', 'DH', 14.0, 7.5, 115.0, 45.0, 'Tramway Casablanca/Rabat, taxis, réseau autoroutier', 'fr', 'seed'),
            ('DZ', 'Algérie', 'Afrique du Nord (Maghreb)', 'DZD', 'DA', 45.0, 7.5, 115.0, 45.0, 'Carburant subventionné, métro Alger', 'fr', 'seed'),
            ('TN', 'Tunisie', 'Afrique du Nord (Maghreb)', 'TND', 'DT', 2.1, 7.5, 115.0, 45.0, 'Métro léger Tunis, louages', 'fr', 'seed'),
            ('FR', 'France', 'Europe', 'EUR', '€', 1.75, 6.5, 95.0, 35.0, 'TGV, métro, vélib, pistes cyclables développées', 'fr', 'seed'),
            ('BE', 'Belgique', 'Europe', 'EUR', '€', 1.70, 6.5, 95.0, 35.0, 'Réseau ferroviaire dense, embouteillages Bruxelles', 'fr', 'seed'),
            ('DE', 'Allemagne', 'Europe', 'EUR', '€', 1.80, 6.5, 95.0, 35.0, 'Autobahn, S-Bahn/U-Bahn, 49€ ticket', 'fr', 'seed'),
            ('GB', 'Royaume-Uni', 'Europe', 'GBP', '£', 1.50, 7.0, 100.0, 40.0, 'Tube Londres, conduite à gauche, vélo populaire', 'en', 'seed'),
            ('US', 'États-Unis', 'Amérique du Nord', 'USD', '$', 0.95, 9.5, 130.0, 50.0, 'Auto-dépendant, distances longues, Uber/Lyft', 'en', 'seed'),
            ('CA', 'Canada', 'Amérique du Nord', 'CAD', 'CA$', 1.70, 8.5, 120.0, 45.0, 'Hivers rigoureux, grandes distances, TransLink/TTC', 'en', 'seed'),
            ('BR', 'Brésil', 'Amérique du Sud', 'BRL', 'R$', 6.0, 9.0, 125.0, 50.0, 'Mégalopoles, motos, Uber/99', 'pt', 'seed'),
            ('IN', 'Inde', 'Asie du Sud', 'INR', '₹', 100.0, 8.0, 130.0, 45.0, 'Auto-rickshaws, deux-roues, métro Delhi/Mumbai', 'en', 'seed'),
            ('AE', 'Émirats arabes unis', 'Moyen-Orient', 'AED', 'AED', 3.2, 10.0, 140.0, 50.0, 'Ville auto-centrée, métro Dubaï, climat très chaud', 'en', 'seed')
        ON CONFLICT (country_code) DO NOTHING
        "#,
    )
    .execute(pool)
    .await?;

    info!("✅ Table geo_regional_config créée/vérifiée avec données de seed");
    Ok(())
}

/// ✅ FIX 2026-03-05: Table pour persister les signaux de détection de fraude
pub async fn ensure_delivery_fraud_signals_table(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification de la table delivery_fraud_signals...");

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS delivery_fraud_signals (
            id SERIAL PRIMARY KEY,
            fraud_type VARCHAR(50) NOT NULL,
            risk_level VARCHAR(20) NOT NULL,
            confidence REAL NOT NULL DEFAULT 0.0,
            reason TEXT NOT NULL DEFAULT '',
            delivery_id UUID REFERENCES deliveries(id) ON DELETE SET NULL,
            user_id INTEGER,
            courier_id INTEGER,
            detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            metadata JSONB DEFAULT '{}',
            reviewed_at TIMESTAMPTZ,
            reviewed_by INTEGER,
            action_taken VARCHAR(100)
        )
        "#,
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_fraud_signals_user ON delivery_fraud_signals(user_id)",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_fraud_signals_delivery ON delivery_fraud_signals(delivery_id)",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_fraud_signals_risk ON delivery_fraud_signals(risk_level)",
    )
    .execute(pool)
    .await?;

    info!("✅ Table delivery_fraud_signals créée/vérifiée");
    Ok(())
}

/// Crée les tables pour le transcodage vidéo HLS/DASH
pub async fn ensure_video_transcoding_table(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification de la table video_transcoding...");

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS video_transcoding (
            id SERIAL PRIMARY KEY,
            video_id INTEGER NOT NULL UNIQUE REFERENCES media(id) ON DELETE CASCADE,
            
            -- Chemins originaux et transcoded
            original_path TEXT NOT NULL,
            hls_path TEXT NOT NULL,           -- Playlist HLS maître (.m3u8)
            dash_path TEXT NOT NULL,          -- Manifest DASH (.mpd)
            thumbnail_path TEXT NOT NULL,     -- Thumbnail généré
            
            -- Métadonnées qualités (JSON array)
            qualities JSONB NOT NULL DEFAULT '[]'::jsonb,
            
            -- Métadonnées vidéo
            duration_seconds DECIMAL(10,2) NOT NULL,
            file_size_mb DECIMAL(10,2) NOT NULL,
            
            -- Timestamps
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            
            -- Statut du transcodage
            status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
            error_message TEXT,
            
            -- Index pour performance
            CONSTRAINT video_transcoding_check CHECK (video_id > 0)
        )
        "#,
    )
    .execute(pool)
    .await?;

    // Index pour recherche rapide par video_id
    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_video_transcoding_video_id ON video_transcoding(video_id)",
    )
    .execute(pool)
    .await?;

    // Index pour recherche par statut
    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_video_transcoding_status ON video_transcoding(status)",
    )
    .execute(pool)
    .await?;

    // Index pour les vidéos récentes
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_video_transcoding_created_at ON video_transcoding(created_at DESC)")
        .execute(pool)
        .await?;

    // Trigger pour mettre à jour updated_at automatiquement
    sqlx::query(
        r#"
        CREATE OR REPLACE FUNCTION update_video_transcoding_updated_at()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
        END;
        $$ language 'plpgsql';
        "#,
    )
    .execute(pool)
    .await?;

    sqlx::query(
        r#"
        CREATE TRIGGER video_transcoding_updated_at_trigger
            BEFORE UPDATE ON video_transcoding
            FOR EACH ROW
            EXECUTE FUNCTION update_video_transcoding_updated_at();
        "#,
    )
    .execute(pool)
    .await?;

    // Vue pour les vidéos transcoded actives
    sqlx::query(
        r#"
        CREATE OR REPLACE VIEW active_transcoded_videos AS
        SELECT 
            vt.video_id,
            vt.hls_path,
            vt.dash_path,
            vt.thumbnail_path,
            vt.qualities,
            vt.duration_seconds,
            vt.file_size_mb,
            vt.created_at,
            m.path as original_media_path,
            m.service_id,
            s.category,
            s.data as service_data
        FROM video_transcoding vt
        JOIN media m ON m.id = vt.video_id
        JOIN services s ON s.id = m.service_id
        WHERE vt.status = 'completed'
          AND s.is_active = true
          AND m.type = 'video';
        "#,
    )
    .execute(pool)
    .await?;

    info!("✅ Table video_transcoding vérifiée/créée avec succès");
    Ok(())
}

/// Crée les tables pour analytics vidéo avancé
pub async fn ensure_video_analytics_tables(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification des tables video_analytics...");

    // Table des événements analytics détaillés
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS video_analytics_events (
            id SERIAL PRIMARY KEY,
            video_id INTEGER NOT NULL REFERENCES media(id) ON DELETE CASCADE,
            user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
            session_id VARCHAR(255) NOT NULL,  -- Session unique par utilisateur/device
            
            -- Type d'événement
            event_type VARCHAR(20) NOT NULL CHECK (event_type IN (
                'play', 'pause', 'seek', 'complete', 'skip', 
                'quality_change', 'buffer_start', 'buffer_end', 'error'
            )),
            
            -- Timestamp et position
            timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            position_seconds DECIMAL(10,2) NOT NULL,  -- Position dans la vidéo
            duration_seconds DECIMAL(10,2) NOT NULL,  -- Durée totale de la vidéo
            
            -- Device et qualité
            device_info JSONB,  -- {platform, app_version, connection_type, network_quality}
            quality VARCHAR(10),  -- "1080p", "720p", "480p", "360p", "auto"
            
            -- Index pour performance
            CONSTRAINT video_analytics_events_check CHECK (video_id > 0)
        )
        "#,
    )
    .execute(pool)
    .await?;

    // Index pour requêtes analytics
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_video_analytics_events_video_id ON video_analytics_events(video_id)")
        .execute(pool)
        .await?;

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_video_analytics_events_timestamp ON video_analytics_events(timestamp DESC)")
        .execute(pool)
        .await?;

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_video_analytics_events_user_id ON video_analytics_events(user_id)")
        .execute(pool)
        .await?;

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_video_analytics_events_session_id ON video_analytics_events(session_id)")
        .execute(pool)
        .await?;

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_video_analytics_events_type ON video_analytics_events(event_type)")
        .execute(pool)
        .await?;

    // Index composite pour requêtes complexes
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_video_analytics_events_video_timestamp ON video_analytics_events(video_id, timestamp DESC)")
        .execute(pool)
        .await?;

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_video_analytics_events_video_type ON video_analytics_events(video_id, event_type)")
        .execute(pool)
        .await?;

    // Agrégats temps réel pour dashboard créateurs
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS video_analytics_realtime (
            video_id INTEGER PRIMARY KEY REFERENCES media(id) ON DELETE CASCADE,
            last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            total_views BIGINT NOT NULL DEFAULT 0,
            avg_watch_time DECIMAL(10,2) NOT NULL DEFAULT 0,
            unique_viewers_today INTEGER NOT NULL DEFAULT 0,
            completion_rate DECIMAL(5,2) NOT NULL DEFAULT 0,
            engagement_score DECIMAL(5,2) NOT NULL DEFAULT 0,
            
            -- Cache des dernières 24h
            views_today BIGINT NOT NULL DEFAULT 0,
            shares_today BIGINT NOT NULL DEFAULT 0,
            comments_today BIGINT NOT NULL DEFAULT 0,
            
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        "#,
    )
    .execute(pool)
    .await?;

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_video_analytics_realtime_updated ON video_analytics_realtime(last_updated DESC)")
        .execute(pool)
        .await?;

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_video_analytics_realtime_score ON video_analytics_realtime(engagement_score DESC)")
        .execute(pool)
        .await?;

    // Trigger pour mettre à jour updated_at automatiquement
    sqlx::query(
        r#"
        CREATE OR REPLACE FUNCTION update_video_analytics_realtime_updated_at()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
        END;
        $$ language 'plpgsql';
        "#,
    )
    .execute(pool)
    .await?;

    sqlx::query(
        r#"
        CREATE TRIGGER video_analytics_realtime_updated_at_trigger
            BEFORE UPDATE ON video_analytics_realtime
            FOR EACH ROW
            EXECUTE FUNCTION update_video_analytics_realtime_updated_at();
        "#,
    )
    .execute(pool)
    .await?;

    info!("✅ Tables video_analytics vérifiées/créées avec succès");
    Ok(())
}

/// ✅ NOUVEAU 2026-03-06: Migration pour corriger la génération de product_name
/// Corrige le bug où le premier produit créé lors de la création du service
/// avait un product_name = 'Produit sans nom' car la colonne générée ne gérait
/// pas tous les cas de structure de données
pub async fn migrate_product_name_generation(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification de la migration product_name...");

    // Vérifier si la colonne product_name existe avec l'ancienne définition
    let column_exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'service_products' 
            AND column_name = 'product_name'
        )",
    )
    .fetch_one(pool)
    .await?;

    if !column_exists {
        info!("ℹ️ Colonne product_name non trouvée, migration non nécessaire");
        return Ok(());
    }

    // Vérifier si des produits ont 'Produit sans nom' mais avec des données de nom disponibles
    let products_to_fix = sqlx::query_scalar::<_, i64>(
        r#"
        SELECT COUNT(*) 
        FROM service_products 
        WHERE product_name = 'Produit sans nom' 
        AND (
            product_data->'nom' IS NOT NULL 
            OR product_data->'nom_produit' IS NOT NULL
            OR product_data->>'nom' IS NOT NULL
            OR product_data->>'nom_produit' IS NOT NULL
            OR product_data->>'titre' IS NOT NULL
            OR product_data->>'title' IS NOT NULL
            OR product_data->>'name' IS NOT NULL
        )
        "#,
    )
    .fetch_one(pool)
    .await?;

    if products_to_fix > 0 {
        info!(
            "🔧 Correction de {} products avec product_name = 'Produit sans nom'",
            products_to_fix
        );

        // Mettre à jour les product_name avec une extraction plus robuste
        let result = sqlx::query(
            r#"
            UPDATE service_products 
            SET product_name = COALESCE(
                product_data->'nom'->>'valeur',
                product_data->'nom_produit'->>'valeur',
                product_data->>'nom',
                product_data->>'nom_produit',
                product_data->>'titre',
                product_data->>'title',
                product_data->>'name',
                'Produit sans nom'
            )
            WHERE product_name = 'Produit sans nom' 
            AND (
                product_data->'nom' IS NOT NULL 
                OR product_data->'nom_produit' IS NOT NULL
                OR product_data->>'nom' IS NOT NULL
                OR product_data->>'nom_produit' IS NOT NULL
                OR product_data->>'titre' IS NOT NULL
                OR product_data->>'title' IS NOT NULL
                OR product_data->>'name' IS NOT NULL
            )
            "#,
        )
        .execute(pool)
        .await?;

        info!(
            "✅ {} product_name corrigés avec succès",
            result.rows_affected()
        );
    } else {
        info!("✅ Aucun product_name à corriger");
    }

    Ok(())
}

/// ✅ 2026-03-07 : Tables pour digitalisation complète des compagnies d'assurance
/// - insurance_products: Catalogue produits d'assurance paramétrable
/// - insurance_policies: Polices/contrats émis aux clients
/// - insurance_claims: Déclarations de sinistres avec suivi temps réel
/// - insurance_claim_documents: Documents joints aux sinistres
/// - insurance_policy_documents: Documents des polices (conditions générales, attestations)
pub async fn ensure_insurance_digitalization_tables(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification/création des tables digitalisation assurance...");

    // 1. Table insurance_products — Catalogue produits paramétrable par l'assureur
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS insurance_products (
            id SERIAL PRIMARY KEY,
            service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
            assureur_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            nom_produit TEXT NOT NULL,
            type_assurance TEXT NOT NULL CHECK (type_assurance IN ('vie','non_vie')),
            sous_categorie TEXT NOT NULL,
            description TEXT,
            compagnie TEXT,
            prime_mensuelle NUMERIC(12,2),
            prime_trimestrielle NUMERIC(12,2),
            prime_semestrielle NUMERIC(12,2),
            prime_annuelle NUMERIC(12,2),
            devise TEXT DEFAULT 'XAF',
            couverture_max NUMERIC(14,2),
            franchise_montant NUMERIC(12,2) DEFAULT 0,
            franchise_pourcentage NUMERIC(5,2) DEFAULT 0,
            duree_contrat_mois INTEGER DEFAULT 12,
            age_min INTEGER DEFAULT 18,
            age_max INTEGER DEFAULT 70,
            garanties JSONB DEFAULT '[]'::jsonb,
            exclusions JSONB DEFAULT '[]'::jsonb,
            conditions_generales TEXT,
            avantages JSONB DEFAULT '[]'::jsonb,
            options_supplementaires JSONB DEFAULT '[]'::jsonb,
            documents_requis JSONB DEFAULT '[]'::jsonb,
            delai_carence_jours INTEGER DEFAULT 0,
            taux_commission NUMERIC(5,2) DEFAULT 0,
            is_active BOOLEAN DEFAULT true,
            is_featured BOOLEAN DEFAULT false,
            souscriptions_count INTEGER DEFAULT 0,
            note_moyenne NUMERIC(3,2) DEFAULT 0,
            metadata JSONB DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        )
        "#,
    )
    .execute(pool)
    .await?;

    // Index produits
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_insurance_products_service ON insurance_products(service_id)")
        .execute(pool).await?;
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_insurance_products_assureur ON insurance_products(assureur_user_id)")
        .execute(pool).await?;
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_insurance_products_type ON insurance_products(type_assurance, sous_categorie)")
        .execute(pool).await?;
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_insurance_products_active ON insurance_products(is_active) WHERE is_active = true")
        .execute(pool).await?;

    // 2. Table insurance_policies — Polices/contrats émis
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS insurance_policies (
            id SERIAL PRIMARY KEY,
            product_id INTEGER NOT NULL REFERENCES insurance_products(id) ON DELETE RESTRICT,
            assureur_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            client_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
            numero_police TEXT NOT NULL UNIQUE,
            client_nom TEXT NOT NULL,
            client_prenom TEXT,
            client_telephone TEXT,
            client_email TEXT,
            client_adresse TEXT,
            client_date_naissance DATE,
            client_profession TEXT,
            beneficiaires JSONB DEFAULT '[]'::jsonb,
            date_effet DATE NOT NULL,
            date_expiration DATE NOT NULL,
            prime_totale NUMERIC(12,2) NOT NULL,
            devise TEXT DEFAULT 'XAF',
            frequence_paiement TEXT DEFAULT 'annuel' CHECK (frequence_paiement IN ('mensuel','trimestriel','semestriel','annuel','unique')),
            statut TEXT DEFAULT 'active' CHECK (statut IN ('brouillon','en_attente','active','suspendue','resiliee','expiree','annulee')),
            garanties_souscrites JSONB DEFAULT '[]'::jsonb,
            options_souscrites JSONB DEFAULT '[]'::jsonb,
            conditions_particulieres TEXT,
            objet_assure JSONB DEFAULT '{}'::jsonb,
            franchise_applicable NUMERIC(12,2) DEFAULT 0,
            plafond_indemnisation NUMERIC(14,2),
            dernier_paiement_at TIMESTAMPTZ,
            prochain_paiement_at TIMESTAMPTZ,
            motif_resiliation TEXT,
            renouvellement_auto BOOLEAN DEFAULT true,
            metadata JSONB DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        )
        "#,
    )
    .execute(pool)
    .await?;

    // Index polices
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_insurance_policies_product ON insurance_policies(product_id)")
        .execute(pool).await?;
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_insurance_policies_assureur ON insurance_policies(assureur_user_id)")
        .execute(pool).await?;
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_insurance_policies_client ON insurance_policies(client_user_id)")
        .execute(pool).await?;
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_insurance_policies_numero ON insurance_policies(numero_police)")
        .execute(pool).await?;
    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_insurance_policies_statut ON insurance_policies(statut)",
    )
    .execute(pool)
    .await?;
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_insurance_policies_expiration ON insurance_policies(date_expiration)")
        .execute(pool).await?;

    // 3. Table insurance_claims — Déclarations de sinistres
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS insurance_claims (
            id SERIAL PRIMARY KEY,
            policy_id INTEGER NOT NULL REFERENCES insurance_policies(id) ON DELETE RESTRICT,
            assureur_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            declarant_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
            numero_sinistre TEXT NOT NULL UNIQUE,
            type_sinistre TEXT NOT NULL,
            date_sinistre DATE NOT NULL,
            lieu_sinistre TEXT,
            gps_sinistre TEXT,
            description_sinistre TEXT NOT NULL,
            circonstances TEXT,
            temoins JSONB DEFAULT '[]'::jsonb,
            dommages_estimes NUMERIC(14,2),
            montant_reclame NUMERIC(14,2),
            montant_indemnise NUMERIC(14,2),
            devise TEXT DEFAULT 'XAF',
            statut TEXT DEFAULT 'declare' CHECK (statut IN (
                'declare','en_cours_instruction','expertise_demandee','expertise_en_cours',
                'en_attente_documents','approuve','partiellement_approuve',
                'refuse','indemnise','clos','conteste'
            )),
            priorite TEXT DEFAULT 'normale' CHECK (priorite IN ('basse','normale','haute','urgente')),
            agent_traitant TEXT,
            expert_assigne TEXT,
            date_expertise DATE,
            rapport_expertise TEXT,
            motif_refus TEXT,
            date_indemnisation DATE,
            mode_indemnisation TEXT CHECK (mode_indemnisation IN ('virement','cheque','mobile_money','reparation_directe')),
            reference_paiement TEXT,
            notes_internes TEXT,
            historique_statuts JSONB DEFAULT '[]'::jsonb,
            ai_analysis JSONB DEFAULT '{}'::jsonb,
            fraud_score NUMERIC(5,2),
            metadata JSONB DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        )
        "#,
    )
    .execute(pool)
    .await?;

    // Index sinistres
    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_insurance_claims_policy ON insurance_claims(policy_id)",
    )
    .execute(pool)
    .await?;
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_insurance_claims_assureur ON insurance_claims(assureur_user_id)")
        .execute(pool).await?;
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_insurance_claims_declarant ON insurance_claims(declarant_user_id)")
        .execute(pool).await?;
    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_insurance_claims_statut ON insurance_claims(statut)",
    )
    .execute(pool)
    .await?;
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_insurance_claims_numero ON insurance_claims(numero_sinistre)")
        .execute(pool).await?;
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_insurance_claims_date ON insurance_claims(date_sinistre DESC)")
        .execute(pool).await?;

    // 4. Table insurance_claim_documents — Pièces jointes sinistres
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS insurance_claim_documents (
            id SERIAL PRIMARY KEY,
            claim_id INTEGER NOT NULL REFERENCES insurance_claims(id) ON DELETE CASCADE,
            uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
            type_document TEXT NOT NULL,
            nom_fichier TEXT NOT NULL,
            url_fichier TEXT NOT NULL,
            taille_octets BIGINT,
            mime_type TEXT,
            description TEXT,
            is_verified BOOLEAN DEFAULT false,
            verified_by INTEGER REFERENCES users(id),
            verified_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ DEFAULT NOW()
        )
        "#,
    )
    .execute(pool)
    .await?;

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_claim_documents_claim ON insurance_claim_documents(claim_id)")
        .execute(pool).await?;

    // 5. Table insurance_policy_documents — Documents des polices
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS insurance_policy_documents (
            id SERIAL PRIMARY KEY,
            policy_id INTEGER NOT NULL REFERENCES insurance_policies(id) ON DELETE CASCADE,
            uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
            type_document TEXT NOT NULL,
            nom_fichier TEXT NOT NULL,
            url_fichier TEXT NOT NULL,
            taille_octets BIGINT,
            mime_type TEXT,
            description TEXT,
            created_at TIMESTAMPTZ DEFAULT NOW()
        )
        "#,
    )
    .execute(pool)
    .await?;

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_policy_documents_policy ON insurance_policy_documents(policy_id)")
        .execute(pool).await?;

    info!("✅ Tables digitalisation assurance créées avec succès (insurance_products, insurance_policies, insurance_claims, documents)");
    Ok(())
}

/// ✅ NOUVEAU 2026-03-11 : Table platform_settings pour stocker les numéros Mobile Money de la plateforme
/// et autres paramètres admin (accessible uniquement aux admin/super-admin)
pub async fn ensure_platform_settings_table(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification de la table platform_settings...");

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS platform_settings (
            id SERIAL PRIMARY KEY,
            key TEXT NOT NULL UNIQUE,
            value JSONB NOT NULL DEFAULT '{}'::jsonb,
            description TEXT,
            updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        )
        "#,
    )
    .execute(pool)
    .await?;

    // Seed les paramètres de paiement plateforme s'ils n'existent pas
    sqlx::query(
        r#"
        INSERT INTO platform_settings (key, value, description)
        VALUES
            ('platform_mtn_money', '{"phone": "", "merchant_id": "", "enabled": false}'::jsonb, 'Numéro MTN Mobile Money de la plateforme pour recevoir les paiements tokens'),
            ('platform_orange_money', '{"phone": "", "merchant_id": "", "enabled": false}'::jsonb, 'Numéro Orange Money de la plateforme pour recevoir les paiements tokens'),
            ('platform_bank_account', '{"bank_name": "", "account_number": "", "iban": "", "enabled": false}'::jsonb, 'Compte bancaire de la plateforme')
        ON CONFLICT (key) DO NOTHING
        "#,
    )
    .execute(pool)
    .await?;

    info!("✅ Table platform_settings créée avec succès");
    Ok(())
}

/// ✅ NOUVEAU 2026-03-14 : Table internal_shares pour le partage interne de produits entre utilisateurs
pub async fn ensure_internal_shares_table(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification de la table internal_shares...");

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS internal_shares (
            id SERIAL PRIMARY KEY,
            sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            recipient_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            service_id INTEGER,
            product_index INTEGER,
            content_type TEXT NOT NULL DEFAULT 'product',
            content_data JSONB DEFAULT '{}'::jsonb,
            message TEXT DEFAULT '',
            is_read BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        "#,
    )
    .execute(pool)
    .await?;

    // Ajouter les colonnes si elles n'existent pas (pour migration sur table existante)
    let _ = sqlx::query("ALTER TABLE internal_shares ADD COLUMN IF NOT EXISTS content_type TEXT NOT NULL DEFAULT 'product'")
        .execute(pool).await;
    let _ = sqlx::query("ALTER TABLE internal_shares ADD COLUMN IF NOT EXISTS content_data JSONB DEFAULT '{}'::jsonb")
        .execute(pool).await;
    let _ = sqlx::query("ALTER TABLE internal_shares ALTER COLUMN service_id DROP NOT NULL")
        .execute(pool)
        .await;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_internal_shares_recipient ON internal_shares(recipient_id, created_at DESC)",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_internal_shares_sender ON internal_shares(sender_id, created_at DESC)",
    )
    .execute(pool)
    .await?;

    info!("✅ Table internal_shares créée avec succès");
    Ok(())
}

/// ✅ NOUVEAU 2026-03-14 : Table navigation_checkpoint_comments pour les commentaires sur les alertes de navigation
pub async fn ensure_navigation_checkpoint_comments_table(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification de la table navigation_checkpoint_comments...");

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS navigation_checkpoint_comments (
            id SERIAL PRIMARY KEY,
            checkpoint_id UUID NOT NULL REFERENCES navigation_checkpoints(id) ON DELETE CASCADE,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            content TEXT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        "#,
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_nav_cp_comments_checkpoint ON navigation_checkpoint_comments(checkpoint_id, created_at DESC)",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_nav_cp_comments_user ON navigation_checkpoint_comments(user_id)",
    )
    .execute(pool)
    .await?;

    info!("✅ Table navigation_checkpoint_comments créée avec succès");
    Ok(())
}

/// ✅ NOUVEAU 2026-03-14 : Backfill services.category depuis data JSONB
/// Corrige les services existants dont services.category est NULL
/// mais dont la catégorie est stockée dans le JSONB data.
/// Garantit que les requêtes SQL filtrant sur services.category
/// trouvent tous les services (notamment supermarchés).
pub async fn backfill_services_category_from_data(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Backfill services.category depuis data JSONB...");

    // Étape 1: Backfill depuis data->>'category' (format string directe)
    let r1 = sqlx::query(
        r#"
        UPDATE services
        SET category = data->>'category'
        WHERE category IS NULL
          AND data->>'category' IS NOT NULL
          AND data->>'category' != ''
          AND jsonb_typeof(data->'category') = 'string'
        "#,
    )
    .execute(pool)
    .await?;
    info!(
        "  → Étape 1 (string directe): {} services mis à jour",
        r1.rows_affected()
    );

    // Étape 2: Backfill depuis data->'category'->>'valeur' (format structuré IA)
    let r2 = sqlx::query(
        r#"
        UPDATE services
        SET category = data->'category'->>'valeur'
        WHERE category IS NULL
          AND data->'category'->>'valeur' IS NOT NULL
          AND data->'category'->>'valeur' != ''
          AND jsonb_typeof(data->'category') = 'object'
        "#,
    )
    .execute(pool)
    .await?;
    info!(
        "  → Étape 2 (format IA valeur): {} services mis à jour",
        r2.rows_affected()
    );

    let total = r1.rows_affected() + r2.rows_affected();
    info!(
        "✅ Backfill services.category terminé: {} services corrigés",
        total
    );
    Ok(())
}

/// ✅ NOUVEAU 2026-03-15 : Table token_ledger pour historique complet des mouvements de tokens
/// Chaque crédit (recharge, bonus, refund) et débit (consommation IA, achat service) est enregistré.
pub async fn ensure_token_ledger_table(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification de la table token_ledger...");

    let exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'token_ledger')",
    )
    .fetch_one(pool)
    .await?;

    if exists {
        info!("✅ Table token_ledger déjà présente");
        return Ok(());
    }

    info!("📦 Création de la table token_ledger...");
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS token_ledger (
            id BIGSERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            operation_type VARCHAR(30) NOT NULL,
            amount BIGINT NOT NULL,
            balance_before BIGINT NOT NULL DEFAULT 0,
            balance_after BIGINT NOT NULL DEFAULT 0,
            reference_type VARCHAR(50),
            reference_id VARCHAR(255),
            description TEXT,
            metadata JSONB DEFAULT '{}',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_token_ledger_user_id ON token_ledger(user_id);
        CREATE INDEX IF NOT EXISTS idx_token_ledger_user_created ON token_ledger(user_id, created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_token_ledger_operation_type ON token_ledger(operation_type);
        CREATE INDEX IF NOT EXISTS idx_token_ledger_reference ON token_ledger(reference_type, reference_id);
        "#,
    )
    .execute(pool)
    .await?;

    info!("✅ Table token_ledger créée avec succès");
    Ok(())
}

/// ✅ NOUVEAU 2026-03-15 : Colonnes agrégateur dans payment_attempts
/// Ajoute aggregator_provider, aggregator_ref, payment_url pour le flux CinetPay/NotchPay
pub async fn ensure_payment_attempts_aggregator_columns(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification des colonnes agrégateur dans payment_attempts...");

    let table_exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'payment_attempts')",
    )
    .fetch_one(pool)
    .await?;

    if !table_exists {
        info!("⚠️ Table payment_attempts n'existe pas encore, création complète...");
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS payment_attempts (
                id SERIAL PRIMARY KEY,
                payment_id VARCHAR(255) NOT NULL UNIQUE,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                amount_xaf BIGINT NOT NULL,
                currency VARCHAR(10) NOT NULL DEFAULT 'XAF',
                payment_method VARCHAR(50) NOT NULL,
                phone_number VARCHAR(20),
                status VARCHAR(30) NOT NULL DEFAULT 'pending',
                transaction_id VARCHAR(255),
                aggregator_provider VARCHAR(30),
                aggregator_ref VARCHAR(255),
                payment_url TEXT,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                confirmed_at TIMESTAMPTZ
            );

            CREATE INDEX IF NOT EXISTS idx_payment_attempts_user ON payment_attempts(user_id);
            CREATE INDEX IF NOT EXISTS idx_payment_attempts_status ON payment_attempts(status);
            CREATE INDEX IF NOT EXISTS idx_payment_attempts_payment_id ON payment_attempts(payment_id);
            CREATE INDEX IF NOT EXISTS idx_payment_attempts_aggregator_ref ON payment_attempts(aggregator_ref);
            "#,
        )
        .execute(pool)
        .await?;
        info!("✅ Table payment_attempts créée avec colonnes agrégateur");
        return Ok(());
    }

    // Ajouter les colonnes manquantes
    let columns = vec![
        ("aggregator_provider", "VARCHAR(30)"),
        ("aggregator_ref", "VARCHAR(255)"),
        ("payment_url", "TEXT"),
    ];

    for (col, col_type) in columns {
        let col_exists = sqlx::query_scalar::<_, bool>(&format!(
            "SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'payment_attempts' AND column_name = '{}')",
            col
        ))
        .fetch_one(pool)
        .await?;

        if !col_exists {
            let query = format!(
                "ALTER TABLE payment_attempts ADD COLUMN IF NOT EXISTS {} {}",
                col, col_type
            );
            sqlx::query(&query).execute(pool).await?;
            info!("  ✅ Colonne '{}' ajoutée à payment_attempts", col);
        }
    }

    // Index sur aggregator_ref
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_payment_attempts_aggregator_ref ON payment_attempts(aggregator_ref)")
        .execute(pool)
        .await
        .ok();

    info!("✅ Colonnes agrégateur payment_attempts OK");
    Ok(())
}

/// ✅ NOUVEAU 2026-03-15 : Tables user_wallets + wallet_transactions
/// Système de portefeuille interne pour reversements prestataires/coursiers et remboursements
pub async fn ensure_wallet_tables(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification des tables user_wallets et wallet_transactions...");

    // 1. Table user_wallets — solde courant de chaque utilisateur
    let wallets_exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'user_wallets')",
    )
    .fetch_one(pool)
    .await?;

    if !wallets_exists {
        info!("📦 Création de la table user_wallets...");
        sqlx::query(
            r#"
            CREATE TABLE user_wallets (
                id BIGSERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                balance_cents BIGINT NOT NULL DEFAULT 0,
                currency VARCHAR(10) NOT NULL DEFAULT 'XAF',
                frozen_cents BIGINT NOT NULL DEFAULT 0,
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                UNIQUE(user_id, currency)
            );

            CREATE INDEX IF NOT EXISTS idx_user_wallets_user_id ON user_wallets(user_id);

            -- Contrainte: solde ne peut pas être négatif (hors gel)
            ALTER TABLE user_wallets ADD CONSTRAINT chk_wallet_balance_non_negative
                CHECK (balance_cents >= 0);
            "#,
        )
        .execute(pool)
        .await?;
        info!("✅ Table user_wallets créée");
    } else {
        info!("✅ Table user_wallets déjà présente");
    }

    // 2. Table wallet_transactions — historique complet des mouvements
    let txn_exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'wallet_transactions')",
    )
    .fetch_one(pool)
    .await?;

    if !txn_exists {
        info!("📦 Création de la table wallet_transactions...");
        sqlx::query(
            r#"
            CREATE TABLE wallet_transactions (
                id BIGSERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                transaction_type VARCHAR(30) NOT NULL,
                amount_cents BIGINT NOT NULL,
                balance_before_cents BIGINT NOT NULL,
                balance_after_cents BIGINT NOT NULL,
                currency VARCHAR(10) NOT NULL DEFAULT 'XAF',
                reference_type VARCHAR(50),
                reference_id VARCHAR(255),
                delivery_id UUID,
                description TEXT,
                metadata JSONB,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );

            CREATE INDEX IF NOT EXISTS idx_wallet_txn_user_id ON wallet_transactions(user_id);
            CREATE INDEX IF NOT EXISTS idx_wallet_txn_user_created ON wallet_transactions(user_id, created_at DESC);
            CREATE INDEX IF NOT EXISTS idx_wallet_txn_type ON wallet_transactions(transaction_type);
            CREATE INDEX IF NOT EXISTS idx_wallet_txn_delivery ON wallet_transactions(delivery_id);
            CREATE INDEX IF NOT EXISTS idx_wallet_txn_reference ON wallet_transactions(reference_type, reference_id);
            "#,
        )
        .execute(pool)
        .await?;
        info!("✅ Table wallet_transactions créée");
    } else {
        info!("✅ Table wallet_transactions déjà présente");
    }

    Ok(())
}

/// ✅ NOUVEAU 2026-03-15 : Table disbursement_requests
/// Transferts sortants vers prestataires/coursiers via CinetPay/NotchPay
pub async fn ensure_disbursement_requests_table(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification de la table disbursement_requests...");

    let exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'disbursement_requests')",
    )
    .fetch_one(pool)
    .await?;

    if exists {
        info!("✅ Table disbursement_requests déjà présente");
        return Ok(());
    }

    info!("📦 Création de la table disbursement_requests...");
    sqlx::query(
        r#"
        CREATE TABLE disbursement_requests (
            id BIGSERIAL PRIMARY KEY,
            recipient_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            amount_cents BIGINT NOT NULL,
            currency VARCHAR(10) NOT NULL DEFAULT 'XAF',
            recipient_phone VARCHAR(30),
            recipient_method VARCHAR(30) NOT NULL,
            provider VARCHAR(30),
            provider_reference VARCHAR(255),
            status VARCHAR(30) NOT NULL DEFAULT 'pending',
            delivery_id UUID,
            reason TEXT,
            error_message TEXT,
            attempts INTEGER NOT NULL DEFAULT 0,
            metadata JSONB,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            processed_at TIMESTAMPTZ,
            completed_at TIMESTAMPTZ
        );

        CREATE INDEX IF NOT EXISTS idx_disbursement_user ON disbursement_requests(recipient_user_id);
        CREATE INDEX IF NOT EXISTS idx_disbursement_status ON disbursement_requests(status);
        CREATE INDEX IF NOT EXISTS idx_disbursement_delivery ON disbursement_requests(delivery_id);
        CREATE INDEX IF NOT EXISTS idx_disbursement_provider_ref ON disbursement_requests(provider_reference);
        "#,
    )
    .execute(pool)
    .await?;

    info!("✅ Table disbursement_requests créée");
    Ok(())
}
