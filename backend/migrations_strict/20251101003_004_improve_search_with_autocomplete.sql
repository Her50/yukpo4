-- Migration : Améliorer la recherche en intégrant autocomplete_characteristics
-- Date : 2025-11-01
-- Description : Ajouter des index et une fonction pour booster la recherche via les caractéristiques autocomplete structurées
-- Compatible avec SQLx offline mode

-- Index composite optimisé pour recherche rapide
CREATE INDEX IF NOT EXISTS idx_autocomplete_search_optimized
ON autocomplete_characteristics(service_id, identifiant_base, sous_caracteristique, LOWER(valeur));

-- Index GIN pour full-text search sur valeur
CREATE INDEX IF NOT EXISTS idx_autocomplete_valeur_gin
ON autocomplete_characteristics USING GIN (to_tsvector('french', valeur));

-- Index pour recherche insensible à la casse
CREATE INDEX IF NOT EXISTS idx_autocomplete_valeur_trgm
ON autocomplete_characteristics USING GIN (valeur gin_trgm_ops);

-- Fonction pour calculer le score autocomplete d'un service
CREATE OR REPLACE FUNCTION calculate_autocomplete_score(
    p_service_id INTEGER,
    p_search_query TEXT
)
RETURNS FLOAT AS $$
DECLARE
    total_score FLOAT := 0.0;
    characteristic_record RECORD;
    query_words TEXT[];
    word TEXT;
BEGIN
    -- Découper la requête en mots
    query_words := string_to_array(LOWER(p_search_query), ' ');
    
    -- Parcourir toutes les caractéristiques du service
    FOR characteristic_record IN
        SELECT 
            sous_caracteristique,
            valeur,
            usage_count
        FROM autocomplete_characteristics
        WHERE service_id = p_service_id
        AND identifiant_base LIKE 'produit%'  -- Seulement les produits
    LOOP
        -- Vérifier chaque mot de la requête
        FOREACH word IN ARRAY query_words
        LOOP
            IF word = '' OR LENGTH(word) < 2 THEN
                CONTINUE;
            END IF;
            
            -- Match sur la valeur (insensible casse)
            IF LOWER(characteristic_record.valeur) LIKE '%' || word || '%' THEN
                -- Score de base selon la sous-caractéristique
                CASE 
                    -- ✅ Caractéristiques CRITIQUES (20.0)
                    WHEN characteristic_record.sous_caracteristique IN ('marque', 'brand') THEN 
                        total_score := total_score + 20.0;
                    WHEN characteristic_record.sous_caracteristique IN ('modele', 'model') THEN 
                        total_score := total_score + 18.0;
                    
                    -- ✅ Caractéristiques TRÈS IMPORTANTES (15.0)
                    WHEN characteristic_record.sous_caracteristique IN ('type', 'categorie', 'category') THEN 
                        total_score := total_score + 15.0;
                    
                    -- ✅ Caractéristiques IMPORTANTES (12.0)
                    WHEN characteristic_record.sous_caracteristique IN ('couleur', 'color') THEN 
                        total_score := total_score + 12.0;
                    WHEN characteristic_record.sous_caracteristique IN ('taille', 'size', 'pointure') THEN 
                        total_score := total_score + 12.0;
                    
                    -- ✅ Caractéristiques UTILES pour AUTO (12.0)
                    WHEN characteristic_record.sous_caracteristique IN ('carburant', 'transmission', 'annee', 'kilometrage') THEN 
                        total_score := total_score + 12.0;
                    
                    -- ✅ Caractéristiques UTILES pour IMMOBILIER (10.0)
                    WHEN characteristic_record.sous_caracteristique IN ('typeBatiment', 'nombre_chambres', 'surface') THEN 
                        total_score := total_score + 10.0;
                    
                    -- ✅ Autres caractéristiques (8.0)
                    ELSE 
                        total_score := total_score + 8.0;
                END CASE;
                
                -- ✅ BOOST selon popularité (usage_count)
                -- Une caractéristique utilisée 10 fois vaut 2x plus qu'une utilisée 1 fois
                total_score := total_score * (1.0 + (characteristic_record.usage_count::FLOAT / 10.0));
            END IF;
        END LOOP;
    END LOOP;
    
    RETURN total_score;
END;
$$ LANGUAGE plpgsql STABLE;

-- Fonction alternative utilisant full-text search (plus rapide pour grandes bases)
CREATE OR REPLACE FUNCTION calculate_autocomplete_score_fast(
    p_service_id INTEGER,
    p_search_query TEXT
)
RETURNS FLOAT AS $$
SELECT COALESCE(SUM(
    CASE 
        WHEN ac.sous_caracteristique IN ('marque', 'brand') THEN 20.0
        WHEN ac.sous_caracteristique IN ('modele', 'model') THEN 18.0
        WHEN ac.sous_caracteristique IN ('type', 'categorie', 'category') THEN 15.0
        WHEN ac.sous_caracteristique IN ('couleur', 'color') THEN 12.0
        WHEN ac.sous_caracteristique IN ('taille', 'pointure', 'size') THEN 12.0
        WHEN ac.sous_caracteristique IN ('carburant', 'transmission', 'annee', 'kilometrage') THEN 12.0
        WHEN ac.sous_caracteristique IN ('typeBatiment', 'nombre_chambres', 'surface') THEN 10.0
        ELSE 8.0
    END *
    ts_rank(to_tsvector('french', ac.valeur), plainto_tsquery('french', p_search_query)) *
    (1.0 + (ac.usage_count::FLOAT / 10.0))
), 0.0)
FROM autocomplete_characteristics ac
WHERE ac.service_id = p_service_id
AND ac.identifiant_base LIKE 'produit%'
AND to_tsvector('french', ac.valeur) @@ plainto_tsquery('french', p_search_query);
$$ LANGUAGE SQL STABLE;

-- Commentaires
COMMENT ON FUNCTION calculate_autocomplete_score IS 
'Calcule le score de pertinence en parcourant les caractéristiques autocomplete mot par mot';

COMMENT ON FUNCTION calculate_autocomplete_score_fast IS 
'Version optimisée utilisant full-text search PostgreSQL pour grandes bases de données';

COMMENT ON INDEX idx_autocomplete_search_optimized IS 
'Index composite pour recherche rapide par service + caractéristique + valeur';

COMMENT ON INDEX idx_autocomplete_valeur_gin IS 
'Index GIN pour full-text search performant sur les valeurs';

COMMENT ON INDEX idx_autocomplete_valeur_trgm IS 
'Index trigram pour recherche floue et fautes de frappe';

