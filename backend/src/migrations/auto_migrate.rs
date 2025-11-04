// Module pour exécuter automatiquement les migrations au démarrage
use sqlx::PgPool;
use log::{info, warn, error};

/// Vérifie et crée la fonction deactivate_expired_products() si elle n'existe pas
pub async fn ensure_deactivate_expired_products_function(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification de la fonction deactivate_expired_products()...");
    
    // Vérifier si la fonction existe
    let exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'deactivate_expired_products')"
    )
    .fetch_one(pool)
    .await?;
    
    if exists {
        info!("✅ Fonction deactivate_expired_products() déjà présente");
        return Ok(());
    }
    
    warn!("⚠️ Fonction deactivate_expired_products() manquante, création en cours...");
    
    // Créer la table products_lifecycle si elle n'existe pas
    sqlx::query(r#"
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
    "#)
    .execute(pool)
    .await?;
    
    // Créer les index
    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_products_lifecycle_service_id ON products_lifecycle(service_id)"
    )
    .execute(pool)
    .await?;
    
    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_products_lifecycle_active ON products_lifecycle(is_active)"
    )
    .execute(pool)
    .await?;
    
    sqlx::query(
        r#"CREATE INDEX IF NOT EXISTS idx_products_lifecycle_auto_deactivate 
           ON products_lifecycle(auto_deactivate_at) WHERE is_active = TRUE"#
    )
    .execute(pool)
    .await?;
    
    // Créer la fonction
    sqlx::query(r#"
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
    "#)
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
        "SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'publicites')"
    )
    .fetch_one(pool)
    .await?;
    
    if exists {
        info!("✅ Table publicites déjà présente");
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
            
            -- Tarification et durée
            duree_jours INTEGER NOT NULL CHECK (duree_jours > 0),
            cout INTEGER NOT NULL CHECK (cout >= 0),
            devise_utilisateur VARCHAR(10) DEFAULT 'FCFA',
            
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
    sqlx::query(r#"
        CREATE OR REPLACE FUNCTION update_publicites_updated_at()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql
    "#)
    .execute(pool)
    .await?;
    
    // Supprimer le trigger s'il existe
    let _ = sqlx::query("DROP TRIGGER IF EXISTS trigger_update_publicites_updated_at ON publicites")
        .execute(pool)
        .await;
    
    // Créer le trigger
    sqlx::query(r#"
        CREATE TRIGGER trigger_update_publicites_updated_at
            BEFORE UPDATE ON publicites
            FOR EACH ROW
            EXECUTE FUNCTION update_publicites_updated_at()
    "#)
    .execute(pool)
    .await?;
    
    // Fonction pour calculer automatiquement date_fin
    sqlx::query(r#"
        CREATE OR REPLACE FUNCTION set_publicite_date_fin()
        RETURNS TRIGGER AS $$
        BEGIN
            IF NEW.date_fin IS NULL OR NEW.date_fin = NEW.date_debut THEN
                NEW.date_fin = NEW.date_debut + (NEW.duree_jours || ' days')::interval;
            END IF;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql
    "#)
    .execute(pool)
    .await?;
    
    // Supprimer le trigger s'il existe
    let _ = sqlx::query("DROP TRIGGER IF EXISTS trigger_set_publicite_date_fin ON publicites")
        .execute(pool)
        .await;
    
    // Créer le trigger
    sqlx::query(r#"
        CREATE TRIGGER trigger_set_publicite_date_fin
            BEFORE INSERT OR UPDATE ON publicites
            FOR EACH ROW
            EXECUTE FUNCTION set_publicite_date_fin()
    "#)
    .execute(pool)
    .await?;
    
    // Fonction pour désactiver automatiquement les publicités expirées
    sqlx::query(r#"
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
    "#)
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
        "SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications')"
    )
    .fetch_one(pool)
    .await?;
    
    if exists {
        info!("✅ Table notifications déjà présente");
        return Ok(());
    }
    
    warn!("⚠️ Table notifications manquante, création en cours...");
    
    // Créer la table notifications avec les colonnes compatibles pour tous les usages
    sqlx::query(r#"
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
    "#)
    .execute(pool)
    .await?;
    
    // Créer les index pour performances
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id)")
        .execute(pool)
        .await?;
    
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read)")
        .execute(pool)
        .await?;
    
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC)")
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
    
    // Vérifier si la table existe
    let exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'autocomplete_characteristics')"
    )
    .fetch_one(pool)
    .await?;
    
    if exists {
        info!("✅ Table autocomplete_characteristics déjà présente");
        return Ok(());
    }
    
    warn!("⚠️ Table autocomplete_characteristics manquante, création en cours...");
    
    // Créer la table autocomplete_characteristics
    sqlx::query(r#"
        CREATE TABLE IF NOT EXISTS autocomplete_characteristics (
            id SERIAL PRIMARY KEY,
            identifiant_base VARCHAR(255) NOT NULL,
            sous_caracteristique VARCHAR(255) NOT NULL,
            valeur VARCHAR(500) NOT NULL,
            origine_champs VARCHAR(50) NOT NULL DEFAULT 'ia',
            user_id INTEGER,
            service_id INTEGER,
            usage_count INTEGER DEFAULT 1,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            CONSTRAINT unique_autocomplete_characteristic 
                UNIQUE (identifiant_base, sous_caracteristique, valeur)
        )
    "#)
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
    
    // Fonction pour updated_at
    sqlx::query(r#"
        CREATE OR REPLACE FUNCTION update_autocomplete_characteristics_updated_at()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql
    "#)
    .execute(pool)
    .await?;
    
    // Trigger pour updated_at
    let _ = sqlx::query("DROP TRIGGER IF EXISTS trigger_autocomplete_characteristics_updated_at ON autocomplete_characteristics")
        .execute(pool)
        .await;
    
    sqlx::query(r#"
        CREATE TRIGGER trigger_autocomplete_characteristics_updated_at
            BEFORE UPDATE ON autocomplete_characteristics
            FOR EACH ROW
            EXECUTE FUNCTION update_autocomplete_characteristics_updated_at()
    "#)
    .execute(pool)
    .await?;
    
    // Fonction upsert
    sqlx::query(r#"
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
    "#)
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
        return Ok(());
    }
    
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
            chosen_location TEXT,
            usage_count INTEGER DEFAULT 1,
            is_ai_preferred BOOLEAN DEFAULT FALSE,
            ai_confidence FLOAT DEFAULT 0.0,
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
    
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_combinations_location_usage ON autocomplete_combinations(chosen_location, usage_count DESC)")
        .execute(pool)
        .await?;
    
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_combinations_variant ON autocomplete_combinations(has_variant, variant_dimension, variant_value)")
        .execute(pool)
        .await?;
    
    // Fonction pour updated_at
    sqlx::query(r#"
        CREATE OR REPLACE FUNCTION update_combinations_updated_at()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql
    "#)
    .execute(pool)
    .await?;
    
    // Trigger pour updated_at
    let _ = sqlx::query("DROP TRIGGER IF EXISTS trigger_combinations_updated_at ON autocomplete_combinations")
        .execute(pool)
        .await;
    
    sqlx::query(r#"
        CREATE TRIGGER trigger_combinations_updated_at
            BEFORE UPDATE ON autocomplete_combinations
            FOR EACH ROW
            EXECUTE FUNCTION update_combinations_updated_at()
    "#)
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
    sqlx::query(r#"
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
        BEGIN
            IF search_location IS NULL OR location_vector IS NULL THEN
                RETURN 0.0;
            END IF;
            
            search_lower := LOWER(search_location);
            
            IF chosen_location IS NOT NULL AND LOWER(chosen_location) = search_lower THEN
                RETURN 1.0;
            END IF;
            
            FOR i IN 1..array_length(location_vector, 1) LOOP
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
    "#)
    .execute(pool)
    .await?;
    
    // Fonction get_vector_value_by_label
    sqlx::query(r#"
        CREATE OR REPLACE FUNCTION get_vector_value_by_label(
            p_vector TEXT[],
            p_labels TEXT[],
            p_search_label TEXT
        )
        RETURNS TEXT AS $$
        DECLARE
            i INTEGER;
        BEGIN
            IF p_vector IS NULL OR p_labels IS NULL OR p_search_label IS NULL THEN
                RETURN NULL;
            END IF;
            
            IF array_length(p_vector, 1) != array_length(p_labels, 1) THEN
                RETURN NULL;
            END IF;
            
            FOR i IN 1..array_length(p_labels, 1) LOOP
                IF LOWER(p_labels[i]) = LOWER(p_search_label) THEN
                    RETURN p_vector[i];
                END IF;
            END LOOP;
            
            RETURN NULL;
        END;
        $$ LANGUAGE plpgsql IMMUTABLE
    "#)
    .execute(pool)
    .await?;
    
    // Fonction vector_to_jsonb
    sqlx::query(r#"
        CREATE OR REPLACE FUNCTION vector_to_jsonb(
            p_vector TEXT[],
            p_labels TEXT[]
        )
        RETURNS JSONB AS $$
        DECLARE
            result JSONB := '{}'::JSONB;
            i INTEGER;
        BEGIN
            IF p_vector IS NULL OR p_labels IS NULL THEN
                RETURN result;
            END IF;
            
            IF array_length(p_vector, 1) != array_length(p_labels, 1) THEN
                RETURN result;
            END IF;
            
            FOR i IN 1..array_length(p_labels, 1) LOOP
                result := result || jsonb_build_object(p_labels[i], p_vector[i]);
            END LOOP;
            
            RETURN result;
        END;
        $$ LANGUAGE plpgsql IMMUTABLE
    "#)
    .execute(pool)
    .await?;
    
    info!("✅ Table autocomplete_combinations créée avec succès !");
    
    Ok(())
}

/// Exécute toutes les migrations automatiques nécessaires
pub async fn run_auto_migrations(pool: &PgPool) {
    info!("🚀 Démarrage des migrations automatiques...");
    
    // Migration 1: Fonction de désactivation des produits
    match ensure_deactivate_expired_products_function(pool).await {
        Ok(_) => info!("✅ Migration auto: deactivate_expired_products OK"),
        Err(e) => error!("❌ Erreur migration auto: {}", e),
    }
    
    // Migration 2: Table publicites
    match ensure_publicites_table(pool).await {
        Ok(_) => info!("✅ Migration auto: publicites table OK"),
        Err(e) => error!("❌ Erreur migration auto publicites: {}", e),
    }
    
    // Migration 3: Table notifications
    match ensure_notifications_table(pool).await {
        Ok(_) => info!("✅ Migration auto: notifications table OK"),
        Err(e) => error!("❌ Erreur migration auto notifications: {}", e),
    }
    
    // Migration 4: Table autocomplete_characteristics (✅ 2025-11-01)
    match ensure_autocomplete_characteristics_table(pool).await {
        Ok(_) => info!("✅ Migration auto: autocomplete_characteristics table OK"),
        Err(e) => error!("❌ Erreur migration auto autocomplete_characteristics: {}", e),
    }
    
    // Migration 5: Table autocomplete_combinations (✅ NOUVEAU 2025-11-02)
    match ensure_autocomplete_combinations_table(pool).await {
        Ok(_) => info!("✅ Migration auto: autocomplete_combinations table OK"),
        Err(e) => error!("❌ Erreur migration auto autocomplete_combinations: {}", e),
    }
    
    // Migration 6: Table token_usage_logs (✅ NOUVEAU 2025-11-03)
    match ensure_token_usage_logs_table(pool).await {
        Ok(_) => info!("✅ Migration auto: token_usage_logs table OK"),
        Err(e) => error!("❌ Erreur migration auto token_usage_logs: {}", e),
    }
    
    info!("✅ Migrations automatiques terminées");
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
        
        return Ok(());
    }
    
    warn!("⚠️ Table token_usage_logs manquante, création en cours...");
    
    // Créer la table token_usage_logs
    sqlx::query(r#"
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
            created_at TIMESTAMPTZ DEFAULT NOW()
        )
    "#)
    .execute(pool)
    .await?;
    
    // Créer les index
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_token_usage_user_id ON token_usage_logs(user_id)")
        .execute(pool)
        .await?;
    
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_token_usage_intention ON token_usage_logs(intention)")
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

