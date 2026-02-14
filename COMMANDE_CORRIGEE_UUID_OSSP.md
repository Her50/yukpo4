# Commande Corrigée - Installation uuid-ossp

**Erreur**: `syntax error at or near "-"`  
**Cause**: Le nom de l'extension contient un tiret, nécessite des guillemets doubles

---

## ✅ COMMANDE CORRIGÉE

```bash
# Définir le mot de passe
export PGPASSWORD='PYvHBVetTuWIKNkXgqJcFiU48D39SLwd'

# Installer l'extension (avec guillemets doubles)
psql -h yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com \
     -U yukpo_admin \
     -d yukpo \
     -c 'CREATE EXTENSION IF NOT EXISTS "uuid-ossp";'

# Vérifier l'installation
psql -h yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com \
     -U yukpo_admin \
     -d yukpo \
     -c "SELECT extname, extversion FROM pg_extension WHERE extname = 'uuid-ossp';"
```

**Différence**: Utiliser `"uuid-ossp"` avec des guillemets doubles au lieu de `uuid-ossp` sans guillemets.

---

## 📝 EXPLICATION

En PostgreSQL, les identifiants qui contiennent des caractères spéciaux (comme le tiret `-`) doivent être entourés de guillemets doubles.

- ❌ `uuid-ossp` → Erreur de syntaxe
- ✅ `"uuid-ossp"` → Correct

---

## 🔍 VÉRIFICATION

Après l'installation, vous devriez voir:

```
 extname   | extversion
-----------+------------
 uuid-ossp | 1.1
```

Si vous voyez `(0 rows)`, l'extension n'a pas été installée. Réessayez avec les guillemets doubles.

