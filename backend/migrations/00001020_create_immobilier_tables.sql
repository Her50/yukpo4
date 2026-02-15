-- Migration: Créer tables pour service IMMOBILIER COMPLET
-- Date: 2025-01-27
-- Description: Tables dédiées pour vente/location biens, terrains, décoration, déménagement
--              avec prise en compte systématique du moment (NOW()) pour recherche en temps réel
-- Note: Compatible avec SQLx offline mode

-- ============================================================================
-- GROUPE 1 : VENTE/LOCATION HABITATIONS 🏠
-- ============================================================================

-- 1. Table real_estate_properties (Biens immobiliers)
CREATE TABLE IF NOT EXISTS real_estate_properties (
    id SERIAL PRIMARY KEY,
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Informations de base
    titre VARCHAR(255) NOT NULL,
    description TEXT,
    type_bien VARCHAR(50) NOT NULL, -- "Appartement", "Villa", "Studio", "Maison", "Bureau", "Commerce"
    statut VARCHAR(50) NOT NULL, -- "À vendre", "À louer (bail)", "À louer meublé", "Location courte durée", "Colocation"
    
    -- Localisation
    adresse TEXT,
    quartier VARCHAR(255),
    ville VARCHAR(255),
    gps VARCHAR(255), -- Format: "lat,lng"
    
    -- Caractéristiques
    superficie_m2 DECIMAL(10, 2),
    nb_chambres INTEGER,
    nb_salles_bain INTEGER,
    nb_salons INTEGER,
    standing VARCHAR(50), -- "Économique", "Standard", "Bon standing", "Haut standing", "Luxe / Prestige"
    etat_general VARCHAR(50), -- "Neuf", "Excellent état", "Bon état", "État moyen", "À rafraîchir", "À rénover"
    annee_construction INTEGER,
    etage INTEGER,
    nb_etages_immeuble INTEGER,
    
    -- Équipements (JSONB pour flexibilité)
    equipements JSONB, -- {"eau_24h": true, "groupe_electrogene": true, "climatisation": true, ...}
    ameublement VARCHAR(50), -- "Non meublé", "Partiellement meublé", "Meublé standard", etc.
    
    -- Prix
    prix_vente DECIMAL(12, 2), -- Prix de vente (si applicable)
    prix_location_mensuel DECIMAL(12, 2), -- Loyer mensuel (si applicable)
    prix_location_nuit DECIMAL(10, 2), -- Prix par nuit (location courte durée)
    charges_mensuelles DECIMAL(10, 2), -- Charges mensuelles
    caution DECIMAL(12, 2), -- Caution (location)
    frais_agence DECIMAL(10, 2), -- Frais d'agence
    
    -- Disponibilité (location)
    disponible_immediatement BOOLEAN DEFAULT FALSE,
    date_disponibilite DATE,
    duree_bail_min INTEGER, -- Durée minimale bail (mois)
    duree_bail_max INTEGER, -- Durée maximale bail (mois)
    
    -- Visites
    visites_virtuelles TEXT[], -- URLs visites virtuelles 360°
    photos TEXT[], -- URLs photos
    
    -- Contact
    telephone VARCHAR(50),
    whatsapp VARCHAR(50),
    email VARCHAR(255),
    
    -- Statut
    is_active BOOLEAN DEFAULT TRUE,
    is_available_now BOOLEAN DEFAULT FALSE, -- Calculé automatiquement avec NOW()
    
    -- Métadonnées
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT unique_real_estate_service UNIQUE(service_id)
);

-- Index pour real_estate_properties
CREATE INDEX IF NOT EXISTS idx_real_estate_user_id ON real_estate_properties(user_id);
CREATE INDEX IF NOT EXISTS idx_real_estate_service_id ON real_estate_properties(service_id);
CREATE INDEX IF NOT EXISTS idx_real_estate_is_active ON real_estate_properties(is_active);
CREATE INDEX IF NOT EXISTS idx_real_estate_type_bien ON real_estate_properties(type_bien);
CREATE INDEX IF NOT EXISTS idx_real_estate_statut ON real_estate_properties(statut);
CREATE INDEX IF NOT EXISTS idx_real_estate_ville ON real_estate_properties(ville);
CREATE INDEX IF NOT EXISTS idx_real_estate_quartier ON real_estate_properties(quartier);
CREATE INDEX IF NOT EXISTS idx_real_estate_prix_vente ON real_estate_properties(prix_vente) WHERE prix_vente IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_real_estate_prix_location ON real_estate_properties(prix_location_mensuel) WHERE prix_location_mensuel IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_real_estate_superficie ON real_estate_properties(superficie_m2);
CREATE INDEX IF NOT EXISTS idx_real_estate_nb_chambres ON real_estate_properties(nb_chambres);
CREATE INDEX IF NOT EXISTS idx_real_estate_available_now ON real_estate_properties(is_available_now) WHERE is_available_now = TRUE;

-- 2. Table property_visits (Visites biens)
CREATE TABLE IF NOT EXISTS property_visits (
    id SERIAL PRIMARY KEY,
    property_id INTEGER NOT NULL REFERENCES real_estate_properties(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Détails visite
    type_visite VARCHAR(50) NOT NULL, -- "Physique", "Virtuelle"
    date_visite TIMESTAMPTZ NOT NULL,
    heure_visite TIME,
    duree_minutes INTEGER DEFAULT 30,
    
    -- Statut
    status VARCHAR(50) NOT NULL DEFAULT 'pending', -- "pending", "confirmed", "completed", "cancelled"
    notes TEXT,
    
    -- Métadonnées
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_property_visits_property_id ON property_visits(property_id);
CREATE INDEX IF NOT EXISTS idx_property_visits_user_id ON property_visits(user_id);
CREATE INDEX IF NOT EXISTS idx_property_visits_date ON property_visits(date_visite);
CREATE INDEX IF NOT EXISTS idx_property_visits_status ON property_visits(status);

-- 3. Table property_photos (Photos biens - relation many-to-many avec media)
CREATE TABLE IF NOT EXISTS property_photos (
    id SERIAL PRIMARY KEY,
    property_id INTEGER NOT NULL REFERENCES real_estate_properties(id) ON DELETE CASCADE,
    media_id INTEGER REFERENCES media(id) ON DELETE SET NULL,
    url TEXT,
    ordre INTEGER DEFAULT 0,
    is_principal BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_property_photos_property_id ON property_photos(property_id);
CREATE INDEX IF NOT EXISTS idx_property_photos_ordre ON property_photos(property_id, ordre);

-- 4. Table property_availability (Disponibilités pour location courte durée)
CREATE TABLE IF NOT EXISTS property_availability (
    id SERIAL PRIMARY KEY,
    property_id INTEGER NOT NULL REFERENCES real_estate_properties(id) ON DELETE CASCADE,
    date_debut DATE NOT NULL,
    date_fin DATE NOT NULL,
    prix_nuit DECIMAL(10, 2), -- Prix spécifique pour cette période
    disponible BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT check_availability_dates CHECK (date_fin >= date_debut)
);

CREATE INDEX IF NOT EXISTS idx_property_availability_property_id ON property_availability(property_id);
CREATE INDEX IF NOT EXISTS idx_property_availability_dates ON property_availability(date_debut, date_fin);
CREATE INDEX IF NOT EXISTS idx_property_availability_disponible ON property_availability(disponible) WHERE disponible = TRUE;

-- 5. Table real_estate_analytics (Analytics propriétaire)
CREATE TABLE IF NOT EXISTS real_estate_analytics (
    id SERIAL PRIMARY KEY,
    property_id INTEGER NOT NULL REFERENCES real_estate_properties(id) ON DELETE CASCADE,
    date_jour DATE NOT NULL DEFAULT CURRENT_DATE,
    
    -- Métriques
    vues INTEGER DEFAULT 0,
    contacts INTEGER DEFAULT 0,
    visites_demandees INTEGER DEFAULT 0,
    visites_confirmees INTEGER DEFAULT 0,
    favoris INTEGER DEFAULT 0,
    
    -- Métadonnées
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT unique_property_date UNIQUE(property_id, date_jour)
);

CREATE INDEX IF NOT EXISTS idx_real_estate_analytics_property_id ON real_estate_analytics(property_id);
CREATE INDEX IF NOT EXISTS idx_real_estate_analytics_date ON real_estate_analytics(date_jour);

-- ============================================================================
-- GROUPE 2 : TERRAINS 🏞️
-- ============================================================================

-- 6. Table land_properties (Terrains)
CREATE TABLE IF NOT EXISTS land_properties (
    id SERIAL PRIMARY KEY,
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Informations de base
    titre VARCHAR(255) NOT NULL,
    description TEXT,
    type_terrain VARCHAR(50) NOT NULL, -- "Résidentiel", "Commercial", "Agricole", "Industriel", "Mixte"
    superficie_m2 DECIMAL(12, 2) NOT NULL,
    
    -- Localisation
    adresse TEXT,
    quartier VARCHAR(255),
    ville VARCHAR(255),
    gps VARCHAR(255), -- Format: "lat,lng"
    
    -- Caractéristiques
    prix_total DECIMAL(12, 2) NOT NULL,
    prix_m2 DECIMAL(10, 2), -- Calculé automatiquement
    zonage VARCHAR(100), -- "Résidentiel", "Commercial", "Agricole", etc.
    acces_route BOOLEAN DEFAULT FALSE,
    type_acces VARCHAR(50), -- "Route goudronnée", "Piste", "Chemin privé"
    bornage BOOLEAN DEFAULT FALSE, -- Terrain borné
    viabilise BOOLEAN DEFAULT FALSE, -- Terrain viabilisé (eau, électricité, etc.)
    
    -- Documents légaux (JSONB)
    documents JSONB, -- {"titre_foncier": "url", "plan_cadastral": "url", "certificat_urbanisme": "url"}
    
    -- Contact
    telephone VARCHAR(50),
    whatsapp VARCHAR(50),
    email VARCHAR(255),
    
    -- Statut
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Métadonnées
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT unique_land_service UNIQUE(service_id)
);

-- Index pour land_properties
CREATE INDEX IF NOT EXISTS idx_land_user_id ON land_properties(user_id);
CREATE INDEX IF NOT EXISTS idx_land_service_id ON land_properties(service_id);
CREATE INDEX IF NOT EXISTS idx_land_is_active ON land_properties(is_active);
CREATE INDEX IF NOT EXISTS idx_land_type_terrain ON land_properties(type_terrain);
CREATE INDEX IF NOT EXISTS idx_land_ville ON land_properties(ville);
CREATE INDEX IF NOT EXISTS idx_land_quartier ON land_properties(quartier);
CREATE INDEX IF NOT EXISTS idx_land_prix ON land_properties(prix_total);
CREATE INDEX IF NOT EXISTS idx_land_superficie ON land_properties(superficie_m2);

-- 7. Table land_visits (Visites terrains)
CREATE TABLE IF NOT EXISTS land_visits (
    id SERIAL PRIMARY KEY,
    land_id INTEGER NOT NULL REFERENCES land_properties(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Détails visite
    date_visite TIMESTAMPTZ NOT NULL,
    heure_visite TIME,
    status VARCHAR(50) NOT NULL DEFAULT 'pending', -- "pending", "confirmed", "completed", "cancelled"
    notes TEXT,
    
    -- Métadonnées
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_land_visits_land_id ON land_visits(land_id);
CREATE INDEX IF NOT EXISTS idx_land_visits_user_id ON land_visits(user_id);
CREATE INDEX IF NOT EXISTS idx_land_visits_date ON land_visits(date_visite);

-- 8. Table land_documents (Documents légaux terrains)
CREATE TABLE IF NOT EXISTS land_documents (
    id SERIAL PRIMARY KEY,
    land_id INTEGER NOT NULL REFERENCES land_properties(id) ON DELETE CASCADE,
    type_document VARCHAR(100) NOT NULL, -- "Titre foncier", "Plan cadastral", "Certificat d'urbanisme", etc.
    url TEXT,
    media_id INTEGER REFERENCES media(id) ON DELETE SET NULL,
    date_emission DATE,
    date_expiration DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_land_documents_land_id ON land_documents(land_id);
CREATE INDEX IF NOT EXISTS idx_land_documents_type ON land_documents(type_document);

-- 9. Table land_analytics (Analytics terrains)
CREATE TABLE IF NOT EXISTS land_analytics (
    id SERIAL PRIMARY KEY,
    land_id INTEGER NOT NULL REFERENCES land_properties(id) ON DELETE CASCADE,
    date_jour DATE NOT NULL DEFAULT CURRENT_DATE,
    
    -- Métriques
    vues INTEGER DEFAULT 0,
    contacts INTEGER DEFAULT 0,
    visites_demandees INTEGER DEFAULT 0,
    favoris INTEGER DEFAULT 0,
    
    -- Métadonnées
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT unique_land_date UNIQUE(land_id, date_jour)
);

CREATE INDEX IF NOT EXISTS idx_land_analytics_land_id ON land_analytics(land_id);
CREATE INDEX IF NOT EXISTS idx_land_analytics_date ON land_analytics(date_jour);

-- ============================================================================
-- GROUPE 3 : DÉCORATION D'INTÉRIEUR 🎨
-- ============================================================================

-- 10. Table interior_design_projects (Projets décoration)
CREATE TABLE IF NOT EXISTS interior_design_projects (
    id SERIAL PRIMARY KEY,
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Informations de base
    nom_projet VARCHAR(255) NOT NULL,
    description TEXT,
    type_projet VARCHAR(50) NOT NULL, -- "Rénovation complète", "Décoration", "Aménagement", "Consultation"
    style VARCHAR(100), -- "Moderne", "Classique", "Scandinave", "Africain", etc.
    budget_estime DECIMAL(12, 2),
    
    -- Localisation
    adresse TEXT,
    quartier VARCHAR(255),
    ville VARCHAR(255),
    gps VARCHAR(255),
    
    -- Caractéristiques
    superficie_m2 DECIMAL(10, 2),
    nb_pieces INTEGER,
    pieces_a_decorer TEXT[], -- ["Salon", "Cuisine", "Chambre", ...]
    
    -- Portfolio (JSONB)
    portfolio JSONB, -- {"photos_avant": ["url1", "url2"], "photos_apres": ["url3"], "visualisations_3d": ["url4"]}
    
    -- Contact
    telephone VARCHAR(50),
    whatsapp VARCHAR(50),
    email VARCHAR(255),
    site_web VARCHAR(255),
    
    -- Statut
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Métadonnées
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT unique_design_service UNIQUE(service_id)
);

-- Index pour interior_design_projects
CREATE INDEX IF NOT EXISTS idx_design_user_id ON interior_design_projects(user_id);
CREATE INDEX IF NOT EXISTS idx_design_service_id ON interior_design_projects(service_id);
CREATE INDEX IF NOT EXISTS idx_design_is_active ON interior_design_projects(is_active);
CREATE INDEX IF NOT EXISTS idx_design_type_projet ON interior_design_projects(type_projet);
CREATE INDEX IF NOT EXISTS idx_design_style ON interior_design_projects(style);
CREATE INDEX IF NOT EXISTS idx_design_ville ON interior_design_projects(ville);

-- 11. Table design_consultations (Consultations décoration)
CREATE TABLE IF NOT EXISTS design_consultations (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES interior_design_projects(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Détails consultation
    type_consultation VARCHAR(50) NOT NULL, -- "Chat", "Vidéo", "Physique"
    date_consultation TIMESTAMPTZ NOT NULL,
    duree_minutes INTEGER DEFAULT 60,
    status VARCHAR(50) NOT NULL DEFAULT 'pending', -- "pending", "confirmed", "completed", "cancelled"
    
    -- Sujet
    sujet TEXT,
    notes TEXT,
    
    -- Métadonnées
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_design_consultations_project_id ON design_consultations(project_id);
CREATE INDEX IF NOT EXISTS idx_design_consultations_user_id ON design_consultations(user_id);
CREATE INDEX IF NOT EXISTS idx_design_consultations_date ON design_consultations(date_consultation);

-- 12. Table design_portfolio (Portfolio décorateurs)
CREATE TABLE IF NOT EXISTS design_portfolio (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES interior_design_projects(id) ON DELETE CASCADE,
    media_id INTEGER REFERENCES media(id) ON DELETE SET NULL,
    url TEXT,
    type_media VARCHAR(50) NOT NULL, -- "photo_avant", "photo_apres", "visualisation_3d", "video"
    description TEXT,
    ordre INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_design_portfolio_project_id ON design_portfolio(project_id);
CREATE INDEX IF NOT EXISTS idx_design_portfolio_type ON design_portfolio(type_media);
CREATE INDEX IF NOT EXISTS idx_design_portfolio_ordre ON design_portfolio(project_id, ordre);

-- 13. Table design_analytics (Analytics décoration)
CREATE TABLE IF NOT EXISTS design_analytics (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES interior_design_projects(id) ON DELETE CASCADE,
    date_jour DATE NOT NULL DEFAULT CURRENT_DATE,
    
    -- Métriques
    vues INTEGER DEFAULT 0,
    consultations_demandees INTEGER DEFAULT 0,
    consultations_confirmees INTEGER DEFAULT 0,
    favoris INTEGER DEFAULT 0,
    
    -- Métadonnées
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT unique_design_date UNIQUE(project_id, date_jour)
);

CREATE INDEX IF NOT EXISTS idx_design_analytics_project_id ON design_analytics(project_id);
CREATE INDEX IF NOT EXISTS idx_design_analytics_date ON design_analytics(date_jour);

-- ============================================================================
-- GROUPE 4 : DÉMÉNAGEMENT 🚚
-- ============================================================================

-- 14. Table moving_quotes (Devis déménagement)
CREATE TABLE IF NOT EXISTS moving_quotes (
    id SERIAL PRIMARY KEY,
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Informations déménagement
    adresse_depart TEXT NOT NULL,
    gps_depart VARCHAR(255), -- Format: "lat,lng"
    adresse_arrivee TEXT NOT NULL,
    gps_arrivee VARCHAR(255), -- Format: "lat,lng"
    date_demenagement DATE NOT NULL,
    heure_demenagement TIME,
    
    -- Caractéristiques
    volume_estime_m3 DECIMAL(10, 2),
    nb_pieces INTEGER,
    type_habitation VARCHAR(50), -- "Appartement", "Villa", "Studio", etc.
    etage_depart INTEGER,
    etage_arrivee INTEGER,
    ascenseur_depart BOOLEAN DEFAULT FALSE,
    ascenseur_arrivee BOOLEAN DEFAULT FALSE,
    
    -- Services additionnels
    emballage BOOLEAN DEFAULT FALSE,
    demontage BOOLEAN DEFAULT FALSE,
    montage BOOLEAN DEFAULT FALSE,
    assurance BOOLEAN DEFAULT FALSE,
    
    -- Prix
    prix_estime DECIMAL(12, 2),
    duree_estimee_heures INTEGER,
    
    -- Statut
    status VARCHAR(50) NOT NULL DEFAULT 'pending', -- "pending", "accepted", "rejected", "expired"
    
    -- Métadonnées
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index pour moving_quotes
CREATE INDEX IF NOT EXISTS idx_moving_quotes_service_id ON moving_quotes(service_id);
CREATE INDEX IF NOT EXISTS idx_moving_quotes_user_id ON moving_quotes(user_id);
CREATE INDEX IF NOT EXISTS idx_moving_quotes_date ON moving_quotes(date_demenagement);
CREATE INDEX IF NOT EXISTS idx_moving_quotes_status ON moving_quotes(status);

-- 15. Table moving_bookings (Réservations déménagement)
CREATE TABLE IF NOT EXISTS moving_bookings (
    id SERIAL PRIMARY KEY,
    quote_id INTEGER REFERENCES moving_quotes(id) ON DELETE SET NULL,
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Informations déménagement
    adresse_depart TEXT NOT NULL,
    gps_depart VARCHAR(255),
    adresse_arrivee TEXT NOT NULL,
    gps_arrivee VARCHAR(255),
    date_demenagement DATE NOT NULL,
    heure_demenagement TIME,
    
    -- Prix final
    prix_final DECIMAL(12, 2) NOT NULL,
    duree_estimee_heures INTEGER,
    
    -- Statut
    status VARCHAR(50) NOT NULL DEFAULT 'confirmed', -- "confirmed", "in_progress", "completed", "cancelled"
    
    -- Métadonnées
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_moving_bookings_service_id ON moving_bookings(service_id);
CREATE INDEX IF NOT EXISTS idx_moving_bookings_user_id ON moving_bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_moving_bookings_date ON moving_bookings(date_demenagement);
CREATE INDEX IF NOT EXISTS idx_moving_bookings_status ON moving_bookings(status);

-- 16. Table moving_tracking (Suivi GPS déménagement temps réel)
CREATE TABLE IF NOT EXISTS moving_tracking (
    id SERIAL PRIMARY KEY,
    booking_id INTEGER NOT NULL REFERENCES moving_bookings(id) ON DELETE CASCADE,
    
    -- Position GPS
    gps VARCHAR(255) NOT NULL, -- Format: "lat,lng"
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Statut
    etape VARCHAR(50), -- "depart", "en_route", "arrivee_depart", "chargement", "en_route_arrivee", "dechargement", "arrivee"
    
    -- Métadonnées
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_moving_tracking_booking_id ON moving_tracking(booking_id);
CREATE INDEX IF NOT EXISTS idx_moving_tracking_timestamp ON moving_tracking(booking_id, timestamp DESC);

-- 17. Table moving_inventory (Inventaire déménagement)
CREATE TABLE IF NOT EXISTS moving_inventory (
    id SERIAL PRIMARY KEY,
    booking_id INTEGER NOT NULL REFERENCES moving_bookings(id) ON DELETE CASCADE,
    
    -- Article
    nom_article VARCHAR(255) NOT NULL,
    categorie VARCHAR(100), -- "Meuble", "Électroménager", "Décoration", "Vêtement", etc.
    quantite INTEGER DEFAULT 1,
    etat VARCHAR(50), -- "Bon état", "Usé", "Endommagé", etc.
    notes TEXT,
    
    -- Photos
    photo_avant_url TEXT,
    photo_apres_url TEXT,
    
    -- Statut
    status VARCHAR(50) NOT NULL DEFAULT 'pending', -- "pending", "packed", "loaded", "delivered", "damaged"
    
    -- Métadonnées
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_moving_inventory_booking_id ON moving_inventory(booking_id);
CREATE INDEX IF NOT EXISTS idx_moving_inventory_status ON moving_inventory(status);

-- 18. Table moving_analytics (Analytics déménagement)
CREATE TABLE IF NOT EXISTS moving_analytics (
    id SERIAL PRIMARY KEY,
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    date_jour DATE NOT NULL DEFAULT CURRENT_DATE,
    
    -- Métriques
    devis_demandes INTEGER DEFAULT 0,
    devis_acceptes INTEGER DEFAULT 0,
    reservations INTEGER DEFAULT 0,
    demenagements_completes INTEGER DEFAULT 0,
    revenu_total DECIMAL(12, 2) DEFAULT 0,
    
    -- Métadonnées
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT unique_moving_date UNIQUE(service_id, date_jour)
);

CREATE INDEX IF NOT EXISTS idx_moving_analytics_service_id ON moving_analytics(service_id);
CREATE INDEX IF NOT EXISTS idx_moving_analytics_date ON moving_analytics(date_jour);

-- ============================================================================
-- FONCTIONNALITÉS AVANCÉES LEADER MONDIAL
-- ============================================================================

-- 19. Table property_favorites (Favoris biens immobiliers)
CREATE TABLE IF NOT EXISTS property_favorites (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    property_id INTEGER NOT NULL REFERENCES real_estate_properties(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT unique_user_property_favorite UNIQUE(user_id, property_id)
);

CREATE INDEX IF NOT EXISTS idx_property_favorites_user_id ON property_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_property_favorites_property_id ON property_favorites(property_id);

-- 20. Table property_price_alerts (Alertes prix)
CREATE TABLE IF NOT EXISTS property_price_alerts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    property_id INTEGER REFERENCES real_estate_properties(id) ON DELETE CASCADE,
    search_criteria JSONB, -- Critères de recherche (ville, type_bien, prix_max, etc.)
    target_price_max DECIMAL(12, 2),
    alert_type VARCHAR(50) NOT NULL, -- "price_drop", "new_property", "price_match"
    is_active BOOLEAN DEFAULT TRUE,
    notified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_property_price_alerts_user_id ON property_price_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_property_price_alerts_property_id ON property_price_alerts(property_id);
CREATE INDEX IF NOT EXISTS idx_property_price_alerts_active ON property_price_alerts(is_active) WHERE is_active = TRUE;

-- 21. Table property_comparisons (Comparaisons de biens)
CREATE TABLE IF NOT EXISTS property_comparisons (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    property_ids INTEGER[] NOT NULL, -- Liste des IDs de biens à comparer
    comparison_name VARCHAR(255), -- Nom de la comparaison
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_property_comparisons_user_id ON property_comparisons(user_id);
CREATE INDEX IF NOT EXISTS idx_property_comparisons_property_ids ON property_comparisons USING GIN(property_ids);

-- 22. Table property_virtual_tours (Visites virtuelles 360°)
CREATE TABLE IF NOT EXISTS property_virtual_tours (
    id SERIAL PRIMARY KEY,
    property_id INTEGER NOT NULL REFERENCES real_estate_properties(id) ON DELETE CASCADE,
    tour_type VARCHAR(50) NOT NULL, -- "360_video", "3d_model", "virtual_staging"
    media_url TEXT NOT NULL,
    thumbnail_url TEXT,
    duration_seconds INTEGER,
    description TEXT,
    is_primary BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_property_virtual_tours_property_id ON property_virtual_tours(property_id);
CREATE INDEX IF NOT EXISTS idx_property_virtual_tours_type ON property_virtual_tours(tour_type);

-- 23. Table property_views (Tracking vues pour analytics)
CREATE TABLE IF NOT EXISTS property_views (
    id SERIAL PRIMARY KEY,
    property_id INTEGER NOT NULL REFERENCES real_estate_properties(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    session_id TEXT,
    view_duration_seconds INTEGER,
    viewed_sections TEXT[], -- ["photos", "description", "map", "virtual_tour"]
    source VARCHAR(100), -- "search", "favorite", "recommendation", "share"
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_property_views_property_id ON property_views(property_id);
CREATE INDEX IF NOT EXISTS idx_property_views_user_id ON property_views(user_id);
CREATE INDEX IF NOT EXISTS idx_property_views_created_at ON property_views(created_at);

-- 24. Table property_shares (Partage social)
CREATE TABLE IF NOT EXISTS property_shares (
    id SERIAL PRIMARY KEY,
    property_id INTEGER NOT NULL REFERENCES real_estate_properties(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    share_type VARCHAR(50) NOT NULL, -- "whatsapp", "facebook", "twitter", "link", "qr_code"
    share_token TEXT UNIQUE, -- Token unique pour lien partageable
    share_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_property_shares_property_id ON property_shares(property_id);
CREATE INDEX IF NOT EXISTS idx_property_shares_token ON property_shares(share_token);

-- ============================================================================
-- COMMENTAIRES
-- ============================================================================

COMMENT ON TABLE real_estate_properties IS 'Biens immobiliers (vente/location)';
COMMENT ON TABLE property_visits IS 'Visites biens immobiliers';
COMMENT ON TABLE property_photos IS 'Photos biens immobiliers';
COMMENT ON TABLE property_availability IS 'Disponibilités location courte durée';
COMMENT ON TABLE real_estate_analytics IS 'Analytics propriétaire biens immobiliers';

COMMENT ON TABLE land_properties IS 'Terrains à vendre';
COMMENT ON TABLE land_visits IS 'Visites terrains';
COMMENT ON TABLE land_documents IS 'Documents légaux terrains';
COMMENT ON TABLE land_analytics IS 'Analytics terrains';

COMMENT ON TABLE interior_design_projects IS 'Projets décoration intérieure';
COMMENT ON TABLE design_consultations IS 'Consultations décoration';
COMMENT ON TABLE design_portfolio IS 'Portfolio décorateurs';
COMMENT ON TABLE design_analytics IS 'Analytics décoration';

COMMENT ON TABLE moving_quotes IS 'Devis déménagement';
COMMENT ON TABLE moving_bookings IS 'Réservations déménagement';
COMMENT ON TABLE moving_tracking IS 'Suivi GPS déménagement temps réel';
COMMENT ON TABLE moving_inventory IS 'Inventaire déménagement';
COMMENT ON TABLE moving_analytics IS 'Analytics déménagement';

COMMENT ON TABLE property_favorites IS 'Favoris biens immobiliers';
COMMENT ON TABLE property_price_alerts IS 'Alertes prix biens immobiliers';
COMMENT ON TABLE property_comparisons IS 'Comparaisons de biens immobiliers';
COMMENT ON TABLE property_virtual_tours IS 'Visites virtuelles 360° biens immobiliers';
COMMENT ON TABLE property_views IS 'Tracking vues biens immobiliers pour analytics';
COMMENT ON TABLE property_shares IS 'Partage social biens immobiliers';
