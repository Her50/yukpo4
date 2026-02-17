# 🔧 Correction Erreur DATABASE_URL Cloud Run

**Date** : 2026-02-16  
**Erreur** : `Cannot update environment variable [DATABASE_URL] to string literal because it has already been set with a different type`

---

## 🔴 Problème

L'erreur indique que `DATABASE_URL` est déjà définie dans Cloud Run comme **secret**, mais le workflow essaie de la redéfinir comme **variable d'environnement** (string literal).

**Cause** : `DATABASE_URL` est peut-être définie comme variable d'environnement dans Cloud Run, et on essaie de la redéfinir comme secret, ou vice versa.

---

## ✅ Solution Appliquée

### Modification du Workflow `.github/workflows/gcp-deploy.yml`

**Ajout d'une étape de nettoyage spécifique** avant le déploiement :

```yaml
# Supprimer spécifiquement DATABASE_URL comme variable d'environnement
gcloud run services update ${{ env.SERVICE_NAME }} \
  --region ${{ env.REGION }} \
  --remove-env-vars="DATABASE_URL" \
  --project ${{ secrets.GCP_PROJECT_ID }} 2>&1 | grep -v "does not exist\|not found" || true
```

Cette commande supprime `DATABASE_URL` comme variable d'environnement (si elle existe) avant de la définir comme secret.

---

## 🔍 Vérifications

### 1. Vérifier l'état actuel dans Cloud Run

```bash
gcloud run services describe yukpo-backend \
  --region europe-west1 \
  --format="value(spec.template.spec.containers[0].env)" \
  --project yukpo-project
```

### 2. Vérifier les secrets

```bash
gcloud run services describe yukpo-backend \
  --region europe-west1 \
  --format="value(spec.template.spec.containers[0].env[?(@.name=='DATABASE_URL')])" \
  --project yukpo-project
```

### 3. Supprimer manuellement DATABASE_URL comme variable (si nécessaire)

```bash
gcloud run services update yukpo-backend \
  --region europe-west1 \
  --remove-env-vars="DATABASE_URL" \
  --project yukpo-project
```

---

## 📋 Prochaines Étapes

1. ✅ Le workflow a été corrigé pour supprimer `DATABASE_URL` comme variable avant de la définir comme secret
2. 🔄 Redéclencher le workflow GitHub Actions
3. ✅ Vérifier que le déploiement réussit

---

## 🎯 Configuration Attendue

Après le déploiement, `DATABASE_URL` doit être :
- ✅ Définie comme **secret** (via `--update-secrets`)
- ❌ **PAS** définie comme variable d'environnement

---

**Date de correction** : 2026-02-16

