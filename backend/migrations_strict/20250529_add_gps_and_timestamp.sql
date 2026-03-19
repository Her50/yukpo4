-- Ajout de la colonne gps à la table services
ALTER TABLE services ADD COLUMN IF NOT EXISTS gps TEXT;

-- Ajout de la colonne timestamp à la table service_logs
ALTER TABLE service_logs ADD COLUMN IF NOT EXISTS timestamp TIMESTAMP DEFAULT NOW();
