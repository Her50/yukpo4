-- ============================================================
-- Migration: Table notification_schedules
-- Pour programmer des rappels de trajet (covoiturage/taxi)
-- Date: 2026-04-01
-- Idempotente (IF NOT EXISTS)
-- ============================================================

CREATE TABLE IF NOT EXISTS notification_schedules (
    id                  BIGSERIAL PRIMARY KEY,
    user_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reservation_id      INTEGER NOT NULL REFERENCES specialized_reservations(id) ON DELETE CASCADE,
    reminder_minutes    INTEGER NOT NULL CHECK (reminder_minutes > 0),
    status              TEXT NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),
    scheduled_at        TIMESTAMPTZ,
    sent_at             TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, reservation_id, reminder_minutes)
);

CREATE INDEX IF NOT EXISTS idx_notif_schedules_status
    ON notification_schedules (status, scheduled_at)
    WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_notif_schedules_reservation
    ON notification_schedules (reservation_id);
