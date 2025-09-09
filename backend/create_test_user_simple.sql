-- Création d'un utilisateur de test simple
INSERT INTO users (email, password_hash, role, tokens_balance, created_at, updated_at, verified)
VALUES (
    'test@yukpo.dev',
    '$2b$12$LdYm4lMFJj8S2CIFw5FWYeF7j7v7gF7/7zqx7zU7uo7qJ7h7L7g7h7',  -- testpassword123
    'admin',
    1000,
    NOW(),
    NOW(),
    true
)
ON CONFLICT (email) DO UPDATE SET
    tokens_balance = 1000,
    updated_at = NOW();
