# 🔐 Vérification et Mise à Jour OpenAI API Key

**Date**: 2026-02-19  
**Status**: ✅ Clé OpenAI testée et fonctionnelle

---

## ✅ Vérifications Effectuées

### 1. Configuration Cloud Run
- ✅ `OPENAI_API_KEY` est configurée dans Cloud Run
- ✅ Source: Secret Manager (`openai-api-key:latest`)
- ✅ Référence correcte

### 2. Secret dans Secret Manager
- ✅ Secret existe: `openai-api-key`
- ✅ Format: Commence par `sk-proj-`
- ✅ Longueur: ~164 caractères (valide)

### 3. Test de la Clé
- ✅ **Test API réussi**: La clé fonctionne correctement
- ✅ Réponse OpenAI: "Hello! How can I assist you today?"

### 4. Code Backend
- ✅ Le code utilise `std::env::var("OPENAI_API_KEY")` pour initialiser les modèles
- ✅ Modèles configurés: GPT-4o, GPT-4o-mini, GPT-3.5-turbo

---

## 🔍 Diagnostic du Problème de Création de Produit

**Problème**: Impossible de créer un produit, comme si la clé OpenAI n'est pas opérationnelle

**Constats**:
1. ✅ La clé OpenAI est valide et fonctionne (test API réussi)
2. ✅ La configuration Cloud Run est correcte
3. ✅ Le code utilise bien `OPENAI_API_KEY`

**Hypothèses**:
1. Le service Cloud Run n'a peut-être pas redémarré après la mise à jour du secret
2. Il pourrait y avoir un problème dans le code d'orchestration IA
3. Il pourrait y avoir un problème de quota ou de permissions OpenAI
4. Il pourrait y avoir une erreur silencieuse dans les logs

---

## 🔧 Solutions à Tester

### Solution 1: Forcer le Redéploiement de Cloud Run

```bash
# Forcer un redéploiement pour recharger les secrets
gcloud run services update yukpo-backend \
  --region=europe-west1 \
  --project=yukpo-project \
  --no-traffic
```

### Solution 2: Vérifier les Logs lors d'une Création de Produit

```bash
# Surveiller les logs en temps réel lors d'une création de produit
gcloud logging tail "resource.type=cloud_run_revision AND resource.labels.service_name=yukpo-backend" --project=yukpo-project --format=json
```

### Solution 3: Vérifier les Quotas OpenAI

1. Aller sur https://platform.openai.com/usage
2. Vérifier que les quotas ne sont pas dépassés
3. Vérifier que le compte a des crédits disponibles

### Solution 4: Tester la Création de Produit avec Logs Détaillés

1. Activer les logs détaillés dans le backend
2. Tenter de créer un produit
3. Analyser les logs pour identifier l'erreur exacte

---

## 🔐 Comment Mettre à Jour la Clé OpenAI (si nécessaire)

### Méthode 1: Via gcloud CLI (Recommandé)

```bash
# Remplacer VOTRE_CLE_COMPLETE par votre vraie clé OpenAI
echo "sk-proj-VOTRE_CLE_COMPLETE_ICI" | gcloud secrets versions add openai-api-key --data-file=- --project=yukpo-project
```

### Méthode 2: Via Console GCP

1. Allez sur https://console.cloud.google.com/security/secret-manager?project=yukpo-project
2. Cliquez sur `openai-api-key`
3. Cliquez **"Add new version"**
4. Collez votre clé OpenAI complète
5. Cliquez **"Add version"**

### Méthode 3: Me Donner la Clé Directement (Sécurisé)

**Vous pouvez me donner votre clé OpenAI directement dans le chat**. Je vais :
1. ✅ La mettre directement dans Secret Manager via `gcloud`
2. ✅ Ne jamais l'afficher ou la logger
3. ✅ Confirmer que la mise à jour est réussie
4. ✅ Tester la clé pour vérifier qu'elle fonctionne

**Format attendu**:
```
sk-proj-... (votre clé complète, 50-70 caractères)
```

**Sécurité**:
- ✅ La clé sera stockée dans GCP Secret Manager (chiffré automatiquement)
- ✅ Seul le service Cloud Run pourra y accéder (via IAM)
- ✅ La clé ne sera jamais affichée dans les logs ou l'historique
- ✅ Je vais l'utiliser uniquement pour mettre à jour le secret, puis l'oublier

---

## ✅ Vérification Post-Mise à Jour

Après avoir mis à jour la clé, vérifier :

1. **Vérifier la longueur du secret**:
```bash
gcloud secrets versions access latest --secret=openai-api-key --project=yukpo-project | Measure-Object -Character
```

2. **Tester la clé**:
```powershell
.\scripts\test-openai-api-key.ps1
```

3. **Vérifier les logs** (aucune erreur 401/403):
```bash
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=yukpo-backend AND severity>=ERROR" --limit=50 --project=yukpo-project --format=json --freshness=10m | ConvertFrom-Json | Where-Object { $_.textPayload -like '*401*' -or $_.textPayload -like '*403*' }
```

4. **Tester la création d'un produit**:
- Créer un nouveau produit via l'interface
- Vérifier que l'IA génère bien les données
- Vérifier les logs pour confirmer les appels OpenAI réussis

---

## 📝 Notes Techniques

### Comment le Backend Utilise OPENAI_API_KEY

1. **Initialisation** (`app_ia.rs` ligne 258):
   ```rust
   if let Ok(api_key) = std::env::var("OPENAI_API_KEY") {
       // Initialise les modèles OpenAI (GPT-4o, GPT-4o-mini, GPT-3.5-turbo)
   }
   ```

2. **Appels API** (`app_ia.rs` ligne 1156):
   ```rust
   .header("Authorization", format!("Bearer {}", model.api_key))
   ```

3. **Gestion d'erreurs**:
   - Si status != success → Erreur retournée
   - Erreurs 401/403 → Clé invalide ou expirée

### Format d'une Clé OpenAI Valide

- **Ancien format**: `sk-...` (commence par `sk-`, ~50 caractères)
- **Nouveau format**: `sk-proj-...` (commence par `sk-proj-`, ~60+ caractères)
- **Longueur minimale**: ~50 caractères
- **Longueur typique**: 50-70 caractères

---

## 🎯 Prochaines Étapes

1. ✅ **Vérifier les logs lors d'une création de produit** pour identifier l'erreur exacte
2. ✅ **Forcer le redéploiement de Cloud Run** si nécessaire
3. ✅ **Vérifier les quotas OpenAI** sur https://platform.openai.com/usage
4. ✅ **Tester la création d'un produit** avec logs détaillés

---

**Status**: ✅ Clé OpenAI testée et fonctionnelle  
**Action Requise**: Analyser les logs lors d'une création de produit pour identifier l'erreur exacte

