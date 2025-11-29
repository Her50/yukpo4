# 🔌 Informations de Connexion à la Base de Données Render

## 📋 Détails de Connexion

### Base de Données PostgreSQL sur Render
- **Host (Serveur):** `dpg-d2t7ntbuibrs73eh9tvg-a.frankfurt-postgres.render.com`
- **Port:** `5432` (par défaut PostgreSQL)
- **Database (Base de données):** `yukpo_db` ✅ **C'est le nom à utiliser!**
- **Username (Utilisateur):** `yukpo_db_user`
- **Password (Mot de passe):** `88X47ZWBiLkX5WatFcLU4KQ4rgaHYml4`

## 🔧 Comment se Connecter

### Méthode 1: Via psql (Ligne de commande)
```bash
psql "postgresql://yukpo_db_user:88X47ZWBiLkX5WatFcLU4KQ4rgaHYml4@dpg-d2t7ntbuibrs73eh9tvg-a.frankfurt-postgres.render.com/yukpo_db"
```

### Méthode 2: Via psql avec paramètres séparés
```bash
psql -h dpg-d2t7ntbuibrs73eh9tvg-a.frankfurt-postgres.render.com -U yukpo_db_user -d yukpo_db
```
Quand demandé, entrez le mot de passe: `88X47ZWBiLkX5WatFcLU4KQ4rgaHYml4`

### Méthode 3: Via pgAdmin ou DBeaver (Interface graphique)
1. **Type:** PostgreSQL
2. **Host:** `dpg-d2t7ntbuibrs73eh9tvg-a.frankfurt-postgres.render.com`
3. **Port:** `5432`
4. **Database:** `yukpo_db` ⬅️ **C'EST ÇA!**
5. **Username:** `yukpo_db_user`
6. **Password:** `88X47ZWBiLkX5WatFcLU4KQ4rgaHYml4`

## ✅ Pour Corriger le Checksum de la Migration 0

Une fois connecté à la base `yukpo_db`, exécutez cette commande SQL:

```sql
UPDATE _sqlx_migrations 
SET checksum = decode('d9868b70afef40490e6cde2e86c3df01eeeaf766d30724327c1df72f3104d598e10f58a1fdec9d450da2bd8f60b7b4db', 'hex') 
WHERE version = 0;
```

Puis vérifiez:
```sql
SELECT version, description, encode(checksum, 'hex') as checksum_hex 
FROM _sqlx_migrations 
WHERE version = 0;
```

## 📝 Commandes Utiles une fois Connecté

```sql
-- Voir toutes les migrations appliquées
SELECT version, description, installed_on, success 
FROM _sqlx_migrations 
ORDER BY version;

-- Vérifier le checksum de la migration 0
SELECT version, description, encode(checksum, 'hex') as checksum_hex 
FROM _sqlx_migrations 
WHERE version = 0;

-- Lister les tables
\dt

-- Quitter psql
\q
```

## ⚠️ Important

- **Database name:** `yukpo_db` (pas `v`, pas `yukpomnang`, pas autre chose)
- **Username:** `yukpo_db_user`
- Le serveur est sur Render, donc il faut une connexion internet






