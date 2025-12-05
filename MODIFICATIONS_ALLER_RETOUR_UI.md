# 📋 MODIFICATIONS NÉCESSAIRES - INTERFACES ALLER-RETOUR

**Date**: 2025-01-28

---

## ✅ BACKEND - COMPLÉTÉ

- ✅ Contrôleur `bus_return_trip_controller.rs` créé
- ✅ Routes API ajoutées
- ✅ Migration SQL pour matching amélioré

**Fichiers créés**:
- `backend/src/controllers/bus_return_trip_controller.rs`
- `backend/migrations/20250128_improve_return_trip_matching.sql`

---

## 📱 MOBILE - MODIFICATIONS NÉCESSAIRES

### 1. Ajouter option "Aller-Retour" dans recherche
**Fichier**: `mobile/src/screens/specialized/BusTicketSearchScreen.tsx`

**Modifications**:
```typescript
// Ajouter état pour aller-retour
const [isRoundTrip, setIsRoundTrip] = useState(false);
const [returnDate, setReturnDate] = useState(new Date());
const [returnTime, setReturnTime] = useState('');

// Ajouter dans le formulaire
<TouchableOpacity 
    style={styles.checkbox}
    onPress={() => setIsRoundTrip(!isRoundTrip)}
>
    <SafeIcon 
        name={isRoundTrip ? "check-square" : "square"} 
        size={24} 
    />
    <Text>Aller-Retour</Text>
</TouchableOpacity>

{isRoundTrip && (
    <>
        <View style={styles.inputGroup}>
            <Text style={styles.label}>Date de retour</Text>
            <TouchableOpacity onPress={() => setShowReturnDatePicker(true)}>
                <Text>{formatDate(returnDate)}</Text>
            </TouchableOpacity>
        </View>
        <View style={styles.inputGroup}>
            <Text style={styles.label}>Heure de retour (optionnel)</Text>
            <NativeInput
                value={returnTime}
                onChangeText={setReturnTime}
                placeholder="HH:MM"
            />
        </View>
    </>
)}

// Passer les infos retour dans la navigation
navigation.navigate('BusTicketBooking' as never, {
    ticketData: result,
    isRoundTrip,
    returnDate: isRoundTrip ? returnDate.toISOString().split('T')[0] : undefined,
    returnTime: isRoundTrip ? returnTime : undefined,
} as never);
```

### 2. Modifier réservation pour accepter retour
**Fichier**: `mobile/src/screens/specialized/BusTicketBookingScreen.tsx`

**Modifications**:
```typescript
// Récupérer les infos retour depuis les params
const isRoundTrip = (route.params as any)?.isRoundTrip;
const returnDate = (route.params as any)?.returnDate;
const returnTime = (route.params as any)?.returnTime;

// Passer dans le paiement
navigation.navigate('BusTicketPayment' as never, {
    productId,
    reservationIds: ...,
    isRoundTrip,
    returnDate,
    returnTime,
} as never);
```

### 3. Créer écran liste demandes retour
**Fichier**: `mobile/src/screens/specialized/BusReturnRequestsScreen.tsx` (NOUVEAU)

```typescript
// Voir exemple complet dans le fichier à créer
```

### 4. Créer écran formulaire demande retour
**Fichier**: `mobile/src/screens/specialized/BusReturnRequestFormScreen.tsx` (NOUVEAU)

```typescript
// Permet de créer une demande de retour après avoir acheté un ticket aller
// Formulaire: date retour, heure, flexibilité
```

### 5. Ajouter routes navigation
**Fichier**: `mobile/src/navigation/AppNavigator.tsx`

```typescript
<Stack.Screen 
    name="BusReturnRequests" 
    component={withNavigatorSafeArea(BusReturnRequestsScreen)} 
/>
<Stack.Screen 
    name="BusReturnRequestForm" 
    component={withNavigatorSafeArea(BusReturnRequestFormScreen)} 
/>
```

---

## 🌐 FRONTEND - MODIFICATIONS NÉCESSAIRES

### 1. Ajouter option "Aller-Retour" dans recherche
**Fichier**: `frontend/src/pages/specialized/BusTicketSearchPage.tsx`

**Modifications similaires au mobile**:
- Checkbox "Aller-Retour"
- Champs date/heure retour conditionnels
- Passer infos dans navigate()

### 2. Créer page liste demandes retour
**Fichier**: `frontend/src/pages/specialized/BusReturnRequestsPage.tsx` (NOUVEAU)

### 3. Créer page formulaire demande retour
**Fichier**: `frontend/src/pages/specialized/BusReturnRequestFormPage.tsx` (NOUVEAU)

### 4. Ajouter routes
**Fichier**: `frontend/src/routes/AppRoutesRegistry.ts`

```typescript
BUS_RETURN_REQUESTS: "/bus-tickets/return-requests",
BUS_RETURN_REQUEST_FORM: "/bus-tickets/return-request/create/:paymentId",
```

**Fichier**: `frontend/src/App.tsx`

```typescript
<Route path={ROUTES.BUS_RETURN_REQUESTS} element={<RequireAuth><BusReturnRequestsPage /></RequireAuth>} />
<Route path={ROUTES.BUS_RETURN_REQUEST_FORM} element={<RequireAuth><BusReturnRequestFormPage /></RequireAuth>} />
```

---

## 📝 FICHIERS À CRÉER COMPLÈTEMENT

### Mobile
1. `mobile/src/screens/specialized/BusReturnRequestsScreen.tsx`
2. `mobile/src/screens/specialized/BusReturnRequestFormScreen.tsx`

### Frontend
1. `frontend/src/pages/specialized/BusReturnRequestsPage.tsx`
2. `frontend/src/pages/specialized/BusReturnRequestFormPage.tsx`

---

## 🎯 RÉSUMÉ

**Backend**: ✅ **100% COMPLET**
**Mobile**: ⚠️ **30% - Modifications nécessaires**
**Frontend**: ⚠️ **30% - Modifications nécessaires**

Les structures backend sont prêtes, il reste à :
1. Ajouter les options aller-retour dans les interfaces de recherche
2. Créer les écrans/pages pour gérer les demandes de retour
3. Ajouter les routes de navigation

**Le système est fonctionnel au niveau backend, les interfaces utilisateur doivent être complétées.**

