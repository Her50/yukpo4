-- ✅ NOUVEAU: Améliorations optionnelles (nice to have) pour Yukpo Immobilier
-- Date: 2026-01-26
-- Description: Favoris avancés, analytics, QR codes, exports, calendrier, thèmes

-- ============================================
-- 1. FAVORIS AVANCÉS (Collections, Tags, Notes)
-- ============================================

-- Table des collections de favoris
CREATE TABLE IF NOT EXISTS immobilier_favorite_collections (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    color VARCHAR(7) DEFAULT '#6366F1', -- Couleur de la collection
    icon VARCHAR(50) DEFAULT 'heart', -- Icône de la collection
    is_default BOOLEAN DEFAULT FALSE, -- Collection par défaut
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(user_id, name)
);

-- Table des favoris avec collections, tags et notes
CREATE TABLE IF NOT EXISTS immobilier_favorites_advanced (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    property_id INTEGER NOT NULL REFERENCES real_estate_properties(id) ON DELETE CASCADE,
    collection_id INTEGER REFERENCES immobilier_favorite_collections(id) ON DELETE SET NULL,
    
    -- Tags (JSONB pour flexibilité)
    tags JSONB DEFAULT '[]'::jsonb,
    
    -- Notes personnelles
    notes TEXT,
    
    -- Métadonnées
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Contrainte : un bien ne peut être dans une collection qu'une seule fois
    UNIQUE(user_id, property_id, collection_id)
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_favorites_advanced_user 
ON immobilier_favorites_advanced(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_advanced_property 
ON immobilier_favorites_advanced(property_id);
CREATE INDEX IF NOT EXISTS idx_favorites_advanced_collection 
ON immobilier_favorites_advanced(collection_id);
CREATE INDEX IF NOT EXISTS idx_favorites_advanced_tags 
ON immobilier_favorites_advanced USING GIN(tags);

-- ============================================
-- 2. ANALYTICS AVANCÉS POUR PROPRIÉTAIRES
-- ============================================

-- Table des vues de biens (tracking)
CREATE TABLE IF NOT EXISTS immobilier_property_views (
    id SERIAL PRIMARY KEY,
    property_id INTEGER NOT NULL REFERENCES real_estate_properties(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL, -- NULL si visiteur anonyme
    viewer_ip VARCHAR(45), -- IPv4 ou IPv6
    viewer_user_agent TEXT,
    source VARCHAR(50), -- "search", "favorite", "share", "direct", etc.
    referrer TEXT, -- URL de référence
    view_duration_seconds INTEGER, -- Durée de visualisation
    viewed_sections JSONB DEFAULT '{}'::jsonb, -- Sections vues (photos, description, map, etc.)
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table des contacts générés (clics sur bouton contact)
CREATE TABLE IF NOT EXISTS immobilier_property_contacts (
    id SERIAL PRIMARY KEY,
    property_id INTEGER NOT NULL REFERENCES real_estate_properties(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL, -- Utilisateur qui a contacté
    contact_type VARCHAR(50) NOT NULL, -- "phone", "whatsapp", "email", "chat"
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table des partages
CREATE TABLE IF NOT EXISTS immobilier_property_shares (
    id SERIAL PRIMARY KEY,
    property_id INTEGER NOT NULL REFERENCES real_estate_properties(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    share_platform VARCHAR(50), -- "whatsapp", "facebook", "twitter", "link", "qr_code"
    share_url TEXT, -- URL partagée
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index pour analytics
CREATE INDEX IF NOT EXISTS idx_property_views_property 
ON immobilier_property_views(property_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_property_views_user 
ON immobilier_property_views(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_property_contacts_property 
ON immobilier_property_contacts(property_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_property_shares_property 
ON immobilier_property_shares(property_id, created_at DESC);

-- ============================================
-- 3. QR CODES POUR PARTAGE
-- ============================================

-- Table des QR codes générés
CREATE TABLE IF NOT EXISTS immobilier_qr_codes (
    id SERIAL PRIMARY KEY,
    property_id INTEGER NOT NULL REFERENCES real_estate_properties(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL, -- Utilisateur qui a généré le QR
    qr_code_url TEXT NOT NULL, -- URL de l'image QR code
    qr_code_data TEXT NOT NULL, -- Données encodées dans le QR
    share_url TEXT NOT NULL, -- URL à partager
    scan_count INTEGER DEFAULT 0, -- Nombre de scans
    last_scan_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ, -- Expiration optionnelle
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index pour QR codes
CREATE INDEX IF NOT EXISTS idx_qr_codes_property 
ON immobilier_qr_codes(property_id);
CREATE INDEX IF NOT EXISTS idx_qr_codes_data 
ON immobilier_qr_codes(qr_code_data);

-- ============================================
-- 4. EXPORTS PDF/EXCEL
-- ============================================

-- Table des exports générés
CREATE TABLE IF NOT EXISTS immobilier_exports (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    property_id INTEGER REFERENCES real_estate_properties(id) ON DELETE SET NULL, -- NULL si export multiple
    export_type VARCHAR(20) NOT NULL, -- "pdf", "excel", "csv"
    export_format VARCHAR(50), -- "property_details", "property_list", "analytics", "comparison"
    file_url TEXT NOT NULL, -- URL du fichier généré
    file_size_bytes BIGINT,
    expires_at TIMESTAMPTZ, -- Expiration du fichier (nettoyage automatique)
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index pour exports
CREATE INDEX IF NOT EXISTS idx_exports_user 
ON immobilier_exports(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_exports_property 
ON immobilier_exports(property_id) WHERE property_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_exports_expires 
ON immobilier_exports(expires_at) WHERE expires_at IS NOT NULL;

-- ============================================
-- 5. INTÉGRATIONS CALENDRIER
-- ============================================

-- Table des intégrations calendrier
CREATE TABLE IF NOT EXISTS immobilier_calendar_integrations (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    property_id INTEGER NOT NULL REFERENCES real_estate_properties(id) ON DELETE CASCADE,
    calendar_type VARCHAR(50) NOT NULL, -- "google", "ical", "outlook", "apple"
    calendar_id VARCHAR(255), -- ID du calendrier externe
    calendar_url TEXT, -- URL du calendrier (pour iCal)
    access_token TEXT, -- Token d'accès (chiffré)
    refresh_token TEXT, -- Refresh token (chiffré)
    is_active BOOLEAN DEFAULT TRUE,
    last_sync_at TIMESTAMPTZ,
    sync_frequency VARCHAR(20) DEFAULT 'daily', -- "hourly", "daily", "weekly"
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(user_id, property_id, calendar_type)
);

-- Table des événements calendrier synchronisés
CREATE TABLE IF NOT EXISTS immobilier_calendar_events (
    id SERIAL PRIMARY KEY,
    integration_id INTEGER NOT NULL REFERENCES immobilier_calendar_integrations(id) ON DELETE CASCADE,
    reservation_id INTEGER REFERENCES hotel_meuble_reservations(id) ON DELETE SET NULL,
    event_id_external VARCHAR(255), -- ID de l'événement dans le calendrier externe
    event_title TEXT NOT NULL,
    event_start TIMESTAMPTZ NOT NULL,
    event_end TIMESTAMPTZ NOT NULL,
    event_description TEXT,
    event_location TEXT,
    sync_status VARCHAR(20) DEFAULT 'synced', -- "synced", "pending", "failed"
    last_sync_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index pour calendrier
CREATE INDEX IF NOT EXISTS idx_calendar_integrations_user 
ON immobilier_calendar_integrations(user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_integrations_property 
ON immobilier_calendar_integrations(property_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_integration 
ON immobilier_calendar_events(integration_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_reservation 
ON immobilier_calendar_events(reservation_id) WHERE reservation_id IS NOT NULL;

-- ============================================
-- 6. PERSONNALISATION THÈMES
-- ============================================

-- Table des thèmes personnalisés utilisateurs
CREATE TABLE IF NOT EXISTS user_immobilier_themes (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    theme_name VARCHAR(100) NOT NULL,
    theme_config JSONB NOT NULL DEFAULT '{}'::jsonb, -- Configuration du thème (couleurs, fonts, etc.)
    is_active BOOLEAN DEFAULT TRUE,
    is_default BOOLEAN DEFAULT FALSE, -- Thème par défaut de l'utilisateur
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(user_id, theme_name)
);

-- Index pour thèmes
CREATE INDEX IF NOT EXISTS idx_user_themes_user 
ON user_immobilier_themes(user_id, is_active);

-- ============================================
-- 7. FONCTIONS UTILITAIRES
-- ============================================

-- Fonction : Créer collection par défaut pour nouvel utilisateur
CREATE OR REPLACE FUNCTION create_default_favorite_collection(p_user_id INTEGER)
RETURNS INTEGER AS $$
DECLARE
    v_collection_id INTEGER;
BEGIN
    INSERT INTO immobilier_favorite_collections (user_id, name, description, is_default)
    VALUES (p_user_id, 'Mes favoris', 'Collection par défaut', TRUE)
    ON CONFLICT (user_id, name) DO UPDATE SET is_default = TRUE
    RETURNING id INTO v_collection_id;
    
    RETURN v_collection_id;
END;
$$ LANGUAGE plpgsql;

-- Fonction : Nettoyer exports expirés
CREATE OR REPLACE FUNCTION cleanup_expired_exports()
RETURNS INTEGER AS $$
DECLARE
    v_deleted_count INTEGER;
BEGIN
    DELETE FROM immobilier_exports
    WHERE expires_at IS NOT NULL 
    AND expires_at < NOW();
    
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Fonction : Incrémenter scan QR code
CREATE OR REPLACE FUNCTION increment_qr_code_scan(p_qr_code_data TEXT)
RETURNS VOID AS $$
BEGIN
    UPDATE immobilier_qr_codes
    SET scan_count = scan_count + 1,
        last_scan_at = NOW()
    WHERE qr_code_data = p_qr_code_data;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 8. TRIGGERS
-- ============================================

-- Trigger : Mettre à jour updated_at pour collections
CREATE OR REPLACE FUNCTION update_favorite_collections_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_favorite_collections_updated_at 
ON immobilier_favorite_collections;
CREATE TRIGGER trigger_update_favorite_collections_updated_at
    BEFORE UPDATE ON immobilier_favorite_collections
    FOR EACH ROW
    EXECUTE FUNCTION update_favorite_collections_updated_at();

-- Trigger : Mettre à jour updated_at pour favoris avancés
CREATE OR REPLACE FUNCTION update_favorites_advanced_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_favorites_advanced_updated_at 
ON immobilier_favorites_advanced;
CREATE TRIGGER trigger_update_favorites_advanced_updated_at
    BEFORE UPDATE ON immobilier_favorites_advanced
    FOR EACH ROW
    EXECUTE FUNCTION update_favorites_advanced_updated_at();

-- Trigger : Mettre à jour updated_at pour intégrations calendrier
CREATE OR REPLACE FUNCTION update_calendar_integrations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_calendar_integrations_updated_at 
ON immobilier_calendar_integrations;
CREATE TRIGGER trigger_update_calendar_integrations_updated_at
    BEFORE UPDATE ON immobilier_calendar_integrations
    FOR EACH ROW
    EXECUTE FUNCTION update_calendar_integrations_updated_at();

-- ============================================
-- 9. VUES ANALYTICS
-- ============================================

-- Vue : Statistiques complètes par propriété
CREATE OR REPLACE VIEW v_immobilier_property_analytics AS
SELECT 
    p.id as property_id,
    p.titre,
    p.type_bien,
    p.statut,
    COUNT(DISTINCT v.id) as total_views,
    COUNT(DISTINCT CASE WHEN v.user_id IS NOT NULL THEN v.id END) as authenticated_views,
    COUNT(DISTINCT c.id) as total_contacts,
    COUNT(DISTINCT s.id) as total_shares,
    COUNT(DISTINCT f.id) as total_favorites,
    AVG(v.view_duration_seconds) as avg_view_duration,
    MAX(v.created_at) as last_view_at,
    MAX(c.created_at) as last_contact_at,
    MAX(s.created_at) as last_share_at
FROM real_estate_properties p
LEFT JOIN immobilier_property_views v ON v.property_id = p.id
LEFT JOIN immobilier_property_contacts c ON c.property_id = p.id
LEFT JOIN immobilier_property_shares s ON s.property_id = p.id
LEFT JOIN immobilier_favorites_advanced f ON f.property_id = p.id
GROUP BY p.id, p.titre, p.type_bien, p.statut;

-- Vue : Statistiques par propriétaire
CREATE OR REPLACE VIEW v_immobilier_owner_analytics AS
SELECT 
    s.user_id as owner_id,
    COUNT(DISTINCT p.id) as total_properties,
    COUNT(DISTINCT v.id) as total_views,
    COUNT(DISTINCT c.id) as total_contacts,
    COUNT(DISTINCT s2.id) as total_shares,
    COUNT(DISTINCT f.id) as total_favorites,
    SUM(CASE WHEN p.statut = 'vente' THEN 1 ELSE 0 END) as properties_for_sale,
    SUM(CASE WHEN p.statut = 'location' THEN 1 ELSE 0 END) as properties_for_rent,
    AVG(v.view_duration_seconds) as avg_view_duration
FROM services s
INNER JOIN real_estate_properties p ON p.service_id = s.id
LEFT JOIN immobilier_property_views v ON v.property_id = p.id
LEFT JOIN immobilier_property_contacts c ON c.property_id = p.id
LEFT JOIN immobilier_property_shares s2 ON s2.property_id = p.id
LEFT JOIN immobilier_favorites_advanced f ON f.property_id = p.id
GROUP BY s.user_id;

