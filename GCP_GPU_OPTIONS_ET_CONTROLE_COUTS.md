# 🎮 GPU dans GCP - Options et Contrôle des Coûts

**Date** : 2026-02-14  
**Objectif** : Activer le GPU dans GCP sans risque de coûts non contrôlés

---

## 📊 Options GPU dans GCP

### ❌ **Cloud Run : Pas de Support GPU**

**Cloud Run ne supporte pas les GPU** actuellement. Les options disponibles sont :

1. **Compute Engine** (VM avec GPU)
2. **Vertex AI** (ML/AI avec GPU)
3. **Cloud Functions** (pas de GPU)
4. **GKE (Google Kubernetes Engine)** avec nodes GPU

---

## ✅ Solution Recommandée : Compute Engine avec GPU

### 1. **Créer une VM avec GPU**

#### Via Console GCP

1. **Compute Engine** → **VM instances** → **CREATE INSTANCE**
2. **Machine configuration** :
   - **Machine family** : `N1` ou `N2` (support GPU)
   - **Machine type** : `n1-standard-4` ou plus
   - **GPUs** : 
     - **GPU type** : `NVIDIA T4` (recommandé pour coûts) ou `NVIDIA A100` (performance)
     - **Number of GPUs** : `1` (commencer avec 1)
   - **Region** : `europe-west1` (même région que Cloud Run)
   - **Zone** : `europe-west1-b` (zones avec GPU disponibles)

3. **Boot disk** : 
   - **OS** : `Ubuntu 22.04 LTS` ou `Debian 11`
   - **Size** : `50 GB` (minimum)

4. **Firewall** : Autoriser HTTP/HTTPS si nécessaire

#### Via gcloud CLI

```bash
gcloud compute instances create yukpo-gpu-worker \
  --zone=europe-west1-b \
  --machine-type=n1-standard-4 \
  --accelerator=type=nvidia-t4,count=1 \
  --image-family=ubuntu-2204-lts \
  --image-project=ubuntu-os-cloud \
  --boot-disk-size=50GB \
  --maintenance-policy=TERMINATE \
  --service-account=yukpo-compute@yukpo-project.iam.gserviceaccount.com \
  --scopes=https://www.googleapis.com/auth/cloud-platform
```

---

## 💰 Contrôle des Coûts - Protection Maximale

### 1. **Budgets et Alertes GCP**

#### Créer un Budget

1. **Navigation** → **Billing** → **Budgets & alerts**
2. **CREATE BUDGET**
3. **Budget details** :
   - **Budget name** : `GPU-Worker-Monthly`
   - **Budget amount** : `$100` (exemple - ajuster selon besoins)
   - **Budget scope** : `Project: yukpo-project`
   - **Time period** : `Monthly`

4. **Set alert threshold** :
   - **Alert 1** : `50%` du budget
   - **Alert 2** : `90%` du budget
   - **Alert 3** : `100%` du budget

5. **Actions** :
   - **Email notifications** : Votre email
   - **Pub/Sub topic** : Créer un topic pour automatisation

#### Via gcloud CLI

```bash
# Créer un budget avec alertes
gcloud billing budgets create \
  --billing-account=BILLING_ACCOUNT_ID \
  --display-name="GPU Worker Monthly Budget" \
  --budget-amount=100USD \
  --threshold-rule=percent=50 \
  --threshold-rule=percent=90 \
  --threshold-rule=percent=100 \
  --projects=yukpo-project
```

---

### 2. **Quotas GPU**

#### Vérifier les Quotas GPU

1. **IAM & Admin** → **Quotas**
2. **Filter** : `GPU` ou `NVIDIA`
3. **Vérifier** :
   - `NVIDIA T4 GPUs` : Quota actuel
   - `NVIDIA A100 GPUs` : Quota actuel

#### Demander une Augmentation de Quota (si nécessaire)

1. **IAM & Admin** → **Quotas**
2. Sélectionner le quota GPU
3. **EDIT QUOTAS**
4. **New limit** : `1` (commencer petit)
5. **Justification** : Expliquer l'usage

**⚠️ Important** : Les quotas limitent le nombre de GPU, pas les coûts. Utiliser les budgets pour contrôler les coûts.

---

### 3. **Arrêt Automatique de la VM**

#### Script d'Arrêt Automatique

Créer un script qui arrête la VM après inactivité :

```bash
#!/bin/bash
# Script d'arrêt automatique après inactivité GPU

# Vérifier l'utilisation GPU
GPU_USAGE=$(nvidia-smi --query-gpu=utilization.gpu --format=csv,noheader,nounits | head -1)

# Si utilisation < 5% pendant 30 minutes, arrêter la VM
if [ "$GPU_USAGE" -lt 5 ]; then
    echo "GPU inactif, arrêt de la VM dans 30 minutes..."
    # Créer un cron job ou utiliser Cloud Scheduler
    gcloud compute instances stop yukpo-gpu-worker --zone=europe-west1-b
fi
```

#### Cloud Scheduler pour Arrêt Automatique

```bash
# Créer un job Cloud Scheduler qui arrête la VM chaque jour à 22h
gcloud scheduler jobs create http stop-gpu-worker \
  --schedule="0 22 * * *" \
  --uri="https://compute.googleapis.com/compute/v1/projects/yukpo-project/zones/europe-west1-b/instances/yukpo-gpu-worker/stop" \
  --http-method=POST \
  --oauth-service-account-email=yukpo-compute@yukpo-project.iam.gserviceaccount.com
```

---

### 4. **Preemptible VMs avec GPU (Économique)**

**⚠️ Attention** : Les Preemptible VMs peuvent être arrêtées à tout moment par GCP (jusqu'à 24h de runtime).

#### Avantages
- **Coût réduit** : ~70% moins cher que les VMs normales
- **Idéal pour** : Traitement batch, jobs non critiques

#### Inconvénients
- **Interruption possible** : GCP peut arrêter la VM avec 30s de préavis
- **Pas de garantie** : Pas disponible si pas de capacité GPU

#### Créer une Preemptible VM avec GPU

```bash
gcloud compute instances create yukpo-gpu-worker-preemptible \
  --zone=europe-west1-b \
  --machine-type=n1-standard-4 \
  --accelerator=type=nvidia-t4,count=1 \
  --preemptible \
  --image-family=ubuntu-2204-lts \
  --image-project=ubuntu-os-cloud \
  --boot-disk-size=50GB
```

---

### 5. **Monitoring et Alertes**

#### Cloud Monitoring pour GPU

1. **Monitoring** → **Dashboards** → **CREATE DASHBOARD**
2. **Add widget** :
   - **Metric** : `compute.googleapis.com/instance/gpu/utilization`
   - **Resource** : `yukpo-gpu-worker`
   - **Alert** : Si utilisation < 5% pendant 1h → Alerte

#### Créer une Alerte

```bash
# Créer une politique d'alerte pour coûts GPU
gcloud alpha monitoring policies create \
  --notification-channels=CHANNEL_ID \
  --display-name="GPU Cost Alert" \
  --condition-display-name="GPU cost > $50/month" \
  --condition-threshold-value=50 \
  --condition-threshold-duration=300s
```

---

## 🎯 Recommandations pour Yukpomnang

### Option 1 : VM GPU Dédiée (Recommandé pour Développement)

**Configuration** :
- **Type** : `n1-standard-4` avec `NVIDIA T4`
- **Coût estimé** : ~$0.35/heure (~$250/mois si 24/7)
- **Arrêt automatique** : Cloud Scheduler à 22h
- **Budget** : $100/mois avec alertes à 50%, 90%, 100%

**Avantages** :
- ✅ Contrôle total
- ✅ Disponible 24/7 (si nécessaire)
- ✅ Facile à configurer

**Inconvénients** :
- ⚠️ Coût si laissé allumé 24/7
- ⚠️ Nécessite gestion manuelle ou scripts

---

### Option 2 : Preemptible VM GPU (Économique)

**Configuration** :
- **Type** : `n1-standard-4` avec `NVIDIA T4` (Preemptible)
- **Coût estimé** : ~$0.10/heure (~$70/mois si 24/7)
- **Arrêt automatique** : Cloud Scheduler + script d'inactivité

**Avantages** :
- ✅ 70% moins cher
- ✅ Idéal pour jobs batch

**Inconvénients** :
- ⚠️ Peut être interrompu par GCP
- ⚠️ Pas garanti disponible

---

### Option 3 : Vertex AI (ML/AI)

**Pour** : Modèles d'IA, inference, training

**Configuration** :
- **Notebooks** : Jupyter avec GPU
- **Training** : Jobs avec GPU
- **Prediction** : Endpoints avec GPU

**Coût** : Pay-per-use (plus cher mais flexible)

---

## 🔒 Protection Maximale contre Coûts Non Contrôlés

### Checklist de Sécurité

- [ ] **Budget créé** avec alertes à 50%, 90%, 100%
- [ ] **Quotas GPU** vérifiés et limités
- [ ] **Cloud Scheduler** configuré pour arrêt automatique
- [ ] **Script d'inactivité** installé sur la VM
- [ ] **Monitoring** configuré avec alertes
- [ ] **Email notifications** activées pour budgets
- [ ] **Pub/Sub** configuré pour automatisation (optionnel)
- [ ] **IAM** : Service Account avec permissions minimales
- [ ] **Firewall** : Règles restrictives
- [ ] **Snapshots** : Désactivés ou limités (coût storage)

---

## 📋 Commandes Utiles

### Vérifier les Coûts GPU

```bash
# Voir les coûts GPU du mois
gcloud billing accounts list
gcloud billing projects describe yukpo-project

# Voir l'utilisation GPU
gcloud compute instances describe yukpo-gpu-worker \
  --zone=europe-west1-b \
  --format="get(guestAccelerators)"
```

### Arrêter/Démarrer la VM

```bash
# Arrêter
gcloud compute instances stop yukpo-gpu-worker --zone=europe-west1-b

# Démarrer
gcloud compute instances start yukpo-gpu-worker --zone=europe-west1-b
```

### Vérifier les Budgets

```bash
# Lister les budgets
gcloud billing budgets list --billing-account=BILLING_ACCOUNT_ID
```

---

## 🎯 Conclusion

**Pour Yukpomnang** :

1. **Commencer avec** : VM Preemptible GPU (économique)
2. **Budget** : $100/mois avec alertes
3. **Arrêt automatique** : Cloud Scheduler à 22h + script inactivité
4. **Monitoring** : Alertes si coût > $50/mois

**Coût estimé** : ~$30-70/mois (selon utilisation)

---

**⚠️ Important** : Toujours configurer les budgets et alertes AVANT de créer la VM GPU pour éviter les surprises de facturation !

