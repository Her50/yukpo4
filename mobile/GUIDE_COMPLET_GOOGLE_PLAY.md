# 📱 Guide Complet : Publier Yukpomnang sur Google Play Store

## 📋 Table des matières
1. [Créer un compte Google Play Developer (25$)](##-étape-1-créer-un-compte-google-play-developer)
2. [Créer un Service Account](##-étape-2-créer-un-service-account)
3. [Configurer les credentials EAS](##-étape-3-configurer-les-credentials-eas)
4. [Soumettre l'application](##-étape-4-soumettre-lapplication)

---

## 🎯 ÉTAPE 1 : Créer un compte Google Play Developer (25$)

### 1.1 Accéder à Google Play Console

**🔗 Lien direct :** https://play.google.com/console/signup

1. Ouvrez votre navigateur et allez sur : **https://play.google.com/console/signup**
2. Connectez-vous avec votre compte Google (ou créez-en un si nécessaire)

### 1.2 Créer le compte développeur

1. Cliquez sur **"Créer un compte"** ou **"Get started"**
2. Remplissez le formulaire :
   - **Nom du compte développeur** : `Yukpomnang` (ou votre nom)
   - **Email** : Votre email Google
   - **Numéro de téléphone** : Votre numéro (pour vérification)
   - **Pays/Région** : Sélectionnez votre pays

### 1.3 Accepter les conditions

1. Lisez et acceptez le **Contrat de distribution Google Play**
2. Cochez toutes les cases d'acceptation
3. Cliquez sur **"Créer un compte"** ou **"Pay registration fee"**

### 1.4 Payer les frais d'inscription (25$)

**💳 Méthodes de paiement acceptées :**
- Carte de crédit (Visa, Mastercard, American Express)
- Carte de débit
- PayPal (dans certains pays)

**📝 Processus de paiement :**

1. **Page de paiement** : Google vous redirige vers la page de paiement
2. **Entrez vos informations de paiement** :
   - Numéro de carte
   - Date d'expiration
   - CVV
   - Nom sur la carte
   - Adresse de facturation
3. **Vérifiez le montant** : 25$ USD (ou équivalent en votre devise)
4. **Confirmez le paiement** : Cliquez sur **"Payer"** ou **"Submit"**

**⏱️ Délai d'activation :**
- Le paiement est généralement traité immédiatement
- Votre compte est activé dans les 24-48 heures (parfois instantané)
- Vous recevrez un email de confirmation

**🔗 Lien direct paiement :** https://play.google.com/console/signup/checkout

---

## 🔑 ÉTAPE 2 : Créer un Service Account

### 2.1 Accéder à Google Cloud Console

**🔗 Lien direct :** https://console.cloud.google.com/

1. Allez sur : **https://console.cloud.google.com/**
2. Connectez-vous avec le **même compte Google** que Google Play Console
3. Si c'est votre première fois, acceptez les conditions d'utilisation

### 2.2 Créer ou sélectionner un projet

1. En haut à gauche, cliquez sur le **sélecteur de projet**
2. Cliquez sur **"Nouveau projet"** ou **"New Project"**
3. Nommez-le : `Yukpomnang Play Console` (ou similaire)
4. Cliquez sur **"Créer"** ou **"Create"**
5. Attendez quelques secondes, puis sélectionnez ce projet

### 2.3 Activer l'API Google Play Android Developer

**🔗 Lien direct :** https://console.cloud.google.com/apis/library/androidpublisher.googleapis.com

1. Allez sur : **https://console.cloud.google.com/apis/library/androidpublisher.googleapis.com**
2. Assurez-vous que le bon projet est sélectionné (en haut)
3. Cliquez sur **"Activer"** ou **"Enable"**
4. Attendez l'activation (quelques secondes)

### 2.4 Créer un Service Account

**🔗 Lien direct :** https://console.cloud.google.com/iam-admin/serviceaccounts

1. Allez sur : **https://console.cloud.google.com/iam-admin/serviceaccounts**
2. Cliquez sur **"Créer un compte de service"** ou **"Create Service Account"**
3. Remplissez le formulaire :
   - **Nom du compte de service** : `yukpomnang-play-submit`
   - **ID du compte de service** : `yukpomnang-play-submit` (généré automatiquement)
   - **Description** : `Service account pour soumettre des apps sur Google Play`
4. Cliquez sur **"Créer et continuer"** ou **"Create and Continue"**

### 2.5 Attribuer un rôle

1. Dans **"Accorder l'accès à ce compte de service aux utilisateurs"** :
   - Cliquez sur **"Sélectionner un rôle"**
   - Recherchez : `Service Account User`
   - Sélectionnez-le
2. Cliquez sur **"Continuer"** ou **"Continue"**
3. Cliquez sur **"Terminé"** ou **"Done"**

### 2.6 Créer une clé JSON

1. Dans la liste des comptes de service, cliquez sur celui que vous venez de créer
2. Allez dans l'onglet **"Clés"** ou **"Keys"**
3. Cliquez sur **"Ajouter une clé"** → **"Créer une nouvelle clé"** ou **"Add Key"** → **"Create new key"**
4. Sélectionnez **JSON**
5. Cliquez sur **"Créer"** ou **"Create"**
6. **⚠️ IMPORTANT** : Le fichier JSON se télécharge automatiquement. **SAUVEGARDEZ-LE DANS UN ENDROIT SÛR !**

### 2.7 Lier le Service Account à Google Play Console

**🔗 Lien direct :** https://play.google.com/console/developers/service-accounts

1. Allez sur : **https://play.google.com/console/developers/service-accounts**
2. Cliquez sur **"Lier un compte de service"** ou **"Link service account"**
3. Dans la fenêtre qui s'ouvre :
   - **Email du compte de service** : Copiez l'email du service account (format : `yukpomnang-play-submit@votre-projet.iam.gserviceaccount.com`)
   - Collez-le dans le champ
4. Cliquez sur **"Lier"** ou **"Link"**

### 2.8 Accorder les permissions dans Google Play Console

1. Retournez sur : **https://play.google.com/console/developers/service-accounts**
2. Trouvez votre service account dans la liste
3. Cliquez sur les **3 points** (menu) à droite
4. Cliquez sur **"Gérer les autorisations"** ou **"Manage permissions"**
5. Cochez **"Gérer les versions de production"** ou **"Manage production releases"**
6. Cochez **"Gérer les versions de test"** ou **"Manage test releases"**
7. Cliquez sur **"Enregistrer"** ou **"Save"**

---

## ⚙️ ÉTAPE 3 : Configurer les credentials EAS

### 3.1 Placer le fichier JSON dans le projet

1. **Renommez** le fichier JSON téléchargé en : `google-service-account.json`
2. **Placez-le** dans le dossier `mobile/` (à la racine du projet mobile)
3. **Vérifiez** que le chemin est : `mobile/google-service-account.json`

### 3.2 Vérifier la configuration EAS

Le fichier `eas.json` est déjà configuré avec :
```json
"submit": {
  "production": {
    "android": {
      "track": "internal",
      "serviceAccountKeyPath": "./google-service-account.json"
    }
  }
}
```

✅ **C'est déjà bon !** Assurez-vous juste que le fichier `google-service-account.json` est bien dans `mobile/`.

### 3.3 Ajouter au .gitignore (SÉCURITÉ)

**⚠️ IMPORTANT** : Ne commitez JAMAIS le fichier JSON dans Git !

Vérifiez que `mobile/.gitignore` contient :
```
google-service-account.json
*.json
!package.json
!package-lock.json
!tsconfig.json
!app.config.js
```

---

## 🚀 ÉTAPE 4 : Soumettre l'application

### 4.1 Créer l'application dans Google Play Console

**🔗 Lien direct :** https://play.google.com/console/u/0/developers/create-app

1. Allez sur : **https://play.google.com/console/u/0/developers/create-app**
2. Remplissez le formulaire :
   - **Nom de l'application** : `Yukpomnang`
   - **Langue par défaut** : `Français (France)` ou votre langue
   - **Type d'application** : `Application`
   - **Gratuit ou payant** : `Gratuit` (ou payant si vous voulez)
3. Cochez les cases d'acceptation
4. Cliquez sur **"Créer l'application"** ou **"Create app"**

### 4.2 Remplir les informations de l'application

**🔗 Lien direct (après création) :** https://play.google.com/console/u/0/developers/apps

1. Cliquez sur votre application **"Yukpomnang"**
2. Allez dans **"Présentation de la boutique"** ou **"Store listing"**
3. Remplissez les informations obligatoires :
   - **Description courte** (80 caractères max)
   - **Description complète** (4000 caractères max)
   - **Icône de l'application** (512x512 px)
   - **Capture d'écran** (au moins 2, max 8)
   - **Graphique de fonctionnalité** (1024x500 px) - optionnel mais recommandé
   - **Catégorie** : Sélectionnez la catégorie appropriée
   - **Contact** : Email de contact
   - **Politique de confidentialité** : URL de votre politique

### 4.3 Configurer le contenu de l'application

1. Allez dans **"Contenu de l'application"** ou **"App content"**
2. Remplissez :
   - **Politique de confidentialité** : URL requise
   - **Cible d'âge** : Sélectionnez la tranche d'âge
   - **Questionnaire sur les données** : Répondez aux questions

### 4.4 Soumettre avec EAS (Méthode automatique)

Une fois le fichier `google-service-account.json` en place :

```powershell
cd C:\Users\23767\yukpomnang2\mobile
npx eas submit --platform android --profile production
```

EAS va :
1. Télécharger automatiquement le dernier build AAB
2. Le soumettre à Google Play Console
3. Le placer dans la piste "internal" (tests internes)

### 4.5 Soumettre manuellement (Alternative)

Si vous préférez soumettre manuellement :

1. **Téléchargez l'AAB** :
   ```powershell
   cd C:\Users\23767\yukpomnang2\mobile
   Invoke-WebRequest -Uri "https://expo.dev/artifacts/eas/wGBY6A44e7qr9ht7JhwrYQ.aab" -OutFile "app-release.aab"
   ```

2. **Allez sur Google Play Console** :
   - **🔗 Lien direct :** https://play.google.com/console/u/0/developers/apps
   - Cliquez sur votre application
   - Allez dans **"Production"** ou **"Tests internes"**

3. **Créer une nouvelle version** :
   - Cliquez sur **"Créer une nouvelle version"** ou **"Create new release"**
   - Cliquez sur **"Upload"** dans la section "App bundles et APK"
   - Sélectionnez le fichier `app-release.aab`
   - Attendez la validation (quelques minutes)

4. **Remplir les notes de version** :
   - Ajoutez les notes de version (ce qui a changé)
   - Cliquez sur **"Enregistrer"**

5. **Publier** :
   - Cliquez sur **"Review release"**
   - Vérifiez toutes les informations
   - Cliquez sur **"Start rollout to Production"** (ou votre piste)

---

## 📝 Checklist finale

Avant de publier, vérifiez :

- [ ] Compte Google Play Developer créé et payé (25$)
- [ ] Service Account créé et lié à Google Play Console
- [ ] Fichier `google-service-account.json` dans `mobile/`
- [ ] Application créée dans Google Play Console
- [ ] Informations de présentation remplies (description, icône, captures)
- [ ] Politique de confidentialité ajoutée
- [ ] AAB téléchargé ou soumis via EAS
- [ ] Version créée et prête à être publiée

---

## 🔗 Liens utiles

- **Google Play Console** : https://play.google.com/console
- **Créer une application** : https://play.google.com/console/u/0/developers/create-app
- **Service Accounts** : https://play.google.com/console/developers/service-accounts
- **Google Cloud Console** : https://console.cloud.google.com/
- **Documentation EAS Submit** : https://docs.expo.dev/submit/android/

---

## ❓ Problèmes courants

### Erreur : "Service account not found"
→ Vérifiez que le service account est bien lié dans Google Play Console

### Erreur : "Insufficient permissions"
→ Vérifiez que les permissions sont accordées dans Google Play Console (étape 2.8)

### Erreur : "App not found"
→ Créez d'abord l'application dans Google Play Console (étape 4.1)

### Le fichier JSON ne se télécharge pas
→ Utilisez Chrome ou Firefox, désactivez les bloqueurs de popups

---

## 💡 Astuce

Pour tester avant la production, utilisez la piste **"Tests internes"** :
- Plus rapide à publier
- Permet de tester avec un groupe restreint
- Pas besoin de remplir toutes les informations de présentation

Une fois que tout fonctionne, vous pouvez promouvoir vers "Production".

