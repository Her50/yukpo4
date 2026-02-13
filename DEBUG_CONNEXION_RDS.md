# 🔍 Débogage de la Connexion RDS

## ⚠️ Problème

La commande `psql` reste bloquée lors de la connexion à RDS.

## ✅ Tests de Diagnostic

Exécutez ces commandes dans l'ordre pour identifier le problème :

### 1. Vérifier la connectivité réseau

```bash
# Tester si le port 5432 est accessible
nc -zv yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com 5432
```

Ou avec telnet :
```bash
telnet yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com 5432
```

### 2. Vérifier la résolution DNS

```bash
nslookup yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com
```

### 3. Tester la connexion avec timeout

```bash
export PGPASSWORD='PYvHBVetTuWIKNkXgqJcFiU48D39SLwd'
timeout 10 psql -h yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com \
     -U yukpo_admin \
     -d postgres \
     -c "SELECT version();"
```

### 4. Vérifier les security groups

Le security group de RDS doit autoriser les connexions depuis le security group de l'instance EC2.

### 5. Tester avec une connexion interactive

```bash
export PGPASSWORD='PYvHBVetTuWIKNkXgqJcFiU48D39SLwd'
psql -h yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com \
     -U yukpo_admin \
     -d postgres
```

Une fois connecté, exécutez :
```sql
CREATE DATABASE yukpo;
\q
```

