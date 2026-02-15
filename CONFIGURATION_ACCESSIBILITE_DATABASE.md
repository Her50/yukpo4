# 🔧 Configuration Accessibilité Base de Données

**Date**: 2026-02-15  
**Problème**: Base de données PostgreSQL (34.79.29.219:5432) non accessible depuis Cloud Run

---

## 🔍 Diagnostic

### Informations Base de Données

- **Adresse IP**: `34.79.29.219`
- **Port**: `5432`
- **Type**: PostgreSQL
- **Localisation**: Probablement AWS RDS (IP publique)

### Problème Identifié

Les logs Cloud Run montrent :
```
34.79.29.219:5432 - no response
❌ ERREUR: Impossible de se connecter à la base de données après 30 tentatives
```

**Cause** : La base de données n'est pas accessible depuis Cloud Run car :
1. Firewall/Security Group bloque les connexions depuis Cloud Run
2. IP whitelist ne contient pas les IPs Cloud Run
3. VPC non connecté (si DB est dans un VPC privé)

---

## ✅ Solutions selon le Type de Base de Données

### Option 1: Base de Données AWS RDS (IP Publique)

Si la base de données est sur AWS RDS avec IP publique :

#### 1.1. Autoriser IPs Cloud Run dans Security Group

**Problème** : Cloud Run utilise des IPs dynamiques, impossible de whitelister toutes les IPs.

**Solutions** :

**A. Utiliser un NAT Gateway avec IP Fixe (Recommandé)**

1. **Créer un Cloud NAT avec IP statique** :
```bash
# Créer une IP statique
gcloud compute addresses create cloud-run-nat-ip \
  --region=europe-west1 \
  --project=yukpo-project

# Créer un routeur Cloud
gcloud compute routers create cloud-run-router \
  --region=europe-west1 \
  --network=default \
  --project=yukpo-project

# Créer le NAT
gcloud compute routers nats create cloud-run-nat \
  --router=cloud-run-router \
  --region=europe-west1 \
  --nat-external-ip-pool=cloud-run-nat-ip \
  --nat-all-subnet-ip-ranges \
  --project=yukpo-project
```

2. **Créer un VPC Connector pour Cloud Run** :
```bash
# Créer un VPC connector
gcloud compute networks vpc-access connectors create yukpo-connector \
  --region=europe-west1 \
  --subnet=default \
  --subnet-project=yukpo-project \
  --min-instances=2 \
  --max-instances=3 \
  --machine-type=e2-micro \
  --project=yukpo-project
```

3. **Attacher le VPC Connector à Cloud Run** :
```bash
gcloud run services update yukpo-backend \
  --region=europe-west1 \
  --vpc-connector=yukpo-connector \
  --vpc-egress=all-traffic \
  --project=yukpo-project
```

4. **Récupérer l'IP du NAT** :
```bash
NAT_IP=$(gcloud compute addresses describe cloud-run-nat-ip \
  --region=europe-west1 \
  --format="value(address)" \
  --project=yukpo-project)

echo "IP NAT: $NAT_IP"
```

5. **Autoriser cette IP dans AWS RDS Security Group** :
   - Aller dans AWS Console → RDS → Security Groups
   - Ajouter une règle entrante :
     - Type: PostgreSQL
     - Port: 5432
     - Source: `$NAT_IP/32`

**B. Utiliser Cloud SQL Proxy (Si migration vers Cloud SQL)**

Si vous pouvez migrer vers Cloud SQL :
```bash
gcloud run services update yukpo-backend \
  --region=europe-west1 \
  --add-cloudsql-instances=PROJECT_ID:REGION:INSTANCE_NAME \
  --update-env-vars="CLOUD_SQL_CONNECTION_NAME=PROJECT_ID:REGION:INSTANCE_NAME"
```

#### 1.2. Autoriser Toutes les IPs GCP (Non Sécurisé - Temporaire)

⚠️ **ATTENTION** : Cette solution n'est pas sécurisée, à utiliser uniquement pour tester.

Dans AWS RDS Security Group :
- Type: PostgreSQL
- Port: 5432
- Source: `0.0.0.0/0` (toutes les IPs)

---

### Option 2: Base de Données GCP Cloud SQL

Si la base de données est sur Cloud SQL :

#### 2.1. Utiliser Cloud SQL Proxy (Recommandé)

```bash
# Ajouter l'instance Cloud SQL au service Cloud Run
gcloud run services update yukpo-backend \
  --region=europe-west1 \
  --add-cloudsql-instances=yukpo-project:europe-west1:yukpo-db \
  --update-env-vars="CLOUD_SQL_CONNECTION_NAME=yukpo-project:europe-west1:yukpo-db" \
  --project=yukpo-project
```

#### 2.2. Autoriser IPs Cloud Run (Alternative)

Si vous utilisez une IP publique :
```bash
# Récupérer les IPs Cloud Run (dynamiques)
# Cloud Run utilise des IPs dans les plages GCP
# Autoriser les plages IP GCP dans Cloud SQL

# Autoriser toutes les IPs GCP (temporaire pour test)
gcloud sql instances patch yukpo-db \
  --authorized-networks=0.0.0.0/0 \
  --project=yukpo-project
```

---

### Option 3: Base de Données dans VPC Privé

Si la base de données est dans un VPC privé :

#### 3.1. Utiliser VPC Connector

```bash
# Créer un VPC connector
gcloud compute networks vpc-access connectors create yukpo-connector \
  --region=europe-west1 \
  --subnet=VPC_SUBNET \
  --subnet-project=yukpo-project \
  --min-instances=2 \
  --max-instances=3 \
  --machine-type=e2-micro \
  --project=yukpo-project

# Attacher au service Cloud Run
gcloud run services update yukpo-backend \
  --region=europe-west1 \
  --vpc-connector=yukpo-connector \
  --vpc-egress=all-traffic \
  --project=yukpo-project
```

---

## 🚀 Solution Recommandée pour AWS RDS

### Étape 1: Créer Cloud NAT avec IP Statique

```bash
# 1. Créer IP statique
gcloud compute addresses create cloud-run-nat-ip \
  --region=europe-west1 \
  --project=yukpo-project

# 2. Créer routeur
gcloud compute routers create cloud-run-router \
  --region=europe-west1 \
  --network=default \
  --project=yukpo-project

# 3. Créer NAT
gcloud compute routers nats create cloud-run-nat \
  --router=cloud-run-router \
  --region=europe-west1 \
  --nat-external-ip-pool=cloud-run-nat-ip \
  --nat-all-subnet-ip-ranges \
  --project=yukpo-project

# 4. Récupérer l'IP
NAT_IP=$(gcloud compute addresses describe cloud-run-nat-ip \
  --region=europe-west1 \
  --format="value(address)" \
  --project=yukpo-project)

echo "✅ IP NAT: $NAT_IP"
```

### Étape 2: Créer VPC Connector

```bash
# Créer VPC connector
gcloud compute networks vpc-access connectors create yukpo-connector \
  --region=europe-west1 \
  --subnet=default \
  --subnet-project=yukpo-project \
  --min-instances=2 \
  --max-instances=3 \
  --machine-type=e2-micro \
  --project=yukpo-project
```

### Étape 3: Attacher VPC Connector à Cloud Run

```bash
gcloud run services update yukpo-backend \
  --region=europe-west1 \
  --vpc-connector=yukpo-connector \
  --vpc-egress=all-traffic \
  --project=yukpo-project
```

### Étape 4: Autoriser IP NAT dans AWS RDS

1. Aller dans **AWS Console** → **RDS** → **Security Groups**
2. Sélectionner le Security Group de votre instance RDS
3. **Inbound Rules** → **Edit inbound rules**
4. **Add rule** :
   - Type: `PostgreSQL`
   - Port: `5432`
   - Source: `$NAT_IP/32` (remplacer `$NAT_IP` par l'IP récupérée)
5. **Save rules**

### Étape 5: Vérifier la Connectivité

```bash
# Tester la connexion depuis Cloud Run
gcloud run services update yukpo-backend \
  --region=europe-west1 \
  --update-env-vars="DB_TEST=true" \
  --project=yukpo-project

# Vérifier les logs
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=yukpo-backend" --limit=20 --format=json
```

---

## 📋 Checklist de Configuration

- [ ] **Identifier le type de base de données** (AWS RDS, Cloud SQL, autre)
- [ ] **Créer Cloud NAT avec IP statique** (si AWS RDS)
- [ ] **Créer VPC Connector** (si nécessaire)
- [ ] **Attacher VPC Connector à Cloud Run**
- [ ] **Autoriser IP NAT dans Security Group/Firewall**
- [ ] **Vérifier la connectivité** (logs Cloud Run)
- [ ] **Tester une requête** (endpoint /health)

---

## 🔍 Vérification

### Vérifier l'IP NAT

```bash
gcloud compute addresses describe cloud-run-nat-ip \
  --region=europe-west1 \
  --format="value(address)" \
  --project=yukpo-project
```

### Vérifier le VPC Connector

```bash
gcloud compute networks vpc-access connectors describe yukpo-connector \
  --region=europe-west1 \
  --project=yukpo-project
```

### Vérifier la Configuration Cloud Run

```bash
gcloud run services describe yukpo-backend \
  --region=europe-west1 \
  --format="get(spec.template.spec.containers[0].env,spec.template.spec.vpcAccess)" \
  --project=yukpo-project
```

### Vérifier les Logs

```bash
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=yukpo-backend AND textPayload=~'PostgreSQL\|database\|DB'" --limit=50 --format=json
```

---

## ⚠️ Notes Importantes

1. **Coûts** :
   - Cloud NAT : ~$0.045/heure + trafic sortant
   - VPC Connector : ~$0.10/heure par instance
   - Total estimé : ~$50-100/mois

2. **Sécurité** :
   - Utiliser une IP statique permet de whitelister uniquement cette IP
   - Ne pas autoriser `0.0.0.0/0` en production
   - Utiliser SSL/TLS pour toutes les connexions

3. **Performance** :
   - VPC Connector ajoute une petite latence (~10-50ms)
   - Cloud NAT peut avoir un impact sur le débit

4. **Alternative** :
   - Migrer vers Cloud SQL pour une meilleure intégration
   - Utiliser Private Service Connect si disponible

---

## 🆘 Dépannage

### Si la connexion échoue toujours

1. **Vérifier les logs Cloud Run** :
   ```bash
   gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=yukpo-backend" --limit=100
   ```

2. **Vérifier le Security Group AWS** :
   - Confirmer que l'IP NAT est autorisée
   - Vérifier que le port 5432 est ouvert

3. **Tester depuis un conteneur Cloud Run** :
   ```bash
   # Créer un test de connexion
   gcloud run jobs create test-db-connection \
     --image=postgres:15 \
     --command=psql \
     --args="-h,34.79.29.219,-p,5432,-U,user,-d,database" \
     --vpc-connector=yukpo-connector \
     --region=europe-west1
   ```

4. **Vérifier les routes réseau** :
   ```bash
   gcloud compute routes list --filter="network=default"
   ```

---

**✅ Une fois configuré, la base de données sera accessible depuis Cloud Run via l'IP statique du NAT.**

