-- Tables de publicité et marketing

-- Table publicites (gestion des publicités)
CREATE TABLE IF NOT EXISTS publicites (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    titre VARCHAR(255) NOT NULL,
    description TEXT,
    produits_indexes TEXT[] NOT NULL DEFAULT '{}',
    videos TEXT[] DEFAULT '{}',
    thumbnails TEXT[] DEFAULT '{}',
    duree_jours INTEGER NOT NULL CHECK (duree_jours > 0),
    cout INTEGER NOT NULL CHECK (cout >= 0),
    devise_utilisateur VARCHAR(10) DEFAULT 'FCFA',
    zone_geographique VARCHAR(50) NOT NULL DEFAULT 'local' CHECK (zone_geographique IN ('local', 'regional', 'international')),
    geo_publicitaire GEOMETRY(POINT, 4326),
    rayon_km INTEGER DEFAULT 50,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'pending', 'paused')),
    date_debut TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    date_fin TIMESTAMPTZ NOT NULL,
    vues INTEGER NOT NULL DEFAULT 0,
    clics INTEGER NOT NULL DEFAULT 0,
    impressions INTEGER NOT NULL DEFAULT 0,
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
    CONSTRAINT check_date_fin_after_debut CHECK (date_fin > date_debut),
    CONSTRAINT check_produits_not_empty CHECK (array_length(produits_indexes, 1) > 0)
);

-- Index pour publicites
CREATE INDEX IF NOT EXISTS idx_publicites_user_id ON publicites(user_id);
CREATE INDEX IF NOT EXISTS idx_publicites_status ON publicites(status);
CREATE INDEX IF NOT EXISTS idx_publicites_zone ON publicites(zone_geographique);
CREATE INDEX IF NOT EXISTS idx_publicites_date_fin ON publicites(date_fin);
CREATE INDEX IF NOT EXISTS idx_publicites_produits_gin ON publicites USING GIN(produits_indexes);
-- ✅ NOUVEAU: Index pour fonctionnalités avancées
CREATE INDEX IF NOT EXISTS idx_publicites_targeting_gin ON publicites USING GIN(targeting);
CREATE INDEX IF NOT EXISTS idx_publicites_ab_testing_gin ON publicites USING GIN(ab_testing);
CREATE INDEX IF NOT EXISTS idx_publicites_placements_gin ON publicites USING GIN(placements);
CREATE INDEX IF NOT EXISTS idx_publicites_retargeting_gin ON publicites USING GIN(retargeting);
CREATE INDEX IF NOT EXISTS idx_publicites_schedule_start ON publicites((schedule->>'start_date')) WHERE schedule IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_publicites_schedule_end ON publicites((schedule->>'end_date')) WHERE schedule IS NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relname = 'idx_publicites_active' AND n.nspname = 'public'
    ) THEN
        CREATE INDEX idx_publicites_active ON publicites(status, date_fin) WHERE status = 'active';
    END IF;
END $$;

-- ✅ NOUVEAU 2025-01-01: Table pour versioning des publicités (historique complet)
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
);

CREATE INDEX IF NOT EXISTS idx_publicite_versions_publicite_id ON publicite_versions(publicite_id);
CREATE INDEX IF NOT EXISTS idx_publicite_versions_user_id ON publicite_versions(user_id);
CREATE INDEX IF NOT EXISTS idx_publicite_versions_created_at ON publicite_versions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_publicite_versions_change_type ON publicite_versions(change_type);

COMMENT ON TABLE publicite_versions IS 'Historique complet des modifications de publicités';
COMMENT ON COLUMN publicite_versions.version_number IS 'Numéro de version incrémental pour chaque publicité';
COMMENT ON COLUMN publicite_versions.data_snapshot IS 'Snapshot JSON complet de toutes les données de la publicité à ce moment';
COMMENT ON COLUMN publicite_versions.change_type IS 'Type de modification: created, updated, paused, resumed, deleted';

-- Fonction pour créer automatiquement une version lors d'une modification
CREATE OR REPLACE FUNCTION create_publicite_version()
RETURNS TRIGGER AS $$
DECLARE
    next_version INTEGER;
    snapshot_data JSONB;
    change_type_val VARCHAR(50);
BEGIN
    -- Déterminer le prochain numéro de version
    SELECT COALESCE(MAX(version_number), 0) + 1
    INTO next_version
    FROM publicite_versions
    WHERE publicite_id = NEW.id;
    
    -- Créer un snapshot complet de toutes les données
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
    
    -- Déterminer le type de changement
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
    
    -- Insérer la version
    INSERT INTO publicite_versions (
        publicite_id,
        version_number,
        user_id,
        data_snapshot,
        change_type,
        changed_by,
        change_description
    )
    VALUES (
        NEW.id,
        next_version,
        NEW.user_id,
        snapshot_data,
        change_type_val,
        NEW.user_id,
        CASE 
            WHEN TG_OP = 'INSERT' THEN 'Création de la publicité'
            WHEN TG_OP = 'UPDATE' THEN 'Modification de la publicité'
            ELSE 'Changement inconnu'
        END
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour créer automatiquement une version à chaque modification
DROP TRIGGER IF EXISTS trigger_create_publicite_version ON publicites;
CREATE TRIGGER trigger_create_publicite_version
    AFTER INSERT OR UPDATE ON publicites
    FOR EACH ROW
    EXECUTE FUNCTION create_publicite_version();

-- Fonction pour restaurer une version
CREATE OR REPLACE FUNCTION restore_publicite_version(
    p_publicite_id INTEGER,
    p_version_number INTEGER
)
RETURNS BOOLEAN AS $$
DECLARE
    version_data JSONB;
BEGIN
    -- Récupérer les données de la version
    SELECT data_snapshot
    INTO version_data
    FROM publicite_versions
    WHERE publicite_id = p_publicite_id
    AND version_number = p_version_number;
    
    IF version_data IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Restaurer les données (sauf id, created_at, et certaines métriques)
    UPDATE publicites
    SET
        titre = CAST((version_data->>'titre') AS VARCHAR),
        description = CAST((version_data->>'description') AS TEXT),
        produits_indexes = ARRAY(SELECT jsonb_array_elements_text(version_data->'produits_indexes')),
        videos = ARRAY(SELECT jsonb_array_elements_text(version_data->'videos')),
        thumbnails = ARRAY(SELECT jsonb_array_elements_text(version_data->'thumbnails')),
        duree_jours = CAST((version_data->>'duree_jours') AS INTEGER),
        cout = CAST((version_data->>'cout') AS INTEGER),
        devise_utilisateur = CAST((version_data->>'devise_utilisateur') AS VARCHAR),
        zone_geographique = CAST((version_data->>'zone_geographique') AS VARCHAR),
        rayon_km = CAST((version_data->>'rayon_km') AS INTEGER),
        status = CAST((version_data->>'status') AS VARCHAR),
        date_debut = CAST((version_data->>'date_debut') AS TIMESTAMPTZ),
        date_fin = CAST((version_data->>'date_fin') AS TIMESTAMPTZ),
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

-- ✅ NOUVEAU: Table pour tracker les impressions (affichages) de publicités
CREATE TABLE IF NOT EXISTS publicite_impressions (
    id SERIAL PRIMARY KEY,
    publicite_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    placement VARCHAR(50) NOT NULL, -- 'feed', 'stories', 'carousel', 'search', etc.
    viewed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (publicite_id) REFERENCES publicites(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Index pour performances
CREATE INDEX IF NOT EXISTS idx_publicite_impressions_publicite_user ON publicite_impressions(publicite_id, user_id);
CREATE INDEX IF NOT EXISTS idx_publicite_impressions_user_date ON publicite_impressions(user_id, viewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_publicite_impressions_publicite_date ON publicite_impressions(publicite_id, viewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_publicite_impressions_placement ON publicite_impressions(placement);
CREATE INDEX IF NOT EXISTS idx_publicite_impressions_user_publicite_date ON publicite_impressions(user_id, publicite_id, viewed_at DESC);

-- ✅ NOUVEAU: Fonction pour vérifier la fréquence d'affichage
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
    IF v_frequency_config IS NULL OR v_frequency_config = '{}'::jsonb THEN
        RETURN TRUE;
    END IF;
    
    v_frequency_limit := COALESCE((v_frequency_config->>p_frequency_type)::integer, 999);
    
    IF p_frequency_type = 'daily' THEN
        SELECT COUNT(*) INTO v_count
        FROM publicite_impressions
        WHERE publicite_id = p_publicite_id
        AND user_id = p_user_id
        AND viewed_at >= CURRENT_DATE;
    ELSIF p_frequency_type = 'weekly' THEN
        SELECT COUNT(*) INTO v_count
        FROM publicite_impressions
        WHERE publicite_id = p_publicite_id
        AND user_id = p_user_id
        AND viewed_at >= CURRENT_DATE - INTERVAL '7 days';
    ELSIF p_frequency_type = 'monthly' THEN
        SELECT COUNT(*) INTO v_count
        FROM publicite_impressions
        WHERE publicite_id = p_publicite_id
        AND user_id = p_user_id
        AND viewed_at >= CURRENT_DATE - INTERVAL '30 days';
    ELSE
        RETURN TRUE;
    END IF;
    
    RETURN v_count < v_frequency_limit;
END;
$$ LANGUAGE plpgsql;

-- ✅ NOUVEAU: Fonction pour enregistrer une impression
CREATE OR REPLACE FUNCTION record_publicite_impression(
    p_publicite_id INTEGER,
    p_user_id INTEGER,
    p_placement VARCHAR(50)
) RETURNS BOOLEAN AS $$
DECLARE
    v_can_show BOOLEAN;
BEGIN
    -- Vérifier la fréquence
    v_can_show := check_publicite_frequency(p_publicite_id, p_user_id, 'daily');
    IF NOT v_can_show THEN
        RETURN FALSE;
    END IF;
    
    -- Enregistrer l'impression
    INSERT INTO publicite_impressions (publicite_id, user_id, placement)
    VALUES (p_publicite_id, p_user_id, p_placement);
    
    -- Mettre à jour le compteur
    UPDATE publicites
    SET impressions = impressions + 1
    WHERE id = p_publicite_id;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Table pixel_events (tracking pixel pour analytics)
CREATE TABLE IF NOT EXISTS pixel_events (
    id SERIAL PRIMARY KEY,
    event_type VARCHAR(50) NOT NULL,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    session_id VARCHAR(255),
    page_url TEXT,
    referrer TEXT,
    user_agent TEXT,
    ip_address INET,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pixel_events_type ON pixel_events(event_type);
CREATE INDEX IF NOT EXISTS idx_pixel_events_user_id ON pixel_events(user_id);
CREATE INDEX IF NOT EXISTS idx_pixel_events_session_id ON pixel_events(session_id);
CREATE INDEX IF NOT EXISTS idx_pixel_events_created_at ON pixel_events(created_at DESC);

-- Table publicite_audiences (audiences ciblées pour publicités)
CREATE TABLE IF NOT EXISTS publicite_audiences (
    id SERIAL PRIMARY KEY,
    publicite_id INTEGER NOT NULL REFERENCES publicites(id) ON DELETE CASCADE,
    audience_name VARCHAR(255) NOT NULL,
    audience_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    user_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(publicite_id, audience_name)
);

CREATE INDEX IF NOT EXISTS idx_publicite_audiences_publicite_id ON publicite_audiences(publicite_id);
CREATE INDEX IF NOT EXISTS idx_publicite_audiences_config_gin ON publicite_audiences USING GIN(audience_config);

CREATE OR REPLACE FUNCTION update_publicite_audiences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_publicite_audiences_updated_at ON publicite_audiences;
CREATE TRIGGER trigger_update_publicite_audiences_updated_at
    BEFORE UPDATE ON publicite_audiences
    FOR EACH ROW
    EXECUTE FUNCTION update_publicite_audiences_updated_at();

