# 🔧 Guide : Mise à Jour DNS Route53 pour Nouveau Backend AWS

**Date**: 2026-02-14  
**Objectif**: Faire pointer `api.yukpomnang.com` vers le nouveau Load Balancer AWS (compte `108964700972`)

---

## 📋 Étape 1 : Vérifier le DNS Actuel

### Windows PowerShell

```powershell
# Vérifier où pointe actuellement api.yukpomnang.com
nslookup api.yukpomnang.com

# Résultat attendu : Affiche l'IP ou le CNAME actuel
```

### Linux/Mac

```bash
# Vérifier où pointe actuellement api.yukpomnang.com
nslookup api.yukpomnang.com
# ou
dig api.yukpomnang.com
```

**Interprétation** :
- Si vous voyez une IP : Le domaine pointe directement vers une IP (ancien backend)
- Si vous voyez un CNAME : Le domaine pointe vers un autre domaine (probablement l'ancien ALB)

---

## 📋 Étape 2 : Récupérer l'URL du Nouveau Load Balancer

### Option A : Via Terraform (si infrastructure gérée par Terraform)

```powershell
# Aller dans le répertoire Terraform
cd C:\Users\23767\yukpomnang2\infra\aws

# Récupérer l'URL du Load Balancer
terraform output alb_dns_name

# Résultat attendu : yukpo-alb-xxxxxxxxx.eu-west-1.elb.amazonaws.com
```

**Si Terraform n'est pas configuré ou si le Load Balancer n'existe pas encore** :

### Option B : Via AWS CLI

```powershell
# Lister les Load Balancers dans le nouveau compte
aws elbv2 describe-load-balancers `
    --region eu-west-1 `
    --query 'LoadBalancers[?contains(LoadBalancerName, `yukpo`) || contains(LoadBalancerName, `backend`)][*].[LoadBalancerName,DNSName,State.Code]' `
    --output table

# Si un Load Balancer existe, copier le DNSName (ex: yukpo-alb-xxxxx.eu-west-1.elb.amazonaws.com)
```

### Option C : Vérifier si le Load Balancer est activé

```powershell
# Vérifier la configuration Terraform
cd C:\Users\23767\yukpomnang2\infra\aws

# Vérifier si enable_load_balancer = true dans terraform.tfvars
Get-Content terraform.tfvars | Select-String "enable_load_balancer"
```

**Si `enable_load_balancer = false`** :

1. **Activer le Load Balancer** :
```powershell
# Éditer terraform.tfvars
notepad terraform.tfvars

# Ajouter ou modifier :
enable_load_balancer = true
```

2. **Appliquer Terraform** :
```powershell
terraform plan
terraform apply
```

3. **Récupérer l'URL** :
```powershell
terraform output alb_dns_name
```

---

## 📋 Étape 3 : Mettre à Jour Route53

### Méthode 1 : Via AWS Console (Recommandé)

1. **Ouvrir AWS Console** :
   - Aller sur https://console.aws.amazon.com
   - Se connecter avec le compte AWS `108964700972`
   - Région : `eu-west-1` (Irlande)

2. **Accéder à Route53** :
   - Chercher "Route53" dans la barre de recherche
   - Cliquer sur "Hosted zones"

3. **Trouver la Zone Hébergée** :
   - Chercher `yukpomnang.com`
   - Cliquer sur la zone

4. **Trouver l'Enregistrement `api`** :
   - Dans la liste des enregistrements, chercher `api.yukpomnang.com`
   - Cliquer sur "Edit record"

5. **Modifier l'Enregistrement** :
   - **Type** : `A - Routes traffic to an IPv4 address and some AWS resources`
   - **Alias** : ✅ Cocher "Alias"
   - **Route traffic to** : 
     - Sélectionner "Alias to Application and Classic Load Balancer"
     - **Region** : `eu-west-1 (Europe - Ireland)`
     - **Load balancer** : Sélectionner le Load Balancer (ex: `yukpo-alb-xxxxx`)
   - **Routing policy** : `Simple routing`
   - Cliquer sur "Save changes"

6. **Vérifier** :
   - Attendre quelques minutes pour la propagation DNS
   - Tester : `nslookup api.yukpomnang.com`

### Méthode 2 : Via AWS CLI

```powershell
# 1. Récupérer l'ID de la zone hébergée
$ZONE_ID = aws route53 list-hosted-zones `
    --query 'HostedZones[?Name==`yukpomnang.com.`].Id' `
    --output text

Write-Host "Zone ID: $ZONE_ID"

# 2. Récupérer l'ARN du Load Balancer
$ALB_ARN = aws elbv2 describe-load-balancers `
    --region eu-west-1 `
    --query 'LoadBalancers[?contains(LoadBalancerName, `yukpo`)].LoadBalancerArn' `
    --output text

Write-Host "ALB ARN: $ALB_ARN"

# 3. Récupérer le Hosted Zone ID du Load Balancer
$ALB_HOSTED_ZONE_ID = aws elbv2 describe-load-balancers `
    --region eu-west-1 `
    --load-balancer-arns $ALB_ARN `
    --query 'LoadBalancers[0].CanonicalHostedZoneId' `
    --output text

Write-Host "ALB Hosted Zone ID: $ALB_HOSTED_ZONE_ID"

# 4. Récupérer le DNS Name du Load Balancer
$ALB_DNS_NAME = aws elbv2 describe-load-balancers `
    --region eu-west-1 `
    --load-balancer-arns $ALB_ARN `
    --query 'LoadBalancers[0].DNSName' `
    --output text

Write-Host "ALB DNS Name: $ALB_DNS_NAME"

# 5. Créer le fichier JSON pour la mise à jour
$CHANGE_BATCH = @{
    Changes = @(
        @{
            Action = "UPSERT"
            ResourceRecordSet = @{
                Name = "api.yukpomnang.com"
                Type = "A"
                AliasTarget = @{
                    DNSName = $ALB_DNS_NAME
                    EvaluateTargetHealth = $true
                    HostedZoneId = $ALB_HOSTED_ZONE_ID
                }
            }
        }
    )
} | ConvertTo-Json -Depth 10

# 6. Sauvegarder dans un fichier
$CHANGE_BATCH | Out-File -FilePath "route53-change.json" -Encoding UTF8

# 7. Appliquer le changement
aws route53 change-resource-record-sets `
    --hosted-zone-id $ZONE_ID `
    --change-batch file://route53-change.json

Write-Host "✅ DNS mis à jour ! Attendez quelques minutes pour la propagation."
```

---

## 📋 Étape 4 : Vérifier la Mise à Jour

### Vérifier le DNS

```powershell
# Attendre 2-3 minutes, puis vérifier
nslookup api.yukpomnang.com

# Doit maintenant pointer vers le nouveau Load Balancer
```

### Tester la Connectivité

```powershell
# Tester l'endpoint health
Invoke-WebRequest -Uri "https://api.yukpomnang.com/health" -Method GET

# Vérifier que ça fonctionne
```

### Vérifier les Logs ECS

```powershell
# Vérifier que les requêtes arrivent bien au nouveau backend
aws logs tail /ecs/yukpo-backend --follow --region eu-west-1
```

---

## ⚠️ Problèmes Potentiels

### Problème 1 : Le Load Balancer n'existe pas

**Solution** :
1. Activer le Load Balancer dans Terraform (`enable_load_balancer = true`)
2. Appliquer Terraform (`terraform apply`)
3. Récupérer l'URL du Load Balancer

### Problème 2 : La Zone Hébergée n'existe pas dans le nouveau compte

**Solution** :
1. Vérifier si la zone existe dans l'ancien compte
2. Si oui, transférer la zone vers le nouveau compte ou créer un enregistrement CNAME
3. Ou créer une nouvelle zone hébergée dans le nouveau compte

### Problème 3 : Le DNS ne se propage pas

**Solution** :
- Attendre jusqu'à 48h (généralement quelques minutes)
- Vérifier avec `nslookup` depuis différents serveurs DNS
- Utiliser `dig @8.8.8.8 api.yukpomnang.com` pour forcer Google DNS

---

## ✅ Checklist

- [ ] Vérifier le DNS actuel (`nslookup api.yukpomnang.com`)
- [ ] Récupérer l'URL du nouveau Load Balancer
- [ ] Activer le Load Balancer si nécessaire (`enable_load_balancer = true`)
- [ ] Appliquer Terraform si modifications
- [ ] Mettre à jour l'enregistrement Route53
- [ ] Vérifier le DNS après mise à jour
- [ ] Tester la connectivité (`https://api.yukpomnang.com/health`)
- [ ] Vérifier les logs ECS pour confirmer que les requêtes arrivent

---

## 📚 Références

- Configuration Backend AWS : `CONFIGURATION_BACKEND_AWS.md`
- Vérification Backend : `VERIFICATION_BACKEND_NOUVEAU_COMPTE_AWS.md`
- Explication Expo Backend : `EXPLICATION_EXPO_BACKEND_CONFIGURATION.md`



