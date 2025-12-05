# ⚡ Guide Rapide : Obtenir les Vraies Valeurs CDN

## 🎯 3 Options Simples

### Option 1 : Utiliser S3/Wasabi Directement (Le Plus Rapide)

**Si vous avez déjà un bucket S3 ou Wasabi** :

1. **Trouver le nom de votre bucket** :
   - AWS S3 : [console.aws.amazon.com/s3](https://console.aws.amazon.com/s3/)
   - Wasabi : [console.wasabi.com](https://console.wasabi.com/)

2. **Construire l'URL** :
   - **S3** : `https://NOM-BUCKET.s3.REGION.amazonaws.com`
     - Exemple : `https://yukpo-media.s3.us-east-1.amazonaws.com`
   - **Wasabi** : `https://NOM-BUCKET.s3.wasabisys.com`
     - Exemple : `https://yukpo-media.s3.wasabisys.com`

3. **Ajouter dans `mobile/.env`** :
   ```env
   EXPO_PUBLIC_CDN_CLOUDFLARE_URL=https://NOM-BUCKET.s3.us-east-1.amazonaws.com
   ```

**✅ Avantage** : Fonctionne immédiatement, pas de configuration supplémentaire

---

### Option 2 : Cloudflare (Gratuit - 10 minutes)

1. **Créer un compte** : [cloudflare.com](https://www.cloudflare.com) (gratuit)
2. **Ajouter votre domaine** (ou utiliser un sous-domaine)
3. **Créer un CNAME** :
   - Nom : `cdn`
   - Target : Votre bucket S3/Wasabi
   - Proxy : ✅ Activé
4. **Obtenir l'URL** : `https://cdn.votre-domaine.com`

**✅ Avantage** : Gratuit, performance excellente, protection DDoS

---

### Option 3 : AWS CloudFront (Payant - 15 minutes)

1. **Aller sur** : [console.aws.amazon.com/cloudfront](https://console.aws.amazon.com/cloudfront/)
2. **Créer une distribution** :
   - Origin : Votre bucket S3
   - Viewer Protocol : HTTPS only
   - Price Class : North America and Europe (économique)
3. **Attendre 5-15 minutes** pour le déploiement
4. **Copier le Domain Name** : `d1234567890abcdef.cloudfront.net`

**✅ Avantage** : Performance maximale, intégration native S3

---

## 🔍 Comment Trouver votre Bucket Actuel ?

### Méthode 1 : Dans AWS Console

1. Aller sur [AWS S3 Console](https://console.aws.amazon.com/s3/)
2. Voir la liste de vos buckets
3. Noter le nom du bucket qui contient vos vidéos

### Méthode 2 : Dans les Logs Backend

1. Uploader une vidéo
2. Regarder les logs backend
3. Chercher l'URL du bucket dans les logs

### Méthode 3 : Dans la Base de Données

1. Connecter à PostgreSQL
2. Requête :
   ```sql
   SELECT DISTINCT path FROM media WHERE type = 'video' LIMIT 10;
   ```
3. Analyser les chemins pour identifier le bucket

---

## 📝 Configuration Finale

Une fois que vous avez votre URL, éditez `mobile/.env` :

```env
# Remplacez par votre vraie URL
EXPO_PUBLIC_CDN_CLOUDFLARE_URL=https://votre-url-cdn.com
```

**Puis redémarrer l'app** :
```bash
cd mobile
npm start
```

---

## ✅ Test Rapide

Tester votre URL dans un navigateur :
```
https://votre-url-cdn.com/test-video.mp4
```

- ✅ **200 OK** → URL valide
- ❌ **404/403** → Vérifier permissions et chemin

---

## 🆘 Besoin d'Aide ?

**Si vous ne trouvez pas votre bucket** :
1. Regarder les variables d'environnement backend
2. Chercher dans les fichiers de config
3. Demander à votre équipe

**Si vous n'avez pas de bucket** :
1. Créer un bucket S3 (gratuit jusqu'à 5 Go)
2. Configurer les permissions publiques
3. Utiliser l'URL du bucket directement

---

*Guide rapide - 5 minutes pour configurer*

