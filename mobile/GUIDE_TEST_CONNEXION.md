# 📱 Guide de Test de Connexion Mobile

## ✅ Statut des Correctifs

Les modifications suivantes ont été appliquées avec **succès** :

### 1. `mobile/src/contexts/AuthContext.tsx`
- ✅ Ajout de `forceRender` pour forcer le re-render après connexion
- ✅ Utilisation de `decoded.email.split('@')[0]` comme nom par défaut (au lieu de '')
- ✅ Logs détaillés pour suivre le flux d'authentification
- ✅ Aucune erreur de compilation

### 2. `mobile/src/navigation/AppNavigator.tsx`
- ✅ Ajout de `navigationKey` pour forcer le remount des stacks
- ✅ useEffect amélioré pour détecter les changements d'utilisateur
- ✅ Logs détaillés pour suivre la navigation
- ✅ Aucune erreur de compilation

## 🧪 Test Backend : ✅ RÉUSSI

```
✅ Connexion réussie avec siaka@yahoo.fr
✅ Token JWT valide reçu
✅ Utilisateur ID: 17
✅ Crédits: 995,476 tokens
✅ Token sauvegardé dans AsyncStorage
```

## 🚀 Étapes pour Tester dans l'Application Mobile Réelle

### Étape 1 : Redémarrer l'application avec les nouveaux correctifs

```bash
cd mobile

# Arrêter l'application si elle tourne déjà
# Ctrl+C dans le terminal Expo

# Nettoyer le cache pour forcer le rechargement des fichiers modifiés
npx expo start --clear
```

### Étape 2 : Observer les logs pendant la connexion

Dans le terminal Expo, vous devriez voir une séquence de logs comme ceci :

#### Au démarrage de l'app :
```
[AuthContext] ═══ État actuel ═══
[AuthContext] user: false
[AuthContext] loading: true
[AuthContext] userId: undefined
[AuthContext] userEmail: undefined
[AuthContext] forceRender: 0
[AuthContext] ═══════════════════

[AppNavigator] ═════════════════════════════════════
[AppNavigator] RENDER
[AppNavigator] user exists: false
[AppNavigator] loading: true
[AppNavigator] ═════════════════════════════════════
```

#### Quand vous cliquez sur "Se connecter" :
```
[LoginScreen] handleLogin appelé
[AuthContext] ═══════════════════════════════════════
[AuthContext] 🔐 DÉBUT LOGIN
[AuthContext] Email: siaka@yahoo.fr
[AuthContext] ═══════════════════════════════════════

[Mobile API] Making request to: https://yukpomnang.onrender.com/auth/login
[AuthContext] Token reçu, décodage JWT...
[AuthContext] ✅ setUser() appelé avec: { id: '17', email: 'siaka@yahoo.fr', name: 'siaka', ... }
[AuthContext] ✅ forceRender incrémenté pour forcer le re-render

[AppNavigator] useEffect déclenché - user changed
[AppNavigator] ✅ Changement d'utilisateur détecté !
[AppNavigator] User Details: { id: '17', email: 'siaka@yahoo.fr', name: 'siaka' }
[AppNavigator] ✅ Utilisateur connecté, affichage MainStack
```

#### Si tout fonctionne :
```
[AppNavigator] 👤 User: { id: '17', email: 'siaka@yahoo.fr', name: 'siaka' }
```

### Étape 3 : Vérifier l'interface

Après avoir cliqué sur "Se connecter", vous devriez voir :

1. ✅ **Le composant DebugAuth** (en haut de l'écran) devrait afficher :
   ```
   Loading: false
   User exists: true
   Full User Object: {
     "id": "17",
     "email": "siaka@yahoo.fr",
     "name": "siaka",
     "role": "user",
     "credits": 995476,
     ...
   }
   ```

2. ✅ **L'écran devrait changer** automatiquement pour afficher **HomeScreen** (l'écran d'accueil)

3. ✅ **Le menu de navigation en bas** devrait apparaître avec 3 onglets :
   - Accueil
   - Menu
   - Profil

## 🔍 Si ça ne fonctionne TOUJOURS pas

### Debug 1 : Vérifier que les modifications sont prises en compte

Dans la console Expo, cherchez ces logs spécifiques :
- `[AuthContext] forceRender:` (doit changer de 0 à 1 après connexion)
- `[AppNavigator] navigationKey` (doit exister)

Si vous ne voyez PAS ces logs, les modifications ne sont pas prises en compte. Dans ce cas :

```bash
# Arrêter complètement l'app
Ctrl+C

# Supprimer TOUT le cache
rm -rf node_modules/.cache
rm -rf .expo
rm -rf dist

# Redémarrer
npx expo start --clear
```

### Debug 2 : Vérifier AsyncStorage dans l'app

Ajoutez temporairement ce bouton dans `LoginScreen.tsx` après le bouton "Se connecter" :

```typescript
<TouchableOpacity
  onPress={async () => {
    const token = await AsyncStorage.getItem('auth_token');
    const user = await AsyncStorage.getItem('user');
    Alert.alert('AsyncStorage Debug', 
      `Token: ${token ? 'OUI' : 'NON'}\n` +
      `User: ${user ? 'OUI' : 'NON'}`
    );
  }}
  style={[styles.loginButton, { backgroundColor: '#FF9800', marginTop: 10 }]}
>
  <Text style={styles.loginButtonLabel}>DEBUG STORAGE</Text>
</TouchableOpacity>
```

Cliquez sur ce bouton APRÈS avoir essayé de vous connecter.

### Debug 3 : Forcer la navigation manuellement

Si le token est sauvegardé mais la navigation ne se fait pas, ajoutez ceci dans `AuthContext.tsx` après la ligne 142 :

```typescript
// Forcer la navigation après un court délai
setTimeout(() => {
  console.log('[AuthContext] Vérification post-connexion...');
  console.log('[AuthContext] user:', user);
  console.log('[AuthContext] loading:', loading);
}, 500);
```

## 📊 Résumé des Modifications

### Avant (PROBLÈME) :
```typescript
// AuthContext.tsx
setUser(userData);  // ← L'interface ne se mettait pas à jour
```

### Après (SOLUTION) :
```typescript
// AuthContext.tsx
setUser(userData);
setForceRender(prev => prev + 1);  // ← Force le re-render
```

### Avant (PROBLÈME) :
```typescript
// AppNavigator.tsx
return <MainStack />;  // ← Pas de remount quand user change
```

### Après (SOLUTION) :
```typescript
// AppNavigator.tsx
return <MainStack key={`main-${navigationKey}`} />;  // ← Force le remount
```

## ✅ Ce qui devrait fonctionner maintenant

1. ✅ Vous cliquez sur "Se connecter"
2. ✅ L'API répond avec un token JWT valide
3. ✅ Le token est sauvegardé dans AsyncStorage
4. ✅ `setUser()` est appelé avec vos données
5. ✅ `forceRender` force le re-render du AuthContext
6. ✅ `AppNavigator` détecte le changement d'utilisateur
7. ✅ `navigationKey` force le remount de MainStack
8. ✅ L'écran change pour afficher HomeScreen
9. ✅ Vous êtes connecté ! 🎉

## 🎯 Vos Credentials de Test

```
Email: siaka@yahoo.fr
Mot de passe: Hernandez87
```

## 📞 Aide Supplémentaire

Si après toutes ces étapes ça ne fonctionne toujours pas, partagez-moi :

1. **Les logs complets** de la console Expo (copiez-collez tout ce qui s'affiche)
2. **Le résultat du bouton "DEBUG STORAGE"**
3. **Une capture d'écran** de l'écran après avoir cliqué sur "Se connecter"

---

**Prêt à tester ?** 🚀

```bash
cd mobile
npx expo start --clear
```

Puis dans l'app :
1. Entrez : `siaka@yahoo.fr` et `Hernandez87`
2. Cliquez sur "Se connecter"
3. Observez les logs dans la console
4. Vérifiez si l'écran change !

Bonne chance ! 🍀


