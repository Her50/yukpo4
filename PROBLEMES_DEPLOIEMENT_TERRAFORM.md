# ⚠️ Problèmes Rencontrés lors du Déploiement Terraform

## 🔴 Erreurs Détectées

### 1. ✅ RÉSOLU : Version PostgreSQL Invalide
- **Erreur** : `Cannot find version 15.4 for postgres`
- **Solution** : Version corrigée à `15.15` (dernière version stable PostgreSQL 15)
- **Status** : ✅ Corrigé dans `terraform.tfvars`

---

### 2. ❌ ECR : Permission Manquante
- **Erreur** : `User is not authorized to perform: ecr:CreateRepository`
- **Cause** : L'utilisateur `github-actions-yukpo` n'a pas la permission `ecr:CreateRepository`
- **Solution** : Vérifier que l'utilisateur est bien dans les groupes IAM avec les politiques ECR

**Action requise :**
1. Allez dans IAM > Users > `github-actions-yukpo`
2. Vérifiez l'onglet "Groupes" (Groups)
3. Assurez-vous que l'utilisateur est dans :
   - `github-actions-core` (avec `AmazonEC2ContainerRegistryPowerUser`)
   - `github-actions-extra`

**Vérification :**
```bash
aws iam list-groups-for-user --user-name github-actions-yukpo
```

---

### 3. ❌ Secrets Manager : Permission Manquante
- **Erreur** : `User is not authorized to perform: secretsmanager:CreateSecret`
- **Cause** : Aucune politique IAM pour Secrets Manager
- **Solution** : Ajouter la politique `SecretsManagerReadWrite` ou `SecretsManagerFullAccess`

**Action requise :**
1. Allez dans IAM > Groups > `github-actions-core` (ou créez un nouveau groupe)
2. Cliquez sur "Attacher des politiques"
3. Cherchez et ajoutez : `SecretsManagerReadWrite` ou `SecretsManagerFullAccess`
4. Sauvegardez

**Alternative :** Créer un groupe `github-actions-secrets` avec cette politique et ajouter l'utilisateur.

---

### 4. ❌ Load Balancer : Compte Non Éligible
- **Erreur** : `This AWS account currently does not support creating load balancers`
- **Cause** : Compte AWS nouveau - certaines fonctionnalités nécessitent une activation manuelle
- **Solution** : Contacter AWS Support pour activer Elastic Load Balancing

**Action requise :**
1. Allez dans AWS Support Center : https://console.aws.amazon.com/support/home
2. Créez un case (gratuit)
3. Type : Service limit increase
4. Service : Elastic Load Balancing
5. Demandez l'activation des Load Balancers pour votre compte

**Note :** Cela peut prendre 24-48h. En attendant, vous pouvez :
- Utiliser un service externe (Cloudflare, etc.)
- Attendre l'activation AWS
- Utiliser un compte AWS plus ancien si disponible

---

## ✅ Solutions Immédiates

### Étape 1 : Corriger les Permissions IAM

#### A. Ajouter Secrets Manager Policy

1. IAM > Groups > `github-actions-core`
2. "Attacher des politiques"
3. Cherchez : `SecretsManagerReadWrite`
4. Ajoutez-la
5. Sauvegardez

#### B. Vérifier ECR Permissions

1. IAM > Users > `github-actions-yukpo`
2. Onglet "Groupes"
3. Vérifiez que l'utilisateur est dans `github-actions-core`
4. Vérifiez que le groupe a `AmazonEC2ContainerRegistryPowerUser`

---

### Étape 2 : Contacter AWS Support pour Load Balancer

1. Support Center : https://console.aws.amazon.com/support/home
2. Créez un case
3. Demandez l'activation d'Elastic Load Balancing

---

### Étape 3 : Relancer Terraform (après corrections)

```bash
cd infra/aws
terraform apply
```

---

## 📋 Checklist

- [x] Version PostgreSQL corrigée (15.15)
- [ ] Secrets Manager policy ajoutée
- [ ] ECR permissions vérifiées
- [ ] AWS Support contacté pour Load Balancer
- [ ] Terraform relancé

---

## 💡 Alternative Temporaire (sans Load Balancer)

Si vous ne pouvez pas attendre l'activation du Load Balancer, vous pouvez :

1. **Désactiver temporairement l'ALB** dans Terraform
2. **Utiliser ECS Service directement** avec IP publique (moins sécurisé)
3. **Utiliser CloudFront** comme point d'entrée (si disponible)

Mais **ATTENTION** : Sans Load Balancer, vous perdez :
- Health checks automatiques
- Distribution de charge
- SSL/TLS termination
- Routing avancé

---

## 🔍 Vérification des Permissions

Pour vérifier toutes les permissions de l'utilisateur :

```bash
# Vérifier les groupes
aws iam list-groups-for-user --user-name github-actions-yukpo

# Vérifier les politiques attachées
aws iam list-attached-user-policies --user-name github-actions-yukpo
aws iam list-user-policies --user-name github-actions-yukpo

# Tester une permission spécifique
aws ecr describe-repositories --region eu-west-1
aws secretsmanager list-secrets --region eu-west-1
```

---

## 📞 Support AWS

Si vous avez besoin d'aide pour activer le Load Balancer :
- Support Center : https://console.aws.amazon.com/support/home
- Type de case : Service limit increase
- Service : Elastic Load Balancing
- Description : "Je souhaite activer Elastic Load Balancing pour mon compte AWS afin de déployer mon application."

