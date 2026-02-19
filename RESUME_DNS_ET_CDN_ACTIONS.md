# 📋 Résumé : Configuration DNS et Vérification CDN

**Date**: 2026-02-14  
**Compte AWS**: 108964700972 (eu-west-1)

---

## ✅ État Actuel

### Backend ECS
- ✅ **IP Publique**: `52.211.202.11:8080`
- ✅ **Statut**: Accessible directement
- ✅ **Bucket S3**: `yukpo-backend-media` existe dans `eu-west-1`

### ⚠️ Problèmes Identifiés

1. **DNS non configuré** :
   - `api.yukpomnang.com` ne résout pas
   - Action requise : Configurer le DNS

2. **CloudFront non trouvé** :
   - Distribution `d3jyvgg46kev8.cloudfront.net` non trouvée dans le nouveau compte
   - Action requise : Vérifier dans l'ancien compte ou créer une nouvelle distribution

3. **Load Balancer non activé** :
   - Pas de Load Balancer trouvé
   - Action recommandée : Activer le Load Balancer pour une URL stable

---

## 🎯 Actions Requises (Par Priorité)

### 🔴 Priorité 1 : DNS (Critique)

**Objectif** : Faire fonctionner `api.yukpomnang.com`

#### Option A : Via Route53 (Si le domaine est géré par AWS)

1. **Vérifier si Route53 a accès** :
   ```bash
   aws route53 list-hosted-zones --query 'HostedZones[?Name==`yukpomnang.com.`]'
   ```

2. **Si la zone existe** :
   - Utiliser le script : `scripts/mettre-a-jour-dns-route53.ps1`
   - OU configurer manuellement dans AWS Console → Route53

3. **Si la zone n'existe pas** :
   - Créer une nouvelle zone hébergée dans Route53
   - OU utiliser un autre fournisseur DNS (Cloudflare, etc.)

#### Option B : Via Cloudflare (Si le domaine est géré par Cloudflare)

1. **Aller sur** : https://dash.cloudflare.com
2. **Sélectionner** : Domaine `yukpomnang.com`
3. **Aller dans** : DNS → Enregistrements
4. **Créer/Modifier** :
   - **Type** : A
   - **Nom** : api
   - **IPv4** : `52.211.202.11`
   - **Proxy** : ⚠️ **Désactiver** (nuage gris)
   - **TTL** : Auto

5. **Sauvegarder**

**⚠️ Important** : Si vous activez le proxy Cloudflare (nuage orange), cela peut causer des problèmes avec les webhooks et OAuth.

---

### 🟡 Priorité 2 : Load Balancer (Recommandé)

**Objectif** : Avoir une URL stable qui ne change pas à chaque redémarrage ECS

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

3. **Configurer Route53 pour pointer vers le Load Balancer** :
   - Utiliser le script : `scripts/mettre-a-jour-dns-route53.ps1`
   - OU configurer manuellement dans AWS Console

**Avantages** :
- ✅ URL stable (ne change pas)
- ✅ Haute disponibilité
- ✅ Gestion automatique des tâches ECS

---

### 🟡 Priorité 3 : CloudFront

**Objectif** : Vérifier/créer la distribution CloudFront pour le CDN

#### Vérifier la Distribution Existante

1. **Dans l'ancien compte AWS** :
   - Vérifier si `d3jyvgg46kev8.cloudfront.net` existe
   - Si oui, vérifier qu'elle pointe vers le bon bucket

2. **Dans le nouveau compte AWS** :
   ```bash
   aws cloudfront list-distributions --region eu-west-1 \
     --query 'DistributionList.Items[*].[Id,DomainName,Origins.Items[0].DomainName]' \
     --output table
   ```

#### Créer une Nouvelle Distribution (Si nécessaire)

1. **Aller dans** : AWS Console → CloudFront → Create Distribution

2. **Configurer** :
   - **Origin Domain** : `yukpo-backend-media.s3.eu-west-1.amazonaws.com`
   - **Viewer Protocol Policy** : `Redirect HTTP to HTTPS`
   - **Allowed HTTP Methods** : `GET, HEAD, OPTIONS`
   - **Cache Policy** : `CachingOptimized`
   - **Price Class** : `Use only North America and Europe`

3. **Créer et attendre** : 5-15 minutes pour le déploiement

4. **Mettre à jour** : `production (2).json` avec le nouveau Domain Name

---

### 🟢 Priorité 4 : Cloudflare CDN (Si utilisé)

**Objectif** : Vérifier la configuration Cloudflare CDN

1. **Aller sur** : https://dash.cloudflare.com
2. **Vérifier** :
   - DNS → Enregistrements pour `cdn.yukpomnang.com`
   - Workers → Workers pour le CDN
   - Rules → Page Rules ou Transform Rules
3. **Vérifier l'origine** :
   - Doit pointer vers : `yukpo-backend-media.s3.eu-west-1.amazonaws.com`

---

## 📝 Checklist Complète

### DNS
- [ ] Déterminer où est géré le domaine `yukpomnang.com`
  - [ ] Route53 (AWS)
  - [ ] Cloudflare
  - [ ] Autre fournisseur
- [ ] Configurer `api.yukpomnang.com` pour pointer vers le backend
- [ ] Tester : `nslookup api.yukpomnang.com`
- [ ] Tester : `curl https://api.yukpomnang.com/health`

### Load Balancer (Recommandé)
- [ ] Activer dans `infra/aws/terraform.tfvars`
- [ ] Appliquer Terraform
- [ ] Configurer Route53 pour pointer vers le Load Balancer

### CloudFront
- [ ] Vérifier si `d3jyvgg46kev8.cloudfront.net` existe dans l'ancien compte
- [ ] Vérifier si elle existe dans le nouveau compte
- [ ] Si non, créer une nouvelle distribution
- [ ] Vérifier que l'origine pointe vers `yukpo-backend-media.s3.eu-west-1.amazonaws.com`
- [ ] Mettre à jour `EXPO_PUBLIC_CDN_CLOUDFLARE_URL` si nécessaire

### Cloudflare (Si utilisé)
- [ ] Vérifier la configuration DNS dans Cloudflare Dashboard
- [ ] Vérifier la configuration CDN (Workers, Rules)
- [ ] Vérifier que l'origine pointe vers le nouveau bucket

---

## 🚀 Commandes Utiles

### Vérifier le DNS
```bash
nslookup api.yukpomnang.com
```

### Vérifier l'accès au backend
```bash
curl https://api.yukpomnang.com/health
```

### Vérifier CloudFront
```bash
aws cloudfront list-distributions --region eu-west-1 \
  --query 'DistributionList.Items[*].[Id,DomainName,Origins.Items[0].DomainName]' \
  --output table
```

### Vérifier Route53
```bash
aws route53 list-hosted-zones --query 'HostedZones[?Name==`yukpomnang.com.`]'
```

### Scripts Disponibles
```bash
# Vérification complète
powershell -ExecutionPolicy Bypass -File scripts\configurer-dns-et-verifier-cdn.ps1

# Configuration Route53 avec Load Balancer
powershell -ExecutionPolicy Bypass -File scripts\mettre-a-jour-dns-route53.ps1

# Vérification IP backend
powershell -ExecutionPolicy Bypass -File scripts\verifier-backend-direct.ps1
```

---

## 📚 Documentation

- **Guide Complet** : `GUIDE_CONFIGURATION_DNS_ET_CDN.md`
- **Scripts** : `scripts/configurer-dns-et-verifier-cdn.ps1`

---

## ⚠️ Notes Importantes

1. **IP ECS Changeante** :
   - L'IP `52.211.202.11` peut changer à chaque redémarrage ECS
   - **Solution** : Utiliser un Load Balancer

2. **Propagation DNS** :
   - Les changements DNS peuvent prendre 2-48 heures
   - En général, 5-15 minutes pour Route53

3. **Proxy Cloudflare** :
   - Si activé (nuage orange), peut causer des problèmes avec webhooks/OAuth
   - **Recommandation** : Désactiver pour `api.yukpomnang.com`

---

**Document généré le**: 2026-02-14



