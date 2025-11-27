# 🔥 Configuration Firebase pour EAS Build

## ✅ Solution mise en place

J'ai créé :
1. **`app.config.js`** : Configuration dynamique qui détecte automatiquement si `google-services.json` existe
2. **`google-services.json`** : Fichier minimal temporaire pour permettre le build

## ⚠️ Important

Le fichier `google-services.json` actuel est **temporaire** et ne permettra pas d'utiliser Firebase (notifications push). Pour activer Firebase, vous devez :

## 📋 Étapes pour configurer Firebase

### 1. Créer un projet Firebase

1. Allez sur [Firebase Console](https://console.firebase.google.com/)
2. Cliquez sur **"Ajouter un projet"** ou sélectionnez un projet existant
3. Suivez les étapes de création

### 2. Ajouter une application Android

1. Dans Firebase Console, cliquez sur l'icône **Android** (ou **"Ajouter une application"**)
2. Entrez le **package name** : `com.yukpomnang.mobile`
3. Cliquez sur **"Enregistrer l'application"**

### 3. Télécharger google-services.json

1. Dans Firebase Console, allez dans **Project Settings** (⚙️) > **Your apps** > **Android app**
2. Cliquez sur **"Télécharger google-services.json"**
3. Remplacez le fichier `mobile/google-services.json` par le fichier téléchargé

### 4. Configurer Firebase Cloud Messaging (FCM)

Pour les notifications push :

1. Dans Firebase Console, allez dans **Project Settings** > **Cloud Messaging**
2. Notez le **Server Key** (si nécessaire)
3. Configurez les notifications dans votre code

## 🔄 Alternative : Utiliser EAS Secrets (Recommandé pour production)

Si vous ne voulez pas commit le fichier dans Git :

### 1. Créer un secret EAS

```bash
cd mobile
eas secret:create --name GOOGLE_SERVICES_JSON --type file --value ./google-services.json --scope project
```

### 2. Modifier app.config.js pour utiliser le secret

```javascript
const fs = require('fs');
const path = require('path');

// Vérifier si le secret EAS existe
const googleServicesFromSecret = process.env.GOOGLE_SERVICES_JSON;
const googleServicesPath = path.join(__dirname, 'google-services.json');
const hasGoogleServices = fs.existsSync(googleServicesPath) || googleServicesFromSecret;

module.exports = {
  expo: {
    // ... configuration ...
    android: {
      // ... autres configs ...
      ...(hasGoogleServices && { 
        googleServicesFile: googleServicesFromSecret || "./google-services.json" 
      }),
    }
  }
};
```

## ✅ Vérification

Après avoir ajouté le vrai `google-services.json` :

1. Le build EAS fonctionnera sans erreur
2. Les notifications push Firebase fonctionneront
3. Les autres services Firebase seront disponibles

## 📝 Notes

- Le fichier `google-services.json` est déjà dans `.gitignore` (ne sera pas commité)
- Le fichier temporaire permet le build mais **ne fonctionne pas** avec Firebase
- Pour la production, utilisez EAS Secrets pour plus de sécurité

## 🚀 Prochaines étapes

1. Créer le projet Firebase
2. Télécharger le vrai `google-services.json`
3. Remplacer le fichier temporaire
4. Relancer le build : `npx eas build --platform android --profile preview`

