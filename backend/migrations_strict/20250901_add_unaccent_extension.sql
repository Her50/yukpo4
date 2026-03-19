-- Migration pour activer l'extension unaccent pour la gestion des accents
-- Date: 2025-01-09
-- Description: Active l'extension unaccent de PostgreSQL pour permettre la recherche insensible aux accents

-- Activer l'extension unaccent
CREATE EXTENSION IF NOT EXISTS "unaccent";

-- Vérifier que l'extension est bien activée
SELECT extname FROM pg_extension WHERE extname = 'unaccent';

-- Test de la fonction unaccent
SELECT unaccent('crêpe') as test_unaccent; 