-- Script pour créer un utilisateur admin par défaut pour les tests
-- Mot de passe: password123

INSERT INTO users (
    email, 
    password_hash, 
    role, 
    is_provider, 
    tokens_balance, 
    token_price_user, 
    token_price_provider, 
    commission_pct, 
    preferred_lang, 
    created_at, 
    updated_at, 
    gps_consent
)
VALUES (
    'admin@yukpo.dev',
    '$2b$12$LQv3c1yqBwEXfGJp/mGJP.n0O6WkHQcXgN4Oqs/vCXdpWo8H5Zl0G', -- password123 hashed with bcrypt
    'admin',
    true,
    10000,
    1.0,
    0.8,
    0.1,
    'fr',
    NOW(),
    NOW(),
    true
) ON CONFLICT (email) DO UPDATE SET
    password_hash = EXCLUDED.password_hash,
    role = EXCLUDED.role,
    tokens_balance = EXCLUDED.tokens_balance,
    is_provider = EXCLUDED.is_provider,
    updated_at = NOW();
