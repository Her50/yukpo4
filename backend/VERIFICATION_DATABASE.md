# 🔍 Vérification Complète de la Base de Données Render

## 📋 Informations de Connexion

- **Hostname**: `dpg-d2t7ntbuibrs73eh9tvg-a`
- **Port**: `5432`
- **Database**: `yukpo_db`
- **Username**: `yukpo_db_user` ✅
- **URL**: `postgresql://yukpo_db_user:...@your-render-db-host.render.com/yukpo_db`

## ✅ Points à Vérifier

### 1. Configuration DATABASE_URL
- ✅ L'URL utilise `yukpo_db_user` (pas `postgres`)
- ✅ Format correct : `postgresql://user:password@host:port/database`

### 2. Connexions Actives
- Vérifier le nombre de connexions actives
- Identifier les utilisateurs connectés
- Vérifier les états des connexions (active, idle, idle in transaction)

### 3. Migrations Appliquées
- Vérifier la table `_sqlx_migrations`
- Lister les migrations récentes
- Vérifier les migrations en échec

### 4. Tables Principales
- Vérifier l'existence des tables principales
- Vérifier les schémas
- Vérifier les contraintes

### 5. Extensions PostgreSQL
- Vérifier les extensions installées (postgis, pg_trgm, etc.)
- Vérifier les versions

### 6. Permissions
- Vérifier les permissions de `yukpo_db_user`
- Vérifier les permissions sur les tables
- Vérifier les permissions sur les schémas

### 7. Taille et Performance
- Taille de la base de données
- Nombre de lignes par table
- Index manquants

### 8. Problèmes Potentiels
- Connexions orphelines
- Transactions longues
- Locks
- Erreurs récentes

## 🚀 Utilisation du Script de Vérification

```powershell
# Définir DATABASE_URL
$env:DATABASE_URL = "postgresql://user:password@host:port/database"

# Exécuter le script
.\backend\scripts\verify_database_connection.ps1
```

## 📊 Résultats Attendus

Le script vérifiera :
1. ✅ Connexion réussie
2. ✅ Utilisateur correct (`yukpo_db_user`)
3. ✅ Connexions actives
4. ✅ Migrations appliquées
5. ✅ Tables principales
6. ✅ Extensions installées
7. ✅ Permissions
8. ✅ Taille de la base

