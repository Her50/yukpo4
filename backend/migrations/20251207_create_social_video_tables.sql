-- ✅ Migration : Tables pour fonctionnalités sociales vidéo
-- Date: 2025-12-07
-- Description: Crée les tables pour duets, remixes, stitches et réactions vidéo

-- 1. Table duets (duos vidéo)
CREATE TABLE IF NOT EXISTS duets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    original_video_id UUID NOT NULL,
    duet_video_url TEXT NOT NULL,
    creator_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_duets_original_video ON duets(original_video_id);
CREATE INDEX IF NOT EXISTS idx_duets_creator ON duets(creator_id);
CREATE INDEX IF NOT EXISTS idx_duets_created_at ON duets(created_at);

-- 2. Table remixes (remix vidéo)
CREATE TABLE IF NOT EXISTS remixes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    original_video_id UUID NOT NULL,
    remix_video_url TEXT NOT NULL,
    remix_type TEXT NOT NULL CHECK (remix_type IN ('speed', 'filter', 'effect', 'music', 'other')),
    effects TEXT,
    creator_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_remixes_original_video ON remixes(original_video_id);
CREATE INDEX IF NOT EXISTS idx_remixes_creator ON remixes(creator_id);
CREATE INDEX IF NOT EXISTS idx_remixes_type ON remixes(remix_type);
CREATE INDEX IF NOT EXISTS idx_remixes_created_at ON remixes(created_at);

-- 3. Table stitches (montage vidéo)
CREATE TABLE IF NOT EXISTS stitches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    original_video_id UUID NOT NULL,
    stitched_video_url TEXT NOT NULL,
    start_time DOUBLE PRECISION NOT NULL,
    end_time DOUBLE PRECISION NOT NULL,
    creator_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stitches_original_video ON stitches(original_video_id);
CREATE INDEX IF NOT EXISTS idx_stitches_creator ON stitches(creator_id);
CREATE INDEX IF NOT EXISTS idx_stitches_created_at ON stitches(created_at);

-- 4. Table video_reactions (réactions vidéo)
CREATE TABLE IF NOT EXISTS video_reactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    video_id UUID NOT NULL,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type_reaction TEXT NOT NULL CHECK (type_reaction IN ('like', 'love', 'laugh', 'wow', 'sad', 'angry')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(video_id, user_id, type_reaction)
);

CREATE INDEX IF NOT EXISTS idx_video_reactions_video ON video_reactions(video_id);
CREATE INDEX IF NOT EXISTS idx_video_reactions_user ON video_reactions(user_id);
CREATE INDEX IF NOT EXISTS idx_video_reactions_type ON video_reactions(type_reaction);
CREATE INDEX IF NOT EXISTS idx_video_reactions_created_at ON video_reactions(created_at);

-- Commentaires
COMMENT ON TABLE duets IS 'Duos vidéo - utilisateurs créent des vidéos côte à côte';
COMMENT ON TABLE remixes IS 'Remix vidéo - modifications créatives de vidéos originales';
COMMENT ON TABLE stitches IS 'Montages vidéo - extraits de vidéos originales';
COMMENT ON TABLE video_reactions IS 'Réactions émotionnelles aux vidéos';

