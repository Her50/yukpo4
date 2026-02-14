# 🔐 Création Super Admin - Base de données AWS (CORRIGÉE)

## ❌ Problème identifié

La contrainte CHECK `users_role_check` limite les rôles à `('user', 'admin', 'partenaire')` mais le code Rust supporte aussi `super_admin`.

## ✅ Solution : Ajouter `super_admin` à la contrainte puis créer l'utilisateur

```bash
PGPASSWORD="PYvHBVetTuWIKNkXgqJcFiU48D39SLwd" psql -h yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com -p 5432 -U yukpo_admin -d yukpo << 'EOFSQL'
-- ============================================================================
-- ÉTAPE 1 : Ajouter 'super_admin' à la contrainte CHECK
-- ============================================================================
DO $$
BEGIN
    -- Supprimer l'ancienne contrainte si elle existe
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'users_role_check' 
        AND conrelid = 'users'::regclass
    ) THEN
        ALTER TABLE users DROP CONSTRAINT users_role_check;
        RAISE NOTICE 'Ancienne contrainte users_role_check supprimee';
    END IF;
    
    -- Ajouter la nouvelle contrainte avec 'super_admin'
    ALTER TABLE users ADD CONSTRAINT users_role_check 
    CHECK (role IN ('user', 'admin', 'super_admin', 'partenaire'));
    RAISE NOTICE 'Nouvelle contrainte users_role_check ajoutee avec super_admin';
EXCEPTION
    WHEN duplicate_object THEN 
        RAISE NOTICE 'Contrainte deja presente';
END $$;

-- ============================================================================
-- ÉTAPE 2 : Créer ou mettre à jour l'utilisateur super admin
-- ============================================================================
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
    'super_admin',
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
    role = 'super_admin',
    nom_complet = EXCLUDED.nom_complet,
    updated_at = NOW();

-- ============================================================================
-- VÉRIFICATION
-- ============================================================================
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

SELECT 
    CASE 
        WHEN role = 'super_admin' THEN '✅ Rôle super_admin correct'
        ELSE '⚠️ Rôle: ' || role || ' (devrait être super_admin)'
    END as verification
FROM users 
WHERE email = 'admin@yukpo.dev';
EOFSQL
```

## 📋 Informations du compte

- **Email** : `admin@yukpo.dev`
- **Mot de passe** : `Hernandez87`
- **Rôle** : `super_admin` (tous les droits)
- **Tokens** : 1,000,000

## 📝 Explication

1. **Étape 1** : Supprime l'ancienne contrainte CHECK et la recrée avec `super_admin` inclus
2. **Étape 2** : Crée ou met à jour l'utilisateur avec le rôle `super_admin`
3. **Vérification** : Affiche les informations de l'utilisateur créé
