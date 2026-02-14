# Solution - Installation Extension uuid-ossp

**Date**: 2026-02-13  
**Problème**: Extension PostgreSQL `uuid-ossp` manquante - cause du crash du backend

---

## 🎯 PROBLÈME IDENTIFIÉ

L'audit a révélé que **l'extension PostgreSQL `uuid-ossp` est manquante** dans la base de données `yukpo`.

Cette extension est requise par les migrations (voir `backend/migrations/0000_create_all_tables.sql` ligne 2):
```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

**Impact**: Les migrations échouent au démarrage, l'application crash avant d'atteindre `main()`.

---

## ✅ SOLUTION - Installation Manuelle

### Option 1: Via AWS RDS Query Editor (RECOMMANDÉ)

1. **Aller dans AWS RDS Console**
   - Ouvrir https://console.aws.amazon.com/rds/
   - Sélectionner la région: `eu-west-1`

2. **Sélectionner l'instance**
   - Instance: `yukpo-db`
   - Cliquer sur l'instance

3. **Ouvrir Query Editor**
   - Dans l'onglet "Connectivity & security"
   - Cliquer sur "Query Editor" (ou utiliser le bouton "Query Editor" dans la barre d'outils)

4. **Se connecter à la base**
   - Database: `yukpo`
   - Username: `yukpo_admin`
   - Password: `PYvHBVetTuWIKNkXgqJcFiU48D39SLwd`

5. **Exécuter la commande SQL**
   ```sql
   CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
   ```

6. **Vérifier l'installation**
   ```sql
   SELECT extname, extversion FROM pg_extension WHERE extname = 'uuid-ossp';
   ```
   
   Vous devriez voir:
   ```
   extname   | extversion
   ----------+------------
   uuid-ossp | 1.1
   ```

---

### Option 2: Via psql depuis une Instance EC2

Si vous avez accès à une instance EC2 dans le même VPC:

```bash
export PGPASSWORD='PYvHBVetTuWIKNkXgqJcFiU48D39SLwd'
psql -h yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com \
     -U yukpo_admin \
     -d yukpo \
     -c 'CREATE EXTENSION IF NOT EXISTS "uuid-ossp";'
```

---

### Option 3: Via AWS Systems Manager (SSM)

Si vous avez une instance EC2 avec SSM activé:

```bash
aws ssm send-command \
  --instance-ids i-0b9ad404f8d738d04 \
  --document-name "AWS-RunShellScript" \
  --parameters 'commands=["export PGPASSWORD='\''PYvHBVetTuWIKNkXgqJcFiU48D39SLwd'\''", "psql -h yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com -U yukpo_admin -d yukpo -c '\''CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";'\''"]' \
  --region eu-west-1
```

---

## 🔍 VÉRIFICATION

Après l'installation, vérifier que l'extension est bien installée:

```sql
SELECT extname, extversion 
FROM pg_extension 
WHERE extname = 'uuid-ossp';
```

**Résultat attendu**:
```
 extname   | extversion
-----------+------------
 uuid-ossp | 1.1
```

Vérifier également toutes les extensions installées:

```sql
SELECT extname, extversion 
FROM pg_extension 
ORDER BY extname;
```

**Extensions attendues**:
- ✅ plpgsql (1.0)
- ✅ pg_trgm (1.6)
- ✅ pgcrypto (1.3)
- ✅ postgis (3.4.3)
- ✅ unaccent (1.1)
- ✅ vector (0.8.0)
- ✅ **uuid-ossp (1.1)** ← NOUVELLE

---

## 🚀 REDÉMARRAGE DU SERVICE ECS

Une fois l'extension installée, redémarrer le service ECS:

```bash
aws ecs update-service \
  --cluster yukpo-cluster \
  --service yukpo-backend-service \
  --force-new-deployment \
  --region eu-west-1
```

Attendre 1-2 minutes, puis vérifier les logs:

```bash
.\scripts\get_all_logs_complet.ps1
```

---

## ✅ RÉSULTAT ATTENDU

Après l'installation et le redémarrage, vous devriez voir dans les logs:

1. **Logs [MAIN] apparaissent**:
   ```
   [MAIN] 🚀 Application Rust démarre - Point d'entrée atteint
   [MAIN] 🔍 Vérification des variables d'environnement critiques...
   [MAIN] DATABASE_URL: ✅ Présente
   [MAIN] MONGODB_URL: ✅ Présente
   [MAIN] REDIS_URL: ✅ Présente
   [MAIN] JWT_SECRET: ✅ Présente
   ```

2. **Connexion PostgreSQL réussie**:
   ```
   [MAIN] ✅ Connexion PostgreSQL établie (tentative 1/3)
   [MAIN] ✅ Pool PostgreSQL créé avec succès
   ```

3. **Migrations exécutées avec succès**:
   ```
   ✅ Migrations appliquées avec succès
   ```

4. **Serveur HTTP démarre**:
   ```
   [MAIN] 🚀 Serveur HTTP démarre sur http://0.0.0.0:8080
   ```

---

## ⚠️ SI LE PROBLÈME PERSISTE

Si après l'installation de `uuid-ossp` le problème persiste:

1. **Vérifier les permissions**
   - L'utilisateur `yukpo_admin` doit avoir les permissions pour créer des extensions
   - Sur RDS, cela peut nécessiter des permissions spéciales

2. **Vérifier les autres extensions**
   - S'assurer que toutes les extensions requises sont installées
   - Vérifier les logs pour voir quelle migration échoue

3. **Vérifier les logs ECS**
   - Examiner les logs stderr pour les panics Rust
   - Vérifier les logs du script `start-cloud.sh`

4. **Alternative: Utiliser pgcrypto**
   - Si `uuid-ossp` n'est pas disponible, utiliser `gen_random_uuid()` de `pgcrypto`
   - Nécessite une modification du code pour remplacer `uuid_generate_v4()`

---

## 📝 NOTES

- **Pourquoi uuid-ossp est manquante?**
  - Sur RDS PostgreSQL 15, certaines extensions peuvent nécessiter des permissions spéciales
  - L'extension doit être créée explicitement dans chaque base de données

- **Alternative à uuid-ossp**
  - PostgreSQL 13+ inclut `gen_random_uuid()` dans `pgcrypto`
  - Mais les migrations utilisent `uuid_generate_v4()` de `uuid-ossp`
  - Il faudrait modifier les migrations pour utiliser `gen_random_uuid()`

---

## ✅ CHECKLIST

- [ ] Installer l'extension `uuid-ossp` dans la base `yukpo`
- [ ] Vérifier que l'extension est installée: `SELECT extname FROM pg_extension WHERE extname = 'uuid-ossp';`
- [ ] Vérifier toutes les extensions requises sont installées
- [ ] Redémarrer le service ECS
- [ ] Vérifier les logs pour confirmer que les logs `[MAIN]` apparaissent
- [ ] Vérifier que l'application démarre correctement
- [ ] Vérifier que les health checks passent

---

**Priorité**: 🔴 **CRITIQUE** - Bloque complètement le démarrage de l'application

**Temps estimé**: 5-10 minutes

