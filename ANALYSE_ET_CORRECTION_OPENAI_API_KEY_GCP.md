# 🔍 Analyse et Correction - OPENAI_API_KEY dans GCP

**Date**: 2026-02-19  
**Projet**: yukpo-project  
**Service**: yukpo-backend  
**Région**: europe-west1

---

## 📊 Résultats du Diagnostic

### ✅ Ce qui fonctionnait

1. **Secret existe dans Secret Manager**
   - Secret `openai-api-key` présent
   - Version la plus récente: 1
   - Format de la clé valide (commence par `sk-`)

2. **Service Account identifié**
   - Service Account: `github-actions@yukpo-project.iam.gserviceaccount.com`

3. **Aucune erreur dans les logs récents**
   - Pas d'erreurs OPENAI_API_KEY visibles dans les logs

### ❌ Problèmes identifiés

1. **Service Account n'avait PAS accès au secret**
   - Le Service Account `github-actions@yukpo-project.iam.gserviceaccount.com` n'avait pas le rôle `secretmanager.secretAccessor`
   - **Impact**: Le service Cloud Run ne pouvait pas lire le secret même s'il était référencé

2. **OPENAI_API_KEY n'était PAS configurée dans Cloud Run**
   - La variable d'environnement `OPENAI_API_KEY` n'était pas référencée dans la configuration Cloud Run
   - **Impact**: Le backend ne pouvait pas accéder à la clé API via `std::env::var("OPENAI_API_KEY")`

---

## 🔧 Corrections Appliquées

### 1. Attribution des Permissions IAM

**Commande exécutée:**
```bash
gcloud secrets add-iam-policy-binding openai-api-key \
  --member="serviceAccount:github-actions@yukpo-project.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor" \
  --project=yukpo-project
```

**Résultat**: ✅ Permissions attribuées avec succès

### 2. Ajout de OPENAI_API_KEY dans Cloud Run

**Commande exécutée:**
```bash
gcloud run services update yukpo-backend \
  --region=europe-west1 \
  --project=yukpo-project \
  --update-secrets="OPENAI_API_KEY=openai-api-key:latest"
```

**Résultat**: ✅ Service Cloud Run mis à jour avec succès

**Vérification**: ✅ OPENAI_API_KEY est maintenant configurée dans Cloud Run

---

## 📝 Prochaines Étapes

### 1. Attendre le redéploiement (1-2 minutes)

Le service Cloud Run va être automatiquement redéployé avec la nouvelle configuration. Attendez que le déploiement soit terminé.

### 2. Vérifier les logs

Pour voir les logs en temps réel et confirmer que OPENAI_API_KEY est chargée:

```bash
gcloud logging tail "resource.type=cloud_run_revision AND resource.labels.service_name=yukpo-backend" --project=yukpo-project
```

**Ce qu'il faut chercher dans les logs:**
- ✅ Aucune erreur `OPENAI_API_KEY non configurée`
- ✅ Les appels IA fonctionnent correctement
- ✅ Les modèles OpenAI sont initialisés (dans `app_ia.rs`)

### 3. Tester la création d'un produit avec l'IA

1. Faire une requête de création de produit via l'API
2. Vérifier que l'IA génère bien les informations du produit
3. Vérifier les logs pour confirmer l'utilisation de la clé API

---

## 🔍 Comment le Backend Utilise OPENAI_API_KEY

### Code Backend (Rust)

Le backend Rust charge la clé API de cette manière:

```rust
// Dans app_ia.rs (ligne 258)
if let Ok(api_key) = std::env::var("OPENAI_API_KEY") {
    // Initialise les modèles OpenAI
    models.push(ModelConfig {
        name: "openai-gpt4o".to_string(),
        api_key,
        // ...
    });
}
```

**Points importants:**
- Le code utilise `std::env::var("OPENAI_API_KEY")` pour charger la clé
- Si la variable n'existe pas, les modèles OpenAI ne sont pas initialisés
- Le service utilise alors les modèles de fallback (Mistral, Gemini, Anthropic) si configurés

### Services qui utilisent OPENAI_API_KEY

1. **OptimizedIAService** (`backend/src/services/ia/mod.rs`)
   - Création de services avec IA
   - Analyse multimodale (texte + images)
   - Génération de JSON structuré pour produits

2. **AIImageGenerationService** (`backend/src/services/ai_image_generation_service.rs`)
   - Génération d'images avec DALL-E 3
   - Images pour produits/services

3. **AudioTranscriptionService** (`backend/src/services/audio_transcription_service.rs`)
   - Transcription audio avec Whisper
   - Recherche vocale

4. **KYCService** (`backend/src/services/kyc_service.rs`)
   - Analyse automatique de documents
   - Extraction de données

---

## 🛠️ Scripts de Diagnostic et Correction

### Script de Diagnostic

```powershell
.\scripts\diagnostic-ia-gcp-simple.ps1
```

**Ce qu'il vérifie:**
- ✅ Existence du secret dans Secret Manager
- ✅ Permissions du Service Account
- ✅ Configuration dans Cloud Run
- ✅ Analyse des logs récents
- ✅ Test d'accès au secret

### Script de Correction

```powershell
.\scripts\fix-openai-api-key-gcp.ps1
```

**Ce qu'il fait:**
- ✅ Attribue les permissions IAM au Service Account
- ✅ Ajoute OPENAI_API_KEY dans Cloud Run
- ✅ Vérifie la configuration finale

**Mode Dry Run:**
```powershell
.\scripts\fix-openai-api-key-gcp.ps1 -DryRun
```

---

## ⚠️ Points d'Attention

### 1. Redéploiement Automatique

Après avoir ajouté `OPENAI_API_KEY` dans Cloud Run, le service est automatiquement redéployé. Cela peut prendre 1-2 minutes.

### 2. Vérification des Logs

Si après le redéploiement le problème persiste, vérifiez:
- Les logs de démarrage du service
- Les erreurs d'authentification OpenAI
- Les erreurs de permissions IAM

### 3. Fallback vers d'autres Modèles IA

Si `OPENAI_API_KEY` n'est pas disponible, le backend utilise les modèles de fallback dans cet ordre:
1. OpenAI (GPT-4o, GPT-4o-mini, GPT-3.5-turbo) - **PRIORITÉ 1**
2. Claude (Anthropic) - **PRIORITÉ 2**
3. Gemini (Google) - **PRIORITÉ 3**
4. DeepSeek - **PRIORITÉ 4**
5. Mistral - **PRIORITÉ 5**

---

## 📚 Documentation Référence

- [GCP Secret Manager Documentation](https://cloud.google.com/secret-manager/docs)
- [Cloud Run Environment Variables](https://cloud.google.com/run/docs/configuring/environment-variables)
- [GCP IAM Roles](https://cloud.google.com/iam/docs/understanding-roles)

---

## ✅ Checklist de Vérification

- [x] Secret `openai-api-key` existe dans Secret Manager
- [x] Service Account a accès au secret (rôle `secretmanager.secretAccessor`)
- [x] `OPENAI_API_KEY` référencée dans Cloud Run
- [ ] Service Cloud Run redéployé (attendre 1-2 minutes)
- [ ] Logs vérifiés (aucune erreur OPENAI_API_KEY)
- [ ] Test de création de produit avec IA réussi

---

**Status**: ✅ **CORRECTIONS APPLIQUÉES**  
**Prochaine Action**: Vérifier les logs après redéploiement et tester la création d'un produit

