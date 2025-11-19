# Prompt de continuation - Phase 9 et phases suivantes

## Contexte du projet
- **Monorepo**: C:\Users\23767\yukpomnang2
- **Backend**: Rust avec Axum, SQLx, PostgreSQL, pgvector
- **Frontend**: React avec TypeScript, TailwindCSS
- **Mobile**: React Native avec Expo, TypeScript
- **Base de données**: PostgreSQL avec extensions pgvector et imgsmlr
- **Stockage**: S3/Wasabi déjà implémenté pour les vidéos (à réutiliser)

## État actuel - Phase 9 en cours

### ✅ Ce qui a été fait

#### 1. Amélioration 28: Sélection livreur
- Backend: `preferred_courier_id` dans `deliveries`
- Endpoints: `POST /delivery/{id}/assign-courier`, `GET /couriers/available`
- Frontend/Mobile: `CourierSelectionModal` intégré

#### 2. Amélioration 29: Notification client fournit adresse
- WebSocket event `DropoffAddressProvided`
- Push notifications
- Badge "Adresse à confirmer" dans l'UI

#### 3. Amélioration 30: Amélioration UX dropoff pending
- Badge et bouton "Modifier l'adresse" pour `dropoff_pending`
- Interface pour confirmer/modifier l'adresse

#### 4. Amélioration 31: Chaînage vidéos
- Table `video_dependencies`
- Endpoints: `POST /studio/sessions/{id}/dependencies`, `GET /studio/sessions/{id}/next`
- Navigation automatique vers la vidéo suivante dans le feed

#### 5. Amélioration 32: Plusieurs lieux de stock
- Table `merchant_storage_locations` avec `zone_id` (référence à `delivery_zones`)
- CRUD complet pour les lieux de stock
- Pages: `StorageLocationsPage` (frontend) et `StorageLocationsScreen` (mobile)
- Lien dans "Mes services" (frontend)
- Matching du coursier intègre la sélection du lieu de stock le plus proche
- **IMPORTANT**: Les "zones" font référence aux `delivery_zones` qui peuvent être associées aux lieux de stock

#### 6. Amélioration 33: Renommage pickup/dropoff
- Terminologie mise à jour dans tout le code

#### 7. Raisons de refus de colis
- ENUM `parcel_rejection_reason`
- Champ `rejection_reason` dans `shopping_order_items`
- Modals de refus avec raisons prédéfinies
- Intégré dans le suivi de livraison

#### 8. Médias de preuve de livraison (pickup/delivery)
- Table `delivery_proof_media` créée
- Endpoints:
  - `POST /api/media/upload-proof` (multipart/form-data)
  - `GET /api/delivery/{id}/proof-media`
  - `DELETE /api/delivery/{id}/proof-media/{media_id}`
  - `GET /api/media/proof/{filename}` (servir fichiers)
- Composants `ProofMediaUpload` (frontend et mobile)
- Comparaison automatique état initial (pickup) vs final (delivery)
- **⚠️ À FAIRE**: Connecter le service S3/Wasabi existant dans `upload_to_s3_wasabi()` (backend/src/routes/media_upload_routes.rs)

### 🔧 Corrections nécessaires

#### 1. Erreurs dans mobile/
- ✅ Corrigé: Duplication interface `DeliveryZone` dans `StorageLocationsScreen.tsx`
- ✅ Corrigé: Typage de `listDeliveryZones()` dans `api.ts`
- ⚠️ À vérifier: Toutes les erreurs TypeScript dans le dossier mobile

#### 2. Intégration S3/Wasabi
- **Fichier**: `backend/src/routes/media_upload_routes.rs`
- **Fonction**: `upload_to_s3_wasabi()` (lignes 29-120)
- **Action**: Trouver le service S3/Wasabi existant (probablement dans `video_generation_service.rs` ou un service dédié)
- **Instructions détaillées**: Voir commentaires dans la fonction

#### 3. Vérification comportement vidéo/images
- **À vérifier**: Le coursier peut-il bien prendre des photos/vidéos à l'arrivée (pickup) ?
- **À vérifier**: Le coursier peut-il bien prendre des photos/vidéos à la livraison (delivery) ?
- **À vérifier**: Les médias s'affichent-ils correctement dans l'interface client/créateur ?
- **À vérifier**: La comparaison pickup vs delivery fonctionne-t-elle ?

#### 4. Zones de localisation des produits
- **Question**: Le composant d'identification des zones de l'occasion des produits permet-il d'associer une ou plusieurs zones de localisation à un produit ?
- **À vérifier**: Si non, l'ajouter
- **À vérifier**: Le composant est-il présent dans la page "Mes services" (homescreen) ?
- **Clarification**: Les "zones" font référence aux `delivery_zones` qui peuvent être associées aux `merchant_storage_locations`

## Phases restantes à dérouler

### Phase 9 - Améliorations restantes (si non terminées)
- Vérifier `PROMPT_PHASE_9_ET_SUIVANTES.md` pour la liste complète
- Toutes les améliorations 28-33 doivent être terminées et testées

### Phases suivantes
- Consulter `PLAN_COMPLET_AMELIORATIONS_LIVRAISON.md` pour la roadmap complète
- Les phases suivantes seront définies selon les besoins métier

## Tâches prioritaires pour la prochaine session

### 1. Vérifications et corrections immédiates
- [ ] **URGENT**: Vérifier toutes les erreurs TypeScript dans `mobile/` et les corriger
- [ ] **URGENT**: Connecter le service S3/Wasabi dans `upload_to_s3_wasabi()` (backend/src/routes/media_upload_routes.rs)
  - Chercher le service existant dans `video_generation_service.rs` ou un service dédié
  - Réutiliser la même logique que pour les vidéos
- [ ] Tester l'upload de médias (images/vidéos) depuis mobile et frontend
- [ ] Vérifier l'affichage des médias dans l'interface
- [ ] Vérifier la comparaison pickup vs delivery

### 2. Vérification comportement vidéo/images à l'arrivée
- [ ] **IMPORTANT**: Vérifier que le coursier peut bien prendre des photos/vidéos à l'arrivée (pickup)
- [ ] **IMPORTANT**: Vérifier que le coursier peut bien prendre des photos/vidéos à la livraison (delivery)
- [ ] Vérifier que les permissions caméra/galerie fonctionnent sur mobile
- [ ] Vérifier que l'upload fonctionne correctement
- [ ] Vérifier que les médias s'affichent correctement dans l'interface client/créateur
- [ ] Vérifier que la comparaison pickup vs delivery fonctionne et permet d'évaluer les dégradations

### 3. Zones de localisation des produits
- [ ] **CLARIFICATION IMPORTANTE**: 
  - Les "zones" font référence aux `delivery_zones` qui peuvent être associées aux `merchant_storage_locations` (lieux de stock)
  - Vérifier si le composant d'identification des zones de l'occasion des produits permet d'associer une ou plusieurs zones de localisation à un produit
  - Si non, ajouter cette fonctionnalité
- [ ] **VÉRIFICATION**: Le composant d'identification des zones est-il présent dans la page "Mes services" (homescreen) ?
  - Si non, l'ajouter comme lien au pied de page
- [ ] S'assurer que les zones référencent bien les `delivery_zones` associées aux lieux de stock
- [ ] Vérifier que le matching du coursier intègre bien les zones multiples si elles existent

### 3. Documentation
- [ ] Mettre à jour la documentation des APIs
- [ ] Documenter l'intégration S3/Wasabi
- [ ] Documenter le workflow des médias de preuve

## Fichiers importants modifiés récemment

### Backend
- `backend/src/migrations/auto_migrate.rs` - Migrations pour `delivery_proof_media`, `merchant_storage_locations`, etc.
- `backend/src/models/delivery_model.rs` - Modèles `DeliveryProofMedia`, `MerchantStorageLocation`, etc.
- `backend/src/routes/delivery_routes.rs` - Endpoints pour médias, zones, lieux de stock
- `backend/src/routes/media_upload_routes.rs` - **NOUVEAU** - Upload de médias (S3 à connecter)
- `backend/src/services/delivery_service.rs` - Logique de matching avec lieux de stock

### Frontend
- `frontend/src/pages/delivery/StorageLocationsPage.tsx` - Gestion lieux de stock
- `frontend/src/components/delivery/ProofMediaUpload.tsx` - Upload médias
- `frontend/src/pages/delivery/DeliveryTrackingPage.tsx` - Intégration médias
- `frontend/src/services/deliveryApi.ts` - API client

### Mobile
- `mobile/src/screens/delivery/StorageLocationsScreen.tsx` - Gestion lieux de stock
- `mobile/src/components/delivery/ProofMediaUpload.tsx` - Upload médias
- `mobile/src/screens/delivery/DeliveryShoppingTrackingScreen.tsx` - Intégration médias
- `mobile/src/services/api.ts` - API client (corrections apportées)

## Variables d'environnement nécessaires

```env
# S3/Wasabi (pour médias de preuve)
WASABI_BUCKET=your-bucket-name
WASABI_REGION=us-east-1
WASABI_ACCESS_KEY=your-access-key
WASABI_SECRET_KEY=your-secret-key
WASABI_ENDPOINT=https://s3.wasabisys.com  # Optionnel

# Ou stockage local (fallback)
MEDIA_UPLOAD_DIR=./uploads/proof_media
```

## Commandes utiles

```bash
# Backend
cargo fmt
cargo check
cargo test
cargo clippy

# Frontend
npm run dev
npm run build
npm run lint

# Mobile
npm run start
npm run android
npm run ios
```

## Notes importantes

1. **Zones vs Lieux de stock**: 
   - Les `delivery_zones` sont des zones géographiques de livraison
   - Les `merchant_storage_locations` sont les lieux de stock des marchands
   - Un lieu de stock peut avoir une `zone_id` qui référence une `delivery_zone`
   - Les zones de localisation des produits doivent permettre d'associer des `delivery_zones` aux produits

2. **S3/Wasabi**: 
   - Le service est déjà implémenté pour les vidéos
   - Chercher dans `video_generation_service.rs` ou un service dédié
   - Réutiliser la même logique pour les médias de preuve

3. **Médias de preuve**:
   - Le coursier peut uploader des médias lors du pickup (récupération)
   - Le coursier peut uploader des médias lors du delivery (livraison)
   - La comparaison permet d'évaluer les dégradations

## Questions à résoudre

1. **URGENT**: Où se trouve exactement le service S3/Wasabi existant ? (chercher dans `video_generation_service.rs` ou un service dédié)
2. **IMPORTANT**: Le composant d'identification des zones de l'occasion des produits permet-il d'associer une ou plusieurs zones de localisation à un produit ?
3. **IMPORTANT**: Le composant d'identification des zones est-il bien présent dans la page "Mes services" (homescreen) comme lien au pied de page ?
4. **URGENT**: Y a-t-il d'autres erreurs dans le dossier mobile à corriger ?
5. **IMPORTANT**: Le comportement de prise de vidéo/images à l'arrivée fonctionne-t-il correctement ?

## Clarifications importantes

### Zones de localisation
- **Les "zones"** font référence aux `delivery_zones` (zones géographiques de livraison)
- **Les lieux de stock** (`merchant_storage_locations`) peuvent avoir une `zone_id` qui référence une `delivery_zone`
- **Les produits** peuvent avoir des zones de localisation associées (à vérifier/implémenter)
- **Le matching du coursier** doit intégrer les zones multiples si elles existent

### Médias de preuve
- Le coursier peut uploader des médias lors du **pickup** (récupération du produit)
- Le coursier peut uploader des médias lors du **delivery** (livraison au client)
- La comparaison permet d'évaluer les dégradations entre pickup et delivery
- Les médias doivent être uploadés vers S3/Wasabi (service à connecter)

## Prochaines étapes (ordre de priorité)

### Étape 1: Corrections urgentes
1. **Corriger toutes les erreurs TypeScript dans `mobile/`**
2. **Connecter le service S3/Wasabi** dans `upload_to_s3_wasabi()`
   - Chercher le service existant
   - Réutiliser la logique des vidéos
   - Tester l'upload

### Étape 2: Vérifications importantes
3. **Vérifier le comportement vidéo/images à l'arrivée**
   - Tester sur mobile: prise de photo/vidéo au pickup
   - Tester sur mobile: prise de photo/vidéo au delivery
   - Vérifier l'affichage dans l'interface
   - Vérifier la comparaison pickup vs delivery

### Étape 3: Zones de localisation
4. **Vérifier le composant d'identification des zones**
   - Permet-il d'associer des zones aux produits ?
   - Est-il présent dans "Mes services" ?
   - Si non, l'ajouter/le corriger

### Étape 4: Finalisation Phase 9
5. **Tester toutes les améliorations de la Phase 9**
6. **Documenter les APIs et workflows**
7. **Continuer avec les phases suivantes**

