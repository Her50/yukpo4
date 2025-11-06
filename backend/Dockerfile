FROM rust:1.75-slim

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

# Construire l'application
RUN cargo build --release

# Exposer le port
EXPOSE 3001

# Commande de démarrage
CMD ["./target/release/yukpomnang_backend"]
