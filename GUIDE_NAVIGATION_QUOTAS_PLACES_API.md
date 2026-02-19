# 🧭 Guide Navigation - Configurer Quotas Places API

**Date** : 2026-02-19  
**Projet** : yukpomnang (ID: 738929393617)

---

## ⚠️ Page Actuelle vs Page Requise

### Page Actuelle (Quotas Système)
Vous êtes actuellement sur :
- **IAM et administration** → **Quotas** → **Configurations**
- Cette page montre les quotas **système** (Compute Engine, etc.)
- ❌ **Ce n'est PAS la bonne page** pour Places API

### Page Requise (Quotas Places API)
Vous devez aller sur :
- **APIs & Services** → **Places API (New)** → **Quotas**
- Cette page montre les quotas **Places API** spécifiques
- ✅ **C'est la bonne page** pour configurer les limites Places API

---

## 🎯 Méthode 1 : URL Directe (RECOMMANDÉ)

**Cliquez sur ce lien ou copiez-le dans votre navigateur** :

```
https://console.cloud.google.com/apis/api/places-backend.googleapis.com/quotas?project=yukpomnang-460203
```

**OU** (si le projet ID est différent) :

```
https://console.cloud.google.com/apis/api/places-backend.googleapis.com/quotas?project=738929393617
```

---

## 🎯 Méthode 2 : Navigation Manuelle

### Étape 1 : Aller dans APIs & Services

1. Dans la barre de navigation en haut, **cliquez sur le menu hamburger** (☰)
2. **Cherchez** "APIs & Services" ou "APIs et services"
3. **Cliquez** sur "APIs & Services" → **"Enabled APIs"** ou **"APIs activées"**

### Étape 2 : Trouver Places API

1. Dans la liste des APIs activées, **cherchez** :
   - "Places API (New)" 
   - OU "places-backend.googleapis.com"
2. **Cliquez** sur "Places API (New)"

### Étape 3 : Aller dans Quotas

1. Dans la page Places API, vous verrez plusieurs onglets :
   - Overview (Vue d'ensemble)
   - **Quotas** ← **CLIQUEZ ICI**
   - Credentials (Identifiants)
   - etc.
2. **Cliquez sur l'onglet "Quotas"**

---

## 📋 Une fois sur la bonne page

Vous devriez voir une liste de quotas comme :
- **Requests per day** (Requêtes par jour)
- **Requests per minute** (Requêtes par minute)
- **Requests per 100 seconds** (Requêtes par 100 secondes)

### Pour modifier un quota :

1. **Cochez la case** à gauche du quota que vous voulez modifier
2. **Cliquez sur "EDIT QUOTAS"** ou **"Modifier les quotas"** (bouton en haut)
3. **Entrez la nouvelle limite** :
   - Requests per day : `50000`
   - Requests per minute : `100`
   - Requests per 100 seconds : `200`
4. **Justification** :
   ```
   Limitation pour éviter les coûts excessifs suite à un bug de code.
   Application en développement avec un seul testeur.
   ```
5. **Cliquez sur "SUBMIT"** ou **"Soumettre"**

---

## ✅ Vérification

Après avoir soumis, vous devriez voir :
- ✅ Les quotas en attente d'approbation (si nécessaire)
- ✅ OU les quotas directement appliqués (selon les permissions)

---

## 🔍 Si vous ne trouvez pas Places API

### Vérifier que Places API est activée :

1. **APIs & Services** → **Enabled APIs**
2. **Cherchez** "Places API (New)"
3. Si elle n'est **pas** dans la liste :
   - Cliquez sur **"+ ENABLE APIS"** ou **"+ Activer des APIs"**
   - Cherchez "Places API (New)"
   - Cliquez sur **"ENABLE"** ou **"Activer"**

---

## 📸 À quoi ressemble la bonne page

La page correcte devrait afficher :
- **Titre** : "Quotas" ou "Quotas and limits"
- **Service** : "Places API (New)" ou "places-backend.googleapis.com"
- **Liste de quotas** avec :
  - Requests per day
  - Requests per minute
  - Requests per 100 seconds
- **Bouton** : "EDIT QUOTAS" ou "Modifier les quotas"

---

## 🆘 Aide Supplémentaire

Si vous avez des difficultés :
1. **Utilisez l'URL directe** (Méthode 1) - c'est le plus simple
2. **Vérifiez le projet** : Assurez-vous d'être sur le bon projet (yukpomnang)
3. **Vérifiez les permissions** : Vous devez avoir les droits pour modifier les quotas

---

**URL Directe Rapide** :
```
https://console.cloud.google.com/apis/api/places-backend.googleapis.com/quotas?project=yukpomnang-460203
```

