-- Migration : Convertir les produits de format chaîne concaténée vers format JSON structuré
-- Date : 2025-11-24
-- Description : Convertit les produits stockés comme chaînes concaténées dans service.data.produits.valeur
--               vers des objets JSON structurés pour améliorer l'extraction et l'utilisation des données
-- Compatible : SQLx offline mode

-- ============================================================================
-- Fonction helper pour parser une chaîne produit
-- ============================================================================

CREATE OR REPLACE FUNCTION parse_product_string(product_string TEXT)
RETURNS JSONB
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    parts TEXT[];
    result JSONB;
    nom TEXT;
    categorie TEXT;
    description TEXT;
    prix TEXT;
    devise TEXT;
    last_numeric_index INTEGER;
    i INTEGER;
BEGIN
    -- Split par virgule
    parts := string_to_array(product_string, ',');
    
    -- Nettoyer les parties (trim)
    FOR i IN 1..array_length(parts, 1) LOOP
        parts[i] := trim(parts[i]);
    END LOOP;
    
    -- Si pas assez de parties, retourner un objet minimal
    IF array_length(parts, 1) < 2 THEN
        RETURN jsonb_build_object(
            'nom_produit', COALESCE(parts[1], 'Produit'),
            'description_produit', '',
            'prix', '0',
            'devise', 'XAF'
        );
    END IF;
    
    -- Le premier élément est toujours le nom
    nom := parts[1];
    
    -- Le deuxième élément est généralement la catégorie
    categorie := parts[2];
    
    -- Trouver le dernier élément numérique (prix)
    last_numeric_index := NULL;
    FOR i IN array_length(parts, 1) DOWNTO 1 LOOP
        IF parts[i] ~ '^\d+\.?\d*$' THEN
            last_numeric_index := i;
            EXIT;
        END IF;
    END LOOP;
    
    -- Si on a trouvé un prix
    IF last_numeric_index IS NOT NULL THEN
        prix := parts[last_numeric_index];
        
        -- La devise peut être après le prix
        IF last_numeric_index < array_length(parts, 1) THEN
            devise := parts[last_numeric_index + 1];
        ELSE
            devise := 'XAF';
        END IF;
        
        -- La description est tout ce qui est entre la catégorie et le prix
        IF last_numeric_index > 2 THEN
            description := array_to_string(parts[3:last_numeric_index-1], ', ');
        ELSIF array_length(parts, 1) >= 3 THEN
            description := parts[3];
        ELSE
            description := '';
        END IF;
    ELSE
        -- Pas de prix trouvé, tout après la catégorie est la description
        prix := '0';
        devise := 'XAF';
        IF array_length(parts, 1) >= 3 THEN
            description := array_to_string(parts[3:], ', ');
        ELSE
            description := '';
        END IF;
    END IF;
    
    -- Construire l'objet JSON
    result := jsonb_build_object(
        'nom_produit', COALESCE(nom, 'Produit'),
        'categorie_produit', COALESCE(categorie, ''),
        'description_produit', COALESCE(description, ''),
        'prix', COALESCE(prix, '0'),
        'devise', COALESCE(devise, 'XAF')
    );
    
    RETURN result;
END;
$$;

-- ============================================================================
-- Migration principale : Convertir les chaînes en objets JSON
-- ============================================================================

DO $$
DECLARE
    service_record RECORD;
    produits_array JSONB;
    new_produits_array JSONB;
    elem JSONB;
    converted_count INTEGER := 0;
    error_count INTEGER := 0;
    total_to_convert INTEGER;
BEGIN
    -- Compter les services à migrer
    SELECT COUNT(*) INTO total_to_convert
    FROM services
    WHERE jsonb_typeof(data->'produits'->'valeur') = 'array'
    AND EXISTS (
        SELECT 1
        FROM jsonb_array_elements(data->'produits'->'valeur') AS elem
        WHERE jsonb_typeof(elem) = 'string'
    );
    
    IF total_to_convert = 0 THEN
        RAISE NOTICE '✅ Aucun service à migrer (tous les produits sont déjà en format JSON)';
        RETURN;
    END IF;
    
    RAISE NOTICE '🔄 Début de la migration de % services...', total_to_convert;
    
    -- Parcourir tous les services avec produits en format chaîne
    FOR service_record IN
        SELECT id, data
        FROM services
        WHERE jsonb_typeof(data->'produits'->'valeur') = 'array'
        AND EXISTS (
            SELECT 1
            FROM jsonb_array_elements(data->'produits'->'valeur') AS elem
            WHERE jsonb_typeof(elem) = 'string'
        )
    LOOP
        BEGIN
            produits_array := service_record.data->'produits'->'valeur';
            new_produits_array := '[]'::JSONB;
            
            -- Convertir chaque élément
            FOR elem IN SELECT * FROM jsonb_array_elements(produits_array)
            LOOP
                IF jsonb_typeof(elem) = 'string' THEN
                    -- Convertir la chaîne en objet JSON
                    new_produits_array := new_produits_array || jsonb_build_array(
                        parse_product_string(elem::TEXT)
                    );
                ELSE
                    -- Garder l'objet tel quel
                    new_produits_array := new_produits_array || jsonb_build_array(elem);
                END IF;
            END LOOP;
            
            -- Mettre à jour le service
            UPDATE services
            SET data = jsonb_set(
                data,
                '{produits,valeur}',
                new_produits_array
            ),
            updated_at = NOW()
            WHERE id = service_record.id;
            
            converted_count := converted_count + 1;
            
            IF converted_count % 100 = 0 THEN
                RAISE NOTICE '   ✅ % services migrés...', converted_count;
            END IF;
            
        EXCEPTION WHEN OTHERS THEN
            error_count := error_count + 1;
            RAISE WARNING '   ❌ Erreur lors de la migration du service %: %', service_record.id, SQLERRM;
        END;
    END LOOP;
    
    RAISE NOTICE '✅ Migration terminée!';
    RAISE NOTICE '   - Services migrés avec succès: %', converted_count;
    RAISE NOTICE '   - Erreurs: %', error_count;
    
    -- Vérification finale
    IF error_count > 0 THEN
        RAISE WARNING '⚠️ % erreurs rencontrées lors de la migration', error_count;
    END IF;
END $$;

-- ============================================================================
-- Nettoyage : Supprimer la fonction helper (optionnel)
-- ============================================================================

-- La fonction parse_product_string est conservée pour d'éventuelles migrations futures
-- Si vous souhaitez la supprimer, décommentez la ligne suivante :
-- DROP FUNCTION IF EXISTS parse_product_string(TEXT);

