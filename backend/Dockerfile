FROM rustlang/rust:nightly

WORKDIR /app

# ✅ SQLx OFFLINE : Activer le mode offline SQLx dès le début (AVANT tout le reste)
ENV SQLX_OFFLINE=true

# Installer les dépendances système
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copier les fichiers de configuration
COPY Cargo.toml Cargo.lock ./

# ✅ SQLx OFFLINE : copier le cache SQLx AVANT le code source (option A - mode offline)
# Note: Le cache .sqlx doit être présent dans le contexte Docker (commité dans Git)
COPY .sqlx ./.sqlx

# Vérifier que le cache est bien présent (debug)
RUN echo "=== Vérification du cache SQLx ===" && \
    if [ -d ".sqlx" ]; then \
    echo "✅ Répertoire .sqlx trouvé" && \
    echo "SQLX_OFFLINE=${SQLX_OFFLINE}" && \
    CACHE_COUNT=$(find .sqlx -type f 2>/dev/null | wc -l || echo 0) && \
    echo "Nombre de fichiers dans .sqlx: ${CACHE_COUNT}" && \
    if [ "${CACHE_COUNT}" -eq 0 ]; then \
    echo "❌ WARNING: Le cache .sqlx est vide!" && \
    echo "   Le build Docker échouera probablement." && \
    echo "   Veuillez exécuter 'cargo sqlx prepare --workspace' localement"; \
    else \
    echo "✅ Cache SQLx présent (${CACHE_COUNT} fichiers)"; \
    fi && \
    echo "Premiers fichiers du cache:" && \
    ls -la .sqlx 2>/dev/null | head -5 || echo "Impossible de lister .sqlx"; \
    else \
    echo "❌ ERREUR: Répertoire .sqlx non trouvé!" && \
    echo "   Le build Docker échouera." && \
    echo "   Veuillez exécuter 'cargo sqlx prepare --workspace' et commiter .sqlx/"; \
    fi && \
    echo "==="

# Copier le code source (APRÈS le cache pour que SQLx puisse l'utiliser immédiatement)
COPY src ./src

# ✅ NOUVEAU 2025-11-06: Copier les prompts IA
COPY ia_prompts ./ia_prompts

# ✅ NOUVEAU 2025-11-06: Copier les fichiers de configuration runtime
COPY config ./config

# ✅ NOUVEAU 2025-11-06: Copier les instructions IA
COPY ia_intentions_instructions.md ./

# ✅ NOUVEAU 2025-11-06: Créer dossier data (pour context_enricher.rs)
RUN mkdir -p ./data

# Construire l'application (SQLX_OFFLINE=true est déjà défini)
# Note: Si le cache est incomplet, cette étape échouera avec des erreurs SQLx
RUN cargo build --release

# Exposer le port
EXPOSE 3001

# Commande de démarrage
CMD ["./target/release/yukpomnang_backend"]
