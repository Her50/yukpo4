# 🔑 GUIDE - OBTENIR GOOGLE_TRANSLATE_API_KEY

**Date**: 2025-01-29  
**Objectif**: Obtenir la clé API Google Translate (différente de Google Maps)

---

## ⚠️ IMPORTANT : GOOGLE_TRANSLATE ≠ GOOGLE_MAPS

### **Différence entre les clés** :

1. **GOOGLE_MAPS_API_KEY**
   - Utilise: **Maps JavaScript API, Geocoding API, Distance Matrix API**
   - Usage: Cartes, géolocalisation, calcul de distances
   - Obtenu via: Google Cloud Console → APIs & Services → Credentials

2. **GOOGLE_TRANSLATE_API_KEY** (à obtenir)
   - Utilise: **Cloud Translation API**
   - Usage: Traduction automatique de texte
   - Obtenu via: Google Cloud Console → APIs & Services → Credentials

### **Puis-je utiliser la même clé ?**

✅ **OUI**, vous pouvez utiliser la **même clé API** pour les deux si :
- Vous activez **toutes les APIs nécessaires** sur la même clé
- Cela simplifie la gestion

⚠️ **NON**, il est recommandé d'avoir des clés séparées si :
- Vous voulez contrôler les quotas séparément
- Vous voulez des restrictions différentes par API
- Meilleure sécurité et traçabilité

---

## 🚀 MÉTHODE 1: UTILISER LA MÊME CLÉ (Recommandé pour début)

### **Étapes** :

1. **Aller sur Google Cloud Console**
   - URL: https://console.cloud.google.com/
   - Connectez-vous avec votre compte Google

2. **Sélectionner votre projet**
   - Dans le menu déroulant en haut
   - Ou créez un nouveau projet "Yukpomnang"

3. **Activer Cloud Translation API**
   - Menu: **APIs & Services** → **Library**
   - Recherchez: **"Cloud Translation API"**
   - Cliquez sur **"Enable"**

4. **Vérifier votre clé existante**
   - Menu: **APIs & Services** → **Credentials**
   - Trouvez votre clé existante (celle utilisée pour Maps)
   - Vérifiez que **Cloud Translation API** est dans la liste des APIs autorisées

5. **Ajouter Cloud Translation à votre clé**
   - Cliquez sur votre clé existante
   - Section **"API restrictions"**
   - Sélectionnez **"Restrict key"**
   - Ajoutez **"Cloud Translation API"** à la liste
   - Sauvegardez

6. **Utiliser la même clé dans .env**
   ```bash
   GOOGLE_MAPS_API_KEY=AIzaSy...votre_clé_commune...
   GOOGLE_TRANSLATE_API_KEY=AIzaSy...votre_clé_commune...
   ```

✅ **C'est fait !** Vous utilisez maintenant la même clé pour les deux.

---

## 🔐 MÉTHODE 2: CRÉER UNE CLÉ SÉPARÉE (Recommandé pour production)

### **Étapes** :

1. **Aller sur Google Cloud Console**
   - URL: https://console.cloud.google.com/
   - Connectez-vous

2. **Sélectionner votre projet**
   - Menu déroulant en haut

3. **Activer Cloud Translation API**
   - Menu: **APIs & Services** → **Library**
   - Recherchez: **"Cloud Translation API"**
   - Cliquez sur **"Enable"**
   - Attendez l'activation (quelques secondes)

4. **Créer une nouvelle clé API**
   - Menu: **APIs & Services** → **Credentials**
   - Cliquez sur **"+ CREATE CREDENTIALS"**
   - Sélectionnez **"API key"**

5. **Configurer la clé**
   - **Nom**: "Yukpomnang - Cloud Translation API"
   - **Application restrictions**: 
     - Pour backend: **"None"** (ou **"IP addresses"** si vous connaissez les IPs de Render.com)
     - Pour mobile: **"Android apps"** ou **"iOS apps"** avec package name
   - **API restrictions**: 
     - Sélectionnez **"Restrict key"**
     - Cochez uniquement **"Cloud Translation API"**
   - Cliquez sur **"Save"**

6. **Copier la clé**
   - Une fois créée, la clé s'affiche
   - Format: `AIzaSy...`
   - ⚠️ **Copiez-la maintenant**, vous ne pourrez plus la voir après !

7. **Ajouter dans votre .env**
   ```bash
   # Backend (.env)
   GOOGLE_TRANSLATE_API_KEY=AIzaSy...votre_nouvelle_clé...
   ```

8. **Ajouter dans Render.com**
   - Dashboard Render.com → Votre service → **Environment**
   - Ajoutez: `GOOGLE_TRANSLATE_API_KEY=AIzaSy...`
   - Cochez **"Secret"** pour la sécuriser

---

## 📋 CHECKLIST COMPLÈTE

### ✅ **Pour utiliser la même clé** :

- [ ] Cloud Translation API activée
- [ ] Clé existante mise à jour avec Cloud Translation API
- [ ] `.env` backend configuré avec la même clé
- [ ] Render.com mis à jour avec la même clé

### ✅ **Pour créer une clé séparée** :

- [ ] Cloud Translation API activée
- [ ] Nouvelle clé API créée
- [ ] Restrictions configurées (recommandé)
- [ ] Clé copiée et sauvegardée en sécurité
- [ ] `.env` backend configuré
- [ ] Render.com mis à jour

---

## 💰 COÛTS & QUOTAS

### **Google Cloud Translation API**

- **Gratuit**: 500,000 caractères/mois
- **Payant**: $20 par million de caractères après le gratuit

### **Estimation pour Yukpo** :

- **Notifications**: ~100 caractères/notification
- **Traduction messages**: ~500 caractères/message
- **Quota mensuel**: ~5,000 traductions gratuites

✅ **Suffisant pour démarrer !**

---

## 🔍 VÉRIFICATION

### **Tester la clé dans le backend** :

```bash
# Dans votre terminal
curl "https://translation.googleapis.com/language/translate/v2?key=VOTRE_CLE&q=Hello&target=fr"
```

**Réponse attendue** :
```json
{
  "data": {
    "translations": [{
      "translatedText": "Bonjour"
    }]
  }
}
```

✅ Si vous obtenez cette réponse, la clé fonctionne !

---

## 🆘 PROBLÈMES COURANTS

### **1. "API key not valid"**
- ✅ Vérifiez que Cloud Translation API est activée
- ✅ Vérifiez que la clé a les bonnes restrictions
- ✅ Vérifiez que vous avez copié la clé complète

### **2. "API not enabled"**
- ✅ Allez dans **APIs & Services** → **Library**
- ✅ Recherchez "Cloud Translation API"
- ✅ Cliquez sur **"Enable"**

### **3. "Quota exceeded"**
- ✅ Vérifiez votre usage dans **APIs & Services** → **Dashboard**
- ✅ Augmentez les quotas si nécessaire
- ✅ Ou attendez le reset mensuel

---

## 📝 RÉSUMÉ

### **Option Simple (Même clé)** :
1. Activer Cloud Translation API
2. Ajouter à votre clé Maps existante
3. Utiliser la même clé partout

### **Option Sécurisée (Clé séparée)** :
1. Activer Cloud Translation API
2. Créer une nouvelle clé dédiée
3. Configurer les restrictions
4. Ajouter dans .env et Render.com

---

## ✅ ACTION IMMÉDIATE

**Pour obtenir votre clé maintenant** :

1. 👉 **Allez sur**: https://console.cloud.google.com/
2. 👉 **Activez**: Cloud Translation API
3. 👉 **Créez ou utilisez**: Une clé API
4. 👉 **Ajoutez dans**: Render.com → Environment → `GOOGLE_TRANSLATE_API_KEY`

**C'est tout !** 🎉

