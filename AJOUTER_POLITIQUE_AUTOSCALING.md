# 🔧 Ajouter la Politique IAM pour Application Auto Scaling

## ❌ Erreur Actuelle

```
User: arn:aws:iam::108964700972:user/github-actions-yukpo is not authorized to perform: 
application-autoscaling:TagResource
```

## ✅ Solution

Ajouter une politique inline pour Application Auto Scaling à l'utilisateur `github-actions-yukpo`.

### Étapes dans la Console AWS

1. **Console AWS** → **IAM** → **Users** → `github-actions-yukpo`
2. **Permissions** → **Add permissions** → **Create inline policy**
3. **JSON** → Coller le contenu suivant :

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "application-autoscaling:*",
        "autoscaling:*"
      ],
      "Resource": "*"
    }
  ]
}
```

4. **Review policy** → Nom : `ApplicationAutoScalingFullAccess`
5. **Create policy**

### Alternative : Utiliser AWS CLI

```powershell
aws iam put-user-policy `
  --user-name github-actions-yukpo `
  --policy-name ApplicationAutoScalingFullAccess `
  --policy-document '{
    "Version": "2012-10-17",
    "Statement": [
      {
        "Effect": "Allow",
        "Action": [
          "application-autoscaling:*",
          "autoscaling:*"
        ],
        "Resource": "*"
      }
    ]
  }'
```

