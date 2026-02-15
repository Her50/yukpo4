# 🚀 Commande Rapide - Migrations EC2

## ✅ **Option 1 : Si le Repository est Déjà Cloné**

```bash
# Trouver le dossier migrations
cd ~
find . -name "00000001_create_extensions.sql" 2>/dev/null

# Une fois trouvé, aller dans ce répertoire
cd ~/yukpomnang2  # ou le chemin trouvé
cd backend

# Exécuter le script
chmod +x scripts/executer_migrations_ec2_avec_verification.sh
./scripts/executer_migrations_ec2_avec_verification.sh
```

---

## ✅ **Option 2 : Cloner le Repository**

```bash
# Cloner le repository
cd ~
git clone https://github.com/VOTRE_USERNAME/yukpomnang2.git
cd yukpomnang2/backend

# Exécuter les migrations
chmod +x ../scripts/executer_migrations_ec2_avec_verification.sh
../scripts/executer_migrations_ec2_avec_verification.sh
```

---

## ✅ **Option 3 : Télécharger les Migrations depuis GitHub (Sans Cloner)**

```bash
# Créer le dossier
mkdir -p ~/migrations
cd ~/migrations

# Télécharger chaque migration (exemple pour les 5 premières)
for i in {1..41}; do
    NUM=$(printf "%08d" $i)
    # Remplacer USERNAME par votre username GitHub
    curl -L "https://raw.githubusercontent.com/USERNAME/yukpomnang2/main/backend/migrations/000000${NUM}_*.sql" -o "000000${NUM}.sql" 2>/dev/null || true
done

# OU télécharger toutes les migrations d'un coup (si vous avez l'URL du dossier)
# wget -r -np -nH --cut-dirs=3 https://github.com/USERNAME/yukpomnang2/tree/main/backend/migrations/
```

---

## ✅ **Option 4 : Commande Directe avec Chemin Absolu**

```bash
# Si vous savez où sont les migrations, utiliser directement
PGPASSWORD="PYvHBVetTuWIKNkXgqJcFiU48D39SLwd" psql \
    -h yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com \
    -p 5432 \
    -U yukpo_admin \
    -d yukpo \
    -f /chemin/vers/migrations/00000001_create_extensions.sql
```

---

## 🔍 **Trouver où Vous Êtes**

```bash
# Vérifier le répertoire actuel
pwd

# Lister les fichiers autour
ls -la

# Chercher les migrations
find ~ -name "*.sql" -path "*/migrations/*" 2>/dev/null | head -5

# Chercher le dossier backend
find ~ -type d -name "backend" 2>/dev/null
```

---

## 📝 **Note**

Le script `executer_migrations_ec2_avec_verification.sh` cherche automatiquement le dossier migrations dans plusieurs emplacements possibles. Utilisez-le si vous n'êtes pas sûr de l'emplacement.


