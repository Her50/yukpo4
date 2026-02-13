# 🔧 Créer une Politique Personnalisée pour Secrets Manager

## Problème
Aucune politique AWS gérée pour Secrets Manager n'est disponible dans votre compte.

## Solution : Créer une Politique Personnalisée

### Étape 1 : Créer la Politique

1. **IAM > Politiques** (Policies)
2. Cliquez sur **"Créer une politique"** (Create policy)
3. Cliquez sur l'onglet **"JSON"**
4. **Collez ce JSON** :

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "secretsmanager:CreateSecret",
                "secretsmanager:UpdateSecret",
                "secretsmanager:DeleteSecret",
                "secretsmanager:DescribeSecret",
                "secretsmanager:GetSecretValue",
                "secretsmanager:PutSecretValue",
                "secretsmanager:ListSecrets",
                "secretsmanager:TagResource",
                "secretsmanager:UntagResource"
            ],
            "Resource": "*"
        }
    ]
}
```

5. Cliquez sur **"Suivant"** (Next)
6. **Nom de la politique** : `SecretsManagerReadWrite`
7. **Description** : `Permissions pour créer et gérer les secrets dans AWS Secrets Manager`
8. Cliquez sur **"Créer une politique"** (Create policy)

---

### Étape 2 : Attacher la Politique au Groupe

1. **IAM > Groupes** > `github-actions-extra`
2. Onglet **"Autorisations"** (Permissions)
3. Cliquez sur **"Ajouter des autorisations"** > **"Attacher des politiques"**
4. Dans la recherche, tapez : `SecretsManagerReadWrite`
5. Cochez votre politique personnalisée
6. Cliquez sur **"Ajouter des autorisations"**

---

## Alternative : Utiliser une Politique Inline (Plus Simple)

Si créer une politique séparée est trop compliqué, vous pouvez créer une politique **inline** directement sur le groupe :

1. **IAM > Groupes** > `github-actions-extra`
2. Onglet **"Autorisations"**
3. Cliquez sur **"Ajouter des autorisations"** > **"Ajouter des autorisations inline"**
4. **Nom de la politique** : `SecretsManagerReadWrite`
5. **JSON** : Collez le même JSON que ci-dessus
6. Cliquez sur **"Ajouter des autorisations"**

---

## Vérification

Après avoir ajouté la politique, vérifiez :

```bash
aws iam list-group-policies --group-name github-actions-extra
```

Ou dans la console :
- IAM > Groupes > `github-actions-extra` > Autorisations
- Vous devriez voir la politique `SecretsManagerReadWrite`

---

## Note

Cette politique donne les permissions nécessaires pour :
- ✅ Créer des secrets (`CreateSecret`)
- ✅ Lire des secrets (`GetSecretValue`)
- ✅ Mettre à jour des secrets (`UpdateSecret`, `PutSecretValue`)
- ✅ Supprimer des secrets (`DeleteSecret`)
- ✅ Lister les secrets (`ListSecrets`)

C'est exactement ce dont Terraform a besoin pour créer et gérer les secrets.

