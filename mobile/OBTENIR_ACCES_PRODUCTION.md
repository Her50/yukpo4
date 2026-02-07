# 🔓 Guide : Obtenir l'accès en production Google Play

## 🎯 Situation actuelle

Vous voyez le message : **"Vous ne disposez pas encore d'un accès en production"**

Cela signifie que vous devez d'abord remplir les informations obligatoires avant de pouvoir publier.

---

## 📋 Étape 1 : Accéder au tableau de bord

**🔗 Lien direct :** https://play.google.com/console/u/0/developers/apps

1. Cliquez sur le bouton **"Accéder au tableau de bord"** (bouton bleu sur la page)
2. Ou allez directement sur : **https://play.google.com/console/u/0/developers/apps**
3. Cliquez sur votre application **"Yukpomnang"**

Le tableau de bord vous montrera toutes les tâches à compléter.

---

## ✅ Étape 2 : Remplir les informations obligatoires

### 2.1 Présentation de la boutique (Store listing)

**🔗 Lien direct (après avoir cliqué sur votre app) :** 
https://play.google.com/console/u/0/developers/apps/[APP_ID]/store-listing

**Informations requises :**

1. **Description courte** (80 caractères max)
   - Exemple : "Yukpomnang - Votre plateforme de services et livraison en Afrique"

2. **Description complète** (4000 caractères max)
   - Décrivez votre application
   - Fonctionnalités principales
   - Avantages pour les utilisateurs

3. **Icône de l'application** (512x512 px, PNG)
   - Format : PNG
   - Taille : 512x512 pixels
   - Fond transparent ou couleur unie

4. **Captures d'écran** (au moins 2, max 8)
   - Format : PNG ou JPG
   - Taille minimale : 320px de hauteur
   - Taille maximale : 3840px de largeur
   - Ratio : 16:9 ou 9:16 recommandé

5. **Graphique de fonctionnalité** (optionnel mais recommandé)
   - Format : PNG ou JPG
   - Taille : 1024x500 pixels
   - Affiche une fonctionnalité principale

6. **Catégorie**
   - Sélectionnez la catégorie appropriée
   - Exemples : "Shopping", "Lifestyle", "Food & Drink", etc.

7. **Email de contact**
   - Email où les utilisateurs peuvent vous contacter

8. **Site web** (optionnel)
   - URL de votre site web

9. **Politique de confidentialité** (URL requise)
   - URL vers votre politique de confidentialité
   - Doit être accessible publiquement
   - Exemple : `https://yukpomnang.com/privacy` ou `https://yukpomnang.com/politique-confidentialite`

### 2.2 Contenu de l'application (App content)

**🔗 Lien direct :** 
https://play.google.com/console/u/0/developers/apps/[APP_ID]/app-content

**Informations requises :**

1. **Politique de confidentialité**
   - URL vers votre politique (déjà rempli dans Store listing)
   - Vérifiez qu'elle est accessible

2. **Cible d'âge**
   - Sélectionnez la tranche d'âge appropriée
   - Exemples : "Tous les âges", "13+", "18+", etc.

3. **Questionnaire sur les données**
   - Répondez aux questions sur la collecte de données
   - Questions sur :
     - Données personnelles collectées
     - Données de localisation
     - Données financières
     - etc.

### 2.3 Intégrité des applis (App integrity)

**🔗 Lien direct :** 
https://play.google.com/console/u/0/developers/apps/[APP_ID]/app-integrity

**Vérifications :**

1. **Signature de l'application**
   - Vérifiez que votre app est signée correctement
   - ✅ Déjà fait si vous avez utilisé EAS Build

2. **Licences Google Play**
   - Acceptez les licences Google Play
   - Généralement automatique

---

## 🚀 Étape 3 : Demander l'accès en production

Une fois toutes les informations remplies :

1. **Retournez dans "Production"**
   - Menu de gauche → **"Production"**

2. **Cliquez sur "Accéder au tableau de bord"**
   - Le tableau de bord vous montrera ce qui reste à faire

3. **Remplissez toutes les tâches**
   - Le tableau de bord liste toutes les tâches incomplètes
   - Complétez-les une par une

4. **Demandez l'accès en production**
   - Une fois tout complété, un bouton apparaîtra pour demander l'accès
   - Cliquez sur **"Demander l'accès en production"**

5. **Attendez la validation**
   - Google vérifie généralement en quelques heures à 48h
   - Vous recevrez un email de confirmation

---

## 💡 Solution rapide : Utiliser Tests fermés (Sans attendre)

Si vous voulez tester **MAINTENANT** sans attendre l'accès production :

### Tests fermés (Plus rapide)

1. **Allez dans "Tests" → "Tests fermés"**
   - **🔗 Lien direct :** https://play.google.com/console/u/0/developers/apps/[APP_ID]/testing/closed

2. **Créez une nouvelle version**
   - Cliquez sur **"Créer une nouvelle version"**

3. **Uploadez votre AAB**
   ```powershell
   cd C:\Users\23767\yukpomnang2\mobile
   Invoke-WebRequest -Uri "https://expo.dev/artifacts/eas/wGBY6A44e7qr9ht7JhwrYQ.aab" -OutFile "app-release.aab"
   ```
   - Cliquez sur **"Upload"** dans "App bundles et APK"
   - Sélectionnez `app-release.aab`

4. **Remplissez les notes de version**
   - Exemple : "Version de test - Données sauvegardées en production"

5. **Ajoutez les testeurs**
   - **Option A** : Liste d'emails (max 100)
     - Ajoutez les emails des testeurs
   - **Option B** : Groupe Google (illimité)
     - Créez un groupe Google
     - Ajoutez le groupe

6. **Publiez**
   - Cliquez sur **"Review release"**
   - Puis **"Start rollout to Closed testing"**

7. **Partagez le lien de test**
   - Une fois publié, Google génère un lien
   - Format : `https://play.google.com/apps/internaltest/...`
   - Partagez ce lien avec vos testeurs
   - Ils peuvent s'inscrire et télécharger l'app

**✅ Avantages :**
- Pas besoin d'accès production
- Publication en quelques minutes
- Les données sont sauvegardées en production (votre config est correcte)
- Les testeurs peuvent s'inscrire via le lien

---

## 📝 Checklist pour accès production

- [ ] Description courte remplie (80 caractères)
- [ ] Description complète remplie (4000 caractères)
- [ ] Icône de l'application uploadée (512x512 px)
- [ ] Au moins 2 captures d'écran uploadées
- [ ] Catégorie sélectionnée
- [ ] Email de contact renseigné
- [ ] Politique de confidentialité (URL accessible)
- [ ] Cible d'âge sélectionnée
- [ ] Questionnaire sur les données complété
- [ ] Toutes les tâches du tableau de bord complétées
- [ ] Accès en production demandé

---

## 🎯 Recommandation

**Pour tester rapidement avec données de production :**

1. **Utilisez Tests fermés** (maintenant, sans attendre)
   - Créez une version de test fermé
   - Partagez le lien avec vos testeurs
   - Les données seront sauvegardées en production ✅

2. **En parallèle, remplissez les infos pour production**
   - Complétez les informations obligatoires
   - Demandez l'accès en production
   - Une fois obtenu, vous pourrez utiliser Tests ouverts

---

## 🔗 Liens utiles

- **Tableau de bord** : https://play.google.com/console/u/0/developers/apps
- **Présentation de la boutique** : https://play.google.com/console/u/0/developers/apps/[APP_ID]/store-listing
- **Contenu de l'application** : https://play.google.com/console/u/0/developers/apps/[APP_ID]/app-content
- **Tests fermés** : https://play.google.com/console/u/0/developers/apps/[APP_ID]/testing/closed
- **Centre d'aide** : https://support.google.com/googleplay/android-developer

---

## ❓ Besoin d'aide pour créer les assets ?

Si vous avez besoin d'aide pour :
- Créer l'icône (512x512 px)
- Prendre des captures d'écran
- Rédiger la description
- Créer la politique de confidentialité

Dites-moi et je vous aiderai !

