-- Migration : Rendre autocomplete_characteristics vectorielle pour stocker les VRAIS produits validés
-- Date : 2025-11-04
-- Description : Transformation de la structure individuelle vers vectorielle
--               Permet de stocker le vecteur complet du produit choisi par le prestataire
--               avec le vecteur bidirectionnel du lieu de commercialisation
-- Compatible SQLx offline mode

-- ✅ ÉTAPE 1 : Ajouter les nouvelles colonnes vectorielles
ALTER TABLE autocomplete_characteristics
ADD COLUMN IF NOT EXISTS characteristic_vector TEXT[] DEFAULT '{}',
-- Vecteur des caractéristiques du produit validé par le prestataire
-- Ex: ["Nike", "Air Max", "42", "Noir", "Neuf"]

ADD COLUMN IF NOT EXISTS location_vector TEXT[] DEFAULT '{}',
-- Vecteur bidirectionnel du lieu de commercialisation
-- Ex: ["Douala", "Bonanjo", "Akwa", "Deido", "Littoral", "Cameroun"]
-- IMPORTANT : Le lieu choisi par le prestataire est TOUJOURS en position 0

ADD COLUMN IF NOT EXISTS full_vector TEXT[] DEFAULT '{}',
-- Vecteur complet : characteristic_vector + location_vector
-- Ex: ["Nike", "Air Max", "42", "Noir", "Neuf", "Douala", "Bonanjo", ..., "Littoral", "Cameroun"]
-- Utilisé pour la recherche intelligente avec filtre lieu intégré

ADD COLUMN IF NOT EXISTS product_id TEXT,
-- Identifiant du produit (format: "serviceId_productIndex")
-- Ex: "123_0", "123_1"
-- Permet le lien avec la table products ou services.data->produits

ADD COLUMN IF NOT EXISTS chosen_location TEXT,
-- Lieu choisi par le prestataire (position 0 du location_vector)
-- Ex: "Douala", "Bonanjo"

ADD COLUMN IF NOT EXISTS chosen_location_geoname_id BIGINT,
-- ID GeoNames du lieu choisi (GARANTIT l'unicité du lieu)
-- Permet de retrouver facilement la hiérarchie dans geo_hierarchy

ADD COLUMN IF NOT EXISTS is_real_product BOOLEAN DEFAULT TRUE;
-- TRUE = produit réel validé par prestataire (table autocomplete_characteristics)
-- FALSE = combinaison possible générée par IA (ne devrait pas être dans cette table)
-- Par défaut TRUE car cette table stocke les VRAIS produits

-- ✅ ÉTAPE 2 : Créer index GIN pour recherche vectorielle rapide

-- Index GIN pour recherche dans characteristic_vector
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relname = 'idx_autochar_characteristic_vector_gin' AND n.nspname = 'public'
    ) THEN
        CREATE INDEX idx_autochar_characteristic_vector_gin 
        ON autocomplete_characteristics USING GIN(characteristic_vector);
    END IF;
END $$;

-- Index GIN pour recherche dans location_vector
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relname = 'idx_autochar_location_vector_gin' AND n.nspname = 'public'
    ) THEN
        CREATE INDEX idx_autochar_location_vector_gin 
        ON autocomplete_characteristics USING GIN(location_vector);
    END IF;
END $$;

-- Index GIN pour recherche dans full_vector (PRINCIPAL pour recherche globale)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relname = 'idx_autochar_full_vector_gin' AND n.nspname = 'public'
    ) THEN
        CREATE INDEX idx_autochar_full_vector_gin 
        ON autocomplete_characteristics USING GIN(full_vector);
    END IF;
END $$;

-- Index composite pour recherche par lieu + popularité
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relname = 'idx_autochar_location_usage' AND n.nspname = 'public'
    ) THEN
        CREATE INDEX idx_autochar_location_usage 
        ON autocomplete_characteristics(chosen_location, usage_count DESC)
        WHERE chosen_location IS NOT NULL;
    END IF;
END $$;

-- Index pour recherche par product_id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relname = 'idx_autochar_product_id' AND n.nspname = 'public'
    ) THEN
        CREATE INDEX idx_autochar_product_id 
        ON autocomplete_characteristics(product_id)
        WHERE product_id IS NOT NULL;
    END IF;
END $$;

-- Index pour recherche par geoname_id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relname = 'idx_autochar_geoname_id' AND n.nspname = 'public'
    ) THEN
        CREATE INDEX idx_autochar_geoname_id 
        ON autocomplete_characteristics(chosen_location_geoname_id)
        WHERE chosen_location_geoname_id IS NOT NULL;
    END IF;
END $$;

-- ✅ ÉTAPE 3 : Modifier la contrainte unique pour mode vectoriel
-- Supprimer l'ancienne contrainte individuelle
ALTER TABLE autocomplete_characteristics
DROP CONSTRAINT IF EXISTS unique_autocomplete_characteristic;

-- Ajouter nouvelle contrainte sur full_vector (permet doublons pour popularité)
-- Note: On N'ajoute PAS de contrainte UNIQUE car les doublons sont voulus pour popularité
-- La popularité est gérée par usage_count

-- ✅ ÉTAPE 4 : Fonction pour sauvegarder un produit réel avec vecteur complet
CREATE OR REPLACE FUNCTION upsert_real_product_characteristic(
    p_identifiant_base VARCHAR(255),
    p_service_id INTEGER,
    p_product_id TEXT,
    p_characteristic_vector TEXT[],
    p_location_vector TEXT[] DEFAULT '{}',
    p_full_vector TEXT[],
    p_chosen_location TEXT DEFAULT NULL,
    p_chosen_location_geoname_id BIGINT DEFAULT NULL,
    p_origine_champs VARCHAR(50) DEFAULT 'formulaire',
    p_user_id INTEGER DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
    v_id INTEGER;
BEGIN
    -- Toujours insérer (doublons acceptés pour popularité)
    INSERT INTO autocomplete_characteristics (
        identifiant_base,
        service_id,
        product_id,
        characteristic_vector,
        location_vector,
        full_vector,
        chosen_location,
        chosen_location_geoname_id,
        is_real_product,
        origine_champs,
        user_id,
        usage_count,
        sous_caracteristique,  -- Mettre 'vector' pour compatibilité
        valeur                  -- Mettre le premier élément du vecteur
    )
    VALUES (
        p_identifiant_base,
        p_service_id,
        p_product_id,
        p_characteristic_vector,
        p_location_vector,
        p_full_vector,
        p_chosen_location,
        p_chosen_location_geoname_id,
        TRUE,  -- Toujours TRUE pour les vrais produits
        p_origine_champs,
        p_user_id,
        1,
        'vector',  -- Marqueur pour indiquer mode vectoriel
        COALESCE(p_characteristic_vector[1], '')  -- Premier élément comme valeur
    )
    RETURNING id INTO v_id;
    
    RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- ✅ ÉTAPE 5 : Commentaires pour documentation
COMMENT ON COLUMN autocomplete_characteristics.characteristic_vector IS 
'Vecteur des caractéristiques du produit validé par le prestataire (ex: ["Nike", "Air Max", "42"])';

COMMENT ON COLUMN autocomplete_characteristics.location_vector IS 
'Vecteur bidirectionnel du lieu de commercialisation (ex: ["Douala", "Bonanjo", "Littoral", "Cameroun"]). Le lieu choisi est TOUJOURS en position 0';

COMMENT ON COLUMN autocomplete_characteristics.full_vector IS 
'Vecteur complet = characteristic_vector + location_vector. Utilisé pour recherche intelligente avec filtre lieu intégré';

COMMENT ON COLUMN autocomplete_characteristics.product_id IS 
'Identifiant du produit (format: serviceId_productIndex). Permet le lien avec services.data->produits';

COMMENT ON COLUMN autocomplete_characteristics.chosen_location IS 
'Lieu choisi par le prestataire (position 0 du location_vector)';

COMMENT ON COLUMN autocomplete_characteristics.chosen_location_geoname_id IS 
'ID GeoNames du lieu choisi. GARANTIT l''unicité du lieu et permet de retrouver la hiérarchie dans geo_hierarchy';

COMMENT ON COLUMN autocomplete_characteristics.is_real_product IS 
'TRUE = produit réel validé par prestataire. Cette table stocke UNIQUEMENT les vrais produits (pas les combinaisons possibles IA)';

COMMENT ON FUNCTION upsert_real_product_characteristic IS 
'Insère un produit réel validé par prestataire avec vecteur complet (caractéristiques + lieu bidirectionnel). Les doublons sont acceptés pour calculer la popularité via usage_count';

-- ✅ ÉTAPE 6 : Mettre à jour les anciennes lignes individuelles (migration de données)
-- Les anciennes lignes avec sous_caracteristique != 'vector' sont conservées pour compatibilité
-- mais elles seront progressivement remplacées par les nouvelles lignes vectorielles

COMMENT ON TABLE autocomplete_characteristics IS 
'Historique des VRAIS produits validés par les prestataires (mode vectoriel). 
Permet la recherche intelligente avec filtre lieu intégré. 
Les doublons sont ACCEPTÉS pour calculer la popularité des produits.';


