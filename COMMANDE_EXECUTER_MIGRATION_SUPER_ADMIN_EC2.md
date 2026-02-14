# 🔧 Exécution Migration Super Admin - EC2

## 📋 Commande pour exécuter la migration mise à jour sur EC2

Cette commande exécute la migration `20260104_apply_delivery_partners_migrations.sql` qui inclut maintenant `super_admin` dans la contrainte CHECK avec idempotence.

---

## ✅ Commande Complète (Copier-Coller)

```bash
PGPASSWORD="PYvHBVetTuWIKNkXgqJcFiU48D39SLwd" psql -h yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com -p 5432 -U yukpo_admin -d yukpo -f backend/migrations/20260104_apply_delivery_partners_migrations.sql
```

---

## ⚠️ Note Importante

Si le fichier de migration n'est pas disponible sur EC2, vous pouvez :

### Option 1 : Exécuter uniquement la partie super_admin (idempotente)

```bash
PGPASSWORD="PYvHBVetTuWIKNkXgqJcFiU48D39SLwd" psql -h yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com -p 5432 -U yukpo_admin -d yukpo << 'EOFSQL'
-- Mise a jour de la contrainte CHECK pour inclure super_admin (idempotent)
DO $$
DECLARE
    constraint_def TEXT;
    constraint_exists BOOLEAN;
BEGIN
    -- Verifier si la contrainte existe deja
    SELECT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'users_role_check' 
        AND conrelid = 'users'::regclass
    ) INTO constraint_exists;
    
    IF constraint_exists THEN
        -- Recuperer la definition actuelle de la contrainte
        SELECT pg_get_constraintdef(oid) INTO constraint_def
        FROM pg_constraint
        WHERE conname = 'users_role_check' 
        AND conrelid = 'users'::regclass;
        
        -- Si la contrainte ne contient pas 'super_admin', on la recree
        IF constraint_def NOT LIKE '%super_admin%' THEN
            ALTER TABLE users DROP CONSTRAINT users_role_check;
            ALTER TABLE users ADD CONSTRAINT users_role_check 
            CHECK (role IN ('user', 'admin', 'super_admin', 'partenaire'));
            RAISE NOTICE 'Contrainte users_role_check mise a jour avec super_admin';
        ELSE
            RAISE NOTICE 'Contrainte users_role_check deja a jour avec super_admin';
        END IF;
    ELSE
        -- La contrainte n'existe pas, on la cree avec tous les roles
        ALTER TABLE users ADD CONSTRAINT users_role_check 
        CHECK (role IN ('user', 'admin', 'super_admin', 'partenaire'));
        RAISE NOTICE 'Contrainte users_role_check creee avec super_admin et partenaire';
    END IF;
EXCEPTION
    WHEN duplicate_object THEN 
        RAISE NOTICE 'Contrainte users_role_check deja presente';
    WHEN OTHERS THEN
        RAISE NOTICE 'Erreur lors de la mise a jour de la contrainte: %', SQLERRM;
END $$;

-- Verification
SELECT 
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conname = 'users_role_check' 
AND conrelid = 'users'::regclass;
EOFSQL
```

### Option 2 : Télécharger la migration depuis GitHub

```bash
# Télécharger la migration mise à jour
curl -H "Authorization: token YOUR_GITHUB_TOKEN" \
  -H "Accept: application/vnd.github.v3.raw" \
  -o /tmp/20260104_apply_delivery_partners_migrations.sql \
  https://api.github.com/repos/VOTRE_USERNAME/yukpomnang2/contents/backend/migrations/20260104_apply_delivery_partners_migrations.sql

# Exécuter la migration
PGPASSWORD="PYvHBVetTuWIKNkXgqJcFiU48D39SLwd" psql -h yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com -p 5432 -U yukpo_admin -d yukpo -f /tmp/20260104_apply_delivery_partners_migrations.sql
```

---

## ✅ Vérification Après Exécution

```bash
PGPASSWORD="PYvHBVetTuWIKNkXgqJcFiU48D39SLwd" psql -h yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com -p 5432 -U yukpo_admin -d yukpo -c "
SELECT 
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conname = 'users_role_check' 
AND conrelid = 'users'::regclass;
"
```

**Résultat attendu** :
```
constraint_name      | constraint_definition
---------------------+--------------------------------------------------------
users_role_check     | CHECK (role IN ('user', 'admin', 'super_admin', 'partenaire'))
```

---

## 🔍 Caractéristiques de la Migration

### ✅ Idempotence

La migration est **100% idempotente** :
- Vérifie si la contrainte existe déjà
- Vérifie si elle contient déjà `super_admin`
- Ne modifie que si nécessaire
- Peut être exécutée plusieurs fois sans erreur

### ✅ Sécurité

- Gestion des exceptions (`EXCEPTION WHEN duplicate_object`)
- Messages informatifs avec `RAISE NOTICE`
- Vérification avant modification

---

## 📝 Notes

1. **La migration est sûre** : Elle peut être exécutée plusieurs fois sans problème
2. **Pas de perte de données** : Les utilisateurs existants ne sont pas affectés
3. **Compatibilité** : Compatible avec les bases existantes (ajoute seulement `super_admin`)

---

## 🚨 En Cas d'Erreur

Si vous obtenez une erreur, vérifiez :

1. **Connexion à la base** : Vérifiez que les credentials sont corrects
2. **Permissions** : Vérifiez que l'utilisateur `yukpo_admin` a les permissions nécessaires
3. **Contrainte existante** : Vérifiez l'état actuel de la contrainte avec la commande de vérification ci-dessus

