# ✅ Exécuter les Migrations SQLx Maintenant

**Date**: 2026-02-15  
**Statut**: ✅ **Prêt à exécuter**

---

## 📋 Fichiers Créés

1. **`temp_execute_migrations.sql`** (2.6 MB)
   - Contient toutes les 362 migrations SQLx
   - Prêt à être exécuté

2. **Scripts PowerShell** :
   - `scripts/executer-migrations-via-gcloud.ps1` - Via gcloud sql connect
   - `scripts/executer-migrations-complet.ps1` - Via cargo sqlx migrate run (avec autorisation IP)

---

## 🚀 Méthode 1 : Via cargo sqlx migrate run (Recommandé)

### Étape 1 : Autoriser votre IP dans Cloud SQL

```powershell
# Récupérer votre IP publique
$localIp = (Invoke-WebRequest -Uri "https://api.ipify.org" -UseBasicParsing).Content.Trim()

# Autoriser l'IP
$gcloudPath = "C:\Program Files (x86)\Google\Cloud SDK\google-cloud-sdk\bin"
$env:Path += ";$gcloudPath"
gcloud sql instances patch yukpo-postgres --authorized-networks=$localIp/32 --project=yukpo-project
```

### Étape 2 : Exécuter les migrations

```powershell
.\scripts\executer-migrations-complet.ps1
```

**Le script va** :
- ✅ Récupérer l'IP publique Cloud SQL
- ✅ Autoriser votre IP automatiquement
- ✅ Demander le mot de passe de manière sécurisée
- ✅ Exécuter `cargo sqlx migrate run`

---

## 🚀 Méthode 2 : Via gcloud sql connect (Alternative)

### Étape 1 : Se connecter à Cloud SQL

```powershell
$gcloudPath = "C:\Program Files (x86)\Google\Cloud SDK\google-cloud-sdk\bin"
$env:Path += ";$gcloudPath"
gcloud sql connect yukpo-postgres --user=yukpo_user --database=yukpo_db --project=yukpo-project
```

### Étape 2 : Dans psql, exécuter le script

```sql
\i temp_execute_migrations.sql
```

**OU** copiez-collez le contenu du fichier dans psql.

---

## 🚀 Méthode 3 : Via psql direct (Si IP autorisée)

```powershell
psql -h 34.79.199.41 -U yukpo_user -d yukpo_db -f temp_execute_migrations.sql
```

**Vous serez demandé le mot de passe.**

---

## ✅ Vérification Après Exécution

### Vérifier que les migrations ont été appliquées

```sql
-- Compter les migrations appliquées
SELECT COUNT(*) FROM _sqlx_migrations;

-- Voir les dernières migrations
SELECT version, description, installed_on 
FROM _sqlx_migrations 
ORDER BY installed_on DESC 
LIMIT 10;
```

### Vérifier que les tables principales existent

```sql
-- Lister toutes les tables
\dt

-- Vérifier les tables critiques
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('users', 'services', 'deliveries', 'orders', 'products')
ORDER BY table_name;
```

---

## ⚠️ Important

### Autorisation IP

**Avant d'exécuter les migrations**, assurez-vous que votre IP publique est autorisée dans Cloud SQL :

1. **Récupérer votre IP publique** :
```powershell
Invoke-WebRequest -Uri "https://api.ipify.org" -UseBasicParsing | Select-Object -ExpandProperty Content
```

2. **Autoriser l'IP dans Cloud SQL** :
```powershell
$gcloudPath = "C:\Program Files (x86)\Google\Cloud SDK\google-cloud-sdk\bin"
$env:Path += ";$gcloudPath"
gcloud sql instances patch yukpo-postgres --authorized-networks=VOTRE_IP/32 --project=yukpo-project
```

---

## 📋 Checklist

- [x] **Fichier SQL créé** : `temp_execute_migrations.sql` (362 migrations)
- [ ] **IP publique autorisée** : Dans Cloud SQL authorized networks
- [ ] **Migrations exécutées** : Via une des 3 méthodes ci-dessus
- [ ] **Vérification** : Tables créées dans Cloud SQL
- [x] **ENABLE_SQLX_MIGRATIONS** : `true` dans Cloud Run (déjà fait)

---

## 🚀 Après l'Exécution

Une fois les migrations exécutées :

1. **Vérifier les logs Cloud Run** pour confirmer que les migrations ne sont plus nécessaires
2. **Optionnel** : Désactiver `ENABLE_SQLX_MIGRATIONS` après la première exécution
3. **Les migrations automatiques** prendront le relais pour les futures migrations

---

**✅ Prêt à exécuter les migrations !**

Utilisez la **Méthode 1** (`.\scripts\executer-migrations-complet.ps1`) pour une exécution automatique complète.


