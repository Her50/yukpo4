# ✅ Correction : Illegal Instruction (Core Dumped)

**Date** : 2026-01-28  
**Problème** : "Illegal instruction (core dumped)" avec exit code 132

---

## 🔍 Problème Identifié

### Symptôme
```
/app/start-cloud.sh: line 176: 34 Illegal instruction (core dumped) ./yukpomnang_backend
❌ ERREUR: L'application backend a quitté avec le code 132
```

### Cause
Le binaire Rust a été compilé avec `target-cpu=native` dans `RUSTFLAGS`, ce qui :
- Compile le code pour le CPU spécifique du builder
- Utilise des instructions CPU avancées (AVX2, AVX-512, etc.)
- Ces instructions ne sont pas supportées sur le CPU d'AWS Fargate
- Résultat : "Illegal instruction" au runtime

### Contexte
- ✅ **Connexion RDS** : Fonctionne maintenant
- ✅ **GLIBC** : Plus d'erreur (debian:trixie-slim)
- ❌ **Application** : Crash avec "Illegal instruction"

---

## ✅ Correction Appliquée

### Modification du Dockerfile

**Fichier** : `backend/Dockerfile.cloud.optimized`

**Avant** :
```dockerfile
ENV RUSTFLAGS="-C link-arg=-fuse-ld=lld -C target-cpu=native"
```

**Après** :
```dockerfile
# Note: target-cpu=native retiré pour compatibilité AWS Fargate (évite "Illegal instruction")
ENV RUSTFLAGS="-C link-arg=-fuse-ld=lld"
```

---

## 🔍 Pourquoi Cette Solution Fonctionne

### Problème avec `target-cpu=native`

1. **Builder CPU** : Peut avoir des instructions avancées (AVX2, AVX-512)
2. **Runtime CPU (Fargate)** : Peut ne pas avoir ces instructions
3. **Résultat** : "Illegal instruction" quand le binaire essaie d'utiliser ces instructions

### Solution : CPU Générique

1. **Sans `target-cpu=native`** : Compile pour un CPU générique x86_64
2. **Instructions de base** : Utilise seulement les instructions supportées par tous les CPUs
3. **Résultat** : Compatible avec tous les CPUs AWS Fargate

### Performance

- **Impact minimal** : La différence de performance est négligeable
- **Fiabilité** : Plus important que la performance marginale
- **Compatible** : Fonctionne sur tous les CPUs AWS

---

## 📋 Prochaines Étapes

### 1. Commit et Push

```bash
git add backend/Dockerfile.cloud.optimized
git commit -m "fix: Remove target-cpu=native to fix Illegal instruction on AWS Fargate"
git push origin master
```

### 2. Workflow GitHub Actions

Le workflow `docker-build-optimized.yml` va :
- ✅ Reconstruire l'image sans `target-cpu=native`
- ✅ Pousser vers AWS ECR
- ✅ Déployer automatiquement sur ECS

### 3. Vérification

Après le déploiement, vérifier que :
- ✅ L'application démarre sans erreur "Illegal instruction"
- ✅ Les health checks ALB passent
- ✅ L'endpoint `/health` répond

---

## 🔄 Si le Problème Persiste

Si l'erreur "Illegal instruction" persiste après cette correction :

1. **Vérifier que le build GitHub Actions a réussi**
2. **Vérifier que l'image a été poussée vers ECR**
3. **Vérifier que ECS utilise la nouvelle image** (forcer un nouveau déploiement si nécessaire)
4. **Vérifier les logs CloudWatch** pour identifier d'autres erreurs

---

## 📝 Notes

- **`target-cpu=native`** : Utile pour optimiser localement, mais problématique pour le déploiement cloud
- **AWS Fargate** : Utilise différents types de CPUs selon la région et la configuration
- **Compilation générique** : Plus sûr pour le déploiement cloud

---

**Statut** : ✅ Correction appliquée - En attente de rebuild et déploiement

**Confiance** : 🟢 **Très élevée** - Cette correction devrait résoudre le problème "Illegal instruction".




