# 🔧 Variables GPU - Alignement et Activation GCP

**Date**: 2026-02-14  
**Objectif**: Aligner toutes les variables GPU avec le code Rust et activer dans GCP Cloud Run

---

## 📋 Variables GPU existantes dans le code

### Variables GCP GPU Service (Nouveau - `gpu_service.rs`)

Ces variables gèrent les instances GPU distantes sur GCP Compute Engine :

```bash
# Activation du service GPU GCP
GPU_ENABLED=true

# Configuration endpoint GPU (load balancer ou instance directe)
GPU_ENDPOINT=http://yukpo-gpu-workers:8080
# OU pour développement local:
# GPU_ENDPOINT=http://localhost:8080

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

### Variables GPU Local (Existant - `gpu_detector.rs`, `production_config.rs`)

Ces variables gèrent le GPU local dans le conteneur Cloud Run :

```bash
# Activation GPU local
GPU_AVAILABLE=true
GPU_TYPE=nvidia  # nvidia, intel, apple, vaapi
GPU_MEMORY_GB=16

# Variables CUDA (optionnel)
CUDA_VISIBLE_DEVICES=0
CUDA_HOME=/usr/local/cuda
CUDA_PATH=/usr/local/cuda
NVIDIA_VISIBLE_DEVICES=all

# Cache GPU (gpu_render_service.rs)
GPU_CACHE_DIR=./cache/gpu
```

---

## 🎯 Alignement des variables

### Priorité de routing GPU

Le système utilise la priorité suivante :

1. **GPU GCP** (`GPU_ENABLED=true`) → Instances GPU distantes sur Compute Engine
2. **GPU Local** (`GPU_AVAILABLE=true`) → GPU dans le conteneur Cloud Run
3. **CPU** → Fallback si aucun GPU disponible

### Configuration recommandée pour production

```bash
# ✅ Activer GPU GCP (instances distantes avec scaling)
GPU_ENABLED=true
GPU_ENDPOINT=http://yukpo-gpu-workers:8080
GPU_ZONE=europe-west1-b
GPU_INSTANCE_NAME=yukpo-gpu-worker
GCP_PROJECT_ID=yukpo-project
GPU_MONTHLY_BUDGET=100.0
GPU_SCALE_UP_THRESHOLD=70.0
GPU_SCALE_DOWN_THRESHOLD=20.0
GPU_MAX_INSTANCES=3
GPU_MIN_INSTANCES=0

# ✅ Désactiver GPU local (Cloud Run ne supporte pas GPU)
GPU_AVAILABLE=false
```

### Configuration pour développement local

```bash
# ✅ Activer GPU local si disponible
GPU_AVAILABLE=true
GPU_TYPE=nvidia
GPU_MEMORY_GB=16

# ✅ Désactiver GPU GCP (pas besoin en local)
GPU_ENABLED=false
```

---

## 🚀 Activation dans GCP Cloud Run

### Méthode 1: Via Console GCP

1. **Cloud Run** → Sélectionner votre service
2. **EDIT & DEPLOY NEW REVISION**
3. **Variables & Secrets** → **ADD VARIABLE**
4. Ajouter toutes les variables GPU :

```
GPU_ENABLED=true
GPU_ENDPOINT=http://yukpo-gpu-workers:8080
GPU_ZONE=europe-west1-b
GPU_INSTANCE_NAME=yukpo-gpu-worker
GCP_PROJECT_ID=yukpo-project
GPU_MONTHLY_BUDGET=100.0
GPU_SCALE_UP_THRESHOLD=70.0
GPU_SCALE_DOWN_THRESHOLD=20.0
GPU_SCALE_DOWN_COOLDOWN=300
GPU_REQUEST_TIMEOUT=60
GPU_MAX_INSTANCES=3
GPU_MIN_INSTANCES=0
GPU_AVAILABLE=false
```

5. **DEPLOY**

### Méthode 2: Via gcloud CLI

```bash
gcloud run services update yukpomnang-backend \
  --region=europe-west1 \
  --update-env-vars="GPU_ENABLED=true" \
  --update-env-vars="GPU_ENDPOINT=http://yukpo-gpu-workers:8080" \
  --update-env-vars="GPU_ZONE=europe-west1-b" \
  --update-env-vars="GPU_INSTANCE_NAME=yukpo-gpu-worker" \
  --update-env-vars="GCP_PROJECT_ID=yukpo-project" \
  --update-env-vars="GPU_MONTHLY_BUDGET=100.0" \
  --update-env-vars="GPU_SCALE_UP_THRESHOLD=70.0" \
  --update-env-vars="GPU_SCALE_DOWN_THRESHOLD=20.0" \
  --update-env-vars="GPU_SCALE_DOWN_COOLDOWN=300" \
  --update-env-vars="GPU_REQUEST_TIMEOUT=60" \
  --update-env-vars="GPU_MAX_INSTANCES=3" \
  --update-env-vars="GPU_MIN_INSTANCES=0" \
  --update-env-vars="GPU_AVAILABLE=false"
```

### Méthode 3: Via Terraform (Recommandé)

Créer un fichier `terraform/cloud-run-variables.tf` :

```hcl
resource "google_cloud_run_service" "backend" {
  name     = "yukpomnang-backend"
  location = "europe-west1"

  template {
    spec {
      containers {
        image = "gcr.io/yukpo-project/yukpomnang-backend:latest"
        
        env {
          name  = "GPU_ENABLED"
          value = "true"
        }
        env {
          name  = "GPU_ENDPOINT"
          value = "http://yukpo-gpu-workers:8080"
        }
        env {
          name  = "GPU_ZONE"
          value = "europe-west1-b"
        }
        env {
          name  = "GPU_INSTANCE_NAME"
          value = "yukpo-gpu-worker"
        }
        env {
          name  = "GCP_PROJECT_ID"
          value = "yukpo-project"
        }
        env {
          name  = "GPU_MONTHLY_BUDGET"
          value = "100.0"
        }
        env {
          name  = "GPU_SCALE_UP_THRESHOLD"
          value = "70.0"
        }
        env {
          name  = "GPU_SCALE_DOWN_THRESHOLD"
          value = "20.0"
        }
        env {
          name  = "GPU_SCALE_DOWN_COOLDOWN"
          value = "300"
        }
        env {
          name  = "GPU_REQUEST_TIMEOUT"
          value = "60"
        }
        env {
          name  = "GPU_MAX_INSTANCES"
          value = "3"
        }
        env {
          name  = "GPU_MIN_INSTANCES"
          value = "0"
        }
        env {
          name  = "GPU_AVAILABLE"
          value = "false"
        }
      }
    }
  }
}
```

---

## ✅ Vérification

### 1. Vérifier les variables dans Cloud Run

```bash
gcloud run services describe yukpomnang-backend \
  --region=europe-west1 \
  --format="value(spec.template.spec.containers[0].env)"
```

### 2. Vérifier les logs au démarrage

Les logs doivent afficher :

```
✅ Service GPU initialisé
🚀 Démarrage du monitoring GPU automatisé...
✅ Monitoring GPU démarré (scaling automatique activé)
```

### 3. Tester l'API GPU

```bash
# Récupérer les métriques
curl https://your-backend-url/api/gpu/metrics

# Vérifier le statut
curl https://your-backend-url/api/gpu/status
```

---

## 📊 Tableau récapitulatif

| Variable | Type | Défaut | Description | Utilisé dans |
|----------|------|--------|-------------|--------------|
| `GPU_ENABLED` | bool | `false` | Active le service GPU GCP | `gpu_service.rs` |
| `GPU_ENDPOINT` | string | `http://localhost:8080` | Endpoint des workers GPU | `gpu_service.rs` |
| `GPU_ZONE` | string | `europe-west1-b` | Zone GCP | `gpu_service.rs` |
| `GPU_INSTANCE_NAME` | string | `yukpo-gpu-worker` | Nom instance GPU | `gpu_service.rs` |
| `GCP_PROJECT_ID` | string | *requis* | Projet GCP | `gpu_service.rs` |
| `GPU_MONTHLY_BUDGET` | float | `100.0` | Budget mensuel USD | `gpu_service.rs` |
| `GPU_SCALE_UP_THRESHOLD` | float | `70.0` | Seuil scale up (%) | `gpu_service.rs` |
| `GPU_SCALE_DOWN_THRESHOLD` | float | `20.0` | Seuil scale down (%) | `gpu_service.rs` |
| `GPU_SCALE_DOWN_COOLDOWN` | int | `300` | Cooldown scale down (s) | `gpu_service.rs` |
| `GPU_REQUEST_TIMEOUT` | int | `60` | Timeout requêtes (s) | `gpu_service.rs` |
| `GPU_MAX_INSTANCES` | int | `3` | Max instances GPU | `gpu_service.rs` |
| `GPU_MIN_INSTANCES` | int | `0` | Min instances GPU | `gpu_service.rs` |
| `GPU_AVAILABLE` | bool | `false` | Active GPU local | `gpu_detector.rs`, `production_config.rs` |
| `GPU_TYPE` | string | `nvidia` | Type GPU local | `gpu_detector.rs` |
| `GPU_MEMORY_GB` | int | - | Mémoire GPU (GB) | `gpu_detector.rs` |
| `GPU_CACHE_DIR` | string | `./cache/gpu` | Cache GPU | `gpu_render_service.rs` |

---

## 🔒 Sécurité

- ✅ `GCP_SERVICE_ACCOUNT` : Service account avec permissions minimales
- ✅ `GPU_MONTHLY_BUDGET` : Limite de budget pour éviter dépassements
- ✅ Variables sensibles stockées dans Secret Manager (recommandé)

---

## 📚 Références

- [Documentation GCP Cloud Run Variables](https://cloud.google.com/run/docs/configuring/environment-variables)
- [Documentation Terraform Cloud Run](https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/cloud_run_service)

---

**✅ Variables alignées et prêtes pour activation dans GCP !**

