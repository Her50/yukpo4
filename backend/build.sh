#!/bin/bash

# Script de build personnalisé pour Render
# Ce script configure la base de données puis compile l'application

echo "=== Build Yukpomnang Backend ==="

# Installer sqlx-cli si nécessaire
if ! command -v sqlx &> /dev/null; then
    echo "Installation de sqlx-cli..."
    cargo install sqlx-cli --no-default-features --features postgres
fi

# Étape 1: Configuration de la base de données
echo "1. Configuration de la base de données..."
if [ -f "scripts/setup-database.sh" ]; then
    chmod +x scripts/setup-database.sh
    ./scripts/setup-database.sh
    if [ $? -ne 0 ]; then
        echo "Erreur lors de la configuration de la base de données"
        exit 1
    fi
else
    echo "Script de configuration de base de données non trouvé"
fi

# Étape 2: Compilation avec Cargo en mode offline SQLx
echo "2. Compilation de l'application..."
echo "Mode SQLx: OFFLINE (pas de vérification DB à la compilation)"
export SQLX_OFFLINE=true
cargo build --release

if [ $? -eq 0 ]; then
    echo "✓ Compilation réussie"
    echo "=== Build terminé avec succès ==="
else
    echo "✗ Erreur lors de la compilation"
    exit 1
fi
