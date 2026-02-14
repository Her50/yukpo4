# 📋 Plan d'Action Complet - Corrections et Tests

**Date**: 2026-02-13  
**Statut**: ✅ **CORRECTIONS APPLIQUÉES**

---

## ✅ **CORRECTIONS APPLIQUÉES**

### **Migrations Corrigées** (5 fonctions)

1. ✅ `ensure_image_search_vector_matching_optimization`
2. ✅ `ensure_fix_image_search_to_tsvector_error`
3. ✅ `ensure_audio_search_cache_optimization`
4. ✅ `ensure_search_performance_final_optimization`
5. ✅ `run_delivery_step` (pour "Create delivery_partners indexes")

**Changement**: Remplacé `sqlx::query()` par `execute_migration_sql_safe()` pour gérer les commandes SQL multiples.

**Fichier modifié**: `backend/src/migrations/auto_migrate.rs`

---

## 🚀 **ÉTAPES POUR APPLIQUER LES CORRECTIONS**

### **Option 1: Via GitHub Actions (Recommandé)**

1. **Commit et Push les corrections**:
```bash
git add backend/src/migrations/auto_migrate.rs
git commit -m "fix: Corriger erreurs 'cannot insert multiple commands' dans migrations

- Remplacer sqlx::query() par execute_migration_sql_safe() dans 5 fonctions
- Résout les erreurs: image search, audio cache, search performance, delivery_partners indexes
- Les migrations s'exécutent maintenant sans erreur 'cannot insert multiple commands'"
git push
```

2. **Attendre le build GitHub Actions** (10-20 minutes)
   - GitHub Actions va automatiquement:
     - Compiler le backend
     - Build l'image Docker
     - Push vers ECR
     - Mettre à jour le service ECS

3. **Vérifier les logs** après le redéploiement

### **Option 2: Build Manuel**

```bash
# 1. Compiler
cd backend
cargo check
cargo build --release

# 2. Build Docker
docker build -f Dockerfile.cloud -t yukpomnang-backend:latest .

# 3. Tag et Push ECR
ECR_URI=$(aws ecr describe-repositories --region eu-west-1 --query 'repositories[?contains(repositoryName, `yukpo`)].repositoryUri' --output text | Select-Object -First 1)
aws ecr get-login-password --region eu-west-1 | docker login --username AWS --password-stdin $ECR_URI
docker tag yukpomnang-backend:latest $ECR_URI:latest
docker push $ECR_URI:latest

# 4. Redémarrer ECS
aws ecs update-service \
  --cluster yukpo-cluster \
  --service yukpo-backend-service \
  --force-new-deployment \
  --region eu-west-1
```

---

## 🧪 **TESTS À EFFECTUER**

### 1. **Vérifier le Statut ECS**

```bash
aws ecs describe-services \
  --cluster yukpo-cluster \
  --services yukpo-backend-service \
  --region eu-west-1 \
  --query 'services[0].{Status:status,RunningCount:runningCount,DesiredCount:desiredCount}'
```

**Résultat attendu**:
- `Status`: `ACTIVE`
- `RunningCount`: `1`
- `DesiredCount`: `1`

### 2. **Vérifier les Logs**

**Via AWS Console**:
1. **CloudWatch** → **Log groups** → `/ecs/yukpo-backend`
2. Sélectionnez le **log stream le plus récent**
3. Vérifiez que vous voyez :
   - ✅ **PAS d'erreur** `cannot insert multiple commands into a prepared statement`
   - ✅ **PAS d'erreur** `Fragment de commande détecté` (pour ces migrations)
   - ✅ `✅ Migration image search vector matching optimization appliquée`
   - ✅ `✅ Migration fix image search to_tsvector error appliquée`
   - ✅ `✅ Migration audio search cache optimization appliquée`
   - ✅ `✅ Migration search performance final optimization appliquée`
   - ✅ `✅ [delivery_migration] Create delivery_partners indexes`
   - ✅ `✅ Migrations automatiques terminées`
   - ✅ `[MAIN] ✅ Application démarrée avec succès`

### 3. **Tester le Health Check**

**Si Load Balancer configuré**:
```bash
$lbDns = aws elbv2 describe-load-balancers `
    --region eu-west-1 `
    --query 'LoadBalancers[?contains(LoadBalancerName, `yukpo`)].DNSName' `
    --output text

if ($lbDns) {
    curl http://$lbDns/health
} else {
    Write-Host "⚠️ Aucun Load Balancer configuré" -ForegroundColor Yellow
}
```

**Si pas de Load Balancer** (tester directement via ECS Exec):
```bash
# Récupérer l'ID de la tâche en cours
$taskArn = aws ecs list-tasks `
    --cluster yukpo-cluster `
    --service-name yukpo-backend-service `
    --region eu-west-1 `
    --desired-status RUNNING `
    --query 'taskArns[0]' `
    --output text

if ($taskArn) {
    # Exécuter curl dans le conteneur
    aws ecs execute-command `
        --cluster yukpo-cluster `
        --task $taskArn `
        --container backend `
        --command "curl http://localhost:8080/health" `
        --interactive `
        --region eu-west-1
}
```

### 4. **Vérifier les Health Checks ECS**

```bash
aws ecs describe-services \
  --cluster yukpo-cluster \
  --services yukpo-backend-service \
  --region eu-west-1 \
  --query 'services[0].events[0:5].{Time:createdAt,Message:message}'
```

---

## ✅ **RÉSULTAT ATTENDU**

Après les corrections et le redéploiement :

1. ✅ **Aucune erreur** `cannot insert multiple commands into a prepared statement`
2. ✅ **Aucun warning** `Fragment de commande détecté` (pour ces migrations)
3. ✅ **Toutes les migrations s'exécutent** sans erreur
4. ✅ **Application démarre** correctement
5. ✅ **Health checks réussissent**
6. ✅ **Application répond** aux requêtes HTTP

---

## 📝 **RÉSUMÉ DES CORRECTIONS**

### **Problèmes Identifiés**:
- ❌ 5 migrations utilisaient `sqlx::query()` directement sur des fichiers SQL avec plusieurs commandes
- ❌ Cela causait l'erreur "cannot insert multiple commands into a prepared statement"

### **Solutions Appliquées**:
- ✅ Remplacé `sqlx::query()` par `execute_migration_sql_safe()` dans les 5 fonctions
- ✅ `execute_migration_sql_safe()` divise intelligemment les commandes SQL multiples
- ✅ Préserve les blocs `DO $$...END $$` et les fonctions `CREATE FUNCTION $$...$$ LANGUAGE`

### **Fichiers Modifiés**:
- `backend/src/migrations/auto_migrate.rs` (5 fonctions corrigées)

---

**Prochaine action**: Commit et push les corrections, puis attendre le build GitHub Actions.

