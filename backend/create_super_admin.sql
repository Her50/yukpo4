-- Script SQL pour creer l'utilisateur super admin
-- Mot de passe: Hernandez87
-- Le hash sera genere et insere ici

-- Creation ou mise a jour de l'utilisateur super admin
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
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/HS.iK2O',  -- Hash temporaire, sera remplace
    'admin',
    'Super Admin',
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
    role = 'admin',
    nom_complet = EXCLUDED.nom_complet,
    updated_at = NOW();

-- Afficher l'utilisateur cree
SELECT id, email, role, nom_complet, tokens_balance, created_at 
FROM users 
WHERE email = 'admin@yukpo.dev';



