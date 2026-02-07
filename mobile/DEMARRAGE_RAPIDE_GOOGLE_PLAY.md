# 🚀 Démarrage Rapide : Publier sur Google Play Store

## ⚡ Résumé en 4 étapes

### 1️⃣ Créer le compte (25$)
**🔗 Lien :** https://play.google.com/console/signup
- Créez un compte Google Play Developer
- Payez les 25$ (carte bancaire acceptée)
- ⏱️ Activation : 24-48h (parfois instantané)

### 2️⃣ Créer le Service Account
**🔗 Lien :** https://console.cloud.google.com/iam-admin/serviceaccounts
- Créez un projet Google Cloud
- Activez l'API "Google Play Android Developer"
- Créez un Service Account
- Téléchargez le fichier JSON
- Liez-le à Google Play Console

### 3️⃣ Placer le fichier JSON
- Renommez le fichier téléchargé en : `google-service-account.json`
- Placez-le dans : `mobile/google-service-account.json`
- ✅ Le fichier est déjà dans `.gitignore` (sécurisé)

### 4️⃣ Soumettre l'app
```powershell
cd C:\Users\23767\yukpomnang2\mobile
npx eas submit --platform android --profile production
```

---

## 📖 Guide complet

Pour les détails pas à pas, consultez : **`GUIDE_COMPLET_GOOGLE_PLAY.md`**

---

## 🔗 Liens directs

- **Créer compte (25$)** : https://play.google.com/console/signup
- **Google Cloud Console** : https://console.cloud.google.com/
- **Service Accounts** : https://console.cloud.google.com/iam-admin/serviceaccounts
- **Lier Service Account** : https://play.google.com/console/developers/service-accounts
- **Créer application** : https://play.google.com/console/u/0/developers/create-app

---

## ⚠️ Important

- Le fichier `google-service-account.json` est **SENSIBLE** - ne le partagez jamais
- Il est déjà dans `.gitignore` - ne sera pas commité dans Git
- Gardez une copie de sauvegarde dans un endroit sûr

