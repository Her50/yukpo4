# 🔧 Configuration Google Cloud Billing

## 📋 Problème identifié

Les APIs Google suivantes retournent des erreurs 403 (PERMISSION_DENIED) :
- **Google Places API** : `BILLING_DISABLED`
- **Google Translation API** : `SERVICE_DISABLED`

**Impact** :
- Enrichissement des lieux indisponible (coordonnées GPS à 0,0)
- Traductions non disponibles (fallback sur texte original)

---

## ✅ Solution : Activer la facturation Google Cloud

### Étape 1 : Accéder à Google Cloud Console

1. Aller sur [Google Cloud Console](https://console.cloud.google.com/)
2. Sélectionner le projet : **738929393617** (ou votre projet ID)

### Étape 2 : Activer la facturation

1. Aller dans **Billing** (Facturation) dans le menu latéral
2. Cliquer sur **LINK A BILLING ACCOUNT** (Lier un compte de facturation)
3. Suivre les étapes pour :
   - Créer un compte de facturation si nécessaire
   - Ajouter une méthode de paiement (carte bancaire)
   - Lier le compte au projet

**URL directe** : https://console.cloud.google.com/billing/enable?project=738929393617

### Étape 3 : Activer les APIs nécessaires

#### 3.1 Google Places API

1. Aller dans **APIs & Services** > **Library**
2. Rechercher "Places API"
3. Cliquer sur **Places API** (ou **Places API (New)**)
4. Cliquer sur **ENABLE** (Activer)

**URL directe** : https://console.cloud.google.com/apis/library/places-backend.googleapis.com?project=738929393617

#### 3.2 Google Translation API

1. Aller dans **APIs & Services** > **Library**
2. Rechercher "Cloud Translation API"
3. Cliquer sur **Cloud Translation API**
4. Cliquer sur **ENABLE** (Activer)

**URL directe** : https://console.cloud.google.com/apis/api/translate.googleapis.com/overview?project=738929393617

### Étape 4 : Vérifier les quotas et limites

1. Aller dans **APIs & Services** > **Quotas**
2. Vérifier les quotas pour :
   - **Places API** : Requêtes par jour
   - **Translation API** : Caractères traduits par mois

**Note** : Google offre des quotas gratuits :
- **Places API** : $200 de crédit gratuit par mois
- **Translation API** : 500,000 caractères/mois gratuits

---

## 🔄 Alternative : Désactiver les APIs si non utilisées

Si vous ne souhaitez pas activer la facturation, vous pouvez :

### Option 1 : Désactiver complètement les APIs

Dans le code backend, vérifier les variables d'environnement :
```bash
# Désactiver Google Places
GOOGLE_PLACES_ENABLED=false

# Désactiver Google Translation
GOOGLE_TRANSLATION_ENABLED=false
```

### Option 2 : Améliorer les fallbacks

Les fallbacks actuels fonctionnent déjà :
- **Places API** : Retourne coordonnées (0,0) si échec
- **Translation API** : Retourne texte original si échec

Vous pouvez améliorer ces fallbacks pour utiliser des services alternatifs.

---

## 📊 Coûts estimés

### Google Places API
- **Requêtes gratuites** : $200/mois (environ 40,000 requêtes)
- **Au-delà** : $0.017 par requête
- **Estimation mensuelle** : Variable selon usage

### Google Translation API
- **Gratuit** : 500,000 caractères/mois
- **Au-delà** : $20 par million de caractères
- **Estimation mensuelle** : Variable selon usage

**Recommandation** : Surveiller l'usage dans Google Cloud Console > Billing > Reports

---

## 🚀 Après activation

1. **Attendre 5-10 minutes** pour la propagation
2. **Redémarrer le backend** si nécessaire
3. **Tester** :
   - Créer un service avec un lieu
   - Vérifier que les coordonnées GPS sont correctes
   - Vérifier que les traductions fonctionnent

---

## 🔍 Vérification

### Vérifier que la facturation est activée

```bash
# Dans Google Cloud Console
# Billing > Account management
# Vérifier que le projet est lié à un compte de facturation
```

### Vérifier que les APIs sont activées

```bash
# Dans Google Cloud Console
# APIs & Services > Enabled APIs
# Vérifier que "Places API" et "Cloud Translation API" sont listées
```

### Tester depuis le backend

Les logs devraient montrer :
- ✅ `[Places] Recherche réussie` au lieu de `BILLING_DISABLED`
- ✅ `[TRANSLATE] Traduction réussie` au lieu de `SERVICE_DISABLED`

---

## 📝 Notes importantes

1. **Crédit gratuit** : Google offre $300 de crédit gratuit pour nouveaux comptes
2. **Alertes** : Configurer des alertes de budget dans Google Cloud Console
3. **Limites** : Configurer des limites de dépenses pour éviter les surprises
4. **Monitoring** : Surveiller régulièrement l'usage dans Billing > Reports

---

## 🆘 Support

- **Documentation Google** : https://cloud.google.com/billing/docs
- **Support Google Cloud** : https://cloud.google.com/support
- **Console Billing** : https://console.cloud.google.com/billing

