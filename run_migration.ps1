 = "88X47ZWBiLkX5WatFcLU4KQ4rgaHYml4"
psql -h dpg-d2t7ntbuibrs73eh9tvg-a.frankfurt-postgres.render.com -U yukpo_db_user -d yukpo_db -c "ALTER TABLE users ADD COLUMN IF NOT EXISTS nom VARCHAR(255);"
