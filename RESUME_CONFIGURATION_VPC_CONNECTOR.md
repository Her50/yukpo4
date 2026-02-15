# ✅ Résumé Configuration VPC Connector

**Date**: 2026-02-15  
**Statut**: Configuration complétée avec succès

---

## ✅ Configuration Complétée

### 1. IP Statique Cloud NAT
- **Nom**: `cloud-run-nat-ip`
- **IP**: `104.199.18.176` ✅
- **Statut**: Créée et active

### 2. Routeur Cloud
- **Nom**: `cloud-run-router`
- **Région**: `europe-west1`
- **Réseau**: `default`
- **Statut**: ✅ Créé

### 3. Cloud NAT
- **Nom**: `cloud-run-nat`
- **Routeur**: `cloud-run-router`
- **IP Pool**: `cloud-run-nat-ip`
- **Statut**: ✅ Créé

### 4. Subnet VPC Connector
- **Nom**: `vpc-connector-subnet`
- **Range**: `10.8.0.0/28` (netmask /28 requis)
- **Région**: `europe-west1`
- **Réseau**: `default`
- **Statut**: ✅ Créé

### 5. VPC Connector
- **Nom**: `yukpo-connector`
- **Région**: `europe-west1`
- **Subnet**: `vpc-connector-subnet`
- **Min instances**: 2
- **Max instances**: 3
- **Machine type**: e2-micro
- **Statut**: ✅ Créé (en attente READY)

### 6. Attachement à Cloud Run
- **Service**: `yukpo-backend`
- **Statut**: ⏳ En attente (VPC Connector doit être READY)

---

## 🔧 Commandes Exécutées

```bash
# 1. Ajouter gcloud au PATH
$env:Path += ";C:\Program Files (x86)\Google\Cloud SDK\google-cloud-sdk\bin"

# 2. Activer API Serverless VPC Access
gcloud services enable vpcaccess.googleapis.com --project=yukpo-project

# 3. Créer subnet pour VPC Connector
gcloud compute networks subnets create vpc-connector-subnet \
  --network=default \
  --range=10.8.0.0/28 \
  --region=europe-west1 \
  --project=yukpo-project

# 4. Créer VPC Connector
gcloud compute networks vpc-access connectors create yukpo-connector \
  --region=europe-west1 \
  --subnet=vpc-connector-subnet \
  --subnet-project=yukpo-project \
  --min-instances=2 \
  --max-instances=3 \
  --machine-type=e2-micro \
  --project=yukpo-project
```

---

## ⏳ Prochaine Étape : Attacher à Cloud Run

### Vérifier que le VPC Connector est READY

```bash
gcloud compute networks vpc-access connectors describe yukpo-connector \
  --region=europe-west1 \
  --project=yukpo-project \
  --format="value(state)"
```

**Attendre jusqu'à ce que le statut soit `READY`** (peut prendre 5-10 minutes).

### Attacher le VPC Connector à Cloud Run

Une fois READY :

```bash
gcloud run services update yukpo-backend \
  --region=europe-west1 \
  --vpc-connector=yukpo-connector \
  --vpc-egress=all-traffic \
  --project=yukpo-project
```

---

## 🔐 Action Requise : Autoriser IP NAT dans AWS RDS

**IP NAT à autoriser** : `104.199.18.176`

**Instructions AWS** :
1. AWS Console → RDS → Security Groups
2. Sélectionner le Security Group de votre instance RDS (34.79.29.219)
3. Inbound Rules → Edit inbound rules
4. Add rule :
   - Type: `PostgreSQL`
   - Port: `5432`
   - Source: `104.199.18.176/32`
5. Save rules

---

## 📊 Vérifications Finales

### Vérifier l'Attachement VPC Connector

```bash
gcloud run services describe yukpo-backend \
  --region=europe-west1 \
  --format="get(spec.template.spec.vpcAccess)" \
  --project=yukpo-project
```

**Résultat attendu** :
```
connector: yukpo-connector
egress: all-traffic
```

### Vérifier la Connectivité Base de Données

```bash
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=yukpo-backend AND textPayload=~'PostgreSQL\|database\|DB'" --limit=20 --project=yukpo-project
```

**Logs attendus** :
```
✅ Pool PostgreSQL créé avec succès
✅ Connexion PostgreSQL établie
```

---

## 💰 Coûts Estimés

- **VPC Connector** : ~$0.10/heure × 2 instances (min) = ~$0.20/heure = ~$144/mois
- **Cloud NAT** : ~$0.045/heure + trafic sortant = ~$32/mois + trafic
- **Total estimé** : ~$150-200/mois (selon trafic)

---

**✅ Infrastructure VPC créée avec succès !**

**Prochaines étapes** :
1. Attendre que le VPC Connector soit READY
2. Attacher le VPC Connector à Cloud Run
3. Autoriser l'IP NAT `104.199.18.176` dans AWS RDS Security Group

Une fois ces étapes complétées, la base de données sera accessible depuis Cloud Run !

