# 📊 Guide d'Accès aux Logs Cloud SQL

**Date** : 2026-02-16  
**Instance** : `yukpo-postgres`  
**Project** : `yukpo-project`

---

## 🌐 Méthode 1 : Console Google Cloud (Interface Web)

### 1.1 Logs Cloud SQL Directement

**Lien direct** :
👉 https://console.cloud.google.com/sql/instances/yukpo-postgres/logs?project=yukpo-project

**Navigation manuelle** :
1. Aller sur : https://console.cloud.google.com
2. Sélectionner le projet : `yukpo-project`
3. Menu : **SQL** → **Instances**
4. Cliquer sur l'instance : `yukpo-postgres`
5. Onglet : **Logs**

### 1.2 Logs via Cloud Logging (Tous les Logs)

**Lien direct** :
👉 https://console.cloud.google.com/logs/query?project=yukpo-project

**Filtres recommandés** :
- **Ressource** : `Cloud SQL Database`
- **Instance** : `yukpo-postgres`
- **Database** : `yukpo_db`

### 1.3 Requête LQL (Log Query Language) pour Cloud SQL

Dans l'interface Cloud Logging, utiliser cette requête :

```
resource.type="cloudsql_database"
resource.labels.database_id="yukpo-project:yukpo-postgres"
```

**Pour filtrer les erreurs d'authentification** :
```
resource.type="cloudsql_database"
resource.labels.database_id="yukpo-project:yukpo-postgres"
(textPayload=~"authentication" OR textPayload=~"password" OR textPayload=~"28P01")
```

**Pour filtrer les erreurs récentes** :
```
resource.type="cloudsql_database"
resource.labels.database_id="yukpo-project:yukpo-postgres"
severity>=ERROR
timestamp>="2026-02-16T00:00:00Z"
```

---

## 💻 Méthode 2 : gcloud CLI

### 2.1 Lister les Opérations Cloud SQL

```bash
gcloud sql operations list \
  --instance=yukpo-postgres \
  --project=yukpo-project \
  --limit=100
```

### 2.2 Logs via Cloud Logging

**Tous les logs Cloud SQL** :
```bash
gcloud logging read \
  "resource.type=cloudsql_database AND resource.labels.database_id=yukpo-project:yukpo-postgres" \
  --limit=50 \
  --format="table(timestamp,severity,textPayload)" \
  --project=yukpo-project
```

**Erreurs d'authentification** :
```bash
gcloud logging read \
  "resource.type=cloudsql_database AND resource.labels.database_id=yukpo-project:yukpo-postgres AND (textPayload=~\"authentication\" OR textPayload=~\"password\" OR textPayload=~\"28P01\")" \
  --limit=50 \
  --format="table(timestamp,severity,textPayload)" \
  --project=yukpo-project \
  --freshness=1h
```

**Erreurs récentes uniquement** :
```bash
gcloud logging read \
  "resource.type=cloudsql_database AND resource.labels.database_id=yukpo-project:yukpo-postgres AND severity>=ERROR" \
  --limit=50 \
  --format="table(timestamp,severity,textPayload)" \
  --project=yukpo-project \
  --freshness=1h
```

### 2.3 Logs en Temps Réel (Streaming)

```bash
gcloud logging tail \
  "resource.type=cloudsql_database AND resource.labels.database_id=yukpo-project:yukpo-postgres" \
  --project=yukpo-project
```

---

## 🔍 Codes d'Erreur PostgreSQL Courants

### Erreur d'Authentification

**Code** : `28P01`  
**Message** : `password authentication failed for user "yukpo_user"`

**Requête pour filtrer** :
```
resource.type="cloudsql_database"
textPayload=~"28P01"
textPayload=~"password authentication failed"
```

### Autres Erreurs Courantes

- **28P01** : Authentication failed
- **3D000** : Database does not exist
- **42P01** : Relation does not exist
- **23505** : Unique violation
- **23503** : Foreign key violation

---

## 📋 Requêtes Utiles

### Logs d'Authentification (Dernière Heure)

```bash
gcloud logging read \
  "resource.type=cloudsql_database AND resource.labels.database_id=yukpo-project:yukpo-postgres AND (textPayload=~\"28P01\" OR textPayload=~\"authentication failed\")" \
  --limit=100 \
  --format="table(timestamp,severity,textPayload)" \
  --project=yukpo-project \
  --freshness=1h
```

### Logs de Connexion (Dernière Heure)

```bash
gcloud logging read \
  "resource.type=cloudsql_database AND resource.labels.database_id=yukpo-project:yukpo-postgres AND (textPayload=~\"connection\" OR textPayload=~\"connected\" OR textPayload=~\"disconnected\")" \
  --limit=100 \
  --format="table(timestamp,severity,textPayload)" \
  --project=yukpo-project \
  --freshness=1h
```

### Toutes les Erreurs (Dernière Heure)

```bash
gcloud logging read \
  "resource.type=cloudsql_database AND resource.labels.database_id=yukpo-project:yukpo-postgres AND severity>=ERROR" \
  --limit=100 \
  --format="table(timestamp,severity,textPayload)" \
  --project=yukpo-project \
  --freshness=1h
```

---

## 🔗 Liens Utiles

- **Console Cloud SQL** : https://console.cloud.google.com/sql/instances/yukpo-postgres?project=yukpo-project
- **Logs Cloud SQL** : https://console.cloud.google.com/sql/instances/yukpo-postgres/logs?project=yukpo-project
- **Cloud Logging** : https://console.cloud.google.com/logs/query?project=yukpo-project
- **Documentation Cloud SQL Logs** : https://cloud.google.com/sql/docs/postgres/view-logs

---

## 💡 Astuces

1. **Filtrer par timestamp** : Utiliser `--freshness=1h` pour les logs de la dernière heure
2. **Format de sortie** : Utiliser `--format="table(...)"` pour un affichage lisible
3. **Limiter les résultats** : Utiliser `--limit=50` pour éviter trop de résultats
4. **Exporter les logs** : Ajouter `> logs.txt` à la fin de la commande pour sauvegarder

---

## 🚨 Dépannage

### Si les logs n'apparaissent pas

1. Vérifier que les logs sont activés pour Cloud SQL
2. Vérifier les permissions IAM (nécessite `roles/logging.viewer`)
3. Vérifier que l'instance Cloud SQL existe et est active
4. Attendre quelques minutes (les logs peuvent avoir un délai)

### Si l'accès est refusé

1. Vérifier les permissions IAM :
   ```bash
   gcloud projects get-iam-policy yukpo-project
   ```
2. Demander les permissions nécessaires :
   - `roles/logging.viewer` : Pour voir les logs
   - `roles/cloudsql.viewer` : Pour voir l'instance Cloud SQL


