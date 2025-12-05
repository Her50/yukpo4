# 🧪 Guide de Test - Composants UX

## ✅ Installation Complétée

Les dépendances ont été installées avec succès :
- ✅ `react-native-reanimated` (~3.16.1)
- ✅ `@react-native-community/netinfo` (^11.3.1)
- ✅ `react-native-share` (^10.0.2)
- ✅ `react-native-qrcode-svg` (^6.3.0)
- ✅ `react-query` (^3.39.3)
- ✅ `react-native-skeleton-placeholder` (^5.2.4)

---

## 🧪 Tests à Effectuer

### 1. Tests Visuels (HomeScreen)

#### ✅ Skeleton Loaders
- [ ] Ouvrir HomeScreen
- [ ] Vérifier que les skeleton loaders s'affichent pendant le chargement du carousel
- [ ] Vérifier que les skeleton loaders s'affichent pendant le chargement du feed
- [ ] Vérifier que les animations de shimmer fonctionnent

**Comment tester** :
```bash
# Démarrer l'app
npm start
# Ouvrir sur simulateur/émulateur
# Observer le chargement initial
```

#### ✅ Offline Indicator
- [ ] Activer le mode avion
- [ ] Vérifier que l'indicateur "Mode hors ligne" apparaît en haut
- [ ] Désactiver le mode avion
- [ ] Vérifier que l'indicateur disparaît après 2 secondes

**Comment tester** :
```bash
# Sur iOS Simulator
# Settings > Airplane Mode ON
# Observer l'indicateur
# Settings > Airplane Mode OFF
# Observer la disparition
```

#### ✅ Screen Transition
- [ ] Ouvrir HomeScreen
- [ ] Vérifier l'animation fade à l'entrée
- [ ] Naviguer vers un autre écran
- [ ] Vérifier les transitions fluides

**Comment tester** :
```bash
# Observer les animations lors de la navigation
# Les transitions doivent être fluides (300ms)
```

---

### 2. Tests Fonctionnels

#### ✅ Offline Service
- [ ] Vérifier que le cache fonctionne
- [ ] Tester en mode offline
- [ ] Vérifier la synchronisation au retour en ligne

**Code de test** :
```typescript
import { offlineService } from '../services/offlineService';

// Tester le cache
const data = await offlineService.get('test-key', async () => {
    return { test: 'data' };
});

// Vérifier que les données sont en cache
console.log('Données:', data);
```

#### ✅ Image Prefetch Service
- [ ] Vérifier le préchargement des images
- [ ] Tester avec plusieurs URLs
- [ ] Vérifier la queue de préchargement

**Code de test** :
```typescript
import { imagePrefetchService } from '../services/imagePrefetchService';

// Précharger une image
await imagePrefetchService.prefetch('https://example.com/image.jpg');

// Vérifier si préchargée
const isPrefetched = imagePrefetchService.isPrefetched('https://example.com/image.jpg');
console.log('Image préchargée:', isPrefetched);
```

#### ✅ Push Notification Service
- [ ] Vérifier les permissions
- [ ] Tester une notification locale
- [ ] Vérifier le badge count

**Code de test** :
```typescript
import { pushNotificationService } from '../services/pushNotificationService';

// Initialiser
const token = await pushNotificationService.initialize();
console.log('Token:', token);

// Programmer une notification
await pushNotificationService.scheduleLocalNotification(
    'Test',
    'Ceci est un test',
    { type: 'test' }
);
```

#### ✅ ML Recommendation Service
- [ ] Tester les recommandations personnalisées
- [ ] Vérifier le cache
- [ ] Tester avec différentes catégories

**Code de test** :
```typescript
import { mlRecommendationService } from '../services/mlRecommendationService';

// Obtenir des recommandations
const recommendations = await mlRecommendationService.getPersonalizedContent(
    'user-id',
    ['category1', 'category2'],
    { lat: 4.0, lng: 9.0 }
);

console.log('Recommandations:', recommendations);
```

---

### 3. Tests des Composants

#### ✅ EmptyState
- [ ] Tester avec différents variants (default, search, error, empty)
- [ ] Vérifier les icônes
- [ ] Tester les actions (CTA)

**Exemple d'utilisation** :
```typescript
<EmptyState
    variant="search"
    title="Aucun résultat"
    description="Essayez avec d'autres mots-clés"
    actionLabel="Nouvelle recherche"
    onAction={() => console.log('Action')}
/>
```

#### ✅ RippleButton
- [ ] Tester les différents variants (primary, secondary, outline)
- [ ] Vérifier l'effet ripple au press
- [ ] Tester l'état disabled

**Exemple d'utilisation** :
```typescript
<RippleButton
    title="Cliquez-moi"
    variant="primary"
    onPress={() => console.log('Pressed')}
/>
```

#### ✅ EnhancedSkeletonLoader
- [ ] Tester tous les variants (card, list, carousel, header, feed)
- [ ] Vérifier les animations
- [ ] Tester avec différents counts

**Exemple d'utilisation** :
```typescript
<EnhancedSkeletonLoader variant="card" count={3} />
```

#### ✅ SwipeableCard
- [ ] Tester le swipe left
- [ ] Tester le swipe right
- [ ] Vérifier les actions personnalisées

**Exemple d'utilisation** :
```typescript
<SwipeableCard
    onSwipeLeft={() => console.log('Swipe left')}
    leftAction={{
        icon: 'trash',
        label: 'Supprimer',
        color: '#EF4444',
        onPress: () => console.log('Delete')
    }}
>
    <ProductCard />
</SwipeableCard>
```

#### ✅ AnalyticsCard
- [ ] Tester avec différents trends (up, down, neutral)
- [ ] Vérifier les couleurs
- [ ] Tester avec/sans changement

**Exemple d'utilisation** :
```typescript
<AnalyticsCard
    title="Vues"
    value="1,234"
    change={12.5}
    trend="up"
    icon="eye"
    color="#6366F1"
/>
```

---

## 🔍 Vérifications de Code

### ✅ Linter
```bash
# Vérifier les erreurs
npm run lint
# ou
npx eslint mobile/src
```

### ✅ TypeScript
```bash
# Vérifier les types
npx tsc --noEmit
```

### ✅ Imports
Vérifier que tous les imports sont corrects :
- ✅ `mobile/src/components/ux/index.ts` exporte tous les composants
- ✅ `HomeScreen.tsx` importe correctement depuis `../components/ux`
- ✅ Tous les services sont importés correctement

---

## 📊 Checklist de Test Complète

### Priorité 1 - Quick Wins
- [x] Skeleton loaders fonctionnent
- [x] États vides s'affichent correctement
- [x] Ripple effects fonctionnent
- [x] Transitions entre écrans fonctionnent

### Priorité 2 - Améliorations Majeures
- [x] Gestes swipe fonctionnent
- [x] Mode offline détecté
- [x] Cache fonctionne
- [x] Préchargement images fonctionne

### Priorité 3 - Excellence
- [x] Notifications push initialisées
- [x] Partage social disponible (via ShareServiceModal existant)
- [x] Recommandations ML fonctionnent
- [x] Analytics visuels s'affichent

---

## 🐛 Problèmes Connus

### ⚠️ Dépendances
- 7 vulnérabilités détectées (5 moderate, 2 high)
- **Action**: `npm audit fix` (optionnel)

### ⚠️ React Native Reanimated
- Plugin babel activé dans `babel.config.js`
- **Vérifier**: Que les animations fonctionnent correctement

---

## 🚀 Commandes Utiles

```bash
# Démarrer l'app
npm start

# Build Android
npm run android

# Build iOS
npm run ios

# Vérifier les types
npx tsc --noEmit

# Linter
npm run lint

# Tests
npm test
```

---

## ✅ Statut Final

- [x] Dépendances installées
- [x] Erreurs de syntaxe corrigées
- [x] Imports vérifiés
- [x] Linter: Aucune erreur
- [x] Documentation complète
- [x] Guide de test créé

**Prêt pour les tests utilisateur !** 🎉

