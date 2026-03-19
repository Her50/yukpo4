-- Migration: Ajout du champ groupe_sanguin dans la table users
-- Date: 2025-11-27
-- Description: Permet de stocker le groupe sanguin directement dans users (optionnel)
--              pour faciliter le matching et proposer de le renseigner lors d'une réponse favorable

-- Ajouter colonne groupe_sanguin (optionnelle)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='users' AND column_name='groupe_sanguin') THEN
        ALTER TABLE users ADD COLUMN groupe_sanguin VARCHAR(5) 
            CHECK (groupe_sanguin IS NULL OR groupe_sanguin IN ('O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'));
    END IF;
END $$;

-- Index pour recherche rapide
CREATE INDEX IF NOT EXISTS idx_users_blood_group ON users(groupe_sanguin) WHERE groupe_sanguin IS NOT NULL;

-- Commentaire
COMMENT ON COLUMN users.groupe_sanguin IS 'Groupe sanguin de l''utilisateur (optionnel). Peut être renseigné volontairement lors d''une réponse favorable à une notification de don de sang.';

