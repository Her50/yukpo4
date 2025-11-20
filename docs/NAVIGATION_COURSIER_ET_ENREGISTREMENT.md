# 📍 Navigation Coursier et Enregistrement - État Actuel

## 🔍 Réponses aux Questions

### 1. Comment le coursier reçoit-il les directions Google Maps ?

#### ✅ Backend (Déjà implémenté)
- **Route API** : `GET /api/delivery/{id}/navigation`
- **Service** : `GeographicMatchingService.get_navigation_directions()`
- **Notification automatique** : Lors du matching, le coursier reçoit une notification push avec :
  - `navigation_available: true`
  - `navigation_endpoint: "/api/delivery/{id}/navigation"`
  - Coordonnées GPS du pickup et dropoff

#### ⚠️ Frontend (À compléter)
- **Service API** : ✅ `getCourierNavigation()` ajouté dans `frontend/src/services/deliveryApi.ts`
- **Écrans à modifier** :
  - `frontend/src/pages/delivery/CourierDashboardPage.tsx` - **Bouton navigation manquant**
  - `frontend/src/pages/delivery/DeliveryTrackingPage.tsx` - **Bouton navigation manquant pour coursier**

#### ⚠️ Mobile (À compléter)
- **Service API** : ✅ `getCourierNavigation()` ajouté dans `mobile/src/services/api.ts`
- **Écrans à modifier** :
  - `mobile/src/screens/delivery/DeliveryShoppingTrackingScreen.tsx` - **Bouton navigation manquant pour coursier**
  - Pas d'écran équivalent à `CourierDashboardPage` côté mobile

### 2. Où se trouve la page d'enregistrement d'un coursier ?

#### ✅ Backend (Déjà implémenté)
- **Route API** : `POST /api/courier/applications`
- **Service** : `DeliveryService.submit_courier_application()`

#### ❌ Frontend (Manquant)
- **Service API** : ✅ `submitCourierApplication()` ajouté dans `frontend/src/services/deliveryApi.ts`
- **Page à créer** : `/become-courier` ou `/courier/register`

#### ❌ Mobile (Manquant)
- **Service API** : ✅ `submitCourierApplication()` ajouté dans `mobile/src/services/api.ts`
- **Écran à créer** : `CourierRegistrationScreen.tsx`

---

## 📋 Actions Requises

### Phase 1 : Ajouter boutons navigation dans les écrans existants

#### Frontend - CourierDashboardPage.tsx
```typescript
// Ajouter bouton "Voir navigation" pour le coursier
{isCourier && (
  <Button onClick={handleOpenNavigation}>
    <Navigation2 className="w-4 h-4 mr-2" />
    Voir navigation
  </Button>
)}
```

#### Frontend - DeliveryTrackingPage.tsx
```typescript
// Ajouter bouton navigation pour le coursier
{isCourier && (
  <Button onClick={handleOpenNavigation}>
    <Navigation2 className="w-4 h-4 mr-2" />
    Navigation GPS
  </Button>
)}
```

#### Mobile - DeliveryShoppingTrackingScreen.tsx
```typescript
// Ajouter bouton navigation dans la section coursier
{isCurrentUserCourier && (
  <NativeButton
    title="🗺️ Voir navigation"
    variant="primary"
    onPress={handleOpenNavigation}
  />
)}
```

### Phase 2 : Créer pages/écrans d'enregistrement coursier

#### Frontend - Créer `CourierRegistrationPage.tsx`
- Formulaire avec :
  - Informations personnelles
  - Documents (CNI, permis de conduire, etc.)
  - Type de véhicule
  - Disponibilités
- Appel à `submitCourierApplication()`

#### Mobile - Créer `CourierRegistrationScreen.tsx`
- Même formulaire adapté mobile
- Upload de documents via `expo-document-picker`
- Appel à `deliveryApi.submitCourierApplication()`

### Phase 3 : Ajouter navigation dans les routes

#### Frontend - `App.tsx` ou router
```typescript
<Route path="/become-courier" element={<CourierRegistrationPage />} />
<Route path="/delivery/:id/courier" element={<CourierDashboardPage />} />
```

#### Mobile - `AppNavigator.tsx`
```typescript
<Stack.Screen name="CourierRegistration" component={CourierRegistrationScreen} />
```

---

## 🎯 Fonctionnalités Navigation Coursier

### Ce qui fonctionne déjà :
1. ✅ Backend génère les directions Google Maps
2. ✅ Notification push envoyée au coursier avec endpoint
3. ✅ API route accessible avec authentification
4. ✅ Service API ajouté côté frontend et mobile

### Ce qui manque :
1. ❌ Boutons UI pour accéder à la navigation
2. ❌ Affichage des directions dans l'interface
3. ❌ Intégration avec Google Maps (ouverture app native)
4. ❌ Mise à jour automatique de la position coursier

---

## 📱 Où le coursier peut-il voir ses livraisons ?

### Frontend :
- ✅ `/delivery/:id` - `DeliveryTrackingPage.tsx` (vue client/coursier)
- ✅ `/delivery/:id/courier` - `CourierDashboardPage.tsx` (vue coursier dédiée)

### Mobile :
- ✅ `DeliveryShoppingTrackingScreen` - Vue tracking (accessible si coursier)
- ❌ Pas d'écran dédié "Mes livraisons coursier"

---

## 🔗 Liens Utiles

- Backend route navigation : `backend/src/routes/delivery_routes.rs` ligne ~183
- Service navigation : `backend/src/services/geographic_matching_service.rs`
- Frontend service : `frontend/src/services/deliveryApi.ts`
- Mobile service : `mobile/src/services/api.ts`


