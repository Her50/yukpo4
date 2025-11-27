# PROMPT POUR CORRECTION DES ERREURS ET WARNINGS
**Date de création**: 2025-11-27  
**Dernière mise à jour**: 2025-11-27  
**Référence**: `ETAT_LIEUX_ERREURS_ET_PLAN_CORRECTION.md`  
**Total problèmes identifiés**: 28 (8 critiques, 6 warnings, 8 données, 6 observations)

---

## 📋 INSTRUCTIONS

Tu dois corriger tous les problèmes identifiés dans le document `dossier_candidature_concours/ETAT_LIEUX_ERREURS_ET_PLAN_CORRECTION.md`.

**📊 STATISTIQUES**:
- **Total problèmes identifiés**: 28
  - 🔴 Erreurs critiques: 8
  - ⚠️ Warnings moyens: 6
  - 📊 Problèmes de données: 8
  - 🟡 Observations: 6
- **Total TODOs**: 27 (TODO-001 à TODO-027)

**Mode opératoire**:
1. Lire d'abord le document `ETAT_LIEUX_ERREURS_ET_PLAN_CORRECTION.md` pour avoir le contexte complet
2. Pour chaque TODO, **consulter les logs** dans `logbackend1.md` aux lignes/références indiquées pour comprendre le problème
3. Traiter les problèmes par ordre de priorité (PRIORITÉ 1 → PRIORITÉ 2 → PRIORITÉ 3)
4. Pour chaque TODO, lire le code concerné avant de modifier
5. Tester chaque correction si possible
6. Mettre à jour le document d'état des lieux après chaque correction majeure
7. Faire `cargo fmt`, `cargo check`, `read_lints` après modifications backend
8. Vérifier les types TypeScript après modifications mobile

---

## 🚨 PRIORITÉ 1 - CRITIQUE (À corriger en premier)

### TODO-001: Corriger la route WebSocket
**Référence**: Section 1 du document - WebSocket connexion échoue  
**Logs**: `logbackend1.md` - Chercher "Expected HTTP 101", "WebSocket", "connection failed"  
**Problème**: `Expected HTTP 101 response but was '200 OK'`  
**Fichiers à vérifier**:
- Backend: Routes WebSocket dans `backend/src/routers/router_yukpo.rs` ou `backend/src/websocket/`
- Mobile: `mobile/src/contexts/WebSocketContext.tsx` ou similaire
- Vérifier l'URL WebSocket utilisée côté mobile
- Vérifier que le backend retourne bien HTTP 101 (Upgrade)

**Actions**:
- [ ] Identifier la route WebSocket backend (`/ws`, `/api/ws`, etc.)
- [ ] Vérifier que la route retourne HTTP 101
- [ ] Vérifier la configuration Axum pour WebSocket
- [ ] Corriger l'URL WebSocket côté mobile si nécessaire
- [ ] Tester la connexion WebSocket après correction

---

### TODO-002: Initialiser Firebase dans l'app mobile
**Référence**: Section 2 du document - Firebase Push Notifications  
**Logs**: `logbackend1.md` ligne ~320 - Chercher "Default FirebaseApp is not initialized", "E_REGISTRATION_FAILED", "FirebaseApp"  
**Problème**: `Default FirebaseApp is not initialized` - Code: `E_REGISTRATION_FAILED`  
**Fichiers à vérifier**:
- `mobile/app.json` ou `mobile/app.config.js`
- `mobile/App.tsx` (point d'entrée)
- Configuration Firebase Android
- Documentation Expo: https://docs.expo.dev/push-notifications/fcm-credentials/

**Actions**:
- [ ] Créer `google-services.json` pour Android
- [ ] Configurer Firebase dans `app.json` / `app.config.js`
- [ ] Initialiser `FirebaseApp.initializeApp(Context)` au démarrage de l'app
- [ ] Suivre le guide Expo FCM complet
- [ ] Tester l'enregistrement des tokens push

---

### TODO-003: Corriger l'endpoint `/api/banques-sang`
**Référence**: Section 3 du document - Méthode HTTP incorrecte  
**Logs**: `logbackend1.md` ligne ~257 - Chercher "/api/banques-sang", "Erreur parsing JSON", "405"  
**Problème**: Mobile fait GET, backend n'accepte que POST → 405  
**Fichiers à vérifier**:
- Backend: `backend/src/controllers/specialized_services_controller.rs`
- Backend routes: Vérifier où `/api/banques-sang` est défini
- Mobile: Chercher les appels à `/api/banques-sang`

**Actions**:
- [ ] Vérifier la définition de la route backend (GET vs POST)
- [ ] Soit modifier le backend pour accepter GET
- [ ] Soit modifier le mobile pour utiliser POST
- [ ] Aligner les méthodes HTTP
- [ ] Tester l'appel API après correction

---

### TODO-004: Corriger l'endpoint `/api/products/{id}/{variant}/reactions`
**Référence**: Section 4 du document - Erreur 500  
**Logs**: `logbackend1.md` lignes ~2134, 2435, 2940 - Chercher "/api/products", "/reactions", "Erreur parsing JSON"  
**Problème**: Réponse 500, JSON Parse error "Unexpected character: M"  
**Fichiers à vérifier**:
- Backend: Route reactions produits
- Controller gérant les réactions
- Mobile: Parsing de la réponse

**Actions**:
- [ ] Identifier la cause de l'erreur 500 dans le backend
- [ ] Vérifier que la réponse est bien du JSON (pas HTML/plain text)
- [ ] Ajouter une gestion d'erreur appropriée
- [ ] Tester les réactions produits après correction

---

### TODO-015: Investiguer les crashes PostgreSQL - CRITIQUE
**Référence**: Section 6 du document - Crashes processus serveur  
**Logs**: `logbackend1.md` - Chercher "terminating connection because of crash", "crash of another server process" (41+ occurrences)  
**Problème**: `terminating connection because of crash of another server process` (41+ occurrences)  
**Fichiers à vérifier**:
- Configuration pool de connexions PostgreSQL
- Logs PostgreSQL détaillés sur Render
- Queries SQLx potentiellement problématiques

**Actions**:
- [ ] Analyser les logs PostgreSQL détaillés
- [ ] Vérifier les ressources (CPU, RAM, disque) sur Render
- [ ] Identifier les requêtes causant les crashes
- [ ] Vérifier les timeouts de connexion
- [ ] Implémenter un retry mechanism avec backoff
- [ ] Considérer l'upgrade du plan PostgreSQL si nécessaire
- [ ] Monitorer activement les crashes

---

## 🔶 PRIORITÉ 2 - IMPORTANT

### TODO-005: Corriger la double lecture des réponses HTTP
**Référence**: Section 5 du document - "Already read"  
**Logs**: `logbackend1.md` ligne ~264 - Chercher "TypeError: Already read", "consumed", "JSON Parse error"  
**Problème**: `TypeError: Already read` - Double lecture `.json()`  
**Fichiers à vérifier**:
- `mobile/src/services/api.ts` ou service API mobile
- Tous les endroits où `.json()` est appelé sur les réponses

**Actions**:
- [ ] Refactoriser le service API mobile
- [ ] Ne lire `.json()` qu'une seule fois par réponse
- [ ] Utiliser `.clone()` ou `.text()` pour debug si nécessaire
- [ ] Améliorer la gestion d'erreur globale

---

### TODO-006: Corriger FeatureFlagContext
**Référence**: Section 7 du document - Fetch échoue  
**Logs**: `logbackend1.md` - Chercher "[FeatureFlagContext] fetch failed", "FeatureFlag"  
**Problème**: `[FeatureFlagContext] fetch failed {}`  
**Fichiers à vérifier**:
- `mobile/src/contexts/FeatureFlagContext.tsx` ou similaire
- Backend: Route `/api/meta/feature-flags`

**Actions**:
- [ ] Identifier pourquoi le fetch échoue
- [ ] Vérifier l'URL de l'endpoint feature flags
- [ ] Ajouter un fallback (valeurs par défaut)
- [ ] Gérer les erreurs de réseau gracieusement

---

### TODO-007: Mettre à jour expo-image-picker
**Référence**: Section 8 du document - API dépréciée  
**Logs**: `logbackend1.md` lignes ~1145, 1173, 1190 - Chercher "MediaTypeOptions have been deprecated", "expo-image-picker"  
**Problème**: `ImagePicker.MediaTypeOptions` deprecated  
**Fichiers à vérifier**:
- Chercher tous les usages de `ImagePicker.MediaTypeOptions` dans le mobile

**Actions**:
- [ ] Remplacer `MediaTypeOptions` par `MediaType`
- [ ] Tester la sélection d'images
- [ ] Vérifier la compatibilité avec la version Expo actuelle

---

### TODO-008: Corriger MesProduitsScreen - Produits null/undefined et "Service sans titre"
**Référence**: Section 9 du document - 173+ occurrences  
**Logs**: `logbackend1.md` lignes ~379-412, 1324, 1327 - Chercher "MesProduitsScreen", "Produits trouvés: null/undefined", "Service sans titre", "get_services_for_prestataire"  
**Problème**: `🔍 Produits trouvés: null/undefined`, `Service sans titre`  
**Détails**:
- 12 services reçus mais tous les produits sont `null/undefined`
- **Contradiction**: Backend logue que les produits existent mais mobile reçoit `null/undefined`
- Backend envoie "réponse allégée" avec "taille réduite de ~99%" - produits supprimés ?
- Tous les services affichent "Service sans titre" même si `titre_service` existe

**Fichiers à vérifier**:
- `mobile/src/screens/MesProduitsScreen.tsx`
- Backend: `service_controller.rs` - `get_services_for_prestataire` (ligne 1114-1247)

**Actions**:
- [ ] Identifier pourquoi la "réponse allégée" supprime les produits
- [ ] Vérifier pourquoi les produits sont `null/undefined` côté mobile alors que le backend les logue
- [ ] Corriger l'extraction des produits dans la réponse allégée
- [ ] Corriger l'affichage des titres de service ("Service sans titre")
- [ ] Vérifier le mapping/parsing côté mobile des produits et titres
- [ ] Tester avec différents services ayant des produits
- [ ] S'assurer que les produits sont préservés lors de l'allègement de la réponse

---

### TODO-009: Corriger l'endpoint `/api/places/enrich`
**Référence**: Section 12 du document - Erreur 500  
**Logs**: `logbackend1.md` - Chercher "/api/places/enrich", "500", "[Monitoring]"  
**Problème**: `GET /api/places/enrich -> 500 (479 ms)`  
**Fichiers à vérifier**:
- Backend: `places_controller` ou service d'enrichissement

**Actions**:
- [ ] Identifier la cause de l'erreur 500
- [ ] Vérifier les logs backend détaillés
- [ ] Ajouter une gestion d'erreur robuste
- [ ] Tester l'enrichissement de lieux

---

### TODO-014: Corriger LinearAutocompleteEditor
**Référence**: Section 13 du document - 68 occurrences de warnings  
**Logs**: `logbackend1.md` lignes ~10, 949, 973, 978, 1013+ - Chercher "[LinearAutocompleteEditor]", "value est vide ou invalide", "sousCaracteristiques est un objet vide"  
**Problème**: `value est vide ou invalide: []`, `sousCaracteristiques est un objet vide {}`  
**Fichiers à vérifier**:
- `mobile/src/components/LinearAutocompleteEditor.tsx`
- Backend: Endpoint retournant les sousCaracteristiques

**Actions**:
- [ ] Identifier pourquoi `value` est toujours `[]` au démarrage
- [ ] Vérifier pourquoi `sousCaracteristiques` est un objet vide `{}`
- [ ] Vérifier l'endpoint backend retournant les sousCaracteristiques
- [ ] Corriger la logique de création de chips quand `displayValue` est vide
- [ ] Améliorer la gestion des candidats vides
- [ ] Ajouter une validation pour éviter les warnings inutiles
- [ ] Tester la sélection de caractéristiques produits dans le formulaire

---

### TODO-016: Corriger MixedContentCarousel - Contenu vide
**Référence**: Section 15 du document - 23 occurrences  
**Logs**: `logbackend1.md` lignes ~234-300, 296, 300 - Chercher "[MixedContentCarousel]", "Pas de contenu mixte", "dataLength: 0", "Aucun produit organique trouvé"  
**Problème**: `dataLength: 0`, parsing objet vs array  
**Fichiers à vérifier**:
- `mobile/src/components/MixedContentCarousel.tsx`
- Backend: `/api/content/mixed` et `/api/services/recent`

**Actions**:
- [ ] Vérifier pourquoi `/api/content/mixed` retourne `dataLength: 0`
- [ ] Corriger le parsing de la réponse (objet vs array)
- [ ] Vérifier pourquoi les produits organiques ne sont pas trouvés
- [ ] Améliorer le fallback vers API standard
- [ ] Tester l'affichage du contenu mixte sur HomeScreen

---

### TODO-017: Résoudre le problème GPS causant des crashes
**Référence**: Section 16 du document - GPS désactivé  
**Logs**: `logbackend1.md` - Chercher "GPS automatique désactivé", "Scroll automatique désactivé", "CRASH_PREVENTION_CONFIG"  
**Problème**: GPS automatique désactivé intentionnellement pour éviter crashes  
**Fichiers à vérifier**:
- `mobile/src/screens/HomeScreen.tsx`
- Composants GPS: `GPSTrackingManager`, `ModernGPSModal`

**Actions**:
- [ ] Identifier la cause des crashes GPS
- [ ] Implémenter une gestion d'erreur robuste pour le GPS
- [ ] Réactiver le GPS automatique de manière sécurisée
- [ ] Tester la géolocalisation automatique sans crashes

---

### TODO-018: Corriger affichage icône recherche services spécialisés HomeScreen
**Référence**: Section 17 du document - Icône ne s'affiche pas  
**Logs**: `logbackend1.md` - Note: Pas de logs d'erreur spécifiques, problème visuel (à vérifier manuellement)  
**Problème**: `SpecializedServicesSelector` présent dans le code mais invisible  
**Fichiers à vérifier**:
- `mobile/src/screens/HomeScreen.tsx` ligne 616-619
- `mobile/src/components/SpecializedServicesSelector.tsx`
- Styles: `specializedServicesContainer` (ligne 1586)

**Actions**:
- [ ] Vérifier pourquoi `SpecializedServicesSelector` ne s'affiche pas
- [ ] Vérifier les styles `specializedServicesContainer` (marginLeft, visibility, opacity)
- [ ] Vérifier que le composant est bien rendu dans le layout
- [ ] Tester avec différents modes (compact vs normal)
- [ ] Vérifier les dimensions et le z-index
- [ ] Tester sur différents appareils Android
- [ ] Ajouter des logs de debug pour le rendu du composant

---

### TODO-019: Corriger problèmes de scroll automatique et horizontal HomeScreen
**Référence**: Section 18 du document - Scroll désactivé  
**Logs**: `logbackend1.md` lignes ~146, 143-144, 297-299 - Chercher "[HomeScreen]", "Pas assez de contenu pour le scroll automatique", "Scroll automatique désactivé", "contentLength: 0"  
**Problème**: Scroll automatique désactivé par configuration, `contentLength: 0`  
**Fichiers à vérifier**:
- `mobile/src/screens/HomeScreen.tsx` - Configuration scroll
- `mobile/src/components/MixedContentCarousel.tsx`

**Actions**:
- [ ] Vérifier pourquoi le scroll automatique est désactivé par configuration
- [ ] Corriger le `contentLength: 0` dans MixedContentCarousel
- [ ] Réactiver le scroll automatique quand il y a du contenu
- [ ] Vérifier le scroll horizontal pour les produits
- [ ] Tester le scroll sur différents contenus
- [ ] Améliorer la gestion du scroll quand le contenu est vide

---

### TODO-020: Vérifier tous les autres services spécialisés
**Référence**: Extension de TODO-003 - Services spécialisés  
**Logs**: `logbackend1.md` lignes ~106, 111, 116, 120, 125, 130, 135 - Chercher "/api/pharmacies", "/api/hopitaux", "/api/laboratoires", "/api/agences-voyage", "/api/taxis", "/api/covoiturages", "list_hospitals", "list_taxis"  
**Problème**: `/api/banques-sang` a un problème 405, vérifier les autres  
**Services à vérifier**:
- `/api/pharmacies`
- `/api/hopitaux`
- `/api/laboratoires`
- `/api/agences-voyage`
- `/api/taxis`
- `/api/covoiturages`

**Actions**:
- [ ] Pour chaque service spécialisé, vérifier:
  - [ ] La méthode HTTP (GET vs POST) côté backend et mobile
  - [ ] Les codes de réponse HTTP (405, 500, etc.)
  - [ ] Le format des réponses (JSON valide vs HTML/plain text)
  - [ ] Les erreurs de parsing JSON
  - [ ] Les réponses vides ou invalides
- [ ] Standardiser les méthodes HTTP entre mobile et backend pour tous les services
- [ ] Ajouter une gestion d'erreur cohérente pour tous les services spécialisés
- [ ] Tester chaque endpoint depuis le mobile

---

### TODO-021: Corriger ProductCard - Distance non calculable (15+ warnings)
**Référence**: Section 20b du document - 15+ occurrences  
**Logs**: `logbackend1.md` lignes ~2073, 2104, 2142, 2161, 2175, 2196, 2260, 2383, 2405, 2443, 2447, 2472, 2497, 2532, 2951 - Chercher "[ProductCard]", "⚠️ Pas de distance pour service", "locationVector: []"  
**Problème**: `⚠️ Pas de distance pour service X {}`  
**Fichiers à vérifier**:
- `mobile/src/components/ProductCard.tsx` - Calcul de distance
- Données: Services sans données géographiques complètes

**Actions**:
- [ ] Identifier pourquoi la distance n'est pas calculée même avec `gps_fixe` disponible
- [ ] Vérifier le calcul de distance dans ProductCard
- [ ] S'assurer que `locationVector` et `chosenLocation` sont correctement remplis
- [ ] Corriger les données manquantes (`adresse`, `ville`, `region`, `pays`)
- [ ] Implémenter un fallback pour calculer la distance depuis `gps_fixe` si disponible
- [ ] Améliorer la gestion des cas où la distance ne peut pas être calculée (afficher "Distance non disponible")
- [ ] Tester avec différents services (58, 5, 13)

---

### TODO-022: Corriger recherche native GPS - Structure query mismatch
**Référence**: Section 21 du document - 6+ occurrences  
**Logs**: `logbackend1.md` lignes ~1789-1793, 1833-1837, 1694-1695, 1949-1951 - Chercher "[ERREUR] [NativeSearch]", "Erreur recherche GPS optimisée", "structure of query does not match function result type"  
**Problème**: `error returned from database: structure of query does not match function result type`  
**Fichiers à vérifier**:
- Backend: Service de recherche native GPS (`NativeSearch`)
- Fonctions PostgreSQL utilisées pour la recherche optimisée

**Actions**:
- [ ] Identifier la fonction PostgreSQL causant l'erreur "structure of query does not match function result type"
- [ ] Vérifier la définition de la fonction PostgreSQL pour la recherche GPS optimisée
- [ ] Corriger la structure de retour de la fonction pour correspondre à la requête
- [ ] Tester la recherche GPS optimisée après correction
- [ ] Vérifier les autres fonctions PostgreSQL utilisées pour la recherche native
- [ ] Améliorer les messages d'erreur pour faciliter le debugging

---

### TODO-023: Corriger SearchHistoryService - Erreur enregistrement historique
**Référence**: Section 22 du document - 3+ occurrences  
**Logs**: `logbackend1.md` lignes ~1721-1723, 1980-1982, 2058-2059 - Chercher "[SearchHistoryService]", "Erreur enregistrement recherche", "undefined is not a function", "recordSearch"  
**Problème**: `undefined is not a function` dans `recordSearch`  
**Fichiers à vérifier**:
- Mobile: `SearchHistoryService` - Méthode `recordSearch`

**Actions**:
- [ ] Identifier la fonction `undefined` dans `recordSearch`
- [ ] Vérifier les imports et dépendances de SearchHistoryService
- [ ] Corriger la méthode d'enregistrement de l'historique
- [ ] Tester l'enregistrement de l'historique de recherche
- [ ] Vérifier que l'historique s'affiche correctement dans l'UI

---

### TODO-024: Corriger warning "Pas de champ produits" lors création service
**Référence**: Section 24 du document - 2+ occurrences  
**Logs**: `logbackend1.md` lignes ~565, 703 - Chercher "[save_autocomplete_combination] Pas de champ produits", "creer_service"  
**Problème**: `[save_autocomplete_combination] Pas de champ produits`  
**Fichiers à vérifier**:
- Backend: `creer_service.rs` - `save_autocomplete_combination` (ligne 4104)

**Actions**:
- [ ] Identifier pourquoi le champ `produits` n'est pas trouvé dans `save_autocomplete_combination`
- [ ] Vérifier la structure des données lors de la création de service
- [ ] S'assurer que les produits sont inclus dans la sauvegarde des combinaisons
- [ ] Tester la création de service avec des produits
- [ ] Vérifier que l'autocomplete fonctionne après création

---

### TODO-025: Optimiser requêtes SQL lentes recherche produits (10+ slow statements)
**Référence**: Section 25 du document - 10+ occurrences  
**Logs**: `logbackend1.md` lignes ~1693, 1948, 2047, 2344, 2612, 2635, 2644, 2806 (slow statement), 1712, 1956, 2648, 2810 (slow acquire connection) - Chercher "slow statement: execution time exceeded", "SELECT DISTINCT s.id", "SELECT DISTINCT ON (s.id)", "acquired connection, but time to acquire exceeded"  
**Problème**: `slow statement: execution time exceeded alert threshold`  
**Types de requêtes lentes**:
- `SELECT DISTINCT s.id, s.data, ...` avec `ts_rank` complexes (5+ occurrences)
- `SELECT DISTINCT ON (s.id) ...` avec extraction JSONB (2+ occurrences)
- Acquisition connexions PostgreSQL lente (2-4+ secondes) (4+ occurrences)

**Fichiers à vérifier**:
- Backend: Requêtes SQL de recherche produits
- Services: `autocomplete_combinations_service`, `popular_products_service`

**Actions**:
- [ ] Analyser les requêtes SQL avec EXPLAIN ANALYZE (SELECT DISTINCT et SELECT DISTINCT ON)
- [ ] Créer des index appropriés pour les champs JSONB utilisés dans ts_rank
- [ ] Optimiser les requêtes full-text search (réduire nombre de colonnes recherchées)
- [ ] Optimiser les requêtes avec extraction JSONB (`s.data->'produits'->>'prix'`)
- [ ] Améliorer le pool de connexions PostgreSQL (réduire temps d'acquisition > 2s)
- [ ] Considérer la pagination pour limiter les résultats
- [ ] Optimiser les jointures avec `autocomplete_combinations` et `users`
- [ ] Monitorer les performances après optimisation

---

### TODO-026: Corriger affichage adresse produit (59+ occurrences undefined)
**Référence**: Section 20 du document - 59+ occurrences  
**Logs**: `logbackend1.md` lignes ~2098-2101, 2113-2116, 2151-2154, 2170-2173, 2184-2186 et 50+ autres - Chercher "[ProductCard] DEBUG", "product.adresse: undefined", "product.ville: undefined", "product.region: undefined", "pays: undefined"  
**Problème**: `product.adresse: undefined`, `product.ville: undefined`, `product.region: undefined`, `pays: undefined`  
**Fichiers à vérifier**:
- `mobile/src/components/ProductCard.tsx` - Affichage des données d'adresse
- Backend: Réponses API contenant les données géographiques

**Actions**:
- [ ] Identifier pourquoi `product.adresse`, `product.ville`, `product.region`, `pays` sont undefined
- [ ] Vérifier l'extraction des données d'adresse depuis la réponse API
- [ ] S'assurer que les données géographiques sont incluses dans les réponses backend
- [ ] Corriger le mapping des données d'adresse dans ProductCard
- [ ] Implémenter un fallback pour afficher les données disponibles
- [ ] Corriger l'affichage du drapeau de pays (utiliser le bon emoji au lieu de 🌍)
- [ ] Tester avec différents produits ayant des adresses complètes

---

### TODO-027: Corriger sauvegarde médias produits dans table media
**Référence**: Section 26 du document - 2+ occurrences  
**Logs**: `logbackend1.md` lignes ~541-545 (service 118), 678-682 (service 119) - Chercher "[creer_service] 💾 Début sauvegarde médias", "0 images globales trouvées dans data_processed", "DIAGNOSTIC MÉDIAS ÉCHEC", "Aucun fichier média sauvegardé"  
**Problème**: `0 images globales trouvées dans data_processed`, `DIAGNOSTIC MÉDIAS ÉCHEC`  
**Fichiers à vérifier**:
- Backend: `creer_service.rs` - Fonction de sauvegarde médias (ligne 1981-2001, 3001)

**Actions**:
- [ ] Identifier pourquoi `0 images globales trouvées dans data_processed`
- [ ] Vérifier l'extraction des médias depuis les données envoyées par le mobile
- [ ] Corriger la fonction de sauvegarde médias dans `creer_service.rs`
- [ ] S'assurer que `base64_image`, `images_realisations`, `videos`, `audio` sont correctement extraits
- [ ] Vérifier que les médias sont bien envoyés depuis le mobile (logs montrent conversion base64)
- [ ] Tester la sauvegarde des médias après création de service avec images/vidéos
- [ ] Vérifier que les médias sont bien insérés dans la table `media`

---

## 🔵 PRIORITÉ 3 - AMÉLIORATIONS

### TODO-010: Améliorer la validation des services
**Référence**: Section 10 du document - Services sans titre  
**Logs**: `logbackend1.md` lignes ~381-412, 392, 394, 408 - Chercher "Service sans titre", "MesProduitsScreen"  
**Actions**:
- [ ] Forcer la présence d'un titre lors de la création
- [ ] Ajouter une validation backend stricte
- [ ] Afficher des messages d'erreur clairs côté mobile
- [ ] Générer un titre par défaut si absent

---

### TODO-011: Corriger les données de localisation manquantes
**Référence**: Section 11 du document - locationVector vide  
**Logs**: `logbackend1.md` lignes ~2080, 2112 - Chercher "locationVector: []", "chosenLocation:", "ProductCard DEBUG"  
**Actions**:
- [ ] Vérifier pourquoi `locationVector` est vide
- [ ] S'assurer que les services ont des données géographiques
- [ ] Calculer la distance même si certaines données manquent
- [ ] Afficher "Localisation non disponible" au lieu de rien

---

### TODO-012: Optimiser le connection pooling HTTP
**Référence**: Section 14 du document - Nouvelles connexions à chaque fois  
**Logs**: `logbackend1.md` - Chercher "starting new connection:", "http://", "https://" (multiples occurrences)  
**Actions**:
- [ ] Configurer un client `reqwest` partagé avec connection pooling
- [ ] Réutiliser les connexions HTTP
- [ ] Monitorer les performances

---

### TODO-013: Améliorer les logs et le monitoring
**Référence**: Section générale - Amélioration continue  
**Logs**: `logbackend1.md` - Toutes les sections (tâche générale d'amélioration du système de logging)  
**Actions**:
- [ ] Ajouter plus de contexte dans les erreurs
- [ ] Loguer les réponses brutes avant parsing
- [ ] Ajouter des métriques pour les erreurs fréquentes
- [ ] Créer un dashboard d'alertes

---

## 📝 NOTES IMPORTANTES

1. **Ordre de traitement**: Toujours traiter PRIORITÉ 1 d'abord, puis PRIORITÉ 2, puis PRIORITÉ 3
2. **Références aux logs**: Pour chaque TODO, consulter les logs dans `logbackend1.md` aux lignes indiquées pour comprendre le contexte exact de l'erreur
3. **Tests**: Après chaque correction majeure, tester manuellement si possible
4. **Backend**: Utiliser `cargo fmt`, `cargo check`, `cargo clippy`, `read_lints`
5. **Mobile**: Vérifier les types TypeScript, tester sur un appareil réel si possible
6. **Documentation**: Mettre à jour `ETAT_LIEUX_ERREURS_ET_PLAN_CORRECTION.md` après chaque correction importante
7. **Commits**: Faire des commits logiques par groupe de corrections liées
8. **Consultation des logs**: Avant de corriger un problème, lire les lignes de logs spécifiées pour comprendre le contexte et les valeurs exactes

---

## 🔍 STRUCTURE DU REPO

- **Backend Rust**: `backend/src/`
- **Mobile React Native**: `mobile/src/`
- **Routes backend**: `backend/src/routes/` et `backend/src/routers/`
- **Controllers backend**: `backend/src/controllers/`
- **Services backend**: `backend/src/services/`
- **Composants mobile**: `mobile/src/components/`
- **Screens mobile**: `mobile/src/screens/`
- **Services mobile**: `mobile/src/services/`

---

## ✅ CHECKLIST FINALE

Après toutes les corrections:
- [ ] Tous les TODO-001 à TODO-027 sont complétés (28 problèmes identifiés au total)
- [ ] `cargo fmt && cargo check && cargo clippy` passe sans erreurs
- [ ] `read_lints` ne montre plus d'erreurs critiques
- [ ] Les tests backend passent (`cargo test`)
- [ ] Le mobile compile sans erreurs TypeScript
- [ ] Le document `ETAT_LIEUX_ERREURS_ET_PLAN_CORRECTION.md` est mis à jour avec le statut
- [ ] Un résumé des corrections effectuées est créé

**Statistiques**:
- **Total problèmes identifiés**: 28
  - Erreurs critiques: 8
  - Warnings moyens: 6
  - Problèmes de données: 8
  - Observations: 6

---

**Utilise ce prompt au début d'une nouvelle session pour reprendre les corrections.**
