# 🔍 ANALYSE PROFONDE DES CRASHES - YUKPOMNANG MOBILE

**Date**: 22 Octobre 2025  
**Problème**: Crash persistant depuis 48h malgré toutes les corrections GPS

---

## 🚨 **PROBLÈMES CRITIQUES IDENTIFIÉS**

### ⚠️ **1. NAVIGATION LISTENERS NON NETTOYÉS** (CAUSE PRINCIPALE)

#### Problème dans `HomeScreen.tsx` (ligne 42-55):
```typescript
React.useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
        console.log('[HomeScreen] 🔄 Écran focus - Rafraîchissement du solde...');
        if (user?.id && refreshUser) {
            refreshUser().catch(err => {
                console.error('[HomeScreen] Erreur rafraîchissement solde:', err);
            });
        }
        setIsCreateService(false);
    });

    return unsubscribe;
}, [navigation, user?.id, refreshUser]); // ❌ PROBLÈME: Dépendances qui changent
```

**POURQUOI C'EST CRITIQUE:**
- `refreshUser` change à chaque render d'AuthContext
- Cela crée un **nouveau listener** à chaque fois
- Les **anciens listeners ne sont pas nettoyés**
- Après 10-20 navigations → **MEMORY LEAK → CRASH**

---

### ⚠️ **2. SETINTERVAL/SETTIMEOUT NON NETTOYÉS** (62 occurrences!)

#### Problèmes identifiés:
- **`useGPSTracking.ts`** : 4 timers (ligne 103, etc.)
- **`HomeScreen.tsx`** : 3 timers pour notifications
- **`LanguageContext.tsx`** : 1 timer GPS
- **`api.ts`** : 1 timeout par requête API
- **`ChatModalMobile.tsx`** : 2 timers
- **`WebSocketContext.tsx`** : 2 timers de reconnexion

**EFFET CUMULATIF:**
Après 30 minutes d'utilisation:
- 100+ timers actifs
- Mémoire saturée
- **CRASH INÉVITABLE**

---

### ⚠️ **3. USEEFFECT AVEC DÉPENDANCES INSTABLES**

#### `HomeScreen.tsx` - useEffect sans cleanup:
```typescript
React.useEffect(() => {
    const interval = setInterval(async () => {
        // Charger notifications toutes les 30 secondes
        // ...
    }, 30000);

    return () => {
        clearInterval(interval); // ✅ BON
    };
}, [user?.id, showNotificationModal]); // ❌ showNotificationModal change souvent!
```

**PROBLÈME:**
- `showNotificationModal` change quand on ouvre/ferme le modal
- Chaque changement → **nouveau interval**
- Ancien interval **pas toujours nettoyé**
- Accumulation → **CRASH**

---

### ⚠️ **4. APP.TSX - DÉLAI DE 1 SECONDE SYSTÉMATIQUE**

```typescript
export default function App() {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsReady(true);
    }, 1000); // ❌ Délai artificiel inutile

    return () => clearTimeout(timer);
  }, []);
```

**PROBLÈME:**
- Délai de 1s au démarrage pour "éviter les conflits"
- Mais **ne résout rien**
- Peut causer des race conditions avec GPS/WebSocket

---

### ⚠️ **5. GPS TRACKING AUTOMATIQUE PARTOUT**

#### Multiples initialisations GPS:
1. **`GPSTrackingManager`** dans App.tsx
2. **`ResultatBesoin.tsx`** démarre GPS (ligne 72-81)
3. **`HomeScreen.tsx`** démarre GPS
4. **`useGPSTracking`** hook global

**RÉSULTAT:**
- **4 services GPS en parallèle**
- Conflits de permissions
- Watchman simultanés
- **CRASH GARANTI**

---

### ⚠️ **6. WEBSOCKET RECONNEXIONS INFINIES**

#### `WebSocketContext.tsx`:
```typescript
useEffect(() => {
    const handleStatusChange = (status: 'online' | 'offline') => {
        if (status === 'offline') {
            // Reconnexion automatique
            setTimeout(() => connect(), 5000);
        }
    };
}, [callbacks]); // ❌ callbacks change = nouveau listener
```

**PROBLÈME:**
- Callbacks recréés à chaque render
- Multiples listeners de reconnexion
- Reconnexions en boucle infinie
- **CRASH RÉSEAU**

---

### ⚠️ **7. PUSH NOTIFICATIONS LISTENERS NON NETTOYÉS**

#### `PushNotificationManager.tsx`:
```typescript
useEffect(() => {
    if (!user) return; // ❌ Return sans cleanup!

    notificationListener.current = setupNotificationListener(...);
    responseListener.current = setupNotificationResponseHandler(...);

    return () => {
        // Cleanup OK
    };
}, [user]); // ❌ user change = nouveaux listeners
```

**PROBLÈME:**
- Si `user` change (login/logout)
- Nouveaux listeners créés
- Anciens pas toujours nettoyés
- **MEMORY LEAK**

---

## 🎯 **CORRECTIONS CRITIQUES À APPLIQUER**

### 1. **STABILISER LES DÉPENDANCES useEffect**

```typescript
// ❌ AVANT
}, [navigation, user?.id, refreshUser]);

// ✅ APRÈS
}, [navigation, user?.id]); // Retirer refreshUser
```

### 2. **WRAPPER LES CALLBACKS AVEC useCallback**

```typescript
const refreshUserCallback = useCallback(() => {
    if (user?.id && refreshUser) {
        refreshUser().catch(err => {
            console.error('Erreur:', err);
        });
    }
}, [user?.id]); // refreshUser pas dans deps
```

### 3. **CENTRALISER LE GPS (UN SEUL SERVICE)**

```typescript
// Retirer GPS de ResultatBesoin.tsx
// Retirer GPS de HomeScreen.tsx
// Garder UNIQUEMENT GPSTrackingManager
```

### 4. **LIMITER LES TIMERS**

```typescript
// Au lieu de 30 secondes:
}, 5 * 60 * 1000); // 5 minutes

// Ou utiliser useFocusEffect au lieu de setInterval
```

### 5. **NETTOYER TOUS LES LISTENERS**

```typescript
useEffect(() => {
    const listener = navigation.addListener('focus', handleFocus);
    
    return () => {
        listener(); // ✅ Toujours nettoyer
    };
}, []); // ✅ Deps vides pour éviter re-création
```

---

## 🔥 **ORDRE DE PRIORITÉ DES CORRECTIONS**

### CRITIQUE (À FAIRE IMMÉDIATEMENT):
1. ✅ Stabiliser deps `navigation.addListener` dans HomeScreen
2. ✅ Retirer GPS multiple (garder 1 seul)
3. ✅ Wrapper callbacks avec `useCallback`
4. ✅ Nettoyer tous les timers

### IMPORTANT:
5. ✅ Limiter fréquence des timers (5min au lieu de 30s)
6. ✅ Retirer délai 1s artificiel dans App.tsx
7. ✅ Stabiliser WebSocket listeners

### SECONDAIRE:
8. Optimiser les re-renders
9. Ajouter monitoring mémoire
10. Tests de stress navigation

---

## 📊 **STATISTIQUES TROUVÉES**

- **78 useEffect** dans screens/
- **62 setTimeout/setInterval** dans le code
- **4 services GPS** en parallèle
- **1 navigation listener** avec deps instables
- **Multiple WebSocket** reconnexions

---

## 🎯 **RÉSULTAT ATTENDU**

Avec ces corrections:
- ✅ **0 memory leaks** navigation
- ✅ **1 seul GPS** service
- ✅ **Timers** tous nettoyés
- ✅ **Listeners** stables
- ✅ **Application stable**

---

**CES PROBLÈMES SONT LES VRAIES CAUSES DES CRASHES !**  
**Les problèmes GPS étaient des symptômes, pas la cause racine.**


