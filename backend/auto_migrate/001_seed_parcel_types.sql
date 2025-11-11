-- Seed: Types de colis initiaux
-- Executé via auto_migration
\c yukpo_db;

INSERT INTO parcel_types (slug, display_name, description, max_weight_kg, max_volume_cm3, requires_fragile_handling, requires_isothermal, requires_secure_box, requires_document_protection)
VALUES
    ('standard', 'Colis standard', 'Poids et dimensions classiques', 30, 60000, FALSE, FALSE, FALSE, FALSE),
    ('fragile', 'Fragile', 'Verre, électronique, nécessite manutention douce', 20, 40000, TRUE, FALSE, TRUE, FALSE),
    ('volumineux', 'Volumineux', 'Mobilier, gros colis ou charges encombrantes', 80, 250000, FALSE, FALSE, FALSE, FALSE),
    ('medical', 'Médical', 'Colis médicaux sensibles (température contrôlée)', 10, 20000, TRUE, TRUE, TRUE, FALSE),
    ('document', 'Document', 'Documents importants ou confidentiels', 5, 5000, TRUE, FALSE, TRUE, TRUE)
ON CONFLICT (slug) DO NOTHING;

