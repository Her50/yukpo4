# 🌐 Guide Complet : Configuration DNS Route53 et Vérification CDN

**Date**: 2026-02-14  
**Compte AWS**: 108964700972 (eu-west-1)  
**Domaine**: api.yukpomnang.com

---

## 📊 État Actuel

### ✅ Backend ECS
- **IP Publique**: `52.211.202.11:8080`
- **Statut**: ✅ Accessible directement
- **Cluster**: `yukpo-cluster`
- **Service**: `yukpo-backend-service`

### ⚠️ DNS
- **Domaine**: `api.yukpomnang.com`
- **Statut**: ❌ Non résolu (pas de configuration DNS)
- **Action Requise**: Configurer le DNS pour pointer vers le backend

### ⚠️ CloudFront
- **Distribution utilisée**: `d3jyvgg46kev8.cloudfront.net`
- **Statut**: ❌ Non trouvée dans le nouveau compte AWS
- **Action Requise**: Vérifier si elle existe dans l'ancien compte ou créer une nouvelle distribution

### ℹ️ Cloudflare
- **Service**: Externe (pas AWS)
- **Statut**: À vérifier dans Cloudflare Dashboard
- **Action Requise**: Vérifier si le domaine est géré par Cloudflare

---

## 🔧 Solution 1 : Configuration DNS Route53 (Recommandé)

### Option A : Avec Load Balancer (Meilleure Solution)

**Avantages** :
- ✅ URL stable (ne change pas à chaque redémarrage ECS)
- ✅ Haute disponibilité
- ✅ Gestion automatique des tâches ECS

**Étapes** :

1. **Activer le Load Balancer dans Terraform** :
   ```bash
   # Éditer infra/aws/terraform.tfvars
   enable_load_balancer = true
   ```

2. **Appliquer Terraform** :
   ```bash
   cd infra/aws
   terraform apply
   ```

3. **Configurer Route53** :
   ```bash
   # Utiliser le script automatique
   powershell -ExecutionPolicy Bypass -File scripts\mettre-a-jour-dns-route53.ps1
   ```

   **OU manuellement via AWS Console** :
   - Aller dans Route53 → Hosted Zones → yukpomnang.com
   - Créer/Modifier l'enregistrement A pour `api.yukpomnang.com`
   - Type : A (Alias)
   - Alias Target : Sélectionner le Load Balancer
   - Évaluer la santé : Oui

---

### Option B : Sans Load Balancer (Solution Temporaire)

**⚠️ Attention** : L'IP peut changer à chaque redémarrage ECS

**Étapes** :

1. **Récupérer l'IP publique actuelle** :
   ```bash
   powershell -ExecutionPolicy Bypass -File scripts\verifier-backend-direct.ps1
   ```

2. **Configurer Route53 manuellement** :
   - Aller dans Route53 → Hosted Zones → yukpomnang.com
   - Créer/Modifier l'enregistrement A pour `api.yukpomnang.com`
   - Type : A
   - Valeur : `52.211.202.11` (IP actuelle)
   - TTL : 300 (5 minutes)

3. **⚠️ Important** : Mettre à jour manuellement à chaque changement d'IP

---

## 🔧 Solution 2 : Configuration DNS Cloudflare (Si utilisé)

Si votre domaine `yukpomnang.com` est géré par Cloudflare :

1. **Aller sur Cloudflare Dashboard** :
   - URL : https://dash.cloudflare.com
   - Sélectionner le domaine `yukpomnang.com`

2. **Configurer l'enregistrement DNS** :
   - Aller dans **DNS** → **Enregistrements**
   - Trouver ou créer l'enregistrement pour `api.yukpomnang.com`
   - **Type** : A
   - **Nom** : api
   - **IPv4** : `52.211.202.11`
   - **Proxy** : ⚠️ **Désactiver** (nuage gris) pour un accès direct au backend
   - **TTL** : Auto

3. **Sauvegarder**

**Note** : Si vous activez le proxy Cloudflare (nuage orange), les requêtes passeront par Cloudflare, ce qui peut causer des problèmes avec les webhooks et l'authentification OAuth.

---

## 📦 Solution 3 : Vérification et Configuration CloudFront

### Vérifier la Distribution Existante

La distribution `d3jyvgg46kev8.cloudfront.net` peut être :
1. **Dans l'ancien compte AWS** → À migrer ou recréer
2. **Dans le nouveau compte** → À vérifier qu'elle pointe vers le bon bucket

**Commande de vérification** :
```bash
aws cloudfront list-distributions --region eu-west-1 \
  --query 'DistributionList.Items[*].[Id,DomainName,Origins.Items[0].DomainName,Status]' \
  --output table
```

### Créer une Nouvelle Distribution CloudFront

Si la distribution n'existe pas dans le nouveau compte :

1. **Aller dans AWS Console** → CloudFront → Create Distribution

2. **Configurer l'Origine** :
   - **Origin Domain** : `yukpo-backend-media.s3.eu-west-1.amazonaws.com`
   - **Origin Path** : (laisser vide)
   - **Name** : `yukpo-backend-media-origin`

3. **Configurer le Comportement par Défaut** :
   - **Viewer Protocol Policy** : `Redirect HTTP to HTTPS`
   - **Allowed HTTP Methods** : `GET, HEAD, OPTIONS`
   - **Cache Policy** : `CachingOptimized`
   - **Origin Request Policy** : `CORS-S3Origin` (si CORS activé)

4. **Configurer les Paramètres** :
   - **Price Class** : `Use only North America and Europe` (économique)
   - **Alternate Domain Names (CNAMEs)** : (optionnel) `cdn.yukpomnang.com`
   - **SSL Certificate** : (si vous avez un domaine) sélectionner ou créer un certificat

5. **Créer la Distribution** :
   - Cliquer sur **Create Distribution**
   - Attendre 5-15 minutes pour le déploiement
   - Copier le **Domain Name** (ex: `d1234567890abcdef.cloudfront.net`)

6. **Mettre à jour la Configuration Mobile** :
   ```json
   // production (2).json
   {
     "EXPO_PUBLIC_CDN_CLOUDFLARE_URL": "https://d1234567890abcdef.cloudfront.net"
   }
   ```

---

## 🔍 Vérification Cloudflare CDN (Service Externe)

Cloudflare est un service externe (pas AWS). Si vous l'utilisez pour le CDN :

1. **Aller sur Cloudflare Dashboard** :
   - URL : https://dash.cloudflare.com
   - Sélectionner le domaine `yukpomnang.com`

2. **Vérifier la Configuration CDN** :
   - Aller dans **DNS** → Vérifier l'enregistrement `cdn.yukpomnang.com`
   - Aller dans **Workers** → Vérifier les Workers pour le CDN
   - Aller dans **Rules** → Vérifier les Page Rules ou Transform Rules

3. **Vérifier l'Origine** :
   - L'origine doit pointer vers :
     - `yukpo-backend-media.s3.eu-west-1.amazonaws.com` (nouveau bucket)
     - OU `yukpo-video-prod.s3.eu-central-1.wasabisys.com` (Wasabi)

---

## 📋 Checklist Complète

### DNS
- [ ] Vérifier où est géré le domaine `yukpomnang.com` (Route53, Cloudflare, autre)
- [ ] Configurer `api.yukpomnang.com` pour pointer vers le backend
- [ ] Tester la résolution DNS : `nslookup api.yukpomnang.com`
- [ ] Tester l'accès : `curl https://api.yukpomnang.com/health`

### CloudFront
- [ ] Vérifier si `d3jyvgg46kev8.cloudfront.net` existe dans le nouveau compte
- [ ] Si non, créer une nouvelle distribution CloudFront
- [ ] Vérifier que l'origine pointe vers `yukpo-backend-media.s3.eu-west-1.amazonaws.com`
- [ ] Mettre à jour `EXPO_PUBLIC_CDN_CLOUDFLARE_URL` si nécessaire

### Cloudflare (Si utilisé)
- [ ] Vérifier la configuration DNS dans Cloudflare Dashboard
- [ ] Vérifier la configuration CDN (Workers, Rules)
- [ ] Vérifier que l'origine pointe vers le nouveau bucket

### Load Balancer (Recommandé)
- [ ] Activer le Load Balancer dans Terraform
- [ ] Appliquer Terraform
- [ ] Configurer Route53 pour pointer vers le Load Balancer

---

## 🚀 Actions Immédiates

### Priorité 1 : DNS (Critique)
1. **Déterminer où est géré le domaine** :
   - Route53 ? → Utiliser `scripts/mettre-a-jour-dns-route53.ps1`
   - Cloudflare ? → Configurer manuellement dans Cloudflare Dashboard
   - Autre ? → Configurer selon le fournisseur

2. **Configurer `api.yukpomnang.com`** :
   - Option A : Load Balancer (recommandé)
   - Option B : IP directe (temporaire)

### Priorité 2 : CloudFront
1. **Vérifier la distribution** :
   ```bash
   aws cloudfront list-distributions --region eu-west-1
   ```

2. **Si non trouvée** :
   - Créer une nouvelle distribution
   - Mettre à jour `production (2).json`

### Priorité 3 : Cloudflare (Si utilisé)
1. **Vérifier dans Cloudflare Dashboard**
2. **Mettre à jour l'origine si nécessaire**

---

## 📝 Notes Importantes

1. **IP ECS Changeante** :
   - L'IP publique de l'ECS peut changer à chaque redémarrage
   - **Solution** : Utiliser un Load Balancer pour une URL stable

2. **Propagation DNS** :
   - Les changements DNS peuvent prendre 2-48 heures pour se propager
   - En général, c'est 5-15 minutes pour Route53

3. **CloudFront vs Cloudflare** :
   - **CloudFront** : Service AWS (payant mais intégré)
   - **Cloudflare** : Service externe (gratuit jusqu'à 100 Go/mois)
   - Vous pouvez utiliser les deux (Cloudflare pour DNS, CloudFront pour CDN)

4. **Proxy Cloudflare** :
   - Si activé (nuage orange), les requêtes passent par Cloudflare
   - Peut causer des problèmes avec les webhooks et OAuth
   - **Recommandation** : Désactiver le proxy pour `api.yukpomnang.com`

---

## 🔗 Ressources

- **Scripts** :
  - `scripts/configurer-dns-et-verifier-cdn.ps1` - Vérification complète
  - `scripts/mettre-a-jour-dns-route53.ps1` - Configuration Route53 avec Load Balancer
  - `scripts/verifier-backend-direct.ps1` - Vérification IP backend

- **Documentation AWS** :
  - Route53 : https://docs.aws.amazon.com/route53/
  - CloudFront : https://docs.aws.amazon.com/cloudfront/
  - ECS : https://docs.aws.amazon.com/ecs/

- **Documentation Cloudflare** :
  - DNS : https://developers.cloudflare.com/dns/
  - Workers : https://developers.cloudflare.com/workers/

---

**Document généré le**: 2026-02-14



