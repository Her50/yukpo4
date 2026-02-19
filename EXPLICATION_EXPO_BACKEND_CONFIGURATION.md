# 🔍 Explication : Comment Expo Pointe vers le Backend

**Date**: 2026-02-14  
**Question**: Comment Expo pointe vers le nouveau backend AWS ?

---

## 🎯 Réponse : Le Domaine `api.yukpomnang.com` est le Même

### ✅ Pourquoi c'est la même configuration ?

Le domaine `https://api.yukpomnang.com` est un **domaine personnalisé** qui peut pointer vers **n'importe quel backend** via la configuration DNS (Route53).

**C'est normal que ce soit la même URL** - ce qui change, c'est **où le domaine pointe** dans AWS :

| Élément | Ancien Compte | Nouveau Compte |
|---------|---------------|----------------|
| **Domaine** | `api.yukpomnang.com` | `api.yukpomnang.com` ✅ **Même domaine** |
| **DNS (Route53)** | Pointe vers ancien ALB | Doit pointer vers nouveau ALB |
| **Load Balancer** | Ancien compte AWS | Nouveau compte AWS (`108964700972`) |
| **Cluster ECS** | `yukpomnang-cluster` | `yukpo-cluster` |
| **Service ECS** | `yukpomnang-backend-service` | `yukpo-backend-service` |

---

## 📋 Configuration Actuelle dans Expo

### 1. **Fichier `mobile/eas.json`** (Builds EAS)

```json
{
  "production": {
    "env": {
      "EXPO_PUBLIC_API_URL": "https://api.yukpomnang.com",  // ✅ Même URL
      "EXPO_PUBLIC_WS_URL": "wss://api.yukpomnang.com"     // ✅ Même URL
    }
  }
}
```

**✅ C'est correct** - Le domaine reste le même.

### 2. **Fichier `production (4).json`** (Variables d'environnement)

```json
{
  "EXPO_PUBLIC_API_URL": "https://api.yukpomnang.com",  // ✅ Même URL
  "EXPO_PUBLIC_WS_URL": "wss://api.yukpomnang.com"      // ✅ Même URL
}
```

**✅ C'est correct** - Le domaine reste le même.

### 3. **Fichiers de Configuration Mobile**

**`mobile/src/config/api.config.ts`** :
```typescript
export const API_BASE_URL = EXPO_API_URL || 'http://18.201.235.152:8080';
```

**`mobile/src/config/environment.ts`** :
```typescript
API_URL: process.env.EXPO_PUBLIC_API_URL || 'https://api.yukpomnang.com'
```

**✅ C'est correct** - Utilise les variables d'environnement.

---

## ⚠️ Action Requise : Mettre à Jour le DNS

### Le Problème

Le domaine `api.yukpomnang.com` pointe probablement encore vers l'**ancien compte AWS** au lieu du **nouveau compte**.

### La Solution

**Mettre à jour le DNS (Route53) pour pointer vers le nouveau Load Balancer** :

1. **Vérifier le DNS actuel** :
```bash
nslookup api.yukpomnang.com
# ou
dig api.yukpomnang.com
```

2. **Récupérer l'URL du nouveau Load Balancer** :
```bash
cd infra/aws
terraform output alb_dns_name
# Résultat attendu : yukpo-alb-xxxxxxxxx.eu-west-1.elb.amazonaws.com
```

3. **Mettre à jour Route53** :
   - Aller dans AWS Console > Route53
   - Trouver la zone hébergée pour `yukpomnang.com`
   - Modifier l'enregistrement A pour `api.yukpomnang.com`
   - Pointer vers le nouveau ALB (alias)

---

## 🔄 Options de Configuration

### Option 1: Utiliser le Load Balancer (Recommandé) ✅

**Avantages** :
- ✅ URL stable (`https://api.yukpomnang.com`)
- ✅ Gestion automatique du trafic
- ✅ Health checks intégrés
- ✅ Support HTTPS avec certificat ACM

**Configuration** :
1. Activer le Load Balancer dans Terraform :
```hcl
enable_load_balancer = true
```

2. Appliquer Terraform :
```bash
cd infra/aws
terraform apply
```

3. Mettre à jour Route53 pour pointer vers le nouveau ALB

### Option 2: Utiliser l'IP Publique Directe (Temporaire) ⚠️

**Avantages** :
- ✅ Fonctionne immédiatement
- ✅ Pas de coût supplémentaire

**Inconvénients** :
- ❌ IP change à chaque redéploiement
- ❌ Pas de HTTPS (sauf avec certificat)
- ❌ Pas de Load Balancing

**Configuration** :
```json
{
  "EXPO_PUBLIC_API_URL": "http://52.211.202.11:8080"
}
```

**⚠️ Non recommandé pour production**

---

## 📊 Vérification

### Comment Vérifier que le Domaine Pointe vers le Bon Backend ?

1. **Tester le domaine** :
```bash
curl https://api.yukpomnang.com/health
```

2. **Vérifier les logs ECS** :
```bash
aws logs tail /ecs/yukpo-backend --follow --region eu-west-1
```

3. **Vérifier l'IP résolue** :
```bash
nslookup api.yukpomnang.com
# Doit pointer vers l'IP du nouveau Load Balancer
```

---

## ✅ Résumé

| Question | Réponse |
|----------|---------|
| **Pourquoi même URL ?** | Le domaine `api.yukpomnang.com` est un domaine personnalisé qui peut pointer vers n'importe quel backend |
| **Qu'est-ce qui change ?** | Le DNS (Route53) doit pointer vers le nouveau Load Balancer au lieu de l'ancien |
| **Expo doit-il changer ?** | ❌ Non, Expo continue d'utiliser `https://api.yukpomnang.com` |
| **Action requise ?** | ✅ Oui, mettre à jour le DNS Route53 pour pointer vers le nouveau ALB |

---

## 🔗 Références

- Configuration Backend AWS : `CONFIGURATION_BACKEND_AWS.md`
- Vérification Backend : `VERIFICATION_BACKEND_NOUVEAU_COMPTE_AWS.md`
- Terraform Infrastructure : `infra/aws/main.tf`



