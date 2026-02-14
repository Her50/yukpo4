# ⚡ Commande Rapide - Mise à Jour Super Admin (EC2)

## 📋 Commande Directe (Copier-Coller)

```bash
PGPASSWORD="PYvHBVetTuWIKNkXgqJcFiU48D39SLwd" psql -h yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com -p 5432 -U yukpo_admin -d yukpo << 'EOFSQL'
DO $$ DECLARE constraint_def TEXT; constraint_exists BOOLEAN; BEGIN SELECT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_role_check' AND conrelid = 'users'::regclass) INTO constraint_exists; IF constraint_exists THEN SELECT pg_get_constraintdef(oid) INTO constraint_def FROM pg_constraint WHERE conname = 'users_role_check' AND conrelid = 'users'::regclass; IF constraint_def NOT LIKE '%super_admin%' THEN ALTER TABLE users DROP CONSTRAINT users_role_check; ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('user', 'admin', 'super_admin', 'partenaire')); RAISE NOTICE 'Contrainte mise a jour avec super_admin'; ELSE RAISE NOTICE 'Contrainte deja a jour'; END IF; ELSE ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('user', 'admin', 'super_admin', 'partenaire')); RAISE NOTICE 'Contrainte creee avec super_admin'; END IF; EXCEPTION WHEN duplicate_object THEN RAISE NOTICE 'Contrainte deja presente'; WHEN OTHERS THEN RAISE NOTICE 'Erreur: %', SQLERRM; END $$;
SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'users_role_check' AND conrelid = 'users'::regclass;
EOFSQL
```

---

## ✅ Vérification Rapide

```bash
PGPASSWORD="PYvHBVetTuWIKNkXgqJcFiU48D39SLwd" psql -h yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com -p 5432 -U yukpo_admin -d yukpo -c "SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'users_role_check' AND conrelid = 'users'::regclass;"
```

**Résultat attendu** :
```
CHECK (role IN ('user', 'admin', 'super_admin', 'partenaire'))
```

