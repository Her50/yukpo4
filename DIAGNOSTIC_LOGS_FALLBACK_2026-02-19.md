# 🔍 Diagnostic : Logs Fallback IA - 2026-02-19

**Problème**: Le système utilise le fallback au lieu d'OpenAI, mais aucun log d'initialisation AppIA n'apparaît dans les logs Cloud Run.

**Révision analysée**: `yukpo-backend-00304-bkm`

---

## ✅ Modifications Effectuées

### 1. Ajout de Logs de Diagnostic dans `main.rs`

**Fichier**: `backend/src/main.rs` (lignes ~2526-2560)

**Modifications**:
- ✅ Vérification de `OPENAI_API_KEY` **avant** l'initialisation de `AppIA`
- ✅ Logs sur `stderr` (eprintln!) pour garantir la visibilité dans Cloud Run
- ✅ Logs structurés avec `log::info!` et `log::error!`
- ✅ Vérification du nombre de modèles initialisés après création de `AppIA`
- ✅ Avertissement si aucun modèle n'est initialisé

**Code ajouté**:
```rust
// ✅ DIAGNOSTIC 2026-02-19: Vérifier OPENAI_API_KEY avant initialisation AppIA
let openai_key_check = std::env::var("OPENAI_API_KEY");
match &openai_key_check {
    Ok(key) => {
        log::info!(
            "[MAIN] ✅ OPENAI_API_KEY détectée avant initialisation AppIA (longueur: {}, préfixe: {}...)",
            key.len(),
            &key[..std::cmp::min(20, key.len())]
        );
        eprintln!(
            "[MAIN] ✅ OPENAI_API_KEY détectée avant initialisation AppIA (longueur: {})",
            key.len()
        );
    }
    Err(e) => {
        log::error!(
            "[MAIN] ❌ OPENAI_API_KEY NON TROUVÉE avant initialisation AppIA: {}",
            e
        );
        eprintln!(
            "[MAIN] ❌ OPENAI_API_KEY NON TROUVÉE avant initialisation AppIA: {}",
            e
        );
    }
}

// Après initialisation AppIA
let models_count = app_ia.models.read().unwrap().len();
log::info!(
    "[MAIN] ✅ AppIA initialisé avec {} modèle(s) IA",
    models_count
);
```

---

### 2. Amélioration des Logs dans `app_ia.rs::initialize_models()`

**Fichier**: `backend/src/services/app_ia.rs` (lignes ~254-514)

**Modifications**:
- ✅ Logs `eprintln!` au début de `initialize_models()` pour diagnostic Cloud Run
- ✅ Logs `eprintln!` quand `OPENAI_API_KEY` est trouvée ou non trouvée
- ✅ Logs `eprintln!` listant tous les modèles OpenAI initialisés
- ✅ Logs `eprintln!` listant **tous** les modèles initialisés (pas seulement OpenAI)
- ✅ Avertissement explicite si aucun modèle OpenAI n'est initialisé

**Code ajouté**:
```rust
fn initialize_models() -> Vec<ModelConfig> {
    // ✅ DIAGNOSTIC 2026-02-19: Logs immédiats sur stderr pour diagnostic Cloud Run
    eprintln!("[AppIA::initialize_models] 🚀 Début initialisation des modèles IA...");
    
    // ... code d'initialisation ...
    
    // À la fin
    eprintln!(
        "[AppIA::initialize_models] 📋 Tous les modèles initialisés: {:?}",
        all_model_names
    );
}
```

---

### 3. Amélioration des Logs dans `app_ia.rs::predict()`

**Fichier**: `backend/src/services/app_ia.rs` (lignes ~607-680)

**Modifications**:
- ✅ Logs détaillés quand aucun modèle n'est activé
- ✅ Liste des modèles disponibles avant tentative de prédiction
- ✅ Logs détaillés quand tous les modèles échouent
- ✅ Affichage de la dernière erreur rencontrée

**Code ajouté**:
```rust
if enabled_models.is_empty() {
    eprintln!("[AppIA::predict] ⚠️ Aucun modèle activé - Utilisation du fallback");
    eprintln!("[AppIA::predict] 📊 Total modèles dans la liste: {}", models.len());
    let all_model_names: Vec<&str> = models.iter().map(|m| m.name.as_str()).collect();
    eprintln!("[AppIA::predict] 📋 Modèles dans la liste: {:?}", all_model_names);
    // ... fallback ...
}

// Avant les tentatives
let model_names: Vec<&str> = enabled_models.iter().map(|m| m.name.as_str()).collect();
eprintln!(
    "[AppIA::predict] 🔍 {} modèle(s) disponible(s) pour prédiction: {:?}",
    enabled_models.len(),
    model_names
);
```

---

## 🔍 Prochaines Étapes

### 1. Déployer la Nouvelle Version

```bash
# Build et déployer
cd backend
cargo build --release
# ... déploiement Cloud Run ...
```

### 2. Analyser les Nouveaux Logs

Après déploiement, récupérer les logs avec :

```powershell
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=yukpo-backend AND resource.labels.revision_name=yukpo-backend-XXXXX" --limit=200 --project=yukpo-project --format=json --freshness=2h 2>&1 | Out-File -FilePath "$env:TEMP\gcp_logs_analysis.json" -Encoding utf8
```

### 3. Rechercher les Logs de Diagnostic

Rechercher dans les logs :
- `[MAIN] ✅ OPENAI_API_KEY détectée` ou `[MAIN] ❌ OPENAI_API_KEY NON TROUVÉE`
- `[AppIA::initialize_models] 🚀 Début initialisation`
- `[AppIA::initialize_models] ✅ Modèles OpenAI initialisés` ou `⚠️ Aucun modèle OpenAI initialisé`
- `[AppIA::predict] 🔍 X modèle(s) disponible(s)`
- `[AppIA::predict] ⚠️ Aucun modèle activé` ou `⚠️ Tous les modèles ont échoué`

---

## 📋 Scénarios Possibles

### Scénario 1: Variable d'Environnement Non Chargée
**Symptôme**: Logs montrent `[MAIN] ❌ OPENAI_API_KEY NON TROUVÉE`
**Cause**: Secret Manager non accessible ou variable non injectée
**Solution**: Vérifier les permissions Secret Manager et la configuration Cloud Run

### Scénario 2: Modèles Initialisés mais Échec lors des Appels
**Symptôme**: Logs montrent `✅ Modèles OpenAI initialisés` mais `⚠️ Tous les modèles ont échoué`
**Cause**: Problème réseau, API key invalide, ou timeout
**Solution**: Vérifier les logs d'erreur détaillés pour chaque modèle

### Scénario 3: Aucun Modèle Initialisé
**Symptôme**: Logs montrent `⚠️ Aucun modèle OpenAI initialisé`
**Cause**: `OPENAI_API_KEY` non accessible dans `initialize_models()`
**Solution**: Vérifier l'ordre d'initialisation et le chargement des variables d'environnement

---

## 🔧 Commandes Utiles

### Vérifier les Variables d'Environnement Cloud Run

```bash
gcloud run services describe yukpo-backend --region=europe-west1 --project=yukpo-project --format="get(spec.template.spec.containers[0].env)"
```

### Vérifier les Secrets Configurés

```bash
gcloud run services describe yukpo-backend --region=europe-west1 --project=yukpo-project --format="get(spec.template.spec.containers[0].env[?name=='OPENAI_API_KEY'])"
```

### Vérifier les Permissions Secret Manager

```bash
gcloud projects get-iam-policy yukpo-project --flatten="bindings[].members" --filter="bindings.members:github-actions@yukpo-project.iam.gserviceaccount.com"
```

---

## 📊 Résultats Attendus

Après déploiement, les logs devraient montrer :

1. **Au démarrage**:
   ```
   [MAIN] ✅ OPENAI_API_KEY détectée avant initialisation AppIA (longueur: 164)
   [AppIA::initialize_models] 🚀 Début initialisation des modèles IA...
   [AppIA::initialize_models] ✅ OPENAI_API_KEY trouvée (longueur: 164, préfixe: sk-proj-...)
   [AppIA::initialize_models] ✅ Modèles OpenAI initialisés: ["openai-gpt4o", "openai-gpt4o-mini", "openai-gpt35"] (total: 3 modèles)
   [MAIN] ✅ AppIA initialisé avec 3 modèle(s) IA
   ```

2. **Lors d'un appel IA**:
   ```
   [AppIA::predict] 🔍 3 modèle(s) disponible(s) pour prédiction: ["openai-gpt4o", "openai-gpt4o-mini", "openai-gpt35"]
   [AppIA] Tentative avec modèle: openai-gpt4o (timeout: 30s)
   [AppIA] ✅ Succès avec openai-gpt4o en 1234ms (150 tokens)
   ```

3. **Si problème**:
   ```
   [MAIN] ❌ OPENAI_API_KEY NON TROUVÉE avant initialisation AppIA: environment variable not found
   [AppIA::initialize_models] ❌ OPENAI_API_KEY NON TROUVÉE: environment variable not found
   [AppIA::initialize_models] ⚠️ Aucun modèle OpenAI initialisé (total: 0 modèles)
   [MAIN] ⚠️ ATTENTION: Aucun modèle IA initialisé - Le système utilisera uniquement le fallback
   ```

---

**Date**: 2026-02-19  
**Auteur**: Assistant IA  
**Status**: ✅ Modifications complétées, en attente de déploiement et analyse des logs

