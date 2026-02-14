# 🔍 Vérifier les Logs - Via Console AWS

## ✅ **Méthode Recommandée : Console AWS CloudWatch**

1. **Allez sur** : https://console.aws.amazon.com/cloudwatch/
2. Dans le menu de gauche, cliquez sur **"Logs"** → **"Log groups"**
3. Cherchez et cliquez sur : `/ecs/yukpo-backend`
4. Cliquez sur le **dernier log stream** (le plus récent)
5. Dans la barre de recherche, tapez : `migration` ou `ENABLE_AUTO_MIGRATIONS` ou `existe`
6. Vous verrez les logs avec les messages de migration

---

## ✅ **Alternative : Utiliser AWS CLI avec Format JSON (Sans Emojis)**

```powershell
# Récupérer les logs en format JSON (sans emojis)
aws logs tail /ecs/yukpo-backend --since 10m --region eu-west-1 --format json > logs.json 2>&1

# Puis chercher dans le fichier
Select-String -Path logs.json -Pattern "migration|ENABLE_AUTO_MIGRATIONS|existe" | Select-Object -Last 30
```

---

## ✅ **Alternative : Utiliser Get-Content avec -Raw**

```powershell
# Essayer avec Get-Content
$logs = aws logs tail /ecs/yukpo-backend --since 10m --region eu-west-1 2>&1
$logs | Out-File -FilePath logs_recent.txt -Encoding ASCII

# Puis chercher
Select-String -Path logs_recent.txt -Pattern "migration|ENABLE_AUTO_MIGRATIONS|existe" | Select-Object -Last 30
```

---

## ✅ **Vérification Simple : Tester l'Endpoint Health**

Si les logs posent problème, testez directement l'application :

```powershell
# Récupérer l'IP publique
$TASK_ARN = aws ecs list-tasks --cluster yukpo-cluster --service-name yukpo-backend-service --region eu-west-1 --desired-status RUNNING --query 'taskArns[0]' --output text

$ENI_ID = aws ecs describe-tasks --cluster yukpo-cluster --tasks $TASK_ARN --region eu-west-1 --query 'tasks[0].attachments[0].details[?name==`networkInterfaceId`].value' --output text

$PUBLIC_IP = aws ec2 describe-network-interfaces --network-interface-ids $ENI_ID --region eu-west-1 --query 'NetworkInterfaces[0].Association.PublicIp' --output text

Write-Host "IP Publique: $PUBLIC_IP"

# Tester l'endpoint health
curl http://${PUBLIC_IP}:8080/health
```

Si l'endpoint répond, l'application fonctionne et les migrations ont probablement réussi.

---

## ✅ **Vérification Directe : Compter les Tables dans la Base**

Sur EC2, vérifiez directement dans la base de données :

```bash
# Sur EC2 (via AWS Session Manager)
PGPASSWORD="PYvHBVetTuWIKNkXgqJcFiU48D39SLwd" psql \
    -h yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com \
    -p 5432 \
    -U yukpo_admin \
    -d yukpo \
    -c "SELECT COUNT(*) as nb_tables FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';"
```

Si vous voyez un nombre élevé de tables (200+), les migrations ont bien été appliquées.

