-- Test de la fonction search_images_by_metadata
-- Base de données: yukpo_db

SELECT * FROM search_images_by_metadata('{"format": "PNG", "width": 10, "height": 10, "file_size": 76}', 5); 