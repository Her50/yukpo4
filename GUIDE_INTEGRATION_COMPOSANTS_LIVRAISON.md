# 📚 GUIDE D'INTÉGRATION DES COMPOSANTS LIVRAISON

## 🎯 Vue d'ensemble

Ce guide explique comment intégrer tous les nouveaux composants UX dans les écrans de livraison existants.

---

## 📦 COMPOSANTS DISPONIBLES

### 1. Animations
**Fichier** : `mobile/src/utils/animations.ts`

```typescript
import { useScreenEnter, useCardAnimation } from '../../utils/animations';

// Dans votre composant
const screenEnterStyle = useScreenEnter();

// Dans le JSX
<Animated.View style={[styles.container, screenEnterStyle.style as any]}>
  {/* Contenu */}
</Animated.View>
```

---

### 2. Skeleton Loaders
**Fichier** : `mobile/src/components/delivery/SkeletonDeliveryCard.tsx`

```typescript
import SkeletonDeliveryCard from '../../components/delivery/SkeletonDeliveryCard';

// Pendant le chargement
{loading && (
  <>
    <SkeletonDeliveryCard />
    <SkeletonDeliveryCard />
  </>
)}
```

---

### 3. Progress Wizard
**Fichier** : `mobile/src/components/delivery/ProgressWizard.tsx`

```typescript
import ProgressWizard from '../../components/delivery/ProgressWizard';

const steps = [
  { id: 'step1', label: 'Étape 1', icon: 'store' },
  { id: 'step2', label: 'Étape 2', icon: 'shopping-bag' },
  { id: 'step3', label: 'Étape 3', icon: 'map-pin' },
];

<ProgressWizard steps={steps} currentStep={currentStep} />
```

---

### 4. Cartes animées
**Fichier** : `mobile/src/components/delivery/AnimatedDeliveryCard.tsx`

```typescript
import AnimatedDeliveryCard from '../../components/delivery/AnimatedDeliveryCard';

{deliveries.map((delivery, index) => (
  <AnimatedDeliveryCard
    key={delivery.id}
    delivery={delivery}
    onPress={handleOpenDelivery}
    index={index}
  />
))}
```

---

### 5. Toast d'erreur moderne
**Fichier** : `mobile/src/components/delivery/ModernErrorToast.tsx`

```typescript
import ModernErrorToast from '../../components/delivery/ModernErrorToast';

const [error, setError] = useState<string | null>(null);

<ModernErrorToast
  visible={!!error}
  message={error || ''}
  type="error"
  onClose={() => setError(null)}
/>
```

---

### 6. Graphiques coursier
**Fichier** : `mobile/src/components/delivery/CourierStatsChart.tsx`

```typescript
import CourierStatsChart from '../../components/delivery/CourierStatsChart';

<CourierStatsChart
  completedDeliveries={stats.completedDeliveries}
  totalEarnings={stats.totalEarnings}
  currentMonthEarnings={stats.currentMonthEarnings}
  avgDeliveryTime={stats.avgDeliveryTime}
  successRate={stats.successRate}
/>
```

---

### 7. Chat intégré
**Fichier** : `mobile/src/components/delivery/InlineChat.tsx`

```typescript
import InlineChat from '../../components/delivery/InlineChat';

<InlineChat
  deliveryId={delivery.id}
  currentUserId={user.id}
  messages={chatMessages}
  onSendMessage={handleSendMessage}
/>
```

---

### 8. Partage social
**Fichier** : `mobile/src/components/delivery/ShareTrackingLink.tsx`

```typescript
import ShareTrackingLink from '../../components/delivery/ShareTrackingLink';

<ShareTrackingLink
  deliveryId={delivery.id}
  deliveryTitle="Ma livraison"
  onShare={() => console.log('Partagé')}
/>
```

---

### 9. Route optimisée
**Fichier** : `mobile/src/components/delivery/RouteOptimizationIndicator.tsx`

```typescript
import RouteOptimizationIndicator from '../../components/delivery/RouteOptimizationIndicator';

<RouteOptimizationIndicator
  distance={12.5}
  estimatedTime={25}
  isOptimized={true}
  trafficDelay={5}
/>
```

---

### 10. Haptic Feedback
**Fichier** : `mobile/src/components/delivery/HapticTouchable.tsx`

```typescript
import HapticTouchable from '../../components/delivery/HapticTouchable';

<HapticTouchable
  hapticType="medium"
  onPress={handlePress}
>
  <Text>Bouton avec feedback</Text>
</HapticTouchable>
```

---

### 11. Badges gamification
**Fichier** : `mobile/src/components/delivery/GamificationBadge.tsx`

```typescript
import GamificationBadge from '../../components/delivery/GamificationBadge';

<GamificationBadge
  badge={{
    id: '1',
    name: 'Première livraison',
    description: 'Complétez votre première livraison',
    icon: 'trophy',
    color: modernColors.primary,
    unlocked: true,
    progress: 100,
  }}
  size="medium"
  showProgress={true}
/>
```

---

### 12. Suggestions produits
**Fichier** : `mobile/src/components/delivery/SuggestedProducts.tsx`

```typescript
import SuggestedProducts from '../../components/delivery/SuggestedProducts';

<SuggestedProducts
  supermarketId={selectedSupermarket?.id}
  currentBasket={basketItems}
  onAddProduct={handleAddProduct}
/>
```

---

## 🔧 EXEMPLES D'INTÉGRATION

### Intégration dans DeliveryShoppingTrackingScreen

```typescript
import InlineChat from '../../components/delivery/InlineChat';
import ShareTrackingLink from '../../components/delivery/ShareTrackingLink';
import RouteOptimizationIndicator from '../../components/delivery/RouteOptimizationIndicator';

// Dans le render
<ScrollView>
  {/* Carte de tracking */}
  <EnhancedTrackingMap {...mapProps} />
  
  {/* Indicateur de route */}
  <RouteOptimizationIndicator
    distance={estimatedDistance}
    estimatedTime={estimatedTime}
    isOptimized={true}
  />
  
  {/* Chat intégré */}
  <InlineChat
    deliveryId={deliveryId}
    currentUserId={user.id}
    messages={chatMessages}
    onSendMessage={handleSendMessage}
  />
  
  {/* Partage */}
  <ShareTrackingLink
    deliveryId={deliveryId}
    deliveryTitle="Ma livraison"
  />
</ScrollView>
```

---

### Intégration dans DeliveryHomeScreen

```typescript
import AnimatedDeliveryCard from '../../components/delivery/AnimatedDeliveryCard';
import SkeletonDeliveryCard from '../../components/delivery/SkeletonDeliveryCard';
import { useScreenEnter } from '../../utils/animations';

const screenEnterStyle = useScreenEnter();

<Animated.View style={[styles.container, screenEnterStyle.style as any]}>
  {loading ? (
    <>
      <SkeletonDeliveryCard />
      <SkeletonDeliveryCard />
    </>
  ) : (
    deliveries.map((delivery, index) => (
      <AnimatedDeliveryCard
        key={delivery.id}
        delivery={delivery}
        onPress={handleOpenDelivery}
        index={index}
      />
    ))
  )}
</Animated.View>
```

---

### Intégration dans CourierDashboardScreen

```typescript
import CourierStatsChart from '../../components/delivery/CourierStatsChart';
import HapticTouchable from '../../components/delivery/HapticTouchable';

<CourierStatsChart
  completedDeliveries={stats.completedDeliveries}
  totalEarnings={stats.totalEarnings}
  currentMonthEarnings={stats.currentMonthEarnings}
/>

<HapticTouchable
  hapticType="medium"
  onPress={handleAction}
>
  <NativeButton title="Action" />
</HapticTouchable>
```

---

## 🎨 BONNES PRATIQUES

1. **Toujours utiliser les animations d'entrée** pour les nouveaux écrans
2. **Utiliser les skeleton loaders** pendant les chargements
3. **Ajouter haptic feedback** sur les actions importantes
4. **Intégrer le chat** dans tous les écrans de tracking
5. **Proposer le partage** pour améliorer l'engagement

---

## 🚀 PROCHAINES ÉTAPES

1. Intégrer tous les composants dans les écrans existants
2. Tester sur différents appareils
3. Optimiser les performances
4. Collecter les retours utilisateurs

---

**Dernière mise à jour** : Phase 2 terminée ✅


