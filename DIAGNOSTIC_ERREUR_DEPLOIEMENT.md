# 🔍 Diagnostic : Erreur Déploiement Cloud Run

**Date**: 2026-02-15  
**Problème** : Le service essaie toujours de se connecter à AWS RDS au lieu de Cloud SQL

---

## 🔴 Problème Identifié

Les logs montrent que la DATABASE_URL pointe toujours vers **AWS RDS** :
```
DATABASE_URL: postgresql://yukpo_admin:***@34.79.29.219:5432/yuk...
DB_HOST: 34.79.29.219
```

**Cause** : Le workflow GitHub Actions qui vient de s'exécuter a probablement été déclenché **AVANT** la mise à jour du secret `GCP_DATABASE_URL`, ou il y a un problème de cache.

---

## ✅ Solutions

### Solution 1: Redéclencher le Workflow (Recommandé)

Le secret a été mis à jour, mais le workflow précédent utilisait encore l'ancienne valeur. Il faut redéclencher le workflow :

1. **Aller sur** : https://github.com/Her50/yukpo4/actions
2. **Sélectionner** "Docker Build Optimized"
3. **Cliquer sur** "Run workflow"
4. **Cocher** "Push to GCP Cloud Run"
5. **Cliquer sur** "Run workflow"

### Solution 2: Vérifier que le Secret est Bien Mis à Jour

```bash
gh secret list --repo Her50/yukpo4 | grep GCP_DATABASE_URL
```

### Solution 3: Mettre à Jour Manuellement Cloud Run (Temporaire)

Si le workflow ne fonctionne pas, mettre à jour manuellement :

```bash
gcloud run services update yukpo-backend \
  --region=europe-west1 \
  --update-env-vars="DATABASE_URL=postgresql://yukpo_user:TempPassword123!@/yukpo_db?host=/cloudsql/yukpo-project:europe-west1:yukpo-postgres" \
  --project=yukpo-project
```

---

## 🔍 Vérifications

### 1. Vérifier le Secret GitHub

Le secret `GCP_DATABASE_URL` doit contenir :
```
postgresql://yukpo_user:TempPassword123!@/yukpo_db?host=/cloudsql/yukpo-project:europe-west1:yukpo-postgres
```

### 2. Vérifier le Workflow

Le workflow utilise bien `secrets.GCP_DATABASE_URL` à la ligne 469 et 492 du fichier `.github/workflows/docker-build-optimized.yml`.

### 3. Vérifier Cloud Run

Après le déploiement, vérifier que la DATABASE_URL est correcte :
```bash
gcloud run services describe yukpo-backend \
  --region=europe-west1 \
  --format="get(spec.template.spec.containers[0].env[?(@.name=='DATABASE_URL')].value)" \
  --project=yukpo-project
```

---

## 📋 Checklist

- [x] Secret GitHub `GCP_DATABASE_URL` mis à jour ✅
- [ ] **Workflow redéclenché avec le nouveau secret** (ACTION REQUISE)
- [ ] **DATABASE_URL dans Cloud Run pointe vers Cloud SQL** (à vérifier après déploiement)
- [ ] **Service démarre correctement** (à vérifier après déploiement)

---

**🔴 ACTION REQUISE** : Redéclencher le workflow GitHub Actions pour utiliser le nouveau secret.


