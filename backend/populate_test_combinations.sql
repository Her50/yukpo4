-- Script pour peupler autocomplete_combinations avec des données de test
-- Date: 2025-11-04
-- Permet de tester les suggestions dans le formulaire

-- Insérer quelques combinaisons populaires de test
INSERT INTO autocomplete_combinations 
(product_vector, product_labels, usage_count, prix, has_variant, is_ai_preferred)
VALUES 
    -- Smartphones
    (ARRAY['Samsung', 'Galaxy S24', 'Noir', '128GB', 'Neuf'], 
     ARRAY['marque', 'modele', 'couleur', 'stockage', 'etat'],
     15, 450000, false, true),
    
    (ARRAY['Apple', 'iPhone 14 Pro', 'Noir', '256GB', 'Comme neuf'],
     ARRAY['marque', 'modele', 'couleur', 'stockage', 'etat'],
     12, 650000, false, true),
    
    -- Vêtements
    (ARRAY['Nike', 'Air Max', 'Blanc', '42', 'Neuf'],
     ARRAY['marque', 'modele', 'couleur', 'pointure', 'etat'],
     20, 45000, true, true),
    
    (ARRAY['Adidas', 'Superstar', 'Noir', '40', 'Bon état'],
     ARRAY['marque', 'modele', 'couleur', 'pointure', 'etat'],
     8, 35000, true, false),
    
    -- Immobilier
    (ARRAY['Studio', 'Meublé', '1 pièce', 'Climatisé', 'Disponible'],
     ARRAY['type', 'equipement', 'taille', 'confort', 'disponibilite'],
     25, 75000, false, true),
    
    (ARRAY['Appartement', '2 chambres', 'Non meublé', 'Salon', 'Cuisine'],
     ARRAY['type', 'chambres', 'meuble', 'pieces', 'equipement'],
     10, 120000, false, false),
    
    -- Électronique
    (ARRAY['HP', 'Pavilion', '15 pouces', '8GB RAM', 'Windows 11'],
     ARRAY['marque', 'modele', 'taille', 'ram', 'os'],
     6, 350000, false, false),
    
    -- Véhicules
    (ARRAY['Toyota', 'Corolla', '2020', 'Automatique', 'Essence'],
     ARRAY['marque', 'modele', 'annee', 'boite', 'carburant'],
     5, 8500000, false, true)
    
ON CONFLICT (product_vector) 
DO UPDATE SET usage_count = autocomplete_combinations.usage_count + 1;

SELECT '✅ ' || COUNT(*) || ' combinaisons de test insérées' as status
FROM autocomplete_combinations;

