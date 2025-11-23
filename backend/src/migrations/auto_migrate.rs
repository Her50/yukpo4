// Module pour exécuter automatiquement les migrations au démarrage
use chrono::Utc;
use log::{error, info, warn};
use serde_json::json;
use sqlx::PgPool;
use std::env;
use uuid::Uuid;

/// Vérifie et crée les tables media_engagement et media_distribution si elles n'existent pas
pub async fn ensure_media_analytics_tables(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification des tables media_engagement & media_distribution...");

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

    // Créer la fonction
    sqlx::query(
        r#"
        CREATE OR REPLACE FUNCTION deactivate_expired_products()
        RETURNS TABLE(
            service_id INTEGER,
            product_index INTEGER,
            product_nom TEXT,
            user_id INTEGER
        ) AS $$
        BEGIN
            RETURN QUERY
            UPDATE products_lifecycle pl
            SET 
                is_active = FALSE,
                updated_at = NOW(),
                deactivation_count = deactivation_count + 1
            FROM services s
            WHERE pl.service_id = s.id
                AND pl.is_active = TRUE
                AND pl.auto_deactivate_at <= NOW()
            RETURNING 
                pl.service_id,
                pl.product_index,
                pl.product_nom,
                s.user_id;
        END;
        $$ LANGUAGE plpgsql
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
            (u.nom_complet)::TEXT AS user_name,
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
                array_agg(COALESCE(u.nom_complet, u.email) ORDER BY pr.created_at DESC)::TEXT[] as users_sample
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

async fn run_delivery_step(
    pool: &PgPool,
    label: &'static str,
    sql: &'static str,
) -> Result<(), sqlx::Error> {
    info!("➡️ [delivery_migration] {}", label);
    let result = sqlx::query(sql).execute(pool).await;
    match result {
        Ok(res) => {
            info!(
                "✅ [delivery_migration] {} ({} lignes affectées)",
                label,
                res.rows_affected()
            );
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

pub async fn ensure_delivery_seed_data(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification des seeds livraison (parcel_types)...");

    sqlx::query(
        r#"
        INSERT INTO parcel_types
            (slug, display_name, description, max_weight_kg, max_volume_cm3, requires_fragile_handling, requires_isothermal, requires_secure_box, requires_document_protection)
        VALUES
            ('standard', 'Colis standard', 'Poids et dimensions classiques', 30, 60000, FALSE, FALSE, FALSE, FALSE),
            ('fragile', 'Fragile', 'Verre, électronique, nécessite manutention douce', 20, 40000, TRUE, FALSE, TRUE, FALSE),
            ('volumineux', 'Volumineux', 'Mobilier ou charges encombrantes', 80, 250000, FALSE, FALSE, FALSE, FALSE),
            ('medical', 'Médical', 'Colis médicaux sensibles', 10, 20000, TRUE, TRUE, TRUE, FALSE),
            ('document', 'Document', 'Documents importants/confidentiels', 5, 5000, TRUE, FALSE, TRUE, TRUE)
        ON CONFLICT (slug) DO NOTHING
        "#,
    )
    .execute(pool)
    .await?;

    info!("✅ Seeds livraison vérifiés");
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
        "ALTER TABLE product_orders ADD COLUMN IF NOT EXISTS validation_deadline TIMESTAMPTZ"
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
        "#
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
            courier_id INTEGER NOT NULL REFERENCES couriers(id),
            verification_code VARCHAR(6) NOT NULL UNIQUE,
            qr_code_data TEXT,
            expires_at TIMESTAMPTZ NOT NULL,
            verified_at TIMESTAMPTZ,
            verified_by INTEGER REFERENCES users(id),
            verification_method VARCHAR(50),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        "#
    )
    .execute(pool)
    .await?;
    
    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_courier_verification_delivery ON courier_verification_codes(delivery_id)"
    )
    .execute(pool)
    .await?;
    
    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_courier_verification_code ON courier_verification_codes(verification_code) WHERE verified_at IS NULL AND expires_at > NOW()"
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

pub async fn run_auto_migrations(pool: &PgPool) {
    info!("🚀 Démarrage des migrations automatiques...");

    // Migration 0: Table geo_hierarchy (✅ NOUVEAU 2025-11-06)
    match ensure_geo_hierarchy_table(pool).await {
        Ok(_) => info!("✅ Migration auto: geo_hierarchy OK"),
        Err(e) => error!("❌ Erreur migration auto geo_hierarchy: {}", e),
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

    match ensure_product_delivery_config_table(pool).await {
        Ok(_) => info!("✅ Migration auto: product_delivery_config OK"),
        Err(e) => error!("❌ Erreur migration auto product_delivery_config: {}", e),
    }

    match ensure_client_delivery_preferences_table(pool).await {
        Ok(_) => info!("✅ Migration auto: client_delivery_preferences OK"),
        Err(e) => error!("❌ Erreur migration auto client_delivery_preferences: {}", e),
    }

    match ensure_external_delivery_providers_table(pool).await {
        Ok(_) => info!("✅ Migration auto: external_delivery_providers OK"),
        Err(e) => error!("❌ Erreur migration auto external_delivery_providers: {}", e),
    }

    // TODO: Fonction ensure_public_tracking_tokens_table à implémenter
    // match ensure_public_tracking_tokens_table(pool).await {
    //     Ok(_) => info!("✅ Migration auto: public_tracking_tokens OK"),
    //     Err(e) => error!("❌ Erreur migration auto public_tracking_tokens: {}", e),
    // }

    match ensure_delivery_payment_reservations_table(pool).await {
        Ok(_) => info!("✅ Migration auto: delivery_payment_reservations OK"),
        Err(e) => error!("❌ Erreur migration auto delivery_payment_reservations: {}", e),
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
        Err(e) => error!("❌ Erreur migration auto delivery_proximity_suggestions: {}", e),
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

    match ensure_live_streaming_tables(pool).await {
        Ok(_) => info!("✅ Migration auto: live streaming tables OK"),
        Err(e) => error!("❌ Erreur migration auto live streaming: {}", e),
    }

    match ensure_live_flash_sales_tables(pool).await {
        Ok(_) => info!("✅ Migration auto: live flash sales tables OK"),
        Err(e) => error!("❌ Erreur migration auto live flash sales: {}", e),
    }

    // Migration 0.5: Table african_locations (✅ NOUVEAU 2025-11-06)
    match ensure_african_locations_table(pool).await {
        Ok(_) => info!("✅ Migration auto: african_locations OK"),
        Err(e) => error!("❌ Erreur migration auto african_locations: {}", e),
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
            query_text TEXT NOT NULL,
            query_type VARCHAR(50) DEFAULT 'text',
            category VARCHAR(255),
            filters JSONB,
            location_lat DOUBLE PRECISION,
            location_lon DOUBLE PRECISION,
            results_count INTEGER DEFAULT 0,
            clicked_result_id INTEGER,
            clicked_at TIMESTAMPTZ,
            session_id VARCHAR(255),
            device_type VARCHAR(50),
            created_at TIMESTAMPTZ DEFAULT NOW()
        )
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
        let _ = sqlx::query("REINDEX TABLE autocomplete_combinations")
            .execute(pool)
            .await;

        let _ = sqlx::query("ANALYZE autocomplete_combinations")
            .execute(pool)
            .await;

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

/// ✅ Phase 5 - Matching Intelligent : Ajoute les colonnes pour matching modes de paiement
pub async fn ensure_payment_methods_matching_columns(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification des colonnes payment_methods_matching...");
    
    // Ajouter colonne payment_methods dans users
    sqlx::query(
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS payment_methods JSONB DEFAULT '{}'::jsonb"
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
        "#
    )
    .execute(pool)
    .await?;
    
    // ✅ Phase 9 - Amélioration : Ajouter rejection_reason à shopping_order_items
    sqlx::query(
        r#"
        ALTER TABLE shopping_order_items 
        ADD COLUMN IF NOT EXISTS rejection_reason parcel_rejection_reason
        "#
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
