# Analyse des logs – Création de produit impossible (24 fév. 2026)

**Fichier analysé :** `downloaded-logs-20260224-025848.json`  
**Backend :** `yukpo-backend-00330-lm9` (Cloud Run, europe-west1)  
**Période couverte :** ~01:55:11 – 01:57:44 UTC

---

## 1. Constat principal : aucune requête de création n’atteint le backend

Dans tout le fichier, **aucune requête HTTP vers `/api/services/create`** n’apparaît.

Les seules URLs vues dans `httpRequest.requestUrl` sont :

| URL | Méthode | Statut |
|-----|--------|--------|
| `/api/mobile-logs` | POST | 200 |
| `/api/users/balance` | GET | 200 |
| `/api/notifications/user/1/unread-count` | GET | 200 |
| `/ws/notifications/1` | (WebSocket) | - |

**Conclusion :** soit l’app mobile n’envoie jamais la requête de création, soit elle échoue avant d’atteindre le serveur (réseau / timeout / CORS, etc.), soit la fenêtre de logs ne contient pas le moment où cette requête est faite.

---

## 2. Scénario visible dans les logs (Formulaire intelligent)

Séquence côté mobile (via `/api/mobile-logs`) :

1. **01:55:17** – Mode création activé  
   - `🆕 MODE CRÉATION - Utilisation des données du formulaire`
2. **01:55:17** – Compression des médias  
   - `🔄 Compression des médias...`  
   - `Taille totale avant: 0 B`  
   - `✅ Compression terminée`  
   - `Taille totale après: 0 B`  
   - `✅ Médias compressés`
3. **01:55:17** – Requêtes suivantes visibles :  
   - `Making request to .../api/mobile-logs`  
   - `Making request to .../api/users/balance`

Ensuite, **aucun log mobile** indiquant :
- « Payload envoyé au backend »
- « Réponse API » (succès ou erreur)
- « Champs obligatoires manquants »
- « Erreur API »

Donc, dans cette fenêtre de logs, on ne voit ni l’envoi effectif vers `/api/services/create`, ni une erreur explicite de validation ou d’API.

---

## 3. Problèmes identifiés dans les logs

### 3.1 WebSocket notifications – « Software caused connection abort »

- **Message :** `❌ [WebSocket] Erreur: { "message": "Software caused connection abort", "type": "error", "url": "wss://yukpo-backend-376093909298.europe-west1.run.app/ws/notifications/1" }`
- **Interprétation :** Connexion WebSocket notifications coupée (réseau, idle, etc.). Le backend la considère comme « erreur WebSocket normale, ignorée ».  
- **Impact sur la création de produit :** Aucun. Cela n’explique pas l’absence de requête vers `/api/services/create`.

### 3.2 GpuService – DNS « Name or service not known »

- **Message :** `[GpuService] ⚠️ Impossible de récupérer métriques GPU après 3 tentatives: ... error trying to connect: dns error: failed to lookup address information: Name or service not known` (hôte `yukpo-gpu-workers:8080`).
- **Interprétation :** En Cloud Run, le service GPU workers n’est pas résolu (normal si non déployé / pas de VPC).  
- **Impact sur la création de produit :** Aucun. Le service utilise une « utilisation par défaut ».

### 3.3 Aucune erreur 4xx/5xx côté backend

- Aucun `httpRequest` avec `statusCode` 4xx ou 5xx dans le fichier.  
- Donc dans cette période, les requêtes qui arrivent au backend (mobile-logs, balance, notifications) réussissent.

---

## 4. Pistes pour « je n’arrive toujours pas à créer un produit »

### 4.1 La requête `/api/services/create` n’est jamais envoyée (côté app)

Possibilités :

- **Validation formulaire** : un des champs obligatoires (`titre_service`, `category`, `is_tarissable`) est considéré manquant → l’app affiche une alerte « Champs obligatoires manquants » et ne fait pas l’appel.
- **Blocage avant l’appel** : exception (ex. dans la transformation autocomplete → listeproduit, ou dans `ensurePrimaryMediaForFirstProduct`) avant d’atteindre `apiPost('/api/services/create', ...)`.
- **Utilisateur** : le bouton « Créer » n’est pas cliqué après la compression, ou l’écran est quitté avant l’envoi.

**À faire côté mobile :**  
Vérifier que les logs (ou un rapport d’erreur) contiennent bien :
- « Payload envoyé au backend » / « Réponse API »  
ou  
- « Champs obligatoires manquants » / « ID utilisateur invalide »  
et que l’app envoie ces messages vers `/api/mobile-logs` pour les retrouver dans les prochains exports de logs.

### 4.2 La requête est envoyée mais n’atteint pas le backend

- **Timeout client** : l’app utilise un timeout long pour `/api/services/create` (ex. 180 s) ; si le backend ou le réseau est lent, la requête peut être annulée côté client sans trace côté backend.
- **Réseau / proxy / firewall** : la requête est bloquée ou perdue avant Cloud Run.
- **CORS** : peu probable pour une app mobile native, mais à garder en tête si une partie du flux passe par du web.

**À faire :**  
Télécharger les logs sur une fenêtre qui inclut **juste après** le clic sur « Créer » (plusieurs minutes après 01:55:17) et rechercher `requestUrl` contenant `services/create` ou `requestMethod` POST avec une URL contenant `services`.

### 4.3 La requête atteint le backend en dehors de ce fichier

- Les logs exportés peuvent ne pas couvrir le bon créneau horaire ou le bon instanceId.  
**À faire :**  
Refaire un test de création, noter l’heure exacte (UTC), puis télécharger les logs Cloud Run (stdout + requests) pour cette période et chercher `POST` + `services/create` ou `creation-service`.

---

## 5. Résumé des problèmes relevés dans le log

| # | Problème | Sévérité | Impact création produit |
|---|----------|----------|--------------------------|
| 1 | Aucune requête POST vers `/api/services/create` dans le fichier | **Élevée** | La création ne peut pas aboutir si la requête n’est jamais envoyée ou jamais reçue. |
| 2 | Aucun log mobile « Payload envoyé » / « Erreur API » / « Champs obligatoires » après « Médias compressés » | **Élevée** | Incohérent avec un envoi réussi ou une erreur explicite ; suggère blocage ou sortie de flux avant l’appel. |
| 3 | WebSocket notifications : « Software caused connection abort » | Faible | Aucun. |
| 4 | GpuService : DNS « Name or service not known » pour `yukpo-gpu-workers` | Faible | Aucun. |

---

## 6. Recommandations

1. **Côté mobile (FormulaireYukpoIntelligentScreen)**  
   - S’assurer que tout chemin après « Médias compressés » (validation, construction du payload, appel `apiPost('/api/services/create', ...)`) envoie des logs vers `/api/mobile-logs` (ex. « Payload envoyé », « Réponse API », « Champs obligatoires manquants », « Erreur API »).  
   - En cas d’exception avant l’appel, logger l’erreur (message + stack) et l’envoyer aussi en mobile-logs.

2. **Reproduire et recapturer les logs**  
   - Faire un test de création en notant l’heure précise (UTC).  
   - Télécharger les logs Cloud Run (stdout + `run.googleapis.com/requests`) pour les 5–10 minutes autour de cette heure.  
   - Rechercher dans le JSON :  
     - `"requestUrl"` contenant `services/create` ;  
     - `"POST"` + `services` ;  
     - messages contenant « Payload envoyé », « Erreur API », « Champs obligatoires ».

3. **Vérifier le token et l’utilisateur**  
   - Le code exige `user_id` valide (nombre > 0). Si `user?.id` est absent ou invalide, une exception « ID utilisateur invalide » est levée avant l’appel. Vérifier en logs mobile que le token et l’id utilisateur sont bien présents au moment du clic « Créer ».

4. **Backend**  
   - Une fois qu’une requête POST vers `/api/services/create` apparaît dans les logs, analyser son `status` et le corps de la réponse (et les logs backend associés) pour traiter d’éventuelles erreurs 4xx/5xx ou métier.

---

*Rapport généré à partir de l’analyse de `downloaded-logs-20260224-025848.json`.*
