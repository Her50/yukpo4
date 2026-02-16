# 🔧 Correction Credentials AWS - Token Invalide

**Date**: 2026-02-16  
**Erreur**: `The security token included in the request is invalid`

---

## 🔍 Diagnostic

L'erreur indique que les credentials AWS dans les secrets GitHub sont invalides, expirés ou manquants.

**Secrets GitHub requis** :
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`

**Workflows affectés** :
- `.github/workflows/docker-build-optimized.yml` (4 occurrences)
- `.github/workflows/deploy-env-hetzner.yml` (1 occurrence)

---

## ✅ Solution 1: Vérifier les Secrets GitHub

### Étape 1: Accéder aux Secrets GitHub

**URL** : https://github.com/Her50/yukpo4/settings/secrets/actions

**OU via GitHub CLI** :
```bash
gh secret list --repo Her50/yukpo4
```

### Étape 2: Vérifier l'Existence des Secrets

Rechercher :
- ✅ `AWS_ACCESS_KEY_ID` (doit exister)
- ✅ `AWS_SECRET_ACCESS_KEY` (doit exister)

**Si les secrets n'existent pas** : Voir Solution 2.

**Si les secrets existent** : Voir Solution 3.

---

## ✅ Solution 2: Créer de Nouveaux Credentials AWS

### Étape 1: Créer un Utilisateur IAM AWS

1. Aller sur https://console.aws.amazon.com/iam/
2. Cliquer sur "Users" → "Create user"
3. Nom : `github-actions-yukpo` (ou similaire)
4. Cocher "Provide user access to the AWS Management Console" (optionnel)
5. Cliquer sur "Next"

### Étape 2: Attacher les Permissions

**Permissions requises** :
- `AmazonEC2ContainerRegistryFullAccess` (pour ECR)
- `AmazonECS_FullAccess` (pour ECS)
- `AmazonElasticContainerServiceFullAccess` (pour ECS)

**OU créer une politique personnalisée** :
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ecr:*",
        "ecs:*",
        "iam:PassRole"
      ],
      "Resource": "*"
    }
  ]
}
```

### Étape 3: Créer les Access Keys

1. Cliquer sur l'utilisateur créé
2. Onglet "Security credentials"
3. Section "Access keys"
4. Cliquer sur "Create access key"
5. Type : "Application running outside AWS"
6. Cliquer sur "Next" → "Create access key"
7. **⚠️ IMPORTANT** : Copier immédiatement :
   - `Access key ID`
   - `Secret access key` (visible une seule fois)

### Étape 4: Ajouter les Secrets GitHub

**Via GitHub Web UI** :
1. Aller sur https://github.com/Her50/yukpo4/settings/secrets/actions
2. Cliquer sur "New repository secret"
3. Nom : `AWS_ACCESS_KEY_ID`
4. Valeur : L'Access key ID copiée
5. Cliquer sur "Add secret"
6. Répéter pour `AWS_SECRET_ACCESS_KEY`

**Via GitHub CLI** :
```bash
gh secret set AWS_ACCESS_KEY_ID \
  --repo Her50/yukpo4 \
  --body "VOTRE_ACCESS_KEY_ID"

gh secret set AWS_SECRET_ACCESS_KEY \
  --repo Her50/yukpo4 \
  --body "VOTRE_SECRET_ACCESS_KEY"
```

---

## ✅ Solution 3: Vérifier et Régénérer les Credentials Existants

### Étape 1: Vérifier les Credentials dans AWS

1. Aller sur https://console.aws.amazon.com/iam/
2. Cliquer sur "Users"
3. Trouver l'utilisateur associé aux credentials
4. Onglet "Security credentials"
5. Vérifier l'état des access keys :
   - ✅ **Active** : Les credentials sont valides
   - ❌ **Inactive** : Les credentials sont désactivés
   - ⚠️ **Expired** : Les credentials ont expiré

### Étape 2: Régénérer les Credentials

**Si les credentials sont inactifs ou expirés** :

1. **Option A : Réactiver les credentials existants** (si inactifs)
   - Cliquer sur "Activate" à côté de l'access key

2. **Option B : Créer de nouveaux credentials** (recommandé)
   - Cliquer sur "Create access key"
   - Suivre les étapes de Solution 2, Étape 3-4

3. **Option C : Supprimer et recréer** (si nécessaire)
   - Cliquer sur "Delete" pour supprimer l'ancien access key
   - Créer un nouveau access key
   - Mettre à jour les secrets GitHub

---

## ✅ Solution 4: Vérifier la Région AWS

**Fichier** : `.github/workflows/docker-build-optimized.yml`

**Ligne 41** :
```yaml
AWS_REGION: eu-west-1
```

**Vérifier** :
- La région correspond à votre compte AWS
- Les ressources ECR/ECS sont dans cette région
- Les credentials ont accès à cette région

---

## 🔧 Test des Credentials

### Test Local (Optionnel)

```bash
# Installer AWS CLI
aws --version

# Configurer les credentials
aws configure
# Access Key ID: [votre access key]
# Secret Access Key: [votre secret key]
# Default region: eu-west-1
# Default output format: json

# Tester l'accès
aws sts get-caller-identity

# Tester l'accès ECR
aws ecr describe-repositories --region eu-west-1
```

**Si le test échoue** : Les credentials sont invalides ou les permissions sont insuffisantes.

---

## 📋 Checklist de Vérification

- [ ] Secrets GitHub `AWS_ACCESS_KEY_ID` et `AWS_SECRET_ACCESS_KEY` existent
- [ ] Les credentials AWS sont actifs (non expirés, non désactivés)
- [ ] L'utilisateur IAM a les permissions nécessaires (ECR, ECS)
- [ ] La région AWS dans le workflow correspond à votre compte
- [ ] Les secrets GitHub ont été mis à jour avec les nouveaux credentials (si régénérés)

---

## 🚀 Après Correction

Une fois les credentials corrigés :

1. **Les workflows vont automatiquement utiliser les nouveaux secrets**
2. **Pas besoin de re-déclencher manuellement** (sauf si vous voulez tester)
3. **Le prochain push déclenchera le workflow avec les nouveaux credentials**

---

## 🔗 Références

- **Secrets GitHub** : https://github.com/Her50/yukpo4/settings/secrets/actions
- **IAM Console** : https://console.aws.amazon.com/iam/
- **Documentation AWS** : https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_access-keys.html
- **GitHub Actions AWS** : https://github.com/aws-actions/configure-aws-credentials

---

## ⚠️ Sécurité

- ⚠️ **Ne jamais commiter les credentials dans le code**
- ⚠️ **Ne jamais partager les credentials publiquement**
- ⚠️ **Régénérer les credentials si compromis**
- ⚠️ **Utiliser le principe du moindre privilège** (permissions minimales nécessaires)
- ⚠️ **Activer MFA sur le compte AWS root**

---

**💡 Note** : Si vous n'utilisez plus AWS ECR/ECS, vous pouvez désactiver les jobs AWS dans le workflow pour éviter cette erreur.

