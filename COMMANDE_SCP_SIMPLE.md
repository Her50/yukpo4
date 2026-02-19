# 🚀 Commande SCP Simple - Copier-Coller

## ✅ **Commandes Complètes (PowerShell)**

```powershell
# 1. Aller dans le projet
cd C:\Users\23767\yukpomnang2

# 2. Vérifier que migrations existe
dir backend\migrations\*.sql | Select-Object -First 5

# 3. Trouver l'IP EC2
$EC2_IP = aws ec2 describe-instances --filters "Name=tag:Name,Values=yukpo-temp-db-creator" --region eu-west-1 --query 'Reservations[0].Instances[0].PublicIpAddress' --output text
Write-Host "IP EC2: $EC2_IP"

# 4. Transférer (REMPLACEZ le chemin de la clé)
scp -i "C:\chemin\vers\votre-cle.pem" -r backend\migrations ec2-user@${EC2_IP}:~/migrations/
```

---

## ✅ **Si vous n'avez pas de clé .pem**

Utilisez AWS Session Manager pour accéder à EC2, puis créez les migrations directement sur EC2.

### Sur EC2, créer un script de téléchargement

```bash
# Sur EC2, créer le dossier
mkdir -p ~/migrations
cd ~/migrations

# Télécharger depuis GitHub (si le repo est public)
# OU créer manuellement les migrations
```

---

## ✅ **Vérification après Transfert**

Sur EC2 :

```bash
ls -la ~/migrations/*.sql | head -10
ls -1 ~/migrations/*.sql | wc -l
```



