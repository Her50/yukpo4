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
        return Ok(());
    }
    
    warn!("⚠️ Table token_usage_logs manquante, création en cours...");
    
    // Créer la table token_usage_logs
    sqlx::query(r#"
        CREATE TABLE IF NOT EXISTS token_usage_logs (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            
            -- Type d'opération
            operation_type VARCHAR(50) NOT NULL,
            
            -- Montant
            tokens_amount INTEGER NOT NULL,
            tokens_before INTEGER NOT NULL,
            tokens_after INTEGER NOT NULL,
            
            -- Contexte
            service_id INTEGER REFERENCES services(id) ON DELETE SET NULL,
            description TEXT,
            metadata JSONB,
            
            -- Tracking
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            ip_address VARCHAR(45),
            user_agent TEXT
        )
    "#)
    .execute(pool)
    .await?;
    
    // Créer les index
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_token_logs_user_id ON token_usage_logs(user_id)")
        .execute(pool)
        .await?;
    
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_token_logs_operation ON token_usage_logs(operation_type)")
        .execute(pool)
        .await?;
    
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_token_logs_created_at ON token_usage_logs(created_at DESC)")
        .execute(pool)
        .await?;
    
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_token_logs_service_id ON token_usage_logs(service_id) WHERE service_id IS NOT NULL")
        .execute(pool)
        .await?;
    
    info!("✅ Table token_usage_logs créée avec succès !");
    
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
            service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
            
            -- Vecteurs séparés
            product_vector TEXT[] NOT NULL,
            location_vector TEXT[] NOT NULL DEFAULT '{}',
            full_vector TEXT[] NOT NULL,
            
            -- Lieu choisi (pour scoring)
            chosen_location VARCHAR(255),
            chosen_location_geoname_id BIGINT,
            
            -- Variations prix (si existe)
            has_variant BOOLEAN DEFAULT FALSE,
            variant_dimension VARCHAR(255),
            variant_value TEXT,
            prix NUMERIC(12, 2),
            devise VARCHAR(10) DEFAULT 'XAF',
            stock INTEGER,
            
            -- Stats
            usage_count INTEGER DEFAULT 1,
            view_count INTEGER DEFAULT 0,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW(),
            
            -- Contrainte unicité
            UNIQUE(service_id, full_vector)
        )
    "#)
    .execute(pool)
    .await?;
    
    // Créer les index GIN pour recherche vectorielle
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_full_vector_gin ON autocomplete_combinations USING GIN(full_vector)")
        .execute(pool)
        .await?;
    
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_product_vector_gin ON autocomplete_combinations USING GIN(product_vector)")
        .execute(pool)
        .await?;
    
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_location_vector_gin ON autocomplete_combinations USING GIN(location_vector)")
        .execute(pool)
        .await?;
    
    // Index normaux
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_autocomplete_service_id ON autocomplete_combinations(service_id)")
        .execute(pool)
        .await?;
    
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_autocomplete_chosen_location ON autocomplete_combinations(chosen_location) WHERE chosen_location IS NOT NULL")
        .execute(pool)
        .await?;
    
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_autocomplete_has_variant ON autocomplete_combinations(has_variant) WHERE has_variant = TRUE")
        .execute(pool)
        .await?;
    
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_autocomplete_usage_count ON autocomplete_combinations(usage_count DESC)")
        .execute(pool)
        .await?;
    
    info!("✅ Table autocomplete_combinations créée avec succès !");
    
    Ok(())
}

/// Vérifie et crée la table geo_hierarchy si elle n'existe pas
pub async fn ensure_geo_hierarchy_table(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification de la table geo_hierarchy...");
    
    // Vérifier si la table existe
    let exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'geo_hierarchy')"
    )
    .fetch_one(pool)
    .await?;
    
    if exists {
        info!("✅ Table geo_hierarchy déjà présente");
        return Ok(());
    }
    
    warn!("⚠️ Table geo_hierarchy manquante, création en cours...");
    
    // Créer la table geo_hierarchy
    sqlx::query(r#"
        CREATE TABLE IF NOT EXISTS geo_hierarchy (
            geoname_id BIGINT PRIMARY KEY,
            place_name VARCHAR(255) NOT NULL,
            display_name TEXT NOT NULL,
            
            -- Type et niveau
            feature_code VARCHAR(10) NOT NULL,
            admin_level INTEGER NOT NULL,
            is_leaf BOOLEAN DEFAULT FALSE,
            
            -- Contexte (homonymes)
            parent_country VARCHAR(255) NOT NULL,
            parent_country_code CHAR(2),
            
            -- Vecteur bidirectionnel [Choix, Enfants..., Parents...]
            location_vector TEXT[] NOT NULL,
            
            -- Coordonnées
            lat NUMERIC(10, 7) NOT NULL,
            lng NUMERIC(10, 7) NOT NULL,
            bounds JSONB,
            
            -- Métadonnées
            population INTEGER,
            timezone VARCHAR(50),
            
            -- Tracking
            times_used INTEGER DEFAULT 0,
            last_enriched_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            
            -- Contrainte unicité (gérer homonymes)
            UNIQUE (place_name, parent_country, lat, lng)
        )
    "#)
    .execute(pool)
    .await?;
    
    // Créer les index
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_geo_name_country ON geo_hierarchy(place_name, parent_country)")
        .execute(pool)
        .await?;
    
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_geo_vector_gin ON geo_hierarchy USING GIN(location_vector)")
        .execute(pool)
        .await?;
    
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_geo_country ON geo_hierarchy(parent_country)")
        .execute(pool)
        .await?;
    
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_geo_geoname ON geo_hierarchy(geoname_id)")
        .execute(pool)
        .await?;
    
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_geo_admin_level ON geo_hierarchy(admin_level)")
        .execute(pool)
        .await?;
    
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_geo_is_leaf ON geo_hierarchy(is_leaf) WHERE is_leaf = TRUE")
        .execute(pool)
        .await?;
    
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_geo_times_used ON geo_hierarchy(times_used DESC)")
        .execute(pool)
        .await?;
    
    info!("✅ Table geo_hierarchy créée avec succès !");
    
    Ok(())
}

/// Vérifie et crée la table image_analyses si elle n'existe pas
pub async fn ensure_image_analyses_table(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification de la table image_analyses...");
    
    // Vérifier si la table existe
    let exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'image_analyses')"
    )
    .fetch_one(pool)
    .await?;
    
    if exists {
        info!("✅ Table image_analyses déjà présente");
        return Ok(());
    }
    
    warn!("⚠️ Table image_analyses manquante, création en cours...");
    
    // Créer la table image_analyses
    sqlx::query(r#"
        CREATE TABLE IF NOT EXISTS image_analyses (
            id SERIAL PRIMARY KEY,
            service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
            
            -- Image source
            image_url TEXT NOT NULL,
            image_hash VARCHAR(64),
            
            -- Analyse IA
            description_generee TEXT,
            tags_detectes TEXT[] DEFAULT '{}',
            couleur_dominante VARCHAR(50),
            categorie_predite VARCHAR(100),
            
            -- Métadonnées
            confidence_score NUMERIC(5, 2),
            analysis_provider VARCHAR(50),
            analysis_metadata JSONB,
            
            -- Tracking
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        )
    "#)
    .execute(pool)
    .await?;
    
    // Créer les index
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_image_analyses_service_id ON image_analyses(service_id)")
        .execute(pool)
        .await?;
    
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_image_analyses_hash ON image_analyses(image_hash) WHERE image_hash IS NOT NULL")
        .execute(pool)
        .await?;
    
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_image_analyses_tags_gin ON image_analyses USING GIN(tags_detectes)")
        .execute(pool)
        .await?;
    
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_image_analyses_categorie ON image_analyses(categorie_predite) WHERE categorie_predite IS NOT NULL")
        .execute(pool)
        .await?;
    
    info!("✅ Table image_analyses créée avec succès !");
    
    Ok(())
}

/// Crée la fonction calculate_location_score pour le scoring géographique
pub async fn ensure_calculate_location_score_function(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification de la fonction calculate_location_score()...");
    
    // Vérifier si la fonction existe
    let exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'calculate_location_score')"
    )
    .fetch_one(pool)
    .await?;
    
    if exists {
        info!("✅ Fonction calculate_location_score() déjà présente");
        return Ok(());
    }
    
    warn!("⚠️ Fonction calculate_location_score() manquante, création en cours...");
    
    // Créer la fonction
    sqlx::query(r#"
        CREATE OR REPLACE FUNCTION calculate_location_score(
            search_location TEXT,
            location_vector TEXT[],
            chosen_location TEXT
        ) RETURNS FLOAT AS $$
        DECLARE
            position INTEGER;
            score FLOAT;
            vector_length INTEGER;
        BEGIN
            -- Match exact sur choix utilisateur
            IF search_location = chosen_location THEN
                RETURN 100.0;
            END IF;
            
            -- Trouver position dans vecteur
            SELECT idx INTO position
            FROM unnest(location_vector) WITH ORDINALITY AS arr(val, idx)
            WHERE val = search_location
            LIMIT 1;
            
            -- Pas trouvé
            IF position IS NULL THEN
                RETURN 0.0;
            END IF;
            
            -- Calculer longueur vecteur
            vector_length := array_length(location_vector, 1);
            IF vector_length IS NULL OR vector_length = 0 THEN
                RETURN 0.0;
            END IF;
            
            -- Score selon position : 
            -- Position 1 (choix) = 100
            -- Position 2-15 (enfants) = 100 / position
            -- Position 16+ (parents) = 50 / position
            IF position = 1 THEN
                score := 100.0;
            ELSIF position <= 15 THEN
                score := 100.0 / position::FLOAT;
            ELSE
                score := 50.0 / position::FLOAT;
            END IF;
            
            RETURN score;
        END;
        $$ LANGUAGE plpgsql IMMUTABLE;
    "#)
    .execute(pool)
    .await?;
    
    info!("✅ Fonction calculate_location_score() créée avec succès !");
    
    Ok(())
}

/// Crée la fonction hybrid_image_search pour la recherche par image
pub async fn ensure_hybrid_image_search_function(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification de la fonction hybrid_image_search()...");
    
    // Vérifier si la fonction existe
    let exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'hybrid_image_search')"
    )
    .fetch_one(pool)
    .await?;
    
    if exists {
        info!("✅ Fonction hybrid_image_search() déjà présente");
        return Ok(());
    }
    
    warn!("⚠️ Fonction hybrid_image_search() manquante, création en cours...");
    
    // Créer la fonction
    sqlx::query(r#"
        CREATE OR REPLACE FUNCTION hybrid_image_search(
            search_tags TEXT[],
            search_category TEXT DEFAULT NULL,
            search_color TEXT DEFAULT NULL,
            limit_results INTEGER DEFAULT 20
        ) RETURNS TABLE(
            service_id INTEGER,
            image_url TEXT,
            tags_matched INTEGER,
            confidence_score NUMERIC,
            total_score FLOAT
        ) AS $$
        BEGIN
            RETURN QUERY
            SELECT 
                ia.service_id,
                ia.image_url,
                (
                    SELECT COUNT(*)::INTEGER
                    FROM unnest(ia.tags_detectes) tag
                    WHERE tag = ANY(search_tags)
                ) as tags_matched,
                ia.confidence_score,
                (
                    -- Score basé sur tags matchés
                    (SELECT COUNT(*)::FLOAT FROM unnest(ia.tags_detectes) tag WHERE tag = ANY(search_tags)) * 10.0
                    +
                    -- Bonus catégorie
                    CASE WHEN search_category IS NOT NULL AND ia.categorie_predite = search_category THEN 20.0 ELSE 0.0 END
                    +
                    -- Bonus couleur
                    CASE WHEN search_color IS NOT NULL AND ia.couleur_dominante = search_color THEN 15.0 ELSE 0.0 END
                    +
                    -- Bonus confidence
                    COALESCE(ia.confidence_score, 0.0)
                ) as total_score
            FROM image_analyses ia
            WHERE 
                (search_tags IS NULL OR ia.tags_detectes && search_tags)
                OR (search_category IS NOT NULL AND ia.categorie_predite = search_category)
                OR (search_color IS NOT NULL AND ia.couleur_dominante = search_color)
            ORDER BY total_score DESC
            LIMIT limit_results;
        END;
        $$ LANGUAGE plpgsql;
    "#)
    .execute(pool)
    .await?;
    
    info!("✅ Fonction hybrid_image_search() créée avec succès !");
    
    Ok(())
}

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
            token_price_user DOUBLE PRECISION NOT NULL DEFAULT 0.004,
            token_price_provider DOUBLE PRECISION NOT NULL DEFAULT 0.004,
            commission_pct REAL NOT NULL DEFAULT 0.15,
            preferred_lang TEXT NOT NULL DEFAULT 'fr',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            gps VARCHAR(255),
            gps_consent BOOLEAN DEFAULT TRUE,
            nom_complet VARCHAR(255),
            telephone VARCHAR(20)
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

/// Vérifie et crée la table services si elle n'existe pas
pub async fn ensure_services_table(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification de la table services...");
    
    let exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'services')"
    )
    .fetch_one(pool)
    .await?;
    
    if exists {
        info!("✅ Table services déjà présente");
        return Ok(());
    }
    
    warn!("⚠️ Table services manquante, création en cours...");
    
    sqlx::query(r#"
        CREATE TABLE IF NOT EXISTS services (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            data JSONB NOT NULL,
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            auto_deactivate_at TIMESTAMPTZ,
            last_reactivated_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            is_tarissable BOOLEAN,
            vitesse_tarissement VARCHAR(255),
            active_days INTEGER,
            category VARCHAR(255),
            last_alert_sent_at TIMESTAMP,
            gps TEXT
        )
    "#)
    .execute(pool)
    .await?;
    
    // Créer les index
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_services_user_id ON services(user_id)")
        .execute(pool)
        .await?;
    
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_services_is_active ON services(is_active)")
        .execute(pool)
        .await?;
    
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_services_created_at ON services(created_at DESC)")
        .execute(pool)
        .await?;
    
    info!("✅ Table services créée avec succès !");
    
    Ok(())
}

/// Vérifie et crée la table media si elle n'existe pas
pub async fn ensure_media_table(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification de la table media...");
    
    let exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'media')"
    )
    .fetch_one(pool)
    .await?;
    
    if exists {
        info!("✅ Table media déjà présente, vérification des colonnes...");
        
        // ✅ Ajouter colonnes manquantes si table existe déjà
        let columns_to_add = vec![
            ("product_id", "TEXT"),
            ("product_index", "INTEGER"),
            ("is_main_image", "BOOLEAN DEFAULT FALSE"),
            ("display_order", "INTEGER DEFAULT 0"),
        ];
        
        for (column_name, column_type) in columns_to_add {
            let column_exists = sqlx::query_scalar::<_, bool>(
                "SELECT EXISTS(SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'media' AND column_name = $1)"
            )
            .bind(column_name)
            .fetch_one(pool)
            .await?;
            
            if !column_exists {
                warn!("⚠️ Colonne media.{} manquante, ajout en cours...", column_name);
                let alter_query = format!("ALTER TABLE media ADD COLUMN IF NOT EXISTS {} {}", column_name, column_type);
                sqlx::query(&alter_query)
                    .execute(pool)
                    .await?;
                info!("✅ Colonne media.{} ajoutée", column_name);
            }
        }
        
        // Créer index manquants si colonnes ajoutées
        let _ = sqlx::query("CREATE INDEX IF NOT EXISTS idx_media_product_id ON media(product_id) WHERE product_id IS NOT NULL")
            .execute(pool)
            .await;
        
        let _ = sqlx::query("CREATE INDEX IF NOT EXISTS idx_media_is_main ON media(service_id, is_main_image) WHERE is_main_image = TRUE")
            .execute(pool)
            .await;
        
        return Ok(());
    }
    
    warn!("⚠️ Table media manquante, création en cours...");
    
    sqlx::query(r#"
        CREATE TABLE IF NOT EXISTS media (
            id SERIAL PRIMARY KEY,
            service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
            product_id TEXT,
            product_index INTEGER,
            type TEXT NOT NULL,
            path TEXT NOT NULL,
            uploaded_at TIMESTAMP DEFAULT NOW(),
            media_type TEXT,
            file_size BIGINT,
            file_format TEXT,
            is_main_image BOOLEAN DEFAULT FALSE,
            display_order INTEGER DEFAULT 0,
            image_signature JSONB,
            image_hash VARCHAR(64),
            image_metadata JSONB
        )
    "#)
    .execute(pool)
    .await?;
    
    // Créer les index
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_media_service_id ON media(service_id)")
        .execute(pool)
        .await?;
    
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_media_type ON media(type)")
        .execute(pool)
        .await?;
    
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_media_product_index ON media(service_id, product_index) WHERE product_index IS NOT NULL")
        .execute(pool)
        .await?;
    
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_media_product_id ON media(product_id) WHERE product_id IS NOT NULL")
        .execute(pool)
        .await?;
    
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_media_is_main ON media(service_id, is_main_image) WHERE is_main_image = TRUE")
        .execute(pool)
        .await?;
    
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_media_display_order ON media(service_id, product_index, display_order)")
        .execute(pool)
        .await?;
    
    info!("✅ Table media créée avec succès !");
    
    Ok(())
}

/// Vérifie et crée la table echanges si elle n'existe pas
pub async fn ensure_echanges_table(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification de la table echanges...");
    
    let exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'echanges')"
    )
    .fetch_one(pool)
    .await?;
    
    if exists {
        info!("✅ Table echanges déjà présente");
        return Ok(());
    }
    
    warn!("⚠️ Table echanges manquante, création en cours...");
    
    sqlx::query(r#"
        CREATE TABLE IF NOT EXISTS echanges (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            offre JSONB NOT NULL,
            besoin JSONB NOT NULL,
            statut VARCHAR(32) NOT NULL DEFAULT 'en_attente',
            matched_with INTEGER REFERENCES echanges(id),
            quantite_offerte DOUBLE PRECISION,
            quantite_requise DOUBLE PRECISION,
            lot_id INTEGER,
            disponibilite JSONB,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
    "#)
    .execute(pool)
    .await?;
    
    // Créer les index
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_echanges_user_id ON echanges(user_id)")
        .execute(pool)
        .await?;
    
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_echanges_statut ON echanges(statut)")
        .execute(pool)
        .await?;
    
    info!("✅ Table echanges créée avec succès !");
    
    Ok(())
}

/// Vérifie et crée la table conversations si elle n'existe pas
pub async fn ensure_conversations_table(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification de la table conversations...");
    
    let exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'conversations')"
    )
    .fetch_one(pool)
    .await?;
    
    if exists {
        info!("✅ Table conversations déjà présente");
        return Ok(());
    }
    
    warn!("⚠️ Table conversations manquante, création en cours...");
    
    // Créer extension uuid si pas déjà fait
    let _ = sqlx::query("CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\"")
        .execute(pool)
        .await;
    
    sqlx::query(r#"
        CREATE TABLE IF NOT EXISTS conversations (
            id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
            client_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            prestataire_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            service_id INTEGER REFERENCES services(id) ON DELETE SET NULL,
            service_title TEXT,
            status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
    "#)
    .execute(pool)
    .await?;
    
    // Créer les index
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_conversations_client_id ON conversations(client_id)")
        .execute(pool)
        .await?;
    
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_conversations_prestataire_id ON conversations(prestataire_id)")
        .execute(pool)
        .await?;
    
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_conversations_service_id ON conversations(service_id)")
        .execute(pool)
        .await?;
    
    info!("✅ Table conversations créée avec succès !");
    
    Ok(())
}

/// Vérifie et crée la table chat_messages si elle n'existe pas
pub async fn ensure_chat_messages_table(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification de la table chat_messages...");
    
    let exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'chat_messages')"
    )
    .fetch_one(pool)
    .await?;
    
    if exists {
        info!("✅ Table chat_messages déjà présente");
        return Ok(());
    }
    
    warn!("⚠️ Table chat_messages manquante, création en cours...");
    
    sqlx::query(r#"
        CREATE TABLE IF NOT EXISTS chat_messages (
            id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
            conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
            from_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            content TEXT NOT NULL,
            message_type VARCHAR(20) DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'audio', 'video', 'file')),
            metadata JSONB,
            is_read BOOLEAN DEFAULT FALSE,
            is_edited BOOLEAN DEFAULT FALSE,
            edited_at TIMESTAMP WITH TIME ZONE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
    "#)
    .execute(pool)
    .await?;
    
    // Créer les index
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation_id ON chat_messages(conversation_id)")
        .execute(pool)
        .await?;
    
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_chat_messages_from_user_id ON chat_messages(from_user_id)")
        .execute(pool)
        .await?;
    
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at DESC)")
        .execute(pool)
        .await?;
    
    info!("✅ Table chat_messages créée avec succès !");
    
    Ok(())
}

/// Exécute toutes les migrations automatiques nécessaires
pub async fn run_auto_migrations(pool: &PgPool) {
    info!("🚀 Démarrage des migrations automatiques...");
    
    // Migration 0.1: Table users
    match ensure_users_table(pool).await {
        Ok(_) => info!("✅ Migration auto: users table OK"),
        Err(e) => error!("❌ Erreur migration auto users: {}", e),
    }
    
    // Migration 0.2: Table services
    match ensure_services_table(pool).await {
        Ok(_) => info!("✅ Migration auto: services table OK"),
        Err(e) => error!("❌ Erreur migration auto services: {}", e),
    }
    
    // Migration 0.3: Table media
    match ensure_media_table(pool).await {
        Ok(_) => info!("✅ Migration auto: media table OK"),
        Err(e) => error!("❌ Erreur migration auto media: {}", e),
    }
    
    // Migration 0.4: Table echanges
    match ensure_echanges_table(pool).await {
        Ok(_) => info!("✅ Migration auto: echanges table OK"),
        Err(e) => error!("❌ Erreur migration auto echanges: {}", e),
    }
    
    // Migration 0.5: Table conversations
    match ensure_conversations_table(pool).await {
        Ok(_) => info!("✅ Migration auto: conversations table OK"),
        Err(e) => error!("❌ Erreur migration auto conversations: {}", e),
    }
    
    // Migration 0.6: Table chat_messages
    match ensure_chat_messages_table(pool).await {
        Ok(_) => info!("✅ Migration auto: chat_messages table OK"),
        Err(e) => error!("❌ Erreur migration auto chat_messages: {}", e),
    }
    
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
    
    // Migration 4: Table token_usage_logs
    match ensure_token_usage_logs_table(pool).await {
        Ok(_) => info!("✅ Migration auto: token_usage_logs table OK"),
        Err(e) => error!("❌ Erreur migration auto token_usage_logs: {}", e),
    }
    
    // Migration 5: Table autocomplete_combinations
    match ensure_autocomplete_combinations_table(pool).await {
        Ok(_) => info!("✅ Migration auto: autocomplete_combinations table OK"),
        Err(e) => error!("❌ Erreur migration auto autocomplete_combinations: {}", e),
    }
    
    // Migration 6: Table geo_hierarchy
    match ensure_geo_hierarchy_table(pool).await {
        Ok(_) => info!("✅ Migration auto: geo_hierarchy table OK"),
        Err(e) => error!("❌ Erreur migration auto geo_hierarchy: {}", e),
    }
    
    // Migration 7: Table image_analyses
    match ensure_image_analyses_table(pool).await {
        Ok(_) => info!("✅ Migration auto: image_analyses table OK"),
        Err(e) => error!("❌ Erreur migration auto image_analyses: {}", e),
    }
    
    // Migration 8: Fonction calculate_location_score
    match ensure_calculate_location_score_function(pool).await {
        Ok(_) => info!("✅ Migration auto: calculate_location_score() function OK"),
        Err(e) => error!("❌ Erreur migration auto calculate_location_score: {}", e),
    }
    
    // Migration 9: Fonction hybrid_image_search
    match ensure_hybrid_image_search_function(pool).await {
        Ok(_) => info!("✅ Migration auto: hybrid_image_search() function OK"),
        Err(e) => error!("❌ Erreur migration auto hybrid_image_search: {}", e),
    }
    
    info!("✅ Migrations automatiques terminées (15 migrations exécutées)");
}

