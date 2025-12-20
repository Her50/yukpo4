 = "YOUR_PASSWORD"
psql -h your-render-db-host.render.com -U yukpo_db_user -d yukpo_db -c "ALTER TABLE users ADD COLUMN IF NOT EXISTS nom VARCHAR(255);"
