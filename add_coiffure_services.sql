-- Ajout des services de coiffure manquants en base PostgreSQL
-- Basé sur les IDs trouvés dans Pinecone

INSERT INTO services (id, user_id, data, is_active, created_at) VALUES 
(599507, 1, '{
  "titre_service": {
    "valeur": "Salon de coiffure moderne",
    "type_donnee": "string",
    "origine_champs": "synchronisation"
  },
  "category": {
    "valeur": "Coiffure",
    "type_donnee": "string",
    "origine_champs": "synchronisation"
  },
  "description": {
    "valeur": "Salon de coiffure offrant des coupes modernes et des services de coloration",
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

INSERT INTO services (id, user_id, data, is_active, created_at) VALUES 
(134380, 1, '{
  "titre_service": {
    "valeur": "Coiffure à domicile",
    "type_donnee": "string",
    "origine_champs": "synchronisation"
  },
  "category": {
    "valeur": "Beauté et soins personnels",
    "type_donnee": "string",
    "origine_champs": "synchronisation"
  },
  "description": {
    "valeur": "Un coiffeur professionnel se déplace chez vous pour réaliser la coupe ou le style de votre choix",
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

INSERT INTO services (id, user_id, data, is_active, created_at) VALUES 
(577379, 1, '{
  "titre_service": {
    "valeur": "Salon de coiffure à Ebolowa",
    "type_donnee": "string",
    "origine_champs": "synchronisation"
  },
  "category": {
    "valeur": "Coiffure",
    "type_donnee": "string",
    "origine_champs": "synchronisation"
  },
  "description": {
    "valeur": "Salon de coiffure \"Stylish Cuts\" situé au centre-ville d''Ebolowa, réputé pour ses services de qualité",
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

INSERT INTO services (id, user_id, data, is_active, created_at) VALUES 
(518870, 1, '{
  "titre_service": {
    "valeur": "Salon de coiffure mixte à Ebolowa",
    "type_donnee": "string",
    "origine_champs": "synchronisation"
  },
  "category": {
    "valeur": "Services de coiffure",
    "type_donnee": "string",
    "origine_champs": "synchronisation"
  },
  "description": {
    "valeur": "Salon mixte situé à Ebolowa proposant des services de coiffure pour hommes et femmes, incluant coupes, colorations, et soins capillaires",
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
WHERE id IN (599507, 134380, 577379, 518870)
ORDER BY id; 