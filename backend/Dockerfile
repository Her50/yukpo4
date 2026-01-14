# 🚀 Dockerfile optimisé pour AWS ECS/Fargate
# Multi-stage build pour réduire la taille de l'image finale

############################################
# Stage 1: Builder - Compilation Rust
############################################
FROM rust:1.75-slim as builder

WORKDIR /app

# ✅ SQLx OFFLINE : Activer le mode offline SQLx dès le début
ENV SQLX_OFFLINE=true
ENV RUSTFLAGS="-C link-arg=-fuse-ld=lld"

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
COPY Cargo.toml Cargo.lock ./

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

# Créer le dossier data
RUN mkdir -p ./data

# Construire l'application avec optimisations pour production
RUN cargo build --release --features gpu

############################################
# Stage 2: Runtime - Image finale optimisée
############################################
FROM debian:bookworm-slim

# Métadonnées
LABEL maintainer="Yukpomnang Team"
LABEL description="Yukpomnang Backend API - Optimisé pour AWS ECS/Fargate"
LABEL version="1.0.0"

# Installer les dépendances runtime uniquement
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    libpq5 \
    libssl3 \
    curl \
    wget \
    xz-utils \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# 🎨 Installer Blender pour rendu 3D AR (optimisé pour AWS)
RUN wget -q https://download.blender.org/release/Blender4.0/blender-4.0.0-linux-x64.tar.xz \
    && tar -xf blender-4.0.0-linux-x64.tar.xz \
    && mv blender-4.0.0-linux-x64 /opt/blender \
    && rm blender-4.0.0-linux-x64.tar.xz \
    && ln -s /opt/blender/blender /usr/local/bin/blender \
    && chmod +x /opt/blender/blender \
    && blender --version \
    && apt-get clean

# Créer un utilisateur non-root pour la sécurité
RUN groupadd -r appuser && useradd -r -g appuser -u 1000 appuser

# Créer les répertoires nécessaires
RUN mkdir -p /app/config /app/logs /app/data /app/uploads /app/migrations /app/ia_prompts \
    && chown -R appuser:appuser /app

# Copier l'exécutable depuis le builder
COPY --from=builder --chown=appuser:appuser /app/target/release/yukpomnang_backend /app/yukpomnang_backend

# Copier les fichiers de configuration et ressources
COPY --from=builder --chown=appuser:appuser /app/config /app/config
COPY --from=builder --chown=appuser:appuser /app/migrations /app/migrations
COPY --from=builder --chown=appuser:appuser /app/ia_prompts /app/ia_prompts
COPY --from=builder --chown=appuser:appuser /app/ia_intentions_instructions.md /app/

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
