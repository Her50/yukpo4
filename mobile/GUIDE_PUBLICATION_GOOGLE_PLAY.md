# 📱 Guide de Publication sur Google Play Store

Ce guide explique comment publier l'application Yukpomnang sur Google Play Store pour qu'elle soit téléchargeable par tous.

## 📋 Prérequis

### 1. Compte Développeur Google Play
- **Coût** : 25$ USD (paiement unique à vie)
- **Création** : https://play.google.com/console/signup
- **Informations nécessaires** :
  - Nom complet
  - Adresse email
  - Numéro de téléphone
  - Carte bancaire (pour le paiement)
  - Informations fiscales (si applicable)

### 2. Application créée dans Google Play Console
- Créer une nouvelle application dans [Google Play Console](https://play.google.com/console)
- Choisir le nom de l'application : **Yukpomnang**
- Sélectionner la langue par défaut
- Accepter les conditions d'utilisation

## 🔧 Configuration EAS

### Profil de Build Production
Le profil `production` est déjà configuré dans `eas.json` :
- **Build Type** : `app-bundle` (AAB) - requis pour Google Play Store
- **Distribution** : Google Play Store
- **Environnement** : Production

### Informations de l'Application
- **Package Name** : `com.yukpomnang.mobile`
- **Version** : `1.0.0`
- **Nom** : Yukpomnang
- **Project ID** : `944bbf0d-5541-4e56-ba75-87ffc4c5e51f`

## 🚀 Étapes de Publication

### Étape 1 : Build de Production

Lancer un build de production qui génère un AAB (Android App Bundle) :

```bash
cd mobile
npx eas build --platform android --profile production
```

**Durée** : ~15-25 minutes

**Résultat** : Un fichier `.aab` téléchargeable depuis le dashboard EAS

### Étape 2 : Configuration Google Play Console

#### 2.1 Informations de l'Application
1. Aller sur [Google Play Console](https://play.google.com/console)
2. Sélectionner votre application
3. Remplir les sections obligatoires :
   - **Fiche de l'application** :
     - Titre : Yukpomnang
     - Description courte (80 caractères max)
     - Description complète (4000 caractères max)
     - Icône (512x512 px)
     - Captures d'écran (minimum 2, recommandé 8)
     - Graphique de fonctionnalité (1024x500 px)
   
   - **Contenu de l'application** :
     - Catégorie
     - Classification du contenu
     - Politique de confidentialité (URL)
   
   - **Prix et distribution** :
     - Pays/territoires
     - Prix (gratuit ou payant)
     - Programmes (Family Program, etc.)

#### 2.2 Configuration du Service Account (Optionnel mais Recommandé)

Pour automatiser les soumissions futures :

1. **Créer un Service Account** :
   - Aller dans Google Cloud Console
   - Créer un nouveau projet ou utiliser un existant
   - Activer l'API Google Play Android Developer
   - Créer un Service Account avec rôle "Service Account User"
   - Télécharger la clé JSON

2. **Lier le Service Account à Google Play Console** :
   - Dans Google Play Console → Paramètres → Accès API
   - Inviter le Service Account avec rôle "Administrateur" ou "Gestionnaire de versions"
   - Copier l'adresse email du Service Account

3. **Configurer EAS** :
   - Placer le fichier JSON du Service Account dans `mobile/google-service-account.json`
   - La configuration dans `eas.json` est déjà prête :
   ```json
   "submit": {
     "production": {
       "android": {
         "serviceAccountKeyPath": "./google-service-account.json",
         "track": "internal"  // ou "production", "alpha", "beta"
       }
     }
   }
   ```

### Étape 3 : Soumission de l'Application

#### Option A : Soumission Manuelle (Première fois)

1. **Télécharger l'AAB** :
   - Depuis le dashboard EAS : https://expo.dev/accounts/hernandezlele/projects/yukpomnang-mobile/builds
   - Télécharger le fichier `.aab` du build de production

2. **Uploader sur Google Play Console** :
   - Aller dans Google Play Console → Production (ou Internal Testing)
   - Cliquer sur "Créer une version"
   - Uploader le fichier `.aab`
   - Remplir les notes de version
   - Cliquer sur "Enregistrer"

3. **Soumettre pour révision** :
   - Vérifier que toutes les sections sont complètes
   - Cliquer sur "Soumettre pour révision"
   - Attendre l'approbation (généralement 1-3 jours)

#### Option B : Soumission Automatique avec EAS (Recommandé)

Une fois le Service Account configuré :

```bash
cd mobile
npx eas submit --platform android --profile production
```

Cette commande :
- Utilise le dernier build de production
- Upload automatiquement l'AAB sur Google Play Console
- Soumet sur la piste configurée (`internal`, `alpha`, `beta`, ou `production`)

### Étape 4 : Tracks de Publication

Google Play propose plusieurs pistes de test :

1. **Internal Testing** (Test interne)
   - Jusqu'à 100 testeurs
   - Publication immédiate
   - Idéal pour tester rapidement

2. **Closed Testing** (Test fermé)
   - Groupes de testeurs spécifiques
   - Publication immédiate
   - Idéal pour les bêta-testeurs

3. **Open Testing** (Test ouvert)
   - Tous les utilisateurs peuvent rejoindre
   - Publication immédiate
   - Idéal pour une bêta publique

4. **Production** (Production)
   - Disponible pour tous
   - Nécessite une révision Google
   - Idéal pour la version finale

**Recommandation** : Commencer par Internal Testing, puis passer à Production après validation.

## 📝 Checklist Avant Publication

### Obligatoire
- [ ] Compte développeur Google Play créé et payé
- [ ] Application créée dans Google Play Console
- [ ] Fiche de l'application complète (titre, description, icône, captures)
- [ ] Politique de confidentialité publiée (URL)
- [ ] Classification du contenu remplie
- [ ] Build de production réussi (AAB)
- [ ] Version testée sur plusieurs appareils
- [ ] Toutes les permissions justifiées

### Recommandé
- [ ] Service Account configuré pour automatisation
- [ ] Graphique de fonctionnalité ajouté
- [ ] Vidéo de démonstration (optionnel)
- [ ] Captures d'écran pour différentes tailles d'écran
- [ ] Traductions dans plusieurs langues (si applicable)
- [ ] Page de politique de confidentialité complète

## 🔄 Mises à Jour Futures

Pour publier une nouvelle version :

1. **Mettre à jour le numéro de version** dans `app.config.js` :
   ```javascript
   version: "1.0.1"  // Incrémenter selon semver
   ```

2. **Lancer un nouveau build** :
   ```bash
   npx eas build --platform android --profile production
   ```

3. **Soumettre automatiquement** :
   ```bash
   npx eas submit --platform android --profile production
   ```

Ou soumettre manuellement via Google Play Console.

## 🎯 Commandes Utiles

### Build Production
```bash
cd mobile
npx eas build --platform android --profile production
```

### Soumission Automatique
```bash
cd mobile
npx eas submit --platform android --profile production
```

### Voir les Builds
```bash
npx eas build:list --platform android
```

### Voir les Soumissions
```bash
npx eas submit:list --platform android
```

## 📚 Ressources

- [Documentation EAS Submit](https://docs.expo.dev/submit/android/)
- [Google Play Console](https://play.google.com/console)
- [Guide Google Play](https://support.google.com/googleplay/android-developer)
- [Politique de contenu Google Play](https://play.google.com/about/developer-content-policy/)

## ⚠️ Notes Importantes

1. **Première publication** : La révision peut prendre 1-3 jours
2. **Mises à jour** : Généralement approuvées en quelques heures
3. **Rejet** : Si l'app est rejetée, Google fournit des raisons détaillées
4. **Politique de confidentialité** : Obligatoire si l'app collecte des données
5. **Permissions** : Justifier toutes les permissions demandées
6. **Contenu** : Respecter les [politiques de contenu Google Play](https://play.google.com/about/developer-content-policy/)

## 🆘 Dépannage

### Erreur : "Service Account not found"
- Vérifier que `google-service-account.json` existe dans `mobile/`
- Vérifier que le Service Account a les bonnes permissions dans Google Play Console

### Erreur : "Package name mismatch"
- Vérifier que le package name dans `app.config.js` correspond à celui dans Google Play Console
- Package actuel : `com.yukpomnang.mobile`

### Build échoue
- Vérifier les logs sur https://expo.dev
- Vérifier que toutes les variables d'environnement sont configurées
- Vérifier que les credentials Android sont valides

---

**Bon courage pour la publication ! 🚀**

