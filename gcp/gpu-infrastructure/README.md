# 🎮 Infrastructure GPU Automatisée pour Yukpomnang

**Date**: 2026-02-14  
**Objectif**: Système GPU complet avec scaling automatique, contrôle des coûts et intégration Rust

---

## 📋 Vue d'ensemble

Ce système fournit une infrastructure GPU complètement automatisée sur GCP avec :

- ✅ **Scaling automatique** basé sur la charge (CPU/GPU utilization)
- ✅ **Contrôle de budget** avec alertes et arrêt automatique
- ✅ **Monitoring** en temps réel avec Cloud Monitoring
- ✅ **Intégration Rust** pour router les appels IA vers GPU
- ✅ **Arrêt automatique** en cas d'inactivité ou dépassement budget

---

## 🏗️ Architecture

```
┌─────────────────┐
│  Backend Rust   │
│  (Cloud Run)    │
└────────┬────────┘
         │
         │ Appels IA
         ▼
┌─────────────────┐
│  GPU Service    │
│  (Rust)         │
└────────┬────────┘
         │
         │ HTTP API
         ▼
┌─────────────────┐
│ Compute Engine  │
│ GPU Workers     │
│ (NVIDIA T4)     │
└─────────────────┘
```

---

## 🚀 Déploiement

### Prérequis

1. **GCP Project** avec billing activé
2. **Terraform** >= 1.0
3. **gcloud CLI** configuré
4. **Permissions** : Compute Admin, Billing Account User

### Variables d'environnement

Créer un fichier `terraform/terraform.tfvars` :

```hcl
project_id      = "yukpo-project"
region          = "europe-west1"
zone            = "europe-west1-b"
gpu_type        = "nvidia-t4"
gpu_count       = 1
machine_type    = "n1-standard-4"
min_instances   = 0
max_instances   = 3
monthly_budget  = 100.0
preemptible     = true
```

### Déploiement Terraform

```bash
cd gcp/gpu-infrastructure/terraform

# Initialiser Terraform
terraform init

# Vérifier le plan
terraform plan

# Appliquer
terraform apply
```

### Déploiement via Cloud Build

Le fichier `cloudbuild.yaml` permet un déploiement automatique via Git push :

```bash
gcloud builds submit --config=cloudbuild.yaml
```

---

## ⚙️ Configuration Backend Rust

### Variables d'environnement

Ajouter dans `.env` ou Cloud Run :

```bash
# Activation GPU
GPU_ENABLED=true

# Endpoint GPU (load balancer ou instance directe)
GPU_ENDPOINT=http://yukpo-gpu-workers:8080

# Configuration GCP
GPU_ZONE=europe-west1-b
GPU_INSTANCE_NAME=yukpo-gpu-worker
GCP_PROJECT_ID=yukpo-project
GCP_SERVICE_ACCOUNT=yukpo-compute@yukpo-project.iam.gserviceaccount.com

# Budget et scaling
GPU_MONTHLY_BUDGET=100.0
GPU_SCALE_UP_THRESHOLD=70.0
GPU_SCALE_DOWN_THRESHOLD=20.0
GPU_SCALE_DOWN_COOLDOWN=300
GPU_REQUEST_TIMEOUT=60
GPU_MAX_INSTANCES=3
GPU_MIN_INSTANCES=0
```

### Utilisation dans le code

Le service GPU est automatiquement initialisé dans `AppState` :

```rust
// Dans un contrôleur ou service
if let Some(gpu_service) = &state.gpu_service {
    let result = gpu_service
        .process_ai_request(&prompt, Some("gpt-4"), None)
        .await?;
    // Traiter le résultat
}
```

---

## 📊 Monitoring

### Métriques disponibles

- **Utilisation GPU** : `compute.googleapis.com/instance/gpu/utilization`
- **Coûts** : Via Billing API
- **Instances actives** : Via Instance Group Manager

### Alertes configurées

1. **Utilisation faible** : < 5% pendant 1h → Alerte
2. **Budget** : 50%, 90%, 100% → Notifications email
3. **Coût mensuel** : Dépassement budget → Arrêt automatique

### Dashboard Cloud Monitoring

Créer un dashboard personnalisé avec :
- Graphique utilisation GPU
- Nombre d'instances actives
- Coûts estimés
- Latence des appels

---

## 🔧 Gestion manuelle

### Scripts de gestion

```bash
# Vérifier le statut
./scripts/manage-gpu.sh status

# Scale up à 2 instances
./scripts/manage-gpu.sh up 2

# Scale down à 0 instances
./scripts/manage-gpu.sh down 0

# Arrêter toutes les instances
./scripts/manage-gpu.sh stop

# Démarrer toutes les instances
./scripts/manage-gpu.sh start

# Vérifier les coûts
./scripts/manage-gpu.sh costs
```

### Commandes gcloud directes

```bash
# Lister les instances GPU
gcloud compute instances list --filter="tags.items:gpu-worker"

# Démarrer une instance
gcloud compute instances start yukpo-gpu-worker-xxx --zone=europe-west1-b

# Arrêter une instance
gcloud compute instances stop yukpo-gpu-worker-xxx --zone=europe-west1-b

# Vérifier l'utilisation GPU
gcloud compute instances describe yukpo-gpu-worker-xxx \
  --zone=europe-west1-b \
  --format="get(guestAccelerators)"
```

---

## 💰 Contrôle des coûts

### Budget configuré

- **Montant** : $100/mois (configurable)
- **Alertes** : 50%, 90%, 100%
- **Action** : Arrêt automatique si dépassement

### Estimation des coûts

- **NVIDIA T4** : ~$0.35/heure (~$250/mois si 24/7)
- **Preemptible** : ~$0.10/heure (~$70/mois si 24/7)
- **Recommandé** : Preemptible avec arrêt automatique → ~$30-70/mois

### Optimisations

1. **Preemptible instances** : 70% moins cher
2. **Arrêt automatique** : Cloud Scheduler à 22h
3. **Scaling down** : Si utilisation < 20% pendant 5 min
4. **Monitoring** : Alertes si inactif > 1h

---

## 🔒 Sécurité

### IAM

- Service account dédié avec permissions minimales
- Scope : `cloud-platform` (Compute Admin)

### Firewall

- Port 8080 ouvert uniquement pour le backend
- Pas d'accès public direct

### Network

- Instances dans le réseau par défaut
- Communication interne uniquement

---

## 🐛 Dépannage

### Instance ne démarre pas

```bash
# Vérifier les logs
gcloud compute instances get-serial-port-output yukpo-gpu-worker-xxx \
  --zone=europe-west1-b

# Vérifier les quotas GPU
gcloud compute project-info describe --project=yukpo-project
```

### Scaling ne fonctionne pas

1. Vérifier les métriques dans Cloud Monitoring
2. Vérifier les logs du service GPU dans le backend
3. Vérifier les permissions du service account

### Budget dépassé

1. Vérifier les coûts dans Billing
2. Arrêter manuellement les instances
3. Ajuster le budget si nécessaire

---

## 📚 Références

- [GCP GPU Documentation](https://cloud.google.com/compute/docs/gpus)
- [Terraform GCP Provider](https://registry.terraform.io/providers/hashicorp/google/latest/docs)
- [GCP Billing Budgets](https://cloud.google.com/billing/docs/how-to/budgets)

---

## ✅ Checklist de déploiement

- [ ] Terraform initialisé et configuré
- [ ] Variables d'environnement backend configurées
- [ ] Budget GCP créé avec alertes
- [ ] Quotas GPU vérifiés
- [ ] Service account créé avec permissions
- [ ] Monitoring configuré
- [ ] Cloud Scheduler configuré pour arrêt automatique
- [ ] Tests de scaling effectués
- [ ] Documentation mise à jour

---

**⚠️ Important** : Toujours configurer les budgets et alertes AVANT de créer les instances GPU pour éviter les surprises de facturation !



