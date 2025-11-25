# 🔍 Diagnostic Complet Backend Yukpomnang

**Date**: 2025-11-27  
**Contexte**: Analyse des logs backend, du processus de création de service, de la recherche, et de la génération vidéo.

---

## 📊 Table des matières

1. [Analyse des erreurs et warnings](#1-analyse-des-erreurs-et-warnings)
2. [Diagnostic du processus de création de service](#2-diagnostic-du-processus-de-création-de-service)
3. [Diagnostic de la recherche](#3-diagnostic-de-la-recherche)
4. [Diagnostic de la génération vidéo](#4-diagnostic-de-la-génération-vidéo)
5. [Analyse du matching Google Places](#5-analyse-du-matching-google-places)
6. [Analyse des médias dans ProductCard](#6-analyse-des-médias-dans-productcard)
7. [Recommandations et corrections](#7-recommandations-et-corrections)

---

## 1. Analyse des erreurs et warnings

### 1.1 Erreurs critiques

#### ❌ **Erreur 1: Tables `token_consumption_logs` et `purchase_history` manquantes**

**Symptôme**:
```
[get_consumption_history] DB error: Database(PgDatabaseError {
  severity: Error,
  code: "42P01",
  message: "relation \"token_consumption_logs\" does not exist"
})
```

**Impact**: Les fonctionnalités de suivi de consommation de tokens et d'historique des paiements sont inopérantes.

**Solution**: Créer les migrations pour ces tables dans `backend/migrations/`.

**Fichiers concernés**:
- `backend/src/controllers/user_controller.rs` (lignes 532, 597, 691, 821)
- Les requêtes SQL référencent ces tables sans qu'elles existent

---

#### ❌ **Erreur 2: Génération vidéo impossible - Aucune image trouvée**

**Symptôme**:
```
[ProductVideoController] Erreur génération vidéo pour job ...:
BadRequest("Ajoutez au moins une image dans votre médiathèque ou dans ce produit avant de générer une vidéo.")
```

**Cause racine**:
```
[creer_service] ⚠️ Aucun fichier média sauvegardé pour le service 13 (vérifier data_processed)
[VideoGeneration] Impossible de charger le snapshot produit 13:0 (?? Not Found: Produit 13:0 introuvable)
```

**Impact**: La génération vidéo automatique échoue systématiquement pour les services sans médias sauvegardés.

**Solution**: Vérifier pourquoi les médias ne sont pas sauvegardés lors de la création du service (voir section 2.3).

---

### 1.2 Warnings non-critiques mais importants

#### ⚠️ **Warning 1: Google Translate API bloquée**

**Symptôme**:
```
[TRANSLATE] Champ 'translatedText' absent dans la réponse Google, retour texte original.
Réponse: Object {
  "error": Object {
    "code": Number(403),
    "message": String("Requests to this API translate method google.cloud.translate.v2.TranslateService.TranslateText are blocked.")
  }
}
```

**Impact**: Les traductions automatiques ne fonctionnent pas. Les textes restent dans leur langue d'origine.

**Solution**: Vérifier la configuration de la clé API Google Translate et les permissions du projet Google Cloud.

---

#### ⚠️ **Warning 2: Services optionnels non disponibles**

**Symptôme**:
```
⚠️ LiveKit: Connexion impossible - URL: http://46.224.14.85:7880
⚠️ Redis: Échec de connexion - URL: redis://default:***@superb-sole-7762.upstash.io:6379
```

**Impact**: Services optionnels (vidéo en direct, cache Redis) non disponibles. L'application continue de fonctionner sans ces services.

**Solution**: Ces services sont optionnels. Vérifier les variables d'environnement si nécessaire.

---

#### ⚠️ **Warning 3: Performance - Requête SQL lente**

**Symptôme**:
```
slow statement: execution time exceeded alert threshold
INSERT INTO google_places_data ...
```

**Impact**: L'enrichissement Google Places peut être ralenti pour certains services.

**Solution**: Optimiser la requête d'insertion ou ajouter des index appropriés.

---

#### ⚠️ **Warning 4: Pipeline dégradé**

**Symptôme**:
```
[PipelineWorker] Statut pipeline "degraded" | stale_jobs=0 | failed24h=X
```

**Impact**: Certains jobs en arrière-plan ont échoué dans les dernières 24 heures.

**Solution**: Vérifier les logs détaillés des jobs échoués et corriger les problèmes.

---

## 2. Diagnostic du processus de création de service

### 2.1 Flux de création de service

Le processus de création de service suit ces étapes principales :

1. **Réception du JSON** → `creer_service.rs::creer_service()`
2. **Validation et nettoyage** → `valider_service_json()`
3. **Enrichissement Google Places** → `enrich_service_with_google()`
4. **Sauvegarde du service** → INSERT dans `services`
5. **Sauvegarde des médias** → INSERT dans `media`
6. **Génération d'embeddings** → (si Pinecone activé)

### 2.2 Problème identifié : Médias non sauvegardés

**Observation dans les logs**:
```
[creer_service] ⚠️ Aucun fichier média sauvegardé pour le service 13 (vérifier data_processed)
```

**Analyse du code** (`backend/src/services/creer_service.rs`):

Le code tente de sauvegarder les médias aux lignes 1460-2392. Les médias sont extraits de `data_processed` (qui conserve les données base64) au lieu de `data_obj` (qui a été nettoyé).

**Problème potentiel**:

1. **Les médias ne sont pas présents dans `data_processed`** : Si le frontend n'envoie pas les médias en base64, ils ne seront pas sauvegardés.

2. **Les médias sont dans un format non reconnu** : Le code cherche dans plusieurs champs :
   - `base64_image` (images globales du service)
   - `produits[].images`
   - `produits[].images_base64`
   - `produits[].image_base64`
   - `videos_base64`, `audio_base64`, etc.

3. **Les médias sont sauvegardés mais avec un `service_id` incorrect** : Si l'insertion du service échoue ou si le `service_id` n'est pas récupéré correctement, les médias ne seront pas liés.

**Vérification nécessaire**:

- Vérifier que le frontend envoie bien les médias dans le JSON lors de la création du service.
- Vérifier que le format des médias correspond à ce que le backend attend.
- Vérifier que le `service_id` est bien récupéré après l'insertion.

### 2.3 Enrichissement Google Places

**Fonction**: `enrich_service_with_google()` (lignes 431-580)

**Processus**:
1. Extraction du nom du prestataire (depuis `users` ou JSON)
2. Construction de la requête de recherche (titre + nom produit + nom prestataire + lieu)
3. Appel à `GooglePlacesService::search_and_select_best_match()`
4. Validation de la distance (max 10 km)
5. Calcul du score de matching
6. Enregistrement du `place_id` dans `services.data->google_place`

**Problème potentiel**: Voir section 5 pour l'analyse détaillée du matching.

---

## 3. Diagnostic de la recherche

### 3.1 Flux de recherche

La recherche utilise plusieurs mécanismes :

1. **Recherche native PostgreSQL** (`native_search_service.rs`)
   - Full-text search avec `pg_trgm`
   - Filtrage GPS avec PostGIS
   - Recherche spécialisée (pharmacies, tickets bus, etc.)

2. **Enrichissement Google Places** (`enrich_google_places.rs`)
   - Les résultats sont enrichis avec les données Google Places complètes depuis `google_places_data`
   - Remplace le `place_id` par un objet complet dans `service.data->google_place`

### 3.2 Point d'attention

Les médias Google Places (photos) ne sont **pas automatiquement inclus** dans les résultats de recherche. Seules les données textuelles (nom, adresse, horaires, etc.) sont enrichies.

**Vérification**: Les photos Google Places sont récupérées à la demande via l'endpoint `/api/places/photo` (voir logs).

---

## 4. Diagnostic de la génération vidéo

### 4.1 Flux de génération vidéo

1. **Déclenchement**: L'utilisateur demande la génération d'une vidéo pour un produit
2. **Vérification des prérequis**: Le système vérifie la présence d'images dans :
   - La médiathèque du service (`media` table)
   - Les données du produit (`services.data->produits[].images`)
3. **Génération**: Si des images sont trouvées, la vidéo est générée via Remotion

### 4.2 Problème identifié : Aucune image disponible

**Cause racine**: Les médias ne sont pas sauvegardés lors de la création du service (voir section 2.2).

**Erreur spécifique**:
```
[VideoGeneration] Impossible de charger le snapshot produit 13:0
(?? Not Found: Produit 13:0 introuvable)
```

Cela indique que :
- Le produit n'a pas de snapshot (image de prévisualisation)
- Aucune image n'est disponible dans la médiathèque pour ce produit

**Solution**: Corriger le problème de sauvegarde des médias lors de la création du service.

---

## 5. Analyse du matching Google Places

### 5.1 Algorithme de matching

**Fichier**: `backend/src/services/google_places_service.rs::search_and_select_best_match()`

**Critères de matching** (score sur 100+ points):

1. **Distance géographique** (0-50 points)
   - Validation obligatoire : distance max **10 km**
   - Score inversement proportionnel à la distance
   - Si distance > 10 km → **lieu ignoré**

2. **Matching du nom du prestataire** (0-40 points)
   - Correspondance exacte : +40 points
   - Correspondance partielle (mots) : jusqu'à 30 points proportionnellement

3. **Rating Google** (0-25 points)
   - Rating * 5.0

4. **Nombre d'avis** (0-10 points)
   - Si > 10 avis : +10 points

### 5.2 Problème identifié : Score de matching trop permissif

**Observation dans les logs**:
```
[Places] Meilleur match sélectionné pour '...': StudioXLDouala (score: 33.00)
```

**Problème**: Un score de 33.00 est **relativement faible**, ce qui peut indiquer que :
1. Le lieu sélectionné est à la limite de la distance (près de 10 km)
2. Le nom du prestataire ne correspond pas bien
3. Le rating/nombre d'avis est faible

**Analyse**:

Le score minimum pour qu'un match soit accepté n'est **pas explicite** dans le code. Le système sélectionne simplement le meilleur score parmi les 5 premiers résultats, même si ce score est faible.

**Recommandation**: Ajouter un **seuil minimum de score** (par exemple, 50 points) pour qu'un match soit considéré comme valide. Si aucun résultat ne dépasse ce seuil, ne pas associer de Google Place au service.

### 5.3 Distance maximale : 10 km

**Ligne 529 dans `creer_service.rs`**:
```rust
let max_distance_km = 10.0; // Distance maximale acceptée : 10 km
```

**Problème potentiel**: 10 km est une distance **relativement large**. Si un service est créé dans un quartier, mais qu'un lieu Google Places similaire existe dans un autre quartier à 8 km, il sera quand même associé.

**Recommandation**: Réduire la distance maximale à **2-3 km** pour les correspondances plus précises, surtout en milieu urbain.

### 5.4 Matching uniquement sur les 5 premiers résultats

**Ligne 461 dans `google_places_service.rs`**:
```rust
let places_to_check = places.into_iter().take(5).collect::<Vec<_>>();
```

**Impact**: Si le bon lieu est le 6ème résultat, il ne sera jamais vérifié.

**Recommandation**: Augmenter à 10 résultats ou ajouter une logique de pagination.

---

## 6. Analyse des médias dans ProductCard

### 6.1 Sources de médias

**ProductCard** (`frontend/src/components/products/ProductCard.tsx`) utilise plusieurs sources pour afficher les médias :

#### A. Médias Yukpo (priorité 1)

**Source**: Table `media` via l'endpoint `/api/services/{serviceId}/media`

**Hook**: `useServiceMedia(serviceId)` (`frontend/src/hooks/useServiceMedia.ts`)

**Processus**:
1. Appel API `/api/services/{serviceId}/media`
2. Récupération des enregistrements de la table `media`
3. Construction des URLs : `/api/media/files/{path}`
4. Groupement par type (images, vidéos, audios, etc.)

**Fallback**: Si l'API échoue, utilisation des données statiques dans `service.data->images_realisations` ou `service.data->videos`.

#### B. Médias Google Places (non automatique)

**Observation**: Les photos Google Places ne sont **pas automatiquement incluses** dans ProductCard.

**Accès aux photos Google Places**:
- Les photos sont récupérées à la demande via `/api/places/photo`
- Les logs montrent plusieurs appels `GET /api/places/photo`

**Structure des photos Google Places**:
- Stockées dans `google_places_data.photos` (JSONB)
- Chaque photo a un `name` (référence Google)
- Nécessite un appel API pour obtenir l'URL réelle

### 6.2 Réponse à la question : Quels médias sont considérés ?

**Réponse**: ProductCard considère **uniquement les médias Yukpo** par défaut. Les médias Google Places ne sont **pas automatiquement affichés** dans ProductCard.

**Pourquoi ?**

1. Les médias Google Places nécessitent un appel API supplémentaire pour chaque photo
2. ProductCard utilise `useServiceMedia` qui récupère uniquement les médias de la table `media`
3. Les photos Google Places sont accessibles mais non intégrées automatiquement

**Recommandation**: 

Si vous souhaitez afficher également les photos Google Places dans ProductCard :

1. Modifier `useServiceMedia` pour récupérer les photos depuis `service.data->google_place->photos`
2. Construire les URLs des photos Google Places via `/api/places/photo`
3. Combiner les médias Yukpo et Google Places dans l'affichage

### 6.3 Problème : Aucun média Yukpo sauvegardé

**Impact**: Si aucun média n'est sauvegardé lors de la création du service (voir section 2.2), ProductCard n'affichera aucun média, même si des photos Google Places sont disponibles.

---

## 7. Recommandations et corrections

### 7.1 Corrections urgentes

#### ✅ **1. Créer les tables manquantes**

Créer une migration pour `token_consumption_logs` et `purchase_history`.

#### ✅ **2. Corriger la sauvegarde des médias**

Vérifier pourquoi les médias ne sont pas sauvegardés lors de la création du service :
- Vérifier le format des médias envoyés par le frontend
- Vérifier que `data_processed` contient bien les médias base64
- Ajouter des logs détaillés pour tracer le processus de sauvegarde

#### ✅ **3. Améliorer le matching Google Places**

- Ajouter un **seuil minimum de score** (50 points)
- Réduire la **distance maximale** à 2-3 km
- Augmenter le nombre de résultats vérifiés (10 au lieu de 5)

### 7.2 Améliorations recommandées

#### 📈 **1. Intégrer les photos Google Places dans ProductCard**

- Modifier `useServiceMedia` pour inclure les photos Google Places
- Combiner médias Yukpo et Google Places avec priorité aux médias Yukpo

#### 📈 **2. Améliorer la gestion d'erreurs**

- Ajouter des logs plus détaillés pour le processus de sauvegarde des médias
- Ajouter des vérifications de prérequis avant la génération vidéo

#### 📈 **3. Optimiser les performances**

- Optimiser l'insertion dans `google_places_data`
- Ajouter des index appropriés pour les requêtes fréquentes

### 7.3 Plan d'action immédiat

1. **Créer les migrations pour `token_consumption_logs` et `purchase_history`**
2. **Investiguer et corriger la sauvegarde des médias**
3. **Ajouter un seuil minimum de score pour le matching Google Places**
4. **Réduire la distance maximale de matching à 2-3 km**
5. **Ajouter des logs détaillés pour le processus de création de service**

---

## 8. Conclusion

Le système fonctionne globalement bien, mais plusieurs problèmes critiques empêchent certaines fonctionnalités :

1. **Tables manquantes** : Les fonctionnalités de suivi de tokens sont inopérantes
2. **Médias non sauvegardés** : La génération vidéo échoue systématiquement
3. **Matching Google Places trop permissif** : Des lieux éloignés peuvent être associés

Les corrections proposées devraient résoudre ces problèmes et améliorer la qualité globale du système.

---

**Document généré le**: 2025-11-27  
**Dernière mise à jour**: 2025-11-27

