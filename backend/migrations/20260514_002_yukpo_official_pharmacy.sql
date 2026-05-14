-- Yukpo Pharmacie — pharmacie officielle Yukpo accessible aux comptes admin
-- pour tester l'upload de produits, la recherche médicament, le scan ordonnance.
--
-- Différences vs Yukpo Librairie : pas de user/email dédié, on rattache la
-- pharmacie au PREMIER super_admin existant (admin@yukpo.dev) ET on autorise
-- TOUS les utilisateurs avec role='admin'/'super_admin' à la modifier via un
-- bypass dans le check d'autorisation backend.
--
-- L'identifiant officiel se reconnaît au flag `is_official=true` sur la table
-- pharmacies. Le backend expose ensuite GET /api/admin/pharmacie/yukpo-official
-- qui retourne le service_id pour que le frontend admin puisse ouvrir la page
-- dashboard.

-- 1) Colonne is_official sur la table pharmacies
ALTER TABLE pharmacies ADD COLUMN IF NOT EXISTS is_official BOOLEAN NOT NULL DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_pharmacies_is_official ON pharmacies(is_official) WHERE is_official = TRUE;

-- 2) Création du service + pharmacie officielle (idempotent)
-- On utilise le premier super_admin/admin disponible comme propriétaire technique.
-- Si aucun admin n'existe en BD (cas d'un environnement vierge), on logge un
-- WARNING (via RAISE NOTICE) et on saute la création — l'admin sera créé via
-- create_admin_user.rs avant de relancer cette migration manuellement.

DO $$
DECLARE
    v_admin_id INTEGER;
    v_service_id INTEGER;
    v_pharmacy_id INTEGER;
    v_existing INTEGER;
BEGIN
    -- Premier admin disponible (super_admin prioritaire)
    SELECT id INTO v_admin_id
    FROM users
    WHERE role IN ('super_admin', 'admin')
    ORDER BY CASE role WHEN 'super_admin' THEN 0 ELSE 1 END, id ASC
    LIMIT 1;

    IF v_admin_id IS NULL THEN
        RAISE NOTICE '[yukpo_official_pharmacy] Aucun admin trouvé. Création annulée — relancer après seed admin.';
        RETURN;
    END IF;

    -- Si la pharmacie officielle existe déjà, on sort
    SELECT id INTO v_existing FROM pharmacies WHERE is_official = TRUE LIMIT 1;
    IF v_existing IS NOT NULL THEN
        RAISE NOTICE '[yukpo_official_pharmacy] Pharmacie officielle déjà créée (id=%)', v_existing;
        RETURN;
    END IF;

    -- Création du service pharmacie. La table services demande un JSONB
    -- `data` obligatoire (champ libre du service côté plateforme), plus la
    -- catégorie et le specialized_type pour matcher les routes pharmacie.
    INSERT INTO services (user_id, data, category, specialized_type, is_active, gps, created_at, updated_at)
    VALUES (
        v_admin_id,
        jsonb_build_object(
            'titre_service', jsonb_build_object('valeur', 'Yukpo Pharmacie (test officiel)'),
            'description', jsonb_build_object('valeur', 'Compte de test géré par les administrateurs Yukpo. Ne dispense pas de médicaments réels.'),
            'category', jsonb_build_object('valeur', 'Pharmacie'),
            'is_official', jsonb_build_object('valeur', true)
        ),
        'Pharmacie',
        'pharmacie',
        TRUE,
        '4.0511,9.7679',
        NOW(),
        NOW()
    )
    RETURNING id INTO v_service_id;

    -- Création de la pharmacie officielle
    INSERT INTO pharmacies (
        service_id,
        user_id,
        nom,
        adresse,
        quartier,
        ville,
        gps,
        jours_garde,
        heures_ouverture,
        heures_fermeture,
        permanent_24h,
        telephone,
        whatsapp,
        email,
        services,
        is_active,
        is_official,
        created_at,
        updated_at
    ) VALUES (
        v_service_id,
        v_admin_id,
        'Yukpo Pharmacie (test officiel)',
        'Plateforme Yukpo',
        'Bonanjo',
        'Douala',
        '4.0511,9.7679',
        'Lundi,Mardi,Mercredi,Jeudi,Vendredi,Samedi,Dimanche',
        '00:00:00',
        '23:59:00',
        TRUE,
        '+237600000000',
        '+237600000000',
        'pharmacie@yukpomnang.com',
        ARRAY['Délivrance médicaments', 'Conseil pharmaceutique', 'Stock test'],
        TRUE,
        TRUE,
        NOW(),
        NOW()
    )
    RETURNING id INTO v_pharmacy_id;

    RAISE NOTICE '[yukpo_official_pharmacy] Pharmacie officielle créée : id=%, service_id=%, owner_user_id=%',
        v_pharmacy_id, v_service_id, v_admin_id;
END
$$;
