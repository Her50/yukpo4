# 🔐 Guide : Créer le compte SUPER SUPER ADMIN dans AWS PostgreSQL

## ⚠️ Problème de connexion

La base de données AWS RDS est dans un VPC privé et n'est **pas accessible directement** depuis votre machine locale. 

## ✅ Solutions pour exécuter le script

### Option 1 : Depuis une instance EC2 (Recommandé)

1. **Se connecter à une instance EC2** dans le même VPC que la base de données :
```bash
ssh -i votre-key.pem ec2-user@[IP-EC2]
```

2. **Cloner ou transférer les fichiers** :
```bash
# Option A : Cloner le repo
git clone https://github.com/Her50/yukpo4.git
cd yukpo4

# Option B : Transférer les fichiers
scp -i votre-key.pem scripts/create_super_admin_aws.sql ec2-user@[IP-EC2]:~/
```

3. **Installer psql** (si pas déjà installé) :
```bash
sudo yum install postgresql15 -y
# ou
sudo apt-get install postgresql-client -y
```

4. **Récupérer DATABASE_URL depuis SSM** :
```bash
DATABASE_URL=$(aws ssm get-parameter --name /yukpomnang/production/DATABASE_URL --region us-east-1 --with-decryption --query Parameter.Value --output text)
```

5. **Exécuter le script SQL** :
```bash
# Extraire les composants
DB_HOST=$(echo $DATABASE_URL | sed -n 's/.*@\([^:]*\):.*/\1/p')
DB_PORT=$(echo $DATABASE_URL | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
DB_USER=$(echo $DATABASE_URL | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
DB_PASS=$(echo $DATABASE_URL | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')
DB_NAME=$(echo $DATABASE_URL | sed -n 's/.*\/\([^?]*\).*/\1/p')

# Exécuter
PGPASSWORD=$DB_PASS psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f scripts/create_super_admin_aws.sql
```

### Option 2 : Via AWS Systems Manager (SSM) Session Manager

Si vous avez une instance EC2 avec SSM activé :

1. **Se connecter via SSM** :
```bash
aws ssm start-session --target i-[INSTANCE-ID] --region us-east-1
```

2. **Suivre les étapes de l'Option 1** (étapes 2-5)

### Option 3 : Via ECS Task (si vous avez un service ECS)

1. **Créer une task ECS** avec le script :
```bash
aws ecs run-task \
  --cluster yukpomnang-cluster \
  --task-definition yukpomnang-backend-task \
  --overrides '{
    "containerOverrides": [{
      "name": "backend",
      "command": ["psql", "$DATABASE_URL", "-f", "/app/scripts/create_super_admin_aws.sql"]
    }]
  }'
```

### Option 4 : Via AWS RDS Query Editor (si activé)

1. Aller dans **AWS RDS Console** → Votre base de données
2. Cliquer sur **Query Editor**
3. Copier-coller le contenu de `scripts/create_super_admin_aws.sql`
4. Exécuter

### Option 5 : Utiliser le binaire Rust depuis EC2

1. **Se connecter à EC2** (comme Option 1)
2. **Cloner le repo** et compiler :
```bash
git clone https://github.com/Her50/yukpo4.git
cd yukpo4/backend
cargo build --release --bin create_admin_user
```

3. **Modifier temporairement** `src/bin/create_admin_user.rs` :
   - Remplacer `'admin'` par `'super_admin'` (ligne 16 et 34)

4. **Exécuter** :
```bash
export DATABASE_URL=$(aws ssm get-parameter --name /yukpomnang/production/DATABASE_URL --region us-east-1 --with-decryption --query Parameter.Value --output text)
cargo run --bin create_admin_user
```

## 📋 Script SQL à exécuter

Le script `scripts/create_super_admin_aws.sql` contient :

```sql
INSERT INTO users (
    email, password_hash, role, nom_complet, tokens_balance, 
    token_price_user, token_price_provider, commission_pct, 
    preferred_lang, is_provider, created_at, updated_at
)
VALUES (
    'admin@yukpo.dev',
    '$2b$12$yi.th1fxm9Xrz6A.PjP9wuWyDrueHMZZBReIH7i7X.efPhGNV1Pii',
    'super_admin',  -- ✅ Rôle super_admin (tous les droits)
    'Super Super Admin',
    1000000, 1.0, 1.0, 0.0, 'fr', false, NOW(), NOW()
)
ON CONFLICT (email) DO UPDATE SET
    password_hash = EXCLUDED.password_hash,
    role = 'super_admin',
    nom_complet = EXCLUDED.nom_complet,
    updated_at = NOW();
```

## ✅ Vérification après création

```sql
SELECT id, email, role, nom_complet, tokens_balance, created_at
FROM users 
WHERE email = 'admin@yukpo.dev';
```

**Résultat attendu** :
- Email : `admin@yukpo.dev`
- Rôle : `super_admin` ✅
- Tokens : `1000000`

## 🔐 Identifiants de connexion

- **Email** : `admin@yukpo.dev`
- **Mot de passe** : `Hernandez87`
- **Rôle** : `super_admin` (tous les droits)

## 💡 Recommandation

**Utilisez l'Option 1 (EC2)** car c'est la méthode la plus simple et la plus sécurisée pour accéder à la base de données AWS RDS dans un VPC privé.

