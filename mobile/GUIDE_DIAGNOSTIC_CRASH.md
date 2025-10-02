# 🔍 Guide de diagnostic du crash persistant

## 🚨 Problème
L'application Yukpo se bloque toujours au démarrage malgré les corrections.

## 🎯 Stratégie de diagnostic

### Étape 1 : Test version ultra-simple
```bash
# Activer la version ultra-simple
copy App.ultra-simple.tsx App.tsx

# Build et test
npx eas build --platform android --profile preview --non-interactive
```

**Si cette version fonctionne** → Le problème vient des dépendances complexes
**Si cette version échoue** → Le problème est plus profond (configuration, build)

### Étape 2 : Test progressif des dépendances
```bash
# Activer la version progressive
copy App.progressive.tsx App.tsx

# Build et test
npx eas build --platform android --profile preview --non-interactive
```

Cette version teste chaque dépendance une par une pour identifier le coupable.

### Étape 3 : Analyse des causes probables

#### 🔴 Cause 1 : Buffer/atob dans JWT Decode
```typescript
// Problème dans src/utils/jwtDecode.ts
Buffer = require('buffer').Buffer; // ← Peut causer un crash
```

#### 🔴 Cause 2 : AsyncStorage
```typescript
// Problème dans AuthContext
const token = await AsyncStorage.getItem('auth_token'); // ← Peut causer un crash
```

#### 🔴 Cause 3 : Navigation
```typescript
// Problème dans AppNavigator
const { user, loading } = useAuth(); // ← useAuth() peut échouer
```

#### 🔴 Cause 4 : Configuration API
```typescript
// Problème dans src/services/api.ts
const API_BASE_URL = config.API_BASE_URL; // ← config peut être undefined
```

## 🛠️ Solutions par cause

### Solution 1 : JWT Decode simplifié
```typescript
// Remplacer src/utils/jwtDecode.ts par une version simplifiée
export function jwtDecode<T>(token: string): T {
  try {
    const parts = token.split('.');
    const payload = parts[1];
    const jsonString = atob(payload); // Utiliser atob directement
    return JSON.parse(jsonString) as T;
  } catch (error) {
    throw new Error('JWT decode failed');
  }
}
```

### Solution 2 : AuthContext simplifié
```typescript
// Version simplifiée sans AsyncStorage au démarrage
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false); // Pas de loading au démarrage
  
  // Pas de useEffect au démarrage
  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
```

### Solution 3 : Navigation simplifiée
```typescript
// Version sans gestion d'état complexe
const AppNavigator = () => {
  return (
    <Tab.Navigator>
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Services" component={MyServicesScreen} />
      {/* Pas de logique d'authentification complexe */}
    </Tab.Navigator>
  );
};
```

## 📋 Plan d'action

### Phase 1 : Diagnostic
1. ✅ Tester version ultra-simple
2. ✅ Tester version progressive
3. ✅ Identifier la dépendance problématique

### Phase 2 : Correction
1. 🔧 Simplifier la dépendance problématique
2. 🔧 Tester la correction
3. 🔧 Ajouter progressivement les autres fonctionnalités

### Phase 3 : Validation
1. ✅ Tester toutes les fonctionnalités
2. ✅ Build de production
3. ✅ Déploiement

## 🎯 Commandes de test

### Test 1 : Version ultra-simple
```bash
copy App.ultra-simple.tsx App.tsx
npx eas build --platform android --profile preview --non-interactive
```

### Test 2 : Version progressive
```bash
copy App.progressive.tsx App.tsx
npx eas build --platform android --profile preview --non-interactive
```

### Test 3 : Version corrigée (après identification)
```bash
# Une fois la cause identifiée, appliquer la correction
npx eas build --platform android --profile preview --non-interactive
```

## 🚨 En cas d'échec de toutes les versions

### Vérifications supplémentaires
1. **Logs Android** :
   ```bash
   adb logcat | grep -i yukpo
   ```

2. **Configuration Expo** :
   - Vérifier `app.json`
   - Vérifier `eas.json`
   - Vérifier les permissions

3. **Dépendances** :
   ```bash
   npm audit
   npx expo doctor
   ```

4. **Build local** :
   ```bash
   npx expo run:android
   ```

## 📊 Résultats attendus

### ✅ Version ultra-simple fonctionne
- Problème identifié : dépendances complexes
- Solution : simplification progressive

### ❌ Version ultra-simple échoue
- Problème plus profond
- Vérifier configuration et build

### ✅ Version progressive identifie la cause
- Dépendance problématique trouvée
- Correction ciblée possible

## 🎉 Objectif final

Une application qui :
- ✅ Se lance sans crash
- ✅ Contient toutes les fonctionnalités
- ✅ Gère les erreurs gracieusement
- ✅ Fonctionne en production

---
*Guide créé pour résoudre le crash persistant de Yukpo*
