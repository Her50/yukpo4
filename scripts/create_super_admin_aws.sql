-- Script pour créer le compte SUPER SUPER ADMIN dans AWS PostgreSQL
-- Email: admin@yukpo.dev
-- Mot de passe: Hernandez87
-- Rôle: super_admin (tous les droits)
-- Hash bcrypt cost 12 pour "Hernandez87": $2b$12$yi.th1fxm9Xrz6A.PjP9wuWyDrueHMZZBReIH7i7X.efPhGNV1Pii

-- Création ou mise à jour de l'utilisateur super super admin
INSERT INTO users (
    email, 
    password_hash, 
    role, 
    nom_complet, 
    tokens_balance, 
    token_price_user, 
    token_price_provider, 
    commission_pct, 
    preferred_lang, 
    is_provider, 
    created_at, 
    updated_at
)
VALUES (
    'admin@yukpo.dev',
    '$2b$12$yi.th1fxm9Xrz6A.PjP9wuWyDrueHMZZBReIH7i7X.efPhGNV1Pii',
    'super_admin',  -- ✅ Rôle super_admin (tous les droits)
    'Super Super Admin',
    1000000,
    1.0,
    1.0,
    0.0,
    'fr',
    false,
    NOW(),
    NOW()
)
ON CONFLICT (email) DO UPDATE SET
    password_hash = EXCLUDED.password_hash,
    role = 'super_admin',  -- ✅ Forcer le rôle super_admin
    nom_complet = EXCLUDED.nom_complet,
    updated_at = NOW();

-- Afficher l'utilisateur créé
SELECT 
    id, 
    email, 
    role, 
    nom_complet, 
    tokens_balance, 
    created_at,
    updated_at
FROM users 
WHERE email = 'admin@yukpo.dev';

-- Vérification
SELECT 
    CASE 
        WHEN role = 'super_admin' THEN '✅ Rôle super_admin correct'
        ELSE '⚠️ Rôle: ' || role || ' (devrait être super_admin)'
    END as verification
FROM users 
WHERE email = 'admin@yukpo.dev';

