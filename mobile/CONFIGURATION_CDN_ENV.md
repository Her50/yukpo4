# 🔧 Configuration Variables d'Environnement CDN

## 📝 Créer le fichier `.env`

1. **Créer le fichier** `mobile/.env` à la racine du dossier `mobile`

2. **Ajouter les variables CDN** :

```env
# Configuration CDN pour distribution vidéo
# Remplacez par vos vrais endpoints CDN

# Cloudflare CDN (Global)
EXPO_PUBLIC_CDN_CLOUDFLARE_URL=https://cdn.yukpo.app

# AWS CloudFront US (Région US-EAST)
EXPO_PUBLIC_CDN_CLOUDFRONT_US_URL=https://d1234567890.cloudfront.net

# AWS CloudFront EU (Région EU-WEST)
EXPO_PUBLIC_CDN_CLOUDFRONT_EU_URL=https://d0987654321.cloudfront.net
```

## ⚙️ Configuration CDN

### Option 1 : Cloudflare (Recommandé)

1. Créer un compte Cloudflare
2. Ajouter votre domaine
3. Créer un sous-domaine CDN (ex: `cdn.yukpo.app`)
4. Pointer vers votre bucket S3/Wasabi
5. Copier l'URL dans `EXPO_PUBLIC_CDN_CLOUDFLARE_URL`

### Option 2 : AWS CloudFront

1. Créer une distribution CloudFront dans AWS Console
2. Configurer l'origine (S3 bucket)
3. Copier l'URL de distribution
4. Ajouter dans les variables d'environnement

**Exemple** :
```env
EXPO_PUBLIC_CDN_CLOUDFRONT_US_URL=https://d1234567890.cloudfront.net
EXPO_PUBLIC_CDN_CLOUDFRONT_EU_URL=https://d0987654321.cloudfront.net
```

### Option 3 : Pas de CDN (Fallback)

Si vous n'avez pas de CDN configuré, le système utilisera automatiquement le backend direct comme fallback. Aucune action requise.

## ✅ Vérification

Après création du fichier `.env`, redémarrer l'application :

```bash
cd mobile
npm start
# Puis appuyez sur 'r' pour recharger
```

Les variables sont chargées automatiquement par Expo au démarrage.

---

*Date : 2025-12-03*

