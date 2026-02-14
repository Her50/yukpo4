# Script complet pour diagnostiquer et rebuild l'image Docker

$ErrorActionPreference = "Stop"

$region = "eu-west-1"
$ecrRepo = "108964700972.dkr.ecr.$region.amazonaws.com/yukpo-backend"
$imageTag = "latest"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  DIAGNOSTIC ET REBUILD DOCKER" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# ========================================
# 1. ANALYSE DU DOCKERFILE
# ========================================
Write-Host "1. ANALYSE DU DOCKERFILE" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Gray

$dockerfilePath = "backend/Dockerfile.cloud"
if (-not (Test-Path $dockerfilePath)) {
    Write-Host "  ❌ Dockerfile.cloud non trouvé" -ForegroundColor Red
    exit 1
}

Write-Host "  ✅ Dockerfile.cloud trouvé" -ForegroundColor Green
Write-Host ""

# Vérifier les problèmes potentiels
$dockerfileContent = Get-Content $dockerfilePath -Raw

# Problème 1: Base image
if ($dockerfileContent -match "FROM debian:trixie-slim") {
    Write-Host "  ⚠️ PROBLÈME POTENTIEL: Base image debian:trixie-slim" -ForegroundColor Yellow
    Write-Host "     Trixie est une version de développement de Debian" -ForegroundColor Gray
    Write-Host "     Recommandation: Utiliser debian:bookworm-slim (stable)" -ForegroundColor Gray
}

# Problème 2: Permissions utilisateur
if ($dockerfileContent -match "USER appuser") {
    Write-Host "  ✅ Utilisateur non-root configuré (appuser)" -ForegroundColor Green
} else {
    Write-Host "  ⚠️ PROBLÈME: Application s'exécute en root" -ForegroundColor Yellow
}

# Problème 3: ENTRYPOINT vs CMD
if ($dockerfileContent -match "ENTRYPOINT.*start-cloud.sh") {
    Write-Host "  ✅ ENTRYPOINT pointe vers start-cloud.sh" -ForegroundColor Green
} else {
    Write-Host "  ⚠️ PROBLÈME: ENTRYPOINT non configuré correctement" -ForegroundColor Yellow
}

# Problème 4: Dépendances système
$requiredLibs = @("libssl3", "libpq5", "ca-certificates")
foreach ($lib in $requiredLibs) {
    if ($dockerfileContent -match $lib) {
        Write-Host "  ✅ $lib installé" -ForegroundColor Green
    } else {
        Write-Host "  ❌ $lib MANQUANT" -ForegroundColor Red
    }
}

Write-Host ""

# ========================================
# 2. VÉRIFICATION DE L'IMAGE ACTUELLE
# ========================================
Write-Host "2. VÉRIFICATION DE L'IMAGE ACTUELLE" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Gray

try {
    # Vérifier si l'image existe dans ECR
    $images = aws ecr describe-images --repository-name yukpo-backend --region $region --image-ids imageTag=$imageTag --output json 2>&1 | ConvertFrom-Json
    
    if ($images.imageDetails) {
        $image = $images.imageDetails[0]
        Write-Host "  ✅ Image trouvée dans ECR" -ForegroundColor Green
        Write-Host "     Tag: $($image.imageTags[0])" -ForegroundColor White
        Write-Host "     Digest: $($image.imageDigest)" -ForegroundColor White
        Write-Host "     Pushed: $($image.imagePushedAt)" -ForegroundColor White
        Write-Host "     Size: $([math]::Round($image.imageSizeInBytes / 1MB, 2)) MB" -ForegroundColor White
    } else {
        Write-Host "  ⚠️ Image non trouvée dans ECR" -ForegroundColor Yellow
    }
} catch {
    Write-Host "  ⚠️ Impossible de vérifier l'image dans ECR: $_" -ForegroundColor Yellow
}

Write-Host ""

# ========================================
# 3. VÉRIFICATION DES PROBLÈMES IDENTIFIÉS
# ========================================
Write-Host "3. PROBLÈMES IDENTIFIÉS DANS LE DOCKERFILE" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Gray

$problems = @()

# Problème 1: Base image instable
if ($dockerfileContent -match "FROM debian:trixie-slim") {
    $problems += @{
        Severity = "HIGH"
        Issue = "Base image debian:trixie-slim (version de développement)"
        Impact = "Peut causer des incompatibilités avec les bibliothèques compilées"
        Fix = "Changer vers debian:bookworm-slim (Debian 12 stable)"
    }
}

# Problème 2: Architecture
if ($dockerfileContent -notmatch "linux/amd64") {
    $problems += @{
        Severity = "MEDIUM"
        Issue = "Architecture non explicitement spécifiée"
        Impact = "L'exécutable pourrait être compilé pour une mauvaise architecture"
        Fix = "Ajouter --platform=linux/amd64 dans le build"
    }
}

# Problème 3: Permissions exécutable
if ($dockerfileContent -notmatch "chmod.*yukpomnang_backend") {
    $problems += @{
        Severity = "HIGH"
        Issue = "Permissions exécutable non explicitement définies"
        Impact = "L'exécutable pourrait ne pas avoir les permissions d'exécution"
        Fix = "Ajouter RUN chmod +x /app/yukpomnang_backend après COPY"
    }
}

# Problème 4: Dépendances manquantes
$missingDeps = @()
if ($dockerfileContent -notmatch "libgcc-s1") {
    $missingDeps += "libgcc-s1"
}
if ($dockerfileContent -notmatch "libc6") {
    $missingDeps += "libc6"
}

if ($missingDeps.Count -gt 0) {
    $problems += @{
        Severity = "MEDIUM"
        Issue = "Dépendances système manquantes: $($missingDeps -join ', ')"
        Impact = "L'exécutable Rust pourrait ne pas fonctionner sans ces bibliothèques"
        Fix = "Ajouter les dépendances manquantes dans le RUN apt-get install"
    }
}

# Afficher les problèmes
if ($problems.Count -eq 0) {
    Write-Host "  ✅ Aucun problème critique identifié" -ForegroundColor Green
} else {
    foreach ($problem in $problems) {
        $color = if ($problem.Severity -eq "HIGH") { "Red" } else { "Yellow" }
        Write-Host "  ❌ [$($problem.Severity)] $($problem.Issue)" -ForegroundColor $color
        Write-Host "     Impact: $($problem.Impact)" -ForegroundColor Gray
        Write-Host "     Fix: $($problem.Fix)" -ForegroundColor Gray
        Write-Host ""
    }
}

Write-Host ""

# ========================================
# 4. CRÉATION D'UN DOCKERFILE CORRIGÉ
# ========================================
Write-Host "4. CRÉATION D'UN DOCKERFILE CORRIGÉ" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Gray

$fixedDockerfile = @"
# 🚀 Dockerfile.cloud CORRIGÉ pour AWS ECS/Fargate
# Corrections appliquées:
# - Base image: debian:bookworm-slim (stable) au lieu de trixie-slim
# - Permissions exécutable explicites
# - Dépendances système complètes
# - Architecture explicitement spécifiée

############################################
# Stage 1: Builder - Compilation Rust optimisée
############################################
FROM rust:latest AS builder

WORKDIR /app

# ✅ SQLx OFFLINE : Activer le mode offline SQLx dès le début
ENV SQLX_OFFLINE=true
ENV RUSTFLAGS="-C link-arg=-fuse-ld=lld -C target-cpu=native"
ENV CARGO_NET_GIT_FETCH_WITH_CLI=true

# Installer les dépendances système nécessaires pour la compilation
RUN apt-get update && apt-get install -y --no-install-recommends \
    pkg-config \
    libssl-dev \
    libpq-dev \
    libclang-dev \
    clang \
    lld \
    curl \
    ca-certificates \
    make \
    cmake \
    git \
    && rm -rf /var/lib/apt/lists/*

# Copier les fichiers de configuration Rust
COPY Cargo.toml Cargo.lock ./

# ✅ SQLx OFFLINE : copier le cache SQLx AVANT le code source
COPY .sqlx ./.sqlx

# Vérifier que le cache SQLx est présent
RUN echo "=== Vérification du cache SQLx ===" && \
    if [ -d ".sqlx" ]; then \
        CACHE_COUNT=\$(find .sqlx -type f 2>/dev/null | wc -l || echo 0) && \
        echo "✅ Cache SQLx présent (\${CACHE_COUNT} fichiers)" && \
        if [ "\${CACHE_COUNT}" -eq 0 ]; then \
            echo "❌ ERREUR: Le cache .sqlx est vide!" && \
            exit 1; \
        fi; \
    else \
        echo "❌ ERREUR: Répertoire .sqlx non trouvé!" && \
        exit 1; \
    fi && \
    echo "==="

# Créer une couche de cache pour les dépendances (optimisation build)
RUN mkdir -p src && \
    echo "fn main() {}" > src/main.rs && \
    cargo build --release --features gpu 2>&1 | head -20 || true && \
    rm -rf src

# Copier le code source (APRÈS le cache des dépendances)
COPY src ./src

# Copier les scripts nécessaires pour les binaires définis dans Cargo.toml
COPY scripts ./scripts

# Copier les fichiers nécessaires au runtime
COPY ia_prompts ./ia_prompts
COPY config ./config
COPY migrations ./migrations
COPY ia_intentions_instructions.md ./

# Créer le dossier data
RUN mkdir -p ./data

# Construire l'application avec optimisations maximales pour production
RUN cargo build --release --features gpu \
    && strip target/release/yukpomnang_backend

############################################
# Stage 2: Runtime - Image finale optimisée AWS
############################################
# ✅ CORRIGÉ: Utiliser debian:bookworm-slim (Debian 12 stable) au lieu de trixie-slim
FROM debian:bookworm-slim

# Métadonnées
LABEL maintainer="Yukpomnang Team"
LABEL description="Yukpomnang Backend Cloud - Optimisé pour AWS ECS/Fargate"
LABEL version="2.0.1"
LABEL platform="aws-ecs-fargate"

# Installer uniquement les dépendances runtime essentielles + X11/virtual X pour Blender headless
# ✅ CORRIGÉ: Ajout de libgcc-s1 et libc6 pour compatibilité Rust
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    libpq5 \
    libssl3 \
    libgcc-s1 \
    libc6 \
    curl \
    wget \
    xz-utils \
    postgresql-client \
    redis-tools \
    xvfb \
    libx11-6 \
    libxrender1 \
    libxi6 \
    libgl1-mesa-glx \
    libglu1-mesa \
    libxkbcommon0 \
    libsm6 \
    libice6 \
    libfontconfig1 \
    libxext6 \
    libxxf86vm1 \
    libxfixes3 \
    && rm -rf /var/lib/apt/lists/*

# 🎨 Installer Blender pour rendu 3D AR (optimisé pour AWS - mode headless avec xvfb)
RUN wget --tries=10 --timeout=300 --retry-connrefused --waitretry=10 --progress=dot:giga \
    https://download.blender.org/release/Blender4.0/blender-4.0.0-linux-x64.tar.xz -O blender.tar.xz \
    && tar -xf blender.tar.xz \
    && mv blender-4.0.0-linux-x64 /opt/blender \
    && rm blender.tar.xz \
    && chmod +x /opt/blender/blender \
    && ln -sf /opt/blender/blender /usr/local/bin/blender \
    && xvfb-run -a blender --version > /dev/null 2>&1 || echo "Blender installé (vérification avec xvfb)" \
    && apt-get clean

# Créer un utilisateur non-root pour la sécurité (uid 1000 pour compatibilité AWS)
RUN groupadd -r appuser -g 1000 && \
    useradd -r -g appuser -u 1000 -m -d /home/appuser -s /bin/bash appuser

# Créer les répertoires nécessaires avec permissions appropriées
# ✅ IMPORTANT: l'app utilise UPLOAD_STORAGE_PATH par défaut = /var/data/uploads
RUN mkdir -p /app/config /app/logs /app/data /app/uploads /app/migrations /app/ia_prompts /var/data/uploads \
    && chown -R appuser:appuser /app /var/data

# Copier l'exécutable depuis le builder (striped pour réduire la taille)
COPY --from=builder --chown=appuser:appuser /app/target/release/yukpomnang_backend /app/yukpomnang_backend

# ✅ CORRIGÉ: S'assurer que l'exécutable a les permissions d'exécution
RUN chmod +x /app/yukpomnang_backend && \
    ls -la /app/yukpomnang_backend && \
    file /app/yukpomnang_backend

# Copier les fichiers de configuration et ressources
COPY --from=builder --chown=appuser:appuser /app/config /app/config
COPY --from=builder --chown=appuser:appuser /app/migrations /app/migrations
COPY --from=builder --chown=appuser:appuser /app/ia_prompts /app/ia_prompts
COPY --from=builder --chown=appuser:appuser /app/ia_intentions_instructions.md /app/

# Copier le script de démarrage optimisé pour AWS
COPY scripts/start-cloud.sh /app/start-cloud.sh
RUN chmod +x /app/start-cloud.sh

# Variables d'environnement par défaut pour AWS
ENV RUST_LOG=info
ENV RUST_BACKTRACE=1
ENV APP_ENV=production
ENV PORT=8080
ENV HOST=0.0.0.0
ENV AWS_REGION=us-east-1

# Variables d'optimisation pour AWS ECS/Fargate
ENV DB_POOL_SIZE=100
ENV DB_POOL_MIN_SIZE=20
ENV DB_ACQUIRE_TIMEOUT_SECS=30
ENV MAX_CONCURRENT_REQUESTS=10000
ENV CACHE_TTL=300

# Exposer le port (par défaut 8080 pour AWS ALB)
EXPOSE 8080

# Répertoire de travail
WORKDIR /app

# Passer à l'utilisateur non-root
USER appuser

# Health check optimisé pour AWS ECS/Fargate
# Intervalle plus long pour réduire la charge réseau
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# Point d'entrée
ENTRYPOINT ["/app/start-cloud.sh"]
CMD ["./yukpomnang_backend"]
"@

$fixedDockerfilePath = "backend/Dockerfile.cloud.fixed"
$fixedDockerfile | Out-File -FilePath $fixedDockerfilePath -Encoding UTF8 -NoNewline

Write-Host "  ✅ Dockerfile corrigé créé: $fixedDockerfilePath" -ForegroundColor Green
Write-Host ""

# ========================================
# 5. SCRIPT DE REBUILD
# ========================================
Write-Host "5. SCRIPT DE REBUILD" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Gray

$rebuildScript = @"
#!/bin/bash
# Script pour rebuild et push l'image Docker corrigée

set -e

echo "========================================"
echo "  REBUILD IMAGE DOCKER CORRIGÉE"
echo "========================================"
echo ""

# Variables
REGION="eu-west-1"
ECR_REPO="108964700972.dkr.ecr.\${REGION}.amazonaws.com/yukpo-backend"
IMAGE_TAG="latest"
DOCKERFILE="backend/Dockerfile.cloud.fixed"

# Vérifier que le Dockerfile existe
if [ ! -f "\$DOCKERFILE" ]; then
    echo "❌ ERREUR: Dockerfile corrigé non trouvé: \$DOCKERFILE"
    exit 1
fi

echo "✅ Dockerfile trouvé: \$DOCKERFILE"
echo ""

# Login à ECR
echo "🔐 Login à AWS ECR..."
aws ecr get-login-password --region \$REGION | docker login --username AWS --password-stdin \$ECR_REPO

# Build l'image avec architecture explicitement spécifiée
echo ""
echo "🔨 Build de l'image Docker..."
docker build \\
    --platform linux/amd64 \\
    --file \$DOCKERFILE \\
    --tag \$ECR_REPO:\$IMAGE_TAG \\
    --tag \$ECR_REPO:fixed-\$(date +%Y%m%d-%H%M%S) \\
    --progress=plain \\
    backend/

# Vérifier que l'image a été créée
if [ \$? -eq 0 ]; then
    echo ""
    echo "✅ Build réussi!"
    echo ""
    echo "📊 Informations sur l'image:"
    docker images \$ECR_REPO:\$IMAGE_TAG --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}\t{{.CreatedAt}}"
    echo ""
    
    # Vérifier l'architecture de l'exécutable dans l'image
    echo "🔍 Vérification de l'exécutable dans l'image..."
    docker run --rm \$ECR_REPO:\$IMAGE_TAG file /app/yukpomnang_backend
    docker run --rm \$ECR_REPO:\$IMAGE_TAG ldd /app/yukpomnang_backend || echo "⚠️ ldd non disponible ou exécutable statique"
    echo ""
    
    # Push vers ECR
    echo "📤 Push vers ECR..."
    docker push \$ECR_REPO:\$IMAGE_TAG
    docker push \$ECR_REPO:fixed-\$(date +%Y%m%d-%H%M%S)
    
    if [ \$? -eq 0 ]; then
        echo ""
        echo "✅ Image poussée avec succès vers ECR!"
        echo ""
        echo "🚀 Prochaines étapes:"
        echo "   1. Redémarrer le service ECS:"
        echo "      aws ecs update-service --cluster yukpo-cluster --service yukpo-backend-service --force-new-deployment --region \$REGION"
        echo ""
        echo "   2. Vérifier les logs après redémarrage:"
        echo "      aws logs tail /ecs/yukpo-backend --follow --region \$REGION"
    fi
else
    echo ""
    echo "❌ ERREUR: Build échoué"
    exit 1
fi
"@

$rebuildScriptPath = "scripts/rebuild-docker-fixed.sh"
$rebuildScript | Out-File -FilePath $rebuildScriptPath -Encoding UTF8 -NoNewline

Write-Host "  ✅ Script de rebuild créé: $rebuildScriptPath" -ForegroundColor Green
Write-Host ""

# ========================================
# 6. RÉSUMÉ ET RECOMMANDATIONS
# ========================================
Write-Host "6. RÉSUMÉ ET RECOMMANDATIONS" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Gray

Write-Host "  Problèmes identifiés: $($problems.Count)" -ForegroundColor White
Write-Host ""

if ($problems.Count -gt 0) {
    Write-Host "  🔧 Actions recommandées:" -ForegroundColor Cyan
    Write-Host "     1. Utiliser le Dockerfile corrigé: backend/Dockerfile.cloud.fixed" -ForegroundColor White
    Write-Host "     2. Rebuild l'image avec le script: scripts/rebuild-docker-fixed.sh" -ForegroundColor White
    Write-Host "     3. Vérifier que l'exécutable fonctionne dans l'image" -ForegroundColor White
    Write-Host "     4. Push vers ECR et redémarrer le service ECS" -ForegroundColor White
    Write-Host ""
    Write-Host "  📝 Fichiers créés:" -ForegroundColor Cyan
    Write-Host "     - $fixedDockerfilePath" -ForegroundColor White
    Write-Host "     - $rebuildScriptPath" -ForegroundColor White
} else {
    Write-Host "  ✅ Aucun problème critique identifié" -ForegroundColor Green
    Write-Host "     Le problème pourrait être ailleurs (configuration ECS, variables d'environnement, etc.)" -ForegroundColor Gray
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  DIAGNOSTIC TERMINÉ" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

