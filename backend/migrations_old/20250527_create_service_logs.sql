-- Migration : Création de la table `service_logs`
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'service_logs') THEN
        CREATE TABLE service_logs (
            id SERIAL PRIMARY KEY,
            service_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            modification TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
    END IF;
END $$;