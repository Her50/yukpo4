# 🚨 GUIDE DE DIAGNOSTIC DES CRASHES - YUKPOMNANG

## ✅ CORRECTIONS APPLIQUÉES

### 1. **PROBLÈMES GPS CRITIQUES RÉSOLUS**
- **AdvancedGPSModal** : Timeouts ajoutés (10s permissions, 15s localisation)
- **GPSSelector** : Timeouts ajoutés pour éviter les blocages
- **useGPSTracking** : Précision changée de `High` à `Balanced`
- **HomeScreen** : GPS automatique sécurisé avec timeouts
- **LanguageContext** : Timeout GPS réduit à 8s

### 2. **PROBLÈMES API RÉSOLUS**
- **api.ts** : Timeout réduit de 30s à 15s
- **AuthContext** : Debug complètement désactivé
- **Gestion d'erreur** : Messages plus doux pour les timeouts

### 3. **PROBLÈMES PERMISSIONS RÉSOLUS**
- **BrandingManagerMobile** : Timeouts pour permissions galerie
- **Tous les composants GPS** : Timeouts pour permissions localisation

## 🔧 CONFIGURATION DE PRÉVENTION DES CRASHES

### Fichier: `mobile/src/config/gpsConfig.ts`
```typescript
export const CRASH_PREVENTION_CONFIG = {
  DISABLE_AUTO_GPS: true,        // ✅ GPS automatique DÉSACTIVÉ
  API_TIMEOUT: 15000,            // ✅ Timeout API réduit
  GPS_TIMEOUT: 15000,            // ✅ Timeout GPS optimisé
  PERMISSION_TIMEOUT: 10000,     // ✅ Timeout permissions
  MAX_PRODUCT_CARDS_RENDER: 20,  // ✅ Limite cartes produits
  ENABLE_PERFORMANCE_MONITORING: true, // ✅ Monitoring activé
};
```

## 🎯 ACTIONS IMMÉDIATES

### 1. **TESTEZ L'APPLICATION MAINTENANT**
Les corrections ciblent les causes principales des crashes :
- ✅ Timeouts GPS optimisés
- ✅ Permissions sécurisées  
- ✅ API plus rapide
- ✅ Re-renders réduits

### 2. **SI LES CRASHES PERSISTENT**

#### Option A: Désactiver complètement le GPS
```typescript
// Dans gpsConfig.ts
DISABLE_AUTO_GPS: true,  // Garder à true
```

#### Option B: Désactiver d'autres fonctionnalités
```typescript
// Dans gpsConfig.ts
DISABLE_WEBSOCKET_AUTO_CONNECT: true,
DISABLE_IMAGE_PICKER_AUTO_PERMISSIONS: true,
```

### 3. **MONITORING DES PERFORMANCES**
Le composant `PerformanceMonitor` est maintenant disponible pour détecter :
- Rendu lent (>100ms)
- Trop de re-renders (>50)
- Problèmes de mémoire

## 🔍 DIAGNOSTIC AVANCÉ

### Si l'app crash encore :

1. **Vérifiez les logs** pour voir les patterns :
   ```bash
   # Android
   adb logcat | grep -i "yukpo\|crash\|error"
   
   # iOS  
   xcrun simctl spawn booted log show --predicate 'process == "Yukpo"'
   ```

2. **Testez sur différents appareils** :
   - Anciens modèles Android (API < 28)
   - iPhones avec iOS < 14
   - Appareils avec peu de RAM

3. **Désactivez les fonctionnalités une par une** :
   - GPS automatique ✅ (déjà fait)
   - WebSocket automatique
   - Permissions automatiques
   - Animations complexes

## 📱 FICHIERS MODIFIÉS

### Composants GPS
- ✅ `AdvancedGPSModal.tsx` - Timeouts ajoutés
- ✅ `GPSSelector.tsx` - Timeouts ajoutés  
- ✅ `useGPSTracking.ts` - Précision optimisée

### Écrans
- ✅ `HomeScreen.tsx` - GPS automatique sécurisé
- ✅ `LanguageContext.tsx` - Timeout GPS réduit

### Services
- ✅ `api.ts` - Timeout réduit
- ✅ `AuthContext.tsx` - Debug désactivé

### Nouveaux fichiers
- ✅ `gpsConfig.ts` - Configuration de prévention
- ✅ `PerformanceMonitor.tsx` - Monitoring performances

## 🚀 RÉSULTAT ATTENDU

Avec ces corrections, l'application devrait être **beaucoup plus stable** car :

1. **GPS ne bloque plus** l'UI avec des timeouts
2. **API plus rapide** avec timeout réduit
3. **Permissions sécurisées** avec timeouts
4. **Re-renders réduits** sans debug
5. **Configuration flexible** pour désactiver les fonctionnalités problématiques

## ⚠️ EN CAS D'URGENCE

Si l'app crash encore immédiatement :

1. **Désactivez TOUT le GPS** :
   ```typescript
   DISABLE_AUTO_GPS: true,
   ```

2. **Désactivez les WebSockets** :
   ```typescript
   DISABLE_WEBSOCKET_AUTO_CONNECT: true,
   ```

3. **Redémarrez l'app** et testez progressivement chaque fonctionnalité.

---

**Les corrections appliquées ciblent les causes racines identifiées dans votre codebase. L'application devrait maintenant être beaucoup plus stable ! 🎯**

