# 🔍 Diagnostic : Images Produits Non Visibles

## 🎯 Problème Identifié

Les images des produits ne s'affichent pas lors des recherches. **Ce n'est PAS lié au Load Balancer AWS** (qui n'est même pas encore activé).

## 🔴 Causes Probables

### 1. **UPLOAD_BASE_URL Non Configuré** (Cause la plus probable)

**Symptôme :** Les URLs d'images sont des chemins relatifs (`uploads/products/123/image.jpg`) au lieu d'URLs complètes.

**Vérification :**
```bash
# Vérifier dans votre backend (Hetzner ou autre)
echo $UPLOAD_BASE_URL
# ou
env | grep UPLOAD_BASE_URL
```

**Solution :**
```bash
# Pour Wasabi
UPLOAD_BASE_URL=https://yukpo-video-prod.s3.eu-central-1.wasabisys.com

# Pour AWS S3
UPLOAD_BASE_URL=https://yukpo-backend.s3.eu-west-1.amazonaws.com

# Avec CloudFront CDN
UPLOAD_BASE_URL=https://d1234567890.cloudfront.net
```

---

### 2. **Permissions S3/Wasabi - Accès Public**

**Symptôme :** Les URLs sont correctes mais retournent 403 Forbidden.

**Vérification :**
- Allez sur votre bucket S3/Wasabi
- Vérifiez les permissions du dossier `uploads/products/`
- Les objets doivent être publics OU utiliser des URLs pré-signées

**Solution :**
- **Option A :** Activer l'accès public sur le bucket (moins sécurisé)
- **Option B :** Utiliser des URLs pré-signées (plus sécurisé, nécessite modification du code)
- **Option C :** Utiliser CloudFront avec OAI (Origin Access Identity) - recommandé

---

### 3. **CORS Non Configuré**

**Symptôme :** Les images ne se chargent pas depuis le frontend (erreur CORS dans la console).

**Solution :**
Ajouter une politique CORS sur votre bucket S3/Wasabi :

```json
[
    {
        "AllowedHeaders": ["*"],
        "AllowedMethods": ["GET", "HEAD"],
        "AllowedOrigins": ["https://votre-domaine.com", "https://app.votre-domaine.com"],
        "ExposeHeaders": [],
        "MaxAgeSeconds": 3000
    }
]
```

---

### 4. **URLs Incorrectes dans la Base de Données**

**Vérification :**
```sql
-- Vérifier les URLs stockées dans la table media
SELECT id, path, service_id, product_id 
FROM media 
WHERE type = 'image' 
LIMIT 10;

-- Vérifier dans product_data
SELECT 
    id, 
    product_data->>'images' as images,
    product_data->>'imageUrls' as imageUrls
FROM service_products 
LIMIT 5;
```

**Si les URLs sont des chemins relatifs :**
- Les images ont été uploadées mais `UPLOAD_BASE_URL` n'était pas configuré
- Il faut soit :
  - Configurer `UPLOAD_BASE_URL` et redémarrer le backend
  - OU mettre à jour les URLs dans la base de données

---

## ✅ Solutions par Ordre de Priorité

### Solution 1 : Configurer UPLOAD_BASE_URL (IMMÉDIAT)

1. **Identifier votre bucket S3/Wasabi :**
   ```bash
   # Vérifier la variable S3_BUCKET
   echo $S3_BUCKET
   ```

2. **Configurer UPLOAD_BASE_URL :**
   ```bash
   # Pour Wasabi
   export UPLOAD_BASE_URL=https://yukpo-video-prod.s3.eu-central-1.wasabisys.com
   
   # Pour AWS S3
   export UPLOAD_BASE_URL=https://${S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com
   ```

3. **Redémarrer le backend** pour que les nouvelles URLs soient générées

---

### Solution 2 : Vérifier les Permissions S3/Wasabi

1. Allez sur votre console S3/Wasabi
2. Sélectionnez votre bucket
3. Onglet "Permissions" ou "Access Control"
4. Vérifiez que les objets dans `uploads/products/` sont accessibles publiquement

---

### Solution 3 : Configurer CloudFront (Recommandé pour Production)

1. Créer une distribution CloudFront pointant vers votre bucket S3
2. Configurer OAI (Origin Access Identity) pour la sécurité
3. Mettre à jour `UPLOAD_BASE_URL` avec l'URL CloudFront
4. Avantages :
   - ✅ CDN global (meilleure latence pour l'Afrique)
   - ✅ HTTPS automatique
   - ✅ Cache intelligent
   - ✅ Protection DDoS

---

## 🔍 Diagnostic Rapide

### Test 1 : Vérifier une URL d'Image

```bash
# Récupérer une URL depuis la base de données
# Puis tester dans le navigateur ou avec curl
curl -I "https://votre-bucket.s3.region.amazonaws.com/uploads/products/123/image.jpg"
```

**Résultat attendu :** `HTTP/1.1 200 OK`

**Si 403 Forbidden :** Problème de permissions
**Si 404 Not Found :** L'image n'existe pas à cet emplacement

---

### Test 2 : Vérifier la Configuration Backend

```bash
# Sur votre serveur backend
curl http://localhost:8080/health
# Vérifier les logs pour voir les warnings sur UPLOAD_BASE_URL
```

---

### Test 3 : Vérifier les URLs dans la Réponse API

```bash
# Faire une recherche de produits
curl https://votre-api.com/api/search?q=test

# Vérifier que les URLs d'images sont complètes (commencent par http:// ou https://)
# et non des chemins relatifs (uploads/products/...)
```

---

## 📋 Checklist de Résolution

- [ ] `UPLOAD_BASE_URL` est configuré et correct
- [ ] Le backend a été redémarré après configuration
- [ ] Les permissions S3/Wasabi permettent l'accès public (ou URLs pré-signées)
- [ ] CORS est configuré sur le bucket
- [ ] Les URLs dans la base de données sont complètes (commencent par http/https)
- [ ] CloudFront est configuré (optionnel mais recommandé)

---

## 🚀 Action Immédiate

**1. Vérifiez votre configuration actuelle :**
```bash
# Sur votre serveur backend (Hetzner ou autre)
env | grep -E "UPLOAD_BASE_URL|S3_BUCKET|S3_REGION"
```

**2. Si UPLOAD_BASE_URL est vide ou incorrect :**
- Configurez-le avec l'URL de votre bucket S3/Wasabi
- Redémarrez le backend

**3. Testez :**
- Faites une recherche de produits
- Vérifiez dans la console du navigateur (F12) les erreurs de chargement d'images
- Vérifiez que les URLs d'images sont complètes

---

## 💡 Note Importante

Le Load Balancer AWS n'a **AUCUN impact** sur l'affichage des images car :
- Les images sont servies directement depuis S3/Wasabi
- Le Load Balancer ne fait que router les requêtes API vers ECS
- Les URLs d'images sont stockées dans la base de données et servies directement depuis S3

Le problème est **100% lié à la configuration S3/Wasabi**, pas à l'infrastructure AWS.

