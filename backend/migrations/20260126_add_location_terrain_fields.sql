-- ✅ NOUVEAU: Ajout champs manquants pour location et terrains
-- Date: 2026-01-26

-- Ajouter champs pour location (caution en mois, mensualités exigées)
ALTER TABLE real_estate_properties 
ADD COLUMN IF NOT EXISTS caution_mois INTEGER, -- Nombre de mois de caution
ADD COLUMN IF NOT EXISTS mensualites_exigees INTEGER, -- Nombre de mensualités exigées pour louer
ADD COLUMN IF NOT EXISTS caution_montant DECIMAL(12, 2); -- Montant de la caution (si différent de prix_location_mensuel * caution_mois)

-- Ajouter champs pour terrains
ALTER TABLE land_properties
ADD COLUMN IF NOT EXISTS terrain_titre BOOLEAN DEFAULT FALSE, -- Terrain titré (titre foncier)
ADD COLUMN IF NOT EXISTS terrain_bati BOOLEAN DEFAULT FALSE, -- Terrain bâti ou non bâti
ADD COLUMN IF NOT EXISTS zone_habitation BOOLEAN DEFAULT FALSE, -- Zone d'habitation
ADD COLUMN IF NOT EXISTS terrain_elevage BOOLEAN DEFAULT FALSE, -- Terrain pour élevage
ADD COLUMN IF NOT EXISTS terrain_agriculture BOOLEAN DEFAULT FALSE, -- Terrain pour agriculture
ADD COLUMN IF NOT EXISTS distance_goudron_m DECIMAL(10, 2), -- Distance avec route goudronnée en mètres
ADD COLUMN IF NOT EXISTS eau_disponible BOOLEAN DEFAULT FALSE, -- Disponibilité eau
ADD COLUMN IF NOT EXISTS electricite_disponible BOOLEAN DEFAULT FALSE; -- Disponibilité électricité

-- Index pour nouveaux champs
CREATE INDEX IF NOT EXISTS idx_real_estate_caution_mois ON real_estate_properties(caution_mois) WHERE caution_mois IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_real_estate_mensualites_exigees ON real_estate_properties(mensualites_exigees) WHERE mensualites_exigees IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_land_terrain_titre ON land_properties(terrain_titre) WHERE terrain_titre = TRUE;
CREATE INDEX IF NOT EXISTS idx_land_terrain_bati ON land_properties(terrain_bati);
CREATE INDEX IF NOT EXISTS idx_land_zone_habitation ON land_properties(zone_habitation) WHERE zone_habitation = TRUE;
CREATE INDEX IF NOT EXISTS idx_land_elevage ON land_properties(terrain_elevage) WHERE terrain_elevage = TRUE;
CREATE INDEX IF NOT EXISTS idx_land_agriculture ON land_properties(terrain_agriculture) WHERE terrain_agriculture = TRUE;

