# 🔍 Diagnostic Final - Création de Service sur GCP

**Date**: 2026-02-20  
**Problème**: Impossible de créer une prestation de service sur GCP  
**Code**: Fonctionne sur d'autres plateformes ✅

---

## ✅ Vérifications Effectuées

### 1. Configuration OpenAI ✅ CORRECTE

- Secret valide (164 caractères)
- Référencé dans Cloud Run
- Permissions IAM correctes

**Conclusion**: Le problème n'est **PAS** lié à OpenAI.

---

### 2. Configuration Frontend

**Découverte importante**:

#### Pour Netlify/Vercel (Proxy)
- `API_BASE_URL = ''` (URLs relatives)
- Utilise un proxy (pas de CORS)
- Fonctionne ✅

#### Pour Autres Plateformes (Direct)
- `API_BASE_URL = 'https://yukpo-backend-yukpo-project.a.run.app'`
- Appels directs au backend GCP
- **Nécessite CORS configuré** ⚠️

**URL dans le code**: `https://yukpo-backend-yukpo-project.a.run.app`  
**URL réelle (logs)**: `https://yukpo-backend-376093909298.europe-west1.run.app`

**⚠️ PROBLÈME POTENTIEL**: Les deux URLs peuvent pointer vers le même service, mais il faut vérifier.

---

### 3. Configuration CORS Backend

**Fichier**: `backend/src/middlewares/cors.rs`

**Comportement**:
- Lit `ALLOWED_ORIGINS` depuis les variables d'environnement
- Si non configuré, utilise par défaut:
  - `https://yukpomnang.com`
  - `https://yukpomnang.onrender.com`

**Origines autorisées par défaut**:
- `https://yukpomnang.com`
- `https://yukpomnang.onrender.com`

**⚠️ PROBLÈME POTENTIEL**: Si le frontend est déployé sur une autre origine (Netlify, Vercel, autre), elle n'est **PAS** dans la liste par défaut.

---

## 🚨 Problème Identifié

### Hypothèse Principale: CORS Non Configuré

**Scénario**:
1. Le frontend est déployé sur **Netlify/Vercel** ou une autre origine
2. Le frontend utilise l'URL directe GCP (pas le proxy)
3. `ALLOWED_ORIGINS` n'est **PAS** configuré dans Cloud Run
4. Le backend utilise la liste par défaut qui ne contient **PAS** l'origine du frontend
5. Les requêtes sont **bloquées par CORS** avant d'atteindre le backend

**Preuves**:
- ✅ L'étape 1 (génération suggestions) fonctionne → `/api/ia/creation-service` appelé
- ❌ L'étape 2 (création finale) ne fonctionne pas → `/api/services/create` jamais appelé
- ✅ Le code fonctionne sur d'autres plateformes (probablement avec proxy ou CORS configuré)

---

## ✅ Solution

### Étape 1: Vérifier l'Origine du Frontend

**Question**: Sur quelle plateforme est déployé le frontend ?
- Netlify ? (ex: `https://yukpomnang-app.netlify.app`)
- Vercel ? (ex: `https://yukpomnang.vercel.app`)
- Autre ?

### Étape 2: Configurer ALLOWED_ORIGINS dans Cloud Run

**Si le frontend est sur Netlify**:
```bash
ALLOWED_ORIGINS=https://yukpomnang-app.netlify.app,https://yukpomnang.com,https://yukpomnang.onrender.com
```

**Si le frontend est sur Vercel**:
```bash
ALLOWED_ORIGINS=https://yukpomnang.vercel.app,https://yukpomnang.com,https://yukpomnang.onrender.com
```

**Si le frontend est sur une autre plateforme**:
```bash
ALLOWED_ORIGINS=https://VOTRE-URL-FRONTEND,https://yukpomnang.com,https://yukpomnang.onrender.com
```

### Étape 3: Mettre à Jour Cloud Run

**Via Console GCP**:
1. Cloud Run → `yukpo-backend` → Modifier et déployer
2. Variables et secrets → Ajouter une variable
3. Nom: `ALLOWED_ORIGINS`
4. Valeur: Liste des origines séparées par des virgules
5. Déployer

**Via gcloud CLI**:
```powershell
gcloud run services update yukpo-backend `
  --region=europe-west1 `
  --project=yukpo-project `
  --update-env-vars="ALLOWED_ORIGINS=https://yukpomnang-app.netlify.app,https://yukpomnang.com,https://yukpomnang.onrender.com"
```

---

## 📋 Checklist de Correction

- [ ] Identifier l'origine du frontend (Netlify, Vercel, autre)
- [ ] Vérifier si `ALLOWED_ORIGINS` est configuré dans Cloud Run
- [ ] Ajouter l'origine du frontend dans `ALLOWED_ORIGINS`
- [ ] Redéployer Cloud Run
- [ ] Tester la création d'une prestation
- [ ] Vérifier les logs pour confirmer que les requêtes arrivent

---

## 🔧 Commandes Utiles

### Vérifier ALLOWED_ORIGINS actuel
```powershell
gcloud run services describe yukpo-backend --region=europe-west1 --project=yukpo-project --format="yaml(spec.template.spec.containers[0].env)"
```

### Mettre à jour ALLOWED_ORIGINS
```powershell
gcloud run services update yukpo-backend `
  --region=europe-west1 `
  --project=yukpo-project `
  --update-env-vars="ALLOWED_ORIGINS=https://VOTRE-URL-FRONTEND,https://yukpomnang.com,https://yukpomnang.onrender.com"
```

### Vérifier les logs CORS
```powershell
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=yukpo-backend AND textPayload=~'CORS'" --limit=50 --project=yukpo-project --format=json --freshness=1h
```

---

## 📝 Conclusion

**Problème identifié**: ⚠️ **CORS probablement non configuré pour l'origine du frontend**

**Solution**: Configurer `ALLOWED_ORIGINS` dans Cloud Run avec l'origine du frontend.

**Action immédiate**: 
1. Identifier l'origine du frontend
2. Ajouter cette origine dans `ALLOWED_ORIGINS`
3. Redéployer Cloud Run
4. Tester la création d'une prestation

---

**Généré le**: 2026-02-20  
**Status**: Problème CORS identifié - Action requise

