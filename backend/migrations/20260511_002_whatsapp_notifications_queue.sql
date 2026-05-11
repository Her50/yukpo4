-- ============================================================================
-- Migration 20260511_002 : file d'attente des notifications WhatsApp
-- ============================================================================
-- Au lieu d'envoyer immédiatement via une API tierce (WhatsApp Business API
-- nécessite un compte payant + validation Meta), on consigne ici les notifs
-- à envoyer. Les options de delivery :
--   • mode "deeplink" : un worker admin/cron clique sur le lien wa.me généré
--   • mode "api" : quand une intégration WhatsApp Cloud API sera configurée,
--     un worker daemon consomme la file et envoie via l'API.
--
-- Cette approche permet de capturer TOUS les events maintenant, sans bloquer
-- le produit sur une intégration coûteuse. Le worker peut être branché plus
-- tard sans changer les hooks métier.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS whatsapp_notifications_queue (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    phone TEXT NOT NULL,                -- E.164 ou local, nettoyé au moment de l'envoi
    event_type TEXT NOT NULL,           -- 'troc_match'|'troc_chain'|'credit_available'|'order_delivery'|'season_open'|...
    template_key TEXT NOT NULL,         -- clé i18n pour le template (multi-lang)
    template_vars JSONB NOT NULL DEFAULT '{}',  -- vars d'interpolation { "credit": "2100", "titre": "..." }
    rendered_message TEXT,              -- message rendu (rempli au moment du send pour audit)
    related_livre_id INTEGER,           -- FK soft vers livres_scolaires
    related_commande_id UUID,           -- FK soft vers commandes_mixtes
    status TEXT NOT NULL DEFAULT 'pending',  -- 'pending'|'sent'|'failed'|'skipped'
    deeplink_url TEXT,                  -- url wa.me/<num>?text=<msg> générée
    delivery_mode TEXT NOT NULL DEFAULT 'deeplink',  -- 'deeplink'|'api'
    last_error TEXT,
    attempts INTEGER NOT NULL DEFAULT 0,
    scheduled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wa_notifs_pending
    ON whatsapp_notifications_queue (status, scheduled_at)
    WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_wa_notifs_user
    ON whatsapp_notifications_queue (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_wa_notifs_event
    ON whatsapp_notifications_queue (event_type, created_at DESC);

COMMIT;
