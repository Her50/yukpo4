# 🌐 Guide Complet : Configuration CDN pour Yukpo

## 📋 Vue d'ensemble

Ce guide vous aide à configurer un CDN (Content Delivery Network) pour distribuer vos vidéos de manière optimale. Vous avez deux options principales :

1. **Cloudflare** (Recommandé - Gratuit et facile)
2. **AWS CloudFront** (Payant mais très performant)

---

## 🆓 Option 1 : Cloudflare (Recommandé)

### Avantages
- ✅ **Gratuit** jusqu'à 100 Go/mois
- ✅ Configuration simple
- ✅ Performance excellente
- ✅ Protection DDoS incluse

### Étapes de Configuration

#### 1. Créer un compte Cloudflare

1. Aller sur [cloudflare.com](https://www.cloudflare.com)
2. Créer un compte gratuit
3. Vérifier votre email

#### 2. Ajouter votre domaine

1. Dans le dashboard Cloudflare, cliquer sur **"Add a Site"**
2. Entrer votre domaine (ex: `yukpo.app` ou un sous-domaine)
3. Choisir le plan **Free**
4. Suivre les instructions pour changer les DNS

#### 3. Créer un sous-domaine CDN

1. Dans Cloudflare Dashboard, aller dans **DNS**
2. Cliquer sur **"Add record"**
3. Configurer :
   - **Type** : `CNAME`
   - **Name** : `cdn` (ou `media`, `videos`)
   - **Target** : Votre bucket S3/Wasabi (voir section "Configurer l'origine")
   - **Proxy status** : ✅ Proxied (orange cloud)

4. Exemple :
   ```
   Type: CNAME
   Name: cdn
   Target: your-bucket.s3.amazonaws.com
   Proxy: ✅ Proxied
   ```

#### 4. Configurer l'origine (S3/Wasabi)

**Si vous utilisez AWS S3** :
1. Aller dans AWS S3 Console
2. Créer un bucket (ex: `yukpo-media`)
3. Activer **Static website hosting**
4. Configurer les permissions (public read)
5. Copier l'URL du bucket (ex: `yukpo-media.s3.amazonaws.com`)

**Si vous utilisez Wasabi** :
1. Aller dans Wasabi Console
2. Créer un bucket
3. Configurer les permissions publiques
4. Copier l'URL du bucket

#### 5. Configurer Cloudflare pour S3/Wasabi

1. Dans Cloudflare, aller dans **Rules** > **Transform Rules** > **Rewrite**
2. Créer une règle pour réécrire les URLs :
   - **If** : `http.host eq "cdn.yukpo.app"`
   - **Then** : Rewrite to `your-bucket.s3.amazonaws.com/$1`

#### 6. Obtenir l'URL CDN

Votre URL CDN sera : `https://cdn.yukpo.app` (ou le nom que vous avez choisi)

**Ajouter dans `.env`** :
```env
EXPO_PUBLIC_CDN_CLOUDFLARE_URL=https://cdn.yukpo.app
```

---

## 💰 Option 2 : AWS CloudFront

### Avantages
- ✅ Performance maximale
- ✅ Intégration native avec S3
- ✅ Distribution globale
- ⚠️ Payant (mais très économique)

### Étapes de Configuration

#### 1. Prérequis

- Compte AWS
- Bucket S3 avec vos vidéos
- Accès IAM configuré

#### 2. Créer une Distribution CloudFront

1. Aller dans [AWS CloudFront Console](https://console.aws.amazon.com/cloudfront/)
2. Cliquer sur **"Create Distribution"**

#### 3. Configurer l'Origine

1. **Origin Domain** : Sélectionner votre bucket S3 (ex: `yukpo-media.s3.amazonaws.com`)
2. **Origin Path** : Laisser vide ou `/videos` si vos vidéos sont dans un sous-dossier
3. **Name** : `yukpo-media-origin` (ou nom de votre choix)

#### 4. Configurer le Comportement par Défaut

1. **Viewer Protocol Policy** : `Redirect HTTP to HTTPS`
2. **Allowed HTTP Methods** : `GET, HEAD, OPTIONS`
3. **Cache Policy** : `CachingOptimized` (ou créer une politique personnalisée)
4. **Origin Request Policy** : `CORS-S3Origin` (si CORS activé)

#### 5. Configurer les Paramètres

1. **Price Class** : 
   - `Use all edge locations` (meilleure performance, plus cher)
   - `Use only North America and Europe` (économique)
   - `Use only North America` (le plus économique)

2. **Alternate Domain Names (CNAMEs)** : 
   - Ajouter `cdn.yukpo.app` (si vous avez un domaine)

3. **SSL Certificate** : 
   - Si vous avez un domaine : sélectionner ou créer un certificat SSL
   - Sinon : utiliser le certificat CloudFront par défaut

#### 6. Créer la Distribution

1. Cliquer sur **"Create Distribution"**
2. Attendre 5-15 minutes pour le déploiement
3. Une fois déployé, copier le **Domain Name** (ex: `d1234567890.cloudfront.net`)

#### 7. Créer une Distribution pour EU (Optionnel)

Pour une meilleure performance en Europe :

1. Répéter les étapes 2-6
2. Choisir **Price Class** : `Use only North America and Europe`
3. Copier le **Domain Name** de la distribution EU

#### 8. Obtenir les URLs CloudFront

**Distribution US** :
```
https://d1234567890.cloudfront.net
```

**Distribution EU** :
```
https://d0987654321.cloudfront.net
```

**Ajouter dans `.env`** :
```env
EXPO_PUBLIC_CDN_CLOUDFRONT_US_URL=https://d1234567890.cloudfront.net
EXPO_PUBLIC_CDN_CLOUDFRONT_EU_URL=https://d0987654321.cloudfront.net
```

---

## 🔍 Option 3 : Trouver votre Configuration Actuelle

Si vous avez déjà un bucket S3/Wasabi configuré, voici comment trouver les informations :

### Pour AWS S3

1. Aller dans [AWS S3 Console](https://console.aws.amazon.com/s3/)
2. Sélectionner votre bucket
3. Regarder l'URL dans les propriétés :
   - Format : `bucket-name.s3.region.amazonaws.com`
   - Exemple : `yukpo-media.s3.us-east-1.amazonaws.com`

### Pour Wasabi

1. Aller dans [Wasabi Console](https://console.wasabi.com/)
2. Sélectionner votre bucket
3. Regarder l'URL dans les propriétés :
   - Format : `bucket-name.s3.wasabisys.com`
   - Exemple : `yukpo-media.s3.wasabisys.com`

---

## 📝 Configuration Finale dans `.env`

Une fois que vous avez vos URLs CDN, éditez `mobile/.env` :

```env
# Configuration CDN pour distribution vidéo

# Cloudflare CDN (Global) - Remplacez par votre URL
EXPO_PUBLIC_CDN_CLOUDFLARE_URL=https://cdn.yukpo.app

# AWS CloudFront US (Région US-EAST) - Remplacez par votre URL
EXPO_PUBLIC_CDN_CLOUDFRONT_US_URL=https://d1234567890.cloudfront.net

# AWS CloudFront EU (Région EU-WEST) - Remplacez par votre URL
EXPO_PUBLIC_CDN_CLOUDFRONT_EU_URL=https://d0987654321.cloudfront.net
```

---

## ✅ Vérification

### Tester votre CDN

1. **Cloudflare** :
   ```bash
   curl -I https://cdn.yukpo.app/video-example.mp4
   ```
   Vous devriez voir `HTTP/2 200` ou `HTTP/2 301`

2. **CloudFront** :
   ```bash
   curl -I https://d1234567890.cloudfront.net/video-example.mp4
   ```
   Vous devriez voir `HTTP/2 200`

### Dans l'Application

1. Redémarrer l'application :
   ```bash
   cd mobile
   npm start
   ```

2. Tester la lecture vidéo dans le feed
3. Vérifier les logs pour voir quelle URL CDN est utilisée

---

## 🆘 Dépannage

### Problème : CDN ne fonctionne pas

1. **Vérifier les permissions** :
   - S3/Wasabi bucket doit être public en lecture
   - CORS doit être configuré correctement

2. **Vérifier la configuration** :
   - Les URLs dans `.env` sont correctes
   - Pas d'espaces ou de caractères spéciaux

3. **Vérifier les logs** :
   - Regarder les erreurs dans la console
   - Vérifier les requêtes réseau

### Problème : Vidéos ne se chargent pas

1. **Vérifier les chemins** :
   - Les chemins dans la base de données correspondent aux chemins dans le bucket

2. **Vérifier CORS** :
   - Le bucket doit autoriser les requêtes depuis votre domaine mobile

---

## 💡 Recommandation

**Pour commencer rapidement** :
1. Utiliser **Cloudflare** (gratuit et simple)
2. Configurer un sous-domaine `cdn.yukpo.app`
3. Pointer vers votre bucket S3/Wasabi

**Pour la production à grande échelle** :
1. Utiliser **AWS CloudFront** pour US
2. Utiliser **Cloudflare** pour EU (ou une deuxième distribution CloudFront)
3. Configurer la détection automatique du meilleur endpoint

---

*Date : 2025-12-03*  
*Guide complet pour configuration CDN*

