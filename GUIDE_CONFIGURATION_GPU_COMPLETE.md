# 🔧 Guide Complet de Configuration GPU - Yukpo

## 🎯 Objectif

Configurer le GPU NVIDIA pour qu'il soit **effectivement utilisé** en production, pas seulement dans le code.

---

## ⚠️ Problème Identifié

### Problème dans le Code

**Fichier** : `backend/src/config/production_config.rs`

**Avant** (ligne 54) :
```rust
gpu_enabled: true,  // ❌ Hardcodé à true
```

**Après** (corrigé) :
```rust
// Détection GPU via variables d'environnement
let gpu_enabled = std::env::var("GPU_AVAILABLE")
    .unwrap_or_else(|_| "false".to_string())
    .parse::<bool>()
    .unwrap_or_else(|_| {
        // Fallback: vérifier CUDA_VISIBLE_DEVICES ou NVIDIA_VISIBLE_DEVICES
        std::env::var("CUDA_VISIBLE_DEVICES").is_ok()
            || std::env::var("NVIDIA_VISIBLE_DEVICES").is_ok()
    });
```

**✅ Correction appliquée** : Le code vérifie maintenant les variables d'environnement.

---

## 📋 Configuration GPU Complète

### Phase 1 : Variables d'Environnement sur Render

#### Variables Obligatoires

**Sur Render (Backend)** :
```bash
# Détection GPU (OBLIGATOIRE pour activer GPU)
GPU_AVAILABLE=true

# Optionnel mais recommandé
CUDA_VISIBLE_DEVICES=0
GPU_TYPE=nvidia
GPU_MEMORY_GB=16  # Selon votre GPU

# Environnement
RUST_ENV=production
ENVIRONMENT=production
```

#### Variables Optionnelles (Optimisations)

```bash
# Optimisations images
IMAGE_MAX_SIZE=2048
IMAGE_QUALITY=0.9

# Timeouts adaptatifs (GPU plus rapide)
API_TIMEOUT_MULTIMODAL=10  # 10s pour GPU vs 30s CPU
API_TIMEOUT_TEXT=5         # 5s pour GPU vs 15s CPU
```

#### Variables Rendu Vidéo GPU

```bash
# Rendu vidéo GPU (si worker GPU séparé)
VIDEO_RENDERER_ENABLE_GPU=true
VIDEO_RENDERER_RPC_URL=https://renderer.yukpo.live/render
REMOTION_ENABLE_GPU=true
```

---

### Phase 2 : Vérification sur Render

#### Étape 1 : Accéder au Dashboard Render

1. Aller sur : https://dashboard.render.com
2. Sélectionner : Service "yukpomnang" (backend)
3. Onglet : **Environment**

#### Étape 2 : Vérifier/Ajouter les Variables

**Vérifier si ces variables existent** :
- `GPU_AVAILABLE`
- `CUDA_VISIBLE_DEVICES`
- `GPU_TYPE`
- `VIDEO_RENDERER_ENABLE_GPU`

**Si elles n'existent pas, les ajouter** :
1. Cliquer "Add Environment Variable"
2. Nom : `GPU_AVAILABLE`
3. Valeur : `true`
4. Secret : Non (ou Oui si vous préférez)
5. Répéter pour les autres variables

#### Étape 3 : Redéployer

Après avoir ajouté les variables :
- Render redéploiera automatiquement
- Ou cliquer "Manual Deploy" → "Deploy latest commit"

---

### Phase 3 : Vérification Utilisation Effective

#### Test 1 : Vérifier les Logs

**Sur Render** :
1. Dashboard → Service → Logs
2. Chercher : `[GPUOptimizer]` ou `GPU`
3. Doit afficher :
   ```
   [GPUOptimizer] 🚀 Pipeline GPU activé
   [GPUOptimizer] ⚡ Conversion GPU terminée en Xms
   ```

**Si vous voyez** :
```
[GPUOptimizer] 🔄 Pipeline CPU activé
```
→ GPU n'est pas activé (vérifier `GPU_AVAILABLE=true`)

#### Test 2 : Vérifier via API

```bash
# Vérifier le health endpoint
curl https://yukpomnang.onrender.com/healthz

# Vérifier les métriques
curl https://yukpomnang.onrender.com/metrics | grep -i gpu
```

#### Test 3 : Test de Performance

**Envoyer une requête avec image** :
```bash
curl -X POST https://yukpomnang.onrender.com/api/ia/creation-service \
  -H "Content-Type: application/json" \
  -d '{
    "input": "Créer un service de coiffure",
    "base64_image": ["..."]
  }'
```

**Temps attendu** :
- **Avec GPU** : 3-8 secondes
- **Sans GPU (CPU)** : 20+ secondes

---

### Phase 4 : Infrastructure GPU (Si Nécessaire)

#### Option A : Render (Limitation)

**⚠️ IMPORTANT** : Render ne supporte **pas** GPU actuellement.

**Conséquence** :
- Le code GPU fonctionne mais utilise le CPU
- Les optimisations GPU (accélération matérielle) ne sont pas disponibles
- Les variables `GPU_AVAILABLE=true` activent les optimisations logicielles mais pas matérielles

#### Option B : Worker GPU Séparé (Hetzner/AWS/Azure)

**Architecture recommandée** :
- **Backend** : Render (CPU, optimisations logicielles)
- **Worker GPU** : Hetzner/AWS/Azure (GPU dédié pour rendu vidéo)

**Configuration Worker GPU** :
1. Provisionner serveur GPU (Hetzner AX161 + RTX 4090)
2. Installer drivers NVIDIA
3. Configurer Docker GPU runtime
4. Déployer worker Remotion GPU
5. Configurer `VIDEO_RENDERER_RPC_URL` sur Render

---

## 🔍 Vérification Complète

### Script de Vérification

**Exécuter** :
```bash
# Localement
bash verifier-configuration-gpu.sh

# Sur Hetzner (si serveur GPU)
ssh root@46.224.14.85
bash /tmp/verifier-configuration-gpu.sh

# Vérifier Render
bash verifier-gpu-render.sh
```

### Checklist

#### Code
- [x] Code GPU intégré (`gpu_detector.rs`, `gpu_optimizer.rs`)
- [x] `ProductionConfig` utilise les variables d'environnement (corrigé)
- [x] Feature `gpu` définie dans `Cargo.toml`

#### Variables d'Environnement
- [ ] `GPU_AVAILABLE=true` configuré sur Render
- [ ] `CUDA_VISIBLE_DEVICES=0` configuré (si GPU disponible)
- [ ] `GPU_TYPE=nvidia` configuré
- [ ] `VIDEO_RENDERER_ENABLE_GPU=true` configuré (si worker GPU)

#### Utilisation Effective
- [ ] Logs montrent "Pipeline GPU activé"
- [ ] Performance améliorée (3-8s vs 20s+)
- [ ] Métriques GPU disponibles (si implémentées)

#### Infrastructure
- [ ] Serveur GPU provisionné (si nécessaire)
- [ ] Drivers NVIDIA installés (si serveur GPU)
- [ ] Docker GPU runtime configuré (si serveur GPU)

---

## 🛠️ Actions Correctives

### Si GPU Non Utilisé

#### Problème 1 : Variables Non Configurées

**Solution** :
1. Ajouter `GPU_AVAILABLE=true` sur Render
2. Redéployer le service
3. Vérifier les logs

#### Problème 2 : Code Non Compilé avec Feature GPU

**Solution** :
1. Vérifier que `Cargo.toml` contient `gpu = ["image"]`
2. Compiler avec : `cargo build --features gpu`
3. Déployer avec la feature activée

#### Problème 3 : Render Ne Supporte Pas GPU

**Solution** :
- Utiliser les optimisations logicielles (déjà activées)
- Pour GPU matériel : déployer worker GPU séparé sur Hetzner/AWS/Azure

---

## 📊 Métriques GPU à Ajouter

### Métriques à Implémenter

```rust
// Dans le backend, ajouter ces métriques Prometheus
gpu_utilization_percent{job="yukpo-backend"}
gpu_temperature_celsius{job="yukpo-backend"}
gpu_memory_used_bytes{job="yukpo-backend"}
gpu_processing_time_ms_avg{job="yukpo-backend"}
gpu_enabled{job="yukpo-backend"}  // 1 si GPU activé, 0 sinon
```

### Dashboard Grafana GPU

Créer un dashboard avec :
- Utilisation GPU (%)
- Température GPU
- Mémoire GPU utilisée
- Temps de traitement GPU vs CPU
- Nombre de requêtes GPU vs CPU

---

## ✅ Résumé

### Corrections Appliquées

1. ✅ **`production_config.rs` corrigé** : Utilise maintenant `GPU_AVAILABLE` au lieu de hardcoder `true`

### À Faire

1. ⏳ **Configurer variables sur Render** : `GPU_AVAILABLE=true`
2. ⏳ **Vérifier utilisation effective** : Logs et performance
3. ⏳ **Ajouter métriques GPU** : Pour monitoring
4. ⏳ **Créer dashboard GPU** : Dans Grafana

---

**Configuration GPU prête ! Il reste à configurer les variables sur Render et vérifier l'utilisation effective.** ✅

