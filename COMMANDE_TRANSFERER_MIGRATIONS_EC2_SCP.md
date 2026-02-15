# 📦 Transférer les Migrations via SCP (Recommandé)

## ✅ **Méthode 1 : Depuis Windows PowerShell**

```powershell
# 1. Aller dans le répertoire du projet
cd C:\Users\23767\yukpomnang2

# 2. Transférer le dossier migrations vers EC2
# Remplacez EC2_IP par l'IP de votre instance EC2
# Remplacez EC2_KEY.pem par le chemin vers votre clé .pem

scp -i EC2_KEY.pem -r backend/migrations ec2-user@EC2_IP:~/migrations/

# OU si vous voulez garder la structure complète
scp -i EC2_KEY.pem -r backend/migrations ec2-user@EC2_IP:~/yukpomnang2/backend/
```

---

## ✅ **Méthode 2 : Créer les Migrations Directement sur EC2**

Si vous ne pouvez pas utiliser SCP, créez un script qui télécharge les migrations depuis GitHub (nécessite un token) :

```bash
# Sur EC2, créer un token GitHub (si vous avez accès)
# Puis télécharger les migrations une par une
```

---

## ✅ **Méthode 3 : Utiliser Git avec Token (Sur EC2)**

```bash
# Créer un token GitHub : https://github.com/settings/tokens
# Puis cloner avec le token

git clone https://VOTRE_TOKEN@github.com/Her50/yukpo4.git yukpomnang2

# OU configurer Git pour utiliser le token
git config --global credential.helper store
echo "https://VOTRE_TOKEN@github.com" > ~/.git-credentials
git clone https://github.com/Her50/yukpo4.git yukpomnang2
```

---

## ✅ **Méthode 4 : Créer les Migrations Manuellement (Rapide)**

Si vous avez déjà les migrations sur votre machine, la méthode SCP est la plus simple.


