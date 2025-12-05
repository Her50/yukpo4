# Plan d'Action Concret - Amélioration UX Tickets de Voyage

## 🎯 Vue d'ensemble

Ce document liste les actions concrètes à entreprendre pour améliorer l'expérience UX du service de réservation de tickets de voyage, avec références aux fichiers existants.

---

## 🔴 PRIORITÉ 1 - Actions critiques (Semaine 1-4)

### 1. Implémenter le Scanner QR Code

**Fichier concerné** : `mobile/src/screens/BusBoardingManagementScreen.tsx`

**Problème actuel** :
```typescript
// Ligne 350-359 : Scanner non implémenté
<View style={styles.scannerPlaceholder}>
    <SafeIcon name="camera" size={64} color="#D1D5DB" />
    <Text style={styles.scannerPlaceholderText}>
        Scanner QR code à implémenter
    </Text>
</View>
```

**Action** :
1. Installer `expo-barcode-scanner` :
```bash
npx expo install expo-barcode-scanner
```

2. Créer un composant `QRCodeScanner.tsx` :
```typescript
import { BarCodeScanner } from 'expo-barcode-scanner';
import { useState, useEffect } from 'react';

export const QRCodeScanner = ({ onScan, onClose }) => {
  const [hasPermission, setHasPermission] = useState(null);
  
  useEffect(() => {
    (async () => {
      const { status } = await BarCodeScanner.requestPermissionsAsync();
      setHasPermission(status === 'granted');
    })();
  }, []);

  const handleBarCodeScanned = ({ type, data }) => {
    onScan(data);
  };

  // ... implémentation complète
};
```

3. Intégrer dans `BusBoardingManagementScreen.tsx` ligne 330-385

**Référence** : `mobile/src/screens/BusBoardingManagementScreen.tsx:350`

---

### 2. Ajouter l'autocomplétion des villes

**Fichier concerné** : `mobile/src/screens/specialized/BusTicketSearchScreen.tsx`

**Problème actuel** :
```typescript
// Ligne 127-143 : Inputs basiques sans autocomplétion
<NativeInput
    value={departureCity}
    onChangeText={setDepartureCity}
    placeholder="Ex: Yaoundé"
    autoCapitalize="words"
/>
```

**Action** :
1. Installer `@react-native-community/google-places` ou utiliser Mapbox
2. Créer un composant `CityAutocomplete.tsx`
3. Remplacer les `NativeInput` par `CityAutocomplete` aux lignes 127 et 137

**Référence** : `mobile/src/screens/specialized/BusTicketSearchScreen.tsx:127-143`

---

### 3. Ajouter les filtres et tri

**Fichier concerné** : `mobile/src/screens/specialized/BusTicketSearchScreen.tsx`

**Problème actuel** :
- Pas de filtres (ligne 244-316 : résultats affichés directement)
- Pas de tri

**Action** :
1. Ajouter un composant `SearchFilters.tsx` avec :
   - Filtre prix (min/max)
   - Filtre horaire (matin, après-midi, soir)
   - Filtre compagnie
   - Filtre équipements (WiFi, climatisation)

2. Ajouter un composant `SortOptions.tsx` avec :
   - Prix croissant/décroissant
   - Horaire
   - Durée
   - Popularité

3. Intégrer avant l'affichage des résultats (ligne 244)

**Référence** : `mobile/src/screens/specialized/BusTicketSearchScreen.tsx:244-316`

---

### 4. Implémenter les notifications push

**Fichier concerné** : Nouveau service à créer

**Action** :
1. Créer `mobile/src/services/ticketNotifications.ts`
2. Utiliser `expo-notifications` (déjà installé probablement)
3. Implémenter :
   - Rappel 24h avant départ
   - Rappel 2h avant départ
   - Confirmation de réservation
   - Notification de retard

**Référence backend** : `backend/src/controllers/bus_ticket_controller.rs`

---

### 5. Ajouter skeleton loading

**Fichiers concernés** : Tous les écrans avec chargement

**Problème actuel** :
```typescript
// Exemple BusTicketSearchScreen ligne 237-242
{loading && (
    <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={modernColors.primary} />
        <Text style={styles.loadingText}>Recherche en cours...</Text>
    </View>
)}
```

**Action** :
1. Créer un composant `SkeletonCard.tsx`
2. Remplacer les `ActivityIndicator` par des skeletons
3. Appliquer à :
   - `BusTicketSearchScreen.tsx:237`
   - `BusTicketBookingScreen.tsx:208`
   - `BusTicketDetailsScreen.tsx:154`
   - `AgencyTicketManagementScreen.tsx:291`

---

## 🟡 PRIORITÉ 2 - Améliorations importantes (Semaine 5-8)

### 6. Enrichir les informations de trajet

**Fichier concerné** : `mobile/src/screens/specialized/BusTicketBookingScreen.tsx`

**Problème actuel** :
- Ligne 142-189 : Informations basiques (départ, arrivée, prix)
- Manque : durée, arrêts, équipements, photos

**Action** :
1. Modifier l'API backend pour inclure :
   - `duration_minutes`
   - `intermediate_stops[]`
   - `bus_equipments[]`
   - `bus_photos[]`
   - `agency_rating`

2. Afficher dans `BusTicketBookingScreen.tsx` :
```typescript
// Ajouter après ligne 179
{ticketData?.duration_minutes && (
    <View style={styles.durationContainer}>
        <SafeIcon name="clock" size={16} color="#6B7280" />
        <Text>Durée : {ticketData.duration_minutes} minutes</Text>
    </View>
)}
```

**Référence** : `mobile/src/screens/specialized/BusTicketBookingScreen.tsx:142-189`

---

### 7. Améliorer le sélecteur de sièges

**Fichier concerné** : `mobile/src/components/bus/BusSeatSelector.tsx`

**Problème actuel** :
- Ligne 234-269 : Plan basique sans zoom
- Pas d'indication sièges premium

**Action** :
1. Ajouter `react-native-gesture-handler` pour zoom/pinch
2. Améliorer le design des sièges (ligne 454-484)
3. Ajouter badges pour sièges premium :
```typescript
// Modifier ligne 245-264
{seat.is_premium && (
    <View style={styles.premiumBadge}>
        <SafeIcon name="star" size={12} color="#F59E0B" />
    </View>
)}
```

**Référence** : `mobile/src/components/bus/BusSeatSelector.tsx:234-269`

---

### 8. Créer le dashboard analytics agence

**Fichier concerné** : `mobile/src/screens/AgencyTicketManagementScreen.tsx`

**Problème actuel** :
- Ligne 242-257 : Statistiques basiques (total, aujourd'hui, reversements)
- Pas de graphiques

**Action** :
1. Installer `react-native-chart-kit` ou `victory-native`
2. Créer un composant `AnalyticsChart.tsx`
3. Ajouter après ligne 257 :
```typescript
<View style={styles.chartsContainer}>
    <AnalyticsChart
        data={revenueData}
        type="line"
        title="Revenus (7 derniers jours)"
    />
    <AnalyticsChart
        data={occupationData}
        type="bar"
        title="Taux d'occupation"
    />
</View>
```

**Référence** : `mobile/src/screens/AgencyTicketManagementScreen.tsx:242-257`

---

### 9. Implémenter le mode hors ligne

**Fichier concerné** : `mobile/src/screens/specialized/BusTicketDetailsScreen.tsx`

**Action** :
1. Utiliser `expo-file-system` pour stocker les QR codes
2. Utiliser `@react-native-async-storage/async-storage` pour cache
3. Créer un service `offlineTicketService.ts`
4. Modifier `BusTicketDetailsScreen.tsx` ligne 193-201 pour gérer le mode offline

**Référence** : `mobile/src/screens/specialized/BusTicketDetailsScreen.tsx:193-201`

---

## 🟢 PRIORITÉ 3 - Polish et différenciation (Semaine 9-12)

### 10. Améliorer le design visuel

**Fichiers concernés** : Tous les écrans

**Action** :
1. Créer un design system cohérent
2. Ajouter des animations avec `react-native-reanimated`
3. Améliorer les transitions entre écrans
4. Ajouter des micro-interactions

**Référence** : `mobile/src/theme/modernTheme.ts`

---

### 11. Ajouter les fonctionnalités avancées

**Fichiers concernés** : 
- `mobile/src/screens/specialized/BusTicketDetailsScreen.tsx`
- `mobile/src/screens/MyBusTicketsScreen.tsx`

**Actions** :
1. Modification de ticket (changement date/siège)
2. Suivi en temps réel du bus
3. Ajout au calendrier (Google Calendar, iCal)
4. Partage social amélioré

---

## 📋 Checklist d'implémentation

### Semaine 1-2
- [ ] Scanner QR Code fonctionnel
- [ ] Autocomplétion villes
- [ ] Notifications push basiques

### Semaine 3-4
- [ ] Filtres et tri résultats
- [ ] Skeleton loading
- [ ] Mode hors ligne basique

### Semaine 5-6
- [ ] Informations enrichies
- [ ] Sélecteur sièges amélioré
- [ ] Dashboard analytics

### Semaine 7-8
- [ ] Design system complet
- [ ] Animations fluides
- [ ] Tests et optimisations

---

## 🔗 Références des fichiers

### Écrans principaux
- `mobile/src/screens/specialized/BusTicketSearchScreen.tsx` - Recherche
- `mobile/src/screens/specialized/BusTicketBookingScreen.tsx` - Réservation
- `mobile/src/screens/specialized/BusTicketDetailsScreen.tsx` - Détails ticket
- `mobile/src/screens/BusBoardingManagementScreen.tsx` - Embarquement
- `mobile/src/screens/AgencyTicketManagementScreen.tsx` - Gestion agence
- `mobile/src/screens/MyBusTicketsScreen.tsx` - Mes tickets

### Composants
- `mobile/src/components/bus/BusSeatSelector.tsx` - Sélection sièges
- `mobile/src/components/bus/BusTicketCard.tsx` - Carte ticket
- `mobile/src/components/bus/BusModelForm.tsx` - Formulaire modèle bus

### Services
- `mobile/src/services/api.ts` - API client
- `mobile/src/utils/ticketValidation.ts` - Validation tickets

### Backend
- `backend/src/controllers/bus_ticket_controller.rs` - Contrôleur tickets
- `backend/src/controllers/bus_ticket_validation_controller.rs` - Validation
- `backend/src/routes/bus_reservations.rs` - Routes API

---

## 🛠️ Technologies à installer

```bash
# Scanner QR
npx expo install expo-barcode-scanner

# Autocomplétion
npm install @react-native-community/google-places

# Graphiques
npm install react-native-chart-kit
# ou
npm install victory-native

# Animations
npm install react-native-reanimated

# Cache
npm install @react-native-async-storage/async-storage

# Notifications
npx expo install expo-notifications
```

---

## 📊 Métriques à suivre

### Avant améliorations
- Taux conversion : ~15%
- Temps réservation : ~5 min
- Satisfaction : ~3.5/5

### Objectif après améliorations
- Taux conversion : 25%+
- Temps réservation : 3 min
- Satisfaction : 4.5/5

---

*Document généré le : 2025-01-27*  
*Version : 1.0*


