-- Migration pour ajouter les colonnes nom et photo de profil aux utilisateurs
-- Date: 2025-08-30

-- Ajouter les colonnes nom et photo à la table users
ALTER TABLE users ADD COLUMN IF NOT EXISTS nom VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS prenom VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS nom_complet VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS photo_profil VARCHAR(500);
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(500);

-- Mettre à jour les utilisateurs existants avec des noms par défaut basés sur l'email
UPDATE users 
SET nom_complet = COALESCE(
    nom_complet, 
    split_part(email, '@', 1)
)
WHERE nom_complet IS NULL;

-- Mettre à jour les avatars par défaut pour les utilisateurs existants
UPDATE users 
SET avatar_url = COALESCE(
    avatar_url,
    'https://ui-avatars.com/api/?name=' || 
    COALESCE(nom_complet, split_part(email, '@', 1)) ||
    '&background=random&color=fff&size=200'
)
WHERE avatar_url IS NULL;

-- Créer des index pour les recherches
CREATE INDEX IF NOT EXISTS idx_users_nom_complet ON users(nom_complet);
CREATE INDEX IF NOT EXISTS idx_users_photo_profil ON users(photo_profil);
CREATE INDEX IF NOT EXISTS idx_users_avatar_url ON users(avatar_url);

-- Commentaires sur la table
COMMENT ON COLUMN users.nom IS 'Nom de famille de l''utilisateur';
COMMENT ON COLUMN users.prenom IS 'Prénom de l''utilisateur';
COMMENT ON COLUMN users.nom_complet IS 'Nom complet de l''utilisateur (nom + prénom ou nom unique)';
COMMENT ON COLUMN users.photo_profil IS 'Chemin vers la photo de profil stockée localement';
COMMENT ON COLUMN users.avatar_url IS 'URL vers l''avatar de l''utilisateur (local ou externe)'; 