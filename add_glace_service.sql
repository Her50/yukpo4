-- Ajout du service de glace italienne manquant
-- Basé sur l'ID trouvé dans Pinecone (733222)

INSERT INTO services (id, user_id, data, is_active, created_at) VALUES 
(733222, 1, '{
  "titre_service": {
    "valeur": "Glacier italien - Gelato Artisanale",
    "type_donnee": "string",
    "origine_champs": "synchronisation"
  },
  "category": {
    "valeur": "Restauration",
    "type_donnee": "string",
    "origine_champs": "synchronisation"
  },
  "description": {
    "valeur": "Glacier spécialisé dans les glaces italiennes artisanales. Nous proposons une large variété de parfums authentiques : vanille, chocolat, fraise, pistache, et bien d''autres. Nos glaces sont préparées quotidiennement avec des ingrédients frais et de qualité.",
    "type_donnee": "string",
    "origine_champs": "synchronisation"
  },
  "is_tarissable": {
    "valeur": false,
    "type_donnee": "boolean",
    "origine_champs": "synchronisation"
  },
  "intention": "creation_service",
  "actif": true
}'::jsonb, true, NOW())
ON CONFLICT (id) DO UPDATE SET 
  data = EXCLUDED.data,
  updated_at = NOW();

-- Vérification
SELECT id, data->>'titre_service' as titre, data->>'category' as category 
FROM services 
WHERE id = 733222; 