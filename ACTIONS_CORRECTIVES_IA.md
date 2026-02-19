# 🔧 Actions Correctives pour l'IA Externe

**Date**: 2026-02-19  
**Problème**: Le système utilise le fallback au lieu d'OpenAI

---

## ✅ Modifications Effectuées

### 1. Ajout de Logs de Debug dans `initialize_models()`

**Fichier**: `backend/src/services/app_ia.rs`

**Modifications**:
- ✅ Ajout d'un log INFO quand `OPENAI_API_KEY` est chargée
- ✅ Ajout d'un log ERROR quand `OPENAI_API_KEY` n'est pas trouvée
- ✅ Ajout d'un log INFO à la fin listant tous les modèles OpenAI initialisés
- ✅ Ajout d'un log WARN si aucun modèle OpenAI n'est initialisé

**Code ajouté**:
```rust
match std::env::var("OPENAI_API_KEY") {
    Ok(api_key) => {
        log::info!("[AppIA] ✅ OPENAI_API_KEY chargée (longueur: {}, préfixe: {}...)", 
                   api_key.len(), &api_key[..std::cmp::min(20, api_key.len())]);
        // ... ajout du modèle
    }
    Err(e) => {
        log::error!("[AppIA] ❌ OPENAI_API_KEY non trouvée: {} - Les modèles OpenAI ne seront pas disponibles", e);
    }
}

// À la fin de initialize_models()
let openai_models: Vec<&str> = models.iter()
    .filter(|m| m.name.starts_with("openai-"))
    .map(|m| m.name.as_str())
    .collect();
if !openai_models.is_empty() {
    log::info!("[AppIA] ✅ Modèles OpenAI initialisés: {:?} (total: {} modèles)", 
               openai_models, models.len());
} else {
    log::warn!("[AppIA] ⚠️ Aucun modèle OpenAI initialisé (total: {} modèles)", models.len());
}
```

---

## 🔍 Vérifications Effectuées

### 1. Configuration Cloud Run
- ✅ `OPENAI_API_KEY` configurée via Secret Manager
- ✅ Secret `openai-api-key:latest` existe et est valide (164 caractères)
- ✅ Service account: `github-actions@yukpo-project.iam.gserviceaccount.com`

### 2. Analyse des Logs
- ❌ Aucun log `[OpenAI] Tokens utilisés` trouvé
- ✅ Logs montrent `"ia_model_used": "fallback"`
- ✅ Tokens consommés: 5 (typique du fallback)

---

## 📋 Prochaines Étapes

### 1. Vérifier les Permissions Secret Manager

```bash
# Vérifier les permissions du secret
gcloud secrets get-iam-policy openai-api-key --project=yukpo-project

# Si nécessaire, accorder l'accès au service account
gcloud secrets add-iam-policy-binding openai-api-key \
    --member="serviceAccount:github-actions@yukpo-project.iam.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor" \
    --project=yukpo-project
```

### 2. Recompiler et Redéployer

```bash
# Recompiler le backend
cd backend
cargo build --release

# Redéployer sur Cloud Run
gcloud run deploy yukpo-backend \
    --source . \
    --region=europe-west1 \
    --project=yukpo-project
```

### 3. Surveiller les Logs d'Initialisation

Après le redéploiement, surveiller les logs pour voir:
- `[AppIA] ✅ OPENAI_API_KEY chargée` ou
- `[AppIA] ❌ OPENAI_API_KEY non trouvée`
- `[AppIA] ✅ Modèles OpenAI initialisés` ou
- `[AppIA] ⚠️ Aucun modèle OpenAI initialisé`

### 4. Tester la Création de Produit

Après vérification des logs, tester la création d'un produit et vérifier:
- Les logs montrent `[OpenAI] Tokens utilisés` au lieu de `fallback`
- Les tokens consommés sont > 5 (typiquement 100-1000+)

---

## 🔍 Diagnostic Attendu

### Si les Logs Montrent "OPENAI_API_KEY chargée"
✅ La variable est accessible → Le problème est ailleurs (erreurs lors des appels, timeouts, etc.)

### Si les Logs Montrent "OPENAI_API_KEY non trouvée"
❌ Problème de permissions ou de configuration → Vérifier les permissions Secret Manager

---

## 📝 Notes

- Les modifications de code sont prêtes mais nécessitent un redéploiement
- Les logs de debug aideront à identifier précisément le problème
- Une fois le problème identifié, on pourra ajuster la solution

