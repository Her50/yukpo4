# 🔧 Solution Erreur VPC Connector

**Date**: 2026-02-15  
**Erreur**: `Failed to prepare VPC connector. Please try again later`

---

## 🔍 Diagnostic

### Erreur Identifiée

```
ERROR: (gcloud.run.deploy) Failed to prepare VPC connector. Please try again later
```

**Cause** : Le VPC Connector `yukpo-connector` n'est pas dans un état prêt ou a un problème.

---

## ✅ Solutions

### Solution 1: Vérifier l'État du VPC Connector

```bash
gcloud compute networks vpc-access connectors describe yukpo-connector \
  --region=europe-west1 \
  --project=yukpo-project
```

**États possibles** :
- `READY` : ✅ Prêt à l'emploi
- `CREATING` : ⏳ En cours de création (attendre)
- `FAILED` : ❌ Échec (recréer)
- `DELETING` : ⏳ En cours de suppression

### Solution 2: Attendre que le VPC Connector soit Prêt

Si le VPC Connector est en état `CREATING`, attendre quelques minutes :

```bash
# Vérifier l'état toutes les 30 secondes
while true; do
  STATE=$(gcloud compute networks vpc-access connectors describe yukpo-connector \
    --region=europe-west1 \
    --format="value(state)" \
    --project=yukpo-project)
  echo "État VPC Connector: $STATE"
  if [ "$STATE" = "READY" ]; then
    echo "✅ VPC Connector prêt!"
    break
  fi
  sleep 30
done
```

### Solution 3: Recréer le VPC Connector

Si le VPC Connector est en état `FAILED` ou ne répond pas :

```bash
# Supprimer l'ancien VPC Connector
gcloud compute networks vpc-access connectors delete yukpo-connector \
  --region=europe-west1 \
  --project=yukpo-project

# Attendre la suppression complète (peut prendre quelques minutes)
sleep 60

# Recréer le VPC Connector
gcloud compute networks vpc-access connectors create yukpo-connector \
  --region=europe-west1 \
  --subnet=default \
  --subnet-project=yukpo-project \
  --min-instances=2 \
  --max-instances=3 \
  --machine-type=e2-micro \
  --project=yukpo-project

# Attendre que le VPC Connector soit prêt (READY)
# Peut prendre 5-10 minutes
```

### Solution 4: Déployer sans VPC Connector (Temporaire)

Si le VPC Connector pose problème, déployer temporairement sans VPC Connector :

```bash
gcloud run services update yukpo-backend \
  --region=europe-west1 \
  --clear-vpc-connector \
  --project=yukpo-project
```

**⚠️ ATTENTION** : Sans VPC Connector, la base de données AWS RDS ne sera pas accessible. Cette solution est temporaire pour permettre le déploiement, mais il faudra réattacher le VPC Connector ensuite.

---

## 🔧 Script de Diagnostic et Correction

Créer un script pour diagnostiquer et corriger automatiquement :

```powershell
# Vérifier l'état du VPC Connector
$gcloudPath = "C:\Program Files (x86)\Google\Cloud SDK\google-cloud-sdk\bin"
$env:Path += ";$gcloudPath"

Write-Host "Verification de l'etat du VPC Connector..." -ForegroundColor Yellow

$connectorState = gcloud compute networks vpc-access connectors describe yukpo-connector `
  --region=europe-west1 `
  --format="value(state)" `
  --project=yukpo-project 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "Etat actuel: $connectorState" -ForegroundColor Cyan
    
    if ($connectorState -eq "READY") {
        Write-Host "[OK] VPC Connector est pret" -ForegroundColor Green
    } elseif ($connectorState -eq "CREATING") {
        Write-Host "[ATTENTE] VPC Connector en cours de creation..." -ForegroundColor Yellow
        Write-Host "   Attendez 5-10 minutes puis reessayez le deploiement" -ForegroundColor Yellow
    } elseif ($connectorState -eq "FAILED") {
        Write-Host "[ERREUR] VPC Connector en echec - Recreez-le" -ForegroundColor Red
    } else {
        Write-Host "[INFO] Etat: $connectorState" -ForegroundColor Cyan
    }
} else {
    Write-Host "[ERREUR] Impossible de recuperer l'etat du VPC Connector" -ForegroundColor Red
    Write-Host "   Le VPC Connector n'existe peut-etre pas" -ForegroundColor Yellow
}
```

---

## 📋 Checklist de Vérification

- [ ] **État du VPC Connector** : Vérifier avec `gcloud compute networks vpc-access connectors describe`
- [ ] **État = READY** : Le VPC Connector doit être prêt avant déploiement
- [ ] **Permissions** : Vérifier que le service account a les permissions nécessaires
- [ ] **Subnet** : Vérifier que la subnet `default` existe et est accessible
- [ ] **Quotas** : Vérifier les quotas VPC Access Connector dans GCP

---

## 🚀 Solution Recommandée

### Étape 1: Vérifier l'État

```bash
gcloud compute networks vpc-access connectors describe yukpo-connector \
  --region=europe-west1 \
  --format="value(state)" \
  --project=yukpo-project
```

### Étape 2: Selon l'État

**Si `CREATING`** :
- Attendre 5-10 minutes
- Réessayer le déploiement

**Si `FAILED`** :
- Supprimer et recréer le VPC Connector
- Attendre qu'il soit `READY`

**Si `READY`** :
- Le problème peut venir d'un autre facteur
- Vérifier les permissions et quotas

### Étape 3: Déployer à Nouveau

Une fois le VPC Connector prêt :

```bash
gcloud run deploy yukpo-backend \
  --image gcr.io/yukpo-project/yukpo-backend:latest \
  --region=europe-west1 \
  --project=yukpo-project
```

---

## ⚠️ Notes Importantes

1. **Temps de création** : Un VPC Connector peut prendre 5-10 minutes pour être prêt
2. **Quotas** : Vérifier les quotas VPC Access Connector dans GCP Console
3. **Permissions** : Le service account doit avoir les permissions VPC Access Connector
4. **Subnet** : La subnet `default` doit exister et être accessible

---

**✅ Une fois le VPC Connector prêt (état READY), le déploiement devrait réussir !**


