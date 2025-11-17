FROM rustlang/rust:nightly

WORKDIR /app

# Installer les dépendances système
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copier les fichiers de configuration
COPY Cargo.toml Cargo.lock ./

# Copier le code source
COPY src ./src

# ✅ NOUVEAU 2025-11-06: Copier les prompts IA
COPY ia_prompts ./ia_prompts

# ✅ NOUVEAU 2025-11-06: Copier les fichiers de configuration runtime
COPY config ./config

# ✅ NOUVEAU 2025-11-06: Copier les instructions IA
COPY ia_intentions_instructions.md ./

# ✅ NOUVEAU 2025-11-06: Créer dossier data (pour context_enricher.rs)
RUN mkdir -p ./data

# ✅ SQLx OFFLINE : préparer le cache des requêtes à la compilation
# On attend une variable d'environnement/argument de build DATABASE_URL pointant vers la base PostgreSQL.
ARG DATABASE_URL
ENV DATABASE_URL=${DATABASE_URL}

# Installer l'outil en ligne de commande sqlx (utilisé uniquement au build)
RUN cargo install sqlx-cli --no-default-features --features rustls,postgres

# Générer les métadonnées SQLx dans .sqlx/ en mode online,
# puis activer le mode offline pour la compilation finale.
RUN SQLX_OFFLINE=false cargo sqlx prepare -- --lib
ENV SQLX_OFFLINE=true

# Construire l'application
RUN cargo build --release

# Exposer le port
EXPOSE 3001

# Commande de démarrage
CMD ["./target/release/yukpomnang_backend"]
