# 📋 Commandes : Configuration Azure pour GitHub Actions

**Date** : 2026-02-14  
**Usage** : Commandes pour configurer Azure avec GitHub

---

## 🔐 ÉTAPE 1 : Créer Azure Container Registry (ACR)

**Via Azure CLI** :
```powershell
# Se connecter à Azure (si pas déjà fait)
& "C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd" login

# Créer l'ACR
& "C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd" acr create `
  --resource-group yukpomnang-rg `
  --name yukpomnangregistry `
  --sku Basic `
  --admin-enabled true `
  --location westeurope
```

**Note** : Le nom `yukpomnangregistry` doit être unique globalement. Si déjà pris, utilisez un autre nom.

---

## 🔍 ÉTAPE 2 : Obtenir les IDs Azure

**Subscription ID** :
```powershell
& "C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd" account show --query id --output tsv
```

**Tenant ID** :
```powershell
& "C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd" account show --query tenantId --output tsv
```

**Client ID** (si App Registration existe) :
```powershell
# Lister les App Registrations
& "C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd" ad app list --query "[?displayName=='github-actions-yukpomnang'].appId" --output tsv
```

**Si pas d'App Registration, créer une** :
```powershell
# Créer App Registration
& "C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd" ad app create `
  --display-name "github-actions-yukpomnang" `
  --query appId --output tsv
```

---

## 🔐 ÉTAPE 3 : Créer Service Principal et Assigner Permissions

**Créer Service Principal** :
```powershell
# Obtenir Subscription ID
$SUBSCRIPTION_ID = & "C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd" account show --query id --output tsv

# Obtenir Client ID (de l'étape 2)
$CLIENT_ID = "[votre-client-id]"

# Créer Service Principal avec permissions Contributor
& "C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd" role assignment create `
  --assignee $CLIENT_ID `
  --role Contributor `
  --scope "/subscriptions/$SUBSCRIPTION_ID"
```

---

## 📋 ÉTAPE 4 : Configurer Secrets GitHub

**Dans GitHub** :
1. https://github.com/[votre-org]/[votre-repo]/settings/secrets/actions
2. **New repository secret** → Ajouter :

**AZURE_CLIENT_ID** : `[client-id-de-l-etape-2]`
**AZURE_TENANT_ID** : `[tenant-id-de-l-etape-2]`
**AZURE_SUBSCRIPTION_ID** : `[subscription-id-de-l-etape-2]`

---

## ✅ VÉRIFICATION

**Tester la connexion** :
```powershell
# Se connecter avec les credentials
& "C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd" login --service-principal `
  --username $CLIENT_ID `
  --password $CLIENT_SECRET `
  --tenant $TENANT_ID

# Vérifier l'accès à l'ACR
& "C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd" acr list --query "[?name=='yukpomnangregistry'].name" --output tsv
```

---

## 🚀 RÉSULTAT

**Après configuration** :
- ✅ Workflow GitHub Actions peut se connecter à Azure
- ✅ Push automatique vers Azure ACR
- ✅ Déploiement automatique sur Azure App Service
- ✅ En parallèle avec AWS ECR

---

**Date** : 2026-02-14  
**Statut** : Commandes prêtes - Configuration Azure requise


