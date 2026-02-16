# 🔄 Migration Variables d'Environnement vers GCP Cloud Run

**Date**: 2026-02-16  
**Objectif**: Déplacer les variables d'environnement de GitHub Secrets vers Cloud Run (bonne pratique)

---

## 🎯 Bonnes Pratiques Cloud

### ❌ Approche Actuelle (Non Recommandée)
- Variables d'environnement dans **GitHub Secrets** avec préfixe `GCP_ENV_`
- Passées à Cloud Run via workflow GitHub Actions
- **Problème** : Mélange des responsabilités (CI/CD vs Configuration runtime)

### ✅ Approche Recommandée (Comme AWS)
- **Variables d'environnement** → Directement dans **Cloud Run** (console ou gcloud)
- **Secrets sensibles** → **GCP Secret Manager** (comme AWS Secrets Manager)
- **GitHub Secrets** → Uniquement pour credentials de déploiement (GCP_SA_KEY, etc.)

---

## 📋 Variables à Migrer

### Variables Non-Sensibles (→ Cloud Run Variables)
- `CLOUD_RUN=true`
- `ENABLE_AUTO_MIGRATIONS=true`
- `SQLX_OFFLINE=true`
- `HOST=0.0.0.0`
- `RUST_LOG=info`
- `APP_ENV=production`
- `ENVIRONMENT=production`
- `ALLOWED_ORIGINS=...`
- Variables GPU (si non sensibles)

### Secrets Sensibles (→ GCP Secret Manager)
- `JWT_SECRET` ⚠️ **CRITIQUE**
- `DATABASE_URL` (peut être dans Secret Manager)
- `MONGODB_URL` (si contient credentials)
- `REDIS_URL` (si contient credentials)
- Clés API (Google Maps, etc.)

---

## 🔧 Méthode 1: Via Console GCP (Recommandé pour Début)

### Étape 1: Accéder à Cloud Run
1. Aller dans [GCP Console](https://console.cloud.google.com)
2. Cloud Run → `yukpo-backend` → Modifier et déployer une nouvelle révision
3. Onglet **Variables et secrets**

### Étape 2: Ajouter les Variables
- Cliquer sur **Ajouter une variable**
- Ajouter toutes les variables non-sensibles
- Pour les secrets, utiliser **Référencer un secret** (Secret Manager)

### Étape 3: Créer les Secrets dans Secret Manager
1. Secret Manager → Créer un secret
2. Créer les secrets :
   - `jwt-secret` (valeur: votre JWT_SECRET)
   - `database-url` (si nécessaire)
   - etc.

### Étape 4: Référencer les Secrets dans Cloud Run
- Dans Cloud Run → Variables et secrets
- **Ajouter une variable** → **Référencer un secret**
- Sélectionner le secret créé
- Nom de la variable : `JWT_SECRET` (même nom que dans le code)

---

## 🔧 Méthode 2: Via gcloud CLI (Recommandé pour Automatisation)

### Étape 1: Créer les Secrets dans Secret Manager

```bash
# Créer le secret JWT_SECRET
echo -n "votre-jwt-secret-ici" | gcloud secrets create jwt-secret \
  --data-file=- \
  --project=yukpo-project

# Créer le secret DATABASE_URL (si nécessaire)
echo -n "postgresql://..." | gcloud secrets create database-url \
  --data-file=- \
  --project=yukpo-project
```

### Étape 2: Donner Accès au Service Account

```bash
# Donner accès au service account Cloud Run
gcloud secrets add-iam-policy-binding jwt-secret \
  --member="serviceAccount:yukpo-backend@yukpo-project.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor" \
  --project=yukpo-project
```

### Étape 3: Mettre à Jour Cloud Run avec Variables + Secrets

```bash
gcloud run services update yukpo-backend \
  --region=europe-west1 \
  --project=yukpo-project \
  --update-env-vars="CLOUD_RUN=true,ENABLE_AUTO_MIGRATIONS=true,SQLX_OFFLINE=true,HOST=0.0.0.0,RUST_LOG=info,APP_ENV=production" \
  --update-secrets="JWT_SECRET=jwt-secret:latest,DATABASE_URL=database-url:latest" \
  --service-account=yukpo-backend@yukpo-project.iam.gserviceaccount.com
```

---

## 🔧 Méthode 3: Modifier le Workflow (Hybride)

**Garder** :
- Variables de base dans le workflow (pour cohérence)
- Secrets via Secret Manager référencés dans Cloud Run

**Modifier** `.github/workflows/gcp-deploy.yml` :

```yaml
- name: Deploy to Cloud Run
  run: |
    gcloud run deploy ${{ env.SERVICE_NAME }} \
      --image ${{ env.IMAGE_NAME }}:${{ github.sha }} \
      --platform managed \
      --region ${{ env.REGION }} \
      --allow-unauthenticated \
      --port 8080 \
      # Variables non-sensibles (peuvent rester dans workflow)
      --update-env-vars="CLOUD_RUN=true,ENABLE_AUTO_MIGRATIONS=true,SQLX_OFFLINE=true,HOST=0.0.0.0,RUST_LOG=info,APP_ENV=production" \
      # Secrets via Secret Manager (RECOMMANDÉ)
      --update-secrets="JWT_SECRET=jwt-secret:latest,DATABASE_URL=database-url:latest" \
      --add-cloudsql-instances ${{ secrets.GCP_PROJECT_ID }}:${{ env.REGION }}:yukpo-postgres \
      --memory 2Gi \
      --cpu 2 \
      --timeout 900 \
      --max-instances 10 \
      --cpu-boost \
      --cpu-throttling \
      --service-account ${{ secrets.GCP_SERVICE_ACCOUNT_EMAIL }} \
      --project ${{ secrets.GCP_PROJECT_ID }}
```

---

## ✅ Avantages de l'Approche GCP Native

1. **Séparation des responsabilités** :
   - GitHub Secrets → Credentials de déploiement uniquement
   - Cloud Run → Configuration runtime
   - Secret Manager → Secrets sensibles

2. **Sécurité améliorée** :
   - Secrets chiffrés dans Secret Manager
   - Rotation des secrets facilitée
   - Audit trail dans GCP

3. **Gestion centralisée** :
   - Toutes les variables au même endroit (Cloud Run)
   - Modification sans redéploiement (pour certaines variables)
   - Visibilité dans la console GCP

4. **Cohérence avec AWS** :
   - AWS ECS → Variables dans Task Definition
   - AWS Secrets Manager → Secrets sensibles
   - Même logique pour GCP

---

## 📋 Checklist de Migration

- [ ] Créer les secrets dans GCP Secret Manager
- [ ] Donner accès au service account Cloud Run
- [ ] Ajouter les variables dans Cloud Run (console ou gcloud)
- [ ] Référencer les secrets dans Cloud Run
- [ ] Tester le déploiement
- [ ] Vérifier que les variables sont bien chargées (logs)
- [ ] Retirer les variables de GitHub Secrets (optionnel, pour nettoyage)

---

## 🚀 Action Immédiate

**Pour résoudre le problème de connexion mobile** :

1. **Créer le secret JWT_SECRET dans Secret Manager** :
   ```bash
   echo -n "votre-jwt-secret" | gcloud secrets create jwt-secret \
     --data-file=- \
     --project=yukpo-project
   ```

2. **Donner accès au service account** :
   ```bash
   gcloud secrets add-iam-policy-binding jwt-secret \
     --member="serviceAccount:${{ secrets.GCP_SERVICE_ACCOUNT_EMAIL }}" \
     --role="roles/secretmanager.secretAccessor" \
     --project=yukpo-project
   ```

3. **Mettre à jour Cloud Run** :
   ```bash
   gcloud run services update yukpo-backend \
     --region=europe-west1 \
     --update-secrets="JWT_SECRET=jwt-secret:latest" \
     --project=yukpo-project
   ```

---

**✅ Approche recommandée : Variables dans Cloud Run, Secrets dans Secret Manager**

