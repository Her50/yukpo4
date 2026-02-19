# 🔍 Analyse Complète des Logs GCP - IA Externe

**Date**: 2026-02-19  
**Service**: yukpo-backend  
**Révision actuelle**: yukpo-backend-00304-bkm (déployée après commit bb9b98e)

---

## ✅ Configuration Vérifiée

### Variables d'Environnement Cloud Run
- ✅ `OPENAI_API_KEY` configurée via Secret Manager
- ✅ Secret: `openai-api-key:latest`
- ✅ Service account: `github-actions@yukpo-project.iam.gserviceaccount.com`
- ✅ Permissions: `roles/secretmanager.secretAccessor`

---

## 🔍 Commandes de Diagnostic

### 1. Vérifier les Logs d'Initialisation au Démarrage

```powershell
# Récupérer les logs d'initialisation de la nouvelle révision
gcloud logging read `
  "resource.type=cloud_run_revision AND 
   resource.labels.service_name=yukpo-backend AND 
   resource.labels.revision_name=yukpo-backend-00304-bkm AND 
   timestamp>='2026-02-19T15:00:00Z'" `
  --limit=200 `
  --project=yukpo-project `
  --format=json `
  --freshness=1h | `
  ConvertFrom-Json | `
  Where-Object { 
    ($_.textPayload -and (
      $_.textPayload -like '*AppIA*' -or 
      $_.textPayload -like '*OPENAI*' -or 
      $_.textPayload -like '*Modèles*' -or
      $_.textPayload -like '*initialis*'
    )) -or 
    ($_.jsonPayload.message -and (
      $_.jsonPayload.message -like '*AppIA*' -or 
      $_.jsonPayload.message -like '*OPENAI*' -or 
      $_.jsonPayload.message -like '*Modèles*'
    ))
  } | `
  Select-Object timestamp, severity, textPayload, @{N='message';E={$_.jsonPayload.message}} | `
  Format-Table -AutoSize
```

### 2. Vérifier les Logs d'Erreur

```powershell
# Logs d'erreur et warnings
gcloud logging read `
  "resource.type=cloud_run_revision AND 
   resource.labels.service_name=yukpo-backend AND 
   resource.labels.revision_name=yukpo-backend-00304-bkm AND 
   severity>=WARNING" `
  --limit=100 `
  --project=yukpo-project `
  --format=json `
  --freshness=1h | `
  ConvertFrom-Json | `
  Where-Object { $_.textPayload -or $_.jsonPayload } | `
  Select-Object -First 30 | `
  ForEach-Object { 
    $msg = if ($_.textPayload) { $_.textPayload } 
           elseif ($_.jsonPayload.message) { $_.jsonPayload.message } 
           else { "" }
    if ($msg) { 
      Write-Host "[$($_.timestamp)] $($_.severity): $msg" 
    }
  }
```

### 3. Vérifier les Appels IA Récents

```powershell
# Logs des appels IA avec fallback
gcloud logging read `
  "resource.type=cloud_run_revision AND 
   resource.labels.service_name=yukpo-backend AND 
   resource.labels.revision_name=yukpo-backend-00304-bkm AND 
   (textPayload=~'fallback' OR textPayload=~'ia_model_used' OR textPayload=~'tokens_consumed')" `
  --limit=50 `
  --project=yukpo-project `
  --format=json `
  --freshness=1h | `
  ConvertFrom-Json | `
  Where-Object { $_.textPayload -or $_.jsonPayload } | `
  Select-Object -First 20 | `
  ForEach-Object { 
    $msg = if ($_.textPayload) { $_.textPayload } 
           elseif ($_.jsonPayload.message) { $_.jsonPayload.message } 
           else { "" }
    if ($msg) { 
      Write-Host "[$($_.timestamp)] $($_.severity): $msg" 
    }
  }
```

### 4. Vérifier les Logs d'Appels OpenAI

```powershell
# Chercher les logs spécifiques OpenAI
gcloud logging read `
  "resource.type=cloud_run_revision AND 
   resource.labels.service_name=yukpo-backend AND 
   resource.labels.revision_name=yukpo-backend-00304-bkm AND 
   (textPayload=~'OpenAI' OR textPayload=~'openai-gpt4o' OR textPayload=~'Tokens utilisés')" `
  --limit=50 `
  --project=yukpo-project `
  --format=json `
  --freshness=1h | `
  ConvertFrom-Json | `
  Where-Object { $_.textPayload -or $_.jsonPayload } | `
  Select-Object -First 20 | `
  ForEach-Object { 
    $msg = if ($_.textPayload) { $_.textPayload } 
           elseif ($_.jsonPayload.message) { $_.jsonPayload.message } 
           else { "" }
    if ($msg) { 
      Write-Host "[$($_.timestamp)] $($_.severity): $msg" 
    }
  }
```

### 5. Vérifier les Logs de Démarrage (Premiers Logs)

```powershell
# Les 50 premiers logs de la révision (démarrage)
gcloud logging read `
  "resource.type=cloud_run_revision AND 
   resource.labels.service_name=yukpo-backend AND 
   resource.labels.revision_name=yukpo-backend-00304-bkm" `
  --limit=50 `
  --project=yukpo-project `
  --format="table(timestamp,severity,textPayload)" `
  --freshness=1h `
  --order=asc | `
  Select-Object -First 50
```

---

## 🔍 Points à Vérifier dans les Logs

### 1. Logs d'Initialisation Attendus

Après le redéploiement, vous devriez voir dans les logs de démarrage:

**Si OPENAI_API_KEY est chargée:**
```
[AppIA] ✅ OPENAI_API_KEY chargée (longueur: 164, préfixe: sk-proj-...)
[AppIA] ✅ Modèles OpenAI initialisés: ["openai-gpt4o", "openai-gpt4o-mini", "openai-gpt35"] (total: X modèles)
```

**Si OPENAI_API_KEY n'est PAS chargée:**
```
[AppIA] ❌ OPENAI_API_KEY non trouvée: environment variable not found - Les modèles OpenAI ne seront pas disponibles
[AppIA] ⚠️ Aucun modèle OpenAI initialisé (total: X modèles)
```

### 2. Logs d'Appels IA

**Si OpenAI fonctionne:**
```
[AppIA] Tentative avec modèle: openai-gpt4o (timeout: 30s)
[AppIA] ✅ Modèle openai-gpt4o réussi en XXXms, XXX tokens (tentative 1/2)
[OpenAI] Tokens utilisés: prompt=XXX, completion=XXX, total=XXX
```

**Si fallback est utilisé:**
```
[AppIA] Aucun modèle activé, utilisation du fallback
OU
[AppIA] Tous les modèles ont échoué, utilisation du fallback intelligent
```

### 3. Logs d'Erreur Potentiels

```
[AppIA] ⚠️ Modèle openai-gpt4o échec tentative 1/2: [erreur]
[AppIA] ❌ Modèle openai-gpt4o a échoué après 2 tentatives. Erreur finale: [erreur]
[AppIA] ❌ Rate limit dépassé pour le modèle openai-gpt4o
[AppIA] ❌ Limite de tokens dépassée pour le modèle openai-gpt4o
```

---

## 🔧 Diagnostic selon les Résultats

### Scénario 1: Logs montrent "OPENAI_API_KEY chargée" mais "Aucun modèle OpenAI initialisé"
**Problème**: Erreur lors de l'ajout des modèles à la liste  
**Solution**: Vérifier les erreurs de compilation ou de logique dans `initialize_models()`

### Scénario 2: Logs montrent "OPENAI_API_KEY non trouvée"
**Problème**: Variable d'environnement non accessible au runtime  
**Causes possibles**:
- Secret Manager n'injecte pas la variable
- Permissions insuffisantes
- Service account n'a pas accès au secret

**Solutions**:
```powershell
# Vérifier les permissions du secret
gcloud secrets get-iam-policy openai-api-key --project=yukpo-project

# Si nécessaire, accorder l'accès
gcloud secrets add-iam-policy-binding openai-api-key \
  --member="serviceAccount:github-actions@yukpo-project.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor" \
  --project=yukpo-project

# Vérifier que le secret existe et est valide
gcloud secrets versions access latest --secret=openai-api-key --project=yukpo-project
```

### Scénario 3: Logs montrent "Modèles OpenAI initialisés" mais "fallback utilisé"
**Problème**: Les modèles sont initialisés mais échouent lors des appels  
**Causes possibles**:
- Clé API invalide ou expirée
- Rate limit OpenAI
- Timeout trop court
- Erreur réseau

**Solutions**:
- Vérifier les logs d'erreur détaillés (`[AppIA] ⚠️ Modèle ... échec`)
- Tester la clé API directement
- Vérifier les quotas OpenAI

### Scénario 4: Aucun log d'initialisation trouvé
**Problème**: Les logs ne sont pas générés ou la révision n'a pas redémarré  
**Solutions**:
- Vérifier que la révision a bien été déployée
- Attendre quelques minutes pour que les logs apparaissent
- Vérifier les filtres de logs

---

## 📋 Checklist de Diagnostic

- [ ] Exécuter la commande 1 (logs d'initialisation)
- [ ] Vérifier si les logs montrent "OPENAI_API_KEY chargée" ou "non trouvée"
- [ ] Vérifier si les logs montrent "Modèles OpenAI initialisés" ou "Aucun modèle"
- [ ] Exécuter la commande 2 (logs d'erreur)
- [ ] Exécuter la commande 3 (appels IA avec fallback)
- [ ] Exécuter la commande 4 (logs OpenAI)
- [ ] Exécuter la commande 5 (logs de démarrage)
- [ ] Identifier le scénario correspondant
- [ ] Appliquer les solutions recommandées

---

## 💡 Notes Importantes

1. **Les logs peuvent prendre quelques minutes à apparaître** après le déploiement
2. **Les logs d'initialisation** ne sont générés qu'au démarrage de la révision
3. **Les logs d'appels IA** sont générés à chaque requête
4. **Le fallback** est utilisé si:
   - Aucun modèle n'est initialisé (`enabled_models.is_empty()`)
   - Tous les modèles échouent lors des appels

---

## 🔗 Références

- Code: `backend/src/services/app_ia.rs` lignes 254-514 (initialisation)
- Code: `backend/src/services/app_ia.rs` lignes 521-662 (predict avec fallback)
- Code: `backend/src/services/app_ia.rs` lignes 2070-2094 (generate_fallback_response)

