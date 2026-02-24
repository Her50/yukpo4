# Analyse profonde – Création produit (logs GCP et causes)

**Date** : 21 février 2026  
**Sources** : `logs-analyse-4h.json`, `logs-recents-creation.json`, `ANALYSE_LOGS_CREATION_PRODUIT_RECENTE.md`, code backend/mobile.

---

## 1. Ce que montrent les logs (4 dernières heures)

### 1.1 Requêtes HTTP dans `logs-analyse-4h.json`

- **Aucun appel** à `/api/ia/creation-service` ni à `/api/services/.../products` dans la fenêtre analysée.
- Requêtes présentes :
  - **POST /api/mobile-logs** : très nombreuses, avec **501** (Not Implemented) ou **503** (Service Unavailable).
  - Message récurrent : *"The request failed because either the HTTP response was malformed or connection to the instance had an error"* (connexion fermée ou réponse mal formée).
  - Autres : `/api/notifications/user/1/unread-count`, `/ws/notifications/1`, `/api/wallet/balance`, `/api/meta/feature-flags`.

**Interprétation** : soit aucune tentative de création (IA ou produit) dans cette fenêtre, soit les requêtes creation-service/products partent vers une autre URL ou n’atteignent pas le backend (timeout client, erreur réseau avant réponse).

### 1.2 Synthèse d’une analyse antérieure (ANALYSE_LOGS_CREATION_PRODUIT_RECENTE.md)

- **POST /api/ia/creation-service** : au moins un **200** (20/02 vers 00:35 UTC, latence ~0,57 s).
- **POST /api/services/{id}/products** : **aucune trace** dans les logs fournis.
- Pool DB : acquisitions lentes (> 2 s) parfois.
- GpuService : warnings DNS (`yukpo-gpu-workers` non résolu), sans lien direct avec la création produit.

---

## 2. Causes probables du « chargement infini »

### 2.1 Côté backend (creation-service)

| Cause | Mécanisme | Effet |
|-------|-----------|--------|
| **Temps d’appel IA trop long** | 3 modèles OpenAI essayés (timeout 40 s chacun) → jusqu’à ~120 s avant fallback. Client timeout 60–90 s. | Le client coupe (AbortError) avant que le backend réponde → l’app peut rester en loading si l’erreur n’est pas gérée. |
| **Cold start Cloud Run** | Première requête après inactivité : instance à démarrer (wrapper, santé, puis app Rust). | 503 / connexion fermée / « malformed response » si la requête arrive pendant le démarrage. |
| **Connexion fermée / 503** | Instance redémarre, surcharge ou timeout côté Cloud Run. | Même message « connection to the instance had an error » → côté client la requête « pend » jusqu’au timeout. |

### 2.2 Côté client (mobile)

| Cause | Mécanisme | Effet |
|-------|-----------|--------|
| **Timeout 60–90 s** | `genererSuggestionsService` (yukpoclient) : 60 s ; apiCall creation-service : 90 s. | Après 60–90 s, `AbortError` ; si le `catch` ne remet pas le loading à false, l’UI reste en chargement. |
| **Pas de `finally` sur le loading** | `setLoading(false)` uniquement dans les branches success/error. | En cas d’exception non capturée ou de chemin rare, le loading peut rester à true. |
| **Erreur non affichée** | Réponse 5xx ou connexion coupée mal gérée. | L’utilisateur ne voit qu’un spinner sans message. |

### 2.3 Création produit (POST /products)

- Timeout client : **180 s**.
- Si le backend met le produit en **queue (job_id)** : le client fait du **polling** (60 × 5 s = 5 min max). Si le job reste en « pending » ou que l’API queue ne répond pas, le loading peut durer très longtemps.
- Si la **première** réponse POST (sans job) ne revient jamais (instance morte, timeout Cloud Run), le client attend 180 s puis devrait recevoir une erreur ; là encore, il faut que le loading soit bien désactivé (try/catch/finally).

---

## 3. Corrections déjà mises en place dans le code

1. **Backend – timeout 75 s sur l’appel IA** (`router_yukpo.rs`)  
   - Un `tokio::time::timeout(75s)` encadre l’appel à `predict` / `predict_multimodal`.  
   - Au-delà de 75 s : erreur explicite renvoyée au client (plus d’attente infinie côté backend pour cette étape).

2. **Mobile – arrêt garanti du loading** (`HomeScreen.tsx`)  
   - `finally { setLoading(false); }` dans `handleCreateService`.  
   - Le chargement s’arrête même en cas d’erreur, de timeout ou de navigation.

3. **Script d’analyse**  
   - `analyser-logs-creation-produit-gcp.ps1` : correction partielle des guillemets (encodage). En cas d’échec, utiliser directement `gcloud logging read` (voir section 5).

---

## 4. Synthèse des problèmes identifiés

| Problème | Gravité | Statut |
|----------|---------|--------|
| Backend peut dépasser le timeout client (3×40 s IA) | Élevée | Corrigé par timeout 75 s backend. |
| Loading qui reste affiché si erreur/timeout | Élevée | Corrigé par `finally` + gestion d’erreur. |
| 503 / connexion fermée sur mobile-logs (et possiblement autres routes) | Moyenne | À surveiller (cold start, santé instance). |
| Aucune trace creation-service/products dans les 4 h | Info | Soit pas d’appel dans la fenêtre, soit logs à récupérer au moment du test. |
| Pool DB lent (> 2 s) | Faible | Peut ajouter de la latence. |

---

## 5. Que faire pour la prochaine tentative

1. **Reproduire** : lancer une création (IA puis produit) et noter l’heure exacte.
2. **Récupérer les logs juste après** (ex. 1 h de fraîcheur) :
   ```powershell
   gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=yukpo-backend" --limit=500 --project=yukpo-project --format=json --freshness=1h > logs-apres-tentative.json
   ```
3. **Chercher dans le fichier** :
   - `creation_service_direct` ou `handle_creation` (logs applicatifs).
   - `creation-service` ou `requestUrl` contenant `ia/creation` ou `products` (logs requêtes).
   - `Timeout IA 75s` (si le nouveau timeout a été atteint).
   - `503`, `malformed`, `connection to the instance`.
4. **Côté app** : vérifier en console / logs mobiles qu’en cas de timeout ou 5xx, un message d’erreur s’affiche et que le loading s’arrête (grâce au `finally`).

---

## 6. Conclusion

- Les logs des **4 dernières heures** ne contiennent **aucun** appel à creation-service ni à POST products ; ils montrent surtout des **503 / connexion fermée** sur `/api/mobile-logs`.
- Les causes les plus plausibles du **chargement qui semblait infini** sont :  
  - **backend** trop long (IA) par rapport au timeout client, et absence de timeout côté backend → **corrigé** (75 s).  
  - **client** qui ne remettait pas toujours le loading à false → **corrigé** (`finally`).
- Pour **analyser en profondeur la prochaine tentative** : récupérer les logs juste après l’action (commande section 5) et rechercher les chaînes ci‑dessus dans `logs-apres-tentative.json`.
