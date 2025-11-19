# 🔍 Plan de Vérification GPU Complète - Yukpo

## 🎯 Objectif

Vérifier que le GPU NVIDIA est **effectivement utilisé** au-delà du code, et que toutes les configurations nécessaires sont en place.

---

## 📋 Checklist de Vérification GPU

### Phase 1 : Vérification du Code (Déjà fait ✅)

- [x] Code GPU intégré (`gpu_detector.rs`, `gpu_optimizer.rs`)
- [x] Pipeline IA avec optimisations GPU
- [x] Rendu vidéo GPU (Remotion)
- [x] Feature flags GPU

### Phase 2 : Vérification Variables d'Environnement ⏳

#### Sur Render (Backend)

**Variables à vérifier/configurer** :
```bash
# Détection GPU
CUDA_VISIBLE_DEVICES=0          # ⏳ À vérifier
GPU_AVAILABLE=true              # ⏳ À vérifier
GPU_TYPE=nvidia                 # ⏳ À vérifier
GPU_MEMORY_GB=16                # ⏳ À vérifier (selon GPU)

# Environnement
RUST_ENV=production             # ✅ Probablement déjà configuré
ENVIRONMENT=production          # ✅ Probablement déjà configuré

# Optimisations GPU
IMAGE_MAX_SIZE=2048             # ⏳ À vérifier
IMAGE_QUALITY=0.9               # ⏳ À vérifier
API_TIMEOUT_MULTIMODAL=10       # ⏳ À vérifier (10s pour GPU vs 30s CPU)
API_TIMEOUT_TEXT=5              # ⏳ À vérifier (5s pour GPU vs 15s CPU)

# Rendu Vidéo GPU
VIDEO_RENDERER_ENABLE_GPU=true  # ⏳ À vérifier
VIDEO_RENDERER_RPC_URL=...      # ⏳ À vérifier (si worker GPU séparé)
REMOTION_ENABLE_GPU=true        # ⏳ À vérifier
```

#### Sur Hetzner (Worker GPU - si séparé)

**Variables à vérifier/configurer** :
```bash
# GPU
CUDA_VISIBLE_DEVICES=0
GPU_AVAILABLE=true
GPU_TYPE=nvidia
NVIDIA_VISIBLE_DEVICES=all

# Remotion
REMOTION_ENABLE_GPU=true
REMOTION_GPU_ACCELERATION=true

# Docker
NVIDIA_DRIVER_CAPABILITIES=compute,utility,video
```

### Phase 3 : Vérification Docker GPU ⏳

#### Dockerfile Backend

**À vérifier** :
- [ ] Dockerfile actuel supporte-t-il GPU ?
- [ ] Image de base CUDA utilisée ?
- [ ] Feature `gpu` compilée ?

**Dockerfile actuel** (`backend/Dockerfile`) :
```dockerfile
FROM rustlang/rust:nightly  # ❌ Pas d'image CUDA
# ⚠️ Pas de support GPU natif
```

**Dockerfile GPU nécessaire** (`backend/Dockerfile.gpu`) :
```dockerfile
FROM nvidia/cuda:11.8-devel-ubuntu20.04
# ✅ Support CUDA natif
```

#### Docker Compose

**À vérifier** :
- [ ] Runtime GPU configuré (`nvidia` runtime)
- [ ] Devices GPU exposés
- [ ] Variables GPU passées

**Configuration nécessaire** :
```yaml
services:
  backend:
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]
    runtime: nvidia
    environment:
      - GPU_AVAILABLE=true
      - CUDA_VISIBLE_DEVICES=0
```

### Phase 4 : Vérification Infrastructure GPU ⏳

#### Sur Render

**Questions à vérifier** :
- [ ] Render supporte-t-il GPU ?
- [ ] Instance GPU disponible ?
- [ ] Runtime Docker GPU activé ?

**Note** : Render ne supporte pas GPU actuellement. Options :
- Utiliser Hetzner pour worker GPU
- Utiliser AWS/Azure avec instances GPU
- Utiliser GPU cloud spécialisé (Vast.ai, RunPod, etc.)

#### Sur Hetzner (Worker GPU)

**À vérifier** :
- [ ] Serveur GPU provisionné (AX161 + RTX 4090 ou similaire)
- [ ] Drivers NVIDIA installés
- [ ] Docker GPU runtime configuré
- [ ] nvidia-container-toolkit installé

**Commandes de vérification** :
```bash
# Vérifier GPU
nvidia-smi

# Vérifier Docker GPU
docker run --rm --gpus all nvidia/cuda:11.8-base-ubuntu20.04 nvidia-smi

# Vérifier runtime
docker info | grep -i runtime
```

### Phase 5 : Vérification Utilisation Effective GPU ⏳

#### Tests à Effectuer

**1. Test de détection GPU** :
```bash
# Sur le serveur avec GPU
curl http://localhost:3001/api/health
# Vérifier dans les logs : "GPU Optimizer: GPU Mode"
```

**2. Test de traitement GPU** :
```bash
# Envoyer une requête avec image
curl -X POST http://localhost:3001/api/ia/creation-service \
  -H "Content-Type: application/json" \
  -d '{"input": "...", "images": [...]}'

# Vérifier dans les logs :
# - "[GPUOptimizer] 🚀 Pipeline GPU activé"
# - Temps de traitement < 10s (vs 20s+ CPU)
```

**3. Test de rendu vidéo GPU** :
```bash
# Créer un job de rendu vidéo
# Vérifier que RenderExecutionMode::GpuRpc est utilisé
# Vérifier les logs du worker GPU
```

#### Métriques à Surveiller

**Dans Prometheus/Grafana** :
```promql
# Utilisation GPU (à ajouter)
gpu_utilization_percent{job="yukpo-backend"}
gpu_temperature_celsius{job="yukpo-backend"}
gpu_memory_used_bytes{job="yukpo-backend"}

# Performance GPU vs CPU
gpu_processing_time_ms_avg{job="yukpo-backend"}
cpu_processing_time_ms_avg{job="yukpo-backend"}
```

**Logs à vérifier** :
```
[GPUOptimizer] 🚀 Pipeline GPU activé
[GPUOptimizer] ⚡ Conversion GPU terminée en Xms
[orchestration_ia] 🎯 Configuration: GPU: ON
```

### Phase 6 : Vérification Configuration Runtime ⏳

#### Backend Rust

**À vérifier** :
- [ ] Feature `gpu` activée en production ?
- [ ] `ProductionConfig` détecte GPU correctement ?
- [ ] Fallback CPU fonctionne si GPU indisponible ?

**Code à vérifier** :
```rust
// backend/src/config/production_config.rs
pub struct ProductionConfig {
    pub gpu_enabled: bool,  // ⏳ Vérifier que c'est true en prod
    // ...
}
```

#### Worker Remotion GPU

**À vérifier** :
- [ ] Worker GPU déployé et accessible ?
- [ ] RPC URL configurée correctement ?
- [ ] NVENC/NVDEC activés dans Remotion ?

---

## 🔧 Actions Correctives Nécessaires

### Si GPU Non Utilisé Effectivement

#### Option 1 : Utiliser Hetzner pour Worker GPU

**Avantages** :
- ✅ Contrôle total sur l'infrastructure
- ✅ GPU dédié (RTX 4090, L40S, etc.)
- ✅ Coût prévisible

**Configuration** :
1. Provisionner serveur Hetzner GPU (AX161)
2. Installer drivers NVIDIA
3. Configurer Docker GPU runtime
4. Déployer worker Remotion GPU
5. Configurer backend pour utiliser worker GPU

#### Option 2 : Utiliser Cloud GPU (AWS/Azure)

**AWS** :
- Instance EC2 `g4dn.xlarge` (NVIDIA T4)
- Instance EC2 `g5.xlarge` (NVIDIA A10G)

**Azure** :
- Instance `NC6s_v3` (NVIDIA V100)
- Instance `NCas_T4_v3` (NVIDIA T4)

**Configuration** :
1. Créer instance GPU
2. Configurer Docker GPU
3. Déployer backend/worker
4. Mettre à jour variables d'environnement

#### Option 3 : GPU Cloud Spécialisé

**Options** :
- Vast.ai (GPU à la demande)
- RunPod (GPU serverless)
- Lambda Labs (GPU cloud)

---

## 📊 Tests de Validation GPU

### Test 1 : Détection GPU

```bash
# Sur le serveur
export GPU_AVAILABLE=true
export CUDA_VISIBLE_DEVICES=0
cargo run --features gpu

# Vérifier logs :
# "GPU Optimizer: GPU Mode"
```

### Test 2 : Performance GPU vs CPU

```bash
# Test CPU
export GPU_AVAILABLE=false
time curl -X POST http://localhost:3001/api/ia/creation-service ...

# Test GPU
export GPU_AVAILABLE=true
time curl -X POST http://localhost:3001/api/ia/creation-service ...

# Comparer temps : GPU devrait être 3-5x plus rapide
```

### Test 3 : Monitoring GPU

```bash
# Vérifier utilisation GPU en temps réel
watch -n 1 nvidia-smi

# Pendant traitement, GPU devrait monter à 60-80%
```

---

## 📝 Documentation à Créer

- [ ] Guide de configuration GPU complet
- [ ] Scripts de vérification GPU
- [ ] Procédure de déploiement GPU
- [ ] Troubleshooting GPU

---

## ✅ Checklist Finale

### Code
- [x] Code GPU intégré
- [ ] Feature `gpu` activée en production
- [ ] Tests GPU passent

### Configuration
- [ ] Variables d'environnement GPU configurées
- [ ] Docker GPU configuré
- [ ] Infrastructure GPU provisionnée

### Utilisation Effective
- [ ] GPU détecté au runtime
- [ ] GPU utilisé pour traitement
- [ ] Performance GPU vérifiée (3-5x plus rapide)
- [ ] Métriques GPU collectées

### Monitoring
- [ ] Métriques GPU dans Prometheus
- [ ] Dashboard GPU dans Grafana
- [ ] Alertes GPU configurées

---

**Ce plan sera exécuté après les phases prioritaires (métriques, alertes, dashboards).**

