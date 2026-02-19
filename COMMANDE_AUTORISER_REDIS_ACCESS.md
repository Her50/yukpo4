# 🔒 Autoriser ECS à Accéder à Redis

## ❌ **Problème Identifié**

- REDIS_URL : ✅ Correct (`redis://master.yukpo-redis.hbcyaa.euw1.cache.amazonaws.com:6379/0`)
- ECS Security Group : `sg-0d910f6cca6bac2e5`
- Redis Security Group : `sg-06e7d19f54d7fa191`
- **Aucune règle pour le port 6379** ❌

---

## ✅ **Commande pour Autoriser l'Accès**

```powershell
# Autoriser ECS à accéder à Redis (port 6379)
aws ec2 authorize-security-group-ingress `
  --group-id sg-06e7d19f54d7fa191 `
  --protocol tcp `
  --port 6379 `
  --source-group sg-0d910f6cca6bac2e5 `
  --region eu-west-1
```

---

## ✅ **Vérification Après Autorisation**

```powershell
# Vérifier que la règle a été ajoutée
aws ec2 describe-security-groups --group-ids sg-06e7d19f54d7fa191 --region eu-west-1 --query 'SecurityGroups[0].IpPermissions[?FromPort==`6379`]' --output json | ConvertFrom-Json
```

---

## ✅ **Note**

Si vous obtenez une erreur "rule already exists", c'est que la règle existe déjà mais n'était pas détectée par la requête précédente (problème d'échappement JMESPath). Dans ce cas, Redis devrait fonctionner après le redéploiement du service.



