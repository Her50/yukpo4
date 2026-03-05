-- 🎯 Table pour le transcodage vidéo HLS/DASH
-- Stocke les métadonnées des vidéos transcoded pour streaming adaptatif

CREATE TABLE IF NOT EXISTS video_transcoding (
    id SERIAL PRIMARY KEY,
    video_id INTEGER NOT NULL UNIQUE REFERENCES media(id) ON DELETE CASCADE,
    
    -- Chemins originaux et transcoded
    original_path TEXT NOT NULL,
    hls_path TEXT NOT NULL,           -- Playlist HLS maître (.m3u8)
    dash_path TEXT NOT NULL,          -- Manifest DASH (.mpd)
    thumbnail_path TEXT NOT NULL,     -- Thumbnail généré
    
    -- Métadonnées qualités (JSON array)
    qualities JSONB NOT NULL DEFAULT '[]'::jsonb,
    
    -- Métadonnées vidéo
    duration_seconds DECIMAL(10,2) NOT NULL,
    file_size_mb DECIMAL(10,2) NOT NULL,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Statut du transcodage
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    error_message TEXT,
    
    -- Index pour performance
    CONSTRAINT video_transcoding_check CHECK (video_id > 0)
);

-- Index pour recherche rapide par video_id
CREATE INDEX IF NOT EXISTS idx_video_transcoding_video_id ON video_transcoding(video_id);

-- Index pour recherche par statut
CREATE INDEX IF NOT EXISTS idx_video_transcoding_status ON video_transcoding(status);

-- Index pour les vidéos récentes
CREATE INDEX IF NOT EXISTS idx_video_transcoding_created_at ON video_transcoding(created_at DESC);

-- Trigger pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_video_transcoding_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER video_transcoding_updated_at_trigger
    BEFORE UPDATE ON video_transcoding
    FOR EACH ROW
    EXECUTE FUNCTION update_video_transcoding_updated_at();

-- Vue pour les vidéos transcoded actives
CREATE OR REPLACE VIEW active_transcoded_videos AS
SELECT 
    vt.video_id,
    vt.hls_path,
    vt.dash_path,
    vt.thumbnail_path,
    vt.qualities,
    vt.duration_seconds,
    vt.file_size_mb,
    vt.created_at,
    m.path as original_media_path,
    m.service_id,
    s.category,
    s.data as service_data
FROM video_transcoding vt
JOIN media m ON m.id = vt.video_id
JOIN services s ON s.id = m.service_id
WHERE vt.status = 'completed'
  AND s.is_active = true
  AND m.type = 'video';

-- Commentaires sur la table
COMMENT ON TABLE video_transcoding IS 'Stocke les métadonnées de transcodage vidéo HLS/DASH pour streaming adaptatif';
COMMENT ON COLUMN video_transcoding.video_id IS 'Référence à la vidéo originale dans la table media';
COMMENT ON COLUMN video_transcoding.hls_path IS 'Chemin vers la playlist HLS maître (.m3u8)';
COMMENT ON COLUMN video_transcoding.dash_path IS 'Chemin vers le manifest DASH (.mpd)';
COMMENT ON COLUMN video_transcoding.qualities IS 'JSON array des qualités disponibles (1080p, 720p, 480p, 360p)';
COMMENT ON COLUMN video_transcoding.duration_seconds IS 'Durée exacte de la vidéo en secondes';
COMMENT ON COLUMN video_transcoding.file_size_mb IS 'Taille totale des fichiers transcodés en MB';
COMMENT ON COLUMN video_transcoding.status IS 'Statut du transcodage: pending, processing, completed, failed';
