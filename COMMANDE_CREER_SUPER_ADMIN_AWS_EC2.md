# 🔐 Création Super Admin - Base de données AWS

## 📋 Informations du compte

- **Email** : `admin@yukpo.dev`
- **Mot de passe** : `Hernandez87`
- **Rôle** : `super_admin` (tous les droits)
- **Tokens** : 1,000,000

## ✅ Commande SQL à exécuter depuis EC2

```bash
PGPASSWORD="PYvHBVetTuWIKNkXgqJcFiU48D39SLwd" psql -h yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com -p 5432 -U yukpo_admin -d yukpo << 'EOFSQL'
-- Script pour créer le compte SUPER SUPER ADMIN dans AWS PostgreSQL
-- Email: admin@yukpo.dev
-- Mot de passe: Hernandez87
-- Rôle: super_admin (tous les droits)
-- Hash bcrypt cost 12 pour "Hernandez87": $2b$12$yi.th1fxm9Xrz6A.PjP9wuWyDrueHMZZBReIH7i7X.efPhGNV1Pii

-- Création ou mise à jour de l'utilisateur super super admin
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
    'super_admin',  -- ✅ Rôle super_admin (tous les droits)
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
    role = 'super_admin',  -- ✅ Forcer le rôle super_admin
    nom_complet = EXCLUDED.nom_complet,
    updated_at = NOW();

-- Afficher l'utilisateur créé
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

-- Vérification
SELECT 
    CASE 
        WHEN role = 'super_admin' THEN '✅ Rôle super_admin correct'
        ELSE '⚠️ Rôle: ' || role || ' (devrait être super_admin)'
    END as verification
FROM users 
WHERE email = 'admin@yukpo.dev';
EOFSQL
```

## 📝 Explication

Le script :
1. Crée ou met à jour l'utilisateur `admin@yukpo.dev`
2. Définit le rôle `super_admin` (tous les droits)
3. Définit le mot de passe hashé (bcrypt cost 12)
4. Attribue 1,000,000 tokens
5. Affiche les informations de l'utilisateur créé
6. Vérifie que le rôle est correctement défini

## ⚠️ Sécurité

- Le mot de passe est hashé avec bcrypt (cost 12)
- Le hash est stocké dans la base de données, pas le mot de passe en clair
- Utilisez `ON CONFLICT` pour éviter les doublons

## 🔄 Alternative : Utiliser le fichier SQL directement

Si vous avez accès au fichier `scripts/create_super_admin_aws.sql` sur EC2 :

```bash
PGPASSWORD="PYvHBVetTuWIKNkXgqJcFiU48D39SLwd" psql -h yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com -p 5432 -U yukpo_admin -d yukpo -f /chemin/vers/create_super_admin_aws.sql
```
