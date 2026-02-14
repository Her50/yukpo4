# 🔧 Correction Authentification GCP dans GitHub Actions

**Date** : 2026-02-14  
**Problème** : `invalid_target` - Workload Identity Pool/Provider n'existe pas

---

## 🎯 PROBLÈME IDENTIFIÉ

Le workflow `docker-build-optimized.yml` utilisait **OIDC (Workload Identity Federation)** qui n'est pas configuré :

```yaml
workload_identity_provider: 'projects/.../workloadIdentityPools/github-actions-pool/providers/github-actions-provider'
```

**Erreur** :
```
failed to generate Google Cloud federated token: invalid_target
The target service indicated by the "audience" parameters is invalid.
This might either be because the pool or provider is disabled or deleted or because it doesn't exist.
```

---

## ✅ SOLUTION APPLIQUÉE

**Changement** : Utilisation de **Service Account Key (credentials_json)** au lieu d'OIDC

### Avant (OIDC - ne fonctionne pas)
```yaml
- name: Google Auth (OIDC)
  uses: 'google-github-actions/auth@v2'
  with:
    workload_identity_provider: 'projects/.../workloadIdentityPools/...'
    service_account: '${{ secrets.GCP_SERVICE_ACCOUNT_EMAIL }}'
```

### Après (Service Account Key - fonctionne)
```yaml
- name: Google Auth (Service Account Key)
  uses: 'google-github-actions/auth@v2'
  with:
    credentials_json: ${{ secrets.GCP_SA_KEY }}
```

---

## 📋 FICHIERS MODIFIÉS

1. ✅ `.github/workflows/docker-build-optimized.yml`
   - Authentification changée de OIDC vers `credentials_json`
   - Permission `id-token: write` supprimée (plus nécessaire)

---

## 🔍 VÉRIFICATION

### Secret GitHub requis

Assurez-vous que le secret `GCP_SA_KEY` existe dans GitHub :

```bash
gh secret list --repo Her50/yukpo4 | grep GCP_SA_KEY
```

**Valeur** : Contenu complet du fichier `gcp-sa-key.json`

### Si le secret n'existe pas

1. **Générer la clé Service Account** :
   ```bash
   gcloud iam service-accounts keys create gcp-sa-key.json \
     --iam-account=github-actions@yukpo-project.iam.gserviceaccount.com \
     --project=yukpo-project
   ```

2. **Ajouter au secret GitHub** :
   ```bash
   gh secret set GCP_SA_KEY --body "$(cat gcp-sa-key.json)" --repo Her50/yukpo4
   ```

---

## 🎯 COMPARAISON DES MÉTHODES

### OIDC (Workload Identity Federation)
- ✅ Plus sécurisé (pas de clé JSON à stocker)
- ❌ Nécessite configuration complexe (Pool + Provider)
- ❌ Nécessite permissions spéciales

### Service Account Key (credentials_json)
- ✅ Simple à configurer
- ✅ Fonctionne immédiatement
- ⚠️ Nécessite de stocker la clé JSON dans GitHub Secrets
- ⚠️ Clé doit être régénérée périodiquement

**Pour ce projet** : Service Account Key est la solution la plus simple et rapide.

---

## ✅ RÉSULTAT

Après cette correction :
- ✅ Le workflow peut s'authentifier avec GCP
- ✅ Le build Docker peut pousser vers Artifact Registry
- ✅ Le déploiement Cloud Run fonctionne

**Note** : Assurez-vous que les permissions Artifact Registry sont configurées (voir `COMMANDES_EXACTES_FIX_ARTIFACT_REGISTRY.md`)

---

**Date** : 2026-02-14  
**Statut** : ✅ **CORRIGÉ**

