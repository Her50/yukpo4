# 🔗 Publier pour tests via liens (Play Store + TestFlight)

Objectif : **ne plus envoyer d’APK**. Les testeurs installent via des **liens officiels**.

## ✅ Liens de connexion (iOS / Apple)
- Apple Developer (identifiants, bundle id, certificats) : `https://developer.apple.com/account/`
- App Store Connect (TestFlight) : `https://appstoreconnect.apple.com/`

## ✅ Lien de connexion (Android / Google)
- Google Play Console : `https://play.google.com/console/`

## 🚀 Automatisation (1 commande)

Le script ci-dessous lance :
- Android : **build AAB** + **submit** (track `internal` par défaut via `eas.json`)
- iOS : **build** + **submit** (TestFlight)

```powershell
cd mobile
powershell -ExecutionPolicy Bypass -File .\publish-testing-links.ps1
```

> Important : `eas login` reste nécessaire (c’est un login, donc pas automatisable à 100%).

## 🔗 Obtenir un lien partageable à donner aux testeurs

### Android (Play Store)
Pour un **lien partageable**, privilégie :
- **Closed testing** (recommandé) → tu obtiens un **opt‑in link**
- ou **Open testing** → plus ouvert

Chemin : Play Console → **Testing** → **Closed testing** (ou Open) → **Opt‑in link**

### iOS (TestFlight)
Chemin : App Store Connect → **TestFlight** → **Testers** → **Public Links** → Create link

Notes :
- “Internal testers” : rapide
- “External testers” : peut exiger une **Beta App Review** (surtout la première fois)

## 🔐 Service Account Play (soumission automatique)
Si tu veux que `eas submit` upload automatiquement sur Play :
- place le fichier en local : `mobile/google-service-account.json`
- **ne pas commiter** (déjà ignoré dans `mobile/.gitignore`)


