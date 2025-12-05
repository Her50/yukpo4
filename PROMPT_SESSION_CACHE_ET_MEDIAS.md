# 📋 Prompt pour Session Suivante : Cache Vidéo et Médias

## ✅ Configuration Cloudflare Terminée

**Domaine** : `yukpomnang.com`  
**CDN** : `cdn.yukpomnang.com` (CNAME créé dans Cloudflare DNS)  
**Serveurs de noms** : `isaac.ns.cloudflare.com`, `jillian.ns.cloudflare.com`  
**Statut** : Cloudflare actif, CDN créé

**⚠️ À Faire en début de session** :
- [ ] Configurer Workers ou Page Rules dans Cloudflare pour pointer `cdn.yukpomnang.com` vers Wasabi
- [ ] **Configurer variables d'environnement** dans `mobile/.env` :
```env
EXPO_PUBLIC_CDN_CLOUDFLARE_URL=https://cdn.yukpomnang.com
EXPO_PUBLIC_WASABI_DIRECT_URL=https://yukpo-video-prod.s3.eu-central-1.wasabisys.com
```
- [ ] Tester que `cdn.yukpomnang.com` fonctionne

---

## 🎯 Objectif de la Session

Implémenter le cache vidéo optimisé et unifier la lecture des médias dans toute l'application.

---

## 📦 Tâches à Traiter

### **1. Implémenter Cache Vidéo**

**Contexte** :
- Cloudflare CDN est configuré
- Wasabi stocke les vidéos
- Besoin d'optimiser le cache côté application

**Tâches** :
- [ ] Créer service de cache vidéo local (AsyncStorage/FileSystem)
- [ ] Implémenter stratégie de cache (LRU, TTL, taille max)
- [ ] Précharger vidéos suivantes dans le feed
- [ ] Gérer nettoyage automatique du cache
- [ ] Intégrer cache dans `OptimizedVideo` et `VideoWithEffects`
- [ ] Ajouter indicateur de cache (HIT/MISS) pour debug

**Fichiers à modifier/créer** :
- `mobile/src/services/videoCacheService.ts` (nouveau)
- `mobile/src/components/video/OptimizedVideo.tsx` (modifier)
- `mobile/src/components/video/VideoWithEffects.tsx` (modifier)
- `mobile/src/screens/VideoFeedScreen.tsx` (modifier)

---

### **2. Intégrer Livraison Intelligente et Chat dans VideoFeedScreen**

**Contexte** :
- VideoFeedScreen affiche des vidéos produits/services
- Besoin d'intégrer le composant de livraison intelligent Yukpo
- Permettre aux clients de lancer une livraison ou un chat directement depuis une vidéo

**Tâches** :
- [ ] Analyser le composant de livraison intelligent existant (Yukpo)
- [ ] Identifier comment intégrer dans VideoFeedScreen
- [ ] Ajouter bouton "Livrer" dans les actions latérales de VideoFeedScreen
- [ ] Ajouter bouton "Chat" dans les actions latérales de VideoFeedScreen
- [ ] Implémenter modal/overlay pour livraison depuis vidéo
- [ ] Implémenter ouverture chat depuis vidéo
- [ ] Pré-remplir données livraison avec informations du produit/service de la vidéo
- [ ] Gérer navigation entre VideoFeedScreen et livraison/chat

**Fichiers à analyser/créer** :
- `mobile/src/components/*Delivery*.tsx` (composants livraison existants)
- `mobile/src/screens/VideoFeedScreen.tsx` (modifier pour ajouter livraison/chat)
- `mobile/src/components/video/VideoDeliveryModal.tsx` (nouveau - modal livraison depuis vidéo)
- `mobile/src/components/video/VideoChatModal.tsx` (nouveau - modal chat depuis vidéo)

**UX Cible** :
- Client regarde vidéo produit → Clique "Livrer" → Modal livraison s'ouvre avec produit pré-rempli
- Client regarde vidéo produit → Clique "Chat" → Chat s'ouvre avec prestataire du produit
- Actions visibles dans sideActions de VideoFeedScreen (comme "Créer", "Duet", etc.)

---

### **3. Unifier Lecture Médias dans Toute l'Application**

**Problématique** :
- Lecture médias actuellement dispersée dans plusieurs composants
- ProductCard, HomeScreen, ChatModal, Commentaires, Livraisons utilisent différents systèmes
- Besoin d'unifier avec système Cloudflare/CDN

**Composants à Analyser** :

#### **A. ProductCard**
- [ ] Identifier comment les images/vidéos sont chargées
- [ ] Vérifier si utilise CDN ou backend direct
- [ ] Migrer vers `cdnService` si nécessaire

#### **B. HomeScreen**
- [ ] Identifier affichage médias (carrousels, images produits)
- [ ] Vérifier utilisation CDN
- [ ] Unifier avec système CDN

#### **C. ChatModal**
- [ ] Identifier envoi/réception médias (images, vidéos)
- [ ] Vérifier stockage et distribution
- [ ] Intégrer CDN pour médias partagés

#### **D. Commentaires (ProductCommentsSection)**
- [ ] Identifier affichage médias dans commentaires
- [ ] Vérifier upload et distribution
- [ ] Unifier avec CDN

#### **E. Livraisons (Delivery Screens)**
- [ ] Identifier affichage photos livraison
- [ ] Vérifier upload et distribution
- [ ] Intégrer CDN

**Fichiers à Analyser** :
- `mobile/src/components/ProductCard.tsx`
- `mobile/src/screens/HomeScreen.tsx`
- `mobile/src/components/ChatModal.tsx` (ou composant chat)
- `mobile/src/components/ProductCommentsSection.tsx`
- `mobile/src/screens/*Delivery*.tsx` (tous les écrans de livraison)

**Service à Créer** :
- `mobile/src/services/mediaService.ts` (service unifié pour tous les médias)
  - Méthodes : `getImageUrl()`, `getVideoUrl()`, `uploadMedia()`, etc.
  - Intègre `cdnService` automatiquement
  - Gère fallback Wasabi/Backend

---

## 🔍 Analyse Préalable

### **Questions à Répondre** :

1. **Comment les médias sont-ils actuellement chargés ?**
   - Backend direct ?
   - Wasabi direct ?
   - Pas de CDN ?

2. **Où sont stockés les médias ?**
   - Table `media` en base ?
   - URLs complètes ou chemins relatifs ?

3. **Quels types de médias ?**
   - Images produits
   - Vidéos produits
   - Images chat
   - Photos livraison
   - Avatars utilisateurs

4. **Quelle est la structure actuelle ?**
   - Composants utilisent `Image` directement ?
   - Utilisent-ils un service centralisé ?
   - Comment gèrent-ils les erreurs de chargement ?

---

## 🎯 Architecture Cible

### **Service Unifié MediaService** :

```typescript
class MediaService {
  // Obtenir URL image optimisée (via CDN)
  getImageUrl(path: string, options?: ImageOptions): string
  
  // Obtenir URL vidéo optimisée (via CDN)
  getVideoUrl(path: string, options?: VideoOptions): string
  
  // Upload média (vers Wasabi, puis CDN)
  uploadMedia(file: File, type: 'image' | 'video'): Promise<string>
  
  // Précharger média
  preloadMedia(url: string): Promise<void>
  
  // Vérifier cache
  isCached(url: string): boolean
}
```

### **Composants Unifiés** :

- `OptimizedImage` : Image avec CDN automatique
- `OptimizedVideo` : Vidéo avec CDN automatique (déjà existant)
- Utilisation dans tous les composants

---

## 📝 Checklist Implémentation

### **Phase 1 : Analyse**
- [ ] Analyser tous les composants listés
- [ ] Identifier patterns actuels
- [ ] Documenter structure médias

### **Phase 2 : Service Unifié**
- [ ] Créer `MediaService`
- [ ] Intégrer `cdnService`
- [ ] Implémenter fallback Wasabi/Backend
- [ ] Tests unitaires

### **Phase 3 : Cache Vidéo**
- [ ] Créer `VideoCacheService`
- [ ] Implémenter stratégie LRU
- [ ] Intégrer dans composants vidéo
- [ ] Tests performance

### **Phase 4 : Intégration Livraison/Chat dans VideoFeed**
- [ ] Analyser composant livraison intelligent Yukpo
- [ ] Créer VideoDeliveryModal
- [ ] Créer VideoChatModal
- [ ] Intégrer boutons dans VideoFeedScreen sideActions
- [ ] Implémenter pré-remplissage données livraison
- [ ] Tester workflow complet

### **Phase 5 : Migration Composants**
- [ ] Migrer ProductCard
- [ ] Migrer HomeScreen
- [ ] Migrer ChatModal
- [ ] Migrer Commentaires
- [ ] Migrer Livraisons

### **Phase 6 : Tests**
- [ ] Tests fonctionnels
- [ ] Tests performance
- [ ] Tests cache
- [ ] Tests fallback
- [ ] Tests livraison depuis vidéo
- [ ] Tests chat depuis vidéo

---

## 🔧 Configuration Requise

### **Variables d'Environnement** (déjà configurées) :
```env
EXPO_PUBLIC_CDN_CLOUDFLARE_URL=https://cdn.votredomaine.com
EXPO_PUBLIC_WASABI_DIRECT_URL=https://yukpo-video-prod.s3.eu-central-1.wasabisys.com
```

### **Dépendances Potentielles** :
- `react-native-fs` (pour cache fichier)
- `react-native-fast-image` (pour cache images)
- Vérifier dépendances existantes

---

## 📊 Métriques à Suivre

- **Performance** : Temps de chargement médias (avant/après)
- **Cache Hit Rate** : % de requêtes servies depuis cache
- **Bande passante** : Réduction consommation
- **UX** : Expérience utilisateur améliorée

---

## 🎯 Résultat Attendu

1. ✅ **Cache vidéo** fonctionnel et optimisé
2. ✅ **Service média unifié** utilisé partout
3. ✅ **CDN Cloudflare** utilisé pour tous les médias
4. ✅ **Performance** améliorée (chargement plus rapide)
5. ✅ **Livraison intelligente** intégrée dans VideoFeedScreen
6. ✅ **Chat** accessible directement depuis vidéos
7. ✅ **Code** unifié et maintenable

---

## 💡 Réflexion : Intégration Livraison Intelligente dans VideoFeed

### **Contexte Business** :

**Problème** :
- Client regarde vidéo produit dans VideoFeedScreen
- Pour commander/livrer, doit quitter le feed et naviguer ailleurs
- Friction dans le parcours d'achat

**Solution** :
- Intégrer livraison intelligente directement dans VideoFeedScreen
- Client regarde vidéo → Clique "Livrer" → Modal livraison s'ouvre
- Données produit/service pré-remplies depuis la vidéo
- Workflow fluide et sans friction

### **Workflow Cible** :

```
1. Client regarde vidéo produit dans VideoFeedScreen
   └─> Vidéo affiche produit/service

2. Client clique "Livrer" (bouton dans sideActions)
   └─> VideoDeliveryModal s'ouvre
       └─> Données pré-remplies :
           - Produit/service ID
           - Titre produit
           - Description
           - Prix (si disponible)
           - Prestataire ID

3. Client complète livraison
   └─> Adresse, date, etc.
       └─> Soumet commande
           └─> Retour au feed ou confirmation

4. Alternative : Client clique "Chat"
   └─> ChatModal s'ouvre
       └─> Chat avec prestataire du produit
           └─> Discussion directe depuis vidéo
```

### **Composants à Intégrer** :

- **VideoDeliveryModal** : Modal livraison depuis vidéo
  - Pré-remplissage automatique
  - Intègre composant livraison intelligent Yukpo existant
  - Workflow optimisé pour mobile

- **VideoChatModal** : Chat depuis vidéo
  - Ouvre chat avec prestataire
  - Contexte vidéo visible
  - Navigation fluide

### **Boutons dans VideoFeedScreen** :

Ajouter dans `sideActions` (à côté de "Créer", "Duet", etc.) :
- **"Livrer"** : Ouvre VideoDeliveryModal
- **"Chat"** : Ouvre VideoChatModal avec prestataire

### **Avantages** :

- ✅ **Conversion** : Réduction friction, commande plus rapide
- ✅ **UX** : Workflow fluide, pas de navigation complexe
- ✅ **Engagement** : Client reste dans le feed
- ✅ **Monétisation** : Facilite commandes depuis vidéos

---

*Date : 2025-12-03*  
*Prompt pour session cache et médias*

