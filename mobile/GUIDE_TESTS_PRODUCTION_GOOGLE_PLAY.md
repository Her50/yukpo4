# 🧪 Guide : Publier une version de test avec base de données de production

## 🎯 Objectif

Publier une version de test publique sur Google Play qui :
- ✅ Utilise la **base de données de production** (données réelles)
- ✅ Permet aux utilisateurs de tester l'application
- ✅ Les données des tests sont sauvegardées dans la base de données de production
- ✅ Les tests peuvent être des données d'exploitation réelles

---

## 📋 Étape 1 : Comprendre les types de tests Google Play

### Tests internes (Internal testing)
- **Accès** : Liste d'email limitée (max 100 testeurs)
- **Rapidité** : Publication en quelques minutes
- **Idéal pour** : Tests avec votre équipe

### Tests fermés (Closed testing)
- **Accès** : Liste d'email ou groupe Google (illimité)
- **Rapidité** : Publication en quelques heures
- **Idéal pour** : Tests avec un groupe restreint

### Tests ouverts (Open testing) ⭐ RECOMMANDÉ
- **Accès** : Public, n'importe qui peut s'inscrire
- **Rapidité** : Publication en quelques heures
- **Idéal pour** : Tests publics avec données de production
- **Avantage** : Les utilisateurs peuvent s'inscrire eux-mêmes

---

## ⚙️ Étape 2 : Vérifier la configuration de l'environnement

Votre application est déjà configurée pour utiliser la base de données de production :

**Dans `eas.json` (profil production) :**
```json
"EXPO_PUBLIC_API_URL": "https://api.yukpomnang.com",
"EXPO_PUBLIC_ENVIRONMENT": "production"
```

✅ **C'est parfait !** Votre build de production utilise déjà l'API de production.

---

## 🚀 Étape 3 : Publier en Tests ouverts

### 3.1 Accéder au tableau de bord

**🔗 Lien direct :** https://play.google.com/console/u/0/developers/apps

1. Dans Google Play Console, cliquez sur votre application **"Yukpomnang"**
2. Dans le menu de gauche, allez dans **"Tests"** → **"Tests ouverts"**
3. Cliquez sur **"Accéder au tableau de bord"** (bouton bleu)

### 3.2 Créer une nouvelle version de test

1. Cliquez sur **"Créer une nouvelle version"** ou **"Create new release"**
2. Dans la section **"App bundles et APK"**, cliquez sur **"Upload"**
3. **Téléchargez votre AAB** :
   ```powershell
   cd C:\Users\23767\yukpomnang2\mobile
   Invoke-WebRequest -Uri "https://expo.dev/artifacts/eas/wGBY6A44e7qr9ht7JhwrYQ.aab" -OutFile "app-release.aab"
   ```
4. Sélectionnez le fichier `app-release.aab`
5. Attendez la validation (quelques minutes)

### 3.3 Remplir les informations de la version

1. **Notes de version** :
   - Exemple : "Version de test publique - Les données sont sauvegardées dans la base de données de production"
   - Expliquez que c'est une version de test mais avec données réelles

2. **Pays de test** (optionnel) :
   - Par défaut : Tous les pays
   - Vous pouvez limiter à certains pays si besoin

3. Cliquez sur **"Enregistrer"** ou **"Save"**

### 3.4 Publier la version

1. Cliquez sur **"Review release"** ou **"Réviser la version"**
2. Vérifiez toutes les informations
3. Cliquez sur **"Start rollout to Open testing"** ou **"Démarrer la diffusion en tests ouverts"**

---

## ⚠️ Étape 4 : Important - Configuration requise avant Tests ouverts

Si vous voyez le message "Les tests ouverts sont disponibles quand vous disposez d'un accès en production", vous devez d'abord :

### 4.1 Remplir les informations obligatoires

**🔗 Lien direct :** https://play.google.com/console/u/0/developers/apps

1. Allez dans **"Présentation de la boutique"** ou **"Store listing"**
2. Remplissez au minimum :
   - **Description courte** (80 caractères)
   - **Description complète** (4000 caractères)
   - **Icône de l'application** (512x512 px)
   - **Au moins 2 captures d'écran**
   - **Catégorie**
   - **Email de contact**

3. Allez dans **"Contenu de l'application"** ou **"App content"**
4. Remplissez :
   - **Politique de confidentialité** (URL requise)
   - **Cible d'âge**
   - **Questionnaire sur les données**

### 4.2 Demander l'accès en production

1. Allez dans **"Production"** (menu de gauche)
2. Cliquez sur **"Créer une nouvelle version"**
3. Uploadez votre AAB (même fichier)
4. Remplissez les notes de version
5. Cliquez sur **"Review release"**
6. **⚠️ NE PUBLIEZ PAS EN PRODUCTION** - Laissez-le en brouillon
7. Une fois la version créée (même en brouillon), vous aurez accès aux tests ouverts

**💡 Astuce :** Vous pouvez créer une version en production en brouillon sans la publier. Cela débloque l'accès aux tests ouverts.

---

## 🔄 Étape 5 : Alternative - Utiliser Tests fermés (Plus rapide)

Si vous voulez tester rapidement sans remplir toutes les infos :

### 5.1 Créer un test fermé

1. Allez dans **"Tests"** → **"Tests fermés"**
2. Cliquez sur **"Créer une nouvelle version"**
3. Uploadez votre AAB
4. Remplissez les notes de version
5. **Ajoutez les testeurs** :
   - Par email (liste d'emails)
   - Ou créez un groupe Google
6. Publiez la version

### 5.2 Partager le lien de test

Une fois publié, Google Play génère un lien de test :
- Format : `https://play.google.com/apps/internaltest/...`
- Partagez ce lien avec vos testeurs
- Ils peuvent s'inscrire et télécharger l'app

---

## 📊 Étape 6 : Gérer les données de test

### 6.1 Vérifier que l'app utilise la base de données de production

Votre configuration actuelle dans `eas.json` :
```json
"EXPO_PUBLIC_API_URL": "https://api.yukpomnang.com",
"EXPO_PUBLIC_ENVIRONMENT": "production"
```

✅ **C'est correct !** L'application utilisera la base de données de production.

### 6.2 Identifier les données de test (optionnel)

Si vous voulez distinguer les données de test des données de production :

**Option A : Ajouter un flag dans les données**
- Ajoutez un champ `is_test_data: true` dans vos enregistrements
- Filtrez dans vos requêtes si nécessaire

**Option B : Utiliser un préfixe**
- Préfixez les données de test (ex: "TEST_USER_123")
- Facilite l'identification et le nettoyage si nécessaire

**Option C : Utiliser directement les données de production**
- Les tests utilisent les mêmes données que la production
- Plus simple, mais attention aux données sensibles

---

## 🎯 Recommandation pour votre cas

Vu que vous voulez que les tests soient des données d'exploitation :

1. **Utilisez Tests ouverts** (une fois l'accès production obtenu)
2. **L'application utilise déjà la base de données de production** ✅
3. **Les utilisateurs de test créeront des données réelles** dans votre base
4. **C'est parfait pour tester avec des données réelles**

---

## 📝 Checklist

- [ ] Application créée dans Google Play Console
- [ ] AAB téléchargé et prêt
- [ ] Informations de présentation remplies (pour accès production)
- [ ] Version créée en production (brouillon) pour débloquer tests ouverts
- [ ] Version de test créée dans "Tests ouverts"
- [ ] AAB uploadé dans la version de test
- [ ] Notes de version remplies
- [ ] Version publiée en tests ouverts
- [ ] Lien de test partagé (si tests fermés)

---

## 🔗 Liens directs

- **Mes applications** : https://play.google.com/console/u/0/developers/apps
- **Tests ouverts** : https://play.google.com/console/u/0/developers/apps/[APP_ID]/testing/open
- **Tests fermés** : https://play.google.com/console/u/0/developers/apps/[APP_ID]/testing/closed
- **Production** : https://play.google.com/console/u/0/developers/apps/[APP_ID]/production
- **Présentation de la boutique** : https://play.google.com/console/u/0/developers/apps/[APP_ID]/store-listing

---

## 💡 Prochaines étapes

1. **Maintenant** : Créez une version en production (brouillon) pour débloquer les tests ouverts
2. **Ensuite** : Publiez en tests ouverts avec votre AAB
3. **Les utilisateurs** pourront s'inscrire et tester
4. **Les données** seront sauvegardées dans votre base de données de production

Voulez-vous que je vous guide étape par étape pour créer la version de test maintenant ?

