# 🚀 Étapes suivantes : Vous êtes dans Google Play Console

## ✅ Étape 1 : Créer votre application

**🔗 Lien direct :** https://play.google.com/console/u/0/developers/create-app

1. Cliquez sur le lien ci-dessus ou sur **"Créer une application"** dans la console
2. Remplissez le formulaire :
   - **Nom de l'application** : `Yukpomnang`
   - **Langue par défaut** : `Français (France)` (ou votre langue)
   - **Type d'application** : Sélectionnez **"Application"**
   - **Gratuit ou payant** : Sélectionnez **"Gratuit"** (ou payant si vous voulez)
3. Cochez les cases d'acceptation
4. Cliquez sur **"Créer l'application"**

---

## 📦 Étape 2 : Soumettre votre AAB

Vous avez deux options :

### Option A : Soumission automatique avec EAS (Recommandé)

**Prérequis :** Avoir le fichier `google-service-account.json` configuré

1. **Vérifiez que vous avez le fichier** :
   ```powershell
   cd C:\Users\23767\yukpomnang2\mobile
   Test-Path "google-service-account.json"
   ```

2. **Si le fichier existe**, soumettez automatiquement :
   ```powershell
   npx eas submit --platform android --profile production
   ```

3. EAS va :
   - Télécharger automatiquement votre dernier build AAB
   - Le soumettre à Google Play Console
   - Le placer dans la piste "internal" (tests internes)

### Option B : Soumission manuelle

1. **Téléchargez l'AAB** :
   ```powershell
   cd C:\Users\23767\yukpomnang2\mobile
   Invoke-WebRequest -Uri "https://expo.dev/artifacts/eas/wGBY6A44e7qr9ht7JhwrYQ.aab" -OutFile "app-release.aab"
   ```

2. **Dans Google Play Console** :
   - **🔗 Lien direct :** https://play.google.com/console/u/0/developers/apps
   - Cliquez sur votre application **"Yukpomnang"**
   - Dans le menu de gauche, allez dans **"Production"** ou **"Tests internes"**
   - Cliquez sur **"Créer une nouvelle version"** ou **"Create new release"**

3. **Uploader l'AAB** :
   - Dans la section **"App bundles et APK"**, cliquez sur **"Upload"**
   - Sélectionnez le fichier `app-release.aab`
   - Attendez la validation (quelques minutes)

4. **Remplir les notes de version** :
   - Ajoutez les notes de version (ex: "Première version de Yukpomnang")
   - Cliquez sur **"Enregistrer"** ou **"Save"**

5. **Publier** :
   - Cliquez sur **"Review release"** ou **"Réviser la version"**
   - Vérifiez toutes les informations
   - Cliquez sur **"Start rollout to Production"** (ou votre piste)

---

## ⚙️ Étape 3 : Configurer le Service Account (Pour soumission automatique)

Si vous voulez utiliser la soumission automatique avec EAS, vous devez configurer un Service Account :

### 3.1 Créer le Service Account

**🔗 Lien direct :** https://console.cloud.google.com/iam-admin/serviceaccounts

1. Allez sur Google Cloud Console
2. Créez un projet (ou sélectionnez-en un existant)
3. Activez l'API "Google Play Android Developer"
4. Créez un Service Account
5. Téléchargez le fichier JSON

### 3.2 Lier à Google Play Console

**🔗 Lien direct :** https://play.google.com/console/developers/service-accounts

1. Allez sur le lien ci-dessus
2. Cliquez sur **"Lier un compte de service"**
3. Collez l'email du Service Account
4. Accordez les permissions nécessaires

### 3.3 Placer le fichier JSON

1. Renommez le fichier téléchargé en : `google-service-account.json`
2. Placez-le dans : `mobile/google-service-account.json`

**📖 Guide complet :** Consultez `GUIDE_COMPLET_GOOGLE_PLAY.md` section "ÉTAPE 2"

---

## 📝 Étape 4 : Remplir les informations de l'application

Avant de publier en production, vous devez remplir certaines informations :

**🔗 Lien direct (après création de l'app) :** https://play.google.com/console/u/0/developers/apps

1. **Présentation de la boutique** :
   - Description courte (80 caractères max)
   - Description complète (4000 caractères max)
   - Icône de l'application (512x512 px)
   - Captures d'écran (au moins 2, max 8)
   - Catégorie
   - Contact

2. **Contenu de l'application** :
   - Politique de confidentialité (URL requise)
   - Cible d'âge
   - Questionnaire sur les données

**💡 Astuce :** Pour les tests internes, vous n'avez pas besoin de remplir toutes ces informations. Vous pouvez les ajouter plus tard avant la publication en production.

---

## 🎯 Actions immédiates

### Si vous voulez tester rapidement :

1. **Créez l'application** (étape 1)
2. **Soumettez l'AAB manuellement** dans "Tests internes" (étape 2, option B)
3. **Remplissez les notes de version**
4. **Publiez en tests internes**

Vous pourrez tester l'app sans remplir toutes les informations de présentation.

### Si vous voulez la soumission automatique :

1. **Configurez le Service Account** (étape 3)
2. **Placez le fichier JSON** dans `mobile/`
3. **Utilisez EAS submit** (étape 2, option A)

---

## 🔗 Liens utiles

- **Créer application** : https://play.google.com/console/u/0/developers/create-app
- **Mes applications** : https://play.google.com/console/u/0/developers/apps
- **Service Accounts** : https://play.google.com/console/developers/service-accounts
- **Google Cloud Console** : https://console.cloud.google.com/

---

## ❓ Besoin d'aide ?

- **Guide complet** : `GUIDE_COMPLET_GOOGLE_PLAY.md`
- **Guide D-U-N-S** : `GUIDE_NUMERO_DUNS.md`
- **Support Google Play** : https://support.google.com/googleplay/android-developer

