# 🔍 Problèmes Identifiés dans le Dockerfile

**Date**: 2026-02-13  
**Analyse**: Dockerfile.cloud pour AWS ECS/Fargate

---

## ❌ PROBLÈMES CRITIQUES IDENTIFIÉS

### 1. Base Image Instable ⚠️ **HAUTE PRIORITÉ**

**Fichier**: `backend/Dockerfile.cloud` (ligne 81)

**Problème**:
```dockerfile
FROM debian:trixie-slim
```

**Impact**:
- `trixie-slim` est une version **de développement** de Debian (Debian 13)
- Peut causer des incompatibilités avec les bibliothèques compilées
- Peut avoir des bugs non résolus
- Pas recommandé pour la production

**Solution**:
```dockerfile
FROM debian:bookworm-slim
```
- `bookworm-slim` est Debian 12 **stable**
- Compatible avec Rust et toutes les dépendances
- Recommandé pour la production

---

### 2. Dépendances Système Manquantes ⚠️ **HAUTE PRIORITÉ**

**Fichier**: `backend/Dockerfile.cloud` (lignes 91-113)

**Problème**:
Les dépendances suivantes ne sont **pas explicitement installées**:
- `libgcc-s1` - Bibliothèque GCC runtime (requise pour Rust)
- `libc6` - Bibliothèque C standard (requise pour tous les binaires)

**Impact**:
- L'exécutable Rust pourrait ne pas fonctionner sans ces bibliothèques
- Erreurs comme "library not found" ou "cannot execute binary file"
- Crash silencieux au démarrage

**Solution**:
```dockerfile
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    libpq5 \
    libssl3 \
    libgcc-s1 \        # ← AJOUTER
    libc6 \            # ← AJOUTER
    curl \
    # ... autres dépendances
```

---

### 3. Permissions Exécutable Non Explicites ⚠️ **MOYENNE PRIORITÉ**

**Fichier**: `backend/Dockerfile.cloud` (ligne 136)

**Problème**:
```dockerfile
COPY --from=builder --chown=appuser:appuser /app/target/release/yukpomnang_backend /app/yukpomnang_backend
```

**Impact**:
- Les permissions d'exécution ne sont pas explicitement définies
- Si l'exécutable n'a pas les permissions `+x`, il ne pourra pas s'exécuter
- L'application crash silencieusement

**Solution**:
```dockerfile
COPY --from=builder --chown=appuser:appuser /app/target/release/yukpomnang_backend /app/yukpomnang_backend
RUN chmod +x /app/yukpomnang_backend && \
    ls -la /app/yukpomnang_backend && \
    file /app/yukpomnang_backend
```

---

### 4. Architecture Non Explicitement Spécifiée ⚠️ **MOYENNE PRIORITÉ**

**Problème**:
Le build Docker ne spécifie pas explicitement l'architecture `linux/amd64`

**Impact**:
- Si le build est fait sur une machine avec une architecture différente (ARM, etc.)
- L'exécutable pourrait être compilé pour la mauvaise architecture
- L'exécutable ne fonctionnera pas sur AWS ECS Fargate (qui utilise x86_64)

**Solution**:
```bash
docker build --platform linux/amd64 ...
```

---

## ✅ CORRECTIONS RECOMMANDÉES

### Dockerfile Corrigé

Créer `backend/Dockerfile.cloud.fixed` avec les corrections suivantes:

1. **Base image stable**:
   ```dockerfile
   FROM debian:bookworm-slim
   ```

2. **Dépendances complètes**:
   ```dockerfile
   RUN apt-get update && apt-get install -y --no-install-recommends \
       ca-certificates \
       libpq5 \
       libssl3 \
       libgcc-s1 \
       libc6 \
       curl \
       # ... autres dépendances
   ```

3. **Permissions explicites**:
   ```dockerfile
   COPY --from=builder --chown=appuser:appuser /app/target/release/yukpomnang_backend /app/yukpomnang_backend
   RUN chmod +x /app/yukpomnang_backend
   ```

4. **Vérification de l'exécutable**:
   ```dockerfile
   RUN file /app/yukpomnang_backend && \
       ldd /app/yukpomnang_backend || echo "Exécutable statique"
   ```

---

## 🔧 ACTIONS IMMÉDIATES

### 1. Créer le Dockerfile Corrigé

```bash
# Copier le Dockerfile actuel
cp backend/Dockerfile.cloud backend/Dockerfile.cloud.fixed

# Appliquer les corrections manuellement ou via sed
```

### 2. Rebuild l'Image

```bash
# Login à ECR
aws ecr get-login-password --region eu-west-1 | \
    docker login --username AWS --password-stdin \
    108964700972.dkr.ecr.eu-west-1.amazonaws.com

# Build avec architecture explicite
docker build \
    --platform linux/amd64 \
    --file backend/Dockerfile.cloud.fixed \
    --tag 108964700972.dkr.ecr.eu-west-1.amazonaws.com/yukpo-backend:fixed \
    backend/

# Vérifier l'exécutable
docker run --rm 108964700972.dkr.ecr.eu-west-1.amazonaws.com/yukpo-backend:fixed \
    file /app/yukpomnang_backend

# Push vers ECR
docker push 108964700972.dkr.ecr.eu-west-1.amazonaws.com/yukpo-backend:fixed
```

### 3. Mettre à Jour la Task Definition

```bash
# Mettre à jour la task definition pour utiliser la nouvelle image
aws ecs register-task-definition \
    --cli-input-json file://task-definition.json \
    --region eu-west-1
```

### 4. Redémarrer le Service

```bash
aws ecs update-service \
    --cluster yukpo-cluster \
    --service yukpo-backend-service \
    --force-new-deployment \
    --region eu-west-1
```

---

## 📊 IMPACT ATTENDU

Avec ces corrections:

1. ✅ **Base image stable** → Moins de risques d'incompatibilités
2. ✅ **Dépendances complètes** → L'exécutable aura toutes les bibliothèques nécessaires
3. ✅ **Permissions correctes** → L'exécutable pourra s'exécuter
4. ✅ **Architecture correcte** → L'exécutable fonctionnera sur AWS ECS Fargate

**Résultat attendu**:
- Les logs `[MAIN]` devraient apparaître
- L'application devrait démarrer correctement
- Les health checks devraient passer

---

## 🔍 VÉRIFICATIONS POST-CORRECTION

Après avoir appliqué les corrections:

1. **Vérifier l'exécutable dans l'image**:
   ```bash
   docker run --rm <image> file /app/yukpomnang_backend
   docker run --rm <image> ldd /app/yukpomnang_backend
   ```

2. **Vérifier les logs**:
   ```bash
   aws logs tail /ecs/yukpo-backend --follow --region eu-west-1
   ```

3. **Vérifier les health checks**:
   ```bash
   aws ecs describe-tasks \
       --cluster yukpo-cluster \
       --tasks <task-arn> \
       --region eu-west-1 \
       --query 'tasks[0].containers[0].healthStatus'
   ```

---

## ✅ CONCLUSION

**Problèmes identifiés**: 4 problèmes critiques/moyens  
**Priorité**: 🔴 **HAUTE** - Ces problèmes peuvent expliquer pourquoi l'application crash avant `main()`

**Action requise**: Appliquer les corrections et rebuild l'image Docker

---

**Date de l'analyse**: 2026-02-13  
**Prochaine action**: Créer le Dockerfile corrigé et rebuild l'image

