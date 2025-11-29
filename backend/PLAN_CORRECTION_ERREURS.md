# Plan de Correction des Erreurs et Warnings - Backend & Mobile

## Analyse des Logs (logbackend3.md)

Date d'analyse : 2025-11-29

---

## 🔴 ERREURS CRITIQUES (Backend Rust)

### 1. PANIC - Type Mismatch TIMESTAMP vs TIMESTAMPTZ
**Fichier** : `src/controllers/media_product_controller.rs:99:18`
**Erreur** : 
```
ColumnDecode { index: "uploaded_at", source: "mismatched types; 
Rust type `chrono::naive::datetime::NaiveDateTime` (as SQL type `TIMESTAMP`) 
is not compatible with SQL type `TIMESTAMPTZ`" }
```

**Cause racine** :
- La colonne `uploaded_at` dans la base de données est de type `TIMESTAMPTZ` (avec timezone)
- Le code Rust utilise `NaiveDateTime` qui ne supporte pas les timezones
- Utilisation de `.unwrap()` qui cause un PANIC au lieu de gérer l'erreur

**Plan de correction** :
1. **Immédiat** : Remplacer `NaiveDateTime` par `DateTime<Utc>` dans le modèle
2. **Immédiat** : Remplacer `.unwrap()` par une gestion d'erreur appropriée avec `?` ou `match`
3. **Vérification** : Vérifier toutes les autres colonnes de type timestamp dans le projet
4. **Migration DB** : Si nécessaire, aligner le type de colonne avec le code Rust

**Fichiers à modifier** :
- `src/controllers/media_product_controller.rs` (ligne 99)
- `src/models/media_product_model.rs` (définition du modèle)
- Vérifier `src/repositories/media_product_repository.rs` si applicable

---

### 2. JSON Manquant dans Réponse IA (Multiple fonctions)
**Fichiers** :
- `src/services/app_ia.rs:2756` (generate_distribution_plan)
- `src/services/app_ia.rs:2470` (generate_video_style)
- `src/services/app_ia.rs:2311` (generate_video_briefs)

**Erreur** :
```
❌ JSON manquant dans réponse IA (12 chars): openai-gpt4o
```

**Cause racine** :
- La réponse de l'API OpenAI retourne parfois le nom du modèle ("openai-gpt4o") au lieu du JSON
- Le parsing JSON échoue car la réponse n'est pas au format attendu
- Pas de validation robuste de la réponse avant parsing

**Plan de correction** :
1. **Validation de réponse** : Vérifier que la réponse contient bien du JSON avant parsing
2. **Extraction JSON** : Si la réponse contient du texte avant/après le JSON, extraire uniquement la partie JSON
3. **Retry avec fallback** : Implémenter un retry avec un prompt différent si la première tentative échoue
4. **Logging amélioré** : Logger la réponse complète (tronquée) pour debug
5. **Gestion d'erreur** : Retourner une erreur structurée au lieu de paniquer

**Fichiers à modifier** :
- `src/services/app_ia.rs` (fonctions generate_distribution_plan, generate_video_style, generate_video_briefs)
- Ajouter une fonction utilitaire `extract_json_from_response()` si nécessaire

---

### 3. Erreur 502 Bad Gateway
**Endpoint** : `/api/media/product/{id}/{version}`
**Erreur** : 502 Bad Gateway (probablement causé par le PANIC ci-dessus)

**Cause racine** :
- Le PANIC dans `media_product_controller.rs` fait crasher le serveur
- Le serveur retourne 502 car il n'a pas pu traiter la requête

**Plan de correction** :
- Corriger le PANIC (voir erreur #1)
- Ajouter un middleware de gestion d'erreur global pour éviter les crashes
- Implémenter un recovery handler pour les panics

---

## 🟡 ERREURS HTTP (Routes manquantes / Erreurs serveur)

### 4. Route 404 - /api/visibility/track
**Erreur** : Route non trouvée (18 occurrences dans les logs)
**Impact** : L'application mobile tente d'appeler cette route mais elle n'existe pas

**Plan de correction** :
1. **Option A** : Créer la route `/api/visibility/track` si elle est nécessaire
   - Créer le controller `visibility_controller.rs`
   - Ajouter la route dans `src/routes/mod.rs` ou `src/main.rs`
   - Implémenter la logique de tracking de visibilité
2. **Option B** : Supprimer les appels depuis le mobile si la route n'est plus nécessaire
   - Chercher dans le code mobile les appels à `/api/visibility/track`
   - Supprimer ou commenter ces appels

**Fichiers à vérifier/créer** :
- `src/routes/mod.rs` ou `src/main.rs` (ajout de route)
- `src/controllers/visibility_controller.rs` (nouveau fichier si nécessaire)
- Code mobile : chercher les appels à `visibility/track`

---

### 5. Erreur 500 - /api/media/generate-distribution-plan
**Erreur** : 500 Internal Server Error (3 occurrences)
**Cause** : Liée à l'erreur #2 (JSON manquant dans réponse IA)

**Plan de correction** :
- Corriger l'erreur #2 (JSON manquant)
- Améliorer la gestion d'erreur dans le controller pour retourner un message d'erreur structuré au lieu de 500
- Ajouter un fallback avec valeurs par défaut si l'IA échoue

**Fichiers à modifier** :
- `src/controllers/ia_controller.rs` (ou le controller qui gère cette route)
- `src/services/app_ia.rs` (generate_distribution_plan)

---

### 6. Erreur 500 - /api/media/generate-video-brief
**Erreur** : 500 Internal Server Error (3 occurrences)
**Cause** : Liée à l'erreur #2 (JSON manquant dans réponse IA)

**Plan de correction** :
- Corriger l'erreur #2 (JSON manquant)
- Améliorer la gestion d'erreur dans le controller
- Ajouter un fallback avec valeurs par défaut

**Fichiers à modifier** :
- `src/controllers/ia_controller.rs` (ou le controller qui gère cette route)
- `src/services/app_ia.rs` (generate_video_briefs)

---

## 🟠 WARNINGS (Backend)

### 7. Style IA Indisponible - Utilisation Valeurs par Défaut
**Fichier** : `src/controllers/ia_controller.rs:425`
**Warning** : `Style IA indisponible, utilisation valeurs par défaut pour channel: chat`

**Cause racine** :
- L'IA échoue à générer le style (erreur #2)
- Le système utilise des valeurs par défaut comme fallback

**Plan de correction** :
- Corriger l'erreur #2 (JSON manquant)
- Documenter les valeurs par défaut utilisées
- Améliorer le logging pour indiquer quelles valeurs par défaut sont utilisées

---

## 📱 ERREURS MOBILE

### 8. Erreur 502 - Chargement Médias
**Composant** : `ProductVideoCreationModal`
**Erreur** : `Erreur 502` lors du chargement des médias

**Cause racine** :
- Liée au PANIC backend (erreur #1)
- Le serveur crash avant de pouvoir répondre

**Plan de correction** :
- Corriger le PANIC backend (erreur #1)
- Améliorer la gestion d'erreur côté mobile pour afficher un message utilisateur approprié
- Ajouter un retry automatique côté mobile

**Fichiers à modifier** :
- Backend : `src/controllers/media_product_controller.rs` (corriger PANIC)
- Mobile : Chercher `ProductVideoCreationModal` et améliorer la gestion d'erreur

---

### 9. Coach IA - Plan Indisponible après 3 Tentatives
**Composant** : `ProductVideoCreationModal`
**Erreur** : `Coach IA: plan indisponible après 3 tentatives`
**Message** : `Aucun plan retourné`

**Cause racine** :
- L'endpoint `/api/media/generate-distribution-plan` retourne 500 (erreur #5)
- Après 3 tentatives, le mobile abandonne et utilise des valeurs par défaut

**Plan de correction** :
- Corriger l'erreur backend #5
- Améliorer le message d'erreur côté mobile pour informer l'utilisateur
- Implémenter un meilleur fallback avec valeurs par défaut documentées

**Fichiers à modifier** :
- Backend : Corriger erreur #5
- Mobile : Chercher `ProductVideoCreationModal` et améliorer la gestion d'erreur pour "plan"

---

### 10. Coach IA - Brief Indisponible après 3 Tentatives
**Composant** : `ProductVideoCreationModal`
**Erreur** : `Coach IA: brief indisponible après 3 tentatives`
**Message** : `Aucun variant retourné`

**Cause racine** :
- L'endpoint `/api/media/generate-video-brief` retourne 500 (erreur #6)
- Après 3 tentatives, le mobile abandonne

**Plan de correction** :
- Corriger l'erreur backend #6
- Améliorer le message d'erreur côté mobile
- Implémenter un meilleur fallback

**Fichiers à modifier** :
- Backend : Corriger erreur #6
- Mobile : Chercher `ProductVideoCreationModal` et améliorer la gestion d'erreur pour "brief"

---

## 📋 PRIORISATION DES CORRECTIONS

### 🔥 PRIORITÉ CRITIQUE (À corriger immédiatement)
1. **Erreur #1** : PANIC TIMESTAMP vs TIMESTAMPTZ (bloque l'application)
2. **Erreur #2** : JSON manquant dans réponse IA (cause les erreurs 500)

### ⚠️ PRIORITÉ HAUTE (À corriger rapidement)
3. **Erreur #4** : Route 404 /api/visibility/track (18 occurrences)
4. **Erreur #5** : Erreur 500 generate-distribution-plan
5. **Erreur #6** : Erreur 500 generate-video-brief

### 📝 PRIORITÉ MOYENNE (À corriger prochainement)
6. **Erreur #7** : Warning style IA indisponible
7. **Erreur #8** : Erreur 502 chargement médias (mobile)
8. **Erreur #9** : Coach IA plan indisponible (mobile)
9. **Erreur #10** : Coach IA brief indisponible (mobile)

---

## 🛠️ ACTIONS CONCRÈTES PAR FICHIER

### `src/controllers/media_product_controller.rs`
- [ ] Ligne 99 : Remplacer `NaiveDateTime` par `DateTime<Utc>`
- [ ] Ligne 99 : Remplacer `.unwrap()` par gestion d'erreur appropriée
- [ ] Vérifier toutes les autres utilisations de timestamps dans ce fichier

### `src/services/app_ia.rs`
- [ ] Ligne 2756 : Améliorer parsing JSON pour `generate_distribution_plan`
- [ ] Ligne 2470 : Améliorer parsing JSON pour `generate_video_style`
- [ ] Ligne 2311 : Améliorer parsing JSON pour `generate_video_briefs`
- [ ] Créer fonction utilitaire `extract_json_from_response()` si nécessaire
- [ ] Ajouter validation robuste de la réponse avant parsing
- [ ] Améliorer logging pour debug

### `src/controllers/ia_controller.rs`
- [ ] Ligne 388 : Améliorer gestion d'erreur pour `generate_video_style`
- [ ] Ligne 425 : Documenter les valeurs par défaut utilisées
- [ ] Améliorer messages d'erreur retournés au client

### Routes (à déterminer selon structure)
- [ ] Créer route `/api/visibility/track` OU supprimer appels mobile
- [ ] Vérifier gestion d'erreur pour `/api/media/generate-distribution-plan`
- [ ] Vérifier gestion d'erreur pour `/api/media/generate-video-brief`

### Modèles
- [ ] Vérifier `src/models/media_product_model.rs` pour type timestamp
- [ ] Vérifier tous les modèles utilisant des timestamps

### Mobile (à localiser dans le code)
- [ ] Chercher et corriger appels à `/api/visibility/track`
- [ ] Améliorer gestion d'erreur dans `ProductVideoCreationModal`
- [ ] Améliorer messages utilisateur pour erreurs IA

---

## 📊 MÉTRIQUES DE SUCCÈS

Après correction, vérifier que :
- [ ] Plus aucun PANIC dans les logs
- [ ] Plus d'erreurs 500 sur les endpoints IA
- [ ] Plus d'erreurs 404 sur `/api/visibility/track`
- [ ] Plus d'erreurs 502 sur `/api/media/product/{id}/{version}`
- [ ] Les réponses IA sont correctement parsées
- [ ] Les valeurs par défaut sont utilisées de manière cohérente

---

## 🔍 TESTS À EFFECTUER

1. **Test PANIC** : Appeler `/api/media/product/{id}/{version}` et vérifier qu'il n'y a pas de crash
2. **Test IA** : Tester les 3 endpoints IA et vérifier que les réponses JSON sont correctement parsées
3. **Test Route** : Vérifier que `/api/visibility/track` existe ou que les appels sont supprimés
4. **Test Mobile** : Tester le flow complet de création de vidéo depuis le mobile
5. **Test Fallback** : Vérifier que les valeurs par défaut sont utilisées correctement en cas d'échec IA

---

## 📝 NOTES ADDITIONNELLES

- Les erreurs IA semblent être un problème récurrent : considérer une refactorisation de la logique de parsing JSON
- Le problème de timezone (TIMESTAMP vs TIMESTAMPTZ) pourrait affecter d'autres parties du code : audit complet recommandé
- La route `/api/visibility/track` est appelée 18 fois : déterminer si elle est nécessaire ou supprimer les appels

