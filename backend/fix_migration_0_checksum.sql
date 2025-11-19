-- Script SQL pour corriger le checksum de la migration 0
-- À exécuter sur la base Render avant de relancer sqlx migrate run

-- Le nouveau checksum doit être calculé avec:
-- sha256sum migrations/0000_create_all_tables.sql | awk '{print $1}'
-- Ou sur Windows PowerShell:
-- Get-FileHash -Path "migrations\0000_create_all_tables.sql" -Algorithm SHA256 | Select-Object -ExpandProperty Hash

-- Pour obtenir le checksum actuel:
SELECT version, description, encode(checksum, 'hex') as checksum_hex 
FROM _sqlx_migrations 
WHERE version = 0;

-- Calculer et mettre à jour le checksum (remplacer 'NOUVEAU_CHECKSUM_HEX' par le vrai checksum)
-- UPDATE _sqlx_migrations 
-- SET checksum = decode('NOUVEAU_CHECKSUM_HEX', 'hex')
-- WHERE version = 0;

-- Vérifier après mise à jour:
-- SELECT version, description, encode(checksum, 'hex') as checksum_hex 
-- FROM _sqlx_migrations 
-- WHERE version = 0;

