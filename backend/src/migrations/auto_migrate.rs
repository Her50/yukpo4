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
                sqlx::query("ALTER TABLE products_lifecycle ADD COLUMN auto_deactivate_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days')")
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
                sqlx::query("ALTER TABLE products_lifecycle ADD COLUMN reactivation_cost INTEGER DEFAULT 1000")
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
            sqlx::query("ALTER TABLE publicites ADD COLUMN zone_geographique VARCHAR(50) NOT NULL DEFAULT 'local' CHECK (zone_geographique IN ('local', 'regional', 'international'))")
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
            sqlx::query("ALTER TABLE publicites ADD COLUMN produits_indexes TEXT[] NOT NULL DEFAULT '{}'")
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
        
        // ✅ NOUVEAU 2025-11-05: Vérifier toutes les colonnes critiques
        // Vérifier notification_type
        let has_notif_type = sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'notification_type')"
        )
        .fetch_one(pool)
        .await?;
        
        if !has_notif_type {
            warn!("⚠️ Colonne 'notification_type' manquante, ajout en cours...");
            sqlx::query("ALTER TABLE notifications ADD COLUMN notification_type VARCHAR(50)")
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
            sqlx::query("ALTER TABLE notifications ADD COLUMN title VARCHAR(255)")
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
            sqlx::query("ALTER TABLE notifications ADD COLUMN metadata JSONB")
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
            sqlx::query("ALTER TABLE notifications ADD COLUMN read_at TIMESTAMPTZ")
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
            sqlx::query("ALTER TABLE autocomplete_characteristics ADD COLUMN characteristic_vector TEXT[] DEFAULT '{}'")
                .execute(pool)
                .await?;
            sqlx::query("ALTER TABLE autocomplete_characteristics ADD COLUMN location_vector TEXT[] DEFAULT '{}'")
                .execute(pool)
                .await?;
            sqlx::query("ALTER TABLE autocomplete_characteristics ADD COLUMN full_vector TEXT[] DEFAULT '{}'")
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
            sqlx::query("ALTER TABLE autocomplete_characteristics ADD COLUMN product_id TEXT")
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
            sqlx::query("ALTER TABLE autocomplete_characteristics ADD COLUMN chosen_location_geoname_id BIGINT")
                .execute(pool)
                .await?;
            info!("✅ Colonne 'chosen_location_geoname_id' ajoutée");
        }
        
        // Vérifier is_real_product
        let has_is_real = sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'autocomplete_characteristics' AND column_name = 'is_real_product')"
        )
        .fetch_one(pool)
        .await?;
        
        if !has_is_real {
            warn!("⚠️ Colonne 'is_real_product' manquante, ajout en cours...");
            sqlx::query("ALTER TABLE autocomplete_characteristics ADD COLUMN is_real_product BOOLEAN DEFAULT TRUE")
                .execute(pool)
                .await?;
            info!("✅ Colonne 'is_real_product' ajoutée");
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
        
        // Vérifier si product_labels existe, sinon l'ajouter
        let has_product_labels = sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'autocomplete_combinations' AND column_name = 'product_labels')"
        )
        .fetch_one(pool)
        .await?;
        
        if !has_product_labels {
            warn!("⚠️ Colonne product_labels manquante, ajout en cours...");
            sqlx::query(
                "ALTER TABLE autocomplete_combinations ADD COLUMN product_labels TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[]"
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
                "ALTER TABLE autocomplete_combinations ADD COLUMN location_labels TEXT[] DEFAULT ARRAY[]::TEXT[]"
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
                "ALTER TABLE autocomplete_combinations ADD COLUMN session_id TEXT"
            )
            .execute(pool)
            .await?;
            
            info!("✅ Colonne session_id ajoutée");
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
            sqlx::query("ALTER TABLE service_reviews ADD COLUMN reply_to_review_id INTEGER REFERENCES service_reviews(id) ON DELETE CASCADE")
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
            sqlx::query("ALTER TABLE product_reactions ADD COLUMN reaction_type VARCHAR(20) NOT NULL CHECK (reaction_type IN ('love', 'like', 'wow', 'interested', 'thinking', 'disappointed'))")
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
            sqlx::query("ALTER TABLE product_reactions ADD COLUMN product_id TEXT NOT NULL DEFAULT ''")
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
    
    // Migration 7: Table service_reviews avec support réponses (✅ NOUVEAU 2025-11-04)
    match ensure_service_reviews_table(pool).await {
        Ok(_) => info!("✅ Migration auto: service_reviews table OK"),
        Err(e) => error!("❌ Erreur migration auto service_reviews: {}", e),
    }
    
    // Migration 8: Table product_reactions (✅ NOUVEAU 2025-11-04)
    match ensure_product_reactions_table(pool).await {
        Ok(_) => info!("✅ Migration auto: product_reactions table OK"),
        Err(e) => error!("❌ Erreur migration auto product_reactions: {}", e),
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

