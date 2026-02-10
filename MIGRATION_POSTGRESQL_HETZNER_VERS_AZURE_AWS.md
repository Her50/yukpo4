# 🔄 Guide de Migration PostgreSQL : Hetzner → Azure/AWS

## ✅ Réponse Rapide

**OUI, la migration PostgreSQL de Hetzner vers Azure ou AWS est possible et relativement simple !**

PostgreSQL utilise un format standard, donc les données peuvent être migrées facilement entre n'importe quels fournisseurs PostgreSQL.

---

## 📋 Méthodes de Migration

### **Méthode 1 : pg_dump / pg_restore (Recommandée)**

La méthode la plus simple et fiable pour migrer une base de données PostgreSQL complète.

#### **Étape 1 : Exporter depuis Hetzner**

```bash
# Se connecter au serveur Hetzner
ssh root@46.224.14.85

# Exporter la base de données
pg_dump -h localhost -U yukpo_user -d yukpomnang \
  --format=custom \
  --file=/tmp/yukpomnang_backup.dump \
  --verbose

# OU exporter en SQL (plus simple mais plus lent)
pg_dump -h localhost -U yukpo_user -d yukpomnang \
  --file=/tmp/yukpomnang_backup.sql \
  --verbose
```

#### **Étape 2 : Télécharger le backup**

```bash
# Depuis votre machine locale
scp root@46.224.14.85:/tmp/yukpomnang_backup.dump ./yukpomnang_backup.dump
```

#### **Étape 3A : Importer vers Azure Database for PostgreSQL**

```bash
# Installer Azure CLI si nécessaire
# az login

# Créer la base de données Azure (si pas déjà créée)
az postgres flexible-server create \
  --resource-group yukpomnang-rg \
  --name yukpomnang-db \
  --location westeurope \
  --admin-user yukpo_admin \
  --admin-password "VotreMotDePasseSecurise" \
  --sku-name Standard_B2s \
  --version 15

# Créer la base de données
az postgres flexible-server db create \
  --resource-group yukpomnang-rg \
  --server-name yukpomnang-db \
  --database-name yukpomnang

# Restaurer le backup
pg_restore \
  --host=yukpomnang-db.postgres.database.azure.com \
  --port=5432 \
  --username=yukpo_admin \
  --dbname=yukpomnang \
  --verbose \
  --no-owner \
  --no-acl \
  yukpomnang_backup.dump
```

#### **Étape 3B : Importer vers AWS RDS PostgreSQL**

```bash
# Créer l'instance RDS (si pas déjà créée)
# Via AWS Console ou Terraform

# Restaurer le backup
pg_restore \
  --host=yukpomnang-db.xxxxx.eu-west-1.rds.amazonaws.com \
  --port=5432 \
  --username=yukpo_admin \
  --dbname=yukpomnang \
  --verbose \
  --no-owner \
  --no-acl \
  yukpomnang_backup.dump
```

---

### **Méthode 2 : Réplication en Streaming (Zero Downtime)**

Pour une migration sans interruption de service.

#### **Configuration Réplication**

```bash
# Sur Hetzner (source)
# Modifier postgresql.conf
wal_level = replica
max_wal_senders = 3
max_replication_slots = 3

# Modifier pg_hba.conf
host replication yukpo_user 0.0.0.0/0 md5

# Redémarrer PostgreSQL
systemctl restart postgresql

# Créer un slot de réplication
psql -U yukpo_user -d yukpomnang -c \
  "SELECT pg_create_physical_replication_slot('azure_replica');"
```

#### **Sur Azure/AWS (destination)**

```bash
# Créer la base de données vide
createdb -h yukpomnang-db.postgres.database.azure.com \
  -U yukpo_admin \
  yukpomnang

# Initialiser la réplication
pg_basebackup \
  -h 46.224.14.85 \
  -U yukpo_user \
  -D /var/lib/postgresql/data \
  -Fp \
  -Xs \
  -P \
  -R \
  -S azure_replica
```

---

### **Méthode 3 : Outils Cloud (Azure Data Migration / AWS DMS)**

#### **Azure Database Migration Service**

```bash
# Via Azure Portal
1. Créer un service Azure Database Migration Service
2. Créer un projet de migration
3. Source : Hetzner PostgreSQL (46.224.14.85:5432)
4. Destination : Azure Database for PostgreSQL
5. Sélectionner les tables à migrer
6. Démarrer la migration
```

#### **AWS Database Migration Service (DMS)**

```bash
# Via AWS Console
1. Créer un endpoint source (Hetzner)
2. Créer un endpoint destination (RDS)
3. Créer une tâche de réplication
4. Démarrer la migration continue
```

---

## 🔧 Prérequis et Vérifications

### **1. Vérifier les Extensions PostgreSQL**

Hetzner utilise probablement `pgvector` et `imgsmlr`. Vérifiez que Azure/AWS les supportent :

```sql
-- Sur Hetzner
SELECT extname, extversion FROM pg_extension;

-- Résultat attendu :
-- pgvector
-- imgsmlr
-- postgis (si utilisé)
```

**Support Extensions** :
- ✅ **Azure** : Supporte pgvector, PostGIS
- ✅ **AWS RDS** : Supporte pgvector, PostGIS
- ⚠️ **imgsmlr** : Peut nécessiter installation manuelle

### **2. Vérifier la Taille de la Base**

```sql
-- Taille totale
SELECT pg_size_pretty(pg_database_size('yukpomnang'));

-- Taille par table
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

### **3. Vérifier les Versions PostgreSQL**

```sql
-- Sur Hetzner
SELECT version();

-- Sur Azure/AWS
-- Vérifier que la version est compatible (même version majeure recommandée)
```

---

## 📊 Comparaison des Méthodes

| Méthode | Temps d'arrêt | Complexité | Recommandation |
|---------|---------------|------------|----------------|
| **pg_dump/pg_restore** | 1-4 heures | ⭐ Facile | ✅ **Recommandé** pour migration unique |
| **Réplication Streaming** | 0 (zero downtime) | ⭐⭐⭐ Complexe | Pour migration sans interruption |
| **Azure DMS / AWS DMS** | Variable | ⭐⭐ Moyenne | Pour migrations automatisées |

---

## 🚀 Plan de Migration Recommandé

### **Phase 1 : Préparation (1-2 jours)**

1. ✅ Vérifier la taille de la base de données
2. ✅ Lister les extensions PostgreSQL utilisées
3. ✅ Créer l'instance PostgreSQL sur Azure/AWS
4. ✅ Tester la connexion depuis votre machine

### **Phase 2 : Backup Test (1 jour)**

1. ✅ Faire un backup complet depuis Hetzner
2. ✅ Restaurer sur une instance de test Azure/AWS
3. ✅ Vérifier l'intégrité des données
4. ✅ Tester les extensions (pgvector, etc.)

### **Phase 3 : Migration Production (1 jour)**

1. ✅ **Maintenance Window** : Prévenir les utilisateurs
2. ✅ Arrêter l'application (ou mettre en mode maintenance)
3. ✅ Faire le backup final depuis Hetzner
4. ✅ Restaurer sur Azure/AWS
5. ✅ Vérifier l'intégrité
6. ✅ Mettre à jour `DATABASE_URL` dans l'application
7. ✅ Redémarrer l'application
8. ✅ Tests de validation

### **Phase 4 : Vérification (1 jour)**

1. ✅ Vérifier les métriques de performance
2. ✅ Vérifier les logs d'erreur
3. ✅ Tests utilisateurs
4. ✅ Monitoring 24-48h

---

## ⚠️ Points d'Attention

### **1. Extensions PostgreSQL**

**imgsmlr** peut ne pas être disponible sur Azure/AWS. Solutions :

```sql
-- Option 1 : Désactiver temporairement
-- Option 2 : Utiliser une alternative (pg_trgm, etc.)
-- Option 3 : Installer manuellement (si possible)
```

### **2. Permissions et Rôles**

```bash
# pg_restore avec --no-owner et --no-acl
pg_restore ... --no-owner --no-acl

# Puis recréer les permissions manuellement
```

### **3. Séquenceurs**

Vérifier que les séquenceurs sont correctement restaurés :

```sql
-- Vérifier les séquenceurs
SELECT sequence_name, last_value 
FROM information_schema.sequences 
WHERE sequence_schema = 'public';
```

### **4. Index et Contraintes**

Les index et contraintes sont restaurés automatiquement, mais vérifier :

```sql
-- Vérifier les index
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE schemaname = 'public';

-- Vérifier les contraintes
SELECT conname, contype 
FROM pg_constraint 
WHERE connamespace = 'public'::regnamespace;
```

---

## 🔐 Sécurité

### **1. Chiffrement en Transit**

```bash
# Utiliser SSL pour la migration
pg_dump ... --ssl-mode=require
pg_restore ... --ssl-mode=require
```

### **2. Sauvegarde Sécurisée**

```bash
# Chiffrer le backup
gpg --encrypt --recipient votre@email.com yukpomnang_backup.dump

# Stocker dans un endroit sécurisé
# Supprimer après migration réussie
```

---

## 📝 Checklist de Migration

- [ ] Backup complet depuis Hetzner
- [ ] Instance PostgreSQL créée sur Azure/AWS
- [ ] Extensions vérifiées (pgvector, imgsmlr, etc.)
- [ ] Test de restauration sur instance de test
- [ ] Plan de maintenance communiqué
- [ ] Backup final avant migration
- [ ] Migration exécutée
- [ ] Vérification intégrité des données
- [ ] Mise à jour DATABASE_URL
- [ ] Tests fonctionnels
- [ ] Monitoring activé
- [ ] Documentation mise à jour

---

## 🆘 Dépannage

### **Erreur : Extension non disponible**

```sql
-- Vérifier les extensions disponibles
SELECT * FROM pg_available_extensions WHERE name = 'imgsmlr';

-- Si non disponible, créer une alternative ou désactiver
```

### **Erreur : Permission denied**

```bash
# Utiliser --no-owner et --no-acl
pg_restore ... --no-owner --no-acl

# Puis recréer les permissions
```

### **Erreur : Connection timeout**

```bash
# Augmenter le timeout
export PGCONNECT_TIMEOUT=60

# Ou utiliser une connexion VPN/tunnel
```

---

## 📚 Ressources

- **pg_dump Documentation** : https://www.postgresql.org/docs/current/app-pgdump.html
- **pg_restore Documentation** : https://www.postgresql.org/docs/current/app-pgrestore.html
- **Azure Database Migration** : https://docs.microsoft.com/azure/dms/
- **AWS DMS** : https://docs.aws.amazon.com/dms/

---

## ✅ Conclusion

La migration PostgreSQL de Hetzner vers Azure ou AWS est **totalement faisable** et relativement simple avec `pg_dump`/`pg_restore`. Le format PostgreSQL est standard, donc aucune conversion de données n'est nécessaire.

**Temps estimé** : 1-2 jours pour une migration complète avec tests.

**Recommandation** : Utiliser `pg_dump`/`pg_restore` pour la simplicité, ou Azure DMS/AWS DMS pour l'automatisation.

