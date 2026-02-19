# 🔧 Guide : Configuration Réseau - CloudFront et DNS

**Date**: 2026-02-14  
**Problème**: Load Balancer non activé, configuration CloudFront et DNS nécessaires

---

## ⚠️ Problème Identifié

1. **Load Balancer non activé** : Le compte AWS nécessite l'activation des Load Balancers par AWS Support
2. **Fichier manquant** : `cloudfront-config.json` non trouvé lors de l'exécution
3. **Chemin incorrect** : Script PowerShell exécuté depuis un mauvais répertoire

---

## ✅ Solutions Créées

### 1. Fichier de Configuration CloudFront pour Backend API

**Fichier créé** : `cloudfront-config-backend-api.json`

Ce fichier configure CloudFront pour pointer vers l'IP directe du backend (`52.211.202.11:8080`) en attendant l'activation du Load Balancer.

### 2. Script PowerShell Corrigé

**Fichier créé** : `scripts/creer-cloudfront-backend-api.ps1`

Ce script :
- ✅ Récupère automatiquement l'IP publique actuelle du backend ECS
- ✅ Met à jour la configuration CloudFront avec l'IP actuelle
- ✅ Crée la distribution CloudFront
- ✅ Utilise les chemins absolus (fonctionne depuis n'importe quel répertoire)

### 3. Script Principal Corrigé

**Fichier modifié** : `scripts/configurer-tout-automatiquement.ps1`

Le script a été corrigé pour :
- ✅ Utiliser les chemins absolus
- ✅ Changer vers le répertoire du projet automatiquement
- ✅ Trouver les fichiers de configuration correctement

---

## 🚀 Utilisation

### Option 1 : Créer CloudFront pour Backend API (Recommandé)

```powershell
# Depuis n'importe quel répertoire
cd C:\Users\23767\yukpomnang2
powershell -ExecutionPolicy Bypass -File scripts\creer-cloudfront-backend-api.ps1
```

**Ce que fait le script** :
1. Récupère l'IP publique actuelle du backend ECS
2. Met à jour `cloudfront-config-backend-api.json` avec l'IP actuelle
3. Crée la distribution CloudFront
4. Affiche l'ID et le domaine CloudFront créé

**Après création** :
- Attendre 5-15 minutes pour le déploiement
- Configurer le DNS : `api.yukpomnang.com` → CNAME vers le domaine CloudFront
- Mettre à jour `production (2).json` avec l'URL CloudFront

### Option 2 : Configuration Complète (DNS + CloudFront)

```powershell
# Depuis n'importe quel répertoire
cd C:\Users\23767\yukpomnang2
powershell -ExecutionPolicy Bypass -File scripts\configurer-tout-automatiquement.ps1
```

**Avec credentials Cloudflare** :
```powershell
powershell -ExecutionPolicy Bypass -File scripts\configurer-tout-automatiquement.ps1 `
    -CloudflareAPIKey "VOTRE_TOKEN" `
    -Subdomain "api"
```

### Option 3 : Création Manuelle CloudFront

Si les scripts ne fonctionnent pas, créez manuellement :

1. **Récupérer l'IP publique actuelle** :
```powershell
aws ecs list-tasks --cluster yukpo-cluster --service-name yukpo-backend-service --region eu-west-1 --desired-status RUNNING --query 'taskArns[0]' --output text
```

2. **Créer la distribution via AWS CLI** :
```powershell
cd C:\Users\23767\yukpomnang2
aws cloudfront create-distribution --distribution-config file://cloudfront-config-backend-api.json --output json
```

3. **OU via AWS Console** :
   - Aller sur https://console.aws.amazon.com/cloudfront/
   - Cliquer sur "Create Distribution"
   - Origin Domain : `52.211.202.11` (IP actuelle)
   - Origin Protocol : HTTP
   - Origin Port : 8080
   - Viewer Protocol Policy : Redirect HTTP to HTTPS
   - Allowed HTTP Methods : GET, HEAD, OPTIONS, PUT, POST, PATCH, DELETE
   - Cache Policy : CachingDisabled (pour API)
   - Price Class : Use only North America and Europe
   - Cliquer sur "Create Distribution"

---

## 📋 Configuration DNS

### Via Cloudflare (Si utilisé)

1. Aller sur https://dash.cloudflare.com
2. Sélectionner le domaine `yukpomnang.com`
3. DNS → Enregistrements → Créer/Modifier `api`
4. **Type** : CNAME
5. **Target** : `<domain-cloudfront>.cloudfront.net` (ex: `d1234567890abc.cloudfront.net`)
6. **Proxy** : ⚠️ **Désactiver** (nuage gris)
7. **TTL** : Auto
8. Sauvegarder

### Via Route53 (Si utilisé)

1. Aller sur AWS Console → Route53
2. Hosted Zones → `yukpomnang.com`
3. Créer/Modifier l'enregistrement pour `api`
4. **Type** : CNAME
5. **Valeur** : `<domain-cloudfront>.cloudfront.net`
6. **TTL** : 300
7. Sauvegarder

---

## ⚠️ Notes Importantes

1. **IP Changeante** : L'IP publique du backend ECS peut changer à chaque redémarrage. Pour une solution stable :
   - Activer le Load Balancer (nécessite AWS Support)
   - OU utiliser un script qui met à jour automatiquement CloudFront

2. **CloudFront Custom Origin** : CloudFront peut pointer vers une IP, mais :
   - L'IP doit être accessible publiquement
   - Le port doit être ouvert (8080)
   - Le Security Group doit autoriser le trafic depuis CloudFront

3. **HTTPS** : CloudFront fournit HTTPS automatiquement, même si l'origine est HTTP.

4. **Cache** : Pour une API, désactiver le cache ou utiliser `Cache-Control: no-cache` dans les réponses.

---

## 🔍 Vérification

### Vérifier que CloudFront fonctionne

```powershell
# Récupérer le domaine CloudFront
aws cloudfront list-distributions --query 'DistributionList.Items[*].[Id,DomainName,Status]' --output table

# Tester l'accès
curl https://<domain-cloudfront>.cloudfront.net/health
```

### Vérifier le DNS

```powershell
nslookup api.yukpomnang.com
# ou
dig api.yukpomnang.com
```

---

## 📞 Support

Si les scripts ne fonctionnent pas :
1. Vérifier que vous êtes dans le bon répertoire : `C:\Users\23767\yukpomnang2`
2. Vérifier les permissions AWS CLI : `aws sts get-caller-identity`
3. Vérifier que l'IP du backend est accessible : `curl http://52.211.202.11:8080/health`

---

**Besoin d'aide ?** Dites-moi où vous en êtes et je vous guiderai !



