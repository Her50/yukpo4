CREATE INDEX IF NOT EXISTS idx_live_flash_sales_session ON live_flash_sales(live_session_id);
SELECT 'session index created' AS result;
