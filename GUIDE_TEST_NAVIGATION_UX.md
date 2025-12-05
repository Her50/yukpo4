# 🧪 GUIDE DE TEST - NAVIGATION & EXPÉRIENCE UTILISATEUR

**Date**: 2025-01-28  
**Objectif**: Vérifier que l'expérience utilisateur est opérationnelle et que tous les écrans/pages sont accessibles

---

## 📱 TEST MOBILE

### 1. Navigation vers les écrans

**Test 1.1 - Accès depuis code (pour vérifier que les routes fonctionnent)**:
```typescript
// Dans n'importe quel écran, tester:
navigation.navigate('BloodDonationRequest');
navigation.navigate('BusTicketSearch');
```

**Test 1.2 - Vérifier les paramètres**:
```typescript
// Vérifier que les paramètres sont bien passés:
navigation.navigate('BloodDonationMatches', { requestId: 'test-id' });
// Dans l'écran, vérifier que requestId est accessible
```

### 2. Parcours utilisateur complets

**Parcours Banque de Sang**:
1. [ ] Naviguer vers `BloodDonationRequest`
2. [ ] Remplir le formulaire et créer une demande
3. [ ] Vérifier redirection vers `BloodDonationMatches` avec requestId
4. [ ] Voir la liste des matches
5. [ ] Tester notification donneurs
6. [ ] Naviguer vers `MyBloodDonations`
7. [ ] Voir l'historique

**Parcours Tickets Bus**:
1. [ ] Naviguer vers `BusTicketSearch`
2. [ ] Rechercher un trajet
3. [ ] Cliquer sur un résultat
4. [ ] Naviguer vers `BusTicketBooking` avec productId
5. [ ] Sélectionner des places
6. [ ] Créer la réservation
7. [ ] Naviguer vers `BusTicketDetails` avec paymentId
8. [ ] Voir le QR code

### 3. Points d'accès à ajouter (recommandé)

**Dans `SpecializedServicesHubScreen.tsx`**, ajouter:
```typescript
// Bouton pour banque de sang
<TouchableOpacity onPress={() => navigation.navigate('BloodDonationRequest')}>
  <Text>🩸 Banque de Sang</Text>
</TouchableOpacity>

// Bouton pour tickets bus
<TouchableOpacity onPress={() => navigation.navigate('BusTicketSearch')}>
  <Text>🚌 Tickets Bus</Text>
</TouchableOpacity>
```

---

## 🌐 TEST FRONTEND WEB

### 1. Accès direct aux URLs

**Test 1.1 - Sans authentification**:
- [ ] Accéder à `/blood-donation/request`
  - ✅ Doit rediriger vers `/login`
- [ ] Accéder à `/bus-tickets/search`
  - ✅ Doit rediriger vers `/login`

**Test 1.2 - Avec authentification**:
- [ ] Se connecter
- [ ] Accéder à `/blood-donation/request`
  - ✅ Doit afficher le formulaire
- [ ] Accéder à `/bus-tickets/search`
  - ✅ Doit afficher la recherche

### 2. Navigation programmatique

**Test 2.1 - Navigation depuis autres pages**:
```typescript
// Dans n'importe quelle page, tester:
navigate('/blood-donation/request');
navigate('/bus-tickets/search');
```

### 3. Parcours utilisateur complets

**Parcours Banque de Sang**:
1. [ ] Se connecter
2. [ ] Aller sur `/blood-donation/request`
3. [ ] Créer une demande
4. [ ] Vérifier redirection vers `/blood-donation/matches/:requestId`
5. [ ] Voir les matches
6. [ ] Tester notification donneurs
7. [ ] Aller sur `/blood-donation/my-donations`
8. [ ] Voir l'historique avec filtres

**Parcours Tickets Bus**:
1. [ ] Se connecter
2. [ ] Aller sur `/bus-tickets/search`
3. [ ] Rechercher un trajet
4. [ ] Cliquer sur un résultat
5. [ ] Aller sur `/bus-tickets/booking/:productId`
6. [ ] Sélectionner des places
7. [ ] Créer la réservation
8. [ ] Aller sur `/bus-tickets/details/:paymentId`
9. [ ] Voir le QR code

### 4. Points d'accès à ajouter (recommandé)

**Dans la navigation principale ou dashboard**, ajouter:
```tsx
// Liens vers les pages
<Link to="/blood-donation/request">🩸 Banque de Sang</Link>
<Link to="/bus-tickets/search">🚌 Tickets Bus</Link>
<Link to="/blood-donation/my-donations">Mes Dons</Link>
```

---

## 🔍 VÉRIFICATIONS TECHNIQUES

### 1. Erreurs de compilation

**Mobile**:
```bash
cd mobile
npm run android  # ou npm run ios
# Vérifier qu'il n'y a pas d'erreurs
```

**Frontend**:
```bash
cd frontend
npm run dev
# Vérifier qu'il n'y a pas d'erreurs dans la console
```

### 2. Dépendances manquantes

**Mobile - Packages nécessaires**:
- `react-native-qrcode-svg` - Pour QR code
- `@react-native-community/datetimepicker` - Pour sélection date

**Frontend - Packages nécessaires**:
- `qrcode.react` - Pour QR code

**Commandes d'installation**:
```bash
# Mobile
cd mobile
npm install react-native-qrcode-svg @react-native-community/datetimepicker

# Frontend
cd frontend
npm install qrcode.react
```

### 3. Imports et composants

**Vérifier que tous les imports sont corrects**:
- [ ] Aucune erreur TypeScript
- [ ] Tous les composants UI existent
- [ ] Tous les services API sont accessibles

---

## ✅ CHECKLIST COMPLÈTE

### Navigation Mobile
- [ ] Routes ajoutées dans AppNavigator.tsx
- [ ] Imports corrects
- [ ] Navigation entre écrans fonctionne
- [ ] Paramètres passés correctement
- [ ] Bouton retour fonctionne

### Navigation Web
- [ ] Routes ajoutées dans App.tsx
- [ ] Routes ajoutées dans AppRoutesRegistry.ts
- [ ] Protection RequireAuth active
- [ ] Navigation entre pages fonctionne
- [ ] Paramètres URL fonctionnent

### Fonctionnalités
- [ ] Création demande de don fonctionne
- [ ] Recherche trajets fonctionne
- [ ] Sélection places fonctionne
- [ ] Affichage QR code fonctionne
- [ ] Appels API fonctionnent
- [ ] Gestion d'erreurs active

### UX
- [ ] Loading states affichés
- [ ] Messages d'erreur clairs
- [ ] Messages de succès affichés
- [ ] Navigation intuitive
- [ ] Boutons accessibles

---

## 🎯 RÉSULTAT ATTENDU

Après tous ces tests, vous devriez pouvoir:
- ✅ Naviguer vers tous les écrans/pages
- ✅ Accéder à toutes les fonctionnalités
- ✅ Voir les données s'afficher
- ✅ Créer des demandes et réservations
- ✅ Voir les QR codes
- ✅ Gérer les erreurs gracieusement

**Tout est prêt pour les tests utilisateur !** 🎉

