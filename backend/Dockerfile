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

# Construire l'application
RUN cargo build --release

# Exposer le port
EXPOSE 3001

# Commande de démarrage
CMD ["./target/release/yukpomnang_backend"]
