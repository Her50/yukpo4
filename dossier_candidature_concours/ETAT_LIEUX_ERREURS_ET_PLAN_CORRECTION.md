# État des Lieux - Erreurs et Warnings Backend/Mobile
**Date d'analyse**: 2025-11-27  
**Fichier analysé**: `logbackend1.md` (2986 lignes)

---

## 🔴 ERREURS CRITIQUES

### 1. **WebSocket - Connexion échoue systématiquement**
**Fréquence**: Répétée (multiples tentatives)
**Erreur**: 
```
Expected HTTP 101 response but was '200 OK'
```
**Impact**: 
- Les WebSocket ne peuvent pas se connecter
- Communication temps réel impossible
- Reconnexions multiples échouent (1/5, 2/5, etc.)

**Localisation**: 
- Mobile: `WebSocketContext`
- Backend: Configuration WebSocket route

---

### 2. **Firebase Push Notifications - Initialisation manquante**
**Fréquence**: À chaque démarrage de l'app
**Erreur**:
```
Default FirebaseApp is not initialized in this process com.yukpomnang.mobile. 
Make sure to call FirebaseApp.initializeApp(Context) first.
Code: E_REGISTRATION_FAILED
```
**Impact**:
- Push notifications complètement non fonctionnelles
- Les utilisateurs ne reçoivent aucune notification

**Localisation**:
- Mobile: `PushNotifications` component
- Configuration Firebase Android

---

### 3. **API `/api/banques-sang` - Méthode HTTP incorrecte**
**Fréquence**: À chaque appel
**Erreur**:
```
Response status: 405
allow: POST
```
**Problème**: 
- Le mobile fait un **GET** vers `/api/banques-sang`
- Le backend n'accepte que **POST**

**Impact**:
- Impossible de récupérer les banques de sang
- Fonctionnalité non disponible

**Localisation**:
- Mobile: Appel API banques-sang
- Backend: Route définition `/api/banques-sang`

---

### 4. **API `/api/products/{id}/{variant}/reactions` - Erreur 500**
**Fréquence**: Répétée
**Erreur**:
```
Response status: 500
JSON Parse error: Unexpected character: M
```
**Impact**:
- Impossible de récupérer/affecter les réactions aux produits
- Le backend retourne probablement une erreur HTML ("Method not allowed" ou similaire) au lieu de JSON

**Localisation**:
- Backend: Route reactions produits
- Mobile: Parsing de la réponse

---

### 5. **Erreur "Already read" - Double lecture de réponse**
**Fréquence**: Répétée lors d'erreurs API
**Erreur**:
```
TypeError: Already read
at consumed
```
**Problème**: 
- Le code mobile essaie de lire `.json()` plusieurs fois sur la même réponse
- Se produit lors de la gestion d'erreur

**Impact**:
- Messages d'erreur incomplets
- Debugging difficile

**Localisation**:
- Mobile: Service API (gestion des réponses HTTP)

---

### 6. **PostgreSQL - Crashes de processus serveur**
**Fréquence**: Très répétée (41+ occurrences)
**Warning**:
```
terminating connection because of crash of another server process
```
**Problème**: 
- Des processus PostgreSQL crashent régulièrement
- Les connexions SQLx sont terminées de force
- Indique une instabilité du serveur de base de données

**Impact**:
- Risque de perte de données
- Connexions interrompues
- Performances dégradées
- Instabilité générale du backend

**Localisation**:
- Backend: Pool de connexions PostgreSQL
- Base de données: Processus serveur PostgreSQL sur Render

**Note**: C'est un problème critique qui nécessite une investigation immédiate de la stabilité PostgreSQL.

---

## ⚠️ WARNINGS MOYENS

### 7. **FeatureFlagContext - Fetch échoue**
**Fréquence**: Au démarrage
**Warning**:
```
[FeatureFlagContext] fetch failed {}
```
**Impact**:
- Les feature flags ne sont pas chargés
- Certaines fonctionnalités peuvent être désactivées par défaut

**Localisation**:
- Mobile: `FeatureFlagContext`

---

### 8. **expo-image-picker - API dépréciée**
**Fréquence**: À chaque utilisation
**Warning**:
```
ImagePicker.MediaTypeOptions have been deprecated. 
Use ImagePicker.MediaType or an array of ImagePicker.MediaType instead.
```
**Impact**:
- Code utilisant une API qui sera supprimée
- Risque de breakage futur

**Localisation**:
- Mobile: Usage de `ImagePicker.MediaTypeOptions`

---

## 📊 PROBLÈMES DE DONNÉES

### 9. **Produits null/undefined dans MesProduitsScreen**
**Fréquence**: Répétée (173 occurrences)
**Problème**:
```
🔍 Produits trouvés: null/undefined
```
**Impact**:
- L'écran MesProduits affiche des données vides
- Mauvais parsing de la réponse API ou réponse vide

**Localisation**:
- Mobile: `MesProduitsScreen`
- Backend: Endpoint retournant les produits du prestataire

---

### 10. **Services sans titre**
**Fréquence**: Répétée
**Problème**:
```
🔍 Service: 55 Titre: Service sans titre
```
**Impact**:
- Affichage confus pour les utilisateurs
- Services créés sans titre valide

**Localisation**:
- Backend: Création/validation de services

---

### 11. **Données de localisation manquantes**
**Fréquence**: Répétée
**Problèmes**:
```
⚠️ Pas de distance pour service 13
chosenLocation: (empty)
locationVector: []
product.adresse: undefined
product.ville: undefined
product.region: undefined
```
**Impact**:
- Distance non calculable
- Informations géographiques manquantes
- Expérience utilisateur dégradée

**Localisation**:
- Mobile: `ProductCard` component
- Backend: Données services/produits

---

### 12. **Erreur 500 sur `/api/places/enrich`**
**Fréquence**: Occasionnelle
**Erreur**:
```
[Monitoring] GET /api/places/enrich -> 500 (479 ms)
```
**Impact**:
- Enrichissement des lieux échoue
- Données géographiques incomplètes

**Localisation**:
- Backend: `places_controller` ou service d'enrichissement

---

## 🟡 OBSERVATIONS

### 13. **LinearAutocompleteEditor - Warnings répétés**
**Fréquence**: Très répétée (68 occurrences)
**Warnings**:
```
⚠️ value est vide ou invalide: []
⚠️ displayValue vide, aucun chip créé. displayValue:  value: []
⚠️ sousCaracteristiques est un objet vide
⚠️ [CANDIDAT_SELECTIONNE] Aucun candidat disponible pour affichage
```
**Problème**:
- Le composant `LinearAutocompleteEditor` reçoit systématiquement des valeurs vides `[]`
- Les `sousCaracteristiques` sont des objets vides `{}`
- Aucun candidat n'est disponible pour la sélection
- Les chips ne sont pas créés car `displayValue` est vide

**Impact**:
- L'autocomplete ne fonctionne pas correctement
- L'utilisateur ne peut pas sélectionner de caractéristiques produits
- L'expérience utilisateur est dégradée dans le formulaire de création de service/produit

**Localisation**:
- Mobile: `LinearAutocompleteEditor` component
- Utilisé dans: `FormulaireYukpoIntelligentScreen` pour les caractéristiques produits
- Backend: Endpoint fournissant les `sousCaracteristiques` pourrait retourner des objets vides

**Observation**:
- Les requêtes à `/api/places/autocomplete` fonctionnent (200 OK)
- Les requêtes à `/api/combinations/search` fonctionnent
- Le problème semble être spécifique à la gestion des `sousCaracteristiques` et des valeurs dans `LinearAutocompleteEditor`

---

### 14. **Connection pooling - Nouvelle connexion à chaque fois**
**Fréquence**: Répétée
**Observation**:
```
starting new connection: http://46.224.14.85:7880/
starting new connection: https://places.googleapis.com/
starting new connection: https://translation.googleapis.com/
starting new connection: https://api.openai.com/
```
**Impact potentiel**:
- Latence accrue
- Consommation de ressources
- Pas de réutilisation de connexions HTTP

**Localisation**:
- Backend: Configuration `reqwest` client

---

### 15. **MixedContentCarousel - Contenu vide et problèmes de parsing**
**Fréquence**: Répétée (23 occurrences)
**Problèmes**:
```
⚠️ Pas assez de contenu pour le scroll automatique: 0
⚠️ Pas de contenu mixte, chargement des produits organiques...
⚠️ Aucun produit organique trouvé - Réponse API invalide
API recent échouée, essai API standard...
```
**Problème**:
- L'API `/api/content/mixed` retourne `dataLength: 0` même si `hasData: true`
- Les produits organiques ne sont pas trouvés malgré `success: true`
- Le parsing de la réponse API échoue (réponse objet au lieu d'array)
- Fallback vers API standard mais même problème

**Impact**:
- Le carousel de contenu mixte est vide
- L'utilisateur ne voit pas de contenu recommandé
- Expérience utilisateur dégradée sur l'écran d'accueil

**Localisation**:
- Mobile: `MixedContentCarousel` component
- Backend: Endpoint `/api/content/mixed` et `/api/services/recent`

---

### 16. **GPS automatique désactivé - Workaround pour éviter crashes**
**Fréquence**: Au démarrage
**Info**:
```
GPS automatique désactivé pour éviter les crashes
```
**Problème**:
- Le GPS automatique a été désactivé intentionnellement pour éviter des crashes
- Indique un problème sous-jacent non résolu avec la gestion GPS

**Impact**:
- Géolocalisation non automatique
- L'utilisateur doit activer manuellement le GPS
- Fonctionnalités dépendantes du GPS dégradées

**Localisation**:
- Mobile: `HomeScreen` - Gestion GPS

---

### 17. **HomeScreen - Icône recherche services spécialisés ne s'affiche pas**
**Fréquence**: Problème visuel constant
**Problème**:
- L'icône de recherche des services spécialisés (après le drapeau de langue) ne s'affiche pas à l'écran
- Le composant `SpecializedServicesSelector` est présent dans le code (ligne 618 HomeScreen.tsx)
- Commentaire indique "✅ CORRIGÉ: Icône services spécialisés avec écart après le drapeau" mais le problème persiste

**Impact**:
- L'utilisateur ne peut pas accéder facilement à la recherche de services spécialisés
- Fonctionnalité importante non accessible depuis HomeScreen
- UX dégradée

**Localisation**:
- Mobile: `HomeScreen.tsx` ligne 616-619
- Composant: `SpecializedServicesSelector` (compact mode)
- Styles: `specializedServicesContainer` (ligne 1586)

**Note**: Les logs ne signalent pas d'erreur spécifique, c'est un problème d'affichage/rendu.

---

### 18. **HomeScreen - Problèmes de scroll automatique et horizontal**
**Fréquence**: Répétée (10+ occurrences dans les logs)
**Problèmes identifiés dans les logs**:
```
⚠️ Pas assez de contenu pour le scroll automatique: 0
⏸️ Scroll automatique désactivé (configuration)
contentLength: 0
```
**Problème**:
- Le scroll automatique est désactivé par configuration dans HomeScreen
- Le `MixedContentCarousel` a un `contentLength: 0`, donc pas de scroll automatique possible
- Le scroll horizontal pourrait ne pas fonctionner correctement pour les produits

**Impact**:
- Pas de défilement automatique du contenu
- L'utilisateur doit scroller manuellement
- Expérience utilisateur moins fluide

**Localisation**:
- Mobile: `HomeScreen.tsx` - Configuration scroll
- Composant: `MixedContentCarousel` - Gestion du scroll automatique
- Logs: Ligne 146, 143-144, 297-299, etc.

**Note**: Déjà partiellement documenté dans "MixedContentCarousel - Contenu vide" mais problème de scroll spécifique à HomeScreen.

---

### 20. **ProductCard - Adresse et données localisation undefined (59+ occurrences)**
**Fréquence**: 59+ occurrences dans les logs
**Problèmes**:
```
[ProductCard] DEBUG - product.adresse: undefined
[ProductCard] DEBUG - product.ville: undefined
[ProductCard] DEBUG - product.region: undefined
[ProductCard] DEBUG - pays: undefined countryFlag: 🌍
```
**Problème**:
- Les données d'adresse des produits sont systématiquement `undefined`
- Adresse, ville, région, et pays ne sont pas disponibles
- Le drapeau de pays affiche un emoji générique (🌍) au lieu du drapeau spécifique
- Empêche l'affichage de l'adresse complète du produit
- Impact sur la géolocalisation et la distance

**Impact**:
- L'adresse du produit ne s'affiche pas dans ProductCard
- Localisation géographique incomplète
- Impossible de calculer la distance (lié à TODO-021)
- UX dégradée pour les utilisateurs cherchant des produits locaux

**Localisation**:
- Mobile: `ProductCard.tsx` - Affichage des données d'adresse
- Données: Services/produits sans données géographiques complètes dans la réponse API
- Logs: Lignes 2098-2101, 2113-2116, 2151-2154, 2170-2173, 2184-2186, et 50+ autres occurrences

**Note**: Problème critique pour l'affichage des produits et la géolocalisation.

---

### 20b. **ProductCard - Warnings distance non calculable (15+ occurrences)**
**Fréquence**: 15+ occurrences dans les logs
**Warning**:
```
[ProductCard] ⚠️ Pas de distance pour service 58 {}
[ProductCard] ⚠️ Pas de distance pour service 5 {}
[ProductCard] ⚠️ Pas de distance pour service 13 {}
```
**Problème**:
- La distance ne peut pas être calculée pour plusieurs services (58, 5, 13)
- Données de localisation manquantes: `locationVector: []`, `chosenLocation: ` (vide)
- Données produit manquantes: `product.adresse: undefined`, `product.ville: undefined`, `product.region: undefined`, `pays: undefined`
- Même si `gps_fixe` existe dans les données (`"4.033119570170426,9.814339578151703"`), la distance n'est pas calculée

**Impact**:
- Les utilisateurs ne voient pas la distance aux services/produits
- UX dégradée pour la recherche géolocalisée
- Impact sur le tri par proximité

**Localisation**:
- Mobile: `ProductCard.tsx` - Calcul de distance
- Données: Services sans données géographiques complètes
- Logs: Lignes 2073, 2104, 2142, 2161, 2175, 2196, 2260, 2383, 2405, 2443, 2447, 2472, 2497, 2532, 2951

**Note**: Lié au problème TODO-011 mais spécifique à ProductCard avec occurrences répétées.

---

### 21. **Recherche - Erreurs recherche native GPS (structure query mismatch)**
**Fréquence**: Répétée (6+ occurrences dans les logs)
**Erreur**:
```
[ERREUR] [NativeSearch] Erreur recherche GPS optimisée (tentative 1/3): error returned from database: structure of query does not match function result type
[ERREUR] [NativeSearch] Échec recherche GPS après 3 tentatives: error returned from database: structure of query does not match function result type
```
**Problème**:
- Les recherches GPS utilisant des fonctions PostgreSQL natives échouent systématiquement
- Erreur de structure de requête qui ne correspond pas au type de retour de la fonction
- Fallback vers SQL standard après 3 tentatives
- Les recherches full-text échouent aussi avec erreurs de connexion TLS (lié à PostgreSQL crashes)

**Impact**:
- Recherches GPS non optimisées (fallback SQL plus lent)
- Performances dégradées pour la recherche géolocalisée
- Fiabilité réduite des recherches

**Localisation**:
- Backend: Service de recherche native GPS (`NativeSearch`)
- Fonctions PostgreSQL utilisées pour la recherche optimisée
- Logs: Lignes 1789-1793, 1833-1837, 1694-1695, 1949-1951

**Note**: Problème critique pour les performances de recherche.

---

### 24. **Création service - Warning "Pas de champ produits"**
**Fréquence**: Répétée (2+ occurrences)
**Warning**:
```
[save_autocomplete_combination] Pas de champ produits
```
**Problème**:
- Lors de la création de service, le champ `produits` n'est pas trouvé
- Se produit dans `save_autocomplete_combination` lors de la sauvegarde
- Impact sur l'autocomplete et les combinaisons de produits

**Impact**:
- Les combinaisons de produits ne sont peut-être pas sauvegardées correctement
- L'autocomplete pourrait ne pas fonctionner pour les nouveaux produits

**Localisation**:
- Backend: `creer_service.rs` - `save_autocomplete_combination` (ligne 4104)
- Logs: Lignes 565, 703

**Note**: Le service est créé avec succès mais les combinaisons produits peuvent être incomplètes.

---

### 25. **Recherche produits - Requêtes SQL lentes (10+ occurrences)**
**Fréquence**: Répétée (10+ warnings "slow statement")
**Warnings**:
```
slow statement: execution time exceeded alert threshold
summary: SELECT DISTINCT s.id, s.data, … (5+ occurrences)
summary: SELECT DISTINCT ON (s.id) … (2+ occurrences)
acquired connection, but time to acquire exceeded slow threshold (4+ occurrences)
```
**Problème**:
- Les requêtes de recherche de produits sont très lentes (dépassent le seuil d'alerte)
- **Type 1**: Requêtes `SELECT DISTINCT s.id, s.data, ...` avec `ts_rank` complexes sur multiples colonnes JSON (titre_service, description, champs produit, etc.)
- **Type 2**: Requêtes `SELECT DISTINCT ON (s.id)` avec extraction de produits (`s.data->'produits'->>'prix'`, CASE statements, etc.)
- **Type 3**: Acquisition de connexions PostgreSQL lente (2-4+ secondes) - pool de connexions saturé
- Requêtes avec full-text search PostgreSQL sur de multiples colonnes JSONB
- Jointures complexes avec `autocomplete_combinations` et `users`

**Impact**:
- Performances dégradées pour la recherche de produits
- Latence élevée pour l'utilisateur (plusieurs secondes)
- Peut causer des timeouts
- Pool de connexions PostgreSQL saturé
- Expérience utilisateur dégradée

**Localisation**:
- Backend: Requêtes SQL de recherche produits (full-text search + extraction JSONB)
- Services: `autocomplete_combinations_service`, `popular_products_service`, recherche native
- Logs: Lignes 1693, 1948, 2047, 2344, 2612, 2635, 2644, 2806 (slow statement)
- Logs: Lignes 1712, 1956, 2648, 2810 (slow acquire connection)

**Note**: Problème de performance critique nécessitant optimisation avec index appropriés et optimisation des requêtes.

---

### 26. **Sauvegarde médias produits - Échec sauvegarde dans table media (2+ occurrences)**
**Fréquence**: Répétée (2+ occurrences identifiées)
**Warning**:
```
[creer_service] 💾 Début sauvegarde médias pour service X (0 images globales trouvées dans data_processed)
[creer_service] 🔍 DIAGNOSTIC MÉDIAS - service_id=X - Présence médias: base64_image=false, images_realisations=false, videos=false, audio=false, produits=false
[creer_service] 🔍 DIAGNOSTIC MÉDIAS ÉCHEC - service_id=X
```
**Problème**:
- Lors de la création de service, aucun média n'est trouvé dans `data_processed`
- Les champs média (`base64_image`, `images_realisations`, `videos`, `audio`, `produits`) sont tous `false`
- La sauvegarde des médias échoue - aucun média n'est enregistré dans la table `media`
- Se produit même si des médias sont envoyés depuis le mobile (ex: vidéo convertie en base64, 8.7 MB)

**Impact**:
- Les médias des produits/services ne sont pas sauvegardés dans la table `media`
- Les images, vidéos, audio des produits ne sont pas disponibles pour affichage
- Fonctionnalité critique pour les produits avec galerie médias
- Perte de données média lors de la création de service

**Localisation**:
- Backend: `creer_service.rs` - Fonction de sauvegarde médias (ligne 1981-2001, 3001)
- Problème: Les médias ne sont pas correctement extraits de `data_processed` avant sauvegarde
- Logs: Lignes 541-545 (service 118), 678-682 (service 119)

**Note**: Problème critique pour la gestion des médias produits - les médias envoyés depuis le mobile ne sont pas sauvegardés.

---

### 22. **SearchHistoryService - Erreur enregistrement historique recherche**
**Fréquence**: Répétée (3+ occurrences)
**Erreur**:
```
[SearchHistoryService] Erreur enregistrement recherche: {}
Data: {"message":"undefined is not a function","name":"TypeError"}
```
**Problème**:
- L'enregistrement de l'historique de recherche échoue avec "undefined is not a function"
- TypeError dans `recordSearch`
- Impacte la fonctionnalité d'historique de recherche

**Impact**:
- Historique de recherche non sauvegardé
- L'utilisateur ne peut pas retrouver ses recherches précédentes
- Fonctionnalité historique non fonctionnelle

**Localisation**:
- Mobile: `SearchHistoryService` - Méthode `recordSearch`
- Logs: Lignes 1721-1723, 1980-1982, 2058-2059

**Note**: Problème TypeScript/JavaScript - fonction non définie.

---

### 19. **DeliveryMatchingWorker - Aucune livraison**
**Fréquence**: Répétée (toutes les 30 secondes)
**Observation**:
```
[DeliveryMatchingWorker] Aucune livraison à traiter (batch = 10)
```
**Note**: Ce n'est pas une erreur, mais indique soit:
- Aucune livraison en attente (normal)
- Ou problème de requête/filtre (à vérifier)

---

## 📋 PLAN DE CORRECTION - TODO

### 🚨 PRIORITÉ 1 - CRITIQUE

- [ ] **TODO-001**: Corriger la route WebSocket
  - [ ] Vérifier que le backend expose bien `/ws` ou `/api/ws`
  - [ ] Vérifier que la route WebSocket retourne HTTP 101 (Upgrade)
  - [ ] Vérifier la configuration Axum pour WebSocket
  - [ ] Corriger l'URL WebSocket côté mobile si nécessaire
  - [ ] Tester la connexion WebSocket

- [ ] **TODO-002**: Initialiser Firebase dans l'app mobile
  - [ ] Créer `google-services.json` pour Android
  - [ ] Configurer Firebase dans `app.json` / `app.config.js`
  - [ ] Initialiser FirebaseApp au démarrage de l'app
  - [ ] Suivre le guide: https://docs.expo.dev/push-notifications/fcm-credentials/
  - [ ] Tester l'enregistrement des tokens push

- [ ] **TODO-003**: Corriger l'endpoint `/api/banques-sang`
  - [ ] Vérifier la route backend (POST vs GET)
  - [ ] Soit modifier le backend pour accepter GET
  - [ ] Soit modifier le mobile pour utiliser POST
  - [ ] Tester l'appel API

- [ ] **TODO-020**: Vérifier tous les autres services spécialisés pour problèmes similaires
  - [ ] Vérifier `/api/pharmacies` - méthode HTTP (GET vs POST), erreurs de parsing
  - [ ] Vérifier `/api/hopitaux` - méthode HTTP, erreurs de parsing, réponses vides
  - [ ] Vérifier `/api/laboratoires` - méthode HTTP, erreurs de parsing
  - [ ] Vérifier `/api/agences-voyage` - méthode HTTP, erreurs de parsing
  - [ ] Vérifier `/api/taxis` - méthode HTTP, erreurs de parsing
  - [ ] Vérifier `/api/covoiturages` - méthode HTTP, erreurs de parsing
  - [ ] Tester chaque endpoint depuis le mobile
  - [ ] Vérifier les codes de réponse HTTP (405, 500, etc.)
  - [ ] Vérifier le format des réponses (JSON valide vs HTML/plain text)
  - [ ] Standardiser les méthodes HTTP entre mobile et backend pour tous les services
  - [ ] Ajouter une gestion d'erreur cohérente pour tous les services spécialisés

- [ ] **TODO-004**: Corriger l'endpoint `/api/products/{id}/{variant}/reactions`
  - [ ] Identifier la cause de l'erreur 500
  - [ ] Vérifier que la réponse est bien du JSON (pas HTML/plain text)
  - [ ] Ajouter une gestion d'erreur appropriée
  - [ ] Tester les réactions produits

- [ ] **TODO-015**: Investiguer les crashes PostgreSQL - CRITIQUE
  - [ ] Analyser les logs PostgreSQL détaillés
  - [ ] Vérifier les ressources (CPU, RAM, disque) sur Render
  - [ ] Identifier les requêtes causant les crashes
  - [ ] Vérifier les timeouts de connexion
  - [ ] Implémenter un retry mechanism avec backoff
  - [ ] Considérer l'upgrade du plan PostgreSQL si nécessaire
  - [ ] Monitorer activement les crashes

### 🔶 PRIORITÉ 2 - IMPORTANT

- [ ] **TODO-005**: Corriger la double lecture des réponses HTTP
  - [ ] Refactoriser le service API mobile
  - [ ] Ne lire `.json()` qu'une seule fois
  - [ ] Utiliser `.clone()` ou `.text()` pour debug si nécessaire
  - [ ] Améliorer la gestion d'erreur

- [ ] **TODO-006**: Corriger FeatureFlagContext
  - [ ] Identifier pourquoi le fetch échoue
  - [ ] Vérifier l'URL de l'endpoint feature flags
  - [ ] Ajouter un fallback (valeurs par défaut)
  - [ ] Gérer les erreurs de réseau

- [ ] **TODO-007**: Mettre à jour expo-image-picker
  - [ ] Remplacer `MediaTypeOptions` par `MediaType`
  - [ ] Tester la sélection d'images
  - [ ] Vérifier la compatibilité avec la version Expo actuelle

- [ ] **TODO-008**: Corriger MesProduitsScreen - Produits null/undefined et "Service sans titre"
  - [ ] Identifier pourquoi la "réponse allégée" supprime les produits (vérifier `get_services_for_prestataire`)
  - [ ] Vérifier pourquoi les produits sont `null/undefined` côté mobile alors que le backend les logue
  - [ ] Corriger l'extraction des produits dans la réponse allégée
  - [ ] Corriger l'affichage des titres de service ("Service sans titre")
  - [ ] Vérifier le mapping/parsing côté mobile des produits et titres
  - [ ] Tester avec différents services ayant des produits
  - [ ] S'assurer que les produits sont préservés lors de l'allègement de la réponse

- [ ] **TODO-009**: Corriger l'endpoint `/api/places/enrich`
  - [ ] Identifier la cause de l'erreur 500
  - [ ] Vérifier les logs backend détaillés
  - [ ] Ajouter une gestion d'erreur robuste
  - [ ] Tester l'enrichissement de lieux

### 🔵 PRIORITÉ 3 - AMÉLIORATIONS

- [ ] **TODO-010**: Améliorer la validation des services
  - [ ] Forcer la présence d'un titre lors de la création
  - [ ] Ajouter une validation backend stricte
  - [ ] Afficher des messages d'erreur clairs côté mobile
  - [ ] Générer un titre par défaut si absent

- [ ] **TODO-011**: Corriger les données de localisation manquantes
  - [ ] Vérifier pourquoi `locationVector` est vide
  - [ ] S'assurer que les services ont des données géographiques
  - [ ] Calculer la distance même si certaines données manquent
  - [ ] Afficher "Localisation non disponible" au lieu de rien

- [ ] **TODO-012**: Optimiser le connection pooling HTTP
  - [ ] Configurer un client `reqwest` partagé avec connection pooling
  - [ ] Réutiliser les connexions HTTP
  - [ ] Monitorer les performances

- [ ] **TODO-013**: Améliorer les logs et le monitoring
  - [ ] Ajouter plus de contexte dans les erreurs
  - [ ] Loguer les réponses brutes avant parsing
  - [ ] Ajouter des métriques pour les erreurs fréquentes
  - [ ] Créer un dashboard d'alertes

- [ ] **TODO-014**: Corriger LinearAutocompleteEditor - Problèmes valeurs vides et sousCaracteristiques
  - [ ] Identifier pourquoi `value` est toujours `[]` au démarrage
  - [ ] Vérifier pourquoi `sousCaracteristiques` est un objet vide `{}`
  - [ ] Vérifier l'endpoint backend retournant les sousCaracteristiques
  - [ ] Corriger la logique de création de chips quand `displayValue` est vide
  - [ ] Améliorer la gestion des candidats vides
  - [ ] Ajouter une validation pour éviter les warnings inutiles
  - [ ] Tester la sélection de caractéristiques produits dans le formulaire

- [ ] **TODO-016**: Corriger MixedContentCarousel - Contenu vide
  - [ ] Vérifier pourquoi `/api/content/mixed` retourne `dataLength: 0`
  - [ ] Corriger le parsing de la réponse (objet vs array)
  - [ ] Vérifier pourquoi les produits organiques ne sont pas trouvés
  - [ ] Améliorer le fallback vers API standard
  - [ ] Tester l'affichage du contenu mixte sur HomeScreen

- [ ] **TODO-017**: Résoudre le problème GPS causant des crashes
  - [ ] Identifier la cause des crashes GPS
  - [ ] Implémenter une gestion d'erreur robuste pour le GPS
  - [ ] Réactiver le GPS automatique de manière sécurisée
  - [ ] Tester la géolocalisation automatique sans crashes

- [ ] **TODO-018**: Corriger affichage icône recherche services spécialisés HomeScreen
  - [ ] Vérifier pourquoi `SpecializedServicesSelector` ne s'affiche pas
  - [ ] Vérifier les styles `specializedServicesContainer` (marginLeft, visibility, opacity)
  - [ ] Vérifier que le composant est bien rendu dans le layout
  - [ ] Tester avec différents modes (compact vs normal)
  - [ ] Vérifier les dimensions et le z-index
  - [ ] Tester sur différents appareils Android
  - [ ] Ajouter des logs de debug pour le rendu du composant

- [ ] **TODO-019**: Corriger problèmes scroll automatique et horizontal HomeScreen
  - [ ] Vérifier pourquoi le scroll automatique est désactivé par configuration
  - [ ] Corriger le `contentLength: 0` dans MixedContentCarousel
  - [ ] Réactiver le scroll automatique quand il y a du contenu
  - [ ] Vérifier le scroll horizontal pour les produits
  - [ ] Tester le scroll sur différents contenus
  - [ ] Améliorer la gestion du scroll quand le contenu est vide

- [ ] **TODO-021**: Corriger ProductCard - Distance non calculable (15+ warnings)
  - [ ] Identifier pourquoi la distance n'est pas calculée même avec `gps_fixe` disponible
  - [ ] Vérifier le calcul de distance dans ProductCard
  - [ ] S'assurer que `locationVector` et `chosenLocation` sont correctement remplis
  - [ ] Corriger les données manquantes (`adresse`, `ville`, `region`, `pays`)
  - [ ] Implémenter un fallback pour calculer la distance depuis `gps_fixe` si disponible
  - [ ] Améliorer la gestion des cas où la distance ne peut pas être calculée (afficher "Distance non disponible")
  - [ ] Tester avec différents services (58, 5, 13)

- [ ] **TODO-022**: Corriger recherche native GPS - Structure query mismatch
  - [ ] Identifier la fonction PostgreSQL causant l'erreur "structure of query does not match function result type"
  - [ ] Vérifier la définition de la fonction PostgreSQL pour la recherche GPS optimisée
  - [ ] Corriger la structure de retour de la fonction pour correspondre à la requête
  - [ ] Tester la recherche GPS optimisée après correction
  - [ ] Vérifier les autres fonctions PostgreSQL utilisées pour la recherche native
  - [ ] Améliorer les messages d'erreur pour faciliter le debugging

- [ ] **TODO-023**: Corriger SearchHistoryService - Erreur enregistrement historique
  - [ ] Identifier la fonction `undefined` dans `recordSearch`
  - [ ] Vérifier les imports et dépendances de SearchHistoryService
  - [ ] Corriger la méthode d'enregistrement de l'historique
  - [ ] Tester l'enregistrement de l'historique de recherche
  - [ ] Vérifier que l'historique s'affiche correctement dans l'UI

- [ ] **TODO-024**: Corriger warning "Pas de champ produits" lors création service
  - [ ] Identifier pourquoi le champ `produits` n'est pas trouvé dans `save_autocomplete_combination`
  - [ ] Vérifier la structure des données lors de la création de service
  - [ ] S'assurer que les produits sont inclus dans la sauvegarde des combinaisons
  - [ ] Tester la création de service avec des produits
  - [ ] Vérifier que l'autocomplete fonctionne après création

- [ ] **TODO-025**: Optimiser requêtes SQL lentes recherche produits (10+ slow statements)
  - [ ] Analyser les requêtes SQL avec EXPLAIN ANALYZE (SELECT DISTINCT et SELECT DISTINCT ON)
  - [ ] Créer des index appropriés pour les champs JSONB utilisés dans ts_rank
  - [ ] Optimiser les requêtes full-text search (réduire nombre de colonnes recherchées)
  - [ ] Optimiser les requêtes avec extraction JSONB (`s.data->'produits'->>'prix'`)
  - [ ] Améliorer le pool de connexions PostgreSQL (réduire temps d'acquisition > 2s)
  - [ ] Considérer la pagination pour limiter les résultats
  - [ ] Optimiser les jointures avec `autocomplete_combinations` et `users`
  - [ ] Monitorer les performances après optimisation

- [ ] **TODO-026**: Corriger affichage adresse produit (59+ occurrences undefined)
  - [ ] Identifier pourquoi `product.adresse`, `product.ville`, `product.region`, `pays` sont undefined
  - [ ] Vérifier l'extraction des données d'adresse depuis la réponse API
  - [ ] S'assurer que les données géographiques sont incluses dans les réponses backend
  - [ ] Corriger le mapping des données d'adresse dans ProductCard
  - [ ] Implémenter un fallback pour afficher les données disponibles
  - [ ] Corriger l'affichage du drapeau de pays (utiliser le bon emoji au lieu de 🌍)
  - [ ] Tester avec différents produits ayant des adresses complètes

- [ ] **TODO-027**: Corriger sauvegarde médias produits dans table media
  - [ ] Identifier pourquoi `0 images globales trouvées dans data_processed`
  - [ ] Vérifier l'extraction des médias depuis les données envoyées par le mobile
  - [ ] Corriger la fonction de sauvegarde médias dans `creer_service.rs`
  - [ ] S'assurer que `base64_image`, `images_realisations`, `videos`, `audio` sont correctement extraits
  - [ ] Vérifier que les médias sont bien envoyés depuis le mobile (logs montrent conversion base64)
  - [ ] Tester la sauvegarde des médias après création de service avec images/vidéos
  - [ ] Vérifier que les médias sont bien insérés dans la table `media`

---

## 📊 RÉSUMÉ QUANTITATIF

| Catégorie | Nombre | Priorité |
|-----------|--------|----------|
| Erreurs critiques | 8 | 🔴 |
| Warnings moyens | 6 | ⚠️ |
| Problèmes de données | 8 | 📊 |
| Observations | 6 | 🟡 |
| **TOTAL** | **28** | |

---

## 🔍 RECOMMANDATIONS GÉNÉRALES

1. **Tester systématiquement les endpoints** après chaque modification
2. **Ajouter des tests unitaires** pour les cas d'erreur
3. **Améliorer la gestion d'erreur** avec des messages clairs
4. **Documenter les APIs** avec des exemples de réponses
5. **Mettre en place un monitoring** des erreurs en production
6. **Valider les données** côté backend ET mobile
7. **Utiliser TypeScript strict** pour éviter les null/undefined
8. **Configurer correctement** Firebase, WebSocket, etc. dès le début

---

**Document généré automatiquement le 2025-11-27**
