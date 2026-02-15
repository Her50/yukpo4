-- ✅ Migration: Table pour tracking des actions de scaling GPU
-- Date: 2026-02-14
-- Description: Table pour enregistrer les actions de scaling automatique des instances GPU

CREATE TABLE IF NOT EXISTS gpu_scale_actions (
    id SERIAL PRIMARY KEY,
    action VARCHAR(50) NOT NULL,
    instances_from INTEGER NOT NULL,
    instances_to INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Index pour requêtes fréquentes
CREATE INDEX IF NOT EXISTS idx_gpu_scale_actions_created_at ON gpu_scale_actions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gpu_scale_actions_action ON gpu_scale_actions(action);

-- Commentaires
COMMENT ON TABLE gpu_scale_actions IS 'Historique des actions de scaling automatique des instances GPU';
COMMENT ON COLUMN gpu_scale_actions.action IS 'Type d''action: scale_up, scale_down';
COMMENT ON COLUMN gpu_scale_actions.instances_from IS 'Nombre d''instances avant le scaling';
COMMENT ON COLUMN gpu_scale_actions.instances_to IS 'Nombre d''instances après le scaling';

