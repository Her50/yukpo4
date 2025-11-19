#!/bin/bash
# Script de verification complete de la configuration GPU

echo "=== VERIFICATION CONFIGURATION GPU YUKPO ==="
echo ""

# Couleurs
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Compteurs
PASSED=0
FAILED=0
WARNINGS=0

check_pass() {
    echo -e "${GREEN}✓${NC} $1"
    ((PASSED++))
}

check_fail() {
    echo -e "${RED}✗${NC} $1"
    ((FAILED++))
}

check_warn() {
    echo -e "${YELLOW}⚠${NC} $1"
    ((WARNINGS++))
}

echo "1. VERIFICATION DU CODE"
echo "-----------------------"

# Vérifier que les fichiers GPU existent
if [ -f "backend/src/services/gpu_detector.rs" ]; then
    check_pass "Fichier gpu_detector.rs existe"
else
    check_fail "Fichier gpu_detector.rs manquant"
fi

if [ -f "backend/src/services/gpu_optimizer.rs" ]; then
    check_pass "Fichier gpu_optimizer.rs existe"
else
    check_fail "Fichier gpu_optimizer.rs manquant"
fi

# Vérifier que la feature gpu existe dans Cargo.toml
if grep -q "gpu = " backend/Cargo.toml; then
    check_pass "Feature 'gpu' definie dans Cargo.toml"
else
    check_fail "Feature 'gpu' non definie dans Cargo.toml"
fi

echo ""
echo "2. VERIFICATION VARIABLES D'ENVIRONNEMENT"
echo "------------------------------------------"

# Vérifier les variables GPU dans le code
echo "Variables GPU recherchees par le code:"
echo "  - CUDA_VISIBLE_DEVICES"
echo "  - GPU_AVAILABLE"
echo "  - NVIDIA_VISIBLE_DEVICES"
echo "  - GPU_TYPE"
echo "  - GPU_MEMORY_GB"
echo "  - CUDA_HOME / CUDA_PATH"
echo ""

# Vérifier si les variables sont définies localement (pour test)
if [ -n "$GPU_AVAILABLE" ]; then
    check_pass "GPU_AVAILABLE definie: $GPU_AVAILABLE"
else
    check_warn "GPU_AVAILABLE non definie (normal si pas en production GPU)"
fi

if [ -n "$CUDA_VISIBLE_DEVICES" ]; then
    check_pass "CUDA_VISIBLE_DEVICES definie: $CUDA_VISIBLE_DEVICES"
else
    check_warn "CUDA_VISIBLE_DEVICES non definie"
fi

echo ""
echo "3. VERIFICATION CONFIGURATION PRODUCTION"
echo "----------------------------------------"

# Vérifier production_config.rs
if grep -q "gpu_enabled" backend/src/config/production_config.rs; then
    check_pass "gpu_enabled present dans ProductionConfig"
    
    # Vérifier si gpu_enabled est hardcodé ou utilise les variables
    if grep -q "gpu_enabled: true" backend/src/config/production_config.rs && ! grep -q "GPU_AVAILABLE\|env::var.*GPU" backend/src/config/production_config.rs; then
        check_warn "gpu_enabled est hardcode a true (devrait verifier GPU_AVAILABLE)"
    else
        check_pass "gpu_enabled utilise les variables d'environnement"
    fi
else
    check_fail "gpu_enabled non trouve dans ProductionConfig"
fi

echo ""
echo "4. VERIFICATION DOCKER"
echo "----------------------"

# Vérifier Dockerfile
if [ -f "backend/Dockerfile" ]; then
    if grep -q "nvidia/cuda" backend/Dockerfile; then
        check_pass "Dockerfile utilise image CUDA"
    else
        check_warn "Dockerfile n'utilise pas image CUDA (FROM rustlang/rust:nightly)"
        echo "  → Pour GPU: utiliser FROM nvidia/cuda:11.8-devel-ubuntu20.04"
    fi
    
    if grep -q "features.*gpu\|--features gpu" backend/Dockerfile; then
        check_pass "Dockerfile compile avec feature gpu"
    else
        check_warn "Dockerfile ne compile pas avec feature gpu"
        echo "  → Ajouter: RUN cargo build --release --features gpu"
    fi
else
    check_fail "Dockerfile non trouve"
fi

# Vérifier docker-compose.yml
if [ -f "docker-compose.yml" ]; then
    if grep -q "nvidia\|gpu" docker-compose.yml; then
        check_pass "docker-compose.yml contient configuration GPU"
    else
        check_warn "docker-compose.yml ne contient pas configuration GPU"
        echo "  → Ajouter runtime: nvidia et devices GPU"
    fi
else
    check_warn "docker-compose.yml non trouve"
fi

echo ""
echo "5. VERIFICATION INFRASTRUCTURE (si serveur GPU)"
echo "------------------------------------------------"

# Vérifier si nvidia-smi est disponible
if command -v nvidia-smi &> /dev/null; then
    check_pass "nvidia-smi disponible"
    echo ""
    echo "Informations GPU:"
    nvidia-smi --query-gpu=name,memory.total,driver_version --format=csv,noheader
    echo ""
else
    check_warn "nvidia-smi non disponible (normal si pas de GPU sur cette machine)"
fi

# Vérifier Docker GPU runtime
if command -v docker &> /dev/null; then
    if docker info 2>/dev/null | grep -q "nvidia\|gpu"; then
        check_pass "Docker GPU runtime configure"
    else
        check_warn "Docker GPU runtime non configure"
        echo "  → Installer: nvidia-container-toolkit"
    fi
else
    check_warn "Docker non disponible"
fi

echo ""
echo "6. VERIFICATION UTILISATION EFFECTIVE"
echo "--------------------------------------"

# Vérifier si le backend est accessible et retourne des infos GPU
if command -v curl &> /dev/null; then
    BACKEND_URL="${BACKEND_URL:-http://localhost:3001}"
    HEALTH_RESPONSE=$(curl -s "$BACKEND_URL/healthz" 2>/dev/null)
    
    if [ -n "$HEALTH_RESPONSE" ]; then
        check_pass "Backend accessible"
        
        # Chercher des infos GPU dans la réponse
        if echo "$HEALTH_RESPONSE" | grep -qi "gpu"; then
            check_pass "Backend retourne des informations GPU"
            echo "  Reponse: $HEALTH_RESPONSE"
        else
            check_warn "Backend ne retourne pas d'informations GPU dans /healthz"
        fi
    else
        check_warn "Backend non accessible (normal si pas deploye localement)"
    fi
else
    check_warn "curl non disponible"
fi

echo ""
echo "=== RESUME ==="
echo -e "${GREEN}Reussites: $PASSED${NC}"
echo -e "${YELLOW}Avertissements: $WARNINGS${NC}"
echo -e "${RED}Echecs: $FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}Configuration GPU: OK${NC}"
    exit 0
else
    echo -e "${RED}Configuration GPU: PROBLEMES DETECTES${NC}"
    exit 1
fi

