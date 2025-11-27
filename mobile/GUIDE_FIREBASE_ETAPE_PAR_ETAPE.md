# 🔥 Guide Complet : Configuration Firebase pour Yukpomnang

## 📖 Rôle de `google-services.json`

### 🎯 **À quoi sert ce fichier ?**

Le fichier `google-services.json` est **essentiel** pour connecter votre application Android à Firebase. Il contient :

1. **Identifiants du projet Firebase** : Lien entre votre app et votre projet Firebase
2. **Configuration Firebase Cloud Messaging (FCM)** : Pour les **notifications push**
3. **Clés API Firebase** : Pour authentifier votre app auprès des services Firebase
4. **Configuration des services Firebase** : Analytics, Crashlytics, etc.

### ⚠️ **Sans ce fichier (ou avec le fichier temporaire) :**
- ❌ Les **notifications push ne fonctionnent pas**
- ❌ Les appels en arrière-plan ne peuvent pas notifier l'utilisateur
- ❌ Firebase Analytics ne fonctionne pas
- ❌ Les crash reports Firebase ne fonctionnent pas

### ✅ **Avec le vrai fichier :**
- ✅ **Notifications push fonctionnelles** (même app fermée)
- ✅ **Notifications d'appels** avec sonnerie
- ✅ **Analytics Firebase** pour suivre l'usage
- ✅ **Crash reports** automatiques

---

## 📋 Guide Étape par Étape : Obtenir le Vrai Fichier

### **ÉTAPE 1 : Accéder à Firebase Console**

1. Ouvrez votre navigateur
2. Allez sur : **https://console.firebase.google.com/**
3. Connectez-vous avec votre compte Google

---

### **ÉTAPE 2 : Créer ou Sélectionner un Projet**

#### **Option A : Créer un Nouveau Projet**

1. Cliquez sur **"Ajouter un projet"** (ou "Add project")
2. Entrez le nom du projet : **"Yukpomnang"** (ou un nom de votre choix)
3. Cliquez sur **"Continuer"** (Continue)
4. **Désactivez** Google Analytics si vous ne voulez pas l'utiliser (optionnel)
5. Cliquez sur **"Créer le projet"** (Create project)
6. Attendez quelques secondes que le projet soit créé
7. Cliquez sur **"Continuer"** (Continue)

#### **Option B : Utiliser un Projet Existant**

1. Dans la liste des projets, cliquez sur votre projet existant

---

### **ÉTAPE 3 : Ajouter une Application Android**

1. Dans le tableau de bord Firebase, vous verrez plusieurs icônes :
   - 📱 **iOS** (iPhone)
   - 🤖 **Android** (robot)
   - 🌐 **Web** (globe)

2. Cliquez sur l'icône **🤖 Android**

3. Un formulaire s'ouvre avec 2 champs :
   - **Nom du package Android** : Entrez exactement : `com.yukpomnang.mobile`
   - **Surnom de l'application** (optionnel) : "Yukpomnang Mobile"

4. ⚠️ **IMPORTANT** : Le package name doit être **EXACTEMENT** : `com.yukpomnang.mobile`
   - Pas d'espaces
   - Pas de majuscules
   - Exactement comme indiqué

5. Cliquez sur **"Enregistrer l'application"** (Register app)

---

### **ÉTAPE 4 : Télécharger `google-services.json`**

1. Après avoir enregistré l'app, Firebase affiche une page avec 2 options :
   - **Option 1** : Télécharger `google-services.json`
   - **Option 2** : Suivre les instructions d'installation

2. **Cliquez sur le bouton "Télécharger google-services.json"** (Download google-services.json)

3. Le fichier se télécharge automatiquement dans votre dossier **Téléchargements**

---

### **ÉTAPE 5 : Remplacer le Fichier Temporaire**

1. Ouvrez l'explorateur de fichiers Windows
2. Allez dans votre dossier **Téléchargements**
3. Trouvez le fichier **`google-services.json`** (vient d'être téléchargé)
4. **Copiez** ce fichier (Ctrl+C)

5. Naviguez vers votre projet :
   ```
   C:\Users\23767\yukpomnang2\mobile\
   ```

6. **Collez** le fichier dans le dossier `mobile` (Ctrl+V)
   - Si Windows demande de **remplacer** le fichier existant, cliquez sur **"Remplacer"** (Oui)

7. ✅ **Vérification** : Le fichier `mobile/google-services.json` doit maintenant être le vrai fichier Firebase

---

### **ÉTAPE 6 : Vérifier le Contenu du Fichier**

Ouvrez `mobile/google-services.json` avec un éditeur de texte (Notepad++, VS Code, etc.)

Le fichier devrait contenir quelque chose comme :
```json
{
  "project_info": {
    "project_number": "123456789012",
    "project_id": "yukpomnang-xxxxx",
    "storage_bucket": "yukpomnang-xxxxx.appspot.com"
  },
  "client": [
    {
      "client_info": {
        "mobilesdk_app_id": "1:123456789012:android:abcdef123456",
        "android_client_info": {
          "package_name": "com.yukpomnang.mobile"
        }
      },
      ...
    }
  ]
}
```

⚠️ **Si vous voyez encore** `"project_id": "yukpomnang-mobile-temp"` → Le fichier n'a pas été remplacé correctement

---

## ✅ Vérification Finale

### **1. Vérifier que le fichier est au bon endroit**
```bash
# Dans PowerShell, depuis le dossier mobile
Test-Path .\google-services.json
# Doit retourner : True
```

### **2. Vérifier le package name dans le fichier**
Ouvrez `google-services.json` et cherchez `"package_name"` - il doit être `"com.yukpomnang.mobile"`

### **3. Relancer le build**
```bash
cd mobile
npx eas build --platform android --profile preview
```

Le build devrait maintenant fonctionner avec Firebase activé !

---

## 🔧 Configuration Supplémentaire (Optionnel)

### **Activer Firebase Cloud Messaging (FCM)**

Pour que les notifications push fonctionnent complètement :

1. Dans Firebase Console, allez dans **Project Settings** (⚙️ en haut à gauche)
2. Cliquez sur l'onglet **"Cloud Messaging"**
3. Notez le **"Server key"** si vous en avez besoin pour le backend

### **Tester les Notifications**

Une fois le build terminé et l'app installée :
- Les notifications push devraient fonctionner
- Les appels en arrière-plan devraient notifier l'utilisateur

---

## 🆘 Problèmes Courants

### **Problème 1 : "Package name déjà utilisé"**
- Solution : Utilisez un projet Firebase différent ou changez le package name dans `app.json`

### **Problème 2 : "Fichier non trouvé lors du build"**
- Vérifiez que le fichier est bien dans `mobile/google-services.json`
- Vérifiez que le fichier n'est pas dans `.gitignore` (il doit y être pour la sécurité)

### **Problème 3 : "Notifications ne fonctionnent toujours pas"**
- Vérifiez que le package name dans `google-services.json` correspond à celui dans `app.json`
- Vérifiez que Firebase Cloud Messaging est activé dans Firebase Console

---

## 📝 Notes Importantes

- ✅ Le fichier `google-services.json` est **sensible** - ne le commitez JAMAIS dans Git
- ✅ Il est déjà dans `.gitignore` pour votre sécurité
- ✅ Chaque projet Firebase a son propre `google-services.json`
- ✅ Si vous changez de projet Firebase, vous devez télécharger le nouveau fichier

---

## 🚀 Prochaines Étapes

1. ✅ Télécharger le vrai `google-services.json`
2. ✅ Remplacer le fichier temporaire
3. ✅ Relancer le build EAS
4. ✅ Tester les notifications push dans l'app

**Votre application sera maintenant complètement fonctionnelle avec Firebase !** 🎉

