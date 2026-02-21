# Vérification CDN S3 GCP – Sauvegarde médias et variables d'environnement

**Date** : 21 février 2026  
**Objectif** : Vérifier que le schéma CDN S3 de sauvegarde des médias est opérationnel sur GCP et que les variables d'environnement correspondent bien à GCP (et non à AWS/Wasabi).

---

## 1. Résumé

| Élément | Statut | Détail |
|--------|--------|--------|
| **gcp-env-vars.json** | ✅ **Correct** | Toutes les variables S3/CDN pointent vers GCP. |
| **Script sync-all-variables-to-gcp.ps1** | ❌ **À corriger** | Contient encore des valeurs **AWS/Cloudflare** pour S3 et CDN ; risque d’écraser la config GCP si le script est exécuté. |
| **Backend (storage.rs, media_storage_service.rs)** | ✅ **Compatible** | Lit S3_*, UPLOAD_BASE_URL, PUBLIC_BASE_URL ; fonctionne avec GCS via endpoint S3-compatible (HMAC). |
| **Secrets Cloud Run (S3_ACCESS_KEY, S3_SECRET_KEY)** | ⚠️ **À vérifier** | Doivent contenir les **clés HMAC GCS** (format Access ID type `GOOG1E...` + Secret). Un ancien rapport signalait des erreurs Python dans les secrets. |
| **Workflow gcp-deploy.yml** | ⚠️ **À noter** | N’injecte pas S3_ACCESS_KEY/S3_SECRET_KEY dans `--update-secrets` ; ils viennent d’une mise à jour manuelle/script antérieure. |

---

## 2. Valeurs attendues pour GCP (schéma CDN S3 naif GCP)

Le backend utilise l’API S3-compatible avec **Google Cloud Storage** via :
- **Endpoint** : `https://storage.googleapis.com`
- **Authentification** : clés **HMAC** GCS (Access ID + Secret), exposées comme `S3_ACCESS_KEY` et `S3_SECRET_KEY`.

### 2.1 Variables d'environnement (non sensibles)

| Variable | Valeur GCP attendue | Valeur AWS/Wasabi (à ne plus utiliser) |
|---------|---------------------|----------------------------------------|
| `UPLOAD_BASE_URL` | `http://34.54.117.97` | ~~`https://cdn.yukpomnang.com`~~ |
| `PUBLIC_BASE_URL` | `http://34.54.117.97` | ~~`https://cdn.yukpomnang.com`~~ |
| `S3_BUCKET` | `yukpo-project-yukpo-backend-media` | ~~`yukpomnang-media-prod`~~ / ~~`yukpo-video-prod`~~ |
| `S3_REGION` | `europe-west1` | ~~`us-east-1`~~ / ~~`eu-central-1`~~ |
| `S3_ENDPOINT` | `https://storage.googleapis.com` | ~~vide~~ / ~~`https://s3.eu-central-1.wasabisys.com`~~ |
| `S3_FORCE_PATH_STYLE` | `false` | `false` (OK) |
| `UPLOAD_STORAGE_PATH` | `uploads` ou `/var/data/uploads` | idem |

### 2.2 Secrets (Secret Manager GCP)

| Variable Cloud Run | Secret GCP | Contenu attendu |
|-------------------|------------|------------------|
| `S3_ACCESS_KEY` | `s3-access-key` | **Access ID HMAC GCS** (ex. format `GOOG1E...`) |
| `S3_SECRET_KEY` | `s3-secret-key` | **Secret HMAC GCS** (chaîne opaque) |

Si les secrets contiennent encore des clés **Wasabi/AWS** ou une erreur (ex. message Python), les uploads S3/GCS échoueront et le backend peut tomber en **fallback stockage local** ou erreur.

---

## 3. Vérification de `gcp-env-vars.json`

Dans le fichier **gcp-env-vars.json** (valeurs actuelles) :

- `UPLOAD_BASE_URL` = `http://34.54.117.97` ✅  
- `PUBLIC_BASE_URL` = `http://34.54.117.97` ✅  
- `S3_BUCKET` = `yukpo-project-yukpo-backend-media` ✅  
- `S3_REGION` = `europe-west1` ✅  
- `S3_ENDPOINT` = `https://storage.googleapis.com` ✅  
- `S3_ACCESS_KEY` = format `GOOG1E...` (HMAC GCS) ✅  
- `S3_SECRET_KEY` = présent ✅  

**Conclusion** : Le fichier **gcp-env-vars.json** est correctement configuré pour GCP. C’est la bonne source de référence pour les variables non sensibles.

---

## 4. Problème identifié : `scripts/sync-all-variables-to-gcp.ps1`

Dans le script, les variables **S3/CDN** sont encore en valeurs **AWS/Cloudflare** :

```powershell
# S3/GCS Configuration (ACTUEL - INCORRECT pour GCP)
"S3_BUCKET" = "yukpomnang-media-prod"      # ❌ Doit être yukpo-project-yukpo-backend-media
"S3_REGION" = "us-east-1"                  # ❌ Doit être europe-west1
"S3_ENDPOINT" = ""                        # ❌ Doit être https://storage.googleapis.com
"UPLOAD_BASE_URL" = "https://cdn.yukpomnang.com"   # ❌ Doit être http://34.54.117.97
"PUBLIC_BASE_URL" = "https://cdn.yukpomnang.com"  # ❌ Doit être http://34.54.117.97
```

**Risque** : Si ce script est exécuté pour mettre à jour Cloud Run (ou pour régénérer un fichier d’env), il réinjecte des valeurs AWS/Cloudflare et **désactive ou casse** le schéma CDN S3 GCP (bucket et CDN incorrects, endpoint vide ou Wasabi).

**Action** : Corriger le script pour utiliser les **valeurs GCP** ci-dessus (voir section 6).

---

## 5. Comment vérifier que le schéma est opérationnel sur GCP

### 5.1 Logs au démarrage du backend (Cloud Run)

Au démarrage, le backend log l’un des messages suivants :

- **`[MediaStorage] Stockage distant activé (bucket=..., endpoint=...)`**  
  → S3/GCS configuré correctement (bucket + endpoint + credentials).

- **`[MediaStorage] Configuration S3 incomplète - fallback stockage local.`**  
  → Bucket ou credentials manquants/invalides (vérifier secrets et variables).

- **`[MediaStorage] Stockage local utilisé (UPLOAD_STORAGE_PATH).`**  
  → Aucun backend S3 configuré (variables S3 non définies ou vides).

Commande pour récupérer les derniers logs stdout du service :

```powershell
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=yukpo-backend AND textPayload:MediaStorage" --limit=20 --project=yukpo-project --format="table(timestamp,textPayload)" --freshness=1d
```

### 5.2 Variables et secrets actuels sur Cloud Run

Pour lister les variables et secrets de la révision actuelle :

```powershell
gcloud run services describe yukpo-backend --region=europe-west1 --project=yukpo-project --format="yaml(spec.template.spec.containers[0].env)"
```

Vérifier la présence de :  
`UPLOAD_BASE_URL`, `PUBLIC_BASE_URL`, `S3_BUCKET`, `S3_REGION`, `S3_ENDPOINT`, et que `S3_ACCESS_KEY` / `S3_SECRET_KEY` viennent bien de Secret Manager (`s3-access-key`, `s3-secret-key`).

### 5.3 Test de lecture CDN

Après un upload réussi, une URL média typique est de la forme :

- `http://34.54.117.97/uploads/...`

Ouvrir cette URL dans un navigateur ou avec `curl` pour vérifier que le CDN GCP renvoie bien le fichier (200).

### 5.4 Vérifier le bucket GCS

```powershell
gcloud storage buckets describe gs://yukpo-project-yukpo-backend-media --project=yukpo-project
```

Si le bucket n’existe pas, les uploads échoueront.

### 5.5 Vérifier les secrets HMAC (contenu)

Ne pas afficher les secrets en clair dans les logs. Vérifier que les **versions actuelles** des secrets `s3-access-key` et `s3-secret-key` ont bien été créées avec les clés **HMAC GCS** (générées par exemple via `scripts/create-cloud-storage-hmac-credentials.ps1`), et non avec d’anciennes clés Wasabi ou un message d’erreur.

---

## 6. Corrections appliquées

### 6.1 `scripts/sync-all-variables-to-gcp.ps1`

Les variables S3/CDN dans le script ont été mises à jour pour refléter la **configuration GCP** (schéma CDN S3 naif GCP), afin d’éviter d’écraser la config par des valeurs AWS/Cloudflare lors d’une prochaine exécution.

### 6.2 Vérification et application automatique (21/02/2026)

- **Script** : `scripts/verifier-et-appliquer-cdn-s3-gcp.ps1`
  - Vérifie l’existence des secrets `s3-access-key` et `s3-secret-key` (HMAC GCS).
  - Vérifie sur Cloud Run les variables : `UPLOAD_BASE_URL`, `PUBLIC_BASE_URL`, `S3_BUCKET`, `S3_REGION`, `S3_ENDPOINT`, `S3_FORCE_PATH_STYLE`.
  - Si des variables sont manquantes ou incorrectes, les applique avec `gcloud run services update --update-env-vars` (option `-Apply`).

- **Résultat de l’exécution** :
  - Secrets HMAC : **OK** (s3-access-key et s3-secret-key existent avec au moins une version).
  - Variables Cloud Run : **6 variables manquantes** → appliquées avec `-Apply`. Nouvelle révision déployée : **yukpo-backend-00314-654**.

- **Workflow GitHub** (`.github/workflows/gcp-deploy.yml`) :
  - Les variables S3/CDN GCP sont ajoutées en dur dans l’étape « Prepare Environment Variables » pour que chaque déploiement les inclue.
  - Les secrets `S3_ACCESS_KEY` et `S3_SECRET_KEY` sont ajoutés à `--update-secrets` pour qu’ils soient maintenus à chaque déploiement.

---

## 7. Checklist opérationnelle

- [ ] **gcp-env-vars.json** : Déjà correct pour GCP (section 3).
- [ ] **sync-all-variables-to-gcp.ps1** : Corrigé pour utiliser les valeurs GCP (section 6).
- [ ] **Cloud Run** : Vérifier dans les logs au démarrage que `[MediaStorage] Stockage distant activé` apparaît (section 5.1).
- [ ] **Secrets** : Confirmer que `s3-access-key` et `s3-secret-key` contiennent les clés HMAC GCS (section 5.5).
- [ ] **Déploiement** : Si vous utilisez des secrets GitHub `GCP_ENV_*` pour les variables non sensibles, s’assurer que `GCP_ENV_UPLOAD_BASE_URL`, `GCP_ENV_PUBLIC_BASE_URL`, `GCP_ENV_S3_BUCKET`, `GCP_ENV_S3_REGION`, `GCP_ENV_S3_ENDPOINT` sont définis avec les **valeurs GCP** de la section 2.1.
- [ ] **Test** : Upload d’un média (création de service/produit) puis chargement de l’URL `http://34.54.117.97/uploads/...` dans le navigateur.

---

## 8. Conclusion

- Le **fichier de référence** `gcp-env-vars.json` est **correct** pour le schéma CDN S3 GCP.
- Le **script** `sync-all-variables-to-gcp.ps1` contenait encore des valeurs **AWS/Cloudflare** ; il a été corrigé pour utiliser les valeurs GCP, ce qui évite de casser la config lors d’un sync.
- Pour que la sauvegarde des médias soit **opérationnelle** sur GCP, il faut en plus :  
  - que les **secrets** `s3-access-key` et `s3-secret-key` contiennent les **clés HMAC GCS** (et non Wasabi/erreur),  
  - et que les **variables** UPLOAD_BASE_URL, PUBLIC_BASE_URL, S3_BUCKET, S3_REGION, S3_ENDPOINT soient bien celles de la section 2.1 sur Cloud Run (via `gcp-env-vars.json`, GitHub `GCP_ENV_*`, ou script corrigé).

Une fois ces points vérifiés, le schéma CDN S3 de sauvegarde des médias est aligné et opérationnel sur GCP.
