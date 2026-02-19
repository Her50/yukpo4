# 🚀 Migrations Idempotentes sur EC2

## ✅ **Stratégie**

1. **Maintenant** : Exécuter toutes les migrations sur EC2 avec vérifications
2. **Futur** : Les migrations automatiques Git vérifieront l'existence avant de créer
3. **Résultat** : Pas de doublons, pas d'erreurs, tout est compatible

---

## ✅ **Étape 1 : Transférer les Migrations via SCP**

Depuis votre machine Windows (PowerShell) :

```powershell
# Aller dans le répertoire du projet
cd C:\Users\23767\yukpomnang2

# Trouver l'IP de votre instance EC2
$EC2_IP = aws ec2 describe-instances `
    --filters "Name=tag:Name,Values=yukpo-temp-db-creator" `
    --region eu-west-1 `
    --query 'Reservations[0].Instances[0].PublicIpAddress' `
    --output text

Write-Host "IP EC2: $EC2_IP"

# Transférer les migrations
# Remplacez "C:\chemin\vers\votre-cle.pem" par le chemin réel
scp -i "C:\chemin\vers\votre-cle.pem" -r backend/migrations ec2-user@${EC2_IP}:~/migrations/
```

---

## ✅ **Étape 2 : Sur EC2, Exécuter le Script Idempotent**

```bash
# Créer le script
cat > ~/executer_migrations_idempotent.sh << 'EOFMIGRATIONS'
#!/bin/bash
# ... (le contenu est dans scripts/executer_migrations_ec2_idempotent.sh)
EOFMIGRATIONS

# OU télécharger depuis le repository (si accessible)
# OU copier le contenu de scripts/executer_migrations_ec2_idempotent.sh

chmod +x ~/executer_migrations_idempotent.sh
~/executer_migrations_idempotent.sh
```

---

## ✅ **Vérification que les Migrations sont Idempotentes**

Toutes les migrations SQLx standard utilisent déjà `IF NOT EXISTS` :

- ✅ `CREATE TABLE IF NOT EXISTS`
- ✅ `CREATE INDEX IF NOT EXISTS`
- ✅ `CREATE EXTENSION IF NOT EXISTS`
- ✅ `CREATE OR REPLACE FUNCTION` (idempotent par défaut)

Le code Rust dans `auto_migrate.rs` vérifie aussi l'existence avant de créer.

---

## ✅ **Comportement Futur des Migrations Automatiques**

Quand `ENABLE_AUTO_MIGRATIONS=true` sera réactivé :

1. Le code vérifie l'existence des tables/colonnes/fonctions
2. Si elles existent déjà → passe sans erreur
3. Si elles n'existent pas → crée avec `IF NOT EXISTS`
4. Résultat : **Aucun doublon, aucune erreur**

---

## 📝 **Exemple de Vérification dans le Code**

Le code Rust fait déjà ceci :

```rust
// Vérifier si la table existe
let table_exists = sqlx::query_scalar::<_, bool>(
    "SELECT EXISTS(
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'ma_table'
    )",
)
.fetch_one(pool)
.await?;

if !table_exists {
    // Créer avec IF NOT EXISTS
    sqlx::query("CREATE TABLE IF NOT EXISTS ma_table (...)")
        .execute(pool)
        .await?;
} else {
    info!("✅ Table existe déjà");
}
```

---

## ✅ **Résultat Final**

- ✅ Toutes les migrations sont exécutées sur EC2
- ✅ Les migrations automatiques Git peuvent s'exécuter sans erreur
- ✅ Pas de doublons, tout est idempotent
- ✅ L'automatisation est conservée



