-- Migration pour réindexer les produits existants dans autocomplete_characteristics
-- Problème: Les produits créés avant la correction de product_addition_controller.rs
-- ne sont pas indexés dans autocomplete_characteristics, donc non trouvables par la recherche
-- Solution: Réindexer tous les produits existants qui ne sont pas encore dans autocomplete_characteristics

-- ✅ ÉTAPE 1: Identifier les services avec produits non indexés
-- On vérifie les services qui ont des produits dans data->produits->valeur
-- mais qui ne sont pas dans autocomplete_characteristics

DO $$
DECLARE
    service_record RECORD;
    produits_array JSONB;
    produit_obj JSONB;
    product_vector TEXT[];
    product_value TEXT;
    identifiant_base_val TEXT := 'produits';
    is_real_product_val BOOLEAN := TRUE;
    usage_count_val INTEGER := 1;
    service_id_val INTEGER;
    product_index INTEGER;
    inserted_count INTEGER := 0;
    skipped_count INTEGER := 0;
BEGIN
    RAISE NOTICE '🔄 Début de la réindexation des produits existants...';
    
    -- Parcourir tous les services actifs avec produits
    FOR service_record IN 
        SELECT 
            s.id as service_id,
            s.data->'produits'->'valeur' as produits_valeur
        FROM services s
        WHERE s.is_active = TRUE
        AND s.data->'produits'->'valeur' IS NOT NULL
        AND jsonb_typeof(s.data->'produits'->'valeur') = 'array'
        AND jsonb_array_length(s.data->'produits'->'valeur') > 0
    LOOP
        service_id_val := service_record.service_id;
        produits_array := service_record.produits_valeur;
        
        -- Parcourir chaque produit dans le tableau
        FOR product_index IN 0..jsonb_array_length(produits_array) - 1 LOOP
            produit_obj := produits_array->product_index;
            
            -- Extraire le nom du produit (peut être dans différents champs)
            product_value := NULL;
            
            -- Essayer différents champs possibles pour le nom du produit
            IF produit_obj ? 'nom_produit' THEN
                product_value := produit_obj->>'nom_produit';
            ELSIF produit_obj ? 'nom' THEN
                product_value := produit_obj->>'nom';
            ELSIF produit_obj ? 'titre' THEN
                product_value := produit_obj->>'titre';
            ELSIF produit_obj ? 'valeur' THEN
                -- Si valeur est une string, l'utiliser directement
                IF jsonb_typeof(produit_obj->'valeur') = 'string' THEN
                    product_value := produit_obj->>'valeur';
                -- Si valeur est un objet, chercher nom_produit dedans
                ELSIF jsonb_typeof(produit_obj->'valeur') = 'object' THEN
                    product_value := produit_obj->'valeur'->>'nom_produit';
                    IF product_value IS NULL THEN
                        product_value := produit_obj->'valeur'->>'nom';
                    END IF;
                END IF;
            END IF;
            
            -- Si on n'a pas trouvé de nom, essayer de construire depuis plusieurs champs
            IF product_value IS NULL OR product_value = '' THEN
                -- Construire depuis marque + modele + categorie si disponibles
                product_value := COALESCE(
                    produit_obj->>'marque',
                    ''
                ) || CASE 
                    WHEN produit_obj->>'marque' IS NOT NULL AND produit_obj->>'modele' IS NOT NULL THEN ' '
                    ELSE ''
                END || COALESCE(
                    produit_obj->>'modele',
                    ''
                ) || CASE 
                    WHEN (produit_obj->>'marque' IS NOT NULL OR produit_obj->>'modele' IS NOT NULL) 
                         AND produit_obj->>'categorie' IS NOT NULL THEN ' '
                    ELSE ''
                END || COALESCE(
                    produit_obj->>'categorie',
                    ''
                );
            END IF;
            
            -- Si toujours pas de valeur, skip ce produit
            IF product_value IS NULL OR product_value = '' OR LENGTH(TRIM(product_value)) = 0 THEN
                skipped_count := skipped_count + 1;
                CONTINUE;
            END IF;
            
            -- Nettoyer la valeur (trim, lowercase pour cohérence)
            product_value := LOWER(TRIM(product_value));
            
            -- Vérifier si ce produit est déjà indexé pour ce service
            IF NOT EXISTS (
                SELECT 1 
                FROM autocomplete_characteristics ac
                WHERE ac.identifiant_base = identifiant_base_val
                AND ac.valeur = product_value
                AND ac.service_id = service_id_val
                AND ac.is_real_product = is_real_product_val
            ) THEN
                -- Insérer dans autocomplete_characteristics
                BEGIN
                    INSERT INTO autocomplete_characteristics (
                        identifiant_base,
                        valeur,
                        service_id,
                        is_real_product,
                        usage_count,
                        created_at,
                        updated_at
                    ) VALUES (
                        identifiant_base_val,
                        product_value,
                        service_id_val,
                        is_real_product_val,
                        usage_count_val,
                        NOW(),
                        NOW()
                    )
                    ON CONFLICT (identifiant_base, valeur, service_id, is_real_product) 
                    DO UPDATE SET
                        usage_count = autocomplete_characteristics.usage_count + 1,
                        updated_at = NOW();
                    
                    inserted_count := inserted_count + 1;
                    
                    -- Log tous les 10 produits pour suivre la progression
                    IF inserted_count % 10 = 0 THEN
                        RAISE NOTICE '✅ % produits réindexés...', inserted_count;
                    END IF;
                EXCEPTION WHEN OTHERS THEN
                    -- Ignorer les erreurs de contrainte ou autres (produit déjà indexé ailleurs)
                    skipped_count := skipped_count + 1;
                END;
            ELSE
                skipped_count := skipped_count + 1;
            END IF;
        END LOOP;
    END LOOP;
    
    RAISE NOTICE '✅ Réindexation terminée: % produits insérés, % produits ignorés (déjà indexés ou invalides)', inserted_count, skipped_count;
END $$;

-- ✅ ÉTAPE 2: Créer/Recréer l'index tsvector si nécessaire pour optimiser la recherche
CREATE INDEX IF NOT EXISTS idx_autocomplete_characteristics_valeur_tsvector 
ON autocomplete_characteristics 
USING GIN (to_tsvector('french', valeur))
WHERE identifiant_base = 'produits' AND is_real_product = TRUE;

-- ✅ ÉTAPE 3: Analyser la table pour mettre à jour les statistiques
ANALYZE autocomplete_characteristics;

-- ✅ ÉTAPE 4: Vérification finale - compter les produits indexés
DO $$
DECLARE
    total_services INTEGER;
    total_products_indexed INTEGER;
    total_products_in_services INTEGER;
BEGIN
    -- Compter les services avec produits
    SELECT COUNT(DISTINCT service_id) INTO total_services
    FROM autocomplete_characteristics
    WHERE identifiant_base = 'produits' AND is_real_product = TRUE;
    
    -- Compter les produits indexés
    SELECT COUNT(*) INTO total_products_indexed
    FROM autocomplete_characteristics
    WHERE identifiant_base = 'produits' AND is_real_product = TRUE;
    
    -- Compter les produits dans services.data
    SELECT COUNT(*) INTO total_products_in_services
    FROM services s,
    LATERAL jsonb_array_elements(s.data->'produits'->'valeur') AS produit
    WHERE s.is_active = TRUE
    AND s.data->'produits'->'valeur' IS NOT NULL
    AND jsonb_typeof(s.data->'produits'->'valeur') = 'array';
    
    RAISE NOTICE '📊 Statistiques finales:';
    RAISE NOTICE '   - Services avec produits indexés: %', total_services;
    RAISE NOTICE '   - Produits indexés dans autocomplete_characteristics: %', total_products_indexed;
    RAISE NOTICE '   - Produits totaux dans services.data: %', total_products_in_services;
END $$;

