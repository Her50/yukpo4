# 🎯 Guide Pratique : Obtenir les Vraies Valeurs CDN

## 🚀 Méthode Rapide (5 minutes)

### Option 1 : Utiliser votre Bucket S3/Wasabi Directement (Sans CDN)

Si vous n'avez pas encore de CDN configuré, vous pouvez utiliser directement votre bucket S3/Wasabi comme URL CDN.

#### Pour AWS S3 :

1. **Trouver votre bucket** :
   - Aller sur [AWS S3 Console](https://console.aws.amazon.com/s3/)
   - Noter le nom de votre bucket (ex: `yukpo-media`)

2. **Obtenir l'URL** :
   - Format : `https://bucket-name.s3.region.amazonaws.com`
   - Exemple : `https://yukpo-media.s3.us-east-1.amazonaws.com`

3. **Ajouter dans `.env`** :
   ```env
   EXPO_PUBLIC_CDN_CLOUDFLARE_URL=https://yukpo-media.s3.us-east-1.amazonaws.com
   ```

#### Pour Wasabi :

1. **Trouver votre bucket** :
   - Aller sur [Wasabi Console](https://console.wasabi.com/)
   - Noter le nom de votre bucket

2. **Obtenir l'URL** :
   - Format : `https://bucket-name.s3.wasabisys.com`
   - Exemple : `https://yukpo-media.s3.wasabisys.com`

3. **Ajouter dans `.env`** :
   ```env
   EXPO_PUBLIC_CDN_CLOUDFLARE_URL=https://yukpo-media.s3.wasabisys.com
   ```

---

## 🌐 Méthode Complète : Configurer un Vrai CDN

### Étape 1 : Identifier votre Storage Actuel

**Question** : Où sont stockées vos vidéos actuellement ?

- [ ] AWS S3
- [ ] Wasabi
- [ ] Autre (précisez)

**Comment trouver** :
1. Regarder dans votre backend les variables d'environnement
2. Chercher `AWS_`, `S3_`, `WASABI_`, `BUCKET` dans les fichiers de config
3. Regarder les logs lors de l'upload d'une vidéo

---

### Étape 2 : Configurer Cloudflare (Gratuit - 10 minutes)

#### 2.1 Créer un compte Cloudflare

1. Aller sur [cloudflare.com](https://www.cloudflare.com)
2. Cliquer sur **"Sign Up"** (gratuit)
3. Vérifier votre email

#### 2.2 Ajouter votre domaine

1. Dans le dashboard, cliquer sur **"Add a Site"**
2. Entrer votre domaine (ex: `yukpo.app`)
3. Choisir le plan **Free**
4. Suivre les instructions pour changer les DNS

**Note** : Si vous n'avez pas de domaine, vous pouvez utiliser un sous-domaine gratuit de Cloudflare Pages.

#### 2.3 Créer un sous-domaine CDN

1. Dans Cloudflare Dashboard > **DNS**
2. Cliquer sur **"Add record"**
3. Configurer :
   ```
   Type: CNAME
   Name: cdn
   Target: votre-bucket.s3.amazonaws.com
   Proxy: ✅ Proxied (orange cloud)
   ```
4. Cliquer sur **"Save"**

#### 2.4 Obtenir l'URL CDN

Votre URL sera : `https://cdn.votre-domaine.com`

**Exemple** : Si votre domaine est `yukpo.app`, l'URL sera `https://cdn.yukpo.app`

**Ajouter dans `.env`** :
```env
EXPO_PUBLIC_CDN_CLOUDFLARE_URL=https://cdn.yukpo.app
```

---

### Étape 3 : Configurer AWS CloudFront (Payant - 15 minutes)

#### 3.1 Prérequis

- Compte AWS actif
- Bucket S3 avec vos vidéos

#### 3.2 Créer une Distribution CloudFront

1. Aller sur [AWS CloudFront Console](https://console.aws.amazon.com/cloudfront/)
2. Cliquer sur **"Create Distribution"**

#### 3.3 Configurer l'Origine

1. **Origin Domain** : Sélectionner votre bucket S3 dans la liste
2. **Origin Path** : Laisser vide (ou `/videos` si vos vidéos sont dans un sous-dossier)
3. **Origin Name** : Généré automatiquement

#### 3.4 Configurer le Comportement

1. **Viewer Protocol Policy** : `Redirect HTTP to HTTPS`
2. **Allowed HTTP Methods** : `GET, HEAD, OPTIONS`
3. **Cache Policy** : `CachingOptimized`
4. **Price Class** : `Use only North America and Europe` (économique)

#### 3.5 Créer la Distribution

1. Cliquer sur **"Create Distribution"**
2. Attendre 5-15 minutes pour le déploiement
3. Une fois déployé, copier le **Domain Name**

**Exemple** : `d1234567890abcdef.cloudfront.net`

#### 3.6 Obtenir l'URL CloudFront

L'URL sera : `https://d1234567890abcdef.cloudfront.net`

**Ajouter dans `.env`** :
```env
EXPO_PUBLIC_CDN_CLOUDFRONT_US_URL=https://d1234567890abcdef.cloudfront.net
```

---

## 🔍 Méthode Alternative : Trouver dans le Code

### Chercher dans les fichiers de configuration

1. **Backend** :
   ```bash
   cd backend
   grep -r "S3\|Wasabi\|BUCKET\|STORAGE" .env* config/
   ```

2. **Frontend** :
   ```bash
   cd frontend
   grep -r "S3\|Wasabi\|BUCKET\|STORAGE" .env* config/
   ```

3. **Mobile** :
   ```bash
   cd mobile
   grep -r "S3\|Wasabi\|BUCKET\|STORAGE" .env* config/
   ```

---

## 📝 Template Final pour `.env`

Une fois que vous avez vos URLs, éditez `mobile/.env` :

```env
# Configuration CDN pour distribution vidéo

# Option 1 : Cloudflare (Recommandé - Gratuit)
EXPO_PUBLIC_CDN_CLOUDFLARE_URL=https://cdn.yukpo.app

# Option 2 : AWS CloudFront US
EXPO_PUBLIC_CDN_CLOUDFRONT_US_URL=https://d1234567890abcdef.cloudfront.net

# Option 3 : AWS CloudFront EU (Optionnel)
EXPO_PUBLIC_CDN_CLOUDFRONT_EU_URL=https://d0987654321abcdef.cloudfront.net

# Option 4 : Direct S3/Wasabi (Sans CDN - Fallback automatique)
# Si aucune URL CDN n'est configurée, le système utilisera le backend direct
```

---

## ✅ Vérification Rapide

### Tester votre URL CDN

1. **Ouvrir un navigateur**
2. **Tester l'URL** :
   - Cloudflare : `https://cdn.yukpo.app/test-video.mp4`
   - CloudFront : `https://d1234567890abcdef.cloudfront.net/test-video.mp4`
   - S3 Direct : `https://bucket-name.s3.amazonaws.com/test-video.mp4`

3. **Si vous voyez** :
   - ✅ `200 OK` ou redirection → URL valide
   - ❌ `404 Not Found` → Vérifier le chemin
   - ❌ `403 Forbidden` → Vérifier les permissions

---

## 🆘 Besoin d'Aide ?

### Si vous ne savez pas où sont vos vidéos :

1. **Regarder les logs backend** lors de l'upload d'une vidéo
2. **Chercher dans la base de données** la table `media` pour voir les chemins
3. **Demander à votre équipe** où est configuré le storage

### Si vous n'avez pas de bucket S3/Wasabi :

1. **Créer un bucket S3** (gratuit jusqu'à 5 Go)
2. **Ou créer un compte Wasabi** (gratuit jusqu'à 1 To)
3. **Configurer le bucket** pour stocker vos vidéos

---

## 🎯 Recommandation Finale

**Pour commencer rapidement** :
1. Utiliser directement votre bucket S3/Wasabi comme URL CDN
2. Plus tard, configurer Cloudflare pour de meilleures performances

**Exemple minimal** :
```env
EXPO_PUBLIC_CDN_CLOUDFLARE_URL=https://yukpo-media.s3.us-east-1.amazonaws.com
```

Cela fonctionnera immédiatement sans configuration supplémentaire !

---

*Date : 2025-12-03*  
*Guide pratique pour obtenir les vraies valeurs CDN*

