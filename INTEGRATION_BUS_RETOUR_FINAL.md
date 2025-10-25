# 🚌 INTÉGRATION FINALE - NOTIFICATION BUS RETOUR

## ✅ Ce qui a été implémenté

### 1. Interface Utilisateur - Demande de Retour ✅
**Fichier:** `mobile/src/components/BusSeatSelector.tsx`

- ✅ Switch "Souhaitez-vous réserver votre retour ?"
- ✅ Champs date et heure de retour
- ✅ Passage automatique des données à `ResultatBesoinScreen`
- ✅ Message de confirmation incluant l'abonnement aux notifications

### 2. Appel API Demande de Retour ✅
**Fichier:** `mobile/src/screens/ResultatBesoinScreen.tsx`

- ✅ Import `useNotifications` hook
- ✅ Appel à `subscribeToReturnBusNotifications` après réservation
- ✅ Message confirmant l'abonnement aux notifications

### 3. Fonction Utilitaire - Check Return Requests ✅
**Fichier:** `mobile/src/utils/busReturnNotifier.ts`

Fonctions créées:
- `checkAndNotifyReturnRequests()` - Appel API
- `handleBusCreated()` - Helper pour intégration facile

### 4. Endpoint Backend ✅
**Fichier:** `backend/src/routes/bus_reservations.rs`

- ✅ Endpoint `POST /api/bus/check-return-requests`
- ✅ Payload: `busId`, `departureCity`, `arrivalCity`, `departureDate`, `departureTime`
- ✅ Appelle `push_notification_service::check_and_notify_return_requests()`

---

## 🔧 RESTE À FAIRE - Intégration dans le Parent

**ProductManagerMobile.tsx** est un composant de formulaire pur. Il ne fait PAS l'appel API lui-même.

### Où ajouter l'appel ?

Cherchez le composant **PARENT** qui utilise `<ProductManagerMobile>` et qui fait l'appel API de création de produit.

**Composants possibles:**
- `YukpointIntelligentScreen.tsx`
- `ServiceManagerScreen.tsx`
- Tout composant qui utilise `<ProductManagerMobile>`

---

## 📝 Code à Ajouter dans le Composant Parent

### Étape 1: Import

```typescript
import { handleBusCreated } from '../utils/busReturnNotifier';
```

### Étape 2: Après création réussie du produit

```typescript
// Exemple dans le handler de création de produit
const handleCreateProduct = async (productData) => {
    try {
        // 1. Créer le produit via API
        const response = await apiPost('/products/create', productData);
        
        if (response.success && response.productId) {
            // 2. Si c'est un ticket de voyage, vérifier les demandes de retour
            if (productData.type === 'ticket_voyage') {
                await handleBusCreated(response.productId, {
                    depart: productData.depart,
                    destination: productData.destination,
                    dateDepart: productData.dateDepart,
                    heureDepart: productData.heureDepart
                });
            }
            
            // 3. Afficher confirmation
            Alert.alert('Succès', 'Produit créé avec succès!');
        }
    } catch (error) {
        console.error('Erreur création produit:', error);
        Alert.alert('Erreur', 'Impossible de créer le produit');
    }
};
```

---

## 🔍 Comment Trouver le Composant Parent

### Méthode 1: Recherche par Import

```bash
# Chercher qui importe ProductManagerMobile
grep -r "ProductManagerMobile" mobile/src --include="*.tsx" --include="*.ts"
```

### Méthode 2: Recherche par Nom de Route

Si ProductManagerMobile est dans une route/screen:
```bash
# Chercher dans la navigation
grep -r "ProductManager" mobile/src/navigation --include="*.tsx"
```

### Méthode 3: Chercher l'API Call

```bash
# Chercher qui fait l'appel à l'API de création de produit
grep -r "apiPost.*product" mobile/src --include="*.tsx" -A 5
```

---

## 🎯 Tests

### Test 1: Créer un Bus

1. Ouvrir l'app en tant que prestataire
2. Créer un nouveau produit `ticket_voyage`
3. Remplir: Douala → Yaoundé, 15/02/2025, 14:00
4. Soumettre

**Résultat attendu:**
- Console log: `🔍 Vérification demandes de retour pour nouveau bus`
- Console log: `ℹ️ Aucune demande de retour correspondante` (si première fois)

### Test 2: Demande de Retour

1. En tant que client, réserver un bus Douala → Yaoundé (aller)
2. Cocher "Souhaitez-vous réserver votre retour ?"
3. Saisir: 20/02/2025, 15:00
4. Confirmer la réservation

**Résultat attendu:**
- Console log: `✅ Demande de retour enregistrée`
- Message: "🔔 Vous serez notifié dès qu'un bus retour sera disponible!"

### Test 3: Notification Automatique

1. En tant que prestataire, créer un bus Yaoundé → Douala
2. Date: 20/02/2025, Heure: 14:30 (±30 min du 15:00 demandé)
3. Soumettre

**Résultat attendu:**
- Console log: `✅ 1 utilisateur(s) notifié(s)`
- Le client reçoit notification push: "🚌 Bus Retour Disponible!"
- Demande passe de `'pending'` à `'matched'` dans la DB

---

## 📊 Architecture Complète

```
CLIENT (Aller)
  └─> BusSeatSelector
       └─> Coche "Demander retour" (20/02 à 15:00)
       └─> handleConfirm()
            └─> returnTripData = { wantReturn, returnDate, returnTime }

  └─> ResultatBesoinScreen
       └─> onSelectSeat(seats, returnTripData)
            └─> subscribeToReturnBusNotifications()
                 └─> POST /api/notifications/subscribe-return-bus
                      └─> INSERT INTO return_trip_requests
                           └─> status = 'pending'

PRESTATAIRE (Création bus retour)
  └─> ProductManagerMobile (formulaire)
       └─> Remplit: Yaoundé → Douala, 20/02, 14:30
       └─> onSubmit() → remonte au parent

  └─> PARENT (YukpointIntelligentScreen ou autre)
       └─> handleCreateProduct()
            ├─> POST /products/create
            │    └─> Crée bus ID=123
            └─> handleBusCreated(busId=123, {...})
                 └─> POST /api/bus/check-return-requests
                      └─> check_and_notify_return_requests()
                           ├─> SELECT FROM return_trip_requests WHERE status='pending'
                           ├─> FILTER par ville, date, heure ±1h
                           ├─> FOR EACH match:
                           │    ├─> notify_return_bus_available(user_id)
                           │    │    └─> Expo Push: "🚌 Bus Retour Disponible!"
                           │    └─> UPDATE status='matched', matched_bus_id=123
                           └─> RETURN notified_count

CLIENT (Notification)
  └─> Reçoit notification push
  └─> Ouvre app
  └─> Voit le nouveau bus retour
  └─> Peut réserver sa place
```

---

## ✅ Checklist Finale

- [x] Interface demande de retour (BusSeatSelector)
- [x] Appel subscription retour (ResultatBesoinScreen)
- [x] Hook useNotifications
- [x] Service push notifications backend
- [x] Fonction utilitaire busReturnNotifier
- [x] Endpoint /api/bus/check-return-requests
- [ ] **RESTE:** Intégrer dans composant parent de ProductManagerMobile

---

## 🚀 Une fois l'intégration faite

1. Tester le flux complet
2. Vérifier les logs backend
3. Vérifier les logs mobile
4. Commit et push
5. 🎉 Système 100% opérationnel!


