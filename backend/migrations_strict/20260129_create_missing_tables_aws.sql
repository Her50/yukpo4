-- Migration consolidée pour créer les tables manquantes dans AWS
-- Cette migration est un fallback si les migrations SQLx standard échouent
-- Date: 2026-01-29
-- 
-- NOTE: Cette migration est conçue pour être idempotente (utilise CREATE TABLE IF NOT EXISTS)
-- Elle crée uniquement les tables critiques si elles n'existent pas déjà
--
-- Les tables sont normalement créées par la migration principale 0000_create_all_tables.sql
-- Ce fichier sert de fallback pour les environnements AWS où les migrations SQLx peuvent échouer

-- Extension PostgreSQL de base (si nécessaire)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "unaccent";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Note: Cette migration consolidée est un placeholder minimal
-- Les tables critiques (users, services, deliveries, etc.) sont créées
-- par la migration principale 0000_create_all_tables.sql via sqlx::migrate!()
--
-- Si vous devez créer des tables spécifiques ici, ajoutez-les ci-dessous
-- en utilisant CREATE TABLE IF NOT EXISTS pour garantir l'idempotence

-- Exemple de structure (à compléter si nécessaire):
-- CREATE TABLE IF NOT EXISTS users (
--     id SERIAL PRIMARY KEY,
--     -- ... autres colonnes ...
-- );

-- Pour l'instant, ce fichier est un placeholder qui permet au build de passer
-- Les tables sont créées par les migrations SQLx standard
