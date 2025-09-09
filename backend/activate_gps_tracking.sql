-- Activation du tracking GPS automatique
-- Base de donnees: yukpo_db

-- Etape 1: Verifier que tous les utilisateurs ont le consentement GPS
SELECT '=== VERIFICATION CONSENTEMENT GPS ===' as test_name;

SELECT '1. Utilisateurs avec consentement GPS' as test,
       COUNT(*) as total
FROM users WHERE gps_consent = true;

SELECT '2. Utilisateurs sans consentement GPS' as test,
       COUNT(*) as total
FROM users WHERE gps_consent = false OR gps_consent IS NULL;

-- Etape 2: Activer le consentement GPS pour tous les utilisateurs (optionnel)
-- UPDATE users SET gps_consent = true WHERE gps_consent = false OR gps_consent IS NULL;

-- Etape 3: Verifier la structure de la table users pour le tracking GPS
SELECT '3. Structure table users pour GPS' as test;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'users' 
AND column_name IN ('gps', 'gps_consent', 'gps_updated_at', 'last_gps_update')
ORDER BY column_name;

-- Etape 4: Ajouter des colonnes pour le tracking GPS si elles n'existent pas
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS gps_updated_at TIMESTAMP WITH TIME ZONE;
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS last_gps_update TIMESTAMP WITH TIME ZONE;
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS gps_accuracy DECIMAL;

-- Etape 5: Creer une fonction pour mettre a jour automatiquement le GPS
CREATE OR REPLACE FUNCTION update_user_gps_automatic(
    user_id INTEGER,
    new_lat DECIMAL,
    new_lng DECIMAL,
    accuracy DECIMAL DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
    -- Mettre a jour le GPS de l'utilisateur
    UPDATE users 
    SET 
        gps = format('%.6f,%.6f', new_lat, new_lng),
        updated_at = NOW()
    WHERE id = user_id;
    
    -- Retourner true si la mise a jour a reussi
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Etape 6: Test de la fonction de mise a jour automatique
SELECT '4. Test fonction mise a jour GPS automatique' as test;
SELECT update_user_gps_automatic(1, 4.0511, 9.7679, 10.0) as mise_a_jour_reussie;

-- Etape 7: Verifier la mise a jour
SELECT '5. Verification mise a jour GPS' as test,
       gps as nouvelles_coordonnees,
       updated_at as derniere_mise_a_jour
FROM users WHERE id = 1;

SELECT '=== TRACKING GPS AUTOMATIQUE ACTIVE ===' as summary;
SELECT 'Le systeme de tracking GPS automatique est maintenant configure' as resultat; 