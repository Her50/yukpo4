-- Migration pour ajouter les descriptions manquantes dans services.data->'produits'
-- Date: 2025-12-01
-- Description: Extrait les descriptions depuis autocomplete_characteristics.full_vector
--              et les ajoute dans services.data->'produits'->valeur[0]->description

-- Fonction pour extraire la description depuis full_vector
-- La description est souvent le 3ème élément (après nom et catégorie) ou un élément long (> 50 caractères)
CREATE OR REPLACE FUNCTION extract_description_from_full_vector(full_vector TEXT[])
RETURNS TEXT AS $$
DECLARE
    desc_candidate TEXT;
BEGIN
    -- Chercher un élément long (> 50 caractères) après les 2 premiers (nom et catégorie)
    FOR desc_candidate IN 
        SELECT unnest(full_vector[3:]) -- À partir du 3ème élément
    LOOP
        IF LENGTH(desc_candidate) > 50 THEN
            RETURN desc_candidate;
        END IF;
    END LOOP;
    
    -- Si pas trouvé, prendre le 3ème élément s'il existe
    IF array_length(full_vector, 1) >= 3 THEN
        RETURN full_vector[3];
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Script de mise à jour
DO $$
DECLARE
    service_record RECORD;
    product_record RECORD;
    description_text TEXT;
    updated_count INTEGER := 0;
    service_data JSONB;
    produits_obj JSONB;
    valeur_array JSONB;
    first_product JSONB;
BEGIN
    RAISE NOTICE 'Début migration: Ajout descriptions manquantes dans services.data->produits';
    
    -- Parcourir tous les services actifs avec des produits
    FOR service_record IN
        SELECT 
            s.id as service_id,
            s.data as service_data
        FROM services s
        WHERE s.is_active = true
        AND s.data->'produits' IS NOT NULL
        AND jsonb_typeof(s.data->'produits') = 'object'
        AND s.data->'produits'->>'type_donnee' = 'listeproduit'
        AND s.data->'produits'->'valeur' IS NOT NULL
        AND jsonb_array_length(s.data->'produits'->'valeur') > 0
    LOOP
        service_data := service_record.service_data;
        produits_obj := service_data->'produits';
        valeur_array := produits_obj->'valeur';
        
        -- Vérifier le premier produit
        IF jsonb_array_length(valeur_array) > 0 THEN
            first_product := valeur_array->0;
            
            -- Vérifier si description manquante
            IF (first_product->>'description' IS NULL OR first_product->>'description' = '')
               AND (first_product->>'description_produit' IS NULL OR first_product->>'description_produit' = '') THEN
                
                -- Chercher la description dans autocomplete_characteristics.full_vector
                SELECT extract_description_from_full_vector(ac.full_vector)
                INTO description_text
                FROM autocomplete_characteristics ac
                WHERE ac.service_id = service_record.service_id
                AND ac.is_real_product = TRUE
                AND ac.identifiant_base = 'produits'
                AND ac.full_vector IS NOT NULL
                AND array_length(ac.full_vector, 1) >= 3
                ORDER BY ac.usage_count DESC NULLS LAST
                LIMIT 1;
                
                -- Si description trouvée, mettre à jour
                IF description_text IS NOT NULL AND LENGTH(description_text) > 10 THEN
                    -- Mettre à jour le premier produit
                    first_product := jsonb_set(
                        first_product,
                        '{description}',
                        to_jsonb(description_text)
                    );
                    
                    -- Mettre à jour valeur_array
                    valeur_array := jsonb_set(
                        valeur_array,
                        '{0}',
                        first_product
                    );
                    
                    -- Mettre à jour produits_obj
                    produits_obj := jsonb_set(
                        produits_obj,
                        '{valeur}',
                        valeur_array
                    );
                    
                    -- Mettre à jour service_data
                    service_data := jsonb_set(
                        service_data,
                        '{produits}',
                        produits_obj
                    );
                    
                    -- Sauvegarder dans la base
                    UPDATE services
                    SET data = service_data,
                        updated_at = NOW()
                    WHERE id = service_record.service_id;
                    
                    updated_count := updated_count + 1;
                    
                    IF updated_count % 100 = 0 THEN
                        RAISE NOTICE 'Services mis à jour: %', updated_count;
                    END IF;
                END IF;
            END IF;
        END IF;
    END LOOP;
    
    RAISE NOTICE 'Migration terminée: % services mis à jour avec description', updated_count;
END $$;

-- Nettoyer la fonction temporaire
DROP FUNCTION IF EXISTS extract_description_from_full_vector(TEXT[]);

-- Vérification
SELECT 
    COUNT(*) as total_services_avec_produits,
    COUNT(*) FILTER (
        WHERE data->'produits'->'valeur'->0->>'description' IS NOT NULL 
        AND data->'produits'->'valeur'->0->>'description' != ''
    ) as services_avec_description
FROM services
WHERE is_active = true
AND data->'produits' IS NOT NULL
AND jsonb_typeof(data->'produits') = 'object'
AND data->'produits'->>'type_donnee' = 'listeproduit'
AND jsonb_array_length(data->'produits'->'valeur') > 0;

