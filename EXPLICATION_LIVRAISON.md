# 📦 Explication des Deux Systèmes de Livraison dans Yukpo

## Vue d'ensemble

Il existe **deux systèmes de livraison** dans l'application, chacun avec un rôle spécifique :

1. **Module Livraison Principal** (Onglet "Livraison" dans la navigation)
2. **Module Livraison dans le Studio Vidéo** (Intégré dans le workflow de création vidéo)

---

## 🚚 1. MODULE LIVRAISON PRINCIPAL

### 📍 Localisation
- **Écran** : `mobile/src/screens/delivery/DeliveryHomeScreen.tsx`
- **Contexte** : `mobile/src/contexts/DeliveryContext.tsx`
- **Composants** : `mobile/src/components/delivery/`
- **Accès** : Onglet "Livraison" dans la navigation principale (pied de page)

### 🎯 Rôle et Fonctionnalités

**C'est le système principal de livraison de la plateforme**, autonome et indépendant :

1. **Gestion globale des livraisons**
   - Affiche toutes les livraisons actives de l'utilisateur
   - Utilise `DeliveryContext` pour gérer l'état global
   - Suivi en temps réel via WebSocket pour toutes les livraisons

2. **Flux de commande**
   - **Courses supermarché** : Compose un panier, suivi du coursier en direct
   - **Livraison de colis** : Expédition de colis/documents avec suivi temps réel
   - Navigation vers `DeliveryShoppingFlow` (panier → budget → pickup/dropoff → résumé)

3. **Fonctionnalités**
   - Liste des livraisons actives
   - Suivi en temps réel avec WebSocket
   - Gestion des mutations en mode offline
   - Notifications de statut
   - Carte de suivi (`DeliveryShoppingTrackingScreen`)

### 🔧 Architecture Technique

```typescript
// Contexte global pour toutes les livraisons
DeliveryContext
  ├── deliveries: Record<string, DeliverySummary>
  ├── events: Record<string, DeliveryRealtimeEvent[]>
  ├── refreshActiveDeliveries()
  ├── refreshDelivery()
  └── WebSocket pour suivi temps réel
```

### 📂 Fichiers Associés
- `DeliveryHomeScreen.tsx` - Écran principal
- `DeliveryContext.tsx` - Contexte global
- `DeliveryShoppingFlow` - Flux de commande (panier, budget, pickup/dropoff, résumé)
- `DeliveryShoppingTrackingScreen.tsx` - Suivi en temps réel
- `ActiveDeliveryCard.tsx` - Carte de livraison active
- `DeliveryAvatarBubble.tsx` - Avatar du système de livraison

---

## 🎬 2. MODULE LIVRAISON DANS LE STUDIO VIDÉO

### 📍 Localisation
- **Composant** : `mobile/src/components/CreatorStudioCard.tsx`
- **Hook** : `mobile/src/hooks/useCreatorStudio.ts`
- **Intégration** : `mobile/src/screens/video/VideoCreationWizardScreen.tsx`
- **Accès** : Depuis le workflow de création vidéo (Phase 3 - Preview intelligente)

### 🎯 Rôle et Fonctionnalités

**C'est un cas d'usage spécifique** : permettre de créer une livraison directement depuis le workflow de création vidéo.

1. **Intégration dans le workflow vidéo**
   - Accessible depuis `VideoCreationWizardScreen` (Phase 3)
   - Permet de demander un coursier pendant la création de vidéo
   - Lie la livraison à la session de création vidéo via metadata

2. **Cas d'usage spécifique**
   - Livrer des produits/services depuis le studio vidéo
   - Transport de passagers (mode passager)
   - Pickup programmé pour laisser le matching doux
   - Facturation inclusive (merchant_inclusive)

3. **Fonctionnalités**
   - Création de livraison depuis le studio
   - Suivi temps réel de la livraison liée à la session vidéo
   - WebSocket dédié pour le suivi de cette livraison spécifique
   - Métadonnées enrichies (studio_session_id, template, brief, etc.)

### 🔧 Architecture Technique

```typescript
// Hook spécifique au studio vidéo
useCreatorStudio
  ├── sessionId: string (session de création vidéo)
  ├── linkedDeliveryId: string | null (livraison liée)
  ├── deliverySummary: DeliverySummary | null
  ├── requestCourier() - Crée une livraison depuis le studio
  ├── linkDelivery() - Lie une livraison existante
  └── WebSocket dédié pour cette livraison
```

### 📂 Fichiers Associés
- `CreatorStudioCard.tsx` - Composant UI dans le studio
- `useCreatorStudio.ts` - Hook de gestion du studio + livraison
- `VideoCreationWizardScreen.tsx` - Intègre CreatorStudioCard

---

## 🔄 Différences Clés

| Aspect | Module Principal | Module Studio Vidéo |
|--------|------------------|---------------------|
| **Contexte** | `DeliveryContext` (global) | `useCreatorStudio` (spécifique) |
| **Accès** | Onglet navigation | Workflow création vidéo |
| **Portée** | Toutes les livraisons | Livraison liée à session vidéo |
| **WebSocket** | Toutes les livraisons actives | Une seule livraison (liée) |
| **Métadonnées** | Standard | Enrichies (studio_session_id, template, etc.) |
| **Cas d'usage** | Livraisons générales | Livraison depuis création vidéo |
| **Flux** | Panier → Budget → Pickup/Dropoff → Résumé | Direct depuis studio |

---

## 🔗 Points Communs

Les deux systèmes utilisent :
- **Les mêmes APIs backend** : `deliveryApi.createDeliveryRequest()`, `deliveryApi.getDeliveryById()`
- **Le même format de données** : `DeliverySummary`, `DeliveryRealtimeEvent`
- **Le même système de WebSocket** : `/api/delivery/{deliveryId}/ws`
- **Les mêmes types TypeScript** : `CreateDeliveryRequestPayload`, `DeliverySummary`

---

## 💡 Pourquoi Deux Systèmes ?

### ✅ Avantages de cette Architecture

1. **Séparation des responsabilités**
   - Module principal : gestion globale des livraisons
   - Module studio : cas d'usage spécifique intégré au workflow vidéo

2. **Réutilisabilité**
   - Les APIs backend sont partagées
   - Les types sont communs
   - Pas de duplication de code backend

3. **Expérience utilisateur optimisée**
   - Le module principal offre une vue globale
   - Le module studio offre une intégration fluide dans le workflow vidéo

### ⚠️ Points d'Attention

1. **Pas de synchronisation automatique**
   - Une livraison créée depuis le studio n'apparaît pas automatiquement dans le module principal
   - Il faut rafraîchir le module principal pour voir la nouvelle livraison

2. **Deux WebSockets séparés**
   - Le module principal a un WebSocket pour toutes les livraisons
   - Le module studio a un WebSocket dédié à la livraison liée

---

## 🎯 Recommandations

### Option 1 : Garder les deux systèmes (Recommandé)
- ✅ Chaque système a son rôle clair
- ✅ Expérience utilisateur optimisée pour chaque cas d'usage
- ⚠️ Nécessite de synchroniser les deux systèmes

### Option 2 : Centraliser dans DeliveryContext
- ✅ Une seule source de vérité
- ✅ Synchronisation automatique
- ❌ Perte de l'intégration fluide dans le workflow vidéo

### Option 3 : Faire appel au module principal depuis le studio
- ✅ Réutilisation du code existant
- ✅ Synchronisation automatique
- ⚠️ Nécessite de naviguer vers le module principal

---

## 📝 Conclusion

Les deux systèmes sont **complémentaires** :
- Le **module principal** est le système de livraison général de la plateforme
- Le **module studio** est une intégration spécifique pour le workflow de création vidéo

Ils utilisent les mêmes APIs backend mais avec des contextes différents, ce qui permet :
- Une expérience utilisateur optimisée pour chaque cas d'usage
- Une réutilisation des APIs backend
- Une séparation claire des responsabilités

**La confusion vient du fait qu'ils utilisent les mêmes APIs mais dans des contextes différents.**

