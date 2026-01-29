# 🚀 Guide Étape par Étape - Publication Testing (Play Store + App Store)

**Objectif** : Publier ton app en mode testing avec des **liens partageables** pour que les testeurs installent directement depuis Play Store / TestFlight (plus besoin d'envoyer des APK).

---

## 📋 ÉTAPE 0 : Vérification des Prérequis

### ✅ Comptes nécessaires

1. **Google Play Console** (Android)
   - **Lien** : https://play.google.com/console/
   - **Coût** : 25$ USD (paiement unique à vie)
   - **Création** : https://play.google.com/console/signup
   - **Vérification** : Tu dois pouvoir te connecter et voir le tableau de bord

2. **Apple Developer** (iOS)
   - **Lien** : https://developer.apple.com/account/
   - **Coût** : 99$ USD/an
   - **Vérification** : Tu dois avoir un compte actif

3. **App Store Connect** (iOS - TestFlight)
   - **Lien** : https://appstoreconnect.apple.com/
   - **Vérification** : Tu dois pouvoir te connecter avec ton Apple ID

4. **Expo/EAS** (déjà configuré)
   - **Compte** : `hernandezlele`
   - **Vérification** : Lance `eas whoami` dans le dossier `mobile/`

### ✅ Vérification locale

Ouvre PowerShell dans le dossier `mobile/` et lance :

```powershell
powershell -ExecutionPolicy Bypass -File .\verif-eas.ps1
```

**Si tu n'es pas connecté à EAS** :
```powershell
eas login
```
(Utilise le compte : `hernandezlele`)

---

## 📱 PARTIE 1 : ANDROID (Google Play Store)

### ÉTAPE 1.1 : Créer l'application dans Play Console (1ère fois seulement)

1. **Va sur** : https://play.google.com/console/
2. **Clique sur** : "Créer une application" (ou "Create app")
3. **Remplis** :
   - **Nom de l'application** : `Yukpomnang`
   - **Langue par défaut** : Français (ou celle de ton choix)
   - **Type d'application** : Application
   - **Gratuit ou payant** : Gratuit
   - **Coche** : "Je déclare que..." → **Créer**

4. **Important** : Note le **Package name** (doit être `com.yukpomnang.mobile`)

### ÉTAPE 1.2 : Configurer la fiche de l'application (minimum requis)

1. Dans Play Console → **Yukpomnang** → **Fiche de l'application** (ou "Store listing")

2. **Remplis les champs obligatoires** :
   - **Titre** : `Yukpomnang` (50 caractères max)
   - **Description courte** : Une phrase de 80 caractères max
   - **Description complète** : Description détaillée (4000 caractères max)
   - **Icône** : 512x512 px (fichier : `mobile/assets/icon.png`)
   - **Captures d'écran** : Minimum 2 (recommandé 8)
   - **Graphique de fonctionnalité** : 1024x500 px (optionnel mais recommandé)

3. **Contenu de l'application** :
   - **Catégorie** : Choisis (ex: "Shopping", "Services", etc.)
   - **Classification du contenu** : Remplis le questionnaire
   - **Politique de confidentialité** : URL obligatoire (ex: `https://yukpomnang.com/privacy`)

4. **Prix et distribution** :
   - **Pays/territoires** : Sélectionne les pays où tu veux distribuer
   - **Gratuit** : Coche "Gratuit"

5. **Enregistre** : Clique sur "Enregistrer" en bas de page

### ÉTAPE 1.3 : Build cloud Android (AAB)

1. **Ouvre PowerShell** dans le dossier `mobile/`

2. **Lance le build** :
```powershell
npx eas build --platform android --profile production
```

3. **Pendant le build** :
   - Tu verras un lien comme : `https://expo.dev/accounts/hernandezlele/projects/yukpomnang-mobile/builds/xxxxx`
   - **Durée** : ~15-25 minutes
   - Tu peux suivre la progression en temps réel

4. **Une fois terminé** :
   - Le build génère un fichier **`.aab`** (Android App Bundle)
   - Tu peux le télécharger depuis le dashboard EAS si besoin

### ÉTAPE 1.4 : Soumettre l'AAB sur Play Console

#### Option A : Automatique (si tu as configuré le Service Account)

Si tu as déjà placé `mobile/google-service-account.json` :

```powershell
npx eas submit --platform android --profile production
```

Cette commande upload automatiquement l'AAB sur la piste **"Internal testing"**.

#### Option B : Manuel (1ère fois ou si pas de Service Account)

1. **Télécharge l'AAB** depuis le dashboard EAS :
   - Va sur : https://expo.dev/accounts/hernandezlele/projects/yukpomnang-mobile/builds
   - Clique sur le dernier build Android (production)
   - Télécharge le fichier `.aab`

2. **Dans Play Console** :
   - Va sur : https://play.google.com/console/
   - Sélectionne **Yukpomnang**
   - Menu gauche → **Testing** → **Internal testing**
   - Clique sur **"Créer une version"** (ou "Create release")

3. **Upload l'AAB** :
   - Clique sur **"Télécharger"** (ou "Upload")
   - Sélectionne le fichier `.aab` téléchargé
   - **Notes de version** : Ex: "Version 1.0.0 - Test initial"
   - Clique sur **"Enregistrer"**

4. **Publier** :
   - Clique sur **"Examiner la version"** (ou "Review release")
   - Vérifie les informations
   - Clique sur **"Publier"** (ou "Publish")

### ÉTAPE 1.5 : Activer le lien partageable (Closed Testing)

**Pour obtenir un lien partageable**, tu dois utiliser **Closed testing** ou **Open testing** (pas Internal testing).

1. **Dans Play Console** :
   - Menu gauche → **Testing** → **Closed testing** (ou **Open testing**)

2. **Créer une version** :
   - Clique sur **"Créer une version"**
   - Upload le même `.aab` que pour Internal testing
   - **Notes de version** : Ex: "Version 1.0.0 - Test fermé"
   - Clique sur **"Enregistrer"** puis **"Publier"**

3. **Obtenir le lien opt-in** :
   - Dans **Closed testing** (ou Open testing), va dans **"Testeurs"** (ou "Testers")
   - Clique sur **"Créer une liste"** (ou "Create list") si tu veux une liste spécifique
   - Ou utilise **"Lien d'inscription"** (ou "Opt-in link")
   - **Copie le lien** : Il ressemble à :
     ```
     https://play.google.com/apps/internet/test/xxxxxxxxxxxxx
     ```

4. **Partager le lien** :
   - Envoie ce lien aux testeurs
   - Ils cliquent dessus → s'inscrivent → peuvent installer depuis Play Store

---

## 🍎 PARTIE 2 : iOS (App Store / TestFlight)

### ÉTAPE 2.1 : Créer l'application dans App Store Connect (1ère fois seulement)

1. **Va sur** : https://appstoreconnect.apple.com/
2. **Clique sur** : **"Mes apps"** (ou "My Apps") → **"+"** → **"Nouvelle app"** (ou "New App")

3. **Remplis** :
   - **Plateforme** : iOS
   - **Nom** : `Yukpomnang`
   - **Langue principale** : Français (ou celle de ton choix)
   - **Bundle ID** : `com.yukpomnang.mobile` (doit exister dans Apple Developer)
   - **SKU** : `yukpomnang-mobile` (identifiant unique, peut être le même que Bundle ID)
   - **Utilisateur** : Sélectionne ton compte

4. **Créer** : Clique sur **"Créer"** (ou "Create")

### ÉTAPE 2.2 : Vérifier le Bundle ID dans Apple Developer

1. **Va sur** : https://developer.apple.com/account/
2. **Certificates, Identifiers & Profiles** → **Identifiers**
3. **Vérifie** que `com.yukpomnang.mobile` existe
4. **Si pas présent** :
   - Clique sur **"+"** → **App IDs** → **App**
   - **Description** : `Yukpomnang Mobile`
   - **Bundle ID** : `com.yukpomnang.mobile` (Explicit)
   - **Capabilities** : Coche ce dont tu as besoin (Push Notifications, etc.)
   - **Enregistrer**

### ÉTAPE 2.3 : Build cloud iOS

1. **Ouvre PowerShell** dans le dossier `mobile/`

2. **Lance le build** :
```powershell
npx eas build --platform ios --profile production
```

3. **Pendant le build** :
   - Tu verras un lien comme : `https://expo.dev/accounts/hernandezlele/projects/yukpomnang-mobile/builds/xxxxx`
   - **Durée** : ~20-30 minutes (iOS prend plus de temps)
   - Tu peux suivre la progression en temps réel

4. **Une fois terminé** :
   - Le build génère un fichier **`.ipa`** (iOS App)
   - EAS peut le soumettre automatiquement à TestFlight

### ÉTAPE 2.4 : Soumettre sur TestFlight

#### Option A : Automatique (si configuré)

```powershell
npx eas submit --platform ios --profile production
```

Cette commande peut demander :
- **Apple ID** et **mot de passe** (ou App-Specific Password)
- Ou une **clé API** (App Store Connect API Key)

#### Option B : Manuel (via App Store Connect)

1. **Télécharge l'IPA** depuis le dashboard EAS (si besoin)

2. **Dans App Store Connect** :
   - Va sur : https://appstoreconnect.apple.com/
   - Sélectionne **Yukpomnang**
   - Menu **TestFlight**
   - Clique sur **"+"** pour ajouter une build
   - Upload l'IPA (ou utilise Xcode/Transporter)

### ÉTAPE 2.5 : Activer le lien public TestFlight

1. **Dans App Store Connect** :
   - Sélectionne **Yukpomnang** → **TestFlight**

2. **External Testing** (pour un lien public) :
   - Va dans **"Testeurs externes"** (ou "External Testers")
   - Clique sur **"+"** → **"Créer un groupe"** (ou "Create group")
   - **Nom** : Ex: "Beta Testers"
   - **Ajoute la build** : Sélectionne la version que tu veux tester
   - **Informations de test** : Remplis (description, notes, etc.)

3. **Beta App Review** (1ère fois) :
   - Apple va examiner l'app (généralement rapide, quelques heures)
   - Une fois approuvé, tu peux activer le lien public

4. **Créer le lien public** :
   - Dans **TestFlight** → **"Liens publics"** (ou "Public Links")
   - Clique sur **"Créer un lien"** (ou "Create link")
   - **Nom** : Ex: "Yukpomnang Beta"
   - **Groupe** : Sélectionne le groupe créé
   - **Copie le lien** : Il ressemble à :
     ```
     https://testflight.apple.com/join/xxxxxxxx
     ```

5. **Partager le lien** :
   - Envoie ce lien aux testeurs
   - Ils cliquent dessus → s'inscrivent → peuvent installer depuis TestFlight

---

## 🎯 RÉCAPITULATIF : Commandes Rapides

### Vérification avant de commencer
```powershell
cd mobile
powershell -ExecutionPolicy Bypass -File .\verif-eas.ps1
eas login  # Si pas connecté
```

### Build + Submit automatique (tout en un)
```powershell
cd mobile
powershell -ExecutionPolicy Bypass -File .\publish-testing-links.ps1
```

### Build séparé
```powershell
# Android
npx eas build --platform android --profile production
npx eas submit --platform android --profile production

# iOS
npx eas build --platform ios --profile production
npx eas submit --platform ios --profile production
```

---

## 🔗 Liens Utiles

### Connexion
- **Google Play Console** : https://play.google.com/console/
- **Apple Developer** : https://developer.apple.com/account/
- **App Store Connect** : https://appstoreconnect.apple.com/
- **Expo Dashboard** : https://expo.dev/accounts/hernandezlele/projects/yukpomnang-mobile/builds

### Documentation
- **EAS Build** : https://docs.expo.dev/build/introduction/
- **EAS Submit** : https://docs.expo.dev/submit/introduction/
- **Play Console Help** : https://support.google.com/googleplay/android-developer
- **App Store Connect Help** : https://help.apple.com/app-store-connect/

---

## ⚠️ Checklist Finale

Avant de partager les liens, vérifie :

### Android
- [ ] Application créée dans Play Console
- [ ] Fiche de l'application complète (titre, description, icône, captures)
- [ ] Build AAB réussi
- [ ] Version publiée sur Closed/Open testing
- [ ] Lien opt-in copié et testé

### iOS
- [ ] Application créée dans App Store Connect
- [ ] Bundle ID configuré dans Apple Developer
- [ ] Build iOS réussi
- [ ] Build soumis sur TestFlight
- [ ] Beta App Review approuvée (si External testers)
- [ ] Lien public TestFlight créé et testé

---

## 🆘 Dépannage

### "EAS CLI not found"
```powershell
npm install -g eas-cli
```

### "Not logged in"
```powershell
eas login
```

### "Build failed"
- Vérifie les logs sur https://expo.dev
- Vérifie que toutes les variables d'environnement sont correctes dans `eas.json`
- Vérifie que les assets (icône, splash) existent

### "Submit failed - Authentication"
- **Android** : Vérifie que `google-service-account.json` existe et est valide
- **iOS** : Vérifie tes identifiants Apple ou configure une clé API App Store Connect

### "Lien opt-in ne fonctionne pas"
- Vérifie que la version est bien **publiée** (pas juste enregistrée)
- Vérifie que tu utilises **Closed testing** ou **Open testing** (pas Internal)

### "TestFlight link ne fonctionne pas"
- Vérifie que la **Beta App Review** est approuvée (pour External testers)
- Vérifie que le groupe de testeurs est bien configuré avec la build

---

**Bon courage ! 🚀**

Une fois les liens obtenus, tu peux les partager directement aux testeurs. Plus besoin d'envoyer d'APK !



