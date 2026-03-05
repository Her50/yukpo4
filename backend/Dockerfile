# 🚀 Dockerfile optimisé pour AWS ECS/Fargate
# Multi-stage build pour réduire la taille de l'image finale

############################################
# Stage 1: Builder - Compilation Rust
############################################
FROM rust:latest AS builder

WORKDIR /app

# ✅ SQLx OFFLINE : Activer le mode offline SQLx dès le début
ENV SQLX_OFFLINE=true
ENV RUSTFLAGS="-C link-arg=-fuse-ld=lld"
# Configuration réseau pour Cargo (timeout plus long pour éviter les timeouts DNS)
ENV CARGO_NET_TIMEOUT=300
ENV CARGO_NET_RETRY=5

# Installer les dépendances système nécessaires pour la compilation
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    libpq-dev \
    clang \
    lld \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copier les fichiers de configuration Rust
# Note: Cargo.lock sera généré automatiquement par Cargo lors du build si absent
COPY Cargo.toml ./

# ✅ SQLx OFFLINE : copier le cache SQLx AVANT le code source
COPY .sqlx ./.sqlx

# Vérifier que le cache SQLx est présent
RUN echo "=== Vérification du cache SQLx ===" && \
    if [ -d ".sqlx" ]; then \
        CACHE_COUNT=$(find .sqlx -type f 2>/dev/null | wc -l || echo 0) && \
        echo "✅ Cache SQLx présent (${CACHE_COUNT} fichiers)" && \
        if [ "${CACHE_COUNT}" -eq 0 ]; then \
            echo "❌ WARNING: Le cache .sqlx est vide!" && \
            exit 1; \
        fi; \
    else \
        echo "❌ ERREUR: Répertoire .sqlx non trouvé!" && \
        exit 1; \
    fi && \
    echo "==="

# Copier le code source (APRÈS le cache)
COPY src ./src

# Copier les fichiers nécessaires au runtime
COPY ia_prompts ./ia_prompts
COPY config ./config
COPY ia_intentions_instructions.md ./
COPY migrations ./migrations

# Copier les scripts (nécessaires pour certains binaires définis dans Cargo.toml)
COPY scripts ./scripts

# Créer le dossier data
RUN mkdir -p ./data

# Copier Blender depuis le contexte local si disponible (téléchargé via scripts/download-blender.ps1)
# Note: Le dossier blender/ doit être créé par le script download-blender.ps1 avant le build
COPY blender/ ./blender/

# Construire l'application avec optimisations pour production
RUN cargo build --release --features gpu

############################################
# Stage 2: Runtime - Image finale optimisée
############################################
# Utiliser debian:trixie-slim pour GLIBC 2.39+ (compatible avec rust:latest)
FROM debian:trixie-slim

# Métadonnées
LABEL maintainer="Yukpomnang Team"
LABEL description="Yukpomnang Backend API - Optimisé pour AWS ECS/Fargate"
LABEL version="1.0.0"

# Installer les dépendances runtime uniquement
# Note: Les bibliothèques X11 sont nécessaires pour Blender (même en mode headless)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    libpq5 \
    libssl3 \
    curl \
    wget \
    xz-utils \
    postgresql-client \
    ffmpeg \
    libx11-6 \
    libxext6 \
    libxrender1 \
    libxi6 \
    libxfixes3 \
    libxrandr2 \
    libxcursor1 \
    libxinerama1 \
    libxxf86vm1 \
    libxkbcommon0 \
    libsm6 \
    libice6 \
    libfontconfig1 \
    libfreetype6 \
    libgl1 \
    libglu1 \
    && rm -rf /var/lib/apt/lists/*

# Copier Blender depuis le contexte local (OBLIGATOIRE)
# Accepte .tar ou .tar.xz (compressé ou non)
COPY blender/ /tmp/blender/

# Installer Blender depuis le contexte local
# Blender est OBLIGATOIRE pour le rendu 3D AR
RUN if [ -f "/tmp/blender/blender-4.0.0-linux-x64.tar.xz" ]; then \
        BLENDER_ARCHIVE="/tmp/blender/blender-4.0.0-linux-x64.tar.xz"; \
        echo "✅ Installation de Blender depuis .tar.xz..."; \
        tar -xf "$BLENDER_ARCHIVE" -C /tmp; \
    elif [ -f "/tmp/blender/blender-4.0.0-linux-x64.tar" ]; then \
        BLENDER_ARCHIVE="/tmp/blender/blender-4.0.0-linux-x64.tar"; \
        echo "✅ Installation de Blender depuis .tar..."; \
        tar -xf "$BLENDER_ARCHIVE" -C /tmp; \
    else \
        echo "❌ ERREUR: Blender non trouve dans le contexte Docker!" && \
        echo "   Placez blender-4.0.0-linux-x64.tar ou .tar.xz dans backend/blender/" && \
        exit 1; \
    fi && \
    mv /tmp/blender-4.0.0-linux-x64 /opt/blender && \
    ln -s /opt/blender/blender /usr/local/bin/blender && \
    chmod +x /opt/blender/blender && \
    blender --background --version && \
    rm -rf /tmp/blender && \
    echo "✅ Blender installe avec succes"

# Créer un utilisateur non-root pour la sécurité
RUN groupadd -r appuser && useradd -r -g appuser -u 1000 appuser

# Créer les répertoires nécessaires
RUN mkdir -p /app/config /app/logs /app/data /app/uploads /app/migrations /app/ia_prompts /var/data/uploads \
    && chown -R appuser:appuser /app /var/data

# Copier l'exécutable depuis le builder
COPY --from=builder --chown=appuser:appuser /app/target/release/yukpomnang_backend /app/yukpomnang_backend

# Copier les fichiers de configuration et ressources
COPY --from=builder --chown=appuser:appuser /app/config /app/config
COPY --from=builder --chown=appuser:appuser /app/migrations /app/migrations
COPY --from=builder --chown=appuser:appuser /app/ia_prompts /app/ia_prompts
COPY --from=builder --chown=appuser:appuser /app/ia_intentions_instructions.md /app/
# ✅ CRITIQUE : Copier le dossier public pour servir les fichiers .well-known
COPY --from=builder --chown=appuser:appuser /app/public /app/public

# Copier le script de démarrage
COPY scripts/start-cloud.sh /app/start-cloud.sh
RUN chmod +x /app/start-cloud.sh

# Variables d'environnement par défaut
ENV RUST_LOG=info
ENV RUST_BACKTRACE=1
ENV APP_ENV=production
ENV PORT=8080
ENV HOST=0.0.0.0

# Exposer le port (par défaut 8080 pour AWS ALB)
EXPOSE 8080

# Répertoire de travail
WORKDIR /app

# Passer à l'utilisateur non-root
USER appuser

# Health check pour AWS ECS/Fargate
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# Point d'entrée
ENTRYPOINT ["/app/start-cloud.sh"]
CMD ["./yukpomnang_backend"]
