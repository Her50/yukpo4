-- ✅ Script pour créer ou mettre à jour un compte admin
-- Usage: psql -h hostname -U username -d database -f create_admin.sql

-- Option 1: Mettre à jour un utilisateur existant en admin
-- Remplacez 'votre-email@example.com' par l'email de votre compte
UPDATE users 
SET role = 'admin' 
WHERE email = 'votre-email@example.com';

-- Option 2: Créer un nouvel utilisateur admin
-- Remplacez les valeurs ci-dessous
INSERT INTO users (
    email,
    password_hash, -- ⚠️ Vous devez hasher le mot de passe avec bcrypt
    nom_complet,
    role,
    is_verified,
    created_at
) VALUES (
    'admin@yukpomnang.com',
    '$2b$10$VotreHashBcryptIci', -- ⚠️ Générer avec: bcrypt.hash('votre_mot_de_passe', 10)
    'Administrateur Yukpomnang',
    'admin',
    true,
    NOW()
)
ON CONFLICT (email) DO UPDATE SET role = 'admin';

-- Option 3: Vérifier les admins existants
SELECT id, email, nom_complet, role, is_verified, created_at 
FROM users 
WHERE role = 'admin';

