# 📦 Guide d'Installation et Configuration

## ✅ 1. Installation des Dépendances Mobile

### Dépendances Requises

**Déjà installé** :
- ✅ `expo-camera@16.0.18` (déjà dans package.json)

**À installer** :
- ⏳ `expo-media-library` (pour sauvegarder vidéos dans galerie)

### Commande d'Installation

```bash
cd mobile
npm install expo-media-library
```

**OU avec Expo CLI** :
```bash
cd mobile
npx expo install expo-media-library
```

---

## ✅ 2. Configuration des Variables d'Environnement

### Créer le fichier `.env`

1. **Créer le fichier** `mobile/.env` (copier depuis `.env.example`)

```bash
cd mobile
cp .env.example .env
```

2. **Éditer le fichier** `.env` et remplacer par vos vrais endpoints CDN :

```env
# Configuration CDN pour distribution vidéo

# Cloudflare CDN (Global)
# Remplacez par votre vraie URL Cloudflare
EXPO_PUBLIC_CDN_CLOUDFLARE_URL=https://cdn.yukpo.app

# AWS CloudFront US (Région US-EAST)
# Remplacez par votre vraie URL CloudFront US
EXPO_PUBLIC_CDN_CLOUDFRONT_US_URL=https://d1234567890.cloudfront.net

# AWS CloudFront EU (Région EU-WEST)
# Remplacez par votre vraie URL CloudFront EU
EXPO_PUBLIC_CDN_CLOUDFRONT_EU_URL=https://d0987654321.cloudfront.net
```

### Configuration CDN

#### Option 1 : Cloudflare

1. Créer un compte Cloudflare
2. Ajouter votre domaine
3. Configurer un sous-domaine CDN (ex: `cdn.yukpo.app`)
4. Pointer vers votre bucket S3/Wasabi
5. Copier l'URL dans `EXPO_PUBLIC_CDN_CLOUDFLARE_URL`

#### Option 2 : AWS CloudFront

1. Créer une distribution CloudFront
2. Configurer l'origine (S3 bucket)
3. Copier l'URL de distribution dans les variables d'environnement

**Exemple** :
```env
EXPO_PUBLIC_CDN_CLOUDFRONT_US_URL=https://d1234567890.cloudfront.net
EXPO_PUBLIC_CDN_CLOUDFRONT_EU_URL=https://d0987654321.cloudfront.net
```

#### Option 3 : Pas de CDN (Fallback)

Si vous n'avez pas de CDN configuré, le système utilisera automatiquement le backend direct comme fallback.

---

## ✅ 3. Vérification

### Vérifier les dépendances installées

```bash
cd mobile
npm list expo-camera expo-media-library
```

**Résultat attendu** :
```
expo-camera@16.0.18
expo-media-library@X.X.X
```

### Vérifier les variables d'environnement

Les variables sont chargées automatiquement par Expo. Vérifiez dans `mobile/src/config/environment.ts` que les valeurs sont bien utilisées.

---

## ✅ 4. Redémarrer l'Application

Après installation et configuration :

```bash
cd mobile
npm start
# Puis appuyez sur 'r' pour recharger
```

---

## 📝 Notes

### Variables d'Environnement

- Les variables `EXPO_PUBLIC_*` sont accessibles côté client
- Elles sont chargées au démarrage de l'app
- Redémarrer l'app après modification

### CDN

- Si aucun CDN n'est configuré, le système utilise le backend direct
- La détection automatique du meilleur endpoint se fait au premier lancement
- La configuration est sauvegardée localement (AsyncStorage)

---

*Date : 2025-12-03*

