# 🆘 Aide au Diagnostic - Échec de Connexion

## ⚠️ Important à Comprendre

Je ne peux **pas** tester l'interface mobile directement car :
- Je n'ai pas accès à un émulateur Android/iOS
- Je ne peux pas voir l'interface graphique
- Je ne peux pas cliquer sur les boutons

**Mais je peux vous aider à diagnostiquer le problème !**

## 🔍 Étapes de Diagnostic

### Étape 1 : Lancer l'application avec logs

```powershell
cd mobile
.\lancer-app-debug.ps1
```

### Étape 2 : Observer ce qui se passe

Quand vous cliquez sur "Se connecter", **4 scénarios possibles** :

#### Scénario A : Le bouton ne répond pas du tout
**Symptôme :** Rien ne se passe quand vous cliquez
**Cause probable :** Problème dans le composant LoginScreen
**Solution :** Vérifiez si les champs email/password sont remplis

#### Scénario B : Le bouton montre "Connexion..." puis erreur
**Symptôme :** Message d'erreur affiché à l'écran
**Cause probable :** L'API répond avec une erreur
**Logs à chercher :**
```
[AuthContext] ❌ Échec connexion
[Mobile API] Erreur réseau
```

#### Scénario C : Aucune erreur mais l'écran ne change pas
**Symptôme :** Pas d'erreur, mais vous restez sur l'écran de connexion
**Cause probable :** Le state ne se met pas à jour
**Logs à chercher :**
```
[AuthContext] ✅ setUser() appelé
[AppNavigator] useEffect déclenché - user changed
```

#### Scénario D : L'app plante/crash
**Symptôme :** L'application se ferme
**Cause probable :** Erreur JavaScript
**Logs à chercher :** Erreurs en rouge dans la console

### Étape 3 : Capturer les informations

**Quand vous essayez de vous connecter, répondez à ces questions :**

1. **Que voyez-vous à l'écran ?**
   - [ ] Message d'erreur (lequel ?)
   - [ ] Le bouton reste gris "Connexion..."
   - [ ] Rien ne se passe
   - [ ] L'app plante

2. **Dans le composant DebugAuth (en haut), que voyez-vous ?**
   ```
   Loading: ??? (true ou false)
   User exists: ??? (true ou false)
   Full User Object: ???
   ```

3. **Dans la console Expo, cherchez ces logs :**
   - [ ] `[LoginScreen] handleLogin appelé` - Le clic est détecté
   - [ ] `[AuthContext] Tentative de connexion` - AuthContext est appelé
   - [ ] `[Mobile API] Making request` - La requête API est envoyée
   - [ ] `[AuthContext] Token reçu` - Le backend a répondu avec un token
   - [ ] `[AuthContext] ✅ setUser()` - L'utilisateur a été créé
   - [ ] `[AppNavigator] user changed` - La navigation a détecté le changement

4. **Y a-t-il des lignes en ROUGE (erreurs) ?**
   - Si oui, copiez-collez l'erreur complète

## 🧪 Tests à Faire

### Test 1 : Vérifier que l'API est accessible depuis votre téléphone

Sur votre téléphone/émulateur, ouvrez le navigateur et allez sur :
```
https://yukpomnang.onrender.com/health
```

**Résultat attendu :** Vous devriez voir un message du serveur

Si ça ne marche **pas** : Votre téléphone n'a pas accès à internet ou le backend est down.

### Test 2 : Vérifier AsyncStorage

Ajoutez ce bouton temporairement dans `LoginScreen.tsx` (après le bouton "Se connecter") :

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';

// ... dans le return() ...

<TouchableOpacity
  onPress={async () => {
    try {
      // Test écriture
      await AsyncStorage.setItem('test', 'hello');
      // Test lecture
      const value = await AsyncStorage.getItem('test');
      Alert.alert('Test AsyncStorage', value ? `✅ Fonctionne: ${value}` : '❌ Ne fonctionne pas');
    } catch (error) {
      Alert.alert('Erreur', error.message);
    }
  }}
  style={[styles.loginButton, { backgroundColor: '#FF9800', marginTop: 10 }]}
>
  <Text style={styles.loginButtonLabel}>TEST STORAGE</Text>
</TouchableOpacity>
```

Cliquez dessus. Si vous voyez "✅ Fonctionne: hello", AsyncStorage marche.

### Test 3 : Forcer la navigation manuellement

Ajoutez ce bouton pour forcer l'affichage de MainStack :

```typescript
<TouchableOpacity
  onPress={async () => {
    // Créer un faux utilisateur
    await AsyncStorage.setItem('auth_token', 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOjE3LCJyb2xlIjoidXNlciIsImVtYWlsIjoic2lha2FAeWFob28uZnIiLCJ0b2tlbnNfYmFsYW5jZSI6OTk1NDc2LCJpYXQiOjE3NTkzMDA4NDIsImV4cCI6MTc1OTM4NzI0Mn0.M0OtwU3VmJV8uz4PjyuAao-ZiIN41_c5wwP0c4ID2rM');
    Alert.alert('Test', 'Token sauvegardé. Redémarrez l\'app.');
  }}
  style={[styles.loginButton, { backgroundColor: '#9C27B0', marginTop: 10 }]}
>
  <Text style={styles.loginButtonLabel}>FORCE TOKEN</Text>
</TouchableOpacity>
```

Si après avoir cliqué et redémarré l'app vous voyez l'écran d'accueil, alors le problème est dans la fonction `login()`.

## 📋 Checklist de Vérification

Avant de tester, vérifiez que :

- [ ] Vous êtes dans le dossier `mobile/`
- [ ] Le fichier `.env` existe avec `EXPO_PUBLIC_API_URL=https://yukpomnang.onrender.com`
- [ ] Vous avez lancé `npx expo start --clear`
- [ ] Vous avez ouvert l'app dans Expo Go
- [ ] Vous utilisez les bons credentials : `siaka@yahoo.fr` / `Hernandez87`
- [ ] Votre téléphone/émulateur a accès à internet

## 💬 Ce dont j'ai besoin pour vous aider

Pour que je puisse vous aider efficacement, donnez-moi :

1. **La description exacte** de ce qui se passe quand vous cliquez sur "Se connecter"
2. **Les logs de la console Expo** (copiez tout ce qui s'affiche)
3. **Ce que montre DebugAuth** (Loading, User exists, Full User Object)
4. **Les messages d'erreur** s'il y en a (en rouge dans la console ou à l'écran)
5. **Résultat des tests** AsyncStorage et API (si vous les faites)

## 🎯 Prochaine Étape

**Lancez l'app maintenant :**
```powershell
cd mobile
.\lancer-app-debug.ps1
```

Puis essayez de vous connecter et **copiez-moi tous les logs** que vous voyez dans la console !

Je pourrai alors vous dire exactement où ça bloque. 🔍


