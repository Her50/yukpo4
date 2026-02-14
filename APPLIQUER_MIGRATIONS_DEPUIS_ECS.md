# 🚀 Application des Migrations depuis ECS

**Date**: 2026-02-13  
**Problème**: Base de données RDS dans un VPC privé, non accessible depuis la machine locale  
**Solution**: Exécuter les migrations depuis ECS (via ECS Exec ou au démarrage)

---

## ✅ **RÉSULTAT DE L'EXÉCUTION LOCALE**

Le script `run_migrations_aws_fixed.py` a été exécuté avec succès :

1. ✅ **DATABASE_URL récupérée** depuis Secrets Manager
2. ✅ **sqlx-cli installé** et fonctionnel
3. ✅ **Script de correction créé** (`fix_merchant_storage_locations.sql`)
4. ❌ **Connexion impossible** depuis la machine locale (VPC privé)

**C'est normal !** La base de données RDS est dans un VPC privé et n'est accessible que depuis :
- ✅ ECS (containers)
- ✅ EC2 (instances dans le même VPC)
- ❌ Machine locale (pas d'accès au VPC)

---

## 🎯 **SOLUTION - 3 OPTIONS**

### Option 1: Exécuter via ECS Exec (Recommandé)

**Exécuter directement dans le container ECS** :

```bash
# 1. Récupérer l'ARN de la tâche en cours
TASK_ARN=$(aws ecs list-tasks \
  --cluster yukpo-cluster \
  --service-name yukpo-backend-service \
  --desired-status RUNNING \
  --region eu-west-1 \
  --query 'taskArns[0]' --output text)

# 2. Exécuter le script de correction dans le container
aws ecs execute-command \
  --cluster yukpo-cluster \
  --task "$TASK_ARN" \
  --container backend \
  --command "bash -c 'cd /app && psql \"\$DATABASE_URL\" -f /app/scripts/fix_merchant_storage_locations.sql'" \
  --interactive \
  --region eu-west-1
```

**Puis appliquer les migrations** :

```bash
aws ecs execute-command \
  --cluster yukpo-cluster \
  --task "$TASK_ARN" \
  --container backend \
  --command "bash -c 'cd /app/backend && export DATABASE_URL=\"\$DATABASE_URL\" && sqlx migrate run'" \
  --interactive \
  --region eu-west-1
```

---

### Option 2: Modifier le Script de Démarrage ECS

**Modifier `start-cloud.sh`** pour créer `merchant_storage_locations` avant le démarrage :

```bash
# Ajouter AVANT le lancement de l'exécutable dans start-cloud.sh

# ✅ CRITIQUE: Créer merchant_storage_locations AVANT les migrations
if [ -n "$DATABASE_URL" ]; then
    echo "🔍 Création de merchant_storage_locations si nécessaire..."
    psql "$DATABASE_URL" -f /app/scripts/fix_merchant_storage_locations.sql 2>/dev/null || echo "⚠️ Erreur (peut-être existe déjà)"
fi
```

**Puis commit et push** :

```bash
git add backend/scripts/start-cloud.sh
git commit -m "fix: Créer merchant_storage_locations avant migrations dans start-cloud.sh"
git push
```

**Redémarrer le service ECS** :

```bash
aws ecs update-service \
  --cluster yukpo-cluster \
  --service yukpo-backend-service \
  --force-new-deployment \
  --region eu-west-1
```

---

### Option 3: Utiliser le Script Python depuis ECS

**Copier le script dans l'image Docker** et l'exécuter au démarrage :

1. **Modifier `Dockerfile.cloud`** pour copier le script :

```dockerfile
# Ajouter après COPY backend/target/release/yukpomnang_backend
COPY scripts/run_migrations_aws_fixed.py /app/scripts/
COPY scripts/fix_merchant_storage_locations.sql /app/scripts/
```

2. **Modifier `start-cloud.sh`** pour exécuter le script :

```bash
# Ajouter AVANT le lancement de l'exécutable
if [ -n "$DATABASE_URL" ]; then
    echo "🔍 Exécution des migrations corrigées..."
    python3 /app/scripts/run_migrations_aws_fixed.py || echo "⚠️ Erreur migrations (non bloquant)"
fi
```

3. **Commit, push, rebuild, redéployer**

---

## 📊 **VÉRIFICATION**

### Après Application

**Vérifier que `merchant_storage_locations` existe** :

```bash
aws ecs execute-command \
  --cluster yukpo-cluster \
  --task "$TASK_ARN" \
  --container backend \
  --command "bash -c 'psql \"\$DATABASE_URL\" -c \"SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = '\''merchant_storage_locations'\'');\"'" \
  --interactive \
  --region eu-west-1
```

**Vérifier que les migrations sont appliquées** :

```bash
aws ecs execute-command \
  --cluster yukpo-cluster \
  --task "$TASK_ARN" \
  --container backend \
  --command "bash -c 'cd /app/backend && export DATABASE_URL=\"\$DATABASE_URL\" && sqlx migrate info'" \
  --interactive \
  --region eu-west-1
```

**Vérifier les logs CloudWatch** :

```bash
aws logs tail /ecs/yukpo-backend --follow --region eu-west-1
```

---

## ✅ **RÉSUMÉ**

### Problème
- ❌ Base de données RDS dans VPC privé
- ❌ Non accessible depuis machine locale
- ❌ Migrations échouent car `merchant_storage_locations` n'existe pas

### Solution
- ✅ Exécuter depuis ECS (via ECS Exec)
- ✅ Ou modifier `start-cloud.sh` pour créer la table avant migrations
- ✅ Ou utiliser le script Python depuis ECS

### Fichiers Créés
- ✅ `scripts/run_migrations_aws_fixed.py` - Script Python corrigé
- ✅ `scripts/fix_merchant_storage_locations.sql` - Script SQL de correction
- ✅ `APPLIQUER_MIGRATIONS_DEPUIS_ECS.md` - Ce document

---

**Action immédiate**: Utiliser l'Option 1 (ECS Exec) pour appliquer la correction maintenant, ou l'Option 2 pour une solution permanente.

