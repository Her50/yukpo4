# 📋 Guide : Utilisation de NAMESPACE pour le Déploiement

## 🎯 Explication

**NAMESPACE** est une variable utilisée par **kubectl** (Kubernetes), **PAS** par le backend directement.

### ❌ Ce que NAMESPACE n'est PAS :
- ❌ Une variable d'environnement du backend Rust
- ❌ Une variable à ajouter dans Render.com
- ❌ Une variable dans le code backend

### ✅ Ce que NAMESPACE EST :
- ✅ Une variable pour les **scripts de déploiement kubectl**
- ✅ Utilisée pour spécifier le namespace Kubernetes où déployer
- ✅ Utilisée dans les commandes `kubectl apply -n $NAMESPACE`

---

## 🔧 Utilisation de NAMESPACE

### Dans les Scripts Shell/Bash

```bash
# Définir le namespace
export NAMESPACE="yukpomnang-staging"

# Utiliser dans les commandes kubectl
kubectl apply -f deployment.yaml -n $NAMESPACE
kubectl get pods -n $NAMESPACE
kubectl logs -f deployment/yukpomnang-backend -n $NAMESPACE
```

### Dans les Scripts PowerShell

```powershell
# Définir le namespace
$env:NAMESPACE = "yukpomnang-staging"

# Utiliser dans les commandes kubectl
kubectl apply -f deployment.yaml -n $env:NAMESPACE
kubectl get pods -n $env:NAMESPACE
```

---

## 🚀 Déploiement Actuel

### Sur Render.com (Déploiement Actuel)

Votre backend est actuellement déployé sur **Render.com**, pas sur Kubernetes.

**Variables d'environnement sur Render.com** :
- `DATABASE_URL` - URL PostgreSQL
- `JWT_SECRET` - Secret JWT
- `REDIS_URL` - URL Redis (si configuré)
- `OPENAI_API_KEY` - Clé API OpenAI
- Etc.

**NAMESPACE n'est PAS nécessaire sur Render.com**

### Sur Kubernetes (Déploiement Futur)

Si vous déployez sur Kubernetes, alors NAMESPACE est utilisé :

```bash
# 1. Créer le namespace
kubectl create namespace yukpomnang-staging

# 2. Déployer avec le namespace
export NAMESPACE="yukpomnang-staging"
kubectl apply -f deployment/kubernetes/deployment.yaml -n $NAMESPACE
```

---

## 📝 Scripts Adaptés

### Pour Render.com (Déploiement Actuel)

```bash
# Vérifier les métriques sur Render
export BACKEND_URL="https://yukpomnang.onrender.com"
./scripts/verify-metrics-existing.sh
```

### Pour Kubernetes (Déploiement Futur)

```bash
# Déployer sur Kubernetes avec namespace
export NAMESPACE="yukpomnang-staging"
./scripts/deploy-staging.sh
```

---

## ✅ Résumé

| Plateforme | NAMESPACE nécessaire ? | Variables d'environnement |
|------------|------------------------|---------------------------|
| **Render.com** | ❌ Non | Variables dans Render Dashboard |
| **Kubernetes** | ✅ Oui | Variables dans ConfigMap/Secrets |

**Pour votre déploiement actuel sur Render.com** :
- ❌ NAMESPACE n'est **PAS** nécessaire
- ✅ Utilisez les variables d'environnement dans Render Dashboard
- ✅ Utilisez `BACKEND_URL` pour vérifier les métriques

