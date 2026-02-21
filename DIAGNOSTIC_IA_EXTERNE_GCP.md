# Pourquoi l'appel IA externe ne fonctionne pas sur GCP

Le **backend** gère déjà tout le processus : l’endpoint `/api/ia/creation-service` utilise `AppIA` (state.ia) pour appeler OpenAI. Rien à modifier côté logique métier. Le problème est **uniquement** la configuration ou l’environnement sur **GCP** : la clé OpenAI n’est pas disponible ou pas utilisable au moment de l’appel.

---

## 1. Chaîne côté backend (déjà en place)

1. **Démarrage** (`backend/src/main.rs`)  
   - Lecture de `OPENAI_API_KEY` depuis l’environnement.  
   - Création de `AppIA::new()` qui appelle `initialize_models()`.  
   - Si `OPENAI_API_KEY` est **présente** → les modèles OpenAI (gpt-4o, gpt-4o-mini, etc.) sont ajoutés.  
   - Si **absente** → 0 modèle OpenAI, logs `[MAIN] OPENAI_API_KEY NON TROUVÉE` et `AppIA initialisé avec 0 modèle(s)`.

2. **Requête creation-service** (`backend/src/routers/router_yukpo.rs`)  
   - `handle_creation_service_direct` récupère `state.ia` (AppIA).  
   - Appel à `app_ia.predict_multimodal(...)` ou `app_ia.predict(...)`.

3. **Comportement AppIA** (`backend/src/services/app_ia.rs`)  
   - Si **aucun modèle activé** → utilisation du **fallback** (réponse générique), pas d’appel à l’API OpenAI.  
   - Si **modèles présents mais erreur** (401, timeout, etc.) → après échec de tous les modèles, **fallback** aussi.

Donc : **si l’IA “externe” ne fonctionne pas sur GCP**, c’est soit que `OPENAI_API_KEY` n’est pas disponible au démarrage (0 modèle → toujours fallback), soit qu’elle est disponible mais invalide (modèles présents mais tous en échec → fallback).

---

## 2. Ce qui est déjà configuré sur GCP

- **Secret Manager** : secret `openai-api-key` existant.  
- **Cloud Run** : variable `OPENAI_API_KEY` configurée comme secret (`openai-api-key:latest`).  
- **IAM** : le Service Account du service (ex. `github-actions@yukpo-project.iam.gserviceaccount.com`) a le rôle `secretmanager.secretAccessor` sur ce secret.  
- **Workflow** (`.github/workflows/gcp-deploy.yml`) :  
  `--update-secrets="...OPENAI_API_KEY=openai-api-key:latest"` à chaque déploiement.

Donc la **configuration “statique”** est correcte. Le problème est en **runtime** : la révision qui tourne ne “voit” pas la clé ou voit une clé inutilisable.

---

## 3. Causes probables dans GCP

### A. Révision qui n’a jamais reçu le secret

- Une **ancienne révision** (déployée avant l’ajout de `OPENAI_API_KEY=openai-api-key:latest`) peut encore recevoir du trafic.  
- Les variables/secrets ne sont injectés qu’au **déploiement** d’une révision. Une révision déjà déployée sans ce secret ne l’aura jamais.

**À faire :** forcer une **nouvelle révision** et s’assurer que le trafic va dessus :

```bash
gcloud run services update yukpo-backend \
  --region=europe-west1 \
  --project=yukpo-project \
  --update-secrets=OPENAI_API_KEY=openai-api-key:latest
```

(Pas de `--no-traffic` si vous voulez que cette révision reçoive le trafic.)

### B. Secret vide ou clé invalide

- Si le **contenu** du secret `openai-api-key` est vide ou n’est pas une clé OpenAI valide, la variable sera tout de même **présente** dans le conteneur (donc 0 modèle uniquement si la variable est absente). Avec une clé vide/invalide, les modèles sont chargés mais les appels API échouent (401, etc.) et le backend retombe sur le fallback.

**À faire :**  
- Vérifier dans la console OpenAI (https://platform.openai.com/api-keys) que la clé est active et a des crédits.  
- Vérifier le contenu du secret (sans l’afficher en clair) : par exemple que la valeur n’est pas vide et commence par `sk-` (via un script qui affiche seulement la longueur et le préfixe).

### C. Injection du secret au démarrage

- Sur Cloud Run, les secrets sont injectés comme variables d’environnement **au démarrage** du conteneur.  
- Si le Service Account du **service** Cloud Run (celui utilisé avec `--service-account`) n’a pas `secretmanager.secretAccessor` sur `openai-api-key`, la variable peut être absente ou vide pour cette révision.

**À faire :**  
- Confirmer que le même Service Account que celui utilisé par Cloud Run a bien le rôle sur le secret (comme dans votre audit).  
- Après toute modification IAM, redéployer une nouvelle révision pour que le runtime utilise les nouveaux droits.

---

## 4. Vérifications concrètes

### 4.1 Logs de démarrage (révision actuelle)

Vérifier que la **révision qui sert le trafic** a bien chargé la clé et des modèles :

```bash
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=yukpo-backend" \
  --limit=200 --project=yukpo-project --format=json --freshness=2h > logs-startup.json
```

Puis chercher dans `logs-startup.json` :

- `OPENAI_API_KEY détectée` ou `OPENAI_API_KEY NON TROUVÉE`  
- `AppIA initialisé avec X modèle(s)` → **X doit être > 0** pour que l’IA externe soit utilisée.  
- `Aucun modèle IA initialisé` → dans ce cas, tout passe par le fallback.

Si vous voyez **0 modèle** ou **OPENAI_API_KEY NON TROUVÉE** sur la révision qui sert le trafic, le problème est bien : **clé non disponible au démarrage** (révision sans secret, ou SA sans accès, ou secret non déployé sur cette révision).

### 4.2 Révision qui reçoit le trafic

```bash
gcloud run services describe yukpo-backend --region=europe-west1 --project=yukpo-project \
  --format="value(status.traffic)"
```

Vérifier que la révision listée est bien une révision **récente** (déployée après l’ajout de `OPENAI_API_KEY=openai-api-key:latest`).

### 4.3 Forcer une nouvelle révision (recommandé)

Pour être sûr que la config actuelle (secret + IAM) est bien appliquée :

```bash
gcloud run services update yukpo-backend \
  --region=europe-west1 \
  --project=yukpo-project \
  --update-secrets=OPENAI_API_KEY=openai-api-key:latest
```

Puis attendre 1–2 minutes et refaire une requête vers `/api/ia/creation-service` et revérifier les logs de démarrage de la **nouvelle** révision.

---

## 5. Erreur « failed to parse header value » et autres sources (même clé OK sur AWS)

Si les logs montrent **« OpenAI API error: builder error: failed to parse header value »** alors que la **même clé fonctionne sur AWS**, les causes possibles sont les suivantes.

### 5.1 Caractères parasites (GCP vs AWS)

- **AWS** : clé souvent définie à la main → chaîne propre.
- **GCP Secret Manager** : le secret peut contenir un **retour à la ligne** (CR/LF), un **BOM** (UTF-8), ou des espaces. Invalides dans un en-tête HTTP → « failed to parse header value » **avant** l'envoi de la requête.

**Pistes :** Nouvelle version du secret sans ligne avant/après. Côté code : le backend **trim** et **supprime les caractères de contrôle** et utilise `HeaderValue::from_str` avec diagnostic (longueur, premiers/derniers octets) en cas d'échec. Voir `app_ia.rs` : `openai_auth_header_value()`.

### 5.2 Autres sources à analyser

| Source | Symptôme | Vérification |
|--------|----------|--------------|
| Encodage / BOM | Caractères invalides | Logs : `first5_bytes` / `last5_bytes` |
| Réseau / egress | Timeout, connection refused | Logs Cloud Run (pas « parse header ») |
| Proxy / VPC | Blocage en-têtes | Comparer avec AWS |
| Quota / clé révoquée | 401, 429 | Body de la réponse HTTP |
| Clé différente GCP vs AWS | Comportement différent | Même chaîne exacte (longueur, pas de caractère en plus) |

---

## 6. Résumé

| Élément | Rôle |
|--------|------|
| Backend | Utilise `state.ia` (AppIA) pour creation-service ; trim/nettoyage clé + en-tête Authorization robuste (`openai_auth_header_value`). |
| GCP | Clé **injectée au démarrage** et **valide** (sans CR/LF/BOM). Sinon : 0 modèle ou échec → fallback. |
| Action la plus utile | Nouvelle révision avec `--update-secrets=OPENAI_API_KEY=openai-api-key:latest`. Si « parse header value », nouvelle version du secret sans retours à la ligne. |

En résumé : **le processus est bien géré par le backend ; le fait que l’appel IA externe ne fonctionne pas sur GCP vient du fait que, sur la révision qui tourne, `OPENAI_API_KEY` n’est pas disponible ou pas utilisable au démarrage.** Corriger l’injection du secret (révision + IAM + contenu du secret) et vérifier les logs de démarrage. Si la même clé fonctionne sur AWS mais pas sur GCP, vérifier le contenu du secret (sans CR/LF/BOM) ; trim + diagnostic côté code couvrent le cas « failed to parse header value ».
