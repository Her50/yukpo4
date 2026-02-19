# 🔍 Diagnostic Problème OPENAI_API_KEY - Création Produit

**Date**: 2026-02-19  
**Problème**: Impossible de créer un produit, comme si la clé OpenAI n'est pas opérationnelle

---

## 🎯 Résumé Exécutif

**Problème Identifié**: ⚠️ **Le secret `openai-api-key` contient seulement 2 caractères** au lieu d'une vraie clé OpenAI

**Impact**: 🔴 **CRITIQUE** - Les appels OpenAI échouent car la clé est invalide

**Cause Racine**: Le secret dans Secret Manager ne contient pas une vraie clé OpenAI valide

---

## 📊 Vérifications Effectuées

### 1. Configuration Cloud Run

✅ **OPENAI_API_KEY est configurée**:
- Variable d'environnement: `OPENAI_API_KEY`
- Source: Secret Manager (`openai-api-key:latest`)
- Référence: ✅ Correcte

### 2. Permissions IAM

✅ **Service Account a accès**:
- Service Account: `github-actions@yukpo-project.iam.gserviceaccount.com`
- Rôle: `roles/secretmanager.secretAccessor`
- Permissions: ✅ Correctes

### 3. Secret dans Secret Manager

⚠️ **PROBLÈME DÉTECTÉ**:
- Secret existe: ✅ `openai-api-key`
- Format: Commence par `sk-` ✅
- **Longueur: ❌ Seulement 2 caractères** (devrait être > 50 caractères)

**Conclusion**: Le secret contient une valeur invalide ou tronquée, pas une vraie clé OpenAI.

---

## 🐛 Cause Racine

Le secret `openai-api-key` dans Secret Manager contient une valeur invalide :
- Soit un placeholder non remplacé
- Soit une clé tronquée
- Soit une clé expirée/révoquée

**Impact**:
- Le backend charge la clé depuis l'environnement
- Les appels OpenAI échouent avec 401 (Unauthorized) ou 403 (Forbidden)
- La création de produit échoue car l'IA ne peut pas générer les données

---

## ✅ Solution

### Étape 1: Obtenir une Vraie Clé OpenAI

1. Allez sur https://platform.openai.com/api-keys
2. Connectez-vous à votre compte OpenAI
3. Cliquez **"Create new secret key"**
4. Nom: "Yukpomnang Production GCP"
5. **Copiez immédiatement la clé** (format: `sk-proj-...` ou `sk-...`)
6. **Important**: La clé doit faire au moins 50 caractères

### Étape 2: Mettre à Jour le Secret dans GCP

**Option A: Via gcloud CLI**
```bash
echo "sk-proj-VOTRE_CLE_COMPLETE_ICI" | gcloud secrets versions add openai-api-key --data-file=- --project=yukpo-project
```

**Option B: Via Console GCP**
1. Allez sur https://console.cloud.google.com/security/secret-manager
2. Sélectionnez le projet `yukpo-project`
3. Cliquez sur le secret `openai-api-key`
4. Cliquez **"Add new version"**
5. Collez la vraie clé OpenAI
6. Cliquez **"Add version"**

### Étape 3: Vérifier la Mise à Jour

```bash
# Vérifier la longueur du secret
gcloud secrets versions access latest --secret=openai-api-key --project=yukpo-project | Measure-Object -Character

# Devrait afficher > 50 caractères
```

### Étape 4: Redéployer Cloud Run (Optionnel)

Le service Cloud Run devrait automatiquement utiliser la nouvelle version du secret. Si nécessaire :

```bash
gcloud run services update yukpo-backend \
  --region=europe-west1 \
  --project=yukpo-project
```

### Étape 5: Tester la Clé

Utiliser le script de test :
```powershell
.\scripts\test-openai-api-key.ps1
```

**Résultat attendu**: ✅ Clé OpenAI VALIDE - Test réussi!

---

## 🔍 Vérification Post-Correction

### 1. Vérifier les Logs

```bash
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=yukpo-backend" --limit=50 --project=yukpo-project --format=json --freshness=10m | ConvertFrom-Json | Where-Object { $_.textPayload -like '*OpenAI*' -or $_.textPayload -like '*401*' -or $_.textPayload -like '*403*' }
```

**Résultat attendu**: Aucune erreur 401/403 OpenAI

### 2. Tester la Création de Produit

1. Créer un nouveau produit via l'interface
2. Vérifier que l'IA génère bien les données
3. Vérifier les logs pour confirmer les appels OpenAI réussis

---

## 📝 Notes Techniques

### Comment le Backend Utilise OPENAI_API_KEY

1. **Initialisation** (`app_ia.rs` ligne 258):
   ```rust
   if let Ok(api_key) = std::env::var("OPENAI_API_KEY") {
       // Initialise les modèles OpenAI
   }
   ```

2. **Appels API** (`app_ia.rs` ligne 1156):
   ```rust
   .header("Authorization", format!("Bearer {}", model.api_key))
   ```

3. **Gestion d'erreurs** (`app_ia.rs` ligne 1164):
   - Si status != success → Erreur retournée
   - Erreurs 401/403 → Clé invalide ou expirée

### Format d'une Clé OpenAI Valide

- **Ancien format**: `sk-...` (commence par `sk-`, ~50 caractères)
- **Nouveau format**: `sk-proj-...` (commence par `sk-proj-`, ~60+ caractères)
- **Longueur minimale**: ~50 caractères
- **Longueur typique**: 50-70 caractères

---

## ✅ Checklist de Correction

- [ ] Obtenir une vraie clé OpenAI depuis https://platform.openai.com/api-keys
- [ ] Mettre à jour le secret `openai-api-key` dans Secret Manager
- [ ] Vérifier que le secret fait > 50 caractères
- [ ] Tester la clé avec le script `test-openai-api-key.ps1`
- [ ] Vérifier les logs (aucune erreur 401/403)
- [ ] Tester la création d'un produit
- [ ] Confirmer que l'IA génère bien les données

---

## 🚨 Si le Problème Persiste

Si après avoir mis à jour le secret le problème persiste :

1. **Vérifier que le secret est bien mis à jour**:
   ```bash
   gcloud secrets versions access latest --secret=openai-api-key --project=yukpo-project
   ```

2. **Vérifier que Cloud Run utilise la dernière version**:
   - Le secret est référencé avec `:latest`, donc devrait utiliser automatiquement la dernière version
   - Si nécessaire, redéployer le service

3. **Vérifier les quotas OpenAI**:
   - Aller sur https://platform.openai.com/usage
   - Vérifier que les quotas ne sont pas dépassés

4. **Vérifier le compte OpenAI**:
   - Vérifier que le compte a des crédits disponibles
   - Vérifier que la clé n'a pas été révoquée

---

**Status**: ⚠️ **PROBLÈME IDENTIFIÉ** - Secret contient seulement 2 caractères  
**Action Requise**: Mettre à jour le secret avec une vraie clé OpenAI

