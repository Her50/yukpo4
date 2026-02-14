# 🔧 Commande SCP Corrigée

## ✅ **Problème Identifié**

Vous étiez dans `C:\Windows\system32` au lieu de `C:\Users\23767\yukpomnang2`.

---

## ✅ **Solution : Commandes Corrigées**

### Étape 1 : Aller dans le Bon Répertoire (PowerShell)

```powershell
cd C:\Users\23767\yukpomnang2

# Vérifier que le dossier migrations existe
Test-Path backend/migrations

# Vérifier quelques fichiers
Get-ChildItem backend/migrations/*.sql | Select-Object -First 5
```

### Étape 2 : Trouver l'IP EC2

```powershell
$EC2_IP = aws ec2 describe-instances --filters "Name=tag:Name,Values=yukpo-temp-db-creator" --region eu-west-1 --query 'Reservations[0].Instances[0].PublicIpAddress' --output text

Write-Host "IP EC2: $EC2_IP"
```

### Étape 3 : Transférer les Migrations

**Option A : Avec SCP (si vous avez une clé .pem)**

```powershell
# Remplacez "C:\chemin\vers\votre-cle.pem" par le chemin réel de votre clé EC2
scp -i "C:\chemin\vers\votre-cle.pem" -r backend/migrations ec2-user@${EC2_IP}:~/migrations/
```

**Option B : Si vous n'avez pas de clé .pem, utiliser AWS Session Manager**

Voir la section "Alternative : AWS Session Manager" ci-dessous.

---

## ✅ **Alternative : AWS Session Manager (Sans Clé .pem)**

Si vous n'avez pas de clé .pem, utilisez AWS Session Manager pour copier les fichiers :

### Méthode 1 : Créer un Archive et le Transférer

```powershell
# Dans PowerShell, créer un archive ZIP
cd C:\Users\23767\yukpomnang2
Compress-Archive -Path backend/migrations -DestinationPath migrations.zip

# Copier le ZIP vers EC2 via AWS Systems Manager
aws ssm send-command `
    --instance-ids i-0b9ad404f8d738d04 `
    --region eu-west-1 `
    --document-name "AWS-RunShellScript" `
    --parameters 'commands=["mkdir -p ~/migrations"]'
```

Puis utilisez AWS Systems Manager pour copier le fichier.

### Méthode 2 : Créer les Migrations Directement sur EC2

Sur EC2, créer un script qui télécharge les migrations depuis votre repository (si public) ou les crée manuellement.

---

## ✅ **Solution Rapide : Créer les Migrations sur EC2**

Si le transfert SCP ne fonctionne pas, vous pouvez créer les migrations directement sur EC2 en les téléchargeant depuis GitHub (si le repo est public) ou en les créant manuellement.

### Sur EC2, Télécharger depuis GitHub (si public)

```bash
# Créer le dossier
mkdir -p ~/migrations
cd ~/migrations

# Télécharger les migrations une par une (si le repo est public)
# Remplacez USERNAME par votre username GitHub
for i in {1..41}; do
    NUM=$(printf "%08d" $i)
    curl -L "https://raw.githubusercontent.com/Her50/yukpo4/main/backend/migrations/000000${NUM}_*.sql" -o "000000${NUM}.sql" 2>/dev/null || true
done
```

---

## ✅ **Solution Recommandée : Utiliser le Chemin Absolu**

Dans PowerShell, utilisez le chemin absolu :

```powershell
# Aller dans le projet
cd C:\Users\23767\yukpomnang2

# Vérifier le chemin
$migrationsPath = Resolve-Path "backend/migrations"
Write-Host "Chemin migrations: $migrationsPath"

# Trouver l'IP EC2
$EC2_IP = aws ec2 describe-instances --filters "Name=tag:Name,Values=yukpo-temp-db-creator" --region eu-west-1 --query 'Reservations[0].Instances[0].PublicIpAddress' --output text

Write-Host "IP EC2: $EC2_IP"

# Transférer avec chemin absolu
scp -i "C:\chemin\vers\votre-cle.pem" -r "$migrationsPath" ec2-user@${EC2_IP}:~/migrations/
```

---

## ✅ **Vérification sur EC2**

Après le transfert, sur EC2 :

```bash
# Vérifier que les migrations sont là
ls -la ~/migrations/*.sql | head -10

# Compter les fichiers
ls -1 ~/migrations/*.sql | wc -l
```

---

## 📝 **Note**

Si vous n'avez pas de clé .pem, vous pouvez :
1. Utiliser AWS Session Manager pour accéder à EC2
2. Créer les migrations directement sur EC2
3. Utiliser AWS Systems Manager pour copier les fichiers

Dites-moi quelle méthode vous préférez !

