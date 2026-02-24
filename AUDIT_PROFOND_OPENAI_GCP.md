# 🔍 Audit Profond - Configuration OpenAI dans GCP

**Date**: 2026-02-20  
**Problème**: L'application n'arrive pas à utiliser l'API OpenAI externe pour créer un produit, alors que tout semble OK côté backend et mobile.

---

## 🎯 Objectif de l'Audit

Comprendre pourquoi l'application déployée sur GCP Cloud Run n'arrive pas à accéder à l'API OpenAI pour créer des produits, malgré :
- ✅ Backend fonctionnel localement
- ✅ Mobile fonctionnel
- ✅ Configuration semble correcte

---

## 📋 Points de Vérification

### 1. Secret dans Secret Manager
- ✅ Le secret `openai-api-key` existe-t-il ?
- ✅ La valeur du secret est-elle valide (format `sk-...`) ?
- ✅ Le secret a-t-il une version active ?

### 2. Permissions IAM
- ✅ Le Service Account de Cloud Run a-t-il accès au secret ?
- ✅ Le rôle `secretmanager.secretAccessor` est-il attribué ?

### 3. Configuration Cloud Run
- ✅ La variable `OPENAI_API_KEY` est-elle référencée dans Cloud Run ?
- ✅ La référence pointe-t-elle vers le bon secret ?
- ✅ La version du secret est-elle correcte (`latest` ou numéro de version) ?

### 4. Variables d'Environnement
- ✅ Toutes les variables nécessaires sont-elles configurées ?
- ✅ Les variables sont-elles chargées au démarrage du service ?

### 5. Logs et Initialisation
- ✅ AppIA s'initialise-t-il au démarrage ?
- ✅ Les logs montrent-ils que `OPENAI_API_KEY` est chargée ?
- ✅ Y a-t-il des erreurs d'authentification OpenAI ?

### 6. Test d'Accès
- ✅ Le Service Account peut-il lire le secret ?
- ✅ Un appel API OpenAI direct fonctionne-t-il ?

---

## 🚀 Utilisation du Script d'Audit

### Exécuter l'Audit Complet

```powershell
.\scripts\audit-complet-openai-gcp.ps1
```

**Ce que le script vérifie :**
1. ✅ Existence du secret dans Secret Manager
2. ✅ Format et validité de la clé API
3. ✅ Permissions IAM du Service Account
4. ✅ Configuration dans Cloud Run
5. ✅ Analyse des logs récents (30 dernières minutes)
6. ✅ Test d'accès au secret
7. ✅ Liste des variables d'environnement configurées

**Résultat :**
- Rapport détaillé de tous les points de vérification
- Identification des problèmes
- Commandes de correction suggérées

---

## 🔧 Correction Automatique

Si l'audit identifie des problèmes, vous pouvez utiliser le script de correction :

```powershell
# Mode dry-run (vérification sans modification)
.\scripts\fix-openai-api-key-gcp.ps1 -DryRun

# Application des corrections
.\scripts\fix-openai-api-key-gcp.ps1
```

**Ce que le script fait :**
1. ✅ Identifie le Service Account de Cloud Run
2. ✅ Attribue les permissions IAM nécessaires
3. ✅ Ajoute `OPENAI_API_KEY` dans Cloud Run comme référence au secret
4. ✅ Vérifie la configuration finale

---

## 🔍 Vérifications Manuelles

### 1. Vérifier le Secret dans Secret Manager

```bash
# Vérifier que le secret existe
gcloud secrets describe openai-api-key --project=yukpo-project

# Vérifier la valeur (sans l'afficher complètement)
gcloud secrets versions access latest --secret=openai-api-key --project=yukpo-project | Select-String "^sk-"
```

**Résultat attendu :** Le secret doit exister et commencer par `sk-`

### 2. Vérifier les Permissions IAM

```bash
# Récupérer le Service Account
gcloud run services describe yukpo-backend \
  --region=europe-west1 \
  --format="value(spec.template.spec.serviceAccountName)" \
  --project=yukpo-project

# Vérifier les permissions
gcloud secrets get-iam-policy openai-api-key --project=yukpo-project
```

**Résultat attendu :** Le Service Account doit avoir le rôle `roles/secretmanager.secretAccessor`

### 3. Vérifier la Configuration Cloud Run

```bash
# Vérifier les variables d'environnement
gcloud run services describe yukpo-backend \
  --region=europe-west1 \
  --format="get(spec.template.spec.containers[0].env)" \
  --project=yukpo-project
```

**Résultat attendu :** `OPENAI_API_KEY` doit être présente et référencer `openai-api-key:latest`

### 4. Vérifier les Logs

```bash
# Voir les logs en temps réel
gcloud logging tail "resource.type=cloud_run_revision AND resource.labels.service_name=yukpo-backend" --project=yukpo-project

# Chercher les logs d'initialisation AppIA
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=yukpo-backend AND textPayload=~'AppIA'" --limit=50 --project=yukpo-project --format=json
```

**Ce qu'il faut chercher :**
- ✅ `[AppIA] ✅ OPENAI_API_KEY chargée`
- ✅ `[AppIA::initialize_models] ✅ OPENAI_API_KEY trouvée`
- ❌ `❌ OPENAI_API_KEY NON TROUVÉE`
- ❌ `❌ OPENAI_API_KEY non trouvée`

---

## 🐛 Problèmes Courants et Solutions

### Problème 1 : Secret n'existe pas

**Symptôme :** Le script d'audit indique que le secret n'existe pas

**Solution :**
```bash
# Créer le secret
echo -n "sk-proj-VOTRE-CLE-ICI" | gcloud secrets create openai-api-key \
  --data-file=- \
  --replication-policy="automatic" \
  --project=yukpo-project
```

### Problème 2 : Service Account n'a pas accès

**Symptôme :** Le secret existe mais le Service Account ne peut pas le lire

**Solution :**
```bash
# Récupérer le Service Account
SERVICE_ACCOUNT=$(gcloud run services describe yukpo-backend \
  --region=europe-west1 \
  --format="value(spec.template.spec.serviceAccountName)" \
  --project=yukpo-project)

# Attribuer les permissions
gcloud secrets add-iam-policy-binding openai-api-key \
  --member="serviceAccount:$SERVICE_ACCOUNT" \
  --role="roles/secretmanager.secretAccessor" \
  --project=yukpo-project
```

### Problème 3 : OPENAI_API_KEY non configurée dans Cloud Run

**Symptôme :** Le secret existe et a les permissions, mais Cloud Run ne le référence pas

**Solution :**
```bash
# Ajouter la référence au secret dans Cloud Run
gcloud run services update yukpo-backend \
  --region=europe-west1 \
  --project=yukpo-project \
  --update-secrets="OPENAI_API_KEY=openai-api-key:latest"
```

### Problème 4 : Service n'a pas redémarré

**Symptôme :** Configuration correcte mais l'IA ne fonctionne toujours pas

**Solution :**
```bash
# Forcer un redéploiement
gcloud run services update yukpo-backend \
  --region=europe-west1 \
  --project=yukpo-project \
  --no-traffic
```

### Problème 5 : Clé OpenAI invalide ou expirée

**Symptôme :** Configuration correcte mais erreurs 401/403 de l'API OpenAI

**Solution :**
1. Vérifier la clé sur https://platform.openai.com/api-keys
2. Vérifier les crédits sur https://platform.openai.com/usage
3. Vérifier les quotas sur https://platform.openai.com/account/limits
4. Mettre à jour le secret si nécessaire :
```bash
echo -n "sk-proj-NOUVELLE-CLE" | gcloud secrets versions add openai-api-key \
  --data-file=- \
  --project=yukpo-project
```

---

## 📊 Comment le Backend Utilise OPENAI_API_KEY

### Initialisation (app_ia.rs)

```rust
// Ligne 260-296
match std::env::var("OPENAI_API_KEY") {
    Ok(api_key) => {
        log::info!("[AppIA] ✅ OPENAI_API_KEY chargée");
        models.push(ModelConfig {
            name: "openai-gpt4o".to_string(),
            api_key,
            base_url: "https://api.openai.com/v1".to_string(),
            model: "gpt-4o".to_string(),
            // ...
        });
    }
    Err(e) => {
        log::error!("[AppIA] ❌ OPENAI_API_KEY non trouvée: {}", e);
    }
}
```

**Points importants :**
- Le code utilise `std::env::var("OPENAI_API_KEY")` pour charger la clé
- Si la variable n'existe pas, les modèles OpenAI ne sont pas initialisés
- Le service utilise alors les modèles de fallback (Mistral, Gemini, Anthropic) si configurés

### Appels API (app_ia.rs)

```rust
// Ligne 1248
.header("Authorization", format!("Bearer {}", model.api_key))
```

**Points importants :**
- L'API OpenAI est appelée via `https://api.openai.com/v1`
- L'authentification se fait via le header `Authorization: Bearer {api_key}`
- Les erreurs 401/403 indiquent généralement une clé invalide ou expirée

---

## ✅ Checklist de Vérification Complète

- [ ] Secret `openai-api-key` existe dans Secret Manager
- [ ] La valeur du secret est valide (commence par `sk-`)
- [ ] Service Account de Cloud Run a accès au secret (rôle `secretmanager.secretAccessor`)
- [ ] `OPENAI_API_KEY` est référencée dans Cloud Run
- [ ] La référence pointe vers `openai-api-key:latest`
- [ ] Service Cloud Run a été redéployé après configuration
- [ ] Logs montrent que `OPENAI_API_KEY` est chargée au démarrage
- [ ] Logs montrent que AppIA s'initialise correctement
- [ ] Aucune erreur 401/403 dans les logs
- [ ] Clé OpenAI a des crédits disponibles
- [ ] Quotas OpenAI ne sont pas dépassés

---

## 🎯 Prochaines Étapes Après Correction

1. **Attendre le redéploiement** (1-2 minutes)
2. **Vérifier les logs** pour confirmer que `OPENAI_API_KEY` est chargée
3. **Tester la création d'un produit** via l'API mobile
4. **Vérifier les logs** pour confirmer que l'IA est utilisée

---

## 📚 Documentation Référence

- [GCP Secret Manager](https://cloud.google.com/secret-manager/docs)
- [Cloud Run Environment Variables](https://cloud.google.com/run/docs/configuring/environment-variables)
- [GCP IAM Roles](https://cloud.google.com/iam/docs/understanding-roles)
- [OpenAI API Documentation](https://platform.openai.com/docs/api-reference)

---

**Status**: 🔍 **Audit disponible**  
**Script**: `.\scripts\audit-complet-openai-gcp.ps1`  
**Correction**: `.\scripts\fix-openai-api-key-gcp.ps1`

