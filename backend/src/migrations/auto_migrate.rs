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
            sqlx::query("ALTER TABLE publicites ADD COLUMN IF NOT EXISTS vues INTEGER NOT NULL DEFAULT 0")
                .execute(pool)
                .await?;
            sqlx::query("ALTER TABLE publicites ADD COLUMN IF NOT EXISTS clics INTEGER NOT NULL DEFAULT 0")
                .execute(pool)
                .await?;
            sqlx::query("ALTER TABLE publicites ADD COLUMN IF NOT EXISTS impressions INTEGER NOT NULL DEFAULT 0")
                .execute(pool)
                .await?;
            info!("✅ Colonnes analytics ajoutées");
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
        
        // ✅ NOUVEAU 2025-11-05: Vérifier toutes les colonnes critiques
        // Vérifier notification_type
        let has_notif_type = sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'notification_type')"
        )
        .fetch_one(pool)
        .await?;
        
        if !has_notif_type {
            warn!("⚠️ Colonne 'notification_type' manquante, ajout en cours...");
            sqlx::query("ALTER TABLE notifications ADD COLUMN IF NOT EXISTS notification_type VARCHAR(50)")
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
        
        // ✅ NOUVEAU 2025-11-05: Vérifier les colonnes vectorielles (mode 2025-11-04)
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
        
        // Vérifier product_id
        let has_product_id = sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'autocomplete_characteristics' AND column_name = 'product_id')"
        )
        .fetch_one(pool)
        .await?;
        
        if !has_product_id {
            warn!("⚠️ Colonne 'product_id' manquante, ajout en cours...");
            sqlx::query("ALTER TABLE autocomplete_characteristics ADD COLUMN IF NOT EXISTS product_id TEXT")
                .execute(pool)
                .await?;
            info!("✅ Colonne 'product_id' ajoutée");
        }
        
        // Vérifier chosen_location_geoname_id
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
        
        // ✅ NOUVEAU 2025-11-06: Vérifier chosen_location (CRITIQUE pour autocomplete_client_service)
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
        
        // Vérifier is_real_product
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
        
        // ✅ NOUVEAU 2025-11-05: Vérifier product_labels dans autocomplete_characteristics
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
        
        return Ok(());
    }
    
    warn!("⚠️ Table autocomplete_characteristics manquante, création en cours...");
    
    // Créer la table autocomplete_characteristics (mode vectoriel 2025-11-04)
    sqlx::query(r#"
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
        
        // ✅ CRITIQUE 2025-11-06: Vérifier et rendre service_id NULLABLE
        let is_service_id_nullable = sqlx::query_scalar::<_, bool>(
            "SELECT is_nullable = 'YES' FROM information_schema.columns WHERE table_name = 'autocomplete_combinations' AND column_name = 'service_id'"
        )
        .fetch_one(pool)
        .await
        .unwrap_or(true);
        
        if !is_service_id_nullable {
            warn!("⚠️ CRITIQUE: Colonne 'service_id' est NOT NULL, correction en cours...");
            sqlx::query("ALTER TABLE autocomplete_combinations ALTER COLUMN service_id DROP NOT NULL")
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
                "ALTER TABLE autocomplete_combinations ADD COLUMN IF NOT EXISTS session_id TEXT"
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
                "ALTER TABLE autocomplete_combinations ADD COLUMN IF NOT EXISTS ai_confidence REAL DEFAULT 0.5"
            )
            .execute(pool)
            .await?;
            
            info!("✅ Colonne ai_confidence ajoutée");
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
        
        info!("✅ Fonction upsert_autocomplete_combination mise à jour");
        
        // Vérifier contraintes unécessaires pour les ON CONFLICT récents
        let has_full_vector_constraint: bool = sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid = 'autocomplete_combinations'::regclass AND conname = 'unique_full_vector')"
        )
        .fetch_one(pool)
        .await?
        ;

        if !has_full_vector_constraint {
            info!("✅ Ajout contrainte unique_full_vector sur autocomplete_combinations(full_vector)");
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
        "#
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
        "#
    )
    .execute(pool)
    .await?;
    info!("✅ {} doublons full_vector supprimés", deleted_full.rows_affected());

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
        "#
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
    info!("✅ {} doublons product_vector supprimés", deleted_product.rows_affected());
    
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
            sqlx::query("ALTER TABLE service_reviews ADD COLUMN is_helpful_count INTEGER DEFAULT 0")
                .execute(pool)
                .await?;
            info!("✅ Colonne 'is_helpful_count' ajoutée");
        }
        
        return Ok(());
    }

    warn!("⚠️ Table service_reviews manquante, création en cours...");

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
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_service_reviews_service ON service_reviews(service_id)")
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
        
        return Ok(());
    }

    warn!("⚠️ Table product_reactions manquante, création en cours...");

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

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_product_reactions_product ON product_reactions(service_id, product_id)")
        .execute(pool)
        .await?;
    
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_product_reactions_user ON product_reactions(user_id)")
        .execute(pool)
        .await?;
    
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_product_reactions_type ON product_reactions(reaction_type)")
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

/// Vérifie et crée la fonction extract_all_product_text si elle n'existe pas
pub async fn ensure_extract_all_product_text_function(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("🔍 Vérification de la fonction extract_all_product_text()...");
    
    // Créer ou remplacer la fonction (CREATE OR REPLACE = toujours à jour)
    sqlx::query(r#"
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
    "#)
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
    "#)
    .execute(pool)
    .await?;
    
    // Créer les index
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_geo_hierarchy_place_name ON geo_hierarchy(place_name)")
        .execute(pool)
        .await?;
    
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_geo_hierarchy_country ON geo_hierarchy(parent_country)")
        .execute(pool)
        .await?;
    
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_geo_hierarchy_geoname_id ON geo_hierarchy(geoname_id)")
        .execute(pool)
        .await?;
    
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_geo_hierarchy_times_used ON geo_hierarchy(times_used DESC)")
        .execute(pool)
        .await?;
    
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_geo_hierarchy_admin_level ON geo_hierarchy(admin_level)")
        .execute(pool)
        .await?;
    
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_geo_hierarchy_location_vector_gin ON geo_hierarchy USING GIN(location_vector)")
        .execute(pool)
        .await?;
    
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_geo_hierarchy_place_country ON geo_hierarchy(place_name, parent_country)")
        .execute(pool)
        .await?;
    
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_geo_hierarchy_coordinates ON geo_hierarchy(lat, lng)")
        .execute(pool)
        .await?;
    
    // Fonction pour updated_at
    sqlx::query(r#"
        CREATE OR REPLACE FUNCTION update_geo_hierarchy_updated_at()
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
    let _ = sqlx::query("DROP TRIGGER IF EXISTS trigger_update_geo_hierarchy_updated_at ON geo_hierarchy")
        .execute(pool)
        .await;
    
    // Créer le trigger
    sqlx::query(r#"
        CREATE TRIGGER trigger_update_geo_hierarchy_updated_at
            BEFORE UPDATE ON geo_hierarchy
            FOR EACH ROW
            EXECUTE FUNCTION update_geo_hierarchy_updated_at()
    "#)
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
    sqlx::query(r#"
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
    "#)
    .execute(pool)
    .await?;
    
    // Index pour recherches rapides
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_african_locations_pays ON african_locations(pays)")
        .execute(pool)
        .await?;
    
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_african_locations_ville ON african_locations(ville)")
        .execute(pool)
        .await?;
    
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_african_locations_quartier ON african_locations(quartier)")
        .execute(pool)
        .await?;
    
    info!("✅ Table african_locations créée, insertion des données initiales...");
    
    // ✅ SEED: Données extraites de mobile/src/data/africanLocations.ts
    // CAMEROUN - Douala (60+ quartiers)
    let douala_quartiers = vec![
        "Akwa", "Bonanjo", "Bali", "Bonapriso", "Bonamoussadi",
        "Bonabéri", "New Bell", "Deido", "Bépanda", "Ndogbong",
        "Makepe", "Logpom", "Logbaba", "Ndogpassi I", "Ndogpassi II", "Ndogpassi III",
        "Kotto", "PK8", "PK10", "PK11", "PK12", "PK14", "PK17",
        "Bessengue", "Bonamoussadi Bel Air",
        "Village", "Japoma", "Yassa", "Ndog-Bong", "Ndogsimbi",
        "Cité des Palmiers", "Sonel", "Camp Yabassi",
        "Bassa Industrial", "Bonassama", "Petit Pays", "Mabanda", "Mboppi", "Omnisport"
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
        "Centre-ville", "Poste Centrale", "Mvog-Ada",
        "Bastos", "Nlongkak", "Santa Barbara", "Golf", "Hippodrome",
        "Elig-Essono", "Nkolbisson", "Simbock", "Odza", "Nkoldongo",
        "Mfandena", "Ngoa-Ekelle", "Mvan", "Ekounou", "Elig-Edzoa",
        "Nsimeyong", "Briqueterie", "Tsinga", "Messa", "Mvog-Mbi",
        "Emana", "Etoug-Ebe", "Nkomo", "Essos",
        "Mokolo", "Madagascar", "Mendong", "Obili", "Omnisport", "Mimboman"
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
    let garoua_quartiers = vec!["Centre-ville", "Plateau", "Ouro-Kessoum", "Djamboutou", "Balaré", "Demsa", "Kollere", "Roumdé Adjia", "Doualaré", "Mokolo"];
    for quartier in garoua_quartiers {
        let _ = sqlx::query("INSERT INTO african_locations (pays, ville, quartier, type_lieu) VALUES ($1, $2, $3, 'quartier') ON CONFLICT DO NOTHING")
            .bind("Cameroun").bind("Garoua").bind(quartier).execute(pool).await;
    }
    
    // CAMEROUN - Bafoussam
    let bafoussam_quartiers = vec!["Centre-ville", "Tamdja", "Famla", "Djeleng", "Ngouache", "Tougang", "Ndiandam", "Kamkop", "Université", "Marché A"];
    for quartier in bafoussam_quartiers {
        let _ = sqlx::query("INSERT INTO african_locations (pays, ville, quartier, type_lieu) VALUES ($1, $2, $3, 'quartier') ON CONFLICT DO NOTHING")
            .bind("Cameroun").bind("Bafoussam").bind(quartier).execute(pool).await;
    }
    
    // SÉNÉGAL - Dakar
    let dakar_quartiers = vec!["Plateau", "Médina", "HLM", "Parcelles Assainies", "Grand Yoff", "Ouakam", "Ngor", "Almadies", "Point E", "Mermoz", "Sacré-Cœur", "Fann", "Liberté", "Sicap"];
    for quartier in dakar_quartiers {
        let _ = sqlx::query("INSERT INTO african_locations (pays, ville, quartier, type_lieu) VALUES ($1, $2, $3, 'quartier') ON CONFLICT DO NOTHING")
            .bind("Sénégal").bind("Dakar").bind(quartier).execute(pool).await;
    }
    
    // CÔTE D'IVOIRE - Abidjan
    let abidjan_quartiers = vec!["Plateau", "Cocody", "Yopougon", "Abobo", "Adjamé", "Treichville", "Marcory", "Koumassi", "Port-Bouët", "Attécoubé", "Riviera", "Deux Plateaux", "Angré", "Zone 4"];
    for quartier in abidjan_quartiers {
        let _ = sqlx::query("INSERT INTO african_locations (pays, ville, quartier, type_lieu) VALUES ($1, $2, $3, 'quartier') ON CONFLICT DO NOTHING")
            .bind("Côte d'Ivoire").bind("Abidjan").bind(quartier).execute(pool).await;
    }
    
    info!("✅ Table african_locations créée et seedée avec succès");
    Ok(())
}

pub async fn run_auto_migrations(pool: &PgPool) {
    info!("🚀 Démarrage des migrations automatiques...");
    
    // Migration 0: Table geo_hierarchy (✅ NOUVEAU 2025-11-06)
    match ensure_geo_hierarchy_table(pool).await {
        Ok(_) => info!("✅ Migration auto: geo_hierarchy OK"),
        Err(e) => error!("❌ Erreur migration auto geo_hierarchy: {}", e),
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
        Err(e) => error!("❌ Erreur migration auto autocomplete_characteristics: {}", e),
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
    
    // Migration 9: Table product_reactions (✅ NOUVEAU 2025-11-04)
    match ensure_product_reactions_table(pool).await {
        Ok(_) => info!("✅ Migration auto: product_reactions table OK"),
        Err(e) => error!("❌ Erreur migration auto product_reactions: {}", e),
    }
    
    // Migration 10: Chat mentions et participants (✅ NOUVEAU 2025-11-05)
    match ensure_chat_mentions_and_participants(pool).await {
        Ok(_) => info!("✅ Migration auto: chat mentions OK"),
        Err(e) => error!("❌ Erreur migration auto chat mentions: {}", e),
    }
    
    // Migration 11: Search history (✅ NOUVEAU 2025-11-05)
    match ensure_search_history_table(pool).await {
        Ok(_) => info!("✅ Migration auto: search_history OK"),
        Err(e) => error!("❌ Erreur migration auto search_history: {}", e),
    }
    
    // Migration 12: Alerts (✅ NOUVEAU 2025-11-05)
    match ensure_alerts_table(pool).await {
        Ok(_) => info!("✅ Migration auto: alerts OK"),
        Err(e) => error!("❌ Erreur migration auto alerts: {}", e),
    }
    
    // Migration 13: Signalements (✅ NOUVEAU 2025-11-05)
    match ensure_signalements_tables(pool).await {
        Ok(_) => info!("✅ Migration auto: signalements OK"),
        Err(e) => error!("❌ Erreur migration auto signalements: {}", e),
    }
    
    // Migration 14: Private conversations (✅ NOUVEAU 2025-11-05)
    match ensure_private_conversations_table(pool).await {
        Ok(_) => info!("✅ Migration auto: private_conversations OK"),
        Err(e) => error!("❌ Erreur migration auto private_conversations: {}", e),
    }
    
    // Migration 15: Bus reservations (✅ NOUVEAU 2025-11-05)
    match ensure_bus_reservations_table(pool).await {
        Ok(_) => info!("✅ Migration auto: bus_reservations OK"),
        Err(e) => error!("❌ Erreur migration auto bus_reservations: {}", e),
    }
    
    // Migration 16: Réindexation services existants (✅ NOUVEAU 2025-11-06)
    // S'exécute UNE SEULE FOIS pour indexer les produits créés avant le système autocomplete
    match reindex_existing_services_once(pool).await {
        Ok(_) => info!("✅ Migration auto: réindexation services existants OK"),
        Err(e) => error!("❌ Erreur migration auto réindexation: {}", e),
    }
    
    // Migration 17: Fonctions de visibilité pour carousel mixte (✅ NOUVEAU 2025-11-06)
    match ensure_visibility_functions(pool).await {
        Ok(_) => info!("✅ Migration auto: fonctions visibilité OK"),
        Err(e) => error!("❌ Erreur migration auto fonctions visibilité: {}", e),
    }
    
    // Migration 18: Nettoyage combinaisons invalides (✅ NOUVEAU 2025-11-06)
    match clean_invalid_combinations_migration(pool).await {
        Ok(_) => info!("✅ Migration auto: nettoyage combinaisons invalides OK"),
        Err(e) => error!("❌ Erreur migration auto nettoyage combinaisons: {}", e),
    }
    
    info!("✅ Migrations automatiques terminées");
}

/// Réindexe les services existants UNIQUEMENT si autocomplete_characteristics est vide
async fn reindex_existing_services_once(pool: &PgPool) -> Result<(), sqlx::Error> {
    // Vérifier si des produits réels existent déjà
    let count = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM autocomplete_characteristics WHERE is_real_product = TRUE AND origine_champs = 'formulaire'"
    )
    .fetch_one(pool)
    .await?;
    
    if count > 0 {
        info!("✅ {} produits déjà indexés, skip réindexation", count);
        return Ok(());
    }
    
    info!("🔄 Aucun produit indexé, lancement réindexation des services existants...");
    
    use crate::migrations::reindex_existing_services::reindex_all_services;
    match reindex_all_services(pool).await {
        Ok(n) => {
            info!("✅ {} services réindexés avec succès", n);
            Ok(())
        },
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
        "SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'chat_messages')"
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
        sqlx::query(r#"
            CREATE TABLE IF NOT EXISTS conversation_tag_history (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                tagged_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
                tagged_at TIMESTAMPTZ DEFAULT NOW(),
                context VARCHAR(50),
                created_at TIMESTAMPTZ DEFAULT NOW()
            )
        "#)
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
            sqlx::query("ALTER TABLE token_usage_logs ADD COLUMN IF NOT EXISTS processing_time_ms INTEGER")
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
            sqlx::query("ALTER TABLE token_usage_logs ADD COLUMN IF NOT EXISTS response_source VARCHAR(50)")
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
            sqlx::query("ALTER TABLE token_usage_logs RENAME COLUMN tokens_before TO balance_before")
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
            operation_type VARCHAR(50) DEFAULT 'ia_request',
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
    
    sqlx::query(r#"
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
    "#)
    .execute(pool)
    .await?;
    
    // Index
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_search_history_user_id ON search_history(user_id) WHERE user_id IS NOT NULL")
        .execute(pool)
        .await?;
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_search_history_query_type ON search_history(query_type)")
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
        "SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'alerts')"
    )
    .fetch_one(pool)
    .await?;
    
    if exists {
        info!("✅ Table alerts déjà présente");
        return Ok(());
    }
    
    warn!("⚠️ Table alerts manquante, création en cours...");
    
    sqlx::query(r#"
        CREATE TABLE IF NOT EXISTS alerts (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
            client_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            alert_type VARCHAR(32) NOT NULL,
            is_read BOOLEAN NOT NULL DEFAULT FALSE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    "#)
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
        "SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'signalements')"
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
    sqlx::query(r#"
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
    "#)
    .execute(pool)
    .await?;
    
    // Index pour sanctions
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_sanctions_service ON sanctions_historique(service_id)")
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
    
    sqlx::query(r#"
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
    "#)
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
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_bus_reservations_user ON bus_reservations(user_id)")
        .execute(pool)
        .await?;
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_bus_reservations_product ON bus_reservations(product_id)")
        .execute(pool)
        .await?;
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_bus_reservations_status ON bus_reservations(status)")
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
    sqlx::query(r#"
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
    "#)
    .execute(pool)
    .await?;
    
    // Fonction get_eligible_paid_ads
    sqlx::query(r#"
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
    "#)
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
    let total_before = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM autocomplete_combinations"
    )
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
         HAVING COUNT(*) > 50"
    )
    .fetch_one(pool)
    .await
    .unwrap_or(0);
    
    if problematic_count == 0 {
        info!("✅ Aucune session problématique détectée");
        return Ok(());
    }
    
    info!("🔍 {} sessions avec >50 combinaisons détectées", problematic_count);
    
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
        "#
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
    let total_after = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM autocomplete_combinations"
    )
    .fetch_one(pool)
    .await?;
    
    info!("📊 Nettoyage terminé: {} → {} combinaisons ({} supprimées)", 
          total_before, total_after, deleted_count);
    
    Ok(())
}

