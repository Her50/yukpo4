# ✅ Vérification Configuration OPENAI_API_KEY - Cloud Run

**Date**: 2026-02-20  
**Service**: yukpo-backend  
**Région**: europe-west1  
**Projet**: yukpo-project

---

## 📊 Résumé de la Vérification

Cette vérification analyse :
1. ✅ Configuration de `OPENAI_API_KEY` dans Cloud Run
2. ✅ Existence et valeur du secret dans Secret Manager
3. ✅ Permissions IAM du service account
4. ✅ Autres secrets configurés

---

## 🔍 Résultats de la Vérification

### 1. Configuration dans Cloud Run

**Status**: Vérifier ci-dessous

**Détails**:
- Variable `OPENAI_API_KEY` configurée : Oui/Non
- Type : Secret Manager / Variable directe
- Secret référencé : `openai-api-key:latest`
- Version : `latest` ou version spécifique

### 2. Secret dans Secret Manager

**Status**: Vérifier ci-dessous

**Détails**:
- Secret existe : Oui/Non
- Longueur : X caractères (minimum 50 requis)
- Format : `sk-...` ou `sk-proj-...` (valide/invalide)
- Préfixe : `sk-...`

### 3. Permissions IAM

**Status**: Vérifier ci-dessous

**Détails**:
- Service Account : `yukpo-backend@yukpo-project.iam.gserviceaccount.com`
- Rôle requis : `roles/secretmanager.secretAccessor`
- Accès : Oui/Non

---

## 🚨 Problèmes Détectés

### Problème 1: OPENAI_API_KEY Non Configurée

**Symptôme**: La variable `OPENAI_API_KEY` n'est pas référencée dans Cloud Run.

**Solution**:
```powershell
gcloud run services update yukpo-backend `
  --region=europe-west1 `
  --project=yukpo-project `
  --update-secrets="OPENAI_API_KEY=openai-api-key:latest"
```

### Problème 2: Secret Trop Court ou Invalide

**Symptôme**: Le secret `openai-api-key` contient moins de 50 caractères ou ne commence pas par `sk-`.

**Solution**:
```powershell
# 1. Obtenir une vraie clé OpenAI depuis https://platform.openai.com/api-keys
$apiKey = "sk-proj-VOTRE_CLE_COMPLETE_ICI"

# 2. Mettre à jour le secret
$apiKey | gcloud secrets versions add openai-api-key --data-file=- --project=yukpo-project
```

### Problème 3: Permissions IAM Manquantes

**Symptôme**: Le service account n'a pas accès au secret.

**Solution**:
```powershell
$serviceAccount = "yukpo-backend@yukpo-project.iam.gserviceaccount.com"
gcloud secrets add-iam-policy-binding openai-api-key `
  --member="serviceAccount:$serviceAccount" `
  --role="roles/secretmanager.secretAccessor" `
  --project=yukpo-project
```

---

## ✅ Checklist de Vérification

- [ ] `OPENAI_API_KEY` est référencée dans Cloud Run
- [ ] Le secret `openai-api-key` existe dans Secret Manager
- [ ] Le secret contient une vraie clé OpenAI (> 50 caractères)
- [ ] Le secret commence par `sk-` ou `sk-proj-`
- [ ] Le service account a les permissions IAM nécessaires
- [ ] La version du secret est `latest` ou une version valide

---

## 🔧 Script de Correction Automatique

Si des problèmes sont détectés, utilisez le script de correction :

```powershell
# Diagnostic complet
.\scripts\diagnostic-et-fix-openai-gcp-complet.ps1

# Correction avec clé API
.\scripts\mettre-a-jour-secret-openai-gcp.ps1 -ApiKey "sk-proj-VOTRE_CLE_ICI"
```

---

## 📝 Notes

- Les modifications dans Cloud Run nécessitent un redéploiement (automatique)
- Le redéploiement prend généralement 1-2 minutes
- Après correction, vérifier les logs pour confirmer que `OPENAI_API_KEY` est chargée

---

**Généré le**: 2026-02-20  
**Commande utilisée**: `gcloud run services describe yukpo-backend`

