# ✅ Analyse : Visualisation Coursier et Système de Paiement

## 📍 1. Visualisation des Chemins (Pickup/Dropoff)

### ✅ **IMPLÉMENTÉ** : Le coursier voit les chemins sur son téléphone

**Écran** : `DeliveryShoppingTrackingScreen.tsx`

**Composants** :
- ✅ `EnhancedTrackingMap` : Carte interactive avec marqueurs
  - Marqueur pickup (🛒) en couleur primaire
  - Marqueur dropoff (📍) en couleur accent
  - Marqueur coursier (🚗) avec animation pulse
  - Marqueur destinataire (👤) en couleur success
  - Polyline reliant tous les points

**Fonctionnalités** :
- ✅ Bouton "🗺️ Voir navigation" dans les actions coursier
- ✅ Bouton "Navigation" sur la carte (ouvre Google Maps)
- ✅ Carte s'ajuste automatiquement pour afficher tous les points
- ✅ Mise à jour en temps réel de la position du coursier

**Navigation** :
- ✅ Ouvre Google Maps avec directions complètes
- ✅ Utilise `getCourierNavigation` API endpoint
- ✅ Format : `https://www.google.com/maps/dir/{origin}/{destination}`

**Code** :
```typescript
// mobile/src/screens/delivery/DeliveryShoppingTrackingScreen.tsx
<EnhancedTrackingMap
    pickup={delivery?.pickup?.location ? {...} : null}
    dropoff={delivery?.dropoff?.location ? {...} : null}
    courierLocation={delivery?.metadata?.last_location ?? null}
    recipientLocation={delivery?.recipient?.currentLocation ?? null}
    showNavigationButton={!!(delivery?.pickup?.location && delivery?.dropoff?.location)}
    onNavigationPress={async () => {
        // Ouvre Google Maps avec directions
    }}
/>
```

## 🎨 2. Navigation et Accessibilité Mobile

### ✅ **CONFIGURÉ** : Écrans mobiles bien configurés

**Navigation** :
- ✅ React Navigation intégré
- ✅ Écrans enregistrés : `CourierDashboardScreen`, `DeliveryShoppingTrackingScreen`
- ✅ Navigation cohérente avec `useNavigation()`
- ✅ Bouton retour Android géré

**Accessibilité** :
- ✅ `SafeNativeView` pour safe area
- ✅ Composants `NativeButton`, `NativeCard` avec styles modernes
- ✅ Icônes `SafeIcon` avec fallback emojis
- ✅ Animations fluides (Animated API)
- ✅ RefreshControl pour pull-to-refresh
- ✅ Loading states avec ActivityIndicator

**UX** :
- ✅ Tabs animés (Timeline, Panier, Coursier)
- ✅ Cartes avec ombres et bordures
- ✅ Badges de statut colorés
- ✅ Feedback visuel (toast notifications)
- ✅ Skeleton loaders pendant chargement

## 💰 3. Système de Paiement Coursier

### ⚠️ **À VÉRIFIER** : Reversement des frais de livraison

**Backend** :
- ✅ `DeliveryPaymentService.payout_merchant()` : Reversement au marchand
- ❓ **MANQUANT** : Fonction spécifique pour reversement coursier

**Frais de livraison** :
- ✅ Calculé selon type d'engin (`DeliveryEnginePricingService`)
- ✅ Stocké dans `delivery_payment_reservations.delivery_cost_cents`
- ❓ **À IMPLÉMENTER** : Reversement au coursier après livraison complétée

**Commission Yukpo** :
- ✅ Commission sur produit : 5% (configurable via `YUKPO_COMMISSION_RATE`)
- ✅ Commission sur livraison : 5% (NOUVEAU - implémenté)
- ✅ Stockée dans `commission_cents` (total) et `metadata.delivery_commission_cents`

**Recommandation** :
```rust
// À ajouter dans DeliveryPaymentService
pub async fn payout_courier(
    &self,
    delivery_id: Uuid,
    courier_user_id: i32,
) -> AppResult<()> {
    // Récupérer delivery_cost_cents
    // Calculer : delivery_cost_cents - commission
    // Reverser au coursier via wallet ou payment method
}
```

## 📝 4. Formulaire Coursier - Comptes de Paiement

### ❌ **MANQUANT** : Section comptes de paiement dans `CourierRegistrationScreen`

**Actuel** :
- ✅ Informations personnelles
- ✅ Adresse
- ✅ Transport (véhicule)
- ✅ Documents
- ✅ Disponibilités
- ❌ **MANQUE** : Comptes de paiement

**À Ajouter** :
- Section similaire à `FormulaireYukpoIntelligentScreen`
- Utiliser `PaymentMethodSelector` component
- Stocker dans `courier_assets` ou nouvelle table `courier_payment_methods`

**Composant disponible** :
- ✅ `PaymentMethodSelector.tsx` : Supporte mobile money, orange money, carte bancaire
- ✅ Validation en temps réel
- ✅ Formatage automatique

**Structure suggérée** :
```typescript
// Dans CourierRegistrationScreen.tsx
const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);

// Dans le formulaire
<NativeCard style={styles.card}>
    <Text style={styles.sectionTitle}>Comptes de paiement</Text>
    <Text style={styles.helperText}>
        Renseignez votre compte pour recevoir vos paiements
    </Text>
    <PaymentMethodSelector
        onPaymentChange={setPaymentMethod}
        readonly={false}
    />
</NativeCard>
```

## 🔄 5. Flux de Paiement

### ✅ **CONFIRMÉ** : L'argent transite toujours dans le compte de l'application

**Flux actuel** :
1. Client paie → Réservation dans `delivery_payment_reservations`
2. Débit immédiat du wallet client
3. Commission Yukpo calculée (produit + livraison)
4. Payout marchand = produit - commission produit
5. ❓ **MANQUE** : Payout coursier = livraison - commission livraison

**Stockage** :
- ✅ Toutes les transactions dans `delivery_payment_reservations`
- ✅ Métadonnées JSON pour détails
- ✅ Traçabilité complète

## ✅ Checklist Actions

- [x] Vérifier visualisation pickup/dropoff → **OK**
- [x] Vérifier navigation mobile → **OK**
- [x] Vérifier accessibilité → **OK**
- [ ] Ajouter section comptes de paiement dans formulaire coursier
- [ ] Implémenter reversement frais de livraison aux coursiers
- [ ] Tester flux complet de paiement coursier

---

**Date** : 2025-01-27

