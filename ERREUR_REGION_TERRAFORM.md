# ⚠️ Erreur : Conflit de Région AWS

## Problème Détecté

Lors de l'exécution du script d'optimisation, une erreur a été détectée :

```
Error: reading ELBv2 Load Balancer (arn:aws:elasticloadbalancing:eu-west-1:...): 
'arn:aws:elasticloadbalancing:eu-west-1:...' is not a valid load balancer ARN
```

**Cause** : 
- Le Load Balancer existe dans la région **eu-west-1**
- La configuration Terraform actuelle est en **us-east-1**
- Terraform ne peut pas gérer des ressources dans différentes régions

## Solutions

### Option 1 : Corriger la Région dans terraform.tfvars (RECOMMANDÉ)

Si votre infrastructure est principalement en **eu-west-1**, mettez à jour :

```hcl
# infra/aws/terraform.tfvars
aws_region = "eu-west-1"  # Au lieu de "us-east-1"
```

Puis relancez le script.

### Option 2 : Migrer le Load Balancer vers us-east-1

Si vous voulez tout centraliser en **us-east-1**, vous devrez :
1. Créer un nouveau Load Balancer en us-east-1
2. Migrer les configurations
3. Mettre à jour les DNS

**⚠️ Complexe et peut causer du downtime**

### Option 3 : Utiliser des Workspaces Terraform

Créer des workspaces séparés pour chaque région :
```bash
terraform workspace new eu-west-1
terraform workspace new us-east-1
```

## Action Immédiate

**Vérifiez d'abord dans quelle région se trouve votre infrastructure principale** :

```powershell
# Vérifier le Load Balancer
aws elbv2 describe-load-balancers --region eu-west-1 --query 'LoadBalancers[?contains(LoadBalancerName, `yukpomnang`)].{Name:LoadBalancerName,Region:AvailabilityZones[0].ZoneName}'

# Vérifier RDS
aws rds describe-db-instances --region us-east-1 --query 'DBInstances[?contains(DBInstanceIdentifier, `yukpomnang`)].{ID:DBInstanceIdentifier,Region:AvailabilityZone}'

# Vérifier ECS
aws ecs list-clusters --region us-east-1
```

**Ensuite, mettez à jour `terraform.tfvars` avec la bonne région et relancez le script.**

