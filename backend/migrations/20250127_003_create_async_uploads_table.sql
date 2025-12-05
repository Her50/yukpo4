-- Migration: Table pour uploads asynchrones
-- Date: 2025-01-27
-- Description: Permet le suivi des uploads asynchrones avec statut en temps réel

CREATE TABLE IF NOT EXISTS async_uploads (
    id SERIAL PRIMARY KEY,
    upload_id TEXT UNIQUE NOT NULL,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    file_type TEXT NOT NULL,
    status TEXT NOT NULL, -- JSON string de UploadStatus
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_async_uploads_user_id ON async_uploads(user_id);
CREATE INDEX IF NOT EXISTS idx_async_uploads_upload_id ON async_uploads(upload_id);
CREATE INDEX IF NOT EXISTS idx_async_uploads_status ON async_uploads(status) WHERE status LIKE '%"Pending"%' OR status LIKE '%"Processing"%';

COMMENT ON TABLE async_uploads IS 'Table pour suivre les uploads asynchrones de fichiers volumineux avec statut en temps réel';
COMMENT ON COLUMN async_uploads.status IS 'Statut JSON de l''upload (Pending, Processing, Uploading, Completed, Failed)';
COMMENT ON COLUMN async_uploads.upload_id IS 'Identifiant unique de l''upload (UUID)';

