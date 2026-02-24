# 🔧 Solution - Configuration CORS pour GCP Cloud Run

**Date**: 2026-02-20  
**Problème**: Impossible de créer une prestation de service sur GCP  
**Cause**: CORS non configuré pour l'origine du frontend

---

## 🚨 Problème Identifié

### Constatations

1. **ALLOWED_ORIGINS NON CONFIGURÉ dans Cloud Run** ❌
   - Le backend utilise la liste par défaut :
     - `https://yukpomnang.com`
     - `https://yukpomnang.onrender.com`

2. **URL GCP dans le code vs URL réelle** ⚠️
   - URL dans le code: `https://yukpo-backend-yukpo-project.a.run.app` (404)
   - URL réelle: `https://yukpo-backend-376093909298.europe-west1.run.app` (200 OK)

3. **Configuration Frontend**:
   - Netlify/Vercel: Utilise proxy (pas de CORS) ✅
   - Autres plateformes: Utilise URL directe GCP (nécessite CORS) ⚠️

---

## ✅ Solution

### Étape 1: Identifier l'Origine du Frontend

**Question**: Sur quelle plateforme est déployé le frontend ?

**Options possibles**:
- Netlify: `https://yukpomnang-app.netlify.app` ou similaire
- Vercel: `https://yukpomnang.vercel.app` ou similaire
- Autre: URL du frontend

### Étape 2: Configurer ALLOWED_ORIGINS dans Cloud Run

#### Option A: Via Console GCP (Recommandé)

1. Aller sur [Cloud Run Console](https://console.cloud.google.com/run?project=yukpo-project)
2. Cliquer sur `yukpo-backend`
3. **Modifier et déployer une nouvelle révision**
4. Onglet **Variables et secrets**
5. **Ajouter une variable**:
   - Nom: `ALLOWED_ORIGINS`
   - Valeur: Liste des origines séparées par des virgules (voir ci-dessous)
6. **Déployer**

#### Option B: Via gcloud CLI

```powershell
# Remplacer VOTRE-URL-FRONTEND par l'URL réelle du frontend
gcloud run services update yukpo-backend `
  --region=europe-west1 `
  --project=yukpo-project `
  --update-env-vars="ALLOWED_ORIGINS=https://VOTRE-URL-FRONTEND,https://yukpomnang.com,https://yukpomnang.onrender.com"
```

### Étape 3: Valeurs Recommandées pour ALLOWED_ORIGINS

#### Si Frontend sur Netlify
```bash
ALLOWED_ORIGINS=https://yukpomnang-app.netlify.app,https://yukpomnang.netlify.app,https://yukpomnang.com,https://yukpomnang.onrender.com
```

#### Si Frontend sur Vercel
```bash
ALLOWED_ORIGINS=https://yukpomnang.vercel.app,https://yukpomnang.com,https://yukpomnang.onrender.com
```

#### Si Frontend sur Autre Plateforme
```bash
ALLOWED_ORIGINS=https://VOTRE-URL-FRONTEND,https://yukpomnang.com,https://yukpomnang.onrender.com
```

#### Pour Tester Plusieurs Origines
```bash
ALLOWED_ORIGINS=https://yukpomnang-app.netlify.app,https://yukpomnang.vercel.app,https://yukpomnang.com,https://yukpomnang.onrender.com,https://yukpomnang-app.netlify.app
```

---

## 🔍 Vérification Post-Configuration

### 1. Vérifier que ALLOWED_ORIGINS est Configuré

```powershell
gcloud run services describe yukpo-backend `
  --region=europe-west1 `
  --project=yukpo-project `
  --format="yaml(spec.template.spec.containers[0].env)" | Select-String "ALLOWED_ORIGINS"
```

### 2. Vérifier les Logs CORS

```powershell
# Voir les origines rejetées (devrait être vide après correction)
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=yukpo-backend AND textPayload=~'CORS.*rejetée'" --limit=20 --project=yukpo-project --format=json --freshness=1h
```

### 3. Tester la Création d'une Prestation

1. Ouvrir la console du navigateur (F12)
2. Onglet Network
3. Réessayer de créer une prestation
4. Vérifier que la requête vers `/api/services/create` apparaît
5. Vérifier le status HTTP (devrait être 200 ou 201)

---

## 📋 Checklist de Correction

- [ ] Identifier l'URL du frontend (Netlify, Vercel, autre)
- [ ] Configurer `ALLOWED_ORIGINS` dans Cloud Run avec l'origine du frontend
- [ ] Redéployer Cloud Run
- [ ] Vérifier que `ALLOWED_ORIGINS` est bien configuré
- [ ] Vérifier les logs CORS (aucune origine rejetée)
- [ ] Tester la création d'une prestation
- [ ] Confirmer que la requête vers `/api/services/create` arrive

---

## 🔧 Script de Correction Automatique

```powershell
# Script pour configurer ALLOWED_ORIGINS
# Usage: .\scripts\configurer-cors-gcp.ps1 -FrontendUrl "https://yukpomnang-app.netlify.app"

param(
    [Parameter(Mandatory=$true)]
    [string]$FrontendUrl,
    [string]$GcpProjectId = "yukpo-project",
    [string]$GcpServiceName = "yukpo-backend",
    [string]$GcpRegion = "europe-west1"
)

$allowedOrigins = "$FrontendUrl,https://yukpomnang.com,https://yukpomnang.onrender.com"

Write-Host "Configuration ALLOWED_ORIGINS..." -ForegroundColor Yellow
Write-Host "Origines: $allowedOrigins" -ForegroundColor Cyan

gcloud run services update $GcpServiceName `
  --region=$GcpRegion `
  --project=$GcpProjectId `
  --update-env-vars="ALLOWED_ORIGINS=$allowedOrigins"

Write-Host "`nALLOWED_ORIGINS configure avec succes!" -ForegroundColor Green
Write-Host "Le service va etre redeploye automatiquement (1-2 minutes)" -ForegroundColor Yellow
```

---

## 📝 Notes Importantes

### Pourquoi ça Fonctionne sur d'Autres Plateformes ?

**Netlify/Vercel**:
- Utilisent un **proxy** (redirection dans `netlify.toml` ou `vercel.json`)
- Les requêtes passent par le proxy, donc **pas de CORS**
- `API_BASE_URL = ''` (URLs relatives)

**GCP Direct**:
- Les requêtes vont **directement** au backend GCP
- **Nécessite CORS** configuré
- `API_BASE_URL = 'https://yukpo-backend-...'` (URL absolue)

### Pourquoi l'Étape 1 Fonctionne mais Pas l'Étape 2 ?

**Hypothèse**:
- L'étape 1 (`/api/ia/creation-service`) peut fonctionner si :
  - Le proxy Netlify/Vercel fonctionne pour cet endpoint
  - Ou si l'origine est acceptée par défaut
- L'étape 2 (`/api/services/create`) échoue car :
  - CORS bloque la requête avant qu'elle n'atteigne le backend
  - Ou l'origine n'est pas autorisée pour cet endpoint spécifique

---

## ✅ Résumé

**Problème**: `ALLOWED_ORIGINS` non configuré dans Cloud Run  
**Solution**: Ajouter l'origine du frontend dans `ALLOWED_ORIGINS`  
**Action**: Configurer `ALLOWED_ORIGINS` dans Cloud Run et redéployer

---

**Généré le**: 2026-02-20  
**Status**: Solution identifiée - Configuration CORS requise

