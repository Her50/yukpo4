-- SQLx checksum normalization (SAFE) - generated 2026-03-19T13:08:44
BEGIN;
CREATE TABLE IF NOT EXISTS _sqlx_migrations_checksum_backup (
    backup_id BIGSERIAL PRIMARY KEY,
    backup_ts TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    version BIGINT NOT NULL,
    description TEXT,
    checksum BYTEA,
    success BOOLEAN
);
INSERT INTO _sqlx_migrations_checksum_backup(version, description, checksum, success)
SELECT version, description, checksum, success
FROM _sqlx_migrations
WHERE version IN (1025,20250127,20251127,20251224,20251227);
UPDATE _sqlx_migrations
SET checksum = decode('022824ff592f1205e878d7638648e64197b2aef7c1650db736b7751c6e182f5bca6296efca008a5d2cfe583a4001b67c', 'hex'),
    description = 'create livres scolaires troc'
WHERE version = 1025
  AND description = 'create livres scolaires troc';
UPDATE _sqlx_migrations
SET checksum = decode('de0fad5448aa6061d04027468123af7b7982304af84e563d4114319e89f3fdd1e7f975c451aa5a459bba5a8836f1cf02', 'hex'),
    description = '000001 create user saved addresses'
WHERE version = 20250127
  AND description = '000001 create user saved addresses';
UPDATE _sqlx_migrations
SET checksum = decode('e1efa4d1515f3a6c819e940bf535bcfa34bab025e744412b4a3fd4ec0b7115c351dba2e079b406196c942878a35c3aa8', 'hex'),
    description = '120000 create get product reactions count'
WHERE version = 20251127
  AND description = '120000 create get product reactions count';
UPDATE _sqlx_migrations
SET checksum = decode('4f80349ed5eeb76ec5ace3db4cf4ac60c111230d6ba63deeee4548dfc1082f7d1187abf58916eb6411922ae464936ce1', 'hex'),
    description = 'fix image search relevance and performance'
WHERE version = 20251224
  AND description = 'fix image search relevance and performance';
UPDATE _sqlx_migrations
SET checksum = decode('ef31ad777fe39914789febc71e2b68b39912961e9610d176a03101f7dc437681a23b36e1078fce2c06d15390ad6726f2', 'hex'),
    description = 'ensure search indexes exist'
WHERE version = 20251227
  AND description = 'ensure search indexes exist';
COMMIT;
