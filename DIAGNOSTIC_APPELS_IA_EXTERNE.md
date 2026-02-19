# 🔍 Diagnostic : Appels IA Externe

**Date**: 2026-02-19  
**Problème**: Impossible d'accéder à l'IA externe malgré la clé OpenAI mise à jour

---

## ✅ Vérifications Effectuées

### 1. Configuration Cloud Run
- ✅ `OPENAI_API_KEY` est configurée dans Cloud Run
- ✅ Source: Secret Manager (`openai-api-key:latest`)
- ✅ Secret mis à jour avec la nouvelle clé (164 caractères, format `sk-proj-...`)

### 2. Redéploiement
- ✅ Service `yukpo-backend` redéployé
- ✅ Nouvelle révision: `yukpo-backend-00300-57s`
- ✅ Traffic redirigé vers la nouvelle révision

### 3. Appels API Détectés
- ✅ Appels à `/api/ia/creation-service` détectés dans les logs
- ✅ Latence: ~0.5-0.6s (suggère des appels IA)
- ❌ **Aucun log `[OpenAI] Tokens utilisés` trouvé** (indique que les appels OpenAI échouent)

---

## 🔍 Analyse des Logs

### Logs Attendus (si OpenAI fonctionne)
```
[OpenAI] Tokens utilisés: prompt=X, completion=Y, total=Z
[AppIA] ✅ Succès avec modèle: openai-gpt4o
```

### Logs Absents
- ❌ Aucun log `[OpenAI] Tokens utilisés` trouvé
- ❌ Aucun log de succès OpenAI
- ❌ Aucune erreur 401/403 visible dans les logs récents

---

## 🔍 Hypothèses

### Hypothèse 1: Clé OpenAI Non Chargée
**Symptôme**: Le service ne charge pas la nouvelle clé depuis Secret Manager

**Vérification**:
```bash
# Vérifier que le secret est bien accessible
gcloud secrets versions access latest --secret=openai-api-key --project=yukpo-project

# Vérifier que Cloud Run référence bien le secret
gcloud run services describe yukpo-backend --region=europe-west1 --project=yukpo-project --format="get(spec.template.spec.containers[0].env)"
```

### Hypothèse 2: Erreur Silencieuse
**Symptôme**: Les appels OpenAI échouent mais les erreurs ne sont pas loggées

**Vérification**:
- Chercher les logs d'erreur dans `app_ia.rs` ligne 1215: `log::error!("[OpenAI] {}", error_msg)`
- Vérifier les logs avec `severity>=ERROR`

### Hypothèse 3: Fallback Activé
**Symptôme**: Le système utilise un fallback au lieu d'OpenAI

**Vérification**:
- Chercher les logs `[AppIA] Aucun modèle activé, utilisation du fallback`
- Vérifier que les modèles OpenAI sont bien initialisés

### Hypothèse 4: Problème de Quota/Permissions
**Symptôme**: La clé est valide mais le compte OpenAI a des restrictions

**Vérification**:
- Vérifier le quota OpenAI sur https://platform.openai.com/usage
- Vérifier les restrictions de la clé API

---

## 🔧 Actions Recommandées

### 1. Vérifier les Logs d'Erreur Détaillés
```bash
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=yukpo-backend AND severity>=ERROR" --limit=100 --project=yukpo-project --format=json --freshness=1h | ConvertFrom-Json | Where-Object { $_.textPayload -like '*OpenAI*' -or $_.textPayload -like '*AppIA*' } | Select-Object -First 20
```

### 2. Vérifier l'Initialisation des Modèles
```bash
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=yukpo-backend" --limit=500 --project=yukpo-project --format=json --freshness=2h | ConvertFrom-Json | Where-Object { $_.textPayload -like '*Models*' -or $_.textPayload -like '*initializ*' -or $_.textPayload -like '*AppIA*' } | Select-Object -First 30
```

### 3. Tester la Clé OpenAI Directement
```bash
# Utiliser le script de test
.\scripts\test-openai-api-key.ps1
```

### 4. Vérifier les Variables d'Environnement au Runtime
Ajouter un log de debug dans `app_ia.rs` pour vérifier que `OPENAI_API_KEY` est bien chargée:
```rust
if let Ok(api_key) = std::env::var("OPENAI_API_KEY") {
    log::info!("[AppIA] ✅ OPENAI_API_KEY chargée (longueur: {})", api_key.len());
} else {
    log::error!("[AppIA] ❌ OPENAI_API_KEY non trouvée");
}
```

---

## 📋 Prochaines Étapes

1. ✅ Vérifier les logs d'erreur détaillés pour voir les erreurs OpenAI exactes
2. ✅ Vérifier que les modèles OpenAI sont bien initialisés au démarrage
3. ✅ Tester la clé OpenAI directement avec le script de test
4. ✅ Ajouter des logs de debug pour vérifier le chargement de la clé
5. ✅ Vérifier les quotas et restrictions de la clé OpenAI

---

## 💡 Note Importante

**GCP n'intègre PAS nativement les IA**. Votre code utilise l'API OpenAI externe (`https://api.openai.com/v1`), pas une API GCP native. GCP fournit uniquement l'infrastructure (Cloud Run, Secret Manager, etc.).

