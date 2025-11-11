-- Export des événements wallet livraison (audit QA)
-- Usage : psql -h <host> -U <user> -d <database> -f export_delivery_wallet_events.sql > wallet_audit.csv
\copy (
    SELECT
        dwe.id,
        dwe.created_at,
        dwe.direction,
        dwe.amount_cents,
        dwe.balance_after,
        dwe.reason,
        dwe.user_id,
        u.email AS user_email,
        dwe.delivery_id,
        d.status AS delivery_status,
        d.requested_at,
        dwe.metadata
    FROM delivery_wallet_events dwe
    JOIN users u ON u.id = dwe.user_id
    JOIN deliveries d ON d.id = dwe.delivery_id
    ORDER BY dwe.created_at DESC
) TO STDOUT WITH CSV HEADER;

