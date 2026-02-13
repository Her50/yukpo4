# 🔍 Comment Trouver la Politique Load Balancer

## ⚠️ Problème : Politique Non Trouvée

Si vous ne trouvez pas `AmazonElasticLoadBalancingFullAccess`, c'est normal ! Le nom exact peut varier.

---

## 🔍 Noms Alternatifs à Chercher

### Option 1 : ElasticLoadBalancingFullAccess (Sans "Amazon")

**Nom exact :** `ElasticLoadBalancingFullAccess`

**Comment chercher :**
1. Dans la barre de recherche, tapez : `ElasticLoadBalancing`
2. Ou : `Load Balancer`
3. Ou : `ELB`

**Vous devriez voir :**
- `ElasticLoadBalancingFullAccess` ✅
- `ElasticLoadBalancingReadOnly` (ne pas prendre celle-ci)

---

### Option 2 : ElasticLoadBalancingV2FullAccess (Recommandé pour ALB)

**Nom exact :** `ElasticLoadBalancingV2FullAccess`

**Pourquoi cette version :**
- ✅ Spécifique pour Application Load Balancer (ALB) version 2
- ✅ C'est ce que vous utilisez pour WebSocket
- ✅ Plus moderne et recommandé

**Comment chercher :**
1. Dans la barre de recherche, tapez : `ElasticLoadBalancingV2`
2. Ou : `ALB`
3. Ou : `Application Load Balancer`

**Vous devriez voir :**
- `ElasticLoadBalancingV2FullAccess` ✅ (RECOMMANDÉ)
- `ElasticLoadBalancingV2ReadOnly` (ne pas prendre celle-ci)

---

## 📋 Méthode de Recherche Étape par Étape

### Étape 1 : Utiliser la Barre de Recherche

1. Dans la liste des politiques, utilisez la **barre de recherche** en haut
2. Tapez : `ElasticLoadBalancing` (sans "Amazon")
3. Appuyez sur Entrée

### Étape 2 : Filtrer les Résultats

Vous devriez voir plusieurs politiques :
- ✅ `ElasticLoadBalancingFullAccess` - Pour tous les types de Load Balancer
- ✅ `ElasticLoadBalancingV2FullAccess` - Pour ALB/NLB (recommandé)
- ❌ `ElasticLoadBalancingReadOnly` - Ne pas prendre (lecture seule)
- ❌ `ElasticLoadBalancingV2ReadOnly` - Ne pas prendre (lecture seule)

### Étape 3 : Choisir la Bonne Politique

**Recommandation :** Choisissez `ElasticLoadBalancingV2FullAccess` si disponible, sinon `ElasticLoadBalancingFullAccess`.

---

## ✅ Si Vous Ne Trouvez Toujours Pas

### Option A : Utiliser AmazonVPCFullAccess (Déjà dans la liste)

**Bonne nouvelle :** `AmazonVPCFullAccess` inclut certaines permissions pour Load Balancer.

**Vérification :**
- Si vous avez déjà coché `AmazonVPCFullAccess`, vous avez probablement assez de permissions pour l'ALB
- L'ALB est créé dans le VPC, donc certaines permissions sont incluses

**Action :**
- ✅ Continuez avec les 11 autres politiques
- ✅ Testez le déploiement
- ✅ Si vous avez des erreurs de permissions ALB, ajoutez la politique plus tard

---

### Option B : Créer une Politique Personnalisée (Avancé)

Si vous ne trouvez vraiment pas la politique, vous pouvez créer une politique personnalisée :

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "elasticloadbalancing:*",
        "ec2:DescribeAccountAttributes",
        "ec2:DescribeInternetGateways",
        "ec2:DescribeVpcs",
        "ec2:DescribeSubnets",
        "ec2:DescribeSecurityGroups"
      ],
      "Resource": "*"
    }
  ]
}
```

**Mais ce n'est pas nécessaire si vous avez `AmazonVPCFullAccess` !**

---

## 🎯 Recommandation Finale

### Si Vous Trouvez la Politique :

**Choisissez :**
1. ✅ `ElasticLoadBalancingV2FullAccess` (si disponible) - MEILLEUR
2. ✅ `ElasticLoadBalancingFullAccess` (sinon) - BON

### Si Vous Ne Trouvez Pas :

**Pas de problème !**
- ✅ `AmazonVPCFullAccess` (déjà dans votre liste) inclut des permissions pour ALB
- ✅ Continuez avec les 11 autres politiques
- ✅ Testez le déploiement
- ✅ Si erreur de permissions, ajoutez la politique plus tard

---

## 📋 Checklist Mise à Jour

**12 politiques (ou 11 si Load Balancer non trouvé) :**

1. ✅ `AmazonEC2ContainerRegistryPowerUser`
2. ✅ `AmazonECS_FullAccess`
3. ✅ `AmazonSSMFullAccess`
4. ✅ `AmazonRDSFullAccess`
5. ✅ `AmazonElastiCacheFullAccess`
6. ✅ `AmazonVPCFullAccess` ✅ (inclut certaines permissions ALB)
7. ✅ `CloudWatchLogsFullAccess`
8. ✅ `IAMFullAccess`
9. ✅ `AmazonS3FullAccess`
10. ✅ `CloudFrontFullAccess`
11. ✅ `AmazonAPIGatewayAdministrator`
12. ⚠️ `ElasticLoadBalancingV2FullAccess` OU `ElasticLoadBalancingFullAccess` (optionnel si VPCFullAccess suffit)

**Total : 11-12 politiques** (selon si vous trouvez la politique Load Balancer)

---

## 💡 Astuce

**Dans la barre de recherche AWS IAM :**
- Tapez simplement : `Load` ou `Balancer`
- AWS affichera toutes les politiques liées
- Cherchez celle avec "FullAccess" (pas "ReadOnly")

**C'est souvent plus facile que de chercher le nom exact !** 🔍

