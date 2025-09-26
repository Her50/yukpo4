# 🔍 Guide de Débogage - Application Mobile Réelle

## 🎯 **Problème Identifié**

Notre logique d'authentification est **100% correcte** (confirmé par les tests). Le problème est dans l'application mobile installée sur votre téléphone.

## 📱 **Étapes de Débogage**

### **1. Vérifier la Version de l'App**

1. **Ouvrez l'application mobile**
2. **Allez dans les paramètres** (si disponible)
3. **Vérifiez la version** - Elle devrait être récente
4. **Notez la date de build** - Elle devrait correspondre à nos corrections

### **2. Activer les Logs de Débogage**

#### **Option A : Logs Android (Recommandé)**
1. **Activez le mode développeur** sur votre téléphone Android
2. **Activez le débogage USB**
3. **Connectez votre téléphone à l'ordinateur**
4. **Ouvrez une invite de commande** et tapez :
   ```bash
   adb logcat | grep -E "(AuthContext|AppNavigator|Yukpomnang)"
   ```

#### **Option B : Logs dans l'App**
1. **Ouvrez l'application**
2. **Secouez votre téléphone** (si le mode développeur est activé)
3. **Ou appuyez 7 fois sur l'icône de l'app** dans les paramètres
4. **Regardez les logs** qui s'affichent

### **3. Tester l'Authentification**

1. **Ouvrez l'application**
2. **Essayez de vous inscrire** avec :
   - Email : `test-debug-${timestamp}@yukpomnang.com`
   - Mot de passe : `TestPassword123!`
   - Nom : `Test Debug User`
3. **Regardez les logs** pendant l'inscription
4. **Essayez de vous connecter** avec les mêmes identifiants
5. **Regardez les logs** pendant la connexion

### **4. Logs à Chercher**

#### **✅ Logs de Succès (Devraient Apparaître)**
```
[AuthContext] Token reçu, décodage JWT...
[AuthContext] JWT décodé: ID=XX, Email=..., Role=user
[AuthContext] Utilisateur créé depuis JWT: {...}
[AuthContext] setUser appelé avec: {...}
[AuthContext] Re-render forcé terminé
[AppNavigator] État actuel: {user: true, loading: false, ...}
[AppNavigator] Utilisateur connecté, affichage MainStack
```

#### **❌ Logs d'Erreur (Problèmes Possibles)**
```
[AuthContext] Erreur décodage JWT
[AuthContext] Token expiré
[AuthContext] Aucun token dans la réponse
[AppNavigator] État actuel: {user: false, loading: true}
[AppNavigator] Affichage LoadingScreen (en boucle)
```

### **5. Problèmes Possibles**

#### **A. Version Ancienne de l'App**
- **Symptôme** : Pas de logs `[AuthContext]` ou `[AppNavigator]`
- **Solution** : Attendre le build EAS et installer la nouvelle APK

#### **B. Problème de Navigation**
- **Symptôme** : Logs `[AuthContext]` OK mais `[AppNavigator]` reste sur `AuthStack`
- **Solution** : Problème dans l'AppNavigator, vérifier le code

#### **C. Problème de Re-render**
- **Symptôme** : `setUser` appelé mais pas de changement d'écran
- **Solution** : Problème de re-render React, vérifier les dépendances

#### **D. Problème de Token**
- **Symptôme** : Erreur de décodage JWT ou token expiré
- **Solution** : Problème de communication avec le backend

### **6. Solutions par Problème**

#### **Si Pas de Logs du Tout**
```bash
# Vérifier que l'app est bien installée
adb shell pm list packages | grep yukpomnang

# Vérifier les logs généraux
adb logcat | grep -i yukpomnang
```

#### **Si Logs AuthContext OK mais Pas de Navigation**
- Le problème est dans l'AppNavigator
- Vérifier que `useAuth()` retourne les bonnes valeurs
- Vérifier que les re-renders se déclenchent

#### **Si Erreur de Token**
- Vérifier la connexion internet
- Vérifier que le backend est accessible
- Vérifier les variables d'environnement

### **7. Test de Validation**

#### **Test Simple**
1. **Ouvrez l'app**
2. **Regardez l'écran initial** :
   - ✅ **AuthStack** (Login/Register) = Normal
   - ❌ **LoadingScreen** (en boucle) = Problème
   - ❌ **MainStack** (sans connexion) = Problème

#### **Test d'Authentification**
1. **Inscrivez-vous**
2. **Regardez l'écran après inscription** :
   - ✅ **MainStack** (HomeScreen) = Succès
   - ❌ **AuthStack** (reste sur Login) = Problème
   - ❌ **LoadingScreen** (en boucle) = Problème

### **8. Rapport de Bug**

Si le problème persiste, fournissez :

1. **Logs complets** de l'application
2. **Version de l'app** installée
3. **Date d'installation** de l'APK
4. **Comportement observé** (écran affiché)
5. **Étapes de reproduction** exactes

## 🚀 **Résolution Attendue**

Avec nos corrections, l'application devrait :
- ✅ Afficher AuthStack au démarrage
- ✅ Basculer vers LoadingScreen pendant l'authentification
- ✅ Basculer vers MainStack (HomeScreen) après connexion/inscription
- ✅ Afficher les logs de débogage dans la console

Si ce n'est pas le cas, le problème est dans l'application installée, pas dans notre logique ! 🎯

