# 🔧 Correction du Rôle SSM pour l'Instance EC2

**Date**: 2026-02-13  
**Problème**: SSM Agent unable to acquire credentials - AccessDeniedException  
**Instance**: `i-0b9ad404f8d738d04`

---

## ❌ **ERREUR IDENTIFIÉE**

```
SSM Agent unable to acquire credentials: 
AccessDeniedException: Systems Manager's instance management role is not configured for account: 108964700972
```

**Cause**: Le rôle IAM de l'instance EC2 n'est pas correctement attaché ou n'a pas les bonnes permissions.

---

## ✅ **SOLUTION 1: Vérifier et Corriger le Rôle IAM via AWS Console**

### Étape 1: Vérifier le Rôle Attaché à l'Instance

1. **Allez dans AWS Console** → **EC2** → **Instances**
2. **Sélectionnez l'instance**: `i-0b9ad404f8d738d04`
3. **Onglet "Sécurité"** (Security) en bas
4. **Section "Rôles IAM"** (IAM roles)
5. **Vérifiez le rôle attaché**: Devrait être `yukpo-temp-ec2-ssm-role`

### Étape 2: Si le Rôle n'est Pas Attaché

1. **Cliquez sur "Modifier les rôles IAM"** (Modify IAM roles)
2. **Sélectionnez le rôle**: `yukpo-temp-ec2-ssm-role`
3. **Cliquez sur "Mettre à jour les rôles IAM"** (Update IAM roles)
4. **Attendez 1-2 minutes** pour que l'agent SSM se reconnecte

### Étape 3: Vérifier les Permissions du Rôle

1. **Allez dans IAM** → **Roles** → **yukpo-temp-ec2-ssm-role**
2. **Vérifiez les politiques attachées**:
   - ✅ `AmazonSSMManagedInstanceCore` (doit être présent)
   - ✅ `yukpo-temp-ec2-secrets-policy` (pour Secrets Manager)

### Étape 4: Redémarrer l'Agent SSM

Une fois le rôle attaché, redémarrez l'agent SSM sur l'instance :

```bash
# Via AWS CLI (si vous avez un autre accès)
aws ssm send-command \
  --instance-ids i-0b9ad404f8d738d04 \
  --document-name "AWS-RunShellScript" \
  --parameters '{"commands":["sudo systemctl restart amazon-ssm-agent"]}' \
  --region eu-west-1
```

**OU** redémarrez l'instance complètement :

```bash
aws ec2 reboot-instances --instance-ids i-0b9ad404f8d738d04 --region eu-west-1
```

---

## ✅ **SOLUTION 2: Utiliser SSH Directement (Alternative)**

Si SSM ne fonctionne toujours pas, utilisez SSH directement :

### Étape 1: Créer une Clé SSH

1. **Allez dans EC2** → **Key Pairs** → **Create key pair**
2. **Nom**: `yukpo-temp-key`
3. **Type**: RSA
4. **Format**: `.pem`
5. **Téléchargez la clé**

### Étape 2: Attacher la Clé à l'Instance

1. **Arrêtez l'instance** (si nécessaire)
2. **Actions** → **Instance settings** → **Edit user data**
3. **Ajoutez**:
   ```bash
   #!/bin/bash
   yum update -y
   yum install -y postgresql15 git jq
   ```
4. **Actions** → **Instance settings** → **Attach/Replace IAM role**
5. **Sélectionnez**: `yukpo-temp-ec2-ssm-role`
6. **Redémarrez l'instance**

### Étape 3: Se Connecter via SSH

```bash
# Depuis votre machine locale (avec la clé téléchargée)
ssh -i yukpo-temp-key.pem ec2-user@52.17.27.232
```

---

## ✅ **SOLUTION 3: Corriger via Terraform**

J'ai déjà ajouté la permission Secrets Manager dans `temp_ec2_db_creator.tf`. 

**Pour appliquer** :

```bash
cd infra/aws
terraform apply -target=aws_iam_role_policy.temp_ec2_secrets
```

**Puis redémarrer l'instance** :

```bash
aws ec2 reboot-instances --instance-ids i-0b9ad404f8d738d04 --region eu-west-1
```

---

## 🔍 **VÉRIFICATION**

Après avoir attaché le rôle et redémarré :

1. **Attendez 2-3 minutes**
2. **Retournez sur la page "Connect"** de l'instance
3. **Onglet "Session Manager"**
4. **Le statut devrait être "En ligne"** (Online) avec une coche verte
5. **Cliquez sur "Connect"**

---

## ✅ **RÉSUMÉ**

**Problème**: Le rôle IAM n'est pas attaché ou n'a pas les bonnes permissions

**Solutions**:
1. ✅ Attacher le rôle via AWS Console (le plus rapide)
2. ✅ Utiliser SSH directement (alternative)
3. ✅ Corriger via Terraform (permanent)

**Action immédiate**: 
1. Vérifiez que le rôle `yukpo-temp-ec2-ssm-role` est attaché à l'instance
2. Si non, attachez-le via AWS Console
3. Redémarrez l'instance
4. Attendez 2-3 minutes
5. Réessayez de vous connecter via Session Manager

---

**Note**: Si vous étiez déjà connecté et que la compilation de sqlx était en cours, la session peut s'être déconnectée à cause de ce problème. Une fois le rôle corrigé, vous pourrez vous reconnecter et continuer.

