-- Création d'un utilisateur de test pour Yukpo
INSERT INTO users (email, password_hash, role, tokens_balance, created_at, updated_at) 
VALUES (
    'test@yukpo.dev', 
    '$2b$12$LQv3c1yqBwHW.HIbJyTOvOVOSN0P8I4djBDNYo8nP.YIHCz1Y5Gie', 
    'admin', 
    1000, 
    NOW(), 
    NOW()
) 
ON CONFLICT (email) DO UPDATE SET 
    password_hash = EXCLUDED.password_hash,
    role = EXCLUDED.role,
    tokens_balance = EXCLUDED.tokens_balance,
    updated_at = NOW();

-- Vérification
SELECT id, email, role, tokens_balance FROM users WHERE email = 'test@yukpo.dev';
