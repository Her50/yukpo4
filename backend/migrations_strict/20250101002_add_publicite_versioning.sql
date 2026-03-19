-- Migration pour ajouter le système de versioning des publicités
-- Permet de garder un historique complet des modifications

-- Table pour stocker les versions des publicités
CREATE TABLE IF NOT EXISTS publicite_versions (
    id SERIAL PRIMARY KEY,
    publicite_id INTEGER NOT NULL REFERENCES publicites(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Données complètes de la version (snapshot JSON)
    data_snapshot JSONB NOT NULL,
    
    -- Métadonnées de la version
    change_type VARCHAR(50) NOT NULL, -- 'created', 'updated', 'paused', 'resumed', 'deleted'
    changed_by INTEGER REFERENCES users(id),
    change_description TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Contrainte unique pour éviter les doublons
    CONSTRAINT unique_publicite_version UNIQUE (publicite_id, version_number)
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_publicite_versions_publicite_id ON publicite_versions(publicite_id);
CREATE INDEX IF NOT EXISTS idx_publicite_versions_user_id ON publicite_versions(user_id);
CREATE INDEX IF NOT EXISTS idx_publicite_versions_created_at ON publicite_versions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_publicite_versions_change_type ON publicite_versions(change_type);

-- Commentaires pour documentation
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
    DECLARE
        change_type_val VARCHAR(50);
    BEGIN
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
            NEW.user_id, -- Peut être modifié pour utiliser un user_id différent si nécessaire
            CASE 
                WHEN TG_OP = 'INSERT' THEN 'Création de la publicité'
                WHEN TG_OP = 'UPDATE' THEN 'Modification de la publicité'
                ELSE 'Changement inconnu'
            END
        );
    END;
    
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

