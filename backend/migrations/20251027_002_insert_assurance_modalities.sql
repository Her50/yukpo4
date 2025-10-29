-- Migration: Insertion modalités par défaut pour Assurance
-- Date: 2025-10-27
-- Description: Insère les modalités de base pour la catégorie Assurance (VIE/NON VIE)
-- Note: Compatible avec SQLx offline mode

-- Insérer les modalités par défaut pour assurance
DO $$ BEGIN
    -- Vérifier si la table custom_modalities existe
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'custom_modalities') THEN
        
        -- Types d'assurance (VIE / NON VIE)
        INSERT INTO custom_modalities (product_type, field_name, modality, added_by, usage_count) VALUES
        ('assurance', 'types_assurance', 'VIE', 'system', 100),
        ('assurance', 'types_assurance', 'NON VIE', 'system', 100),
        
        -- Produits VIE
        ('assurance', 'produits_vie', 'Assurance Vie Entière', 'system', 20),
        ('assurance', 'produits_vie', 'Assurance Vie Temporaire', 'system', 18),
        ('assurance', 'produits_vie', 'Assurance Décès', 'system', 15),
        ('assurance', 'produits_vie', 'Assurance Épargne', 'system', 14),
        ('assurance', 'produits_vie', 'Assurance Retraite', 'system', 12),
        ('assurance', 'produits_vie', 'Assurance Éducation', 'system', 10),
        
        -- Produits NON VIE (les plus courants)
        ('assurance', 'produits_non_vie', 'Assurance Automobile', 'system', 50),
        ('assurance', 'produits_non_vie', 'Assurance Auto Tous Risques', 'system', 40),
        ('assurance', 'produits_non_vie', 'Assurance Auto Au Tiers', 'system', 35),
        ('assurance', 'produits_non_vie', 'Assurance Habitation', 'system', 30),
        ('assurance', 'produits_non_vie', 'Assurance Santé / Maladie', 'system', 28),
        ('assurance', 'produits_non_vie', 'Assurance Hospitalisation', 'system', 25),
        ('assurance', 'produits_non_vie', 'Assurance Voyage', 'system', 20),
        ('assurance', 'produits_non_vie', 'Assurance Moto', 'system', 18),
        
        -- Compagnies camerounaises
        ('assurance', 'compagnies', 'ACTIVA Assurances', 'system', 25),
        ('assurance', 'compagnies', 'AXA Assurances Cameroun', 'system', 24),
        ('assurance', 'compagnies', 'ALLIANZ Cameroun', 'system', 23),
        ('assurance', 'compagnies', 'SAHAM Assurance', 'system', 22),
        ('assurance', 'compagnies', 'NSIA Assurances', 'system', 21),
        ('assurance', 'compagnies', 'SUNU Assurances', 'system', 20),
        ('assurance', 'compagnies', 'CHANAS Assurance', 'system', 18),
        ('assurance', 'compagnies', 'UBA Assurance', 'system', 16),
        ('assurance', 'compagnies', 'ARO Assurance', 'system', 15),
        ('assurance', 'compagnies', 'Beneficial Life', 'system', 14),
        
        -- Couvertures populaires
        ('assurance', 'couvertures', 'Tous risques', 'system', 40),
        ('assurance', 'couvertures', 'Responsabilité Civile (Au tiers)', 'system', 35),
        ('assurance', 'couvertures', 'Assistance 24h/24', 'system', 30),
        ('assurance', 'couvertures', 'Hospitalisation', 'system', 28),
        ('assurance', 'couvertures', 'Capital décès', 'system', 25),
        
        -- Bénéfices populaires
        ('assurance', 'benefices', 'Indemnisation rapide', 'system', 35),
        ('assurance', 'benefices', 'Assistance 24h/24', 'system', 30),
        ('assurance', 'benefices', 'Protection famille', 'system', 28),
        ('assurance', 'benefices', 'Capital garanti', 'system', 25),
        
        -- Options contrat
        ('assurance', 'options_contrat', 'Formule Basique', 'system', 20),
        ('assurance', 'options_contrat', 'Formule Standard', 'system', 22),
        ('assurance', 'options_contrat', 'Formule Premium', 'system', 18),
        
        -- Durées
        ('assurance', 'durees', '12 mois', 'system', 40),
        ('assurance', 'durees', '24 mois', 'system', 25),
        ('assurance', 'durees', '36 mois', 'system', 20),
        ('assurance', 'durees', '5 ans', 'system', 15),
        
        -- Modes de paiement
        ('assurance', 'modes_paiement', 'Mensuel', 'system', 35),
        ('assurance', 'modes_paiement', 'Annuel', 'system', 30),
        ('assurance', 'modes_paiement', 'Trimestriel', 'system', 20)
        
        -- Utiliser ON CONFLICT pour éviter les doublons
        ON CONFLICT (product_type, field_name, LOWER(TRIM(modality))) DO NOTHING;
        
        RAISE NOTICE 'Modalités par défaut pour assurance insérées avec succès';
    ELSE
        RAISE NOTICE 'Table custom_modalities n''existe pas encore, migration ignorée';
    END IF;
END $$;







