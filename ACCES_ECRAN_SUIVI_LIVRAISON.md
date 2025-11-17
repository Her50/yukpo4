# 📍 Où Trouver l'Écran de Suivi de Livraison

## 🎯 RÉPONSE DIRECTE

L'écran de suivi de livraison est accessible via **l'onglet "Livraison"** dans la barre de navigation en bas de l'application mobile.

---

## 📱 POUR LE CLIENT

### **Étape 1 : Accéder à l'onglet "Livraison"**

```
┌─────────────────────────────────────────┐
│  [🏠 Accueil] [📦 Livraison] [📋 Mes]   │
│              [📜 Historique] [👤 Compte]│
│                                         │
│  👆 Clique sur "Livraison" (2ème onglet)│
└─────────────────────────────────────────┘
```

**Emplacement** : Barre de navigation en bas de l'écran (Tab Navigator)

### **Étape 2 : Voir la liste des livraisons actives**

Une fois dans l'onglet "Livraison", tu vois :

```
┌─────────────────────────────────────────┐
│  Livraison intelligente Yukpo           │
│  Orchestre tes courses supermarché...   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ Courses supermarché             │   │
│  │ [Commander au supermarché]      │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ Livraison de colis              │   │
│  │ [Utiliser les courses...]       │   │
│  └─────────────────────────────────┘   │
│                                         │
│  Vos livraisons actives        [Actualiser]│
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ [Courses supermarché] [En route]│   │
│  │ 🏪 Supermarché ABC              │   │
│  │ 🧭 Quartier Makepe              │   │
│  │ 👤 M. Diallo                    │   │
│  │                                 │   │
│  │ Dernière mise à jour: 10h30    │   │
│  │                    [Suivre] 👆  │   │
│  └─────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

### **Étape 3 : Cliquer sur le bouton "Suivre"**

Chaque carte de livraison (`ActiveDeliveryCard`) a un bouton **"Suivre"** en bas à droite.

**Code** :
```typescript
// mobile/src/components/delivery/ActiveDeliveryCard.tsx:113
<NativeButton
    title="Suivre"
    variant="primary"
    size="small"
    onPress={() => onPress(delivery.id)}  // 👆 Ouvre l'écran de suivi
/>
```

**Action** : Clique sur le bouton "Suivre" → Ouvre `DeliveryShoppingTrackingScreen`

---

## 🚚 POUR LE COURSIER

**Actuellement, le coursier utilise le même écran que le client.**

Le coursier doit :
1. Se connecter avec son compte
2. Aller dans l'onglet "Livraison"
3. Voir ses livraisons assignées dans "Vos livraisons actives"
4. Cliquer sur "Suivre" pour accéder au suivi

**Note** : Il n'y a pas encore d'écran spécifique pour les coursiers avec des fonctionnalités dédiées (comme changer le statut directement depuis l'écran de suivi).

---

## 🔄 AUTRES POINTS D'ACCÈS

### **1. Après création d'une commande**

Quand tu crées une commande de courses supermarché :

```
ShoppingSummaryScreen (Récapitulatif)
    ↓
[Confirmer la commande]
    ↓
✅ Commande créée
    ↓
Navigation automatique vers DeliveryShoppingTrackingScreen
```

**Code** :
```typescript
// mobile/src/screens/delivery/ShoppingSummaryScreen.tsx:49
const deliveryId = response.data?.delivery_id;
setActiveDeliveryId(deliveryId);
navigation.navigate('DeliveryShoppingTracking', { deliveryId });
```

### **2. Depuis le studio vidéo (pour prestataire)**

Si tu as créé une livraison depuis le studio vidéo :

```
VideoCreationWizardScreen
    ↓
Phase 3 : Preview intelligente
    ↓
CreatorStudioCard (Section Livraison)
    ↓
[Demander un coursier]
    ↓
✅ Livraison créée
    ↓
Le prestataire peut voir le suivi dans CreatorStudioCard
    ↓
Le client peut accéder via l'onglet "Livraison"
```

---

## 📋 STRUCTURE DE NAVIGATION

```
AppNavigator
    ↓
MainStack (Tab Navigator)
    ├── Home (🏠 Accueil)
    ├── Delivery (📦 Livraison) ← ICI
    │   └── DeliveryHomeScreen
    │       └── ActiveDeliveryCard
    │           └── [Suivre] → DeliveryShoppingTrackingScreen
    ├── Services (📋 Mes Services)
    ├── History (📜 Historique)
    └── Profile (👤 Mon Compte)
```

---

## 🎯 RÉSUMÉ VISUEL

### **Chemin d'accès pour le client** :

```
1. Ouvrir l'app
   ↓
2. Cliquer sur l'onglet "Livraison" (en bas)
   ↓
3. Voir la section "Vos livraisons actives"
   ↓
4. Cliquer sur le bouton "Suivre" d'une livraison
   ↓
5. ✅ Écran de suivi ouvert (DeliveryShoppingTrackingScreen)
```

### **Chemin d'accès pour le coursier** :

```
1. Ouvrir l'app (avec compte coursier)
   ↓
2. Cliquer sur l'onglet "Livraison" (en bas)
   ↓
3. Voir ses livraisons assignées dans "Vos livraisons actives"
   ↓
4. Cliquer sur le bouton "Suivre" d'une livraison
   ↓
5. ✅ Écran de suivi ouvert (DeliveryShoppingTrackingScreen)
```

---

## ⚠️ PROBLÈMES POTENTIELS

### **Si tu ne vois pas l'onglet "Livraison"** :

1. **Vérifie que tu es connecté** :
   - L'onglet "Livraison" n'apparaît que si tu es connecté
   - Si tu n'es pas connecté, tu vois seulement Login/Register

2. **Vérifie la navigation** :
   - L'onglet devrait être le 2ème onglet (après "Accueil")
   - Si tu ne le vois pas, il y a peut-être un problème de navigation

3. **Vérifie les feature flags** :
   - Si le module livraison est désactivé par un feature flag, l'onglet pourrait ne pas apparaître

### **Si tu ne vois pas de livraisons actives** :

1. **Vérifie que tu as créé une livraison** :
   - Va dans "Courses supermarché" → Crée une commande
   - Ou crée une livraison depuis le studio vidéo

2. **Vérifie le statut de la livraison** :
   - Seules les livraisons "actives" sont affichées
   - Les livraisons "delivered" ou "cancelled" ne sont pas dans cette liste

3. **Rafraîchis la liste** :
   - Clique sur "Actualiser" en haut de la section "Vos livraisons actives"
   - Ou tire vers le bas pour rafraîchir

---

## 🔧 CODE DE RÉFÉRENCE

### **Navigation vers l'écran de suivi** :

```typescript
// mobile/src/screens/delivery/DeliveryHomeScreen.tsx:91
const handleOpenDelivery = (deliveryId: string) => {
    setActiveDeliveryId(deliveryId);
    try {
        const parentNavigation = navigation.getParent();
        if (parentNavigation) {
            parentNavigation.navigate('DeliveryShoppingTracking', { deliveryId });
        } else {
            navigation.navigate('DeliveryShoppingTracking', { deliveryId });
        }
    } catch (error) {
        Alert.alert('Erreur', 'Impossible d\'ouvrir le suivi de livraison.');
    }
};
```

### **Affichage des livraisons actives** :

```typescript
// mobile/src/screens/delivery/DeliveryHomeScreen.tsx:207
{activeDeliveries.map(delivery => (
    <ActiveDeliveryCard 
        key={delivery.id} 
        delivery={delivery} 
        onPress={handleOpenDelivery}  // 👆 Ouvre l'écran de suivi
    />
))}
```

---

## ✅ CONCLUSION

**L'accès à l'écran de suivi se fait via** :
1. **Onglet "Livraison"** (barre de navigation en bas)
2. **Section "Vos livraisons actives"**
3. **Bouton "Suivre"** sur chaque carte de livraison

**Si tu ne le trouves pas**, vérifie :
- ✅ Que tu es connecté
- ✅ Que tu as créé une livraison
- ✅ Que la livraison est active (pas livrée/annulée)

