# 📋 Guide : Configuration Directe dans Cloud Run (Sans Workflow)

**Date**: 2026-02-19  
**Question**: Est-ce que les variables d'environnement comme la clé OpenAI peuvent être directement dans GCP, sans passer par le workflow de déploiement ?

**Réponse**: ✅ **OUI, absolument !** C'est même la **meilleure pratique** recommandée par Google.

---

## 🎯 Deux Approches Possibles

### ✅ Approche 1: Configuration Directe dans Cloud Run (RECOMMANDÉ)

**Avantages**:
- ✅ Configuration persistante entre les déploiements
- ✅ Modification sans redéploiement (pour certaines variables)
- ✅ Gestion centralisée dans la console GCP
- ✅ Pas besoin de modifier le workflow à chaque changement

**Comment faire**:
1. Aller dans [GCP Console](https://console.cloud.google.com/run?project=yukpo-project)
2. Cloud Run → `yukpo-backend` → **Modifier et déployer une nouvelle révision**
3. Onglet **"Variables et secrets"**
4. Ajouter les variables et secrets directement
5. **Déployer** (créera une nouvelle révision avec ces variables)

**Les variables restent** même si vous redéployez via le workflow GitHub Actions (sauf si le workflow utilise `--clear-env-vars` ou `--clear-secrets`).

---

### ⚙️ Approche 2: Configuration via Workflow (Actuelle)

**Avantages**:
- ✅ Configuration versionnée dans Git
- ✅ Cohérence entre environnements
- ✅ Automatisation complète

**Inconvénients**:
- ⚠️ Nécessite un commit pour changer une variable
- ⚠️ Peut écraser les variables configurées manuellement si mal configuré

---

## 🔧 Configuration Directe de OPENAI_API_KEY

### Méthode 1: Via Console GCP (Le Plus Simple)

#### Étape 1: Créer/Mettre à Jour le Secret dans Secret Manager

1. Aller sur [Secret Manager](https://console.cloud.google.com/security/secret-manager?project=yukpo-project)
2. Si le secret `openai-api-key` existe :
   - Cliquer dessus
   - **"Ajouter une nouvelle version"**
   - Coller votre vraie clé OpenAI (format: `sk-proj-...` ou `sk-...`)
   - **Ajouter la version**
3. Si le secret n'existe pas :
   - **Créer un secret**
   - Nom: `openai-api-key`
   - Valeur: Votre clé OpenAI
   - **Créer le secret**

#### Étape 2: Configurer dans Cloud Run

1. Aller sur [Cloud Run](https://console.cloud.google.com/run?project=yukpo-project)
2. Cliquer sur `yukpo-backend`
3. **"Modifier et déployer une nouvelle révision"**
4. Onglet **"Variables et secrets"**
5. Section **"Référencer un secret"** :
   - Cliquer **"Ajouter une référence de secret"**
   - Nom de la variable: `OPENAI_API_KEY`
   - Secret: Sélectionner `openai-api-key`
   - Version: `latest` (ou une version spécifique)
   - **Enregistrer**
6. **Déployer** (créera une nouvelle révision)

✅ **C'est tout !** La variable sera disponible dans toutes les révisions futures, même si vous redéployez via GitHub Actions.

---

### Méthode 2: Via gcloud CLI

```powershell
# 1. Mettre à jour le secret dans Secret Manager
$apiKey = "sk-proj-VOTRE_CLE_OPENAI_ICI"
$apiKey | gcloud secrets versions add openai-api-key --data-file=- --project=yukpo-project

# 2. Vérifier les permissions IAM (donner accès au service account)
$serviceAccount = "yukpo-backend@yukpo-project.iam.gserviceaccount.com"
gcloud secrets add-iam-policy-binding openai-api-key `
  --member="serviceAccount:$serviceAccount" `
  --role="roles/secretmanager.secretAccessor" `
  --project=yukpo-project

# 3. Ajouter la référence dans Cloud Run
gcloud run services update yukpo-backend `
  --region=europe-west1 `
  --project=yukpo-project `
  --update-secrets="OPENAI_API_KEY=openai-api-key:latest"
```

✅ **C'est tout !** Le service sera automatiquement redéployé avec la nouvelle configuration.

---

## 🔍 Vérification

### Vérifier que OPENAI_API_KEY est configurée

```powershell
# Voir toutes les variables d'environnement et secrets
gcloud run services describe yukpo-backend `
  --region=europe-west1 `
  --project=yukpo-project `
  --format="yaml(spec.template.spec.containers[0].env)"
```

Vous devriez voir :
```yaml
- name: OPENAI_API_KEY
  valueFrom:
    secretKeyRef:
      name: openai-api-key
      version: latest
```

### Vérifier la valeur du secret

```powershell
# Voir la longueur (sans afficher la valeur complète)
$secret = gcloud secrets versions access latest --secret=openai-api-key --project=yukpo-project
Write-Host "Longueur: $($secret.Length) caractères"
Write-Host "Préfixe: $($secret.Substring(0, 10))..."
```

---

## ⚠️ Interaction avec le Workflow GitHub Actions

### Comportement Actuel du Workflow

Le workflow utilise `--update-secrets` qui **ajoute** ou **met à jour** les secrets, mais **ne supprime pas** les secrets déjà configurés.

```yaml
--update-secrets="JWT_SECRET=jwt-secret:latest,DATABASE_URL=database-url:latest,...,OPENAI_API_KEY=openai-api-key:latest"
```

**Cela signifie**:
- ✅ Si vous configurez `OPENAI_API_KEY` directement dans Cloud Run, elle **reste** même après un déploiement via workflow
- ✅ Si le workflow référence aussi `OPENAI_API_KEY`, il va juste **s'assurer** qu'elle est bien là (pas de conflit)
- ⚠️ Si le workflow utilise `--clear-secrets`, alors **tous** les secrets seraient supprimés (mais ce n'est pas le cas actuellement)

### Recommandation

**Approche hybride** (la meilleure):
1. ✅ Configurer les secrets **une fois** directement dans Cloud Run (ou via script)
2. ✅ Garder la référence dans le workflow pour **cohérence** et **documentation**
3. ✅ Le workflow ne fait que **vérifier** que les secrets sont bien référencés

---

## 🚨 Problème Actuel Identifié

D'après le diagnostic, le secret `openai-api-key` existe mais contient **seulement 2 caractères** au lieu d'une vraie clé OpenAI.

### Solution Rapide

```powershell
# Utiliser le script de mise à jour
.\scripts\mettre-a-jour-secret-openai-gcp.ps1 -ApiKey "sk-proj-VOTRE_VRAIE_CLE_ICI"
```

Ou manuellement :

```powershell
# 1. Obtenir votre clé OpenAI depuis https://platform.openai.com/api-keys
$apiKey = "sk-proj-VOTRE_CLE_COMPLETE_ICI"

# 2. Mettre à jour le secret
$apiKey | gcloud secrets versions add openai-api-key --data-file=- --project=yukpo-project

# 3. Vérifier
$secret = gcloud secrets versions access latest --secret=openai-api-key --project=yukpo-project
Write-Host "Longueur: $($secret.Length) caractères (devrait être > 50)"
```

---

## ✅ Checklist de Configuration

- [ ] Secret `openai-api-key` créé dans Secret Manager avec une **vraie clé OpenAI** (> 50 caractères)
- [ ] Permissions IAM : Service Account a accès au secret
- [ ] Variable `OPENAI_API_KEY` référencée dans Cloud Run (via console ou gcloud)
- [ ] Vérification : Le secret fait > 50 caractères
- [ ] Test : Créer un produit et vérifier que l'IA fonctionne
- [ ] Logs : Aucune erreur 401/403 OpenAI dans les logs

---

## 📝 Résumé

**Réponse à votre question** :
- ✅ **OUI**, vous pouvez configurer `OPENAI_API_KEY` directement dans Cloud Run
- ✅ **NON**, vous n'avez pas besoin de la mettre dans le workflow (mais c'est bien de la référencer pour documentation)
- ✅ La configuration dans Cloud Run **persiste** entre les déploiements
- ✅ Le workflow **ne supprime pas** les secrets déjà configurés (sauf si vous utilisez `--clear-secrets`)

**Action immédiate** :
1. Mettre à jour le secret `openai-api-key` dans Secret Manager avec une vraie clé
2. S'assurer que `OPENAI_API_KEY` est référencée dans Cloud Run
3. Tester la création d'un produit

---

## 🔗 Liens Utiles

- [Console Cloud Run](https://console.cloud.google.com/run?project=yukpo-project)
- [Secret Manager](https://console.cloud.google.com/security/secret-manager?project=yukpo-project)
- [Documentation Cloud Run - Variables d'environnement](https://cloud.google.com/run/docs/configuring/environment-variables)
- [Documentation Secret Manager](https://cloud.google.com/secret-manager/docs)

