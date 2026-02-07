# 📱 Guide de Distribution de l'Application Yukpo

## ⚠️ IMPORTANT : Development Build vs Production Build

**Les options A et B génèrent des APK PRODUCTION (standalone) qui :**
- ✅ **N'ont AUCUN besoin de serveur**
- ✅ Fonctionnent **indépendamment** comme n'importe quelle app Android
- ✅ **Aucun problème de connexion serveur** pour les utilisateurs
- ✅ Sont **prêtes pour la distribution**

Le problème de serveur que vous rencontrez est **uniquement lié au Development Build** utilisé pour le développement. Une fois que vous générez un Production Build, ce problème disparaît complètement.

> 📖 Voir `DIFFERENCE_DEV_VS_PRODUCTION.md` pour plus de détails

## 🎯 Options de Distribution

### 1️⃣ **Build de Production avec EAS Build** (Recommandé pour distribution)

#### A. Build APK pour installation directe

```bash
cd mobile
eas build --platform android --profile production
```

**Avantages :**
- ✅ APK optimisé et signé
- ✅ Prêt pour distribution
- ✅ Taille réduite (30-40 MB)
- ✅ Pas besoin de Google Play Store

**Utilisation :**
1. Téléchargez l'APK depuis le lien fourni par EAS
2. Partagez l'APK avec les utilisateurs
3. Les utilisateurs activent "Sources inconnues" dans les paramètres Android
4. Installation directe depuis le fichier APK

#### B. Build App Bundle (AAB) pour Google Play Store

```bash
cd mobile
eas build --platform android --profile production
```

Le profil `production` génère automatiquement un AAB pour Google Play.

**Avantages :**
- ✅ Distribution via Google Play Store
- ✅ Mises à jour automatiques
- ✅ Taille optimisée par architecture
- ✅ Gestion des versions automatique

### 2️⃣ **Build Local Release** (Pour tests internes)

```bash
cd mobile
.\build-local-with-env.ps1 release
```

**APK généré :**
- Chemin : `android\app\build\outputs\apk\release\app-release.apk`
- Taille : ~30-40 MB
- Signé avec votre keystore local

**Partage :**
- Envoyez l'APK par email, cloud (Google Drive, Dropbox), ou USB
- Les utilisateurs installent directement

### 3️⃣ **EAS Update (Over-The-Air Updates)** (Pour mises à jour rapides)

Permet de mettre à jour l'application sans rebuild complet.

```bash
# Publier une mise à jour
eas update --branch production --message "Nouvelle fonctionnalité"
```

**Avantages :**
- ✅ Mises à jour instantanées
- ✅ Pas besoin de rebuild
- ✅ Les utilisateurs reçoivent les mises à jour automatiquement

## 📋 Étapes Détaillées pour Distribution

### Option A : Distribution Directe (APK)

#### Étape 1 : Build de Production

```bash
cd mobile
eas build --platform android --profile production
```

#### Étape 2 : Télécharger l'APK

Une fois le build terminé :
1. EAS vous fournira un lien de téléchargement
2. Téléchargez l'APK
3. Partagez-le avec vos utilisateurs

#### Étape 3 : Installation par les Utilisateurs

**Sur Android :**
1. Ouvrir les paramètres → Sécurité
2. Activer "Sources inconnues" ou "Installer des applications inconnues"
3. Ouvrir le fichier APK téléchargé
4. Suivre les instructions d'installation

### Option B : Google Play Store

#### Étape 1 : Build App Bundle

```bash
cd mobile
eas build --platform android --profile production
```

#### Étape 2 : Soumettre à Google Play

```bash
eas submit --platform android
```

Ou manuellement :
1. Connectez-vous à [Google Play Console](https://play.google.com/console)
2. Créez une nouvelle application
3. Téléversez le fichier AAB généré
4. Remplissez les informations (description, captures d'écran, etc.)
5. Soumettez pour révision

### Option C : Distribution Interne (Test)

#### Étape 1 : Build Local Release

```bash
cd mobile
.\build-local-with-env.ps1 release
```

#### Étape 2 : Partager l'APK

**Méthodes de partage :**
- **Email** : Envoyez l'APK en pièce jointe
- **Cloud Storage** : Google Drive, Dropbox, OneDrive
- **USB** : Copiez directement sur le téléphone
- **QR Code** : Générez un QR code pointant vers l'APK hébergé en ligne

## 🔧 Configuration pour Distribution

### Variables d'Environnement

Les variables d'environnement sont déjà configurées dans :
- `eas.json` (pour EAS Build)
- `.env` (pour build local)

### Version et Build Number

Mettez à jour dans `app.config.js` :

```javascript
expo: {
    version: "1.0.0",  // Version visible par l'utilisateur
    android: {
        versionCode: 1  // Numéro de build (incrémentez à chaque build)
    }
}
```

### Signature (Keystore)

EAS gère automatiquement le keystore pour les builds cloud.

Pour les builds locaux, vous devez configurer un keystore :

```bash
cd mobile/android
keytool -genkeypair -v -storetype PKCS12 -keystore my-release-key.keystore -alias my-key-alias -keyalg RSA -keysize 2048 -validity 10000
```

Puis configurez dans `android/app/build.gradle`.

## 📊 Comparaison des Options

| Option | Taille | Distribution | Mises à jour | Complexité |
|-------|--------|-------------|--------------|------------|
| **APK EAS** | 30-40 MB | Directe | Manuelle | ⭐⭐ |
| **AAB Google Play** | 20-30 MB | Store | Automatique | ⭐⭐⭐ |
| **APK Local** | 30-40 MB | Directe | Manuelle | ⭐ |
| **EAS Update** | Variable | OTA | Automatique | ⭐⭐ |

## 🚀 Recommandation pour Démarrage Rapide

**Pour partager rapidement avec quelques utilisateurs :**

1. **Build local release :**
   ```bash
   cd mobile
   .\build-local-with-env.ps1 release
   ```

2. **Partager l'APK :**
   - Upload sur Google Drive / Dropbox
   - Créer un lien de partage
   - Envoyer le lien aux utilisateurs

3. **Pour distribution à grande échelle :**
   - Utiliser EAS Build (production)
   - Soumettre à Google Play Store

## ⚠️ Notes Importantes

1. **Sécurité** : Les APK signés sont nécessaires pour les mises à jour
2. **Version** : Incrémentez le `versionCode` à chaque nouveau build
3. **Variables d'environnement** : Vérifiez qu'elles sont correctes pour la production
4. **Test** : Testez toujours l'APK avant de le distribuer

## 📝 Checklist avant Distribution

- [ ] Variables d'environnement configurées (production)
- [ ] Version et build number mis à jour
- [ ] Application testée sur plusieurs appareils
- [ ] APK signé correctement
- [ ] Taille de l'APK acceptable (< 100 MB)
- [ ] Permissions Android documentées
- [ ] Politique de confidentialité (si nécessaire)

## 🔗 Liens Utiles

- [EAS Build Documentation](https://docs.expo.dev/build/introduction/)
- [EAS Submit Documentation](https://docs.expo.dev/submit/introduction/)
- [Google Play Console](https://play.google.com/console)

