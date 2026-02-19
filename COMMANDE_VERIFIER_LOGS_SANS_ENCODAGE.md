# 🔍 Vérifier les Logs - Sans Problème d'Encodage

## ✅ **Solution : Sauvegarder dans un Fichier**

```powershell
# Sauvegarder les logs dans un fichier (UTF-8)
aws logs tail /ecs/yukpo-backend --since 10m --region eu-west-1 | Out-File -FilePath logs_recent.txt -Encoding utf8

# Puis chercher dans le fichier
Select-String -Path logs_recent.txt -Pattern "migration|ENABLE_AUTO_MIGRATIONS|existe|Table|Colonne|Fonction" | Select-Object -Last 30
```

---

## ✅ **Alternative : Utiliser la Console AWS**

1. Allez sur : https://console.aws.amazon.com/cloudwatch/
2. **Logs** → **Log groups** → `/ecs/yukpo-backend`
3. Cliquez sur le dernier log stream
4. Cherchez les mots-clés : `migration`, `ENABLE_AUTO_MIGRATIONS`, `existe`

---

## ✅ **Alternative : Utiliser AWS CLI avec Format JSON**

```powershell
# Récupérer les logs en format JSON
aws logs tail /ecs/yukpo-backend --since 10m --region eu-west-1 --format json | Out-File -FilePath logs.json -Encoding utf8

# Puis chercher
Select-String -Path logs.json -Pattern "migration|ENABLE_AUTO_MIGRATIONS|existe" | Select-Object -Last 30
```

---

## ✅ **Vérification Simple : Tester l'Endpoint**

Si les logs posent problème, testez directement l'endpoint :

```powershell
# Récupérer l'IP publique
$TASK_ARN = aws ecs list-tasks --cluster yukpo-cluster --service-name yukpo-backend-service --region eu-west-1 --desired-status RUNNING --query 'taskArns[0]' --output text

$ENI_ID = aws ecs describe-tasks --cluster yukpo-cluster --tasks $TASK_ARN --region eu-west-1 --query 'tasks[0].attachments[0].details[?name==`networkInterfaceId`].value' --output text

$PUBLIC_IP = aws ec2 describe-network-interfaces --network-interface-ids $ENI_ID --region eu-west-1 --query 'NetworkInterfaces[0].Association.PublicIp' --output text

Write-Host "IP Publique: $PUBLIC_IP"

# Tester
curl http://${PUBLIC_IP}:8080/health
```

---

## ✅ **Vérification Directe dans la Base de Données**

Si vous voulez vérifier que les migrations ont bien été appliquées :

```powershell
# Sur EC2, vérifier le nombre de tables
# (Vous pouvez utiliser AWS Session Manager pour vous connecter à EC2)
```



