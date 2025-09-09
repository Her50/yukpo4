BEGIN;

-- Service ID: 517896
INSERT INTO services (id, titre, description, category, is_active, user_id, created_at, updated_at)
VALUES (
    517896,
    'Recherche d''une librairie',
    'L''utilisateur cherche une librairie pour acheter ou consulter des livres.',
    'Commerce de détail',
    true,
    1,
    NOW(),
    NOW()
) ON CONFLICT (id) DO UPDATE SET
    titre = EXCLUDED.titre,
    description = EXCLUDED.description,
    category = EXCLUDED.category,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();

-- Service ID: 559614
INSERT INTO services (id, titre, description, category, is_active, user_id, created_at, updated_at)
VALUES (
    559614,
    'Recherche d''une librairie',
    'L''utilisateur cherche une librairie pour acheter ou consulter des livres.',
    'Commerce de détail',
    true,
    1,
    NOW(),
    NOW()
) ON CONFLICT (id) DO UPDATE SET
    titre = EXCLUDED.titre,
    description = EXCLUDED.description,
    category = EXCLUDED.category,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();

-- Service ID: 896775
INSERT INTO services (id, titre, description, category, is_active, user_id, created_at, updated_at)
VALUES (
    896775,
    'Librairie',
    'Librairie offrant une large gamme de livres, fournitures scolaires et articles de papeterie.',
    'Commerce',
    true,
    1,
    NOW(),
    NOW()
) ON CONFLICT (id) DO UPDATE SET
    titre = EXCLUDED.titre,
    description = EXCLUDED.description,
    category = EXCLUDED.category,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();

-- Service ID: 757789
INSERT INTO services (id, titre, description, category, is_active, user_id, created_at, updated_at)
VALUES (
    757789,
    'Recherche de librairie pour fournitures scolaires',
    'Je cherche une librairie qui vend des fournitures scolaires.',
    'Commerce de détail',
    true,
    1,
    NOW(),
    NOW()
) ON CONFLICT (id) DO UPDATE SET
    titre = EXCLUDED.titre,
    description = EXCLUDED.description,
    category = EXCLUDED.category,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();

-- Service ID: 235094
INSERT INTO services (id, titre, description, category, is_active, user_id, created_at, updated_at)
VALUES (
    235094,
    'Recherche d''un restaurant',
    'L''utilisateur cherche un restaurant.',
    'Restauration',
    true,
    1,
    NOW(),
    NOW()
) ON CONFLICT (id) DO UPDATE SET
    titre = EXCLUDED.titre,
    description = EXCLUDED.description,
    category = EXCLUDED.category,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();

-- Service ID: 681447
INSERT INTO services (id, titre, description, category, is_active, user_id, created_at, updated_at)
VALUES (
    681447,
    'Recherche d''un plombier',
    'Je cherche un plombier pour des réparations ou installations de plomberie.',
    'Plomberie',
    true,
    1,
    NOW(),
    NOW()
) ON CONFLICT (id) DO UPDATE SET
    titre = EXCLUDED.titre,
    description = EXCLUDED.description,
    category = EXCLUDED.category,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();

-- Service ID: 531974
INSERT INTO services (id, titre, description, category, is_active, user_id, created_at, updated_at)
VALUES (
    531974,
    'Recherche d''un plombier',
    'L''utilisateur cherche un plombier pour des travaux ou des réparations.',
    'Plomberie',
    true,
    1,
    NOW(),
    NOW()
) ON CONFLICT (id) DO UPDATE SET
    titre = EXCLUDED.titre,
    description = EXCLUDED.description,
    category = EXCLUDED.category,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();

-- Service ID: 106740
INSERT INTO services (id, titre, description, category, is_active, user_id, created_at, updated_at)
VALUES (
    106740,
    'Vente de fournitures scolaires',
    'Service de vente de fournitures scolaires incluant stylos, cahiers, ardoises, gommes, règles, compas et crayons.',
    'librairie',
    true,
    1,
    NOW(),
    NOW()
) ON CONFLICT (id) DO UPDATE SET
    titre = EXCLUDED.titre,
    description = EXCLUDED.description,
    category = EXCLUDED.category,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();

-- Service ID: 697714
INSERT INTO services (id, titre, description, category, is_active, user_id, created_at, updated_at)
VALUES (
    697714,
    'Recherche d''un plombier',
    'L''utilisateur cherche un plombier pour des travaux ou réparations.',
    'Plomberie',
    true,
    1,
    NOW(),
    NOW()
) ON CONFLICT (id) DO UPDATE SET
    titre = EXCLUDED.titre,
    description = EXCLUDED.description,
    category = EXCLUDED.category,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();

-- Service ID: 773325
INSERT INTO services (id, titre, description, category, is_active, user_id, created_at, updated_at)
VALUES (
    773325,
    'Recherche d''un peintre professionnel',
    'Je cherche un peintre pour réaliser des travaux de peinture intérieure dans ma maison.',
    'Peinture et décoration',
    true,
    1,
    NOW(),
    NOW()
) ON CONFLICT (id) DO UPDATE SET
    titre = EXCLUDED.titre,
    description = EXCLUDED.description,
    category = EXCLUDED.category,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();

COMMIT;

-- Vérifier les services insérés
SELECT 'Services insérés avec succès!' as info;
SELECT COUNT(*) as total_services FROM services WHERE is_active = true;

