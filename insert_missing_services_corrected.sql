BEGIN;

-- Service ID: 517896
INSERT INTO services (id, user_id, data, category, is_active, created_at, updated_at)
VALUES (
    517896,
    1,
    '{"titre": {"type_donnee": "string", "valeur": "Recherche d''une librairie", "origine_champs": "ia"}, "description": {"type_donnee": "string", "valeur": "L''utilisateur cherche une librairie pour acheter ou consulter des livres.", "origine_champs": "texte_libre"}, "category": {"type_donnee": "string", "valeur": "Commerce de détail", "origine_champs": "ia"}}'::jsonb,
    'Commerce de détail',
    true,
    NOW(),
    NOW()
) ON CONFLICT (id) DO UPDATE SET
    data = EXCLUDED.data,
    category = EXCLUDED.category,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();

-- Service ID: 559614
INSERT INTO services (id, user_id, data, category, is_active, created_at, updated_at)
VALUES (
    559614,
    1,
    '{"titre": {"type_donnee": "string", "valeur": "Recherche d''une librairie", "origine_champs": "ia"}, "description": {"type_donnee": "string", "valeur": "L''utilisateur cherche une librairie pour acheter ou consulter des livres.", "origine_champs": "texte_libre"}, "category": {"type_donnee": "string", "valeur": "Commerce de détail", "origine_champs": "ia"}}'::jsonb,
    'Commerce de détail',
    true,
    NOW(),
    NOW()
) ON CONFLICT (id) DO UPDATE SET
    data = EXCLUDED.data,
    category = EXCLUDED.category,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();

-- Service ID: 896775
INSERT INTO services (id, user_id, data, category, is_active, created_at, updated_at)
VALUES (
    896775,
    1,
    '{"titre": {"type_donnee": "string", "valeur": "Librairie", "origine_champs": "ia"}, "description": {"type_donnee": "string", "valeur": "Librairie offrant une large gamme de livres, fournitures scolaires et articles de papeterie.", "origine_champs": "texte_libre"}, "category": {"type_donnee": "string", "valeur": "Commerce", "origine_champs": "ia"}}'::jsonb,
    'Commerce',
    true,
    NOW(),
    NOW()
) ON CONFLICT (id) DO UPDATE SET
    data = EXCLUDED.data,
    category = EXCLUDED.category,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();

-- Service ID: 757789
INSERT INTO services (id, user_id, data, category, is_active, created_at, updated_at)
VALUES (
    757789,
    1,
    '{"titre": {"type_donnee": "string", "valeur": "Recherche de librairie pour fournitures scolaires", "origine_champs": "ia"}, "description": {"type_donnee": "string", "valeur": "Je cherche une librairie qui vend des fournitures scolaires.", "origine_champs": "texte_libre"}, "category": {"type_donnee": "string", "valeur": "Commerce de détail", "origine_champs": "ia"}}'::jsonb,
    'Commerce de détail',
    true,
    NOW(),
    NOW()
) ON CONFLICT (id) DO UPDATE SET
    data = EXCLUDED.data,
    category = EXCLUDED.category,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();

-- Service ID: 235094
INSERT INTO services (id, user_id, data, category, is_active, created_at, updated_at)
VALUES (
    235094,
    1,
    '{"titre": {"type_donnee": "string", "valeur": "Recherche d''un restaurant", "origine_champs": "ia"}, "description": {"type_donnee": "string", "valeur": "L''utilisateur cherche un restaurant.", "origine_champs": "texte_libre"}, "category": {"type_donnee": "string", "valeur": "Restauration", "origine_champs": "ia"}}'::jsonb,
    'Restauration',
    true,
    NOW(),
    NOW()
) ON CONFLICT (id) DO UPDATE SET
    data = EXCLUDED.data,
    category = EXCLUDED.category,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();

-- Service ID: 681447
INSERT INTO services (id, user_id, data, category, is_active, created_at, updated_at)
VALUES (
    681447,
    1,
    '{"titre": {"type_donnee": "string", "valeur": "Recherche d''un plombier", "origine_champs": "ia"}, "description": {"type_donnee": "string", "valeur": "Je cherche un plombier pour des réparations ou installations de plomberie.", "origine_champs": "texte_libre"}, "category": {"type_donnee": "string", "valeur": "Plomberie", "origine_champs": "ia"}}'::jsonb,
    'Plomberie',
    true,
    NOW(),
    NOW()
) ON CONFLICT (id) DO UPDATE SET
    data = EXCLUDED.data,
    category = EXCLUDED.category,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();

-- Service ID: 531974
INSERT INTO services (id, user_id, data, category, is_active, created_at, updated_at)
VALUES (
    531974,
    1,
    '{"titre": {"type_donnee": "string", "valeur": "Recherche d''un plombier", "origine_champs": "ia"}, "description": {"type_donnee": "string", "valeur": "L''utilisateur cherche un plombier pour des travaux ou des réparations.", "origine_champs": "texte_libre"}, "category": {"type_donnee": "string", "valeur": "Plomberie", "origine_champs": "ia"}}'::jsonb,
    'Plomberie',
    true,
    NOW(),
    NOW()
) ON CONFLICT (id) DO UPDATE SET
    data = EXCLUDED.data,
    category = EXCLUDED.category,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();

-- Service ID: 106740
INSERT INTO services (id, user_id, data, category, is_active, created_at, updated_at)
VALUES (
    106740,
    1,
    '{"titre": {"type_donnee": "string", "valeur": "Vente de fournitures scolaires", "origine_champs": "ia"}, "description": {"type_donnee": "string", "valeur": "Service de vente de fournitures scolaires incluant stylos, cahiers, ardoises, gommes, règles, compas et crayons.", "origine_champs": "texte_libre"}, "category": {"type_donnee": "string", "valeur": "librairie", "origine_champs": "ia"}}'::jsonb,
    'librairie',
    true,
    NOW(),
    NOW()
) ON CONFLICT (id) DO UPDATE SET
    data = EXCLUDED.data,
    category = EXCLUDED.category,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();

-- Service ID: 697714
INSERT INTO services (id, user_id, data, category, is_active, created_at, updated_at)
VALUES (
    697714,
    1,
    '{"titre": {"type_donnee": "string", "valeur": "Recherche d''un plombier", "origine_champs": "ia"}, "description": {"type_donnee": "string", "valeur": "L''utilisateur cherche un plombier pour des travaux ou réparations.", "origine_champs": "texte_libre"}, "category": {"type_donnee": "string", "valeur": "Plomberie", "origine_champs": "ia"}}'::jsonb,
    'Plomberie',
    true,
    NOW(),
    NOW()
) ON CONFLICT (id) DO UPDATE SET
    data = EXCLUDED.data,
    category = EXCLUDED.category,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();

-- Service ID: 773325
INSERT INTO services (id, user_id, data, category, is_active, created_at, updated_at)
VALUES (
    773325,
    1,
    '{"titre": {"type_donnee": "string", "valeur": "Recherche d''un peintre professionnel", "origine_champs": "ia"}, "description": {"type_donnee": "string", "valeur": "Je cherche un peintre pour réaliser des travaux de peinture intérieure dans ma maison.", "origine_champs": "texte_libre"}, "category": {"type_donnee": "string", "valeur": "Peinture et décoration", "origine_champs": "ia"}}'::jsonb,
    'Peinture et décoration',
    true,
    NOW(),
    NOW()
) ON CONFLICT (id) DO UPDATE SET
    data = EXCLUDED.data,
    category = EXCLUDED.category,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();

COMMIT;

-- Vérifier les services insérés
SELECT 'Services insérés avec succès!' as info;
SELECT COUNT(*) as total_services FROM services WHERE is_active = true; 