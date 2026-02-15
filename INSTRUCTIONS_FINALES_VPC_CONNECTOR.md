# 📋 Instructions Finales VPC Connector

**Date**: 2026-02-15  
**IP NAT**: `104.199.18.176`  
**Statut**: Configuration en cours

---

## ✅ Configuration Complétée

### Ressources Créées

1. **IP Statique Cloud NAT** : `104.199.18.176` ✅
2. **Routeur Cloud** : `cloud-run-router` ✅
3. **Cloud NAT** : `cloud-run-nat` ✅
4. **Subnet VPC Connector** : `vpc-connector-subnet` (10.8.0.0/28) ✅
5. **VPC Connector** : `yukpo-connector` ⏳ (en cours de création)

---

## ⏳ Actions en Attente

### 1. Attendre que le VPC Connector soit READY

Le VPC Connector peut prendre **5-10 minutes** pour être complètement prêt.

**Vérifier le statut** :
```bash
gcloud compute networks vpc-access connectors describe yukpo-connector \
  --region=europe-west1 \
  --project=yukpo-project \
  --format="value(state)"
```

**Attendre jusqu'à ce que le statut soit `READY`**.

### 2. Attacher le VPC Connector à Cloud Run

Une fois le VPC Connector READY :

```bash
gcloud run services update yukpo-backend \
  --region=europe-west1 \
  --vpc-connector=yukpo-connector \
  --vpc-egress=all-traffic \
  --project=yukpo-project
```

### 3. Autoriser l'IP NAT dans AWS RDS Security Group

**IP NAT à autoriser** : `104.199.18.176`

**Instructions AWS** :
1. Aller sur **AWS Console** → **RDS** → **Security Groups**
2. Sélectionner le **Security Group** de votre instance RDS (34.79.29.219)
3. **Inbound Rules** → **Edit inbound rules**
4. **Add rule** :
   - **Type**: `PostgreSQL`
   - **Port**: `5432`
   - **Source**: `104.199.18.176/32`
5. **Save rules**

---

## 🔍 Vérifications

### Vérifier le Statut du VPC Connector

```bash
gcloud compute networks vpc-access connectors describe yukpo-connector \
  --region=europe-west1 \
  --project=yukpo-project
```

**Vérifier** :
- `state: READY` (doit être READY avant attachement)
- `network: default`
- `subnet: vpc-connector-subnet`

### Vérifier l'Attachement à Cloud Run

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

Après avoir autorisé l'IP NAT dans AWS RDS :

```bash
# Vérifier les logs Cloud Run
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=yukpo-backend AND textPayload=~'PostgreSQL\|database\|DB'" --limit=20 --project=yukpo-project
```

**Logs attendus** :
```
✅ Pool PostgreSQL créé avec succès
✅ Connexion PostgreSQL établie
```

---

## 🔧 Script de Vérification Automatique

Créer un script pour vérifier automatiquement :

```powershell
# Vérifier le statut du VPC Connector
$state = gcloud compute networks vpc-access connectors describe yukpo-connector --region=europe-west1 --project=yukpo-project --format="value(state)" 2>&1

if ($state -eq "READY") {
    Write-Host "[OK] VPC Connector est READY" -ForegroundColor Green
    
    # Attacher à Cloud Run
    Write-Host "Attachement du VPC Connector à Cloud Run..." -ForegroundColor Yellow
    gcloud run services update yukpo-backend --region=europe-west1 --vpc-connector=yukpo-connector --vpc-egress=all-traffic --project=yukpo-project
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[OK] VPC Connector attaché avec succès!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Prochaine étape: Autoriser l'IP NAT 104.199.18.176 dans AWS RDS Security Group" -ForegroundColor Yellow
    }
} else {
    Write-Host "[ATTENTE] VPC Connector state: $state" -ForegroundColor Yellow
    Write-Host "Attendre que le statut soit READY (peut prendre 5-10 minutes)" -ForegroundColor Yellow
}
```

---

## 📊 Résumé

- ✅ **IP NAT créée** : `104.199.18.176`
- ✅ **Infrastructure Cloud NAT** : Routeur + NAT créés
- ✅ **Subnet VPC Connector** : `vpc-connector-subnet` (10.8.0.0/28)
- ⏳ **VPC Connector** : En cours de création (attendre READY)
- ⏳ **Attachement Cloud Run** : À faire quand VPC Connector READY
- ⏳ **Autorisation AWS RDS** : À faire avec IP `104.199.18.176`

---

**⚠️ IMPORTANT** : 
1. Attendre que le VPC Connector soit `READY` (5-10 minutes)
2. Attacher le VPC Connector à Cloud Run
3. Autoriser l'IP NAT `104.199.18.176` dans AWS RDS Security Group

Une fois ces étapes complétées, la base de données sera accessible depuis Cloud Run !

