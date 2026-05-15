-- ✅ NOUVEAU: Table pour historique des prix immobiliers
-- Date: 2026-01-26
-- Objectif: Stocker l'historique des prix pour analyse de tendances

-- Table principale pour historique des prix
CREATE TABLE IF NOT EXISTS property_price_history (
    id SERIAL PRIMARY KEY,
    property_id INTEGER NOT NULL REFERENCES real_estate_properties(id) ON DELETE CASCADE,
    prix_vente DECIMAL(12, 2),
    prix_location_mensuel DECIMAL(12, 2),
    date_enregistrement TIMESTAMP DEFAULT NOW(),
    source VARCHAR(50) DEFAULT 'system', -- 'system', 'owner', 'sold', 'rented'
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    
    -- Index pour requêtes rapides
    CONSTRAINT fk_property_price_history_property FOREIGN KEY (property_id) REFERENCES real_estate_properties(id) ON DELETE CASCADE
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_property_price_history_property_id ON property_price_history(property_id);
CREATE INDEX IF NOT EXISTS idx_property_price_history_date ON property_price_history(date_enregistrement DESC);
CREATE INDEX IF NOT EXISTS idx_property_price_history_property_date ON property_price_history(property_id, date_enregistrement DESC);

-- Table pour biens vendus/loués (pour comparaison)
CREATE TABLE IF NOT EXISTS property_sales_history (
    id SERIAL PRIMARY KEY,
    property_id INTEGER REFERENCES real_estate_properties(id) ON DELETE SET NULL,
    type_transaction VARCHAR(20) NOT NULL, -- 'vente', 'location'
    prix_final DECIMAL(12, 2) NOT NULL,
    date_transaction DATE NOT NULL,
    date_publication DATE,
    duree_marché_jours INTEGER, -- Nombre de jours entre publication et transaction
    quartier VARCHAR(100),
    ville VARCHAR(100),
    type_bien VARCHAR(50),
    superficie_m2 DECIMAL(10, 2),
    nb_chambres INTEGER,
    standing VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW(),
    
    -- Index pour requêtes rapides
    CONSTRAINT chk_type_transaction CHECK (type_transaction IN ('vente', 'location'))
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_property_sales_history_type ON property_sales_history(type_transaction);
CREATE INDEX IF NOT EXISTS idx_property_sales_history_date ON property_sales_history(date_transaction DESC);
CREATE INDEX IF NOT EXISTS idx_property_sales_history_location ON property_sales_history(ville, quartier);
CREATE INDEX IF NOT EXISTS idx_property_sales_history_type_bien ON property_sales_history(type_bien);

-- Fonction pour enregistrer automatiquement l'historique lors de modification de prix
CREATE OR REPLACE FUNCTION log_property_price_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Enregistrer l'ancien prix si changé
    IF (OLD.prix_vente IS DISTINCT FROM NEW.prix_vente) OR 
       (OLD.prix_location_mensuel IS DISTINCT FROM NEW.prix_location_mensuel) THEN
        INSERT INTO property_price_history (
            property_id,
            prix_vente,
            prix_location_mensuel,
            source,
            notes
        ) VALUES (
            NEW.id,
            NEW.prix_vente,
            NEW.prix_location_mensuel,
            'system',
            'Modification automatique du prix'
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour enregistrer automatiquement les changements de prix
DROP TRIGGER IF EXISTS trigger_log_price_change ON real_estate_properties;
CREATE TRIGGER trigger_log_price_change
    AFTER UPDATE OF prix_vente, prix_location_mensuel
    ON real_estate_properties
    FOR EACH ROW
    WHEN (OLD.prix_vente IS DISTINCT FROM NEW.prix_vente OR 
          OLD.prix_location_mensuel IS DISTINCT FROM NEW.prix_location_mensuel)
    EXECUTE FUNCTION log_property_price_change();

-- Vue pour statistiques de prix par zone
CREATE OR REPLACE VIEW property_price_stats_by_zone AS
SELECT 
    ville,
    quartier,
    type_bien,
    statut,
    COUNT(*) as total_properties,
    AVG(prix_vente) as avg_prix_vente,
    AVG(prix_location_mensuel) as avg_prix_location,
    AVG(superficie_m2) as avg_superficie,
    AVG(prix_vente / NULLIF(superficie_m2, 0)) as avg_prix_par_m2_vente,
    AVG(prix_location_mensuel / NULLIF(superficie_m2, 0)) as avg_prix_par_m2_location,
    MIN(prix_vente) as min_prix_vente,
    MAX(prix_vente) as max_prix_vente,
    MIN(prix_location_mensuel) as min_prix_location,
    MAX(prix_location_mensuel) as max_prix_location,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY prix_vente) as median_prix_vente,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY prix_location_mensuel) as median_prix_location
FROM real_estate_properties
WHERE is_active = true
GROUP BY ville, quartier, type_bien, statut;

-- Commentaires pour documentation
COMMENT ON TABLE property_price_history IS 'Historique des prix des biens immobiliers pour analyse de tendances';
COMMENT ON TABLE property_sales_history IS 'Historique des transactions (ventes/locations) pour comparaison avec biens similaires';
COMMENT ON VIEW property_price_stats_by_zone IS 'Statistiques agrégées des prix par zone pour analyse de marché';

