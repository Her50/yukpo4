# Diagnostic Final - Crash Avant main()

**Date**: 2026-02-13  
**Problème**: Aucun log [MAIN] n'apparaît, l'application crash avant d'atteindre `main()`

---

## 🔍 CONSTAT

### Observations
- ✅ La tâche utilise `latest` (devrait être la nouvelle image)
- ✅ Le script `start-cloud.sh` s'exécute (on voit ses logs)
- ✅ Les vérifications de connectivité passent (PostgreSQL, Redis)
- ❌ **Aucun log [MAIN] n'apparaît**
- ❌ L'application crash immédiatement après Redis

### Interprétation

**L'application Rust crash AVANT d'atteindre `main()`**

Cela signifie que le crash se produit :
1. **Lors du lancement de l'exécutable** (`./yukpomnang_backend`)
2. **Avant même que `main()` ne soit appelé**

---

## 🔧 CAUSES POSSIBLES

### 1. Problème avec l'Exécutable

**Symptômes**:
- L'exécutable n'existe pas
- L'exécutable est corrompu
- Problème de permissions

**Vérification**:
```bash
# Dans le container
ls -la ./yukpomnang_backend
file ./yukpomnang_backend
./yukpomnang_backend --version
```

### 2. Problème de Dépendances Système

**Symptômes**:
- Bibliothèques système manquantes
- Incompatibilité d'architecture
- Problème avec les libs dynamiques

**Vérification**:
```bash
# Dans le container
ldd ./yukpomnang_backend
```

### 3. Problème de Mémoire/CPU

**Symptômes**:
- OOM (Out of Memory) au démarrage
- Limite de ressources atteinte

**Vérification**:
- Vérifier les limites de mémoire/CPU dans la task definition
- Vérifier les logs ECS pour les erreurs OOM

### 4. Problème avec le Build Docker

**Symptômes**:
- L'image n'a pas été correctement buildée
- Le binaire n'a pas été copié correctement
- Problème avec le Dockerfile

**Vérification**:
- Vérifier que le build GitHub Actions a réussi
- Vérifier que l'image a été poussée vers ECR
- Vérifier la date de la dernière image

### 5. Problème avec le Script start-cloud.sh

**Symptômes**:
- Le script ne lance pas correctement l'exécutable
- Problème avec `exec` ou la redirection

**Vérification**:
- Vérifier les logs du script
- Vérifier la ligne 240 de `start-cloud.sh`: `./yukpomnang_backend`

---

## 🔍 ACTIONS DE DIAGNOSTIC

### 1. Vérifier l'Exécutable dans l'Image

**Créer une tâche de test**:
```bash
aws ecs run-task \
  --cluster yukpo-cluster \
  --task-definition yukpo-backend \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-xxx],securityGroups=[sg-xxx]}" \
  --overrides '{"containerOverrides":[{"name":"backend","command":["sh","-c","ls -la /app && file /app/yukpomnang_backend && /app/yukpomnang_backend --version"]}]}' \
  --region eu-west-1
```

### 2. Vérifier les Dépendances Système

**Créer une tâche de test**:
```bash
aws ecs run-task \
  --cluster yukpo-cluster \
  --task-definition yukpo-backend \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-xxx],securityGroups=[sg-xxx]}" \
  --overrides '{"containerOverrides":[{"name":"backend","command":["sh","-c","ldd /app/yukpomnang_backend"]}]}' \
  --region eu-west-1
```

### 3. Vérifier les Logs Stderr Directement

**Modifier le script start-cloud.sh** pour capturer stderr:
```bash
# Ligne 240
./yukpomnang_backend 2>&1 | tee /tmp/backend-stderr.log
```

### 4. Vérifier le Build GitHub Actions

**Vérifier**:
- Le workflow `docker-build-optimized.yml` a-t-il réussi ?
- L'image a-t-elle été poussée vers ECR ?
- La date de push est-elle récente ?

---

## 🎯 SOLUTION PROBABLE

### Hypothèse la Plus Probable

**L'application crash lors du chargement des dépendances dynamiques**

Cela peut être causé par :
1. **Bibliothèques manquantes** dans l'image Docker
2. **Incompatibilité d'architecture** (build pour une arch différente)
3. **Problème avec les libs SSL/TLS** (OpenSSL, etc.)

### Solution

**Vérifier le Dockerfile**:
- S'assurer que toutes les dépendances système sont installées
- Vérifier que l'architecture est correcte (linux/amd64)
- Vérifier que les libs sont correctement liées

**Vérifier le build**:
- Le build doit être pour `linux/amd64`
- Les dépendances doivent être statiques ou présentes dans l'image

---

## 📝 PROCHAINES ÉTAPES

1. **Vérifier la date de la dernière image dans ECR**
   - Confirmer que le build a réussi
   - Confirmer que l'image est récente

2. **Créer une tâche de test** pour vérifier l'exécutable
   - Vérifier que l'exécutable existe
   - Vérifier les dépendances système
   - Tester le lancement manuel

3. **Vérifier le Dockerfile**
   - S'assurer que toutes les dépendances sont installées
   - Vérifier l'architecture du build

4. **Modifier le script start-cloud.sh**
   - Capturer stderr explicitement
   - Ajouter plus de logs de débogage

---

## ✅ CONCLUSION

**Le problème est que l'application crash AVANT d'atteindre `main()`**

**Causes probables**:
1. Problème avec l'exécutable (manquant, corrompu, permissions)
2. Problème avec les dépendances système (libs manquantes)
3. Problème avec le build Docker (architecture, dépendances)

**Action immédiate**: Vérifier l'exécutable dans l'image et les dépendances système.

