# Analyse détaillée – Bouton création produit tourne à l’infini (GCP)

**Date** : 21 février 2026  
**Problème** : Impossible de créer un produit ; le bouton tourne indéfiniment.

---

## 1. Flux de création produit (résumé)

1. **Mobile** : `apiPost(/api/services/{serviceId}/products`, payload) — timeout **180 s**.
2. **Backend** : 
   - `add_product_to_service` **n’exécute pas** la création directement.
   - Il enregistre un **job** en base (`product_creation_queue`) et répond tout de suite avec `{ success: true, job_id: "..." }`.
3. **Mobile** : Dès qu’il reçoit un `job_id`, il **poll** toutes les 5 s :  
   `apiGet(/api/services/{serviceId}/products/queue/{jobId})`  
   jusqu’à obtenir `status === 'completed'` ou `'failed'`, ou après **60 tentatives** (5 min) → message "Timeout: La création du produit a pris trop de temps".
4. **Backend** : Un **worker** (même processus Cloud Run) tourne en boucle :
   - Toutes les 5 s il récupère les jobs `pending` en base.
   - Il appelle `process_product_creation` pour chaque job, puis met à jour le job en `completed` ou `failed`.

Donc le spinner peut tourner « à l’infini » (en pratique jusqu’à 5 min) si :
- le **POST** ne renvoie jamais (timeout, 503, crash), ou
- le **POST** renvoie bien un `job_id` mais le **job ne passe jamais à `completed`** (worker ne traite pas ou échoue sans marquer `failed`), ou
- l’endpoint de **polling** (GET queue) ne répond pas ou renvoie toujours une erreur.

---

## 2. Causes probables côté GCP

| Cause | Mécanisme | Vérification dans les logs |
|--------|-----------|-----------------------------|
| **Table `product_creation_queue` absente** | Migrations auto non exécutées ou échec → `enqueue` échoue → API renvoie 500. | Erreurs SQL / "relation product_creation_queue does not exist". |
| **Worker jamais démarré ou tué** | Cold start, instance qui redémarre, ou worker qui crash au démarrage → aucun job traité. | Chercher `[ProductCreationQueue] 🚀 Worker démarré` et `[ProductCreationQueue] 📦 ... job(s) en attente`. |
| **Worker traite mais `process_product_creation` échoue** | Erreur DB, médias, etc. → job marqué `failed` après retries. Le mobile reçoit alors `status: 'failed'` et devrait afficher l’erreur. | Chercher `[ProductCreationQueue] ❌ Job ... échoué` ou `[process_product_creation] ❌`. |
| **Job reste en `processing`** | Crash ou timeout **pendant** `process_product_creation` avant `mark_completed` / `mark_failed` → job bloqué en `processing`. | Jobs en `processing` depuis longtemps ; absence de log "Job ... complété". |
| **POST /products timeout ou 503** | Instance cold start, surcharge, ou requête trop lourde → le mobile attend 180 s puis timeout. | Logs HTTP : latence, status 503, "connection to the instance had an error". |
| **GET /queue/{job_id} en échec** | 503, timeout ou 404 à chaque poll → le client continue de poller jusqu’au timeout de 5 min. | Logs HTTP pour `products/queue/`. |

---

## 3. Commandes de diagnostic (à lancer après une tentative de création)

À exécuter dans un terminal (PowerShell), après avoir lancé une création produit depuis l’app.

```powershell
# 1. Logs des 30 dernières minutes (backend GCP)
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=yukpo-backend" --limit=500 --project=yukpo-project --format=json --freshness=30m > logs-backend-creation-30m.json

# 2. Filtrer les entrées utiles (à faire dans le fichier ou avec jq)
# Chercher dans logs-backend-creation-30m.json :
# - "add_product_to_service" ou "ProductCreationQueue" ou "process_product_creation"
# - "products/queue" ou "job_id"
# - httpRequest.requestUrl contenant "services" et "products"
# - severity ERROR ou WARNING
```

Sous Windows (PowerShell), recherche rapide dans le fichier :

```powershell
Select-String -Path logs-backend-creation-30m.json -Pattern "add_product_to_service|ProductCreationQueue|process_product_creation|products/queue|job_id" | Select-Object -First 50
```

---

## 4. Points à vérifier dans les logs

1. **Une requête POST** vers `/api/services/.../products` avec **status 200** et un body contenant `job_id`.
2. **Au moins un log** `[ProductCreationQueue] 🚀 Worker démarré` (worker actif sur l’instance).
3. **Un log** du type `[ProductCreationQueue] 📦 N job(s) en attente` ou `[ProductCreationQueue] 🔄 Traitement job ...`.
4. **Soit** `[ProductCreationQueue] ✅ Job ... complété` **soit** `[ProductCreationQueue] ❌ Job ... échoué` pour le même job.
5. **Des requêtes GET** vers `/api/services/.../products/queue/{job_id}` avec status 200 (polling côté mobile).

Si (1) est absent → problème avant ou sur le POST (réseau, 503, timeout).  
Si (1) est présent mais pas (2)/(3) → worker ne tourne pas ou ne voit pas le job.  
Si (2)/(3) présents mais pas (4) → le job plante ou reste en `processing`.  
Si (4) est "complété" mais le mobile ne s’arrête pas → problème côté réponse GET (format, parsing) ou état UI.

---

## 5. Vérifications base de données (si accès possible)

Sur la base GCP (Cloud SQL) :

```sql
-- Jobs récents (en attente ou bloqués)
SELECT id, service_id, user_id, status, attempt_count, max_attempts, 
       error_message, created_at, started_at, completed_at
FROM product_creation_queue
ORDER BY created_at DESC
LIMIT 20;
```

Si des jobs restent en `pending` ou `processing` longtemps → le worker ne les traite pas ou ne termine pas.

---

## 6. Variable période de lancement (LAUNCH_PHASE_START_DATE)

Pendant la **phase de lancement** (3 mois à partir de la date configurée), les utilisateurs peuvent créer des produits **gratuitement** (sans débit de tokens). Si cette variable est absente ou incorrecte sur GCP :

- **Variable absente** : le backend utilise `Utc::now()` comme date de début → la phase est active (jusqu’à now + 90 jours). Comportement acceptable.
- **Variable mal formée** : même fallback → phase active.
- **Important** : le contrôleur `add_product_to_service` a été corrigé pour appeler `can_create_product_free()` : si l’utilisateur est en phase de lancement ou crée son 1er produit, le coût est 0 et aucun débit n’est effectué. Sinon, les utilisateurs avec 0 token recevraient « Solde insuffisant » avant même la mise en queue.

**Vérification sur GCP :**

```powershell
# Lister les variables d'environnement du service Cloud Run
gcloud run services describe yukpo-backend --region=europe-west1 --project=yukpo-project --format="yaml(spec.template.spec.containers[0].env)"
```

Vérifier que `LAUNCH_PHASE_START_DATE` est présente (ex. `2026-02-10T00:00:00Z`). Si elle manque, l’ajouter via la console Cloud Run ou un script (ex. `scripts/update-gcp-all-variables.ps1`).

---

## 7. Pistes de correctifs (après diagnostic)

- **Table manquante** : Vérifier que les migrations auto s’exécutent au démarrage (ENABLE_AUTO_MIGRATIONS) et que `ensure_product_creation_queue` est appelée ; sinon exécuter la migration à la main.
- **Worker ne démarre pas** : Vérifier les logs au démarrage du service (erreurs juste après "Worker démarré", panics, connexion DB).
- **Jobs bloqués en `processing`** : Ajouter un timeout dans le worker (ex. marquer `failed` si `started_at` > X minutes) et investiguer les erreurs dans `process_product_creation` (DB, médias, etc.).
- **POST timeout / 503** : Augmenter min instances à 1 pour limiter le cold start ; vérifier la taille du payload (médias) et la limite body (200 MB déjà configurée).
- **Côté mobile** : S’assurer qu’en cas de `status === 'failed'` le message d’erreur (`error_message`) est affiché et que le loading s’arrête (déjà prévu normalement).

---

## 8. Script de diagnostic (optionnel)

Un script PowerShell dédié peut :
- appeler `gcloud logging read` avec des filtres ciblés (texte : `ProductCreationQueue`, `add_product_to_service`, `process_product_creation`, et `httpRequest.requestUrl` contenant `products`);
- sauvegarder le résultat dans un fichier ;
- afficher un résumé (nombre de POST 200, présence du worker, jobs en attente / complétés / échoués).

Voir `scripts/diagnostic-creation-produit-gcp.ps1` si présent.
