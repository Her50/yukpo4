# 🍎 Guide de Publication sur l’App Store (iOS)

Ce guide explique comment publier l’application Yukpomnang sur l’App Store via **Expo EAS Build**.

## 📋 Prérequis

### 1) Compte Apple Developer
- Un compte **Apple Developer Program** actif (payant).
- Accès à **App Store Connect**.

### 2) Identifiants iOS
Dans `mobile/app.config.js` :
- `ios.bundleIdentifier`: `com.yukpomnang.mobile`

Assurez-vous que ce **Bundle ID** existe dans Apple Developer (Identifiers).

### 3) (Recommandé) App Store Connect API Key
Pour automatiser la soumission, créez une **API Key** dans App Store Connect (Users and Access → Keys).
EAS peut aussi guider l’authentification si vous ne l’avez pas.

## 🚀 Étapes de Publication

### Étape 1 : Login Expo

```bash
cd mobile
npm install
npm install -g eas-cli
eas login
```

### Étape 2 : Build iOS (cloud)

```bash
cd mobile
npx eas build --platform ios --profile production
```

À la fin, EAS fournit un lien vers l’artefact iOS (IPA) et le détail du build sur le dashboard.

### Étape 3 : Soumission App Store Connect

```bash
cd mobile
npx eas submit --platform ios --profile production
```

Si c’est la première fois, EAS vous demandera les infos nécessaires (App Store Connect / API Key).

## ✅ Checklist App Store (à ne pas oublier)
- Fiche App Store complète (nom, description, mots-clés)
- Icône / screenshots iPhone (et iPad si support)
- Privacy Policy URL (obligatoire si collecte de données)
- App Privacy (questionnaire) rempli dans App Store Connect
- Review notes + compte de démo si nécessaire

## 🧩 Dépannage rapide
- **“Bundle Identifier not found”** : créer/activer le Bundle ID côté Apple Developer, vérifier `ios.bundleIdentifier`.
- **“Missing compliance”** : répondre au questionnaire export compliance dans App Store Connect.


