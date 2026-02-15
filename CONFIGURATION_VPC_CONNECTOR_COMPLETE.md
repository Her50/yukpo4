# ✅ Configuration VPC Connector Complète

**Date**: 2026-02-15  
**Statut**: Configuration en cours

---

## ✅ Étapes Complétées

### 1. IP Statique Cloud NAT
- **Nom**: `cloud-run-nat-ip`
- **IP**: `104.199.18.176`
- **Statut**: ✅ Créée

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

### 4. Subnet pour VPC Connector
- **Nom**: `vpc-connector-subnet`
- **Range**: `10.8.0.0/28` (netmask /28 requis)
- **Région**: `europe-west1`
- **Réseau**: `default`
- **Statut**: ✅ Créé

### 5. VPC Connector
- **Nom**: `yukpo-connector`
- **Région**: `europe-west1`
- **Subnet**: `vpc-connector-subnet`
- **Statut**: ⏳ En cours de création/préparation

### 6. Attachement à Cloud Run
- **Service**: `yukpo-backend`
- **Statut**: ⏳ En attente (VPC Connector doit être prêt)

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

# 5. Attacher à Cloud Run (à réessayer quand VPC Connector est prêt)
gcloud run services update yukpo-backend \
  --region=europe-west1 \
  --vpc-connector=yukpo-connector \
  --vpc-egress=all-traffic \
  --project=yukpo-project
```

---

## ⏳ Prochaines Étapes

### 1. Vérifier le Statut du VPC Connector

```bash
gcloud compute networks vpc-access connectors describe yukpo-connector \
  --region=europe-west1 \
  --project=yukpo-project \
  --format="value(state)"
```

**Statuts possibles** :
- `CREATING` : En cours de création (attendre)
- `READY` : Prêt à être utilisé
- `UPDATING` : En cours de mise à jour
- `DELETING` : En cours de suppression
- `ERROR` : Erreur (vérifier les logs)

### 2. Attendre que le VPC Connector soit READY

Le VPC Connector peut prendre 5-10 minutes pour être complètement prêt.

```bash
# Vérifier toutes les 30 secondes
while ($true) {
    $state = gcloud compute networks vpc-access connectors describe yukpo-connector --region=europe-west1 --project=yukpo-project --format="value(state)" 2>&1
    Write-Host "VPC Connector state: $state"
    if ($state -eq "READY") {
        Write-Host "VPC Connector is ready!"
        break
    }
    Start-Sleep -Seconds 30
}
```

### 3. Attacher le VPC Connector à Cloud Run

Une fois le VPC Connector READY :

```bash
gcloud run services update yukpo-backend \
  --region=europe-west1 \
  --vpc-connector=yukpo-connector \
  --vpc-egress=all-traffic \
  --project=yukpo-project
```

### 4. Autoriser l'IP NAT dans AWS RDS

**IP NAT**: `104.199.18.176`

**Instructions AWS** :
1. AWS Console → RDS → Security Groups
2. Sélectionner le Security Group de votre instance RDS
3. Inbound Rules → Edit inbound rules
4. Add rule :
   - Type: `PostgreSQL`
   - Port: `5432`
   - Source: `104.199.18.176/32`
5. Save rules

---

## 📋 Vérifications

### Vérifier l'IP NAT

```bash
gcloud compute addresses describe cloud-run-nat-ip \
  --region=europe-west1 \
  --format="value(address)" \
  --project=yukpo-project
```

**Résultat attendu** : `104.199.18.176`

### Vérifier le VPC Connector

```bash
gcloud compute networks vpc-access connectors describe yukpo-connector \
  --region=europe-west1 \
  --project=yukpo-project
```

**Vérifier** :
- `state: READY`
- `network: default`
- `subnet: vpc-connector-subnet`

### Vérifier la Configuration Cloud Run

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

---

## ⚠️ Notes Importantes

1. **Temps de création** : Le VPC Connector peut prendre 5-10 minutes pour être prêt
2. **Coûts** : 
   - VPC Connector : ~$0.10/heure par instance (min 2, max 3)
   - Cloud NAT : ~$0.045/heure + trafic sortant
   - Total estimé : ~$50-100/mois
3. **IP NAT** : Cette IP doit être autorisée dans AWS RDS Security Group
4. **Latence** : Le VPC Connector ajoute une petite latence (~10-50ms)

---

## 🔧 Dépannage

### Si le VPC Connector reste en CREATING

1. **Vérifier les quotas** :
   ```bash
   gcloud compute project-info describe --project=yukpo-project --format="get(quotas)"
   ```

2. **Vérifier les logs** :
   ```bash
   gcloud logging read "resource.type=vpc_access_connector AND resource.labels.connector_id=yukpo-connector" --limit=50 --project=yukpo-project
   ```

3. **Supprimer et recréer** (si nécessaire) :
   ```bash
   gcloud compute networks vpc-access connectors delete yukpo-connector --region=europe-west1 --project=yukpo-project
   # Attendre quelques minutes
   # Puis recréer
   ```

### Si l'attachement à Cloud Run échoue

1. **Vérifier que le VPC Connector est READY** :
   ```bash
   gcloud compute networks vpc-access connectors describe yukpo-connector --region=europe-west1 --project=yukpo-project --format="value(state)"
   ```

2. **Attendre 5-10 minutes** après que le VPC Connector soit READY

3. **Réessayer l'attachement** :
   ```bash
   gcloud run services update yukpo-backend --region=europe-west1 --vpc-connector=yukpo-connector --vpc-egress=all-traffic --project=yukpo-project
   ```

---

**✅ Configuration presque complète ! Il reste à attendre que le VPC Connector soit READY puis l'attacher à Cloud Run.**

