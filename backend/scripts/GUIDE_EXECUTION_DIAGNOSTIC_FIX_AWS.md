# Guide d'Exécution des Scripts de Diagnostic et Correction AWS

## 📋 Vue d'ensemble

Deux méthodes sont disponibles pour exécuter les scripts de diagnostic et correction sur la base de données AWS :

1. **Méthode Rust (recommandée)** : Meilleure gestion SSL, plus robuste
2. **Méthode psql** : Directe mais peut avoir des problèmes SSL

## 🔑 Obtenir DATABASE_URL AWS

### Option 1: Depuis AWS Console

1. Allez dans **AWS RDS Console**
2. Sélectionnez votre instance de base de données
3. Onglet **Connectivity & security**
4. Copiez l'**Endpoint** (ex: `yukpomnang-db.xxxxx.us-east-1.rds.amazonaws.com`)
5. Format: `postgresql://username:password@endpoint:5432/database_name`

### Option 2: Depuis AWS Secrets Manager

```powershell
# Installer AWS CLI si pas déjà fait
# aws configure

# Récupérer depuis Secrets Manager
$secret = aws secretsmanager get-secret-value --secret-id yukpomnang/production/DATABASE_URL --region us-east-1 --query SecretString --output text
$env:DATABASE_URL = $secret
```

### Option 3: Depuis AWS SSM Parameter Store

```powershell
$param = aws ssm get-parameter --name /yukpomnang/production/DATABASE_URL --region us-east-1 --with-decryption --query Parameter.Value --output text
$env:DATABASE_URL = $param
```

## 🚀 Méthode 1: Utiliser Rust (Recommandée)

### Avantages
- ✅ Meilleure gestion SSL/TLS
- ✅ Gestion automatique des erreurs
- ✅ Plus robuste avec AWS RDS

### Exécution

```powershell
# Depuis le répertoire backend/scripts
cd backend/scripts

# Définir DATABASE_URL
$env:DATABASE_URL = "postgresql://user:password@host:5432/database"

# Exécuter avec Rust (auto-confirmation)
.\run_diagnostic_fix.ps1 -UseRust -AutoConfirm

# Ou avec confirmation interactive
.\run_diagnostic_fix.ps1 -UseRust
```

### Avec DATABASE_URL en paramètre

```powershell
.\run_diagnostic_fix.ps1 -UseRust -DatabaseUrl "postgresql://user:pass@host:5432/db" -AutoConfirm
```

## 🔧 Méthode 2: Utiliser psql (Alternative)

### Exécution

```powershell
# Depuis le répertoire backend/scripts
cd backend/scripts

# Définir DATABASE_URL
$env:DATABASE_URL = "postgresql://user:password@host:5432/database"

# Exécuter avec psql
.\run_diagnostic_fix.ps1 -AutoConfirm
```

**Note**: Si vous rencontrez des erreurs SSL avec psql, utilisez la méthode Rust.

## 📝 Exécution Directe avec Rust

Si vous préférez exécuter directement le binaire Rust :

```powershell
# Depuis le répertoire backend
cd backend

# Définir DATABASE_URL
$env:DATABASE_URL = "postgresql://user:password@host:5432/database"

# Avec auto-confirmation
$env:AUTO_CONFIRM = "true"
cargo run --bin execute_diagnostic_fix

# Ou avec confirmation interactive
cargo run --bin execute_diagnostic_fix
```

## 🔍 Vérification

Après exécution, vérifiez :

1. **Tables créées** : Vérifiez que `specialized_reservations` existe
2. **Fonctions** : Vérifiez qu'il n'y a qu'une seule version de `hybrid_image_search`
3. **Types** : Vérifiez que `pharmacy_products.id` est INTEGER (pas UUID)
4. **Index** : Vérifiez que les index problématiques ont été corrigés

## ⚠️ Notes Importantes

1. **Backup** : Faites un backup de la base de données avant d'exécuter les scripts de correction
2. **VPC** : Si la base de données est dans un VPC privé, vous devez être connecté via VPN ou depuis une instance EC2 dans le même VPC
3. **SSL** : AWS RDS nécessite SSL. Le script Rust gère cela automatiquement
4. **Permissions** : Assurez-vous d'avoir les permissions nécessaires sur la base de données

## 🐛 Dépannage

### Erreur SSL avec psql

**Solution** : Utilisez la méthode Rust (`-UseRust`)

### Erreur de connexion

**Vérifications** :
1. DATABASE_URL est correcte
2. Le Security Group RDS autorise votre IP
3. La base de données est accessible (pas dans un VPC privé sans VPN)

### Erreur "cargo not found"

**Solution** : Installez Rust depuis https://rustup.rs/

## 📚 Fichiers Créés

- `backend/src/bin/execute_diagnostic_fix.rs` - Script Rust
- `backend/scripts/run_diagnostic_fix.ps1` - Script PowerShell
- `backend/scripts/diagnostic_migrations_aws.sql` - Script SQL de diagnostic
- `backend/scripts/fix_migrations_aws.sql` - Script SQL de correction


