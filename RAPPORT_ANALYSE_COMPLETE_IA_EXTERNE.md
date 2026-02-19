# 🔍 Rapport d'Analyse Complète : IA Externe

**Date**: 2026-02-19  
**Service**: yukpo-backend  
**Révision**: yukpo-backend-00300-57s (déployée à 13:54:16)

---

## ✅ Configuration Cloud Run

### Variables d'Environnement
- ✅ `OPENAI_API_KEY` est configurée
- ✅ Source: Secret Manager (`openai-api-key:latest`)
- ✅ Référence correcte dans Cloud Run

### Secret Manager
- ✅ Secret `openai-api-key` existe
- ✅ Longueur: 164 caractères
- ✅ Format: `sk-proj-...` (correct)

---

## 🔍 Analyse des Logs

### Constatations Clés

1. **Appels IA Détectés**
   - ✅ Appels à `/api/ia/creation-service` présents
   - ✅ Latence: ~0.5-0.6s
   - ✅ Status: 200 (succès)

2. **Problème Identifié**
   - ❌ **Le système utilise le FALLBACK au lieu d'OpenAI**
   - ❌ Logs montrent: `"ia_model_used": "fallback"`
   - ❌ Tokens consommés: 5 (très faible, typique du fallback)
   - ❌ Aucun log `[OpenAI] Tokens utilisés` trouvé

### Exemple de Log Trouvé
```json
{
  "ia_model_used": "fallback",
  "tokens_consumed": 5,
  "x-response-source": "external",
  "x-processing-time-ms": "543"
}
```

---

## 🔍 Analyse du Code

### Initialisation des Modèles (`app_ia.rs` ligne 254-275)

```rust
fn initialize_models() -> Vec<ModelConfig> {
    let mut models = Vec::new();

    // OpenAI GPT-4o (priorité haute)
    if let Ok(api_key) = std::env::var("OPENAI_API_KEY") {
        models.push(ModelConfig {
            name: "openai-gpt4o".to_string(),
            api_key,
            // ...
            enabled: true,
        });
    }
    // Si OPENAI_API_KEY n'est pas trouvée, le modèle n'est pas ajouté
}
```

**Problème potentiel**: Si `std::env::var("OPENAI_API_KEY")` échoue silencieusement, aucun modèle OpenAI n'est ajouté.

---

## 🔍 Hypothèses

### Hypothèse 1: Variable Non Chargée au Runtime ⚠️ **PROBABLE**
**Symptôme**: Le code vérifie `std::env::var("OPENAI_API_KEY")` mais la variable n'est pas accessible au runtime

**Causes possibles**:
1. Secret Manager n'injecte pas la variable correctement
2. Le service n'a pas redémarré après la mise à jour du secret
3. Problème de permissions Cloud Run → Secret Manager

**Vérification**:
```bash
# Vérifier les permissions
gcloud run services describe yukpo-backend --region=europe-west1 --project=yukpo-project --format="get(spec.template.spec.serviceAccountName)"
```

### Hypothèse 2: Erreur Silencieuse lors de l'Initialisation
**Symptôme**: `std::env::var("OPENAI_API_KEY")` retourne `Err` mais aucun log d'erreur

**Solution**: Ajouter un log de debug dans `initialize_models()`

### Hypothèse 3: Modèles Désactivés ou Erreurs lors des Appels
**Symptôme**: Les modèles sont initialisés mais échouent lors des appels

**Vérification**: Chercher les logs `[AppIA] ⚠️ Erreur avec` ou `[AppIA] ⚠️ Timeout`

---

## 🔧 Actions Correctives Recommandées

### 1. Ajouter des Logs de Debug dans `initialize_models()`

```rust
fn initialize_models() -> Vec<ModelConfig> {
    let mut models = Vec::new();

    // Log de debug pour vérifier le chargement
    match std::env::var("OPENAI_API_KEY") {
        Ok(api_key) => {
            log::info!("[AppIA] ✅ OPENAI_API_KEY chargée (longueur: {})", api_key.len());
            models.push(ModelConfig {
                name: "openai-gpt4o".to_string(),
                api_key,
                // ...
            });
        }
        Err(e) => {
            log::error!("[AppIA] ❌ OPENAI_API_KEY non trouvée: {}", e);
        }
    }

    log::info!("[AppIA] Modèles initialisés: {} modèles", models.len());
    models
}
```

### 2. Vérifier les Permissions Cloud Run → Secret Manager

```bash
# Vérifier le service account
gcloud run services describe yukpo-backend --region=europe-west1 --project=yukpo-project --format="get(spec.template.spec.serviceAccountName)"

# Vérifier les permissions
gcloud projects get-iam-policy yukpo-project --flatten="bindings[].members" --filter="bindings.members:*compute* OR bindings.members:*run*" --format="table(bindings.role)"
```

### 3. Forcer un Redéploiement Complet

```bash
# Redéployer avec une nouvelle révision
gcloud run services update yukpo-backend --region=europe-west1 --project=yukpo-project --no-traffic
gcloud run services update-traffic yukpo-backend --region=europe-west1 --project=yukpo-project --to-latest
```

### 4. Tester la Clé Directement dans le Container

Ajouter un endpoint de test temporaire pour vérifier que la variable est accessible:

```rust
// Dans un controller de test
pub async fn test_openai_key() -> AppResult<Json<Value>> {
    match std::env::var("OPENAI_API_KEY") {
        Ok(key) => Ok(Json(json!({
            "status": "ok",
            "key_length": key.len(),
            "key_prefix": &key[..20]
        }))),
        Err(e) => Ok(Json(json!({
            "status": "error",
            "error": e.to_string()
        })))
    }
}
```

---

## 📋 Checklist de Diagnostic

- [x] Vérifier la configuration Cloud Run
- [x] Vérifier le secret dans Secret Manager
- [x] Analyser les logs d'erreur
- [x] Analyser les logs d'appels IA
- [ ] Vérifier les permissions Cloud Run → Secret Manager
- [ ] Ajouter des logs de debug dans `initialize_models()`
- [ ] Tester la variable d'environnement au runtime
- [ ] Vérifier les logs d'initialisation au démarrage

---

## 💡 Conclusion

Le problème principal est que **le système utilise le fallback au lieu d'OpenAI**. Cela suggère que:

1. Soit `OPENAI_API_KEY` n'est pas chargée au runtime
2. Soit les modèles OpenAI échouent silencieusement lors des appels
3. Soit il y a un problème de permissions Cloud Run → Secret Manager

**Action immédiate recommandée**: Ajouter des logs de debug dans `initialize_models()` pour vérifier si la variable est chargée.

