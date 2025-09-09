-- Correction de la fonction calculate_image_similarity
-- Base de données: yukpo_db

-- Supprimer l'ancienne fonction
DROP FUNCTION IF EXISTS calculate_image_similarity(JSONB, JSONB);

-- Créer la fonction corrigée
CREATE OR REPLACE FUNCTION calculate_image_similarity(
    signature1 JSONB,
    signature2 JSONB
)
RETURNS FLOAT AS $$
DECLARE
    similarity FLOAT;
    array1 FLOAT[];
    array2 FLOAT[];
    dot_product FLOAT := 0.0;
    norm1 FLOAT := 0.0;
    norm2 FLOAT := 0.0;
    i INTEGER;
BEGIN
    -- Vérifier que les signatures sont des tableaux JSONB
    IF signature1 IS NULL OR signature2 IS NULL THEN
        RETURN 0.0;
    END IF;
    
    -- Vérifier que ce sont bien des tableaux
    IF jsonb_typeof(signature1) != 'array' OR jsonb_typeof(signature2) != 'array' THEN
        RETURN 0.0;
    END IF;
    
    -- Convertir les JSONB en arrays
    array1 := ARRAY(SELECT jsonb_array_elements_text(signature1)::FLOAT);
    array2 := ARRAY(SELECT jsonb_array_elements_text(signature2)::FLOAT);
    
    -- Vérifier que les arrays ont la même longueur
    IF array_length(array1, 1) != array_length(array2, 1) THEN
        RETURN 0.0;
    END IF;
    
    -- Calculer le produit scalaire et les normes
    FOR i IN 1..array_length(array1, 1) LOOP
        dot_product := dot_product + array1[i] * array2[i];
        norm1 := norm1 + array1[i] * array1[i];
        norm2 := norm2 + array2[i] * array2[i];
    END LOOP;
    
    -- Calculer la similarité cosinus
    IF norm1 = 0 OR norm2 = 0 THEN
        similarity := 0.0;
    ELSE
        similarity := dot_product / (SQRT(norm1) * SQRT(norm2));
    END IF;
    
    RETURN similarity;
END;
$$ LANGUAGE plpgsql;

-- Vérifier que la fonction a été créée
SELECT 'Fonction calculate_image_similarity corrigée' as status;
SELECT proname, prosrc FROM pg_proc WHERE proname = 'calculate_image_similarity'; 