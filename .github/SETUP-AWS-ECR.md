# 🔐 Configuration AWS ECR pour GitHub Actions

## Étapes de configuration

### 1. Créer un utilisateur IAM AWS

1. Connectez-vous à la console AWS
2. Allez dans **IAM** > **Users** > **Add users**
3. Créez un utilisateur avec :
   - **Username** : `github-actions-ecr-push`
   - **Access type** : Programmatic access

### 2. Attacher les politiques IAM

Attachez cette politique personnalisée à l'utilisateur :

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ecr:GetAuthorizationToken",
        "ecr:BatchCheckLayerAvailability",
        "ecr:GetDownloadUrlForLayer",
        "ecr:BatchGetImage",
        "ecr:PutImage",
        "ecr:InitiateLayerUpload",
        "ecr:UploadLayerPart",
        "ecr:CompleteLayerUpload"
      ],
      "Resource": "*"
    }
  ]
}
```

Ou utilisez la politique AWS gérée : `AmazonEC2ContainerRegistryPowerUser`

### 3. Récupérer les credentials

Après création de l'utilisateur, notez :
- **Access Key ID**
- **Secret Access Key**

⚠️ **Important** : La Secret Access Key n'est affichée qu'une seule fois. Sauvegardez-la.

### 4. Configurer les secrets GitHub

1. Allez dans votre repository GitHub
2. **Settings** > **Secrets and variables** > **Actions**
3. Cliquez sur **New repository secret**
4. Ajoutez deux secrets :

   **Secret 1** :
   - **Name** : `AWS_ACCESS_KEY_ID`
   - **Value** : Votre Access Key ID

   **Secret 2** :
   - **Name** : `AWS_SECRET_ACCESS_KEY`
   - **Value** : Votre Secret Access Key

### 5. Vérifier le repository ECR

Assurez-vous que le repository ECR existe :

```bash
aws ecr describe-repositories --repository-names yukpomnang-backend --region eu-west-1
```

Si le repository n'existe pas, créez-le :

```bash
aws ecr create-repository \
  --repository-name yukpomnang-backend \
  --region eu-west-1 \
  --image-scanning-configuration scanOnPush=true \
  --encryption-configuration encryptionType=AES256
```

### 6. Tester le workflow

1. Faites un push sur la branche `main`
2. Le workflow devrait automatiquement :
   - Build l'image optimisée
   - Push vers ghcr.io
   - Push vers AWS ECR

## Vérification

### Vérifier que les secrets sont configurés

Dans GitHub :
- **Settings** > **Secrets and variables** > **Actions**
- Vous devriez voir `AWS_ACCESS_KEY_ID` et `AWS_SECRET_ACCESS_KEY`

### Vérifier que le push fonctionne

1. Allez dans **Actions** > **Docker Build Optimized**
2. Ouvrez le dernier workflow run
3. Vérifiez que le job `push-to-aws` s'est exécuté avec succès
4. Vérifiez les logs pour confirmer le push

### Vérifier l'image dans ECR

```bash
aws ecr list-images \
  --repository-name yukpomnang-backend \
  --region eu-west-1
```

Vous devriez voir les tags : `latest`, `optimized`, et `main-<sha>`

## Dépannage

### Erreur : "Unable to locate credentials"

- Vérifiez que les secrets GitHub sont bien configurés
- Vérifiez que les noms des secrets sont exactement : `AWS_ACCESS_KEY_ID` et `AWS_SECRET_ACCESS_KEY`

### Erreur : "Access Denied"

- Vérifiez que l'utilisateur IAM a les bonnes permissions
- Vérifiez que le repository ECR existe
- Vérifiez que la région est correcte (`eu-west-1`)

### Erreur : "Repository does not exist"

- Créez le repository ECR avec la commande ci-dessus
- Vérifiez que le nom du repository est exactement : `yukpomnang-backend`

## Sécurité

### Bonnes pratiques

1. **Rotation des clés** : Changez les clés d'accès régulièrement
2. **Permissions minimales** : L'utilisateur IAM ne doit avoir que les permissions nécessaires
3. **Monitoring** : Surveillez l'utilisation des clés dans CloudTrail
4. **Secrets GitHub** : Ne partagez jamais les secrets dans le code ou les issues

### Audit

Pour voir qui utilise les credentials :

```bash
aws cloudtrail lookup-events \
  --lookup-attributes AttributeKey=Username,AttributeValue=github-actions-ecr-push \
  --region eu-west-1
```








