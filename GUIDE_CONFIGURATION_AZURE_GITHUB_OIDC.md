# 🔐 Guide : Configuration Azure avec GitHub OIDC (Authentification GitHub)

**Date** : 2026-02-14  
**Objectif** : Configurer l'authentification Azure via GitHub pour les workflows GitHub Actions

---

## ✅ AVANTAGE : Authentification GitHub pour Azure

**Si vous avez créé votre compte Azure avec GitHub** :
- ✅ **Pas besoin de secrets** : Utilise l'authentification OIDC (OpenID Connect)
- ✅ **Plus sécurisé** : Pas de credentials stockés
- ✅ **Automatique** : GitHub Actions s'authentifie directement avec Azure

---

## 📋 CONFIGURATION REQUISE

### Étape 1 : Créer une App Registration dans Azure

**Dans Azure Portal** :
1. Aller sur https://portal.azure.com
2. **Azure Active Directory** → **App registrations**
3. **New registration**
4. **Configuration** :
   - **Name** : `github-actions-yukpomnang`
   - **Supported account types** : `Accounts in this organizational directory only`
   - **Redirect URI** : Laisser vide
   - **Register**

5. **Notez les informations** :
   - **Application (client) ID** : `[AZURE_CLIENT_ID]` → À sauvegarder
   - **Directory (tenant) ID** : `[AZURE_TENANT_ID]` → À sauvegarder

---

### Étape 2 : Configurer l'Authentification GitHub

**Dans l'App Registration** :
1. **Authentication** → **Add a platform** → **GitHub**
2. **Configuration** :
   - **Organization** : `[votre-org-github]` (ex: `Her50`)
   - **Repository** : `[votre-repo]` (ex: `yukpo4`)
   - **Save**

---

### Étape 3 : Créer un Service Principal

**Dans Azure Portal** :
1. **Azure Active Directory** → **App registrations** → `github-actions-yukpomnang`
2. **Certificates & secrets** → **New client secret**
3. **Description** : `github-actions-secret`
4. **Expires** : `24 months` (ou selon vos besoins)
5. **Add**
6. **⚠️ IMPORTANT** : Copier la **Value** du secret (visible une seule fois) → `[AZURE_CLIENT_SECRET]`

---

### Étape 4 : Assigner les Permissions

**Dans Azure Portal** :
1. **Subscriptions** → Sélectionner votre abonnement
2. **Access control (IAM)** → **Add** → **Add role assignment**
3. **Role** : `Contributor` (ou `Owner` pour plus de permissions)
4. **Assign access to** : `User, group, or service principal`
5. **Select** : Chercher `github-actions-yukpomnang`
6. **Save**

---

### Étape 5 : Configurer les Secrets GitHub

**Dans GitHub Repository** :
1. Aller sur https://github.com/[votre-org]/[votre-repo]/settings/secrets/actions
2. **New repository secret** → Ajouter :

**Secret 1** :
- **Name** : `AZURE_CLIENT_ID`
- **Value** : `[AZURE_CLIENT_ID]` (de l'étape 1)

**Secret 2** :
- **Name** : `AZURE_TENANT_ID`
- **Value** : `[AZURE_TENANT_ID]` (de l'étape 1)

**Secret 3** :
- **Name** : `AZURE_SUBSCRIPTION_ID`
- **Value** : `[AZURE_SUBSCRIPTION_ID]` (trouvable dans Azure Portal → Subscriptions)

**Secret 4** (Optionnel - si OIDC ne fonctionne pas) :
- **Name** : `AZURE_CLIENT_SECRET`
- **Value** : `[AZURE_CLIENT_SECRET]` (de l'étape 3)

---

## 🔄 ALTERNATIVE : Utiliser Azure CLI Directement

**Si OIDC ne fonctionne pas**, utiliser Azure CLI avec credentials :

**Dans le workflow** :
```yaml
- name: Azure Login (with credentials)
  uses: azure/login@v2
  with:
    creds: ${{ secrets.AZURE_CREDENTIALS }}
```

**Créer AZURE_CREDENTIALS** :
```bash
az ad sp create-for-rbac --name "github-actions-yukpomnang" \
  --role contributor \
  --scopes /subscriptions/[SUBSCRIPTION_ID] \
  --sdk-auth
```

**Copier la sortie JSON** dans le secret GitHub `AZURE_CREDENTIALS`.

---

## ✅ VÉRIFICATION

**Après configuration**, le workflow GitHub Actions pourra :
- ✅ Se connecter à Azure automatiquement
- ✅ Push vers Azure Container Registry (ACR)
- ✅ Déployer sur Azure App Service
- ✅ Tout en parallèle avec AWS ECR

---

## 📊 WORKFLOW CRÉÉ

**Fichier** : `.github/workflows/docker-build-optimized.yml`

**Jobs en parallèle** :
1. ✅ **build-and-push** : Build Docker image
2. ✅ **push-to-aws** : Push vers AWS ECR (en parallèle)
3. ✅ **push-to-azure** : Push vers Azure ACR + Déploiement App Service (en parallèle)
4. ✅ **deploy-to-ecs** : Déploiement AWS ECS

**Résultat** : À chaque push sur `main`, l'image est automatiquement :
- ✅ Buildée
- ✅ Poussée vers GitHub Container Registry
- ✅ Poussée vers AWS ECR
- ✅ Poussée vers Azure ACR
- ✅ Déployée sur AWS ECS
- ✅ Déployée sur Azure App Service

---

**Date** : 2026-02-14  
**Statut** : Workflow créé - Configuration Azure requise


