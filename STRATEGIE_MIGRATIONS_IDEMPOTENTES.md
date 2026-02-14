# 🎯 Stratégie Migrations Idempotentes

## ✅ **Objectif**

Exécuter toutes les migrations sur EC2 maintenant, puis permettre aux migrations automatiques Git de s'exécuter sans erreur car tout sera déjà créé.

---

## ✅ **État Actuel**

### 1. Migrations SQLx Standard
- ✅ Utilisent déjà `IF NOT EXISTS` partout
- ✅ `CREATE TABLE IF NOT EXISTS`
- ✅ `CREATE INDEX IF NOT EXISTS`
- ✅ `CREATE EXTENSION IF NOT EXISTS`
- ✅ `CREATE OR REPLACE FUNCTION` (idempotent)

### 2. Code Rust (`auto_migrate.rs`)
- ✅ Vérifie l'existence avant de créer
- ✅ Utilise `IF NOT EXISTS` dans les requêtes SQL
- ✅ Logs informatifs quand les objets existent déjà

---

## ✅ **Plan d'Action**

### Étape 1 : Transférer les Migrations sur EC2

```powershell
# Depuis Windows PowerShell
cd C:\Users\23767\yukpomnang2

# Trouver l'IP EC2
$EC2_IP = aws ec2 describe-instances `
    --filters "Name=tag:Name,Values=yukpo-temp-db-creator" `
    --region eu-west-1 `
    --query 'Reservations[0].Instances[0].PublicIpAddress' `
    --output text

# Transférer
scp -i "C:\chemin\vers\cle.pem" -r backend/migrations ec2-user@${EC2_IP}:~/migrations/
```

### Étape 2 : Exécuter les Migrations sur EC2

```bash
# Sur EC2, créer le script
cat > ~/executer_migrations.sh << 'SCRIPT'
# ... (voir scripts/executer_migrations_ec2_idempotent.sh)
SCRIPT

chmod +x ~/executer_migrations.sh
~/executer_migrations.sh
```

### Étape 3 : Réactiver les Migrations Automatiques (Plus Tard)

Quand vous serez prêt :

```bash
# Dans ECS, remettre ENABLE_AUTO_MIGRATIONS=true
# Les migrations automatiques vérifieront l'existence
# et passeront sans erreur car tout est déjà créé
```

---

## ✅ **Comportement Futur**

Quand `ENABLE_AUTO_MIGRATIONS=true` :

1. **Vérification d'existence** : Le code vérifie si les tables/colonnes/fonctions existent
2. **Si existe** : Log "✅ existe déjà" et continue
3. **Si n'existe pas** : Crée avec `IF NOT EXISTS`
4. **Résultat** : Aucune erreur, aucun doublon

---

## ✅ **Exemples de Code Idempotent**

### Exemple 1 : Vérification dans Rust

```rust
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
    sqlx::query("CREATE TABLE IF NOT EXISTS ma_table (...)")
        .execute(pool)
        .await?;
} else {
    info!("✅ Table existe déjà");
}
```

### Exemple 2 : SQL Direct

```sql
CREATE TABLE IF NOT EXISTS ma_table (
    id SERIAL PRIMARY KEY,
    name TEXT
);

CREATE INDEX IF NOT EXISTS idx_ma_table_name ON ma_table(name);
```

---

## ✅ **Avantages**

1. ✅ **Pas de doublons** : `IF NOT EXISTS` empêche les créations multiples
2. ✅ **Pas d'erreurs** : Les vérifications préviennent les conflits
3. ✅ **Automatisation conservée** : Les migrations Git continueront de fonctionner
4. ✅ **Flexibilité** : Peut exécuter manuellement ou automatiquement

---

## 📝 **Checklist**

- [x] Migrations SQLx utilisent `IF NOT EXISTS`
- [x] Code Rust vérifie l'existence avant de créer
- [x] Script d'exécution EC2 créé
- [ ] Migrations transférées sur EC2
- [ ] Migrations exécutées sur EC2
- [ ] Vérification que tout fonctionne
- [ ] Réactivation des migrations automatiques (optionnel)

---

## 🎯 **Résultat Final**

- ✅ Toutes les migrations sont exécutées sur EC2
- ✅ Les migrations automatiques Git peuvent s'exécuter sans erreur
- ✅ Pas de doublons, tout est idempotent
- ✅ L'automatisation est conservée et fonctionne correctement

