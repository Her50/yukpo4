# 🔍 Vérifier les Logs des Migrations

## ✅ **Commande Sans Emojis (Pour Éviter l'Erreur d'Encodage)**

```powershell
# Vérifier les logs des migrations (sans emojis)
aws logs tail /ecs/yukpo-backend --since 10m --region eu-west-1 | Select-String -Pattern "migration|ENABLE_AUTO_MIGRATIONS|existe|Table|Colonne|Fonction" | Select-Object -Last 30
```

---

## ✅ **Alternative : Voir Tous les Logs Récents**

```powershell
# Voir les 50 dernières lignes
aws logs tail /ecs/yukpo-backend --since 10m --region eu-west-1 --format short | Select-Object -Last 50
```

---

## ✅ **Alternative : Filtrer avec Grep (Si Installé)**

```powershell
# Si vous avez grep installé
aws logs tail /ecs/yukpo-backend --since 10m --region eu-west-1 | findstr /i "migration ENABLE_AUTO_MIGRATIONS existe Table Colonne"
```

---

## ✅ **Alternative : Sauvegarder dans un Fichier**

```powershell
# Sauvegarder les logs dans un fichier
aws logs tail /ecs/yukpo-backend --since 10m --region eu-west-1 > logs_recent.txt

# Puis ouvrir le fichier
notepad logs_recent.txt

# OU chercher dans le fichier
Select-String -Path logs_recent.txt -Pattern "migration|ENABLE_AUTO_MIGRATIONS|existe" | Select-Object -Last 30
```

---

## ✅ **Vérification Simple : Tester l'Endpoint Health**

```powershell
# Récupérer l'IP publique
$TASK_ARN = aws ecs list-tasks --cluster yukpo-cluster --service-name yukpo-backend-service --region eu-west-1 --desired-status RUNNING --query 'taskArns[0]' --output text

$ENI_ID = aws ecs describe-tasks --cluster yukpo-cluster --tasks $TASK_ARN --region eu-west-1 --query 'tasks[0].attachments[0].details[?name==`networkInterfaceId`].value' --output text

$PUBLIC_IP = aws ec2 describe-network-interfaces --network-interface-ids $ENI_ID --region eu-west-1 --query 'NetworkInterfaces[0].Association.PublicIp' --output text

Write-Host "IP Publique: $PUBLIC_IP"

# Tester
curl http://${PUBLIC_IP}:8080/health
```

