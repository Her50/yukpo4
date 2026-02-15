# 📦 Transférer les Migrations vers EC2

## ✅ **Méthode 1 : Cloner le Repository sur EC2 (Recommandé)**

```bash
# Sur EC2, cloner le repository
cd ~
git clone https://github.com/VOTRE_USERNAME/yukpomnang2.git
# OU si vous avez déjà cloné, faire un pull
cd yukpomnang2
git pull origin main

# Vérifier que les migrations existent
ls -la backend/migrations/*.sql | head -10

# Exécuter les migrations depuis le bon répertoire
cd ~/yukpomnang2
```

---

## ✅ **Méthode 2 : Transférer via SCP depuis votre Machine Locale**

```bash
# Depuis votre machine Windows (PowerShell)
# Remplacer EC2_IP par l'IP de votre instance EC2
# Remplacer EC2_KEY par votre fichier .pem

scp -i EC2_KEY.pem -r backend/migrations ec2-user@EC2_IP:~/yukpomnang2/backend/

# OU si vous êtes dans le répertoire du projet
scp -i EC2_KEY.pem -r backend/migrations/*.sql ec2-user@EC2_IP:~/migrations/
```

---

## ✅ **Méthode 3 : Créer les Migrations Directement sur EC2**

Si vous ne pouvez pas transférer, créer un script qui exécute les migrations directement depuis le code compilé (elles sont incluses avec `include_str!`).

---

## ✅ **Méthode 4 : Utiliser le Chemin Absolu**

Vérifier où vous êtes sur EC2 et ajuster le chemin :

```bash
# Sur EC2, vérifier votre répertoire actuel
pwd

# Chercher les migrations
find ~ -name "00000001_create_extensions.sql" 2>/dev/null

# OU chercher le répertoire backend
find ~ -type d -name "backend" 2>/dev/null

# Une fois trouvé, ajuster le chemin dans la commande
```

---

## ✅ **Commande Complète avec Vérification du Chemin**

```bash
# 1. Vérifier où vous êtes
echo "📁 Répertoire actuel: $(pwd)"

# 2. Chercher les migrations
MIGRATIONS_DIR=$(find ~ -type d -name "migrations" -path "*/backend/migrations" 2>/dev/null | head -1)

if [ -z "$MIGRATIONS_DIR" ]; then
    echo "❌ Dossier migrations non trouvé"
    echo "📦 Options:"
    echo "   1. Cloner le repository: git clone <URL>"
    echo "   2. Transférer via SCP depuis votre machine"
    echo "   3. Créer le dossier manuellement"
    exit 1
fi

echo "✅ Migrations trouvées dans: $MIGRATIONS_DIR"

# 3. Exécuter les migrations
cd "$(dirname "$MIGRATIONS_DIR")"

# Liste des migrations
MIGRATIONS=(
    "00000001_create_extensions.sql"
    "00000002_create_base_tables.sql"
    # ... (liste complète)
)

for migration in "${MIGRATIONS[@]}"; do
    if [ -f "migrations/$migration" ]; then
        echo "📄 Exécution de: $migration"
        PGPASSWORD="PYvHBVetTuWIKNkXgqJcFiU48D39SLwd" psql \
            -h yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com \
            -p 5432 \
            -U yukpo_admin \
            -d yukpo \
            -f "migrations/$migration" 2>&1 | grep -v "already exists" | grep -v "NOTICE"
        echo "✅ $migration terminée"
    else
        echo "⚠️  $migration non trouvé"
    fi
done
```


