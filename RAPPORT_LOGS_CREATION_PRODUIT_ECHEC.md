# Rapport d’analyse – Tentative de création produit qui échoue

**Date** : 22 février 2026  
**Constat** : Une tentative de création de produit échoue toujours ; aucune trace dans les logs stdout du backend GCP.

---

## 1. Ce qui a été fait

- **Script relancé** : `diagnostic-creation-produit-gcp.ps1` (60 min) → aucun mot-clé trouvé (`add_product_to_service`, `ProductCreationQueue`, `process_product_creation`, `products/queue`, `job_id`).
- **Logs récents** : Fichiers `logs-backend-creation-60m.json`, `logs-recents-90m.json` analysés.
- **Résultat** : Aucune entrée de log contenant :
  - un POST vers `/api/services/.../products`,
  - un GET vers `.../products/queue/...`,
  - les messages du contrôleur ou du worker de création produit.

**Conclusion** : La requête de création produit **n’atteint pas** le handler Rust `add_product_to_service` (sinon le premier `log_info("[add_product_to_service] 📦 ...")` apparaîtrait dans stdout).

---

## 2. Configuration mobile vérifiée

- **Backend utilisé** : `https://yukpo-backend-376093909298.europe-west1.run.app` (défini dans `mobile/src/config/environment.ts`).
- Les autres requêtes vues dans les logs (mobile-logs, notifications) vont bien vers ce même host → l’app pointe vers le bon backend.

---

## 3. Causes possibles (ordre de vraisemblance)

| Hypothèse | Explication |
|-----------|-------------|
| **1. Échec avant le handler** | La requête atteint Cloud Run mais échoue **avant** d’entrer dans `add_product_to_service` : timeout pendant la lecture du body (upload lourd), rejet du body (taille/formaat), ou middleware (ex. JWT) qui renvoie 401/413 sans log applicatif. |
| **2. Fenêtre de temps** | La tentative a eu lieu en dehors des 60–90 min des logs récupérés. |
| **3. Build / environnement** | L’app mobile utilisée pour le test pointe vers une autre URL (autre build, .env, ou override). |
| **4. Requêtes HTTP dans un autre log** | Les requêtes HTTP sont peut-être loguées ailleurs (ex. “Request logs” Cloud Run) et pas dans stdout. |

---

## 4. Vérifications à faire dans la console GCP

1. **Logs (Logging)**  
   - Projet : `yukpo-project`  
   - Filtre recommandé (à adapter selon l’interface) :  
     - `resource.type="cloud_run_revision"`  
     - `resource.labels.service_name="yukpo-backend"`  
     - Puis en recherche texte : **`products`** ou **`add_product`** ou **`/api/services`**.  
   - Vérifier aussi l’onglet **“Request logs”** (ou équivalent) pour le service Cloud Run, et chercher des POST avec statut 4xx/5xx ou timeout.

2. **Métriques Cloud Run**  
   - Regarder les requêtes par statut (200, 400, 401, 413, 502, 504) sur la période où vous avez refait une tentative.  
   - Un pic de 413 (Payload Too Large) ou 504 (Gateway Timeout) juste au moment du clic “Créer” serait très indicatif.

3. **Période**  
   - Lancer une **nouvelle** tentative de création produit, noter l’heure exacte, puis dans Logging limiter à **15–30 min** autour de cette heure et refaire la recherche ci‑dessus.

---

## 5. Commandes gcloud (à lancer après une tentative récente)

```powershell
# Logs des 30 dernières minutes, sauvegardés dans un fichier
cd c:\Users\23767\yukpomnang2
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=yukpo-backend" --limit=500 --project=yukpo-project --format=json --freshness=30m > logs-30min-manual.json
```

Puis, dans `logs-30min-manual.json`, rechercher manuellement (Ctrl+F) :  
`add_product`, `products`, `job_id`, `ProductCreationQueue`, `POST`, `requestUrl`, `services`.

Pour cibler les requêtes HTTP uniquement (si votre projet logue les requêtes avec `httpRequest`) :

```powershell
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=yukpo-backend AND httpRequest.requestUrl:*products*" --limit=50 --project=yukpo-project --format=json --freshness=2h > logs-http-products.json
```

(Si la syntaxe du filtre échoue, utiliser la console Logging avec les mêmes critères.)

---

## 6. Pistes correctives côté backend (pour les prochaines fois)

- **Log d’entrée de route** : ajouter un middleware ou un wrapper qui log **dès** réception de `POST /api/services/:id/products` (méthode + path), **avant** parsing du body, pour distinguer “requête jamais reçue” de “requête reçue mais échouée au parsing”.
- **Limite body Cloud Run** : vérifier dans la doc GCP la limite de taille de body pour Cloud Run (et éventuellement passer par un upload de médias séparé pour réduire la taille du POST création produit).

Dès qu’une tentative est refaite et qu’un créneau horaire précis est connu, relancer le script de diagnostic sur cette fenêtre et refaire une recherche ciblée dans les logs (et Request logs) comme ci‑dessus.
