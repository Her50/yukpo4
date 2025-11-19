UPDATE _sqlx_migrations 
SET checksum = decode('d9868b70afef40490e6cde2e86c3df01eeeaf766d30724327c1df72f3104d598e10f58a1fdec9d450da2bd8f60b7b4db', 'hex') 
WHERE version = 0;

SELECT version, description, encode(checksum, 'hex') as checksum_hex 
FROM _sqlx_migrations 
WHERE version = 0;

